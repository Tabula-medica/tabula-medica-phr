import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bot,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info,
  Users,
  MessageSquare,
  Beaker,
  Activity,
  BookOpen,
  Clock,
  X,
  RefreshCw,
  Loader2,
  Shield,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  Route,
  Phone,
  Calendar,
  FileCheck,
  Eye,
} from "lucide-react";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface CopilotInsight {
  id: string;
  category: "documentation_gap" | "data_quality" | "education_opportunity" | "workflow_efficiency" | "pending_review";
  severity: "info" | "attention" | "needs_review";
  title: string;
  description: string;
  affected_patient_id?: string;
  affected_patient_name?: string;
  suggested_action?: string;
  education_material_id?: string;
  data_source: string;
  created_at: string;
}

interface CopilotDashboardData {
  total_patients_analyzed: number;
  insights: CopilotInsight[];
  summary: {
    documentation_gaps: number;
    data_quality_issues: number;
    education_opportunities: number;
    workflow_items: number;
    pending_reviews: number;
  };
  disclaimer: string;
}

interface RiskFactor {
  factor: string;
  contribution: number;
  dataSource: string;
  observation: string;
}

interface CarePathwayStep {
  order: number;
  type: "outreach" | "education" | "scheduling" | "documentation" | "follow_up";
  title: string;
  description: string;
  suggestedTimeframe: string;
  resources?: string[];
}

interface CarePathway {
  id: string;
  name: string;
  description: string;
  steps: CarePathwayStep[];
  estimatedDuration: string;
  priority: "routine" | "timely" | "priority";
}

interface PatientRiskAssessment {
  patientId: string;
  patientName: string;
  overallRiskScore: number;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  riskCategories: {
    category: string;
    score: number;
    level: "low" | "moderate" | "elevated" | "high";
    factors: RiskFactor[];
  }[];
  suggestedPathway: CarePathway;
  lastUpdated: string;
}

interface RiskTrend {
  category: string;
  trend: "improving" | "stable" | "worsening";
  percentChange: number;
  period: string;
}

interface PredictiveAnalyticsDashboard {
  totalPatientsAnalyzed: number;
  riskDistribution: {
    high: number;
    elevated: number;
    moderate: number;
    low: number;
  };
  topRiskPatients: PatientRiskAssessment[];
  riskTrends: RiskTrend[];
  carePathwaySummary: {
    activePathways: number;
    completedSteps: number;
    pendingSteps: number;
  };
  disclaimer: string;
}

const CATEGORY_CONFIG = {
  documentation_gap: { icon: FileText, label: "Documentation Gap", color: "text-orange-500" },
  data_quality: { icon: AlertTriangle, label: "Data Quality", color: "text-yellow-500" },
  education_opportunity: { icon: BookOpen, label: "Education", color: "text-blue-500" },
  workflow_efficiency: { icon: Clock, label: "Workflow", color: "text-purple-500" },
  pending_review: { icon: MessageSquare, label: "Pending Review", color: "text-red-500" },
};

const SEVERITY_CONFIG = {
  info: { variant: "secondary" as const, label: "Info" },
  attention: { variant: "outline" as const, label: "Attention" },
  needs_review: { variant: "default" as const, label: "Needs Review" },
};

const RISK_LEVEL_CONFIG = {
  high: { color: "bg-red-500", textColor: "text-red-600", label: "High Risk" },
  elevated: { color: "bg-orange-500", textColor: "text-orange-600", label: "Elevated" },
  moderate: { color: "bg-yellow-500", textColor: "text-yellow-600", label: "Moderate" },
  low: { color: "bg-green-500", textColor: "text-green-600", label: "Low Risk" },
};

const RISK_CATEGORY_LABELS: Record<string, string> = {
  readmission_risk: "Care Coordination",
  care_gap_risk: "Documentation Gaps",
  data_completeness_risk: "Data Quality",
  engagement_risk: "Engagement",
  follow_up_needed: "Follow-up",
};

const STEP_TYPE_CONFIG = {
  outreach: { icon: Phone, label: "Outreach", color: "text-blue-500" },
  education: { icon: BookOpen, label: "Education", color: "text-green-500" },
  scheduling: { icon: Calendar, label: "Scheduling", color: "text-purple-500" },
  documentation: { icon: FileCheck, label: "Documentation", color: "text-orange-500" },
  follow_up: { icon: Eye, label: "Follow-up", color: "text-cyan-500" },
};

function InsightCard({ insight, onDismiss }: { insight: CopilotInsight; onDismiss: (id: string) => void }) {
  const categoryConfig = CATEGORY_CONFIG[insight.category];
  const severityConfig = SEVERITY_CONFIG[insight.severity];
  const CategoryIcon = categoryConfig.icon;

  return (
    <div className="p-4 border rounded-lg space-y-3 hover-elevate" data-testid={`insight-${insight.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CategoryIcon className={`h-5 w-5 ${categoryConfig.color}`} />
          <div>
            <h4 className="font-medium text-sm">{insight.title}</h4>
            {insight.affected_patient_name && (
              <p className="text-xs text-muted-foreground">
                Patient: {insight.affected_patient_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={severityConfig.variant} className="text-xs" data-testid={`badge-severity-${insight.id}`}>
            {severityConfig.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDismiss(insight.id)}
            data-testid={`button-dismiss-${insight.id}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{insight.description}</p>

      {insight.suggested_action && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>{insight.suggested_action}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Source: {insight.data_source}</span>
        <span className="text-muted-foreground/50">|</span>
        <span>{new Date(insight.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function RiskPatientCard({ patient }: { patient: PatientRiskAssessment }) {
  const [isOpen, setIsOpen] = useState(false);
  const riskConfig = RISK_LEVEL_CONFIG[patient.riskLevel];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg hover-elevate" data-testid={`risk-patient-${patient.patientId}`}>
        <CollapsibleTrigger className="w-full p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${riskConfig.color}`} />
              <div className="text-left">
                <p className="font-medium" data-testid={`text-patient-name-${patient.patientId}`}>{patient.patientName}</p>
                <p className="text-xs text-muted-foreground">ID: {patient.patientId}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`text-lg font-bold ${riskConfig.textColor}`} data-testid={`text-risk-score-${patient.patientId}`}>
                  {patient.overallRiskScore}/100
                </p>
                <Badge variant="outline" className="text-xs">
                  {riskConfig.label}
                </Badge>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            <div className="space-y-3">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Risk Categories
              </h5>
              {patient.riskCategories.map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{RISK_CATEGORY_LABELS[cat.category] || cat.category}</span>
                    <span className={`text-sm font-medium ${RISK_LEVEL_CONFIG[cat.level].textColor}`}>
                      {cat.score}/100
                    </span>
                  </div>
                  <Progress value={cat.score} className="h-2" />
                  {cat.factors.length > 0 && (
                    <div className="pl-4 space-y-1">
                      {cat.factors.slice(0, 2).map((factor, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {factor.observation}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Route className="h-4 w-4" />
                Suggested Care Pathway
              </h5>
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{patient.suggestedPathway.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.suggestedPathway.description}</p>
                    </div>
                    <Badge variant={patient.suggestedPathway.priority === "priority" ? "default" : "secondary"}>
                      {patient.suggestedPathway.priority}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {patient.suggestedPathway.steps.slice(0, 3).map((step) => {
                      const stepConfig = STEP_TYPE_CONFIG[step.type];
                      const StepIcon = stepConfig.icon;
                      return (
                        <div key={step.order} className="flex items-start gap-2 text-xs">
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <StepIcon className={`h-3 w-3 ${stepConfig.color}`} />
                            <span className="text-muted-foreground">{step.suggestedTimeframe}</span>
                          </div>
                          <span>{step.title}</span>
                        </div>
                      );
                    })}
                    {patient.suggestedPathway.steps.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-[88px]">
                        +{patient.suggestedPathway.steps.length - 3} more steps
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground italic">
              Pattern analysis only. Not clinical advice. Clinical decisions require provider evaluation.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TrendIndicator({ trend, percentChange }: { trend: "improving" | "stable" | "worsening"; percentChange: number }) {
  if (trend === "improving") {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <TrendingDown className="h-4 w-4" />
        <span className="text-sm font-medium">{Math.abs(percentChange)}%</span>
      </div>
    );
  }
  if (trend === "worsening") {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <TrendingUp className="h-4 w-4" />
        <span className="text-sm font-medium">+{Math.abs(percentChange)}%</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Minus className="h-4 w-4" />
      <span className="text-sm font-medium">Stable</span>
    </div>
  );
}

function PredictiveAnalyticsTab() {
  const { data: analyticsResponse, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: PredictiveAnalyticsDashboard }>({
    queryKey: ["/api/health-copilot/predictive-analytics"],
  });

  const analytics = analyticsResponse?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No predictive analytics available.
      </div>
    );
  }

  const totalPatients = analytics.riskDistribution.high + analytics.riskDistribution.elevated + 
                        analytics.riskDistribution.moderate + analytics.riskDistribution.low;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" data-testid="text-predictive-title">
            <Zap className="h-5 w-5 text-primary" />
            Predictive Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Pattern-based insights for proactive care coordination
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          disabled={isRefetching}
          size="sm"
          data-testid="button-refresh-analytics"
        >
          {isRefetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="section-risk-distribution">
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-red-600" data-testid="text-high-risk-count">
                  {analytics.riskDistribution.high}
                </p>
                <p className="text-xs text-muted-foreground">High Priority</p>
              </div>
              <div className="w-2 h-8 bg-red-500 rounded" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-900">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-600" data-testid="text-elevated-count">
                  {analytics.riskDistribution.elevated}
                </p>
                <p className="text-xs text-muted-foreground">Elevated</p>
              </div>
              <div className="w-2 h-8 bg-orange-500 rounded" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-yellow-600" data-testid="text-moderate-count">
                  {analytics.riskDistribution.moderate}
                </p>
                <p className="text-xs text-muted-foreground">Moderate</p>
              </div>
              <div className="w-2 h-8 bg-yellow-500 rounded" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600" data-testid="text-low-count">
                  {analytics.riskDistribution.low}
                </p>
                <p className="text-xs text-muted-foreground">Low Priority</p>
              </div>
              <div className="w-2 h-8 bg-green-500 rounded" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Priority Patients
            </CardTitle>
            <CardDescription>
              Patients requiring coordinated outreach based on data patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {analytics.topRiskPatients.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No high-priority patients identified
                  </p>
                ) : (
                  analytics.topRiskPatients.map((patient) => (
                    <RiskPatientCard key={patient.patientId} patient={patient} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5" />
                Trends (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.riskTrends.map((trend) => (
                  <div key={trend.category} className="flex items-center justify-between">
                    <span className="text-sm">{RISK_CATEGORY_LABELS[trend.category] || trend.category}</span>
                    <TrendIndicator trend={trend.trend} percentChange={trend.percentChange} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-5 w-5" />
                Care Pathways
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Pathways</span>
                  <Badge data-testid="text-active-pathways">{analytics.carePathwaySummary.activePathways}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completed Steps</span>
                  <span className="text-sm font-medium text-green-600" data-testid="text-completed-steps">
                    {analytics.carePathwaySummary.completedSteps}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pending Steps</span>
                  <span className="text-sm font-medium text-orange-600" data-testid="text-pending-steps">
                    {analytics.carePathwaySummary.pendingSteps}
                  </span>
                </div>
                <Progress 
                  value={(analytics.carePathwaySummary.completedSteps / 
                    (analytics.carePathwaySummary.completedSteps + analytics.carePathwaySummary.pendingSteps)) * 100} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-200">NO-CDS Compliant</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    These are workflow coordination patterns, not clinical recommendations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert data-testid="alert-analytics-disclaimer">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {analytics.disclaimer}
        </AlertDescription>
      </Alert>

      <AiSummaryFeedback
        feedbackType="predictive_analytics"
        summaryId={`analytics-${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
}

export default function HealthCopilotPage() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("all");
  const [mainTab, setMainTab] = useState("insights");
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: CopilotDashboardData }>({
    queryKey: ["/api/health-copilot/sample-data"],
  });

  const dismissMutation = useMutation({
    mutationFn: async (insightId: string) => {
      const res = await fetch("/api/health-copilot/dismiss-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId }),
      });
      return res.json();
    },
    onSuccess: (_, insightId) => {
      setDismissedIds(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.add(insightId);
        return newSet;
      });
    },
  });

  const handleDismiss = (id: string) => {
    dismissMutation.mutate(id);
  };

  const data = dashboardData?.data;
  const visibleInsights = data?.insights.filter(i => !dismissedIds.has(i.id)) || [];

  const filteredInsights = activeTab === "all" 
    ? visibleInsights 
    : visibleInsights.filter(i => i.category === activeTab);

  const getCategoryCount = (category: string) => {
    return visibleInsights.filter(i => i.category === category).length;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <Bot className="h-7 w-7 text-primary" />
            AI Health Copilot
          </h1>
          <p className="text-muted-foreground">
            Data quality insights, predictive analytics, and workflow management
          </p>
        </div>
        {mainTab === "insights" && (
          <Button 
            onClick={() => refetch()} 
            disabled={isRefetching}
            data-testid="button-refresh"
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Analysis
          </Button>
        )}
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" data-testid="alert-no-cds">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">NO-CDS Compliant</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          This feature provides data quality, workflow insights, and pattern-based analytics only. It does not provide clinical recommendations, diagnoses, or treatment suggestions. All clinical decisions require provider evaluation.
        </AlertDescription>
      </Alert>

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md" data-testid="tabs-main">
          <TabsTrigger value="insights" className="flex items-center gap-2" data-testid="tab-main-insights">
            <Info className="h-4 w-4" />
            Data Insights
          </TabsTrigger>
          <TabsTrigger value="predictive" className="flex items-center gap-2" data-testid="tab-main-predictive">
            <Zap className="h-4 w-4" />
            Predictive Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="section-summary">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-patients-count">{data.total_patients_analyzed}</p>
                        <p className="text-xs text-muted-foreground">Patients Analyzed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-docs-gaps">{data.summary.documentation_gaps}</p>
                        <p className="text-xs text-muted-foreground">Doc Gaps</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-quality-issues">{data.summary.data_quality_issues}</p>
                        <p className="text-xs text-muted-foreground">Quality Issues</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-pending-reviews">{data.summary.pending_reviews}</p>
                        <p className="text-xs text-muted-foreground">Pending Reviews</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-education-opps">{data.summary.education_opportunities}</p>
                        <p className="text-xs text-muted-foreground">Education Opps</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-insights" className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Insights & Recommendations
                  </CardTitle>
                  <CardDescription>
                    Data quality and workflow insights for your patient panel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="flex flex-wrap gap-1 h-auto" data-testid="tabs-categories">
                      <TabsTrigger value="all" data-testid="tab-all">
                        All ({visibleInsights.length})
                      </TabsTrigger>
                      <TabsTrigger value="pending_review" data-testid="tab-pending">
                        Pending ({getCategoryCount("pending_review")})
                      </TabsTrigger>
                      <TabsTrigger value="documentation_gap" data-testid="tab-docs">
                        Docs ({getCategoryCount("documentation_gap")})
                      </TabsTrigger>
                      <TabsTrigger value="data_quality" data-testid="tab-quality">
                        Quality ({getCategoryCount("data_quality")})
                      </TabsTrigger>
                      <TabsTrigger value="education_opportunity" data-testid="tab-education">
                        Education ({getCategoryCount("education_opportunity")})
                      </TabsTrigger>
                      <TabsTrigger value="workflow_efficiency" data-testid="tab-workflow">
                        Workflow ({getCategoryCount("workflow_efficiency")})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="mt-4">
                      <ScrollArea className="h-[500px]">
                        {filteredInsights.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-insights">
                            No insights in this category
                          </div>
                        ) : (
                          <div className="space-y-4 pr-4">
                            {filteredInsights.map((insight) => (
                              <InsightCard 
                                key={insight.id} 
                                insight={insight} 
                                onDismiss={handleDismiss}
                              />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Alert data-testid="alert-disclaimer">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm" data-testid="text-disclaimer">
                  {data.disclaimer}
                </AlertDescription>
              </Alert>

              <AiSummaryFeedback
                feedbackType="copilot_insight"
                summaryId={`copilot-${new Date().toISOString().split('T')[0]}`}
              />
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No data available. Click Refresh to analyze your patient panel.
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictive" className="mt-6">
          <PredictiveAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
