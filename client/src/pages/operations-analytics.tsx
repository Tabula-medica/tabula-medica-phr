import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  Users, 
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  Lightbulb,
  PieChart,
  LineChart,
  Brain
} from "lucide-react";

interface StaffingRecommendation {
  role: string;
  requiredCount: number;
  currentScheduled: number;
  variance: number;
  urgency: string;
}

interface StaffingPrediction {
  id: string;
  date: string;
  dayOfWeek: string;
  predictedAppointments: number;
  predictedWalkIns: number;
  totalPatientVolume: number;
  staffingRecommendations: StaffingRecommendation[];
  peakHours: { hour: string; volume: number }[];
  confidence: number;
  aiInsights: string;
}

interface CostCategory {
  id: string;
  name: string;
  category: string;
  currentMonthSpend: number;
  previousMonthSpend: number;
  budgetedAmount: number;
  variance: number;
  variancePercentage: number;
  trend: string;
  subcategories: { name: string; spend: number; percentage: number }[];
}

interface EfficiencyOpportunity {
  id: string;
  title: string;
  category: string;
  potentialSavings: number;
  implementationEffort: string;
  timeToRealize: string;
  description: string;
  recommendedActions: string[];
  riskLevel: string;
  priority: number;
}

interface CostAnalysis {
  id: string;
  period: string;
  totalOperatingCost: number;
  costPerPatientVisit: number;
  laborCostRatio: number;
  supplyUtilizationRate: number;
  categories: CostCategory[];
  efficiencyOpportunities: EfficiencyOpportunity[];
  benchmarkComparison: { metric: string; ourValue: number; industryAverage: number; percentile: number }[];
  aiAnalysis: string;
}

interface ResourceForecast {
  id: string;
  resourceType: string;
  resourceName: string;
  currentStock: number;
  averageDailyUsage: number;
  daysUntilDepletion: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
  leadTimeDays: number;
  estimatedCost: number;
  urgency: string;
  demandTrend: string;
  forecastedDemand: { month: string; quantity: number }[];
}

interface ResourceForecastSummary {
  id: string;
  generatedAt: string;
  forecastPeriod: string;
  totalResources: number;
  criticalItems: number;
  upcomingOrders: number;
  estimatedSpend: number;
  resources: ResourceForecast[];
  aiRecommendations: string;
  demandPatterns: { pattern: string; affectedResources: string[]; recommendation: string }[];
}

interface AnalyticsSummary {
  staffingAlerts: number;
  costVarianceAlerts: number;
  resourceAlerts: number;
  efficiencyScore: number;
  predictedPatientVolume7Days: number;
  projectedCostSavings: number;
  upcomingResourceOrders: number;
}

