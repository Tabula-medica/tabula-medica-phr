import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Calendar, 
  ClipboardCheck, 
  Building2, 
  Users, 
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Shield,
  FileSearch,
  Cpu,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Percent
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DashboardData {
  stats: {
    autoFormPopulation: {
      formsGenerated: number;
      avgConfidence: number;
      pendingReview: number;
    };
    resourceManagement: {
      optimizationsRun: number;
      avgUtilization: number;
      conflictsResolved: number;
    };
    chartReview: {
      reviewsCompleted: number;
      avgCodingAccuracy: number;
      pendingReviews: number;
    };
  };
  recentForms: any[];
  recentPreAuths: any[];
  recentResourceOpts: any[];
  recentChartReviews: any[];
  noCdsDisclaimer: string;
}

export default function AIAdminAutomation() {
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading, refetch } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/admin-operations/dashboard"],
    refetchInterval: 30000
  });

  const dashboard = dashboardData?.data;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.7) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      complete: { color: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Complete" },
      review_required: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "Review Required" },
      draft: { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Draft" },
      ready: { color: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Ready" },
      pending_review: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "Pending Review" },
      approved: { color: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Approved" },
      reviewed: { color: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Reviewed" }
    };
    const config = statusConfig[status] || { color: "bg-muted", label: status };
    return <Badge className={`${config.color} text-xs`}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-80" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="page-title">AI Administrative Automation</h1>
            <p className="text-muted-foreground mt-1">
              Automated form population, resource management, and chart review
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {dashboard?.noCdsDisclaimer || "AI-generated insights are for informational and operational purposes only. They do not constitute clinical decision support or medical advice."}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-forms-stats">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Auto Form Population</CardTitle>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.stats?.autoFormPopulation?.formsGenerated || 0}</div>
              <p className="text-xs text-muted-foreground">Forms generated</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={(dashboard?.stats?.autoFormPopulation?.avgConfidence || 0) * 100} className="h-2" />
                <span className={`text-xs font-medium ${getConfidenceColor(dashboard?.stats?.autoFormPopulation?.avgConfidence || 0)}`}>
                  {((dashboard?.stats?.autoFormPopulation?.avgConfidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard?.stats?.autoFormPopulation?.pendingReview || 0} pending review
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-resources-stats">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Resource Management</CardTitle>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.stats?.resourceManagement?.optimizationsRun || 0}</div>
              <p className="text-xs text-muted-foreground">Optimizations run</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={(dashboard?.stats?.resourceManagement?.avgUtilization || 0) * 100} className="h-2" />
                <span className="text-xs font-medium">
                  {((dashboard?.stats?.resourceManagement?.avgUtilization || 0) * 100).toFixed(0)}% util
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard?.stats?.resourceManagement?.conflictsResolved || 0} conflicts resolved
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-charts-stats">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Chart Review & Coding</CardTitle>
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.stats?.chartReview?.reviewsCompleted || 0}</div>
              <p className="text-xs text-muted-foreground">Reviews completed</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={(dashboard?.stats?.chartReview?.avgCodingAccuracy || 0) * 100} className="h-2" />
                <span className={`text-xs font-medium ${getConfidenceColor(dashboard?.stats?.chartReview?.avgCodingAccuracy || 0)}`}>
                  {((dashboard?.stats?.chartReview?.avgCodingAccuracy || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard?.stats?.chartReview?.pendingReviews || 0} pending reviews
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="forms" data-testid="tab-forms">
              <FileText className="h-4 w-4 mr-2" />
              Forms & Pre-Auth
            </TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-resources">
              <Building2 className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="charts" data-testid="tab-charts">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Chart Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recent Auto-Populated Forms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(dashboard?.recentForms || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent forms</p>
                    ) : (
                      (dashboard?.recentForms || []).map((form: any, idx: number) => (
                        <div key={form.id || idx} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`form-item-${idx}`}>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{form.formType?.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">{form.patientName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${getConfidenceColor(form.confidenceScore || 0)}`}>
                              {((form.confidenceScore || 0) * 100).toFixed(0)}%
                            </span>
                            {getStatusBadge(form.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Recent Pre-Authorization Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(dashboard?.recentPreAuths || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent pre-auth requests</p>
                    ) : (
                      (dashboard?.recentPreAuths || []).map((preAuth: any, idx: number) => (
                        <div key={preAuth.id || idx} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`preauth-item-${idx}`}>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{preAuth.serviceRequested}</p>
                            <p className="text-xs text-muted-foreground">{preAuth.patientName} - {preAuth.insurerName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {((preAuth.approvalLikelihood || 0) * 100).toFixed(0)}% likely
                            </Badge>
                            {getStatusBadge(preAuth.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Resource Optimization Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(dashboard?.recentResourceOpts || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent optimizations</p>
                    ) : (
                      (dashboard?.recentResourceOpts || []).map((opt: any, idx: number) => (
                        <div key={opt.id || idx} className="p-3 rounded-lg border" data-testid={`resource-item-${idx}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">{opt.facilityName}</p>
                            <Badge variant="outline" className="text-xs">{opt.date}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold">{((opt.optimizationMetrics?.overallUtilization || 0) * 100).toFixed(0)}%</p>
                              <p className="text-xs text-muted-foreground">Utilization</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                +{opt.optimizationMetrics?.efficiencyGain?.toFixed(1) || 0}%
                              </p>
                              <p className="text-xs text-muted-foreground">Efficiency</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{opt.optimizationMetrics?.conflictsResolved || 0}</p>
                              <p className="text-xs text-muted-foreground">Resolved</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Recent Chart Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(dashboard?.recentChartReviews || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent chart reviews</p>
                    ) : (
                      (dashboard?.recentChartReviews || []).map((review: any, idx: number) => (
                        <div key={review.id || idx} className="p-3 rounded-lg border" data-testid={`chart-item-${idx}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium">{review.patientName}</p>
                              <p className="text-xs text-muted-foreground">{review.encounterType} - {review.encounterDate}</p>
                            </div>
                            {getStatusBadge(review.status)}
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              <Percent className="h-3 w-3 text-muted-foreground" />
                              <span className={`text-xs font-medium ${getConfidenceColor(review.codingAccuracyScore || 0)}`}>
                                {((review.codingAccuracyScore || 0) * 100).toFixed(0)}% accuracy
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FileSearch className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">{review.suggestedCodes?.length || 0} codes suggested</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Auto-Populated Forms
                </CardTitle>
                <CardDescription>
                  Forms automatically populated from EHR data with AI-assisted field completion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(dashboard?.recentForms || []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No auto-populated forms yet</p>
                  ) : (
                    (dashboard?.recentForms || []).map((form: any, idx: number) => (
                      <Card key={form.id || idx} className="bg-muted/30" data-testid={`form-detail-${idx}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-medium capitalize">{form.formType?.replace(/_/g, " ")}</h4>
                              <p className="text-sm text-muted-foreground">Patient: {form.patientName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getConfidenceColor(form.confidenceScore || 0)}>
                                {((form.confidenceScore || 0) * 100).toFixed(0)}% Confidence
                              </Badge>
                              {getStatusBadge(form.status)}
                            </div>
                          </div>
                          
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <h5 className="text-sm font-medium mb-2">Populated Fields</h5>
                              <div className="space-y-1">
                                {(form.populatedFields || []).slice(0, 5).map((field: any, fidx: number) => (
                                  <div key={fidx} className="flex items-center justify-between text-sm p-2 rounded bg-background">
                                    <span className="text-muted-foreground">{field.fieldLabel}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium truncate max-w-32">{String(field.value)}</span>
                                      {field.requiresVerification && (
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-2">AI Suggestions</h5>
                              <ul className="space-y-1">
                                {(form.aiSuggestions || []).map((suggestion: string, sidx: number) => (
                                  <li key={sidx} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                                    {suggestion}
                                  </li>
                                ))}
                              </ul>
                              {form.missingRequiredFields?.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-red-600 dark:text-red-400">Missing Required:</p>
                                  <p className="text-xs text-muted-foreground">{form.missingRequiredFields.join(", ")}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Pre-Authorization Requests
                </CardTitle>
                <CardDescription>
                  AI-generated prior authorization requests with approval likelihood predictions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(dashboard?.recentPreAuths || []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No pre-authorization requests yet</p>
                  ) : (
                    (dashboard?.recentPreAuths || []).map((preAuth: any, idx: number) => (
                      <Card key={preAuth.id || idx} className="bg-muted/30" data-testid={`preauth-detail-${idx}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-medium">{preAuth.serviceRequested}</h4>
                              <p className="text-sm text-muted-foreground">
                                {preAuth.patientName} | {preAuth.insurerName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={preAuth.approvalLikelihood >= 0.8 
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : preAuth.approvalLikelihood >= 0.6
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }>
                                {((preAuth.approvalLikelihood || 0) * 100).toFixed(0)}% Approval Likely
                              </Badge>
                              {getStatusBadge(preAuth.status)}
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <h5 className="text-sm font-medium mb-1">Clinical Justification</h5>
                              <p className="text-sm text-muted-foreground">{preAuth.clinicalJustification}</p>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-1">AI-Generated Narrative</h5>
                              <p className="text-sm text-muted-foreground italic">{preAuth.aiGeneratedNarrative}</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {(preAuth.procedureCodes || []).map((code: string, cidx: number) => (
                                <Badge key={cidx} variant="outline" className="text-xs">CPT: {code}</Badge>
                              ))}
                              {(preAuth.diagnosisCodes || []).map((code: string, cidx: number) => (
                                <Badge key={cidx} variant="secondary" className="text-xs">ICD: {code}</Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Resource Optimization Results
                </CardTitle>
                <CardDescription>
                  AI-powered room, equipment, and clinician schedule optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(dashboard?.recentResourceOpts || []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No resource optimizations yet</p>
                  ) : (
                    (dashboard?.recentResourceOpts || []).map((opt: any, idx: number) => (
                      <Card key={opt.id || idx} className="bg-muted/30" data-testid={`resource-detail-${idx}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-medium">{opt.facilityName}</h4>
                              <p className="text-sm text-muted-foreground">Date: {opt.date}</p>
                            </div>
                            <Badge variant="outline" className="text-green-600 dark:text-green-400">
                              +{opt.optimizationMetrics?.efficiencyGain?.toFixed(1) || 0}% Efficiency
                            </Badge>
                          </div>
                          
                          <div className="grid gap-4 md:grid-cols-4 mb-4">
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-2xl font-bold">{((opt.optimizationMetrics?.overallUtilization || 0) * 100).toFixed(0)}%</p>
                              <p className="text-xs text-muted-foreground">Overall</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-2xl font-bold">{((opt.optimizationMetrics?.roomUtilization || 0) * 100).toFixed(0)}%</p>
                              <p className="text-xs text-muted-foreground">Rooms</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-2xl font-bold">{((opt.optimizationMetrics?.equipmentUtilization || 0) * 100).toFixed(0)}%</p>
                              <p className="text-xs text-muted-foreground">Equipment</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-2xl font-bold">{((opt.optimizationMetrics?.clinicianUtilization || 0) * 100).toFixed(0)}%</p>
                              <p className="text-xs text-muted-foreground">Clinicians</p>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h5 className="text-sm font-medium mb-2">Recommendations</h5>
                              <div className="space-y-2">
                                {(opt.recommendations || []).map((rec: any, ridx: number) => (
                                  <div key={ridx} className="p-2 rounded bg-background text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs capitalize">{rec.type?.replace(/_/g, " ")}</Badge>
                                      <Badge className={`text-xs ${
                                        rec.priority === "high" ? "bg-red-500/10 text-red-600" :
                                        rec.priority === "medium" ? "bg-yellow-500/10 text-yellow-600" :
                                        "bg-blue-500/10 text-blue-600"
                                      }`}>{rec.priority}</Badge>
                                    </div>
                                    <p className="text-muted-foreground">{rec.description}</p>
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">{rec.expectedImpact}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-2">AI Analysis</h5>
                              <p className="text-sm text-muted-foreground">{opt.aiAnalysis}</p>
                              
                              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Peak Hours:</span>
                                  <p className="font-medium">{opt.optimizationMetrics?.peakHours?.join(", ") || "N/A"}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Underutilized:</span>
                                  <p className="font-medium">{opt.optimizationMetrics?.underutilizedPeriods?.join(", ") || "N/A"}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Automated Chart Reviews
                </CardTitle>
                <CardDescription>
                  AI-assisted chart review with ICD-10 and CPT coding suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Coding suggestions are for informational purposes only. Final coding decisions must be made by certified medical coders and reviewed according to organizational policies.
                  </AlertDescription>
                </Alert>

                <div className="space-y-6">
                  {(dashboard?.recentChartReviews || []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No chart reviews yet</p>
                  ) : (
                    (dashboard?.recentChartReviews || []).map((review: any, idx: number) => (
                      <Card key={review.id || idx} className="bg-muted/30" data-testid={`chart-detail-${idx}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-medium">{review.patientName}</h4>
                              <p className="text-sm text-muted-foreground">
                                {review.encounterType} | {review.encounterDate} | Provider: {review.providerName}
                              </p>
                              <p className="text-sm mt-1">Chief Complaint: {review.chiefComplaint}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getConfidenceColor(review.codingAccuracyScore || 0)}>
                                {((review.codingAccuracyScore || 0) * 100).toFixed(0)}% Accuracy
                              </Badge>
                              {getStatusBadge(review.status)}
                            </div>
                          </div>
                          
                          <div className="grid gap-4 md:grid-cols-2 mb-4">
                            <div>
                              <h5 className="text-sm font-medium mb-2">Suggested Codes</h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {(review.suggestedCodes || []).map((code: any, cidx: number) => (
                                  <div key={cidx} className="p-2 rounded bg-background text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                      <Badge variant={code.codeType === "ICD-10" ? "default" : "secondary"} className="text-xs">
                                        {code.codeType}: {code.code}
                                      </Badge>
                                      <span className={`text-xs font-medium ${getConfidenceColor(code.confidence || 0)}`}>
                                        {((code.confidence || 0) * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground">{code.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1 italic">{code.rationale}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-2">Documentation Findings</h5>
                              <div className="space-y-2">
                                {(review.missingDocumentation || []).map((doc: any, didx: number) => (
                                  <div key={didx} className="p-2 rounded bg-background text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertTriangle className={`h-3 w-3 ${
                                        doc.importance === "required" ? "text-red-500" :
                                        doc.importance === "recommended" ? "text-yellow-500" :
                                        "text-blue-500"
                                      }`} />
                                      <span className="font-medium">{doc.element}</span>
                                      <Badge variant="outline" className="text-xs capitalize">{doc.importance}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{doc.impact}</p>
                                  </div>
                                ))}

                                {(review.complianceFlags || []).length > 0 && (
                                  <div className="mt-3">
                                    <h6 className="text-xs font-medium mb-1">Compliance Flags</h6>
                                    {(review.complianceFlags || []).map((flag: any, fidx: number) => (
                                      <div key={fidx} className="p-2 rounded bg-background text-xs mb-1">
                                        <Badge className={`mr-2 ${
                                          flag.severity === "error" ? "bg-red-500/10 text-red-600" :
                                          flag.severity === "warning" ? "bg-yellow-500/10 text-yellow-600" :
                                          "bg-blue-500/10 text-blue-600"
                                        }`}>{flag.type}</Badge>
                                        {flag.message}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h5 className="text-sm font-medium mb-1">AI Analysis Summary</h5>
                            <p className="text-sm text-muted-foreground">{review.aiNarrative}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}