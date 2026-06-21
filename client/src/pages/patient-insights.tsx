import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Brain,
  Calendar,
  CheckCircle2,
  FlaskConical,
  Heart,
  Lightbulb,
  Loader2,
  Minus,
  Pill,
  RefreshCcw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface VitalTrend {
  metric: string;
  currentValue: number;
  unit: string;
  trend: "improving" | "stable" | "declining" | "concerning";
  percentChange: number;
  timeframe: string;
  analysis: string;
}

interface LabTrend {
  testName: string;
  currentValue: number;
  unit: string;
  referenceRange: string;
  status: "normal" | "borderline" | "abnormal" | "critical";
  trend: "improving" | "stable" | "worsening";
  analysis: string;
}

interface SymptomPattern {
  symptom: string;
  frequency: "daily" | "weekly" | "occasional" | "rare";
  severity: "mild" | "moderate" | "severe";
  triggers: string[];
  correlations: string[];
  analysis: string;
}

interface AdherenceMetric {
  category: "medication" | "appointment" | "lifestyle" | "monitoring";
  itemName: string;
  adherenceRate: number;
  missedInstances: number;
  totalInstances: number;
  trend: "improving" | "stable" | "declining";
  barriers: string[];
}

interface NonAdherenceRisk {
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  factors: { factor: string; impact: "low" | "medium" | "high"; description: string }[];
  predictedOutcome: string;
  timeToIntervention: string;
}

interface OptimizationSuggestion {
  id: string;
  category: "medication" | "lifestyle" | "monitoring" | "appointment" | "education";
  title: string;
  description: string;
  rationale: string;
  expectedBenefit: string;
  priority: "high" | "medium" | "low";
  evidenceBasis: string;
  implementationSteps: string[];
}

interface ProactiveIntervention {
  id: string;
  type: "reminder" | "education" | "support" | "escalation" | "adjustment";
  title: string;
  description: string;
  targetBehavior: string;
  timing: string;
  deliveryMethod: "in_app" | "sms" | "email" | "phone" | "care_team";
  urgency: "immediate" | "within_24h" | "within_week" | "scheduled";
  rationale: string;
}

