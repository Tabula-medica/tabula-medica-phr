import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Brain, Search, AlertTriangle, TrendingUp, Users, Activity, Zap,
  MessageSquare, BarChart3, LineChart, ShieldAlert, ChevronRight,
  FileSearch, Target, Lightbulb, Clock, CheckCircle2, XCircle, Send
} from "lucide-react";

interface DashboardData {
  summary: {
    totalPatients: number;
    atRiskPatients: number;
    activeAnomalies: number;
    recentQueries: number;
    activePredictions: number;
  };
  riskDistribution: Array<{ category: string; count: number; trend: string }>;
  topConditions: Array<{ condition: string; prevalence: number; trend: string }>;
  dataQualityScore: number;
}

interface NLQueryResult {
  id: string;
  originalQuery: string;
  parsedIntent: { queryType: string; entities: Array<{ type: string; value: string }> };
  fhirQuery: { resourceType: string; explanation: string };
  results: {
    totalMatches: number;
    summary: string;
    keyFindings: string[];
    data: Array<Record<string, unknown>>;
  };
  confidence: number;
  executedAt: string;
  disclaimer: string;
}

interface Anomaly {
  id: string;
  detectionType: string;
  severity: string;
  anomaly: { description: string; affectedRecords: number };
  impact: { dataQualityScore: number; clinicalRisk?: string };
  rootCauseAnalysis: { likelyCauses: string[] };
  remediation: { suggestedActions: string[] };
  status: string;
  generatedAt: string;
}

interface Forecast {
  id: string;
  forecastType: string;
  condition?: string;
  metric: string;
  timeHorizon: string;
  trendAnalysis: { direction: string; rateOfChange: number };
  scenarios: Array<{ name: string; probability: number; projection: number }>;
  generatedAt: string;
}

interface Prediction {
  id: string;
  analysisType: string;
  patientId?: string;
  prediction: { outcome: string; probability: number; confidence: number; trend: string };
  riskFactors: Array<{ factor: string; impact: string }>;
  recommendations: Array<{ action: string; priority: string }>;
  generatedAt: string;
}

