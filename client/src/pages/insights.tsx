import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  Heart,
  Activity,
  Brain,
  Pill,
  Shield,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  Stethoscope,
  AlertCircle,
  Info,
  ArrowUp,
  ArrowDown,
  Minus,
  Beaker,
  Calendar,
  Watch,
  Moon,
  Footprints,
  BookOpen,
  BarChart3,
  ExternalLink,
  Bookmark,
  ThumbsUp,
  Trophy,
  Flame,
  Star,
} from "lucide-react";
import { Link } from "wouter";
import { AIDisclaimer } from "@/components/ai-transparency";
import type { 
  HealthRiskAssessment, 
  HealthCoachingSession, 
  PersonalizedHealthInsight,
  RiskCategory,
  HealthContent,
  ContentRecommendation,
  HealthTrendAnalysis,
  EarlyWarningIndicator,
} from "@shared/schema";

interface PatientHealthSummary {
  id: string;
  generatedAt: string;
  overallStatus: "excellent" | "good" | "fair" | "needs_attention";
  headline: string;
  keySummaryPoints: string[];
  activeConditions: { name: string; status: string; management: string }[];
  medicationOverview: { count: number; concerns: string[]; adherenceNote?: string };
  recentLabHighlights: { name: string; status: string; trend?: string }[];
  preventiveCareReminders: string[];
  lifestyleRecommendations: string[];
  upcomingActions: string[];
  aiGeneratedInsight: string;
  disclaimer: string;
}

interface PredictiveRiskAssessment {
  id: string;
  category: string;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  title: string;
  description: string;
  factors: { name: string; value?: string; impact: string; weight: number; source: string }[];
  recommendations: string[];
  preventiveActions: string[];
  monitoringSchedule?: string;
  confidenceScore: number;
  lastUpdated: string;
}

interface LabTrend {
  labName: string;
  direction: string;
  significance: string;
  explanation: string;
}

interface WearableSummary {
  connectedDevices: number;
  totalDataPoints: number;
  avgDailySteps: number;
  avgHeartRate: number;
  avgSleepHours: number;
}

interface ContentRecommendationsData {
  patientId: string;
  generatedAt: string;
  recommendations: ContentRecommendation[];
  totalRecommendations: number;
}

interface EnhancedTrendsData {
  patientId: string;
  generatedAt: string;
  trends: HealthTrendAnalysis[];
  summary: {
    total: number;
    improving: number;
    stable: number;
    declining: number;
    concerning: number;
  };
}

interface WarningsData {
  patientId: string;
  generatedAt: string;
  warnings: EarlyWarningIndicator[];
  summary: {
    total: number;
    alerts: number;
    warnings: number;
    cautions: number;
    watch: number;
  };
}

interface PredictiveData {
  patientId: string;
  generatedAt: string;
  riskAssessments: PredictiveRiskAssessment[];
  labTrends: {
    trends: LabTrend[];
    overallAssessment: string;
  };
  dataSnapshot: {
    activeMedications: number;
    activeConditions: number;
    recentLabTests: number;
    allergies: number;
    connectedDevices?: number;
  };
  wearableSummary?: WearableSummary;
}

const categoryIcons: Record<RiskCategory | "general" | string, React.ElementType> = {
  cardiovascular: Heart,
  metabolic: Activity,
  respiratory: Activity,
  mental_health: Brain,
  chronic_disease: Activity,
  lifestyle: Target,
  medication: Pill,
  medication_adherence: Pill,
  preventive_care: Shield,
  kidney: Activity,
  liver: Activity,
  diabetes: Activity,
  general: Lightbulb,
};

const riskLevelColors: Record<string, string> = {
  low: "bg-green-500/10 text-green-700 dark:text-green-400",
  moderate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  elevated: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  high: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  urgent: "bg-red-500/10 text-red-700 dark:text-red-400",
};

interface DashboardData {
  riskAssessments: HealthRiskAssessment[];
  coachingSessions: HealthCoachingSession[];
  personalizedInsights: PersonalizedHealthInsight[];
  summary: {
    totalRisks: number;
    highRisks: number;
    activeCoachingSessions: number;
    unreadInsights: number;
  };
}

const overallStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "bg-green-500/10", text: "text-green-700 dark:text-green-400", label: "Excellent" },
  good: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", label: "Good" },
  fair: { bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400", label: "Fair" },
  needs_attention: { bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-400", label: "Needs Attention" },
};

export default function Insights() {
  const [activeTab, setActiveTab] = useState("summary");

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/health-insights/dashboard"],
  });

  // Fetch gamification data for progress widget
  interface GamificationSummaryData {
    stats: { totalPoints: number; currentLevel: number; currentStreak: number; levelName: string };
    weeklyProgress: { pointsEarned: number };
  }
  const { data: gamificationData } = useQuery<GamificationSummaryData>({
    queryKey: ["/api/gamification/summary"],
  });

  const { data: predictiveData, isLoading: predictiveLoading, isError: predictiveError, refetch: refetchPredictive } = useQuery<PredictiveData>({
    queryKey: ["/api/health-insights/predictive"],
    retry: false,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<PatientHealthSummary | null>({
    queryKey: ["/api/health-insights/summary"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: contentRecsData, isLoading: contentRecsLoading } = useQuery<ContentRecommendationsData>({
    queryKey: ["/api/content-recommendations"],
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery<EnhancedTrendsData>({
    queryKey: ["/api/health-insights/trends/enhanced"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: warningsData, isLoading: warningsLoading } = useQuery<WarningsData>({
    queryKey: ["/api/health-insights/warnings"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/health-insights/summary/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-insights/summary"] });
    },
  });

  const analyzePredictiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/health-insights/predictive/analyze");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-insights/predictive"] });
    },
  });

  const generateRisksMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/health-insights/risk-assessments/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-insights/dashboard"] });
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/health-insights/personalized/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-insights/dashboard"] });
    },
  });

  const markInsightReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/health-insights/personalized/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-insights/dashboard"] });
    },
  });

  const healthSummary = summaryData || (generateSummaryMutation.data as PatientHealthSummary | undefined);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = dashboardData?.summary || { totalRisks: 0, highRisks: 0, activeCoachingSessions: 0, unreadInsights: 0 };
  const riskAssessments = dashboardData?.riskAssessments || [];
  const coachingSessions = dashboardData?.coachingSessions || [];
  const personalizedInsights = dashboardData?.personalizedInsights || [];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Health Insights</h2>
            <p className="text-muted-foreground">AI-powered health analysis and personalized coaching</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateRisksMutation.mutate()}
              disabled={generateRisksMutation.isPending}
              data-testid="button-analyze-risks"
            >
              {generateRisksMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Analyze Risks
            </Button>
            <Button 
              size="sm"
              onClick={() => generateInsightsMutation.mutate()}
              disabled={generateInsightsMutation.isPending}
              data-testid="button-get-insights"
            >
              {generateInsightsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Get Insights
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalRisks}</p>
                  <p className="text-sm text-muted-foreground">Risk Areas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.highRisks}</p>
                  <p className="text-sm text-muted-foreground">Elevated Risks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.activeCoachingSessions}</p>
                  <p className="text-sm text-muted-foreground">Active Goals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.unreadInsights}</p>
                  <p className="text-sm text-muted-foreground">New Insights</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compact Gamification Progress Widget */}
        <Card className="bg-gradient-to-r from-primary/5 via-transparent to-amber-500/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {gamificationData?.stats?.levelName || "Your Progress"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Level {gamificationData?.stats?.currentLevel || 1} · {gamificationData?.stats?.totalPoints || 0} XP
                    </p>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-8 hidden sm:block" />
                <div className="flex items-center gap-4 hidden sm:flex">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      +{gamificationData?.weeklyProgress?.pointsEarned || 0} this week
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">
                      {gamificationData?.stats?.currentStreak || 0} day streak
                    </span>
                  </div>
                </div>
              </div>
              <Link href="/rewards">
                <Button variant="outline" size="sm" data-testid="button-view-rewards">
                  <Trophy className="h-4 w-4 mr-2" />
                  View Rewards
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="summary" data-testid="tab-summary">
              <FileText className="h-4 w-4 mr-1" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="predictive" data-testid="tab-predictive">
              <TrendingUp className="h-4 w-4 mr-1" />
              Predictive
            </TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">
              <BarChart3 className="h-4 w-4 mr-1" />
              Trends
              {(trendsData?.summary?.concerning || 0) > 0 && (
                <Badge variant="outline" className="ml-1 h-5 px-1.5 text-orange-600">
                  {trendsData?.summary?.concerning}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">
              <BookOpen className="h-4 w-4 mr-1" />
              For You
            </TabsTrigger>
            <TabsTrigger value="risks" data-testid="tab-risks">
              Risk Assessment
              {summary.highRisks > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                  {summary.highRisks}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="coaching" data-testid="tab-coaching">Coaching</TabsTrigger>
          </TabsList>

          {/* AI Health Summary Tab */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            {healthSummary ? (
              <div className="space-y-4">
                {/* Overall Status Card */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${overallStatusColors[healthSummary.overallStatus]?.bg || "bg-muted"}`}>
                          <CheckCircle2 className={`h-6 w-6 ${overallStatusColors[healthSummary.overallStatus]?.text || "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{healthSummary.headline}</h3>
                          <Badge className={`${overallStatusColors[healthSummary.overallStatus]?.bg || ""} ${overallStatusColors[healthSummary.overallStatus]?.text || ""}`}>
                            {overallStatusColors[healthSummary.overallStatus]?.label || "Unknown"}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Generated {new Date(healthSummary.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-3">
                      <AIDisclaimer text="your health records" />
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                        <p className="text-sm">{healthSummary.aiGeneratedInsight}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Key Points</h4>
                      <ul className="space-y-1">
                        {healthSummary.keySummaryPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Conditions & Medications Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        Active Conditions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {healthSummary.activeConditions.length > 0 ? (
                        <ul className="space-y-2">
                          {healthSummary.activeConditions.map((c, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span>{c.name}</span>
                              <Badge variant="outline" className="text-xs">{c.status}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No active conditions on record</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        Medications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold mb-2">{healthSummary.medicationOverview.count}</p>
                      <p className="text-sm text-muted-foreground">Active medications</p>
                      {healthSummary.medicationOverview.concerns.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {healthSummary.medicationOverview.concerns.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-orange-600 dark:text-orange-400">
                              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                              {c}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Lab Highlights */}
                {healthSummary.recentLabHighlights.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Beaker className="h-4 w-4" />
                        Recent Lab Highlights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {healthSummary.recentLabHighlights.map((lab, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                            <span className="text-sm font-medium">{lab.name}</span>
                            <Badge variant={lab.status === "Normal" ? "secondary" : "outline"} className="text-xs">
                              {lab.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Lifestyle Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {healthSummary.lifestyleRecommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Next Steps
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {healthSummary.upcomingActions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  {healthSummary.disclaimer}
                </div>
              </div>
            ) : generateSummaryMutation.isError ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
                  <h3 className="font-semibold mb-2">Unable to Generate Summary</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We couldn't generate your health summary. Please try again.
                  </p>
                  <Button 
                    onClick={() => {
                      generateSummaryMutation.reset();
                      generateSummaryMutation.mutate();
                    }}
                    variant="outline"
                    data-testid="button-retry-summary"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Generate Your Health Summary</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get an AI-powered summary of your health records in plain, easy-to-understand language.
                  </p>
                  <Button 
                    onClick={() => generateSummaryMutation.mutate()}
                    disabled={generateSummaryMutation.isPending}
                    data-testid="button-generate-summary"
                  >
                    {generateSummaryMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Predictive Insights Tab */}
          <TabsContent value="predictive" className="space-y-4 mt-4">
            {predictiveLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="h-24 bg-muted animate-pulse rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : predictiveData?.riskAssessments && predictiveData.riskAssessments.length > 0 ? (
              <div className="space-y-4">
                {/* Data Snapshot */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{predictiveData.dataSnapshot.activeMedications}</p>
                      <p className="text-xs text-muted-foreground">Medications</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{predictiveData.dataSnapshot.activeConditions}</p>
                      <p className="text-xs text-muted-foreground">Conditions</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{predictiveData.dataSnapshot.recentLabTests}</p>
                      <p className="text-xs text-muted-foreground">Lab Tests</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{predictiveData.dataSnapshot.allergies}</p>
                      <p className="text-xs text-muted-foreground">Allergies</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="stat-connected-devices">
                    <CardContent className="p-3 text-center">
                      <Watch className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold" data-testid="text-connected-devices">{predictiveData.dataSnapshot.connectedDevices || 0}</p>
                      <p className="text-xs text-muted-foreground">Devices</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Wearable Activity Summary */}
                {predictiveData.wearableSummary && predictiveData.wearableSummary.connectedDevices > 0 && (
                  <Card data-testid="card-wearable-summary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <Watch className="h-4 w-4" />
                        Activity Summary (Last 7 Days)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 grid-cols-3">
                        <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="stat-avg-steps">
                          <Footprints className="h-5 w-5 mx-auto mb-1 text-primary" />
                          <p className="text-lg font-bold" data-testid="text-avg-steps">{predictiveData.wearableSummary.avgDailySteps.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Avg Daily Steps</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="stat-avg-heart-rate">
                          <Heart className="h-5 w-5 mx-auto mb-1 text-destructive" />
                          <p className="text-lg font-bold" data-testid="text-avg-heart-rate">{predictiveData.wearableSummary.avgHeartRate} bpm</p>
                          <p className="text-xs text-muted-foreground">Avg Heart Rate</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="stat-avg-sleep">
                          <Moon className="h-5 w-5 mx-auto mb-1 text-primary" />
                          <p className="text-lg font-bold" data-testid="text-avg-sleep">{predictiveData.wearableSummary.avgSleepHours} hrs</p>
                          <p className="text-xs text-muted-foreground">Avg Sleep</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-3" data-testid="text-wearable-data-points">
                        Data from {predictiveData.wearableSummary.connectedDevices} connected device{predictiveData.wearableSummary.connectedDevices !== 1 ? 's' : ''} ({predictiveData.wearableSummary.totalDataPoints} data points)
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Risk Assessments */}
                <h3 className="text-lg font-semibold">Predictive Risk Assessments</h3>
                {predictiveData.riskAssessments.map((assessment) => {
                  const Icon = categoryIcons[assessment.category] || Activity;
                  return (
                    <Card key={assessment.id} data-testid={`predictive-risk-${assessment.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${riskLevelColors[assessment.riskLevel]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{assessment.title}</CardTitle>
                              <CardDescription className="capitalize">
                                {assessment.category.replace(/_/g, " ")}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={riskLevelColors[assessment.riskLevel]}>
                              {assessment.riskLevel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(assessment.confidenceScore * 100)}% confidence
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{assessment.description}</p>
                        
                        {/* Contributing Factors */}
                        {assessment.factors.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Contributing Factors</h4>
                            <div className="flex flex-wrap gap-2">
                              {assessment.factors.slice(0, 5).map((factor, i) => (
                                <Badge 
                                  key={i} 
                                  variant="outline" 
                                  className={factor.impact === "positive" ? "border-green-500 text-green-700 dark:text-green-400" : factor.impact === "negative" ? "border-orange-500 text-orange-700 dark:text-orange-400" : ""}
                                >
                                  {factor.impact === "positive" && <ArrowDown className="h-3 w-3 mr-1" />}
                                  {factor.impact === "negative" && <ArrowUp className="h-3 w-3 mr-1" />}
                                  {factor.name}
                                  {factor.value && `: ${factor.value}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {assessment.recommendations.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                            <ul className="space-y-1">
                              {assessment.recommendations.slice(0, 3).map((rec, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {assessment.monitoringSchedule && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            <Clock className="h-4 w-4" />
                            <span>{assessment.monitoringSchedule}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Lab Trends */}
                {predictiveData.labTrends && predictiveData.labTrends.trends.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <h3 className="text-lg font-semibold">Lab Trends (Past Year)</h3>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-4">{predictiveData.labTrends.overallAssessment}</p>
                        <div className="space-y-2">
                          {predictiveData.labTrends.trends.map((trend, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                {trend.direction === "Increasing" && <TrendingUp className="h-4 w-4 text-orange-500" />}
                                {trend.direction === "Decreasing" && <TrendingDown className="h-4 w-4 text-blue-500" />}
                                {trend.direction === "Stable" && <Minus className="h-4 w-4 text-green-500" />}
                                <span className="font-medium text-sm">{trend.labName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{trend.significance}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            ) : predictiveError ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
                  <h3 className="font-semibold mb-2">Unable to Load Predictive Data</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We couldn't load your predictive health data. Please try again.
                  </p>
                  <Button 
                    onClick={() => refetchPredictive()}
                    variant="outline"
                    data-testid="button-retry-predictive"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Predictive Data Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analyze your health records to get predictive insights and risk assessments.
                  </p>
                  <Button 
                    onClick={() => analyzePredictiveMutation.mutate()}
                    disabled={analyzePredictiveMutation.isPending}
                    data-testid="button-analyze-predictive"
                  >
                    {analyzePredictiveMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-2" />
                        Analyze Health Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {personalizedInsights.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Personalized Insights</h3>
                {personalizedInsights.map((insight) => {
                  const Icon = categoryIcons[insight.category as RiskCategory] || Lightbulb;
                  return (
                    <Card 
                      key={insight.id} 
                      className={`transition-opacity ${insight.isRead ? "opacity-70" : ""}`}
                      data-testid={`insight-card-${insight.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${priorityColors[insight.priority]}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{insight.title}</h4>
                              {!insight.isRead && (
                                <Badge variant="secondary" className="text-xs">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{insight.message}</p>
                            {insight.actionRequired && insight.actionText && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="px-0 mt-2 text-primary"
                                onClick={() => markInsightReadMutation.mutate(insight.id)}
                                data-testid={`insight-action-${insight.id}`}
                              >
                                {insight.actionText}
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Insights Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Get Insights" to generate personalized health recommendations based on your records.
                  </p>
                  <Button 
                    onClick={() => generateInsightsMutation.mutate()}
                    disabled={generateInsightsMutation.isPending}
                    data-testid="button-generate-first-insights"
                  >
                    Generate Insights
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Health Trends Tab */}
          <TabsContent value="trends" className="space-y-4 mt-4">
            {trendsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="h-24 bg-muted animate-pulse rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (trendsData?.trends?.length || 0) > 0 ? (
              <div className="space-y-4">
                {/* Early Warnings Section */}
                {(warningsData?.warnings?.length || 0) > 0 && (
                  <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        Early Warnings
                      </CardTitle>
                      <CardDescription>
                        Items that may need your attention
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {warningsData?.warnings.slice(0, 3).map((warning) => (
                        <div 
                          key={warning.id} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-background border"
                          data-testid={`warning-${warning.id}`}
                        >
                          <div className={`p-1.5 rounded-full shrink-0 ${
                            warning.warningLevel === "alert" ? "bg-red-500/20" :
                            warning.warningLevel === "warning" ? "bg-orange-500/20" :
                            warning.warningLevel === "caution" ? "bg-yellow-500/20" : "bg-blue-500/20"
                          }`}>
                            <AlertCircle className={`h-4 w-4 ${
                              warning.warningLevel === "alert" ? "text-red-600" :
                              warning.warningLevel === "warning" ? "text-orange-600" :
                              warning.warningLevel === "caution" ? "text-yellow-600" : "text-blue-600"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{warning.title}</p>
                              <Badge variant="outline" className={`text-xs ${
                                warning.warningLevel === "alert" ? "text-red-600 border-red-300" :
                                warning.warningLevel === "warning" ? "text-orange-600 border-orange-300" :
                                warning.warningLevel === "caution" ? "text-yellow-600 border-yellow-300" : "text-blue-600 border-blue-300"
                              }`}>
                                {warning.warningLevel}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{warning.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Action recommended: {warning.timeToAction}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Trends Summary */}
                <div className="grid gap-3 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4 text-green-600" />
                        <span className="text-2xl font-bold">{trendsData?.summary?.improving || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Improving</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-blue-600" />
                        <span className="text-2xl font-bold">{trendsData?.summary?.stable || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Stable</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-4 w-4 text-orange-600" />
                        <span className="text-2xl font-bold">{trendsData?.summary?.declining || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Declining</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-2xl font-bold">{trendsData?.summary?.concerning || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Need Attention</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Trend Details */}
                <div className="space-y-3">
                  {trendsData?.trends.map((trend) => (
                    <Card key={trend.id} data-testid={`trend-${trend.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              trend.direction === "improving" ? "bg-green-500/10" :
                              trend.direction === "declining" ? "bg-orange-500/10" :
                              trend.direction === "fluctuating" ? "bg-yellow-500/10" : "bg-blue-500/10"
                            }`}>
                              {trend.direction === "improving" ? (
                                <ArrowUp className="h-4 w-4 text-green-600" />
                              ) : trend.direction === "declining" ? (
                                <ArrowDown className="h-4 w-4 text-orange-600" />
                              ) : (
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-base">{trend.metricName}</CardTitle>
                              <CardDescription>
                                Over {trend.timeRangeDays} days
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${
                              trend.significance === "concerning" || trend.significance === "critical" 
                                ? "bg-orange-500/10 text-orange-700" :
                              trend.significance === "notable" 
                                ? "bg-yellow-500/10 text-yellow-700" 
                                : "bg-green-500/10 text-green-700"
                            }`}>
                              {trend.significance}
                            </Badge>
                            <span className={`font-semibold ${
                              trend.percentageChange > 0 ? "text-green-600" : 
                              trend.percentageChange < 0 ? "text-orange-600" : ""
                            }`}>
                              {trend.percentageChange > 0 ? "+" : ""}{trend.percentageChange}%
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Current: </span>
                            <span className="font-medium">{trend.currentValue}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Previous: </span>
                            <span className="font-medium">{trend.previousValue}</span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">{trend.aiAnalysis}</p>
                        
                        {trend.recommendedActions.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Recommended Actions:</p>
                            <ul className="space-y-1">
                              {trend.recommendedActions.slice(0, 2).map((action, i) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                          <span>Confidence: {trend.confidenceLevel}%</span>
                          <Progress value={trend.confidenceLevel} className="flex-1 h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Trend Data Available</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    As you add more lab results and health records, we'll analyze trends to help you understand your health patterns.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Content Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4 mt-4">
            {contentRecsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="h-32 bg-muted animate-pulse rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (contentRecsData?.recommendations?.length || 0) > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Personalized For You</h3>
                    <p className="text-sm text-muted-foreground">
                      Content matched to your health profile and goals
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {contentRecsData?.totalRecommendations} recommendations
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {contentRecsData?.recommendations.map((rec) => (
                    <Card 
                      key={rec.id} 
                      className="hover-elevate cursor-pointer"
                      data-testid={`content-rec-${rec.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {rec.content.category.replace(/_/g, " ")}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {rec.content.contentType}
                              </Badge>
                              {rec.content.isVerified && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              )}
                            </div>
                            <CardTitle className="text-base line-clamp-2">
                              {rec.content.title}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Bookmark className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {rec.content.summary}
                        </p>
                        
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">
                              {rec.aiExplanation}
                            </p>
                          </div>
                        </div>

                        {(rec.matchedConditions.length > 0 || rec.matchedGoals.length > 0) && (
                          <div className="flex flex-wrap gap-1">
                            {rec.matchedConditions.slice(0, 2).map((c, i) => (
                              <Badge key={`c-${i}`} variant="secondary" className="text-xs">
                                {c}
                              </Badge>
                            ))}
                            {rec.matchedGoals.slice(0, 2).map((g, i) => (
                              <Badge key={`g-${i}`} variant="outline" className="text-xs">
                                {g}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {rec.content.readTimeMinutes} min read
                            </span>
                            <span>{rec.content.sourceName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {rec.content.likeCount}
                            </span>
                            <span>Match: {rec.relevanceScore}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Recommendations Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your health conditions, medications, and goals to get personalized content recommendations.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 mt-4">
            {riskAssessments.length > 0 ? (
              <div className="space-y-3">
                {riskAssessments.map((assessment) => {
                  const Icon = categoryIcons[assessment.category];
                  return (
                    <Card key={assessment.id} data-testid={`risk-card-${assessment.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${riskLevelColors[assessment.riskLevel]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{assessment.title}</CardTitle>
                              <CardDescription className="capitalize">
                                {assessment.category.replace(/_/g, " ")}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className={riskLevelColors[assessment.riskLevel]}>
                            {assessment.riskLevel}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{assessment.description}</p>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Risk Score:</span>
                          <Progress value={assessment.riskScore} className="flex-1 h-2" />
                          <span className="font-medium">{assessment.riskScore}%</span>
                        </div>

                        {assessment.recommendations.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Recommendations:</p>
                            <ul className="space-y-1">
                              {assessment.recommendations.slice(0, 3).map((rec, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Risk Assessments</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Analyze Risks" to get AI-powered health risk assessments based on your health data.
                  </p>
                  <Button 
                    onClick={() => generateRisksMutation.mutate()}
                    disabled={generateRisksMutation.isPending}
                    data-testid="button-generate-first-risks"
                  >
                    Analyze Risks
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="coaching" className="space-y-4 mt-4">
            {coachingSessions.length > 0 ? (
              <div className="space-y-3">
                {coachingSessions.filter(s => s.isActive).map((session) => (
                  <Card key={session.id} data-testid={`coaching-card-${session.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-500/10">
                            <Target className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{session.title}</CardTitle>
                            <CardDescription className="capitalize">
                              {session.goalType.replace(/_/g, " ")}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{session.currentGoal}</p>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Progress:</span>
                        <Progress value={session.progress} className="flex-1 h-2" />
                        <span className="font-medium">{session.progress}%</span>
                      </div>

                      {session.aiRecommendations.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">AI Recommendations:</p>
                          <ul className="space-y-1">
                            {session.aiRecommendations.slice(0, 3).map((rec, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Active Coaching Sessions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start a new coaching session to get personalized guidance for your health goals.
                  </p>
                  <Button data-testid="button-start-coaching">
                    Start Coaching
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