interface PatientInsights {
  patientId: string;
  generatedAt: string;
  vitalTrends: VitalTrend[];
  labTrends: LabTrend[];
  symptomPatterns: SymptomPattern[];
  adherenceMetrics: AdherenceMetric[];
  nonAdherenceRisk: NonAdherenceRisk;
  optimizationSuggestions: OptimizationSuggestion[];
  proactiveInterventions: ProactiveIntervention[];
  overallHealthStatus: string;
  keyFindings: string[];
  priorityActions: string[];
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining":
    case "worsening":
    case "concerning":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTrendBadgeVariant(trend: string): "default" | "secondary" | "destructive" | "outline" {
  switch (trend) {
    case "improving":
      return "default";
    case "declining":
    case "worsening":
    case "concerning":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "normal":
      return "default";
    case "borderline":
      return "secondary";
    case "abnormal":
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

function getRiskBadgeVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "low":
      return "default";
    case "moderate":
      return "secondary";
    case "high":
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

function getPriorityBadgeVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function getUrgencyBadgeVariant(urgency: string): "default" | "secondary" | "destructive" | "outline" {
  switch (urgency) {
    case "immediate":
      return "destructive";
    case "within_24h":
      return "secondary";
    default:
      return "outline";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "medication":
      return <Pill className="h-4 w-4" />;
    case "lifestyle":
      return <Activity className="h-4 w-4" />;
    case "monitoring":
      return <FlaskConical className="h-4 w-4" />;
    case "appointment":
      return <Calendar className="h-4 w-4" />;
    case "education":
      return <Lightbulb className="h-4 w-4" />;
    default:
      return <Target className="h-4 w-4" />;
  }
}

function getInterventionIcon(type: string) {
  switch (type) {
    case "reminder":
      return <Bell className="h-4 w-4" />;
    case "education":
      return <Lightbulb className="h-4 w-4" />;
    case "support":
      return <Heart className="h-4 w-4" />;
    case "escalation":
      return <AlertTriangle className="h-4 w-4" />;
    case "adjustment":
      return <RefreshCcw className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
}

export default function PatientInsightsPage() {
  const [selectedPatientId] = useState("patient-1");

  const { data: insights, isLoading, refetch, isFetching } = useQuery<PatientInsights>({
    queryKey: ["/api/patient-insights", selectedPatientId],
    queryFn: async () => {
      const res = await fetch(`/api/patient-insights/${selectedPatientId}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Analyzing patient data...</p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No insights available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ScrollArea className="h-screen">
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">AI Patient Insights</h1>
              <p className="text-muted-foreground">
                Personalized health analysis and care optimization
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              Sample Patient
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-insights"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Adherence Risk</p>
                  <p className="text-2xl font-bold capitalize" data-testid="text-risk-level">
                    {insights.nonAdherenceRisk.riskLevel}
                  </p>
                </div>
                <Badge variant={getRiskBadgeVariant(insights.nonAdherenceRisk.riskLevel)} className="text-lg px-3 py-1">
                  {insights.nonAdherenceRisk.riskScore}%
                </Badge>
              </div>
              <Progress
                value={insights.nonAdherenceRisk.riskScore}
                className="mt-3 h-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Key Findings</p>
                  <p className="text-2xl font-bold" data-testid="text-findings-count">
                    {insights.keyFindings.length}
                  </p>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FlaskConical className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Health observations identified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Optimizations</p>
                  <p className="text-2xl font-bold" data-testid="text-optimizations-count">
                    {insights.optimizationSuggestions.length}
                  </p>
                </div>
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Target className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Care plan improvements available
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Overall Health Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground" data-testid="text-health-status">
              {insights.overallHealthStatus}
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="vitals" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
            <TabsTrigger value="labs" data-testid="tab-labs">Labs</TabsTrigger>
            <TabsTrigger value="adherence" data-testid="tab-adherence">Adherence</TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">Risk</TabsTrigger>
            <TabsTrigger value="optimizations" data-testid="tab-optimizations">Optimizations</TabsTrigger>
            <TabsTrigger value="interventions" data-testid="tab-interventions">Interventions</TabsTrigger>
          </TabsList>

          <TabsContent value="vitals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Vital Sign Trends
                </CardTitle>
                <CardDescription>
                  Analysis of vital sign patterns and changes over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {insights.vitalTrends.map((vital, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg"
                      data-testid={`card-vital-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-primary" />
                          <span className="font-medium">{vital.metric}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getTrendBadgeVariant(vital.trend)} className="gap-1">
                            {getTrendIcon(vital.trend)}
                            {vital.trend}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            {vital.percentChange > 0 ? (
                              <ArrowUp className="h-3 w-3 text-red-500" />
                            ) : vital.percentChange < 0 ? (
                              <ArrowDown className="h-3 w-3 text-green-500" />
                            ) : null}
                            {Math.abs(vital.percentChange)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold">{vital.currentValue}</span>
                        <span className="text-muted-foreground">{vital.unit}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {vital.timeframe}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{vital.analysis}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Laboratory Result Trends
                </CardTitle>
                <CardDescription>
                  Analysis of lab values and their clinical significance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {insights.labTrends.map((lab, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg"
                      data-testid={`card-lab-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{lab.testName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(lab.status)}>
                            {lab.status}
                          </Badge>
                          <Badge variant={getTrendBadgeVariant(lab.trend)} className="gap-1">
                            {getTrendIcon(lab.trend)}
                            {lab.trend}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold">{lab.currentValue}</span>
                        <span className="text-muted-foreground">{lab.unit}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Range: {lab.referenceRange}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{lab.analysis}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adherence" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Adherence Metrics
                </CardTitle>
                <CardDescription>
                  Tracking of medication, appointment, and lifestyle adherence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {insights.adherenceMetrics.map((metric, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg"
                      data-testid={`card-adherence-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(metric.category)}
                          <span className="font-medium">{metric.itemName}</span>
                          <Badge variant="outline" className="text-xs">
                            {metric.category}
                          </Badge>
                        </div>
                        <Badge variant={getTrendBadgeVariant(metric.trend)} className="gap-1">
                          {getTrendIcon(metric.trend)}
                          {metric.trend}
                        </Badge>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">
                            {metric.totalInstances - metric.missedInstances} of {metric.totalInstances} completed
                          </span>
                          <span className="text-lg font-bold">{metric.adherenceRate}%</span>
                        </div>
                        <Progress value={metric.adherenceRate} className="h-2" />
                      </div>
                      {metric.barriers.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Barriers identified:</p>
                          <div className="flex flex-wrap gap-1">
                            {metric.barriers.map((barrier, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {barrier}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Non-Adherence Risk Assessment
                </CardTitle>
                <CardDescription>
                  Predictive analysis of adherence risks and contributing factors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Risk Level</p>
                      <p className="text-3xl font-bold capitalize" data-testid="text-overall-risk">
                        {insights.nonAdherenceRisk.riskLevel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Risk Score</p>
                      <p className="text-3xl font-bold">{insights.nonAdherenceRisk.riskScore}%</p>
                    </div>
                  </div>
                  <Progress value={insights.nonAdherenceRisk.riskScore} className="h-3 mb-4" />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Predicted Outcome</p>
                      <p>{insights.nonAdherenceRisk.predictedOutcome}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Time to Intervention</p>
                      <p className="font-medium">{insights.nonAdherenceRisk.timeToIntervention}</p>
                    </div>
                  </div>
                </div>

                <h4 className="font-medium mb-3">Risk Factors</h4>
                <div className="space-y-3">
                  {insights.nonAdherenceRisk.factors.map((factor, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg"
                      data-testid={`card-risk-factor-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{factor.factor}</span>
                        <Badge variant={
                          factor.impact === "high" ? "destructive" :
                          factor.impact === "medium" ? "secondary" : "outline"
                        }>
                          {factor.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{factor.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimizations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Care Plan Optimization Suggestions
                </CardTitle>
                <CardDescription>
                  AI-generated suggestions to improve care outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {insights.optimizationSuggestions.map((opt, index) => (
                    <AccordionItem
                      key={opt.id}
                      value={opt.id}
                      data-testid={`accordion-optimization-${index}`}
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          {getCategoryIcon(opt.category)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{opt.title}</span>
                              <Badge variant={getPriorityBadgeVariant(opt.priority)}>
                                {opt.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{opt.category}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div>
                            <p className="text-sm font-medium mb-1">Description</p>
                            <p className="text-sm text-muted-foreground">{opt.description}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">Rationale</p>
                            <p className="text-sm text-muted-foreground">{opt.rationale}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">Expected Benefit</p>
                            <p className="text-sm text-muted-foreground">{opt.expectedBenefit}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">Evidence Basis</p>
                            <Badge variant="outline">{opt.evidenceBasis}</Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">Implementation Steps</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {opt.implementationSteps.map((step, i) => (
                                <li key={i} className="text-sm text-muted-foreground">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Priority Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.priorityActions.map((action, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm"
                      data-testid={`text-priority-action-${index}`}
                    >
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interventions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Proactive Interventions
                </CardTitle>
                <CardDescription>
                  Timely interventions to improve adherence and outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {insights.proactiveInterventions.map((intervention, index) => (
                    <div
                      key={intervention.id}
                      className="p-4 border rounded-lg"
                      data-testid={`card-intervention-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getInterventionIcon(intervention.type)}
                          <span className="font-medium">{intervention.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{intervention.type}</Badge>
                          <Badge variant={getUrgencyBadgeVariant(intervention.urgency)}>
                            {intervention.urgency.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {intervention.description}
                      </p>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Target Behavior</p>
                          <p>{intervention.targetBehavior}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Delivery Method</p>
                          <Badge variant="outline">
                            {intervention.deliveryMethod.replace("_", " ")}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Timing</p>
                          <p>{intervention.timing}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rationale</p>
                          <p className="text-xs">{intervention.rationale}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Key Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.keyFindings.map((finding, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm"
                  data-testid={`text-key-finding-${index}`}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Generated at: {new Date(insights.generatedAt).toLocaleString()} | 
          All insights are descriptive observations and do not constitute medical advice.
          Always consult healthcare providers for medical decisions.
        </p>
      </div>
    </ScrollArea>
  );
}
