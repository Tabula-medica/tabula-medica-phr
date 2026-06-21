import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  FileText, 
  AlertTriangle, 
  Target,
  RefreshCw,
  Activity,
  Pill,
  Heart,
  Calendar,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info
} from "lucide-react";

export default function AIProfileInsights() {
  const [activeTab, setActiveTab] = useState("overview");
  const profileId = "profile-default";

  const { data: fullInsights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery<any>({
    queryKey: ["/api/ai-profile-insights/full-insights", profileId],
  });

  const { data: ehrSources, isLoading: sourcesLoading } = useQuery<any>({
    queryKey: ["/api/ai-profile-insights/ehr-sources", profileId],
  });

  const { data: ehrDataSummary } = useQuery<any>({
    queryKey: ["/api/ai-profile-insights/ehr-data-summary", profileId],
  });

  const insights = fullInsights?.data;
  const sources = ehrSources?.data || [];
  const dataSummary = ehrDataSummary?.data;

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case "low": return "secondary";
      case "moderate": return "default";
      case "elevated": return "default";
      case "high": return "destructive";
      default: return "secondary";
    }
  };

  const getSignificanceBadge = (significance: string) => {
    switch (significance) {
      case "critical": return "destructive";
      case "important": return "default";
      case "notable": return "secondary";
      default: return "outline";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": case "worsening": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (insightsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">AI Profile Insights</h1>
            <p className="text-muted-foreground">Generating insights from your health records...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Profile Insights</h1>
            <p className="text-muted-foreground">AI-powered analysis from your synced EHR data</p>
          </div>
        </div>
        <Button 
          onClick={() => refetchInsights()} 
          variant="outline" 
          className="gap-2"
          data-testid="button-refresh-insights"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Educational Information Only</AlertTitle>
        <AlertDescription>
          This AI-generated analysis is for educational purposes only and does NOT constitute medical advice or clinical decision support. Always consult with your healthcare providers for medical decisions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-source-count">{sources.length}</div>
            <p className="text-xs text-muted-foreground">Connected EHR systems</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-record-count">
              {dataSummary?.totalRecords || 0}
            </div>
            <p className="text-xs text-muted-foreground">Health records synced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={getRiskBadgeVariant(insights?.riskAssessment?.overallRiskLevel || "moderate")} data-testid="badge-risk-level">
              {insights?.riskAssessment?.overallRiskLevel?.toUpperCase() || "MODERATE"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Overall health risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Care Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-goals-count">
              {insights?.carePlanAdjustments?.goals?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active health goals</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">Risks</TabsTrigger>
          <TabsTrigger value="careplan" data-testid="tab-careplan">Care Plan</TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">Data Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Health Summary
              </CardTitle>
              <CardDescription>AI-generated overview of your health records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm" data-testid="text-health-overview">
                {insights?.historySummary?.summary?.overview || "Your health data is being analyzed..."}
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Chronic Conditions
                  </h4>
                  <ul className="space-y-1">
                    {insights?.historySummary?.summary?.chronicConditions?.map((condition: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                        {condition}
                      </li>
                    )) || <li className="text-sm text-muted-foreground">No conditions recorded</li>}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-blue-500" />
                    Active Problems
                  </h4>
                  <ul className="space-y-1">
                    {insights?.historySummary?.summary?.activeProblems?.map((problem: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                        {problem}
                      </li>
                    )) || <li className="text-sm text-muted-foreground">No active problems</li>}
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Key Findings</h4>
                <div className="grid gap-2">
                  {insights?.historySummary?.keyFindings?.slice(0, 5).map((finding: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                      <Badge variant={getSignificanceBadge(finding.significance)} className="mt-0.5">
                        {finding.significance}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm">{finding.finding}</p>
                        <p className="text-xs text-muted-foreground">
                          Source: {finding.sourceEHR} | Category: {finding.category}
                        </p>
                      </div>
                    </div>
                  )) || <p className="text-sm text-muted-foreground">No key findings</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Health Timeline
              </CardTitle>
              <CardDescription>Important events from your health history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights?.historySummary?.timelineHighlights?.map((event: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-4 border-l-2 border-primary/20 pl-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{event.event}</span>
                      <span className="text-xs text-muted-foreground">{event.date}</span>
                      <Badge variant="outline" className="w-fit mt-1">{event.category}</Badge>
                    </div>
                  </div>
                )) || <p className="text-muted-foreground">No timeline events</p>}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Surgical History</h4>
                  <ul className="space-y-1">
                    {insights?.historySummary?.summary?.surgicalHistory?.map((surgery: string, idx: number) => (
                      <li key={idx} className="text-sm">{surgery}</li>
                    )) || <li className="text-sm text-muted-foreground">None recorded</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Immunization Status</h4>
                  <p className="text-sm">{insights?.historySummary?.summary?.immunizationStatus || "Unknown"}</p>
                  <h4 className="font-medium mb-2 mt-4">Screening Status</h4>
                  <p className="text-sm">{insights?.historySummary?.summary?.screeningStatus || "Unknown"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Risk Assessment
              </CardTitle>
              <CardDescription>AI-identified potential health risks based on your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Overall Risk Level</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getRiskBadgeVariant(insights?.riskAssessment?.overallRiskLevel || "moderate")} className="text-lg px-3 py-1">
                      {insights?.riskAssessment?.overallRiskLevel?.toUpperCase() || "MODERATE"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Score: {insights?.riskAssessment?.riskScore || 0}/100
                    </span>
                  </div>
                </div>
                <Progress value={insights?.riskAssessment?.riskScore || 0} className="flex-1 h-3" />
              </div>

              <div>
                <h4 className="font-medium mb-3">Condition Risks</h4>
                <div className="space-y-3">
                  {insights?.riskAssessment?.conditionRisks?.map((risk: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{risk.condition}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{risk.currentStatus}</Badge>
                          <Badge variant={getRiskBadgeVariant(risk.riskLevel)}>{risk.riskLevel}</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>Contributing Factors:</strong> {risk.contributingFactors?.join(", ")}
                      </div>
                    </div>
                  )) || <p className="text-muted-foreground">No condition risks identified</p>}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Medication Risks</h4>
                <div className="space-y-3">
                  {insights?.riskAssessment?.medicationRisks?.map((risk: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{risk.medication}</span>
                        <Badge variant={risk.severity === "severe" || risk.severity === "major" ? "destructive" : "secondary"}>
                          {risk.riskType} - {risk.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{risk.description}</p>
                    </div>
                  )) || <p className="text-muted-foreground">No medication risks identified</p>}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Preventive Care Gaps</h4>
                <div className="grid gap-2">
                  {insights?.riskAssessment?.preventiveGaps?.map((gap: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium">{gap.screening}</span>
                        <p className="text-xs text-muted-foreground">Due: {gap.dueDate}</p>
                      </div>
                      <Badge variant={gap.priority === "urgent" ? "destructive" : gap.priority === "overdue" ? "default" : "secondary"}>
                        {gap.priority}
                      </Badge>
                    </div>
                  )) || <p className="text-muted-foreground">No preventive care gaps identified</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="careplan" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Care Plan Suggestions
              </CardTitle>
              <CardDescription>AI-suggested considerations for your care plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Current Care Plan Summary</h4>
                <p className="text-sm text-muted-foreground">
                  {insights?.carePlanAdjustments?.currentCarePlanSummary || "No care plan summary available"}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-3">Suggested Adjustments</h4>
                <div className="space-y-3">
                  {insights?.carePlanAdjustments?.adjustments?.map((adj: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{adj.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{adj.category}</Badge>
                          <Badge variant={adj.priority === "urgent" || adj.priority === "high" ? "destructive" : "secondary"}>
                            {adj.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p><strong>Rationale:</strong> {adj.rationale}</p>
                        <p><strong>Current:</strong> {adj.currentState}</p>
                        <p><strong>Suggested:</strong> {adj.suggestedChange}</p>
                        <p className="text-muted-foreground"><strong>Expected Benefit:</strong> {adj.expectedBenefit}</p>
                      </div>
                    </div>
                  )) || <p className="text-muted-foreground">No adjustments suggested</p>}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Health Goals</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {insights?.carePlanAdjustments?.goals?.map((goal: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <Badge variant="outline">{goal.category}</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><strong>Current:</strong> {goal.currentValue}</p>
                        <p><strong>Target:</strong> {goal.targetValue}</p>
                        <p className="text-muted-foreground">Timeframe: {goal.timeframe}</p>
                      </div>
                    </div>
                  )) || <p className="text-muted-foreground">No health goals set</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Connected EHR Systems
              </CardTitle>
              <CardDescription>Health record sources powering your AI insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {sources.map((source: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <span className="font-medium">{source.facilityName}</span>
                        <Badge variant="outline" className="ml-2">{source.platform}</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {source.recordCount} records synced
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Last sync: {new Date(source.lastSyncAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {dataSummary && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Data Categories</h4>
                  <div className="grid gap-2 md:grid-cols-4">
                    {dataSummary.dataCategories?.map((cat: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className="text-lg font-bold">{cat.count}</div>
                        <div className="text-sm text-muted-foreground">{cat.category}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert variant="default" className="bg-muted/50">
        <Shield className="h-4 w-4" />
        <AlertTitle>Privacy & Compliance</AlertTitle>
        <AlertDescription>
          All AI analysis is performed with HIPAA-compliant data handling. Your health information is encrypted and protected. 
          Generated insights are strictly educational and do not constitute clinical decision support or medical advice.
        </AlertDescription>
      </Alert>
    </div>
  );
}