function StatCard({ title, value, icon: Icon, description, trend }: {
  title: string;
  value: number | string;
  icon: any;
  description?: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <Badge variant="outline" className="text-xs">
              {trend}
            </Badge>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return <Badge className={colors[severity] || ""}>{severity}</Badge>;
}

export default function AIFHIRAnalyticsDashboard() {
  const { toast } = useToast();
  const [nlQuery, setNlQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/deep-fhir-analytics/dashboard"],
  });

  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery<{ anomalies: Anomaly[] }>({
    queryKey: ["/api/deep-fhir-analytics/anomalies"],
  });

  const { data: forecastsData } = useQuery<{ forecasts: Forecast[] }>({
    queryKey: ["/api/deep-fhir-analytics/forecasts"],
  });

  const { data: predictionsData } = useQuery<{ predictions: Prediction[] }>({
    queryKey: ["/api/deep-fhir-analytics/predictions"],
  });

  const { data: queryHistoryData } = useQuery<{ queries: NLQueryResult[] }>({
    queryKey: ["/api/deep-fhir-analytics/query-history"],
  });

  const nlQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/deep-fhir-analytics/natural-language-query", { query });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deep-fhir-analytics/query-history"] });
      toast({ title: "Query Processed", description: "Your query has been analyzed successfully." });
    },
    onError: () => {
      toast({ title: "Query Failed", description: "Unable to process query.", variant: "destructive" });
    },
  });

  const detectAnomaliesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/deep-fhir-analytics/detect-anomalies", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deep-fhir-analytics/anomalies"] });
      toast({ title: "Anomaly Detection Complete", description: `Found ${data.anomalies?.length || 0} anomalies.` });
    },
  });

  const generateForecastMutation = useMutation({
    mutationFn: async (request: { forecastType: string; condition?: string; timeHorizon?: string }) => {
      const response = await apiRequest("POST", "/api/deep-fhir-analytics/health-trend-forecast", request);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deep-fhir-analytics/forecasts"] });
      toast({ title: "Forecast Generated", description: "Health trend forecast created successfully." });
    },
  });

  const generatePredictionMutation = useMutation({
    mutationFn: async (request: { analysisType: string; patientId?: string; populationCriteria?: any }) => {
      const response = await apiRequest("POST", "/api/deep-fhir-analytics/predictive-analysis", request);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deep-fhir-analytics/predictions"] });
      toast({ title: "Prediction Generated", description: "Predictive analysis completed successfully." });
    },
  });

  const handleNLQuery = () => {
    if (nlQuery.trim()) {
      nlQueryMutation.mutate(nlQuery);
    }
  };

  const latestQueryResult = nlQueryMutation.data as NLQueryResult | undefined;

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI-Powered FHIR Analytics</h1>
          <p className="text-muted-foreground">Predictive analytics, natural language queries, and anomaly detection</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        {dashboardLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard title="Total Patients" value={dashboard?.summary.totalPatients || 0} icon={Users} />
            <StatCard title="At-Risk Patients" value={dashboard?.summary.atRiskPatients || 0} icon={ShieldAlert} trend="needs attention" />
            <StatCard title="Active Anomalies" value={dashboard?.summary.activeAnomalies || 0} icon={AlertTriangle} />
            <StatCard title="Predictions" value={dashboard?.summary.activePredictions || 0} icon={TrendingUp} />
            <StatCard title="Data Quality" value={`${dashboard?.dataQualityScore || 0}%`} icon={CheckCircle2} />
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <Activity className="h-4 w-4" />Overview
          </TabsTrigger>
          <TabsTrigger value="nl-query" className="gap-2" data-testid="tab-nl-query">
            <MessageSquare className="h-4 w-4" />Natural Language Query
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-2" data-testid="tab-predictions">
            <TrendingUp className="h-4 w-4" />Predictive Analytics
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2" data-testid="tab-anomalies">
            <AlertTriangle className="h-4 w-4" />Anomaly Detection
          </TabsTrigger>
          <TabsTrigger value="forecasts" className="gap-2" data-testid="tab-forecasts">
            <LineChart className="h-4 w-4" />Health Trend Forecasts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Risk Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard?.riskDistribution.map((risk) => (
                    <div key={risk.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${
                          risk.category === "Critical" ? "bg-red-500" :
                          risk.category === "High" ? "bg-orange-500" :
                          risk.category === "Moderate" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                        <span>{risk.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{risk.count}</span>
                        <Badge variant="outline" className="text-xs">{risk.trend}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Top Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard?.topConditions.map((cond) => (
                    <div key={cond.condition}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{cond.condition}</span>
                        <span className="text-sm font-medium">{cond.prevalence}%</span>
                      </div>
                      <Progress value={cond.prevalence} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setActiveTab("nl-query")} data-testid="button-quick-nl-query">
                    <Search className="h-5 w-5" />
                    <span>Ask a Question</span>
                    <span className="text-xs text-muted-foreground">Natural language search</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => detectAnomaliesMutation.mutate()} data-testid="button-quick-anomaly">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Detect Anomalies</span>
                    <span className="text-xs text-muted-foreground">Find data quality issues</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => generatePredictionMutation.mutate({ analysisType: "population_trend" })} data-testid="button-quick-prediction">
                    <TrendingUp className="h-5 w-5" />
                    <span>Generate Prediction</span>
                    <span className="text-xs text-muted-foreground">AI-powered insights</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nl-query">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Ask Questions About Your FHIR Data
                  </CardTitle>
                  <CardDescription>
                    Use natural language to search and analyze patient data. Try questions like "Show me all patients with uncontrolled hypertension" or "What are the common conditions among patients over 65?"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Enter your question..."
                      value={nlQuery}
                      onChange={(e) => setNlQuery(e.target.value)}
                      className="min-h-[80px]"
                      data-testid="input-nl-query"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button onClick={handleNLQuery} disabled={nlQueryMutation.isPending || !nlQuery.trim()} className="gap-2" data-testid="button-submit-query">
                      <Send className="h-4 w-4" />
                      {nlQueryMutation.isPending ? "Processing..." : "Ask Question"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs text-muted-foreground">Try:</span>
                    {["Patients with uncontrolled diabetes", "High risk patients", "Common conditions over 65"].map((q) => (
                      <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => setNlQuery(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {latestQueryResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSearch className="h-5 w-5" />
                      Query Results
                    </CardTitle>
                    <CardDescription>
                      <span className="font-medium">"{latestQueryResult.originalQuery}"</span>
                      <Badge variant="outline" className="ml-2">{Math.round(latestQueryResult.confidence * 100)}% confidence</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Summary</h4>
                        <p className="text-sm text-muted-foreground">{latestQueryResult.results.summary}</p>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Key Findings</h4>
                        <ul className="space-y-1">
                          {latestQueryResult.results.keyFindings.map((finding, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                              {finding}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Matching Records ({latestQueryResult.results.totalMatches})</h4>
                        <ScrollArea className="h-[200px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead>Gender</TableHead>
                                <TableHead>Conditions</TableHead>
                                <TableHead>Risk</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {latestQueryResult.results.data.slice(0, 10).map((row: any) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                                  <TableCell>{row.age}</TableCell>
                                  <TableCell>{row.gender}</TableCell>
                                  <TableCell className="text-xs">{(row.conditions || []).slice(0, 2).join(", ")}</TableCell>
                                  <TableCell>
                                    <Badge variant={row.riskFactorCount >= 3 ? "destructive" : "outline"}>
                                      {row.riskFactorCount} factors
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                      <div className="text-xs text-muted-foreground italic mt-4">
                        {latestQueryResult.disclaimer}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {queryHistoryData?.queries.slice(0, 10).map((q) => (
                      <div key={q.id} className="p-3 border rounded-lg hover-elevate cursor-pointer" {...clickable(() => setNlQuery(q.originalQuery))}>
                        <p className="text-sm font-medium line-clamp-2">{q.originalQuery}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{q.results.totalMatches} matches</Badge>
                          <span>{new Date(q.executedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                    {(!queryHistoryData?.queries || queryHistoryData.queries.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No recent queries</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictions">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Generate Prediction</CardTitle>
                <CardDescription>Create AI-powered predictive analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-analytics-dashbo-analysis-type">Analysis Type</Label>
                  <Select onValueChange={(v) => generatePredictionMutation.mutate({ analysisType: v })} data-testid="select-analysis-type">
                    <SelectTrigger id="ai-fhir-analytics-dashbo-analysis-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="readmission_risk">Readmission Risk</SelectItem>
                      <SelectItem value="disease_progression">Disease Progression</SelectItem>
                      <SelectItem value="population_trend">Population Trend</SelectItem>
                      <SelectItem value="chronic_condition_forecast">Chronic Condition Forecast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full gap-2" onClick={() => generatePredictionMutation.mutate({ analysisType: "individual_risk" })} disabled={generatePredictionMutation.isPending} data-testid="button-generate-prediction">
                  <TrendingUp className="h-4 w-4" />
                  {generatePredictionMutation.isPending ? "Generating..." : "Generate Analysis"}
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent Predictions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {predictionsData?.predictions.map((pred) => (
                      <Card key={pred.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge>{pred.analysisType.replace(/_/g, " ")}</Badge>
                                <Badge variant={pred.prediction.trend === "declining" ? "destructive" : pred.prediction.trend === "improving" ? "default" : "outline"}>
                                  {pred.prediction.trend}
                                </Badge>
                              </div>
                              <p className="text-sm mb-2">{pred.prediction.outcome}</p>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Probability: {Math.round(pred.prediction.probability * 100)}%</span>
                                <span>Confidence: {Math.round(pred.prediction.confidence * 100)}%</span>
                              </div>
                              <div className="mt-3">
                                <p className="text-xs font-medium mb-1">Risk Factors:</p>
                                <div className="flex flex-wrap gap-1">
                                  {pred.riskFactors.slice(0, 3).map((rf, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">{rf.factor}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {new Date(pred.generatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {(!predictionsData?.predictions || predictionsData.predictions.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No predictions yet. Generate one to get started.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="anomalies">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Anomaly Detection</CardTitle>
                <CardDescription>Scan for data quality issues and unusual patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full gap-2" onClick={() => detectAnomaliesMutation.mutate()} disabled={detectAnomaliesMutation.isPending} data-testid="button-detect-anomalies">
                  <AlertTriangle className="h-4 w-4" />
                  {detectAnomaliesMutation.isPending ? "Scanning..." : "Run Anomaly Scan"}
                </Button>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Detection Types:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Clinical patterns</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Data quality issues</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Utilization patterns</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Documentation gaps</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Detected Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                {anomaliesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {anomaliesData?.anomalies.map((anomaly) => (
                        <Card key={anomaly.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <SeverityBadge severity={anomaly.severity} />
                                  <Badge variant="outline">{anomaly.detectionType.replace(/_/g, " ")}</Badge>
                                  <Badge variant={anomaly.status === "new" ? "default" : "secondary"}>{anomaly.status}</Badge>
                                </div>
                                <p className="text-sm mb-2">{anomaly.anomaly.description}</p>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Affected: {anomaly.anomaly.affectedRecords} records
                                </p>
                                <div className="mt-2">
                                  <p className="text-xs font-medium mb-1">Likely Causes:</p>
                                  <ul className="text-xs text-muted-foreground">
                                    {anomaly.rootCauseAnalysis.likelyCauses.slice(0, 2).map((cause, i) => (
                                      <li key={i} className="flex items-center gap-1">
                                        <Lightbulb className="h-3 w-3" /> {cause}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {(!anomaliesData?.anomalies || anomaliesData.anomalies.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No anomalies detected. Run a scan to check for issues.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecasts">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Generate Forecast</CardTitle>
                <CardDescription>Predict future health trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-analytics-dashbo-forecast-type">Forecast Type</Label>
                  <Select onValueChange={(v) => generateForecastMutation.mutate({ forecastType: v })} data-testid="select-forecast-type">
                    <SelectTrigger id="ai-fhir-analytics-dashbo-forecast-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="condition_prevalence">Condition Prevalence</SelectItem>
                      <SelectItem value="hospitalization">Hospitalization Rates</SelectItem>
                      <SelectItem value="medication_usage">Medication Usage</SelectItem>
                      <SelectItem value="cost_projection">Cost Projection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-analytics-dashbo-condition-optional">Condition (Optional)</Label>
                  <Input id="ai-fhir-analytics-dashbo-condition-optional" placeholder="e.g., Diabetes, Hypertension" data-testid="input-forecast-condition" />
                </div>
                <Button className="w-full gap-2" onClick={() => generateForecastMutation.mutate({ forecastType: "condition_prevalence", condition: "Diabetes", timeHorizon: "6 months" })} disabled={generateForecastMutation.isPending} data-testid="button-generate-forecast">
                  <LineChart className="h-4 w-4" />
                  {generateForecastMutation.isPending ? "Generating..." : "Generate Forecast"}
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Health Trend Forecasts</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {forecastsData?.forecasts.map((forecast) => (
                      <Card key={forecast.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge>{forecast.forecastType.replace(/_/g, " ")}</Badge>
                                {forecast.condition && <Badge variant="outline">{forecast.condition}</Badge>}
                              </div>
                              <p className="text-sm font-medium mb-1">{forecast.metric}</p>
                              <p className="text-xs text-muted-foreground mb-2">
                                Time horizon: {forecast.timeHorizon} | Direction: {forecast.trendAnalysis.direction} | Rate: {forecast.trendAnalysis.rateOfChange}%/month
                              </p>
                              <div className="mt-3">
                                <p className="text-xs font-medium mb-1">Scenarios:</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {forecast.scenarios.map((scenario) => (
                                    <div key={scenario.name} className="text-center p-2 border rounded">
                                      <p className="text-xs font-medium">{scenario.name}</p>
                                      <p className="text-lg font-bold">{scenario.projection.toFixed(1)}</p>
                                      <p className="text-xs text-muted-foreground">{Math.round(scenario.probability * 100)}% likely</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {(!forecastsData?.forecasts || forecastsData.forecasts.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No forecasts yet. Generate one to see predictions.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
