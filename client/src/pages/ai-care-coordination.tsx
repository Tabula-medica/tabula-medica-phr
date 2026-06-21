import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle,
  Clock,
  Target,
  RefreshCw,
  ChevronRight,
  UserPlus,
  Activity,
  BarChart3,
  AlertCircle,
} from "lucide-react";

interface DashboardSummary {
  teamOverview: {
    totalMembers: number;
    availableMembers: number;
    avgWorkload: number;
    totalPendingTasks: number;
  };
  careGapOverview: {
    totalGaps: number;
    criticalGaps: number;
    overdueGaps: number;
    uniquePatientsWithGaps: number;
  };
  patientProgress: {
    improving: number;
    stable: number;
    declining: number;
    avgGoalCompletion: number;
  };
  appointmentRisk: {
    upcomingAppointments: number;
    highRisk: number;
    mediumRisk: number;
    interventionsNeeded: number;
  };
  recentActivity: { type: string; message: string; time: string }[];
  disclaimer: string;
}

interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  currentWorkload: number;
  maxCapacity: number;
  activePatients: number;
  pendingTasks: number;
  avgResponseTime: number;
  availability: string;
  skills: string[];
}

interface NoShowPrediction {
  appointmentId: string;
  patientId: string;
  patientName: string;
  scheduledTime: string;
  noShowRisk: "high" | "medium" | "low";
  riskScore: number;
  riskFactors: { factor: string; impact: string; details: string }[];
  suggestedInterventions: { intervention: string; priority: number; timing: string; assignTo: string }[];
  aiInsights: string;
  disclaimer: string;
}

interface CareGapReport {
  id: string;
  generatedAt: string;
  reportPeriod: { start: string; end: string };
  summary: {
    totalPatients: number;
    patientsWithGaps: number;
    totalGaps: number;
    criticalGaps: number;
    moderateGaps: number;
    minorGaps: number;
  };
  gapsByCategory: { category: string; count: number; percentageOfTotal: number }[];
  topPriorityPatients: {
    patientId: string;
    patientName: string;
    gapCount: number;
    criticalGaps: number;
    riskLevel: string;
    recommendedActions: string[];
  }[];
  aiRecommendations: { recommendation: string; priority: string; expectedImpact: string }[];
  progressSummary: {
    patientsImproving: number;
    patientsStable: number;
    patientsDeclining: number;
    averageGoalCompletion: number;
  };
  disclaimer: string;
}

