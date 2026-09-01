import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Users,
  BarChart3,
  Lightbulb,
  AlertTriangle,
  Target,
  GitCompare,
  Loader2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Activity,
  Heart,
  Shield,
  Layers,
  Sparkles,
  ArrowRightLeft,
  PieChart,
  Trash2,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface CohortSummary {
  cohortId: string;
  cohortName: string;
  patientCount: number;
  avgAge: number;
  genderDistribution: { male: number; female: number; other: number };
  topConditions: string[];
  topMedications: string[];
}

interface ComparisonMetric {
  metricName: string;
  metricType: string;
  values: { cohortId: string; cohortName: string; value: number; confidence: number }[];
  overallMean: number;
  overallStdDev: number;
  pValue: number;
  effectSize: number;
  significance: string;
  clinicalRelevance: string;
}

interface CohortOverlap {
  cohort1Id: string;
  cohort1Name: string;
  cohort2Id: string;
  cohort2Name: string;
  overlapCount: number;
  overlapPercentage1: number;
  overlapPercentage2: number;
  jaccardIndex: number;
  sharedCharacteristics: string[];
}

interface DifferentialRiskFactor {
  riskFactor: string;
  category: string;
  cohortRiskScores: { cohortId: string; cohortName: string; prevalence: number; riskContribution: number }[];
  maxDifference: number;
  statisticalSignificance: number;
  interpretation: string;
}

interface AIHypothesis {
  id: string;
  hypothesis: string;
  supportingEvidence: string[];
  confidenceScore: number;
  suggestedResearchDesign: string;
  potentialConfounders: string[];
  dataRequirements: string[];
}

interface BenchmarkComparison {
  benchmarkName: string;
  benchmarkSource: string;
  cohortScores: { cohortId: string; cohortName: string; score: number; percentile: number }[];
  benchmarkMean: number;
  benchmarkStdDev: number;
  interpretation: string;
}

interface MultiCohortComparison {
  id: string;
  cohortIds: string[];
  cohortSummaries: CohortSummary[];
  metrics: ComparisonMetric[];
  overlaps: CohortOverlap[];
  differentialRiskFactors: DifferentialRiskFactor[];
  aiHypotheses: AIHypothesis[];
  benchmarkComparisons: BenchmarkComparison[];
  visualizationData: {
    radarChartData: { metric: string; values: Record<string, number> }[];
    heatmapData: { row: string; col: string; value: number; significance: string }[];
    distributionData: { cohortId: string; metric: string; distribution: number[] }[];
  };
  methodology: string;
  limitations: string[];
  generatedAt: string;
}

interface Cohort {
  id: string;
  name: string;
  description: string;
  patientCount: number;
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function CohortComparison() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [activeComparison, setActiveComparison] = useState<MultiCohortComparison | null>(null);

  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery<Cohort[]>({
    queryKey: ["/api/cohort-builder/cohorts"],
  });

  const { data: comparisons = [] } = useQuery<MultiCohortComparison[]>({
    queryKey: ["/api/cohort-comparison/comparisons"],
  });

