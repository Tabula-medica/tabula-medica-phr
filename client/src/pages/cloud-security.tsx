import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  Activity,
  Brain,
  Check,
  CheckCircle,
  Clock,
  Eye,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Zap,
  Lock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  category: string;
  riskLevel: string;
  affectedResources: string[];
  detectedAt: string;
  source: string;
  remediationStatus: string;
  autoRemediable: boolean;
  remediationSteps: string[];
  estimatedImpact: string;
  noCdsCompliance: string;
}

interface ThreatIndicator {
  type: string;
  value: string;
  confidence: number;
  context: string;
}

interface ThreatIntelligence {
  id: string;
  threatName: string;
  category: string;
  severity: string;
  description: string;
  indicators: ThreatIndicator[];
  predictedLikelihood: number;
  predictedImpact: number;
  timeToExploit: string;
  affectedSystems: string[];
  mitigationRecommendations: string[];
  isZeroDay: boolean;
  noCdsCompliance: string;
}

interface AdaptiveResponse {
  id: string;
  name: string;
  action: string;
  severity: string;
  cooldownMinutes: number;
  maxExecutions: number;
  currentExecutions: number;
  lastExecuted?: string;
}

interface TriggerCondition {
  id: string;
  type: string;
  threshold: number;
  operator: string;
  windowMinutes: number;
  description: string;
}

interface SelfHealingControl {
  id: string;
  name: string;
  description: string;
  controlType: string;
  currentState: string;
  triggerConditions: TriggerCondition[];
  adaptiveResponses: AdaptiveResponse[];
  effectivenessScore: number;
  lastTriggered?: string;
  lastAdapted?: string;
  noCdsCompliance: string;
}

interface SecurityPostureScore {
  overall: number;
  categories: {
    vulnerabilityManagement: number;
    accessControl: number;
    dataProtection: number;
    networkSecurity: number;
    incidentResponse: number;
    compliance: number;
  };
  trend: string;
  recommendations: string[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface CloudSecurityStats {
  totalFindings: number;
  criticalFindings: number;
  pendingRemediations: number;
  autoRemediableCount: number;
  activeThreats: number;
  zeroDayThreats: number;
  activeControls: number;
  overallPosture: number;
  pendingApprovals: number;
}

interface PendingApproval {
  id: string;
  actionType: string;
  title: string;
  description: string;
  riskLevel: string;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  status: string;
  relatedResourceId: string;
  relatedResourceType: string;
  actionDetails: Record<string, unknown>;
  impactAssessment: string;
  rollbackPlan: string;
  noCdsCompliance: string;
}

interface ActionableInsight {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: number;
  suggestedAction: string;
  estimatedImpact: string;
  affectedScore: string;
  potentialImprovement: number;
  relatedFindings: string[];
  relatedThreats: string[];
  relatedControls: string[];
  noCdsCompliance: string;
}

interface UnifiedSecurityView {
  timestamp: string;
  overallScore: number;
  trend: string;
  criticalItems: Array<{
    type: string;
    id: string;
    title: string;
    severity: string;
    status: string;
    requiresApproval: boolean;
  }>;
  pendingApprovals: number;
  activeThreats: number;
  openFindings: number;
  healingControls: number;
  actionableInsights: ActionableInsight[];
  noCdsCompliance: string;
}

export default function CloudSecurity() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: statsData, refetch: refetchStats } = useQuery<{ stats: CloudSecurityStats }>({
    queryKey: ["/api/cloud-security/stats"]
  });

  const { data: scoreData, refetch: refetchScore } = useQuery<{ score: SecurityPostureScore }>({
    queryKey: ["/api/cloud-security/score"]
  });

  const { data: findingsData, refetch: refetchFindings } = useQuery<{ findings: SecurityFinding[] }>({
    queryKey: ["/api/cloud-security/findings"]
  });

  const { data: threatsData, refetch: refetchThreats } = useQuery<{ threats: ThreatIntelligence[] }>({
    queryKey: ["/api/cloud-security/threats"]
  });

  const { data: controlsData, refetch: refetchControls } = useQuery<{ controls: SelfHealingControl[] }>({
    queryKey: ["/api/cloud-security/controls"]
  });

  const { data: approvalsData, refetch: refetchApprovals } = useQuery<{ approvals: PendingApproval[] }>({
    queryKey: ["/api/cloud-security/approvals"]
  });

  const { data: unifiedViewData, refetch: refetchUnifiedView } = useQuery<{ view: UnifiedSecurityView }>({
    queryKey: ["/api/cloud-security/unified-view"]
  });