export default function AICareCoordinationPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<{ success: boolean; dashboard: DashboardSummary }>({
    queryKey: ["/api/care-coordination/dashboard-summary"],
  });

  const { data: teamData, isLoading: teamLoading } = useQuery<{ success: boolean; members: CareTeamMember[] }>({
    queryKey: ["/api/care-coordination/team-members"],
  });

  const { data: atRiskData, isLoading: riskLoading, refetch: refetchRisk } = useQuery<{ success: boolean; atRiskAppointments: NoShowPrediction[] }>({
    queryKey: ["/api/care-coordination/appointments/at-risk"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/care-coordination/care-gap-report", {
        teamId: "default-team",
      });
      return response.json();
    },
  });

  const dashboard = dashboardData?.dashboard;
  const members = teamData?.members || [];
  const atRiskAppointments = atRiskData?.atRiskAppointments || [];

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload >= 85) return "text-red-500";
    if (workload >= 70) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-7 w-7 text-primary" />
            AI Care Coordination
          </h1>
          <p className="text-muted-foreground mt-1">
            Intelligent task assignment, no-show prediction, and care gap analysis
          </p>
        </div>
        <Button onClick={() => refetchDashboard()} variant="outline" data-testid="button-refresh-dashboard">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Alert variant="default" className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">For Operational Use Only</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          This module provides AI-powered operational insights for care coordination. It does not provide clinical decision support. All clinical decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">
            <UserPlus className="h-4 w-4 mr-2" />
            Team & Tasks
          </TabsTrigger>
          <TabsTrigger value="no-shows" data-testid="tab-no-shows">
            <Calendar className="h-4 w-4 mr-2" />
            No-Show Risk
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Care Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-team-overview">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.teamOverview.availableMembers}/{dashboard.teamOverview.totalMembers}</div>
                    <p className="text-xs text-muted-foreground">Available members</p>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Avg Workload</span>
                        <span className={getWorkloadColor(dashboard.teamOverview.avgWorkload)}>
                          {dashboard.teamOverview.avgWorkload.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={dashboard.teamOverview.avgWorkload} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-care-gaps">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Care Gaps
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.careGapOverview.totalGaps}</div>
                    <p className="text-xs text-muted-foreground">Total gaps identified</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="destructive" className="text-xs">
                        {dashboard.careGapOverview.criticalGaps} Critical
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {dashboard.careGapOverview.overdueGaps} Overdue
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-patient-progress">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Patient Progress
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-semibold">{dashboard.patientProgress.improving}</span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Activity className="h-4 w-4" />
                        <span className="font-semibold">{dashboard.patientProgress.stable}</span>
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-4 w-4" />
                        <span className="font-semibold">{dashboard.patientProgress.declining}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {dashboard.patientProgress.avgGoalCompletion.toFixed(0)}% avg goal completion
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-appointment-risk">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Appointment Risk
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.appointmentRisk.highRisk}</div>
                    <p className="text-xs text-muted-foreground">High-risk appointments</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.appointmentRisk.interventionsNeeded} need intervention
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                        <div className="p-2 rounded-full bg-primary/10">
                          {activity.type === "assignment" && <UserPlus className="h-4 w-4 text-primary" />}
                          {activity.type === "prediction" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {activity.type === "gap_closed" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Failed to load dashboard data
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Care Team Members
              </CardTitle>
              <CardDescription>
                AI analyzes workload, skills, and availability to recommend optimal task assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {members.map(member => (
                      <Card key={member.id} className="bg-muted/30" data-testid={`card-team-member-${member.id}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{member.name}</h4>
                                <Badge variant={member.availability === "available" ? "default" : "secondary"}>
                                  {member.availability}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground capitalize">
                                {member.role.replace("_", " ")} {member.specialty && `- ${member.specialty}`}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {member.skills.slice(0, 3).map(skill => (
                                  <Badge key={skill} variant="outline" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                                {member.skills.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{member.skills.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Workload:</span>
                                <span className={`font-semibold ${getWorkloadColor(member.currentWorkload)}`}>
                                  {member.currentWorkload}%
                                </span>
                              </div>
                              <Progress value={member.currentWorkload} className="w-24 h-2" />
                              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                <span>{member.activePatients} patients</span>
                                <span>{member.pendingTasks} tasks</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="no-shows" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  At-Risk Appointments
                </CardTitle>
                <CardDescription>
                  AI predicts no-show likelihood and suggests proactive interventions
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchRisk()} data-testid="button-refresh-risk">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : atRiskAppointments.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {atRiskAppointments.map(prediction => (
                      <Card key={prediction.appointmentId} className="border-l-4" style={{ borderLeftColor: prediction.noShowRisk === "high" ? "rgb(239,68,68)" : prediction.noShowRisk === "medium" ? "rgb(234,179,8)" : "rgb(34,197,94)" }} data-testid={`card-prediction-${prediction.appointmentId}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{prediction.patientName}</h4>
                                <Badge variant={getRiskBadgeVariant(prediction.noShowRisk)}>
                                  {prediction.noShowRisk.toUpperCase()} RISK ({prediction.riskScore}%)
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                <Clock className="h-4 w-4 inline mr-1" />
                                {new Date(prediction.scheduledTime).toLocaleString()}
                              </p>
                              
                              <div className="mb-3">
                                <h5 className="text-sm font-medium mb-1">Risk Factors:</h5>
                                <div className="flex flex-wrap gap-1">
                                  {prediction.riskFactors.slice(0, 3).map((factor, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {factor.factor}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {prediction.aiInsights && (
                                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Brain className="h-4 w-4 text-primary" />
                                    <span className="font-medium">AI Insight</span>
                                  </div>
                                  <p className="text-muted-foreground">{prediction.aiInsights}</p>
                                </div>
                              )}
                            </div>

                            <div className="w-full md:w-64">
                              <h5 className="text-sm font-medium mb-2">Suggested Interventions:</h5>
                              <div className="space-y-2">
                                {prediction.suggestedInterventions.slice(0, 3).map((intervention, i) => (
                                  <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                                    <div>
                                      <p>{intervention.intervention}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {intervention.timing} - Assign to: {intervention.assignTo}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No at-risk appointments found for the upcoming period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Care Gap & Progress Reports
                </CardTitle>
                <CardDescription>
                  Generate AI-driven reports summarizing care gaps and patient progress
                </CardDescription>
              </div>
              <Button 
                onClick={() => generateReportMutation.mutate()} 
                disabled={generateReportMutation.isPending}
                data-testid="button-generate-report"
              >
                {generateReportMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {generateReportMutation.data?.report ? (
                <div className="space-y-6">
                  {(() => {
                    const report = generateReportMutation.data.report as CareGapReport;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">Care Gap Report</h3>
                            <p className="text-sm text-muted-foreground">
                              Period: {report.reportPeriod.start} to {report.reportPeriod.end}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Generated: {new Date(report.generatedAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <p className="text-2xl font-bold">{report.summary.totalPatients}</p>
                            <p className="text-xs text-muted-foreground">Total Patients</p>
                          </div>
                          <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <p className="text-2xl font-bold">{report.summary.totalGaps}</p>
                            <p className="text-xs text-muted-foreground">Total Gaps</p>
                          </div>
                          <div className="text-center p-4 bg-red-100 dark:bg-red-950/30 rounded-lg">
                            <p className="text-2xl font-bold text-red-600">{report.summary.criticalGaps}</p>
                            <p className="text-xs text-muted-foreground">Critical Gaps</p>
                          </div>
                          <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <p className="text-2xl font-bold">{report.progressSummary.averageGoalCompletion.toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">Avg Goal Completion</p>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-3">Gaps by Category</h4>
                            <div className="space-y-2">
                              {report.gapsByCategory.map((cat, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <span className="text-sm">{cat.category}</span>
                                  <div className="flex items-center gap-2">
                                    <Progress value={cat.percentageOfTotal} className="w-24 h-2" />
                                    <span className="text-sm font-medium w-8">{cat.count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-3">Patient Progress</h4>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm">
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                  Improving
                                </span>
                                <Badge variant="default">{report.progressSummary.patientsImproving}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm">
                                  <Activity className="h-4 w-4 text-yellow-500" />
                                  Stable
                                </span>
                                <Badge variant="secondary">{report.progressSummary.patientsStable}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm">
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                  Declining
                                </span>
                                <Badge variant="destructive">{report.progressSummary.patientsDeclining}</Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            AI Recommendations
                          </h4>
                          <div className="space-y-3">
                            {report.aiRecommendations.map((rec, i) => (
                              <div key={i} className="p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "secondary" : "outline"}>
                                    {rec.priority}
                                  </Badge>
                                  <div>
                                    <p className="text-sm font-medium">{rec.recommendation}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{rec.expectedImpact}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Alert variant="default" className="bg-muted/30">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {report.disclaimer}
                          </AlertDescription>
                        </Alert>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">Click "Generate Report" to create a care gap and progress report</p>
                  <p className="text-sm">Reports include AI-powered recommendations for improving care outcomes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