  const compareMutation = useMutation({
    mutationFn: async (cohortIds: string[]) => {
      const response = await apiRequest("POST", "/api/cohort-comparison/compare", { cohortIds });
      return response.json();
    },
    onSuccess: (data: MultiCohortComparison) => {
      setActiveComparison(data);
      setSelectedCohortIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/cohort-comparison/comparisons"] });
      toast({ title: "Comparison Complete", description: `Compared ${data.cohortSummaries.length} cohorts with ${data.aiHypotheses.length} AI-generated hypotheses` });
    },
    onError: (error: any) => {
      toast({ title: "Comparison Failed", description: error.message || "Could not compare cohorts", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cohort-comparison/comparisons/${id}`);
      return response.json();
    },
    onSuccess: () => {
      setActiveComparison(null);
      queryClient.invalidateQueries({ queryKey: ["/api/cohort-comparison/comparisons"] });
      toast({ title: "Comparison Deleted" });
    },
  });

  function toggleCohortSelection(cohortId: string) {
    setSelectedCohortIds(prev =>
      prev.includes(cohortId)
        ? prev.filter(id => id !== cohortId)
        : [...prev, cohortId]
    );
  }

  function handleCompare() {
    if (selectedCohortIds.length < 2) {
      toast({ title: "Select at least 2 cohorts", variant: "destructive" });
      return;
    }
    compareMutation.mutate(selectedCohortIds);
  }

  function getSignificanceBadge(significance: string) {
    switch (significance) {
      case "highly_significant":
        return <Badge className="bg-green-500">Highly Significant</Badge>;
      case "significant":
        return <Badge className="bg-blue-500">Significant</Badge>;
      case "marginal":
        return <Badge variant="secondary">Marginal</Badge>;
      default:
        return <Badge variant="outline">Not Significant</Badge>;
    }
  }

  function getClinicalRelevanceBadge(relevance: string) {
    switch (relevance) {
      case "high":
        return <Badge className="bg-purple-500">High Relevance</Badge>;
      case "moderate":
        return <Badge className="bg-indigo-500">Moderate</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">Minimal</Badge>;
    }
  }

  function formatRadarData(data: { metric: string; values: Record<string, number> }[]) {
    return data.map(item => ({
      metric: item.metric.length > 12 ? item.metric.substring(0, 12) + "..." : item.metric,
      ...item.values,
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GitCompare className="w-8 h-8 text-primary" />
              AI Cohort Comparison
            </h1>
            <p className="text-muted-foreground mt-1">
              Compare multiple patient cohorts with AI-driven insights, hypothesis generation, and risk analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <Layers className="w-4 h-4 mr-1" />
              {comparisons.length} Comparisons
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Select Cohorts to Compare
                </CardTitle>
                <CardDescription>
                  Choose 2-10 cohorts for multi-cohort comparison analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : cohorts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No cohorts available</p>
                    <p className="text-sm">Create cohorts first in Cohort Builder</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {cohorts.map((cohort) => (
                        <div
                          key={cohort.id}
                          className="flex items-center gap-3 p-2 border rounded-lg hover-elevate"
                          data-testid={`cohort-select-${cohort.id}`}
                        >
                          <Checkbox
                            checked={selectedCohortIds.includes(cohort.id)}
                            onCheckedChange={() => toggleCohortSelection(cohort.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{cohort.name}</p>
                            <p className="text-xs text-muted-foreground">{cohort.patientCount} patients</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <Button
                  onClick={handleCompare}
                  disabled={compareMutation.isPending || selectedCohortIds.length < 2}
                  className="w-full mt-4"
                  data-testid="button-compare-cohorts"
                >
                  {compareMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <GitCompare className="w-4 h-4 mr-2" />
                  )}
                  Compare {selectedCohortIds.length} Cohorts
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Recent Comparisons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {comparisons.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <PieChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No comparisons yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {comparisons.map((comp) => (
                        <div
                          key={comp.id}
                          className={`p-3 border rounded-lg cursor-pointer hover-elevate ${
                            activeComparison?.id === comp.id ? "border-primary bg-primary/5" : ""
                          }`}
                          {...clickable(() => setActiveComparison(comp))}
                          data-testid={`comparison-${comp.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {comp.cohortSummaries.map(s => s.cohortName).join(" vs ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {comp.aiHypotheses.length} hypotheses
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(comp.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {!activeComparison ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <GitCompare className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">Select cohorts and compare to see results</p>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview" data-testid="tab-overview">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="hypotheses" data-testid="tab-hypotheses">
                    <Lightbulb className="w-4 h-4 mr-1" />
                    Hypotheses
                  </TabsTrigger>
                  <TabsTrigger value="risks" data-testid="tab-risks">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Risk Analysis
                  </TabsTrigger>
                  <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">
                    <Target className="w-4 h-4 mr-1" />
                    Benchmarks
                  </TabsTrigger>
                  <TabsTrigger value="visualization" data-testid="tab-visualization">
                    <PieChart className="w-4 h-4 mr-1" />
                    Visualize
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeComparison.cohortSummaries.map((summary, i) => (
                      <Card key={summary.cohortId}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            {summary.cohortName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Patients</span>
                            <span className="font-medium">{summary.patientCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Avg Age</span>
                            <span className="font-medium">{summary.avgAge}</span>
                          </div>
                          <div className="flex gap-1 flex-wrap mt-2">
                            {summary.topConditions.slice(0, 2).map((c, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Significant Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                          {activeComparison.metrics.map((metric, i) => (
                            <div key={i} className="p-3 border rounded-lg" data-testid={`metric-${i}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{metric.metricName}</span>
                                <div className="flex gap-2">
                                  {getSignificanceBadge(metric.significance)}
                                  {getClinicalRelevanceBadge(metric.clinicalRelevance)}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm">
                                {metric.values.map((v, j) => (
                                  <div key={j} className="flex items-center gap-1">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: CHART_COLORS[j % CHART_COLORS.length] }}
                                    />
                                    <span className="text-muted-foreground">{v.cohortName}:</span>
                                    <span className="font-medium">{v.value}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>p-value: {metric.pValue}</span>
                                <span>Effect size: {metric.effectSize}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {activeComparison.overlaps.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ArrowRightLeft className="w-5 h-5" />
                          Cohort Overlaps
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {activeComparison.overlaps.map((overlap, i) => (
                            <div key={i} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {overlap.cohort1Name} vs {overlap.cohort2Name}
                                </span>
                                <Badge variant="secondary">
                                  {overlap.overlapCount} shared ({(overlap.jaccardIndex * 100).toFixed(1)}% similarity)
                                </Badge>
                              </div>
                              {overlap.sharedCharacteristics.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {overlap.sharedCharacteristics.map((c, j) => (
                                    <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="hypotheses" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        AI-Generated Research Hypotheses
                      </CardTitle>
                      <CardDescription>
                        Observational hypotheses based on cohort comparison data (NO clinical decision support)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {activeComparison.aiHypotheses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No hypotheses generated</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {activeComparison.aiHypotheses.map((hypothesis, i) => (
                            <Card key={hypothesis.id} data-testid={`hypothesis-${i}`}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">Hypothesis {i + 1}</CardTitle>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Confidence:</span>
                                    <Progress value={hypothesis.confidenceScore * 100} className="w-20 h-2" />
                                    <span className="text-sm font-medium">{Math.round(hypothesis.confidenceScore * 100)}%</span>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <p className="text-sm">{hypothesis.hypothesis}</p>
                                
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Evidence</p>
                                  <ul className="text-xs space-y-1">
                                    {hypothesis.supportingEvidence.map((e, j) => (
                                      <li key={j} className="flex items-start gap-1">
                                        <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500" />
                                        <span>{e}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="grid md:grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Research Design</p>
                                    <p className="text-xs">{hypothesis.suggestedResearchDesign}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Potential Confounders</p>
                                    <div className="flex flex-wrap gap-1">
                                      {hypothesis.potentialConfounders.map((c, j) => (
                                        <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="risks" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Differential Risk Factors
                      </CardTitle>
                      <CardDescription>
                        Comparative risk factor analysis across cohorts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {activeComparison.differentialRiskFactors.map((rf, i) => (
                            <div key={i} className="p-4 border rounded-lg" data-testid={`risk-factor-${i}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-primary" />
                                  <span className="font-medium">{rf.riskFactor}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="capitalize">{rf.category}</Badge>
                                  {rf.maxDifference > 0.2 && (
                                    <Badge variant="destructive">High Variance</Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 mb-3">
                                {rf.cohortRiskScores.map((score, j) => (
                                  <div key={j} className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: CHART_COLORS[j % CHART_COLORS.length] }}
                                    />
                                    <span className="text-sm text-muted-foreground w-24 truncate">{score.cohortName}</span>
                                    <Progress value={score.prevalence * 100} className="flex-1 h-2" />
                                    <span className="text-sm font-medium w-12">{(score.prevalence * 100).toFixed(1)}%</span>
                                  </div>
                                ))}
                              </div>
                              
                              <p className="text-xs text-muted-foreground">{rf.interpretation}</p>
                              <div className="flex gap-4 mt-2 text-xs">
                                <span>Max Difference: {(rf.maxDifference * 100).toFixed(1)}%</span>
                                <span>p-value: {rf.statisticalSignificance}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="benchmarks" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        External Benchmark Comparisons
                      </CardTitle>
                      <CardDescription>
                        Cohort performance against national healthcare benchmarks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {activeComparison.benchmarkComparisons.map((bm, i) => (
                          <Card key={i} data-testid={`benchmark-${i}`}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">{bm.benchmarkName}</CardTitle>
                                <Badge variant="outline" className="text-xs">{bm.benchmarkSource}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {bm.cohortScores.map((score, j) => (
                                  <div key={j} className="flex items-center gap-3">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: CHART_COLORS[j % CHART_COLORS.length] }}
                                    />
                                    <span className="text-sm w-28 truncate">{score.cohortName}</span>
                                    <Progress value={score.percentile} className="flex-1 h-2" />
                                    <div className="flex items-center gap-2 w-32">
                                      <span className="text-sm">{score.percentile}th percentile</span>
                                      {score.percentile >= 75 ? (
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                      ) : score.percentile <= 25 ? (
                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                      ) : (
                                        <Minus className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-3">{bm.interpretation}</p>
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Benchmark Mean: {bm.benchmarkMean}</span>
                                <span>Std Dev: {bm.benchmarkStdDev}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="visualization" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5" />
                        Multi-Cohort Radar Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={formatRadarData(activeComparison.visualizationData.radarChartData)}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="metric" />
                            <PolarRadiusAxis />
                            {activeComparison.cohortSummaries.map((summary, i) => (
                              <Radar
                                key={summary.cohortId}
                                name={summary.cohortName}
                                dataKey={summary.cohortName}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                fillOpacity={0.2}
                              />
                            ))}
                            <Legend />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Metric Comparison Chart
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={activeComparison.metrics.slice(0, 5).map(m => ({
                              name: m.metricName,
                              ...Object.fromEntries(m.values.map(v => [v.cohortName, v.value])),
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {activeComparison.cohortSummaries.map((summary, i) => (
                              <Bar
                                key={summary.cohortId}
                                dataKey={summary.cohortName}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Methodology & Limitations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Methodology</p>
                        <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap">{activeComparison.methodology}</pre>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Limitations</p>
                        <ul className="text-xs space-y-1">
                          {activeComparison.limitations.map((lim, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500" />
                              <span>{lim}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
