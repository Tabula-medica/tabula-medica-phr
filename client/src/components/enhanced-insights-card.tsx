import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, Heart, Target, Lightbulb, Activity, Shield, Loader2 } from "lucide-react";

interface GoalProgressItem {
  goal: {
    id: string;
    title: string;
    goalType: string;
    targetValue: string;
    targetUnit: string;
    currentValue?: string;
  };
  progressPercentage: number;
  trend: "improving" | "declining" | "stable";
  recommendation: string;
}

interface VitalTrend {
  latest: number;
  average: number;
  trend: string;
  status: string;
}

interface RiskAssessment {
  condition: string;
  riskLevel: string;
  factors: string[];
  recommendations: string[];
}

interface InsightsData {
  success: boolean;
  insights: {
    goalProgress: GoalProgressItem[];
    vitalTrends: Record<string, VitalTrend>;
    pendingAlerts: number;
    wellnessTips: string[];
    riskAssessments: RiskAssessment[];
    lastUpdated: string;
  };
  noCdsDisclaimer: string;
}

const vitalTypeLabels: Record<string, string> = {
  blood_pressure_systolic: "BP Systolic",
  blood_pressure_diastolic: "BP Diastolic",
  heart_rate: "Heart Rate",
  blood_glucose: "Blood Glucose",
  weight: "Weight",
  temperature: "Temperature",
  oxygen_saturation: "O2 Saturation",
  respiratory_rate: "Resp. Rate",
};

interface EnhancedInsightsCardProps {
  userId: string;
}

export function EnhancedInsightsCard({ userId }: EnhancedInsightsCardProps) {
  const { data, isLoading } = useQuery<InsightsData>({
    queryKey: ["/api/health-tracking/insights", { profileId: userId }],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Health Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const insights = data?.insights;

  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Health Insights
          </CardTitle>
          <CardDescription>Personalized health recommendations and risk assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Start tracking your health goals and vitals to receive personalized insights.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Health Insights
          </CardTitle>
          {insights.pendingAlerts > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {insights.pendingAlerts} Alert{insights.pendingAlerts > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <CardDescription>AI-powered personalized health recommendations</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview" data-testid="tab-insights-overview">Overview</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-insights-goals">Goals</TabsTrigger>
            <TabsTrigger value="vitals" data-testid="tab-insights-vitals">Vitals</TabsTrigger>
            <TabsTrigger value="risks" data-testid="tab-insights-risks">Risk Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              {insights.wellnessTips.length > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Wellness Tips
                  </h4>
                  <ul className="space-y-2">
                    {insights.wellnessTips.map((tip, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.goalProgress.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.goalProgress.slice(0, 4).map((item) => (
                    <div key={item.goal.id} className="p-3 border rounded-lg" data-testid={`insight-goal-${item.goal.id}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-medium text-sm truncate">{item.goal.title}</span>
                        {item.trend === "improving" ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : item.trend === "declining" ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <Minus className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <Progress value={item.progressPercentage} className="h-2 mb-1" />
                      <p className="text-xs text-muted-foreground">{Math.round(item.progressPercentage)}% complete</p>
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(insights.vitalTrends).length > 0 && (
                <div>
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4" />
                    Vital Signs Summary
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(insights.vitalTrends).slice(0, 4).map(([type, trend]) => (
                      <div
                        key={type}
                        className={`p-2 rounded-lg border text-center ${
                          trend.status === "critical" ? "bg-red-50 dark:bg-red-950 border-red-200" :
                          trend.status === "elevated" || trend.status === "low" ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200" :
                          "bg-green-50 dark:bg-green-950 border-green-200"
                        }`}
                        data-testid={`insight-vital-${type}`}
                      >
                        <p className="text-xs text-muted-foreground">{vitalTypeLabels[type] || type}</p>
                        <p className="font-semibold">{trend.latest}</p>
                        <Badge variant={trend.status === "normal" ? "secondary" : trend.status === "critical" ? "destructive" : "outline"} className="text-xs">
                          {trend.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <ScrollArea className="h-64">
              {insights.goalProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active goals to show insights for.</p>
                  <p className="text-sm">Create health goals to see personalized recommendations.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {insights.goalProgress.map((item) => (
                    <div key={item.goal.id} className="p-4 border rounded-lg" data-testid={`goal-insight-${item.goal.id}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-medium">{item.goal.title}</h4>
                        <Badge variant={item.trend === "improving" ? "default" : item.trend === "declining" ? "destructive" : "secondary"}>
                          {item.trend === "improving" && <TrendingUp className="h-3 w-3 mr-1" />}
                          {item.trend === "declining" && <TrendingDown className="h-3 w-3 mr-1" />}
                          {item.trend}
                        </Badge>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{item.goal.currentValue || "-"} / {item.goal.targetValue} {item.goal.targetUnit}</span>
                        </div>
                        <Progress value={item.progressPercentage} className="h-2" />
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {item.recommendation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="vitals">
            <ScrollArea className="h-64">
              {Object.keys(insights.vitalTrends).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No vital signs recorded yet.</p>
                  <p className="text-sm">Start tracking your vitals to see trends and insights.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(insights.vitalTrends).map(([type, trend]) => (
                    <div key={type} className="p-3 border rounded-lg" data-testid={`vital-insight-${type}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-medium">{vitalTypeLabels[type] || type}</span>
                        <Badge variant={trend.status === "normal" ? "secondary" : trend.status === "critical" ? "destructive" : "outline"}>
                          {trend.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Latest</p>
                          <p className="font-semibold">{trend.latest}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="font-semibold">{trend.average.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Trend</p>
                          <p className="font-semibold flex items-center justify-center gap-1">
                            {trend.trend === "increasing" ? (
                              <><TrendingUp className="h-3 w-3 text-blue-500" /> Up</>
                            ) : trend.trend === "decreasing" ? (
                              <><TrendingDown className="h-3 w-3 text-blue-500" /> Down</>
                            ) : (
                              <><Minus className="h-3 w-3 text-gray-400" /> Stable</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="risks">
            <ScrollArea className="h-64">
              {insights.riskAssessments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p className="text-green-600 font-medium">No elevated health risks detected</p>
                  <p className="text-sm">Continue monitoring your vitals regularly.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {insights.riskAssessments.map((risk, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${
                        risk.riskLevel === "High" ? "bg-red-50 dark:bg-red-950 border-red-200" :
                        "bg-yellow-50 dark:bg-yellow-950 border-yellow-200"
                      }`}
                      data-testid={`risk-assessment-${i}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${risk.riskLevel === "High" ? "text-red-600" : "text-yellow-600"}`} />
                          {risk.condition}
                        </h4>
                        <Badge variant={risk.riskLevel === "High" ? "destructive" : "outline"}>
                          {risk.riskLevel} Risk
                        </Badge>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Risk Factors:</p>
                        <ul className="text-sm">
                          {risk.factors.map((factor, j) => (
                            <li key={j} className="flex items-center gap-1">
                              <span className="text-muted-foreground">•</span> {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Recommendations:</p>
                        <ul className="text-sm">
                          {risk.recommendations.map((rec, j) => (
                            <li key={j} className="flex items-center gap-1">
                              <span className="text-primary">•</span> {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {data?.noCdsDisclaimer && (
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {data.noCdsDisclaimer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