  const remediateMutation = useMutation({
    mutationFn: async (findingId: string) => {
      return apiRequest("POST", `/api/cloud-security/findings/${findingId}/remediate`, {});
    },
    onSuccess: () => {
      toast({ title: "Remediation Started", description: "Auto-remediation in progress" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const predictThreatMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/cloud-security/threats/predict", {});
    },
    onSuccess: () => {
      toast({ title: "Threat Predicted", description: "New threat intelligence generated" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/threats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const updateControlStateMutation = useMutation({
    mutationFn: async ({ controlId, state }: { controlId: string; state: string }) => {
      return apiRequest("PATCH", `/api/cloud-security/controls/${controlId}/state`, { state });
    },
    onSuccess: () => {
      toast({ title: "Control Updated", description: "Self-healing control state changed" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/controls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const triggerResponseMutation = useMutation({
    mutationFn: async ({ controlId, responseId }: { controlId: string; responseId: string }) => {
      return apiRequest("POST", `/api/cloud-security/controls/${controlId}/trigger`, { responseId });
    },
    onSuccess: () => {
      toast({ title: "Response Triggered", description: "Adaptive response executed" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/controls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const calculateScoreMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/cloud-security/score", {});
    },
    onSuccess: () => {
      toast({ title: "Score Calculated", description: "Security posture score updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/score"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      return apiRequest("POST", `/api/cloud-security/approvals/${approvalId}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: "Action Approved", description: "Security action will be executed" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      return apiRequest("POST", `/api/cloud-security/approvals/${approvalId}/reject`, {});
    },
    onSuccess: () => {
      toast({ title: "Action Rejected", description: "Security action has been declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-security/unified-view"] });
    }
  });

  const stats = statsData?.stats;
  const score = scoreData?.score;
  const findings = findingsData?.findings || [];
  const threats = threatsData?.threats || [];
  const controls = controlsData?.controls || [];
  const approvals = approvalsData?.approvals || [];
  const unifiedView = unifiedViewData?.view;

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress": return <Clock className="h-4 w-4 text-blue-500" />;
      case "pending": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "degrading": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getControlStateBadge = (state: string) => {
    switch (state) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "learning": return <Badge className="bg-blue-500">Learning</Badge>;
      case "standby": return <Badge className="bg-yellow-500">Standby</Badge>;
      default: return <Badge variant="secondary">Disabled</Badge>;
    }
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchScore();
    refetchFindings();
    refetchThreats();
    refetchControls();
    refetchApprovals();
    refetchUnifiedView();
    toast({ title: "Refreshed", description: "All security data refreshed" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Cloud Security Posture
          </h1>
          <p className="text-muted-foreground mt-1">
            Proactive security with automated remediation and self-healing controls
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => calculateScoreMutation.mutate()} disabled={calculateScoreMutation.isPending} data-testid="button-calculate-score">
            <Activity className="h-4 w-4 mr-2" />
            Recalculate Score
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          NO-CDS COMPLIANCE: All security operations are for INFRASTRUCTURE PROTECTION only. This system does NOT make clinical decisions or provide treatment recommendations.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card data-testid="card-posture-score">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Posture Score</CardTitle>
            {score && getTrendIcon(score.trend)}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-posture-score">{stats?.overallPosture || 0}%</div>
            <Progress value={stats?.overallPosture || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card data-testid="card-critical-findings">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Critical Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500" data-testid="text-critical-findings">{stats?.criticalFindings || 0}</div>
            <p className="text-xs text-muted-foreground" data-testid="text-auto-remediable">{stats?.autoRemediableCount || 0} auto-remediable</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-threats">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-threats">{stats?.activeThreats || 0}</div>
            <p className="text-xs text-muted-foreground" data-testid="text-zero-day">{stats?.zeroDayThreats || 0} zero-day</p>
          </CardContent>
        </Card>

        <Card data-testid="card-self-healing">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Self-Healing</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500" data-testid="text-active-controls">{stats?.activeControls || 0}</div>
            <p className="text-xs text-muted-foreground">active controls</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-approvals">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500" data-testid="text-pending-approvals">{stats?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">actions awaiting review</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">Approvals</TabsTrigger>
          <TabsTrigger value="findings" data-testid="tab-findings">Findings</TabsTrigger>
          <TabsTrigger value="threats" data-testid="tab-threats">Threats</TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-controls">Self-Healing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {score && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Security Posture Score
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={score.overall >= 80 ? "default" : score.overall >= 60 ? "secondary" : "destructive"}>
                      {score.overall}%
                    </Badge>
                    {getTrendIcon(score.trend)}
                    <span className="text-sm capitalize">{score.trend}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-muted/50">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">{score.noCdsCompliance}</AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(score.categories).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-lg font-bold">{value}%</span>
                      </div>
                      <Progress value={value} className="h-2" />
                    </div>
                  ))}
                </div>

                {score.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {score.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {findings.slice(0, 5).map(finding => (
                      <div key={finding.id} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(finding.remediationStatus)}
                          <span className="text-sm font-medium">{finding.title}</span>
                        </div>
                        <Badge variant={getRiskBadgeVariant(finding.riskLevel)}>{finding.riskLevel}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Threat Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {threats.slice(0, 3).map(threat => (
                      <div key={threat.id} className="p-2 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{threat.threatName}</span>
                          {threat.isZeroDay && <Badge className="bg-red-500">Zero-Day</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Likelihood: {(threat.predictedLikelihood * 100).toFixed(0)}% | Impact: {(threat.predictedImpact * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => predictThreatMutation.mutate()}
                  disabled={predictThreatMutation.isPending}
                  data-testid="button-predict-threat"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Threat Prediction
                </Button>
              </CardContent>
            </Card>
          </div>

          {unifiedView && unifiedView.actionableInsights.length > 0 && (
            <Card data-testid="card-actionable-insights">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Actionable Insights
                </CardTitle>
                <CardDescription>AI-generated recommendations for improving security posture</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="bg-muted/50 mb-4">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">NO-CDS: Insights are for security operations only, not clinical recommendations.</AlertDescription>
                </Alert>
                <div className="space-y-3">
                  {unifiedView.actionableInsights.map(insight => (
                    <div key={insight.id} className="p-3 rounded-lg border" data-testid={`insight-${insight.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={insight.category === "critical" ? "destructive" : insight.category === "warning" ? "secondary" : "outline"} data-testid={`badge-insight-category-${insight.id}`}>
                            {insight.category}
                          </Badge>
                          <span className="font-medium" data-testid={`text-insight-title-${insight.id}`}>{insight.title}</span>
                        </div>
                        <Badge variant="outline" data-testid={`badge-insight-improvement-${insight.id}`}>+{insight.potentialImprovement}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2" data-testid={`text-insight-description-${insight.id}`}>{insight.description}</p>
                      <div className="text-xs text-muted-foreground" data-testid={`text-insight-action-${insight.id}`}>
                        <span className="font-medium">Suggested Action:</span> {insight.suggestedAction}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Pending Security Approvals
              </CardTitle>
              <CardDescription>Critical security actions requiring manual review and approval</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="bg-muted/50 mb-4">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">NO-CDS COMPLIANCE: All approvals are for infrastructure security actions only, not clinical decisions.</AlertDescription>
              </Alert>

              {approvals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-approvals">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p data-testid="text-no-pending-approvals">No pending approvals. All security actions are up to date.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {approvals.map(approval => (
                      <Card key={approval.id} data-testid={`card-approval-${approval.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base" data-testid={`text-approval-title-${approval.id}`}>{approval.title}</CardTitle>
                            <div className="flex gap-2">
                              <Badge variant={getRiskBadgeVariant(approval.riskLevel)} data-testid={`badge-approval-risk-${approval.id}`}>{approval.riskLevel}</Badge>
                              <Badge variant="outline" className="capitalize">{approval.actionType.replace(/_/g, " ")}</Badge>
                            </div>
                          </div>
                          <CardDescription>{approval.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Requested by:</span>
                              <span className="ml-2">{approval.requestedBy}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expires:</span>
                              <span className="ml-2">{new Date(approval.expiresAt).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="text-sm font-medium mb-1">Impact Assessment</div>
                            <p className="text-sm text-muted-foreground">{approval.impactAssessment}</p>
                          </div>

                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="text-sm font-medium mb-1">Rollback Plan</div>
                            <p className="text-sm text-muted-foreground">{approval.rollbackPlan}</p>
                          </div>

                          <Separator />

                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() => rejectMutation.mutate(approval.id)}
                              disabled={rejectMutation.isPending}
                              data-testid={`button-reject-${approval.id}`}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              onClick={() => approveMutation.mutate(approval.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${approval.id}`}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve & Execute
                            </Button>
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

        <TabsContent value="findings" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {findings.map(finding => (
                <Card key={finding.id} data-testid={`card-finding-${finding.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(finding.remediationStatus)}
                        <CardTitle className="text-lg" data-testid={`text-finding-title-${finding.id}`}>{finding.title}</CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getRiskBadgeVariant(finding.riskLevel)} data-testid={`badge-risk-${finding.id}`}>{finding.riskLevel}</Badge>
                        {finding.autoRemediable && <Badge variant="outline" data-testid={`badge-auto-remediable-${finding.id}`}>Auto-remediable</Badge>}
                      </div>
                    </div>
                    <CardDescription>{finding.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{finding.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Category:</span>
                        <span className="ml-2 capitalize">{finding.category.replace(/_/g, " ")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <span className="ml-2">{finding.source}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Impact:</span>
                        <span className="ml-2">{finding.estimatedImpact}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Detected:</span>
                        <span className="ml-2">{new Date(finding.detectedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-muted-foreground">Affected Resources:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {finding.affectedResources.map((res, idx) => (
                          <Badge key={idx} variant="outline">{res}</Badge>
                        ))}
                      </div>
                    </div>

                    {finding.remediationSteps.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Remediation Steps:</span>
                        <ol className="list-decimal list-inside text-sm mt-1">
                          {finding.remediationSteps.slice(0, 3).map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {finding.autoRemediable && finding.remediationStatus === "pending" && (
                      <Button
                        onClick={() => remediateMutation.mutate(finding.id)}
                        disabled={remediateMutation.isPending}
                        data-testid={`button-remediate-${finding.id}`}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Auto-Remediate
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="threats" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              onClick={() => predictThreatMutation.mutate()}
              disabled={predictThreatMutation.isPending}
              data-testid="button-predict-threat-tab"
            >
              <Brain className="h-4 w-4 mr-2" />
              Generate AI Threat Prediction
            </Button>
          </div>

          <ScrollArea className="h-[450px]">
            <div className="space-y-4">
              {threats.map(threat => (
                <Card key={threat.id} data-testid={`card-threat-${threat.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-threat-name-${threat.id}`}>
                        <Target className="h-5 w-5" />
                        {threat.threatName}
                      </CardTitle>
                      <div className="flex gap-2">
                        {threat.isZeroDay && <Badge className="bg-red-500">Zero-Day</Badge>}
                        <Badge variant={getRiskBadgeVariant(threat.severity)}>{threat.severity}</Badge>
                      </div>
                    </div>
                    <CardDescription className="capitalize">{threat.category.replace(/_/g, " ")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{threat.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <p className="text-sm">{threat.description}</p>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg border text-center">
                        <div className="text-2xl font-bold">{(threat.predictedLikelihood * 100).toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">Likelihood</div>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <div className="text-2xl font-bold">{(threat.predictedImpact * 100).toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">Impact</div>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <div className="text-lg font-bold">{threat.timeToExploit}</div>
                        <div className="text-xs text-muted-foreground">Time to Exploit</div>
                      </div>
                    </div>

                    {threat.indicators.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Threat Indicators:</span>
                        <div className="space-y-1 mt-1">
                          {threat.indicators.map((ind, idx) => (
                            <div key={idx} className="text-xs p-2 rounded border">
                              <span className="font-medium uppercase">{ind.type}:</span> {ind.value}
                              <span className="text-muted-foreground ml-2">({(ind.confidence * 100).toFixed(0)}% confidence)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {threat.mitigationRecommendations.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Mitigation Recommendations:</span>
                        <ul className="list-disc list-inside text-sm mt-1">
                          {threat.mitigationRecommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {controls.map(control => (
                <Card key={control.id} data-testid={`card-control-${control.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-control-name-${control.id}`}>
                        <Zap className="h-5 w-5" />
                        {control.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {getControlStateBadge(control.currentState)}
                        <Badge variant="outline" data-testid={`badge-effectiveness-${control.id}`}>
                          Effectiveness: {(control.effectivenessScore * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{control.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{control.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">Control State:</span>
                      <Select
                        value={control.currentState}
                        onValueChange={(value) => updateControlStateMutation.mutate({ controlId: control.id, state: value })}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-control-state-${control.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="learning">Learning</SelectItem>
                          <SelectItem value="standby">Standby</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className="text-sm font-medium">Trigger Conditions:</span>
                      <div className="space-y-1 mt-1">
                        {control.triggerConditions.map(cond => (
                          <div key={cond.id} className="text-xs p-2 rounded border">
                            <span className="font-medium">{cond.type}</span>: {cond.description}
                            <span className="text-muted-foreground ml-2">(threshold: {cond.threshold}, window: {cond.windowMinutes}m)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <span className="text-sm font-medium">Adaptive Responses:</span>
                      <div className="space-y-2 mt-2">
                        {control.adaptiveResponses.map(response => (
                          <div key={response.id} className="p-3 rounded-lg border flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{response.name}</span>
                                <Badge variant={getRiskBadgeVariant(response.severity)}>{response.severity}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Action: {response.action} | Executions: {response.currentExecutions}/{response.maxExecutions} | Cooldown: {response.cooldownMinutes}m
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => triggerResponseMutation.mutate({ controlId: control.id, responseId: response.id })}
                              disabled={response.currentExecutions >= response.maxExecutions || triggerResponseMutation.isPending}
                              data-testid={`button-trigger-${response.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Trigger
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {control.lastTriggered && (
                      <div className="text-xs text-muted-foreground">
                        Last triggered: {new Date(control.lastTriggered).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