export default function OperationsAnalytics() {
  const { toast } = useToast();

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: AnalyticsSummary }>({
    queryKey: ["/api/operations-analytics/summary"]
  });

  const { data: staffingData, isLoading: staffingLoading } = useQuery<{ success: boolean; data: StaffingPrediction[] }>({
    queryKey: ["/api/operations-analytics/staffing/predictions"]
  });

  const { data: costData, isLoading: costLoading } = useQuery<{ success: boolean; data: CostAnalysis }>({
    queryKey: ["/api/operations-analytics/costs"]
  });

  const { data: resourceData, isLoading: resourceLoading } = useQuery<{ success: boolean; data: ResourceForecastSummary }>({
    queryKey: ["/api/operations-analytics/resources/forecast"]
  });

  const analyzeCostsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/operations-analytics/costs/analyze");
    },
    onSuccess: () => {
      toast({ title: "Cost analysis complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-analytics"] });
    },
    onError: () => {
      toast({ title: "Failed to analyze costs", variant: "destructive" });
    }
  });

  const summary = summaryData?.data;
  const staffing = staffingData?.data || [];
  const costs = costData?.data;
  const resources = resourceData?.data;

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "warning": return <Badge variant="secondary" className="border-orange-500 text-orange-600 dark:text-orange-400">Warning</Badge>;
      case "soon": return <Badge variant="secondary" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">Soon</Badge>;
      case "planned": return <Badge variant="secondary">Planned</Badge>;
      case "optimal": return <Badge variant="default">Optimal</Badge>;
      default: return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing": return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "decreasing": return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "stable": return <Minus className="h-4 w-4 text-gray-500" />;
      case "seasonal": return <Activity className="h-4 w-4 text-blue-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case "low": return <Badge variant="default">Low Effort</Badge>;
      case "medium": return <Badge variant="secondary">Medium Effort</Badge>;
      case "high": return <Badge variant="destructive">High Effort</Badge>;
      default: return <Badge variant="outline">{effort}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Operations Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered staffing predictions, cost analysis, and resource forecasting
        </p>
      </div>

      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>AI Analytics Disclaimer:</strong> Predictions and analyses are generated by AI for informational and operational planning purposes only. They do not constitute clinical decision support, medical advice, or financial advice. All decisions should be validated by qualified professionals.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="staffing" data-testid="tab-staffing">Staffing</TabsTrigger>
          <TabsTrigger value="costs" data-testid="tab-costs">Costs</TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : summary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="card-efficiency-score">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Efficiency Score</p>
                        <p className="text-3xl font-bold text-green-600">{summary.efficiencyScore}%</p>
                      </div>
                      <Target className="h-10 w-10 text-green-500" />
                    </div>
                    <Progress value={summary.efficiencyScore} className="mt-3" />
                  </CardContent>
                </Card>
                <Card data-testid="card-patient-volume">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">7-Day Patient Volume</p>
                        <p className="text-3xl font-bold">{summary.predictedPatientVolume7Days}</p>
                      </div>
                      <Users className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-cost-savings">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Potential Savings</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(summary.projectedCostSavings)}</p>
                      </div>
                      <DollarSign className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-resource-orders">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Upcoming Orders</p>
                        <p className="text-3xl font-bold">{summary.upcomingResourceOrders}</p>
                      </div>
                      <Package className="h-10 w-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Staffing Alerts</p>
                        <p className="text-3xl font-bold text-orange-600">{summary.staffingAlerts}</p>
                      </div>
                      <AlertTriangle className="h-10 w-10 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Cost Variance Alerts</p>
                        <p className="text-3xl font-bold text-yellow-600">{summary.costVarianceAlerts}</p>
                      </div>
                      <DollarSign className="h-10 w-10 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Resource Alerts</p>
                        <p className="text-3xl font-bold text-red-600">{summary.resourceAlerts}</p>
                      </div>
                      <Package className="h-10 w-10 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    AI-Powered Analytics Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">Staffing Predictions</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI analyzes historical appointment data and patient inflow trends to predict optimal staffing levels.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <PieChart className="h-5 w-5 text-green-500" />
                        <h4 className="font-medium">Cost Analysis</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI identifies efficiency opportunities and benchmarks operational costs against industry standards.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <LineChart className="h-5 w-5 text-purple-500" />
                        <h4 className="font-medium">Resource Forecasting</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI forecasts equipment, supplies, and medication needs based on service demand patterns.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="staffing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                7-Day Staffing Predictions
              </CardTitle>
              <CardDescription>AI-predicted patient volume and staffing recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {staffingLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {staffing.map((prediction) => (
                      <div key={prediction.id} className="p-6 rounded-lg border bg-card" data-testid={`card-prediction-${prediction.id}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-5 w-5 text-muted-foreground" />
                              <h4 className="font-medium text-lg">{prediction.dayOfWeek}, {new Date(prediction.date).toLocaleDateString()}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Confidence: {(prediction.confidence * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold">{prediction.totalPatientVolume}</p>
                            <p className="text-sm text-muted-foreground">Total Patients</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <p className="text-2xl font-bold">{prediction.predictedAppointments}</p>
                            <p className="text-xs text-muted-foreground">Appointments</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <p className="text-2xl font-bold">{prediction.predictedWalkIns}</p>
                            <p className="text-xs text-muted-foreground">Walk-ins</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <p className="text-2xl font-bold">{prediction.peakHours.reduce((max, h) => Math.max(max, h.volume), 0)}</p>
                            <p className="text-xs text-muted-foreground">Peak Hour Volume</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium mb-2">Staffing Recommendations</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {prediction.staffingRecommendations.map((rec, i) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/30 text-center">
                                <p className="text-sm font-medium">{rec.role}</p>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <span className="text-lg font-bold">{rec.currentScheduled}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-sm">{rec.requiredCount}</span>
                                </div>
                                {getUrgencyBadge(rec.urgency)}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                            <p className="text-sm text-blue-700 dark:text-blue-300">{prediction.aiInsights}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          {costLoading ? (
            <Skeleton className="h-96" />
          ) : costs && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Operating Cost</p>
                    <p className="text-2xl font-bold">{formatCurrency(costs.totalOperatingCost)}</p>
                    <p className="text-xs text-muted-foreground">{costs.period}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Cost per Patient Visit</p>
                    <p className="text-2xl font-bold">{formatCurrency(costs.costPerPatientVisit)}</p>
                    <Badge variant="default" className="mt-1">8% below avg</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Labor Cost Ratio</p>
                    <p className="text-2xl font-bold">{(costs.laborCostRatio * 100).toFixed(1)}%</p>
                    <Progress value={costs.laborCostRatio * 100} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Supply Utilization</p>
                    <p className="text-2xl font-bold">{(costs.supplyUtilizationRate * 100).toFixed(1)}%</p>
                    <Progress value={costs.supplyUtilizationRate * 100} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary" />
                      Cost Breakdown by Category
                    </CardTitle>
                    <CardDescription>Monthly operating costs with budget variance</CardDescription>
                  </div>
                  <Button 
                    onClick={() => analyzeCostsMutation.mutate()}
                    disabled={analyzeCostsMutation.isPending}
                    data-testid="button-analyze-costs"
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    AI Analyze
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {costs.categories.map((category) => (
                      <div key={category.id} className="p-4 rounded-lg border bg-card" data-testid={`card-cost-${category.id}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{category.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              {getTrendIcon(category.trend)}
                              <span className="text-sm text-muted-foreground capitalize">{category.trend}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">{formatCurrency(category.currentMonthSpend)}</p>
                            <div className="flex items-center gap-1 justify-end">
                              {category.variancePercentage > 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                              ) : category.variancePercentage < 0 ? (
                                <ArrowDownRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <Minus className="h-4 w-4 text-gray-500" />
                              )}
                              <span className={`text-sm ${category.variancePercentage > 0 ? 'text-red-500' : category.variancePercentage < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                {category.variancePercentage > 0 ? '+' : ''}{category.variancePercentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {category.subcategories.map((sub, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {sub.name}: {formatCurrency(sub.spend)} ({sub.percentage.toFixed(1)}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    Efficiency Opportunities
                  </CardTitle>
                  <CardDescription>AI-identified areas for cost savings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {costs.efficiencyOpportunities.map((opportunity) => (
                      <div key={opportunity.id} className="p-4 rounded-lg border bg-card" data-testid={`card-opportunity-${opportunity.id}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{opportunity.category}</Badge>
                              {getEffortBadge(opportunity.implementationEffort)}
                            </div>
                            <h4 className="font-medium mt-2">{opportunity.title}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-green-600">{formatCurrency(opportunity.potentialSavings)}</p>
                            <p className="text-xs text-muted-foreground">potential savings</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{opportunity.description}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{opportunity.timeToRealize}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Industry Benchmark Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {costs.benchmarkComparison.map((benchmark, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{benchmark.metric}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={benchmark.percentile} className="flex-1" />
                            <span className="text-sm text-muted-foreground w-12">{benchmark.percentile}th</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-bold">{benchmark.ourValue}{benchmark.metric.includes('%') || benchmark.metric.includes('Ratio') ? '%' : ''}</p>
                          <p className="text-xs text-muted-foreground">vs {benchmark.industryAverage} avg</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Analysis Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{costs.aiAnalysis}</p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          {resourceLoading ? (
            <Skeleton className="h-96" />
          ) : resources && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Resources</p>
                    <p className="text-3xl font-bold">{resources.totalResources}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Critical Items</p>
                    <p className="text-3xl font-bold text-red-600">{resources.criticalItems}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Upcoming Orders</p>
                    <p className="text-3xl font-bold">{resources.upcomingOrders}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Est. Spend (90 days)</p>
                    <p className="text-3xl font-bold">{formatCurrency(resources.estimatedSpend)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Resource Inventory & Forecast
                  </CardTitle>
                  <CardDescription>AI-predicted resource needs for the next 90 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {resources.resources.map((resource) => (
                        <div key={resource.id} className="p-4 rounded-lg border bg-card" data-testid={`card-resource-${resource.id}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                {getUrgencyBadge(resource.urgency)}
                                <Badge variant="outline" className="capitalize">{resource.resourceType}</Badge>
                              </div>
                              <h4 className="font-medium mt-2">{resource.resourceName}</h4>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">{resource.currentStock}</p>
                              <p className="text-xs text-muted-foreground">current stock</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4 mb-3">
                            <div className="text-center">
                              <p className="text-lg font-bold">{resource.daysUntilDepletion}</p>
                              <p className="text-xs text-muted-foreground">days left</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold">{resource.averageDailyUsage.toFixed(1)}</p>
                              <p className="text-xs text-muted-foreground">daily usage</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold">{resource.recommendedOrderQuantity}</p>
                              <p className="text-xs text-muted-foreground">order qty</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold">{formatCurrency(resource.estimatedCost)}</p>
                              <p className="text-xs text-muted-foreground">est. cost</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Demand Trend:</span>
                            {getTrendIcon(resource.demandTrend)}
                            <span className="text-sm capitalize">{resource.demandTrend}</span>
                            <span className="text-sm text-muted-foreground ml-4">Lead Time: {resource.leadTimeDays} days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Demand Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {resources.demandPatterns.map((pattern, i) => (
                      <div key={i} className="p-4 rounded-lg bg-muted/30">
                        <h4 className="font-medium">{pattern.pattern}</h4>
                        <div className="flex flex-wrap gap-1 my-2">
                          {pattern.affectedResources.map((r, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">{pattern.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{resources.aiRecommendations}</p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
