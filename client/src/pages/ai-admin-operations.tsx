import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Shield,
  Calendar,
  AlertTriangle,
  FileCheck,
  MessageSquareText,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  Activity,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

interface AdminStats {
  eligibilityVerifications: {
    total: number;
    verified: number;
    pending: number;
    denied: number;
    expired: number;
  };
  schedulingOptimization: {
    avgGapReduction: number;
    avgWaitTimeReduction: number;
    slotsOptimized: number;
  };
  noShowPredictions: {
    totalPredictions: number;
    highRiskAppointments: number;
    avgAccuracy: number;
  };
  priorAuthorizations: {
    total: number;
    approved: number;
    pending: number;
    denied: number;
    avgProcessingTime: number;
  };
  inquiryRouting: {
    totalRouted: number;
    avgRoutingTime: number;
    satisfactionRate: number;
  };
  billingAnalysis: {
    claimsAnalyzed: number;
    issuesIdentified: number;
    revenueRecovered: number;
  };
}

interface EligibilityRecord {
  id: string;
  patientId: string;
  patientName: string;
  insurerName: string;
  status: string;
  memberId: string;
  copay?: number;
  deductible?: number;
  deductibleMet?: number;
  verifiedAt: string;
}

interface NoShowPrediction {
  id: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  providerName: string;
  riskScore: number;
  riskCategory: string;
  recommendations: string[];
  aiExplanation: string;
}

interface PriorAuthorization {
  id: string;
  patientName: string;
  serviceType: string;
  insurerName: string;
  status: string;
  urgency: string;
  aiComplianceScore: number;
  aiSuggestedDocuments: string[];
  aiRecommendations: string[];
  createdAt: string;
}

interface PatientInquiry {
  id: string;
  patientName: string;
  channel: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  routedTo: { teamMemberName: string; role: string; department: string };
  aiRoutingRationale: string;
  suggestedResponse?: string;
  estimatedResponseTime: string;
  createdAt: string;
}

interface ClaimAnalysis {
  id: string;
  claimId: string;
  patientName: string;
  providerName: string;
  dateOfService: string;
  totalAmount: number;
  status: string;
  aiAnalysis: {
    errorRisk: number;
    optimizationScore: number;
    issues: { type: string; severity: string; description: string; suggestedFix?: string }[];
    recommendations: { type: string; priority: string; description: string; potentialRevenue?: number }[];
    revenueImpact: number;
  };
}

function StatCard({ title, value, subValue, icon: Icon, trend }: { title: string; value: string | number; subValue?: string; icon: any; trend?: "up" | "down" | "neutral" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subValue && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {trend === "down" && <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />}
            {subValue}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function getRiskBadgeVariant(risk: string) {
  switch (risk) {
    case "low": return "secondary";
    case "medium": return "outline";
    case "high": return "destructive";
    case "very_high": return "destructive";
    default: return "secondary";
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "verified":
    case "approved":
    case "resolved": return "default";
    case "pending":
    case "submitted":
    case "routed": return "secondary";
    case "denied":
    case "expired": return "destructive";
    default: return "outline";
  }
}

function getPriorityBadgeVariant(priority: string) {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "destructive";
    case "medium": return "outline";
    case "low": return "secondary";
    default: return "outline";
  }
}

export default function AIAdminOperations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [eligibilityForm, setEligibilityForm] = useState({ patientId: "", patientName: "", insurerId: "", insurerName: "", memberId: "", groupNumber: "" });
  const [inquiryForm, setInquiryForm] = useState({ patientId: "", patientName: "", channel: "portal", subject: "", content: "" });
  const [priorAuthForm, setPriorAuthForm] = useState({ patientId: "", patientName: "", providerId: "provider-001", providerName: "Dr. Sarah Smith", insurerId: "", insurerName: "", serviceType: "", procedureCode: "", diagnosisCode: "", urgency: "routine", notes: "" });

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ success: boolean; data: AdminStats }>({
    queryKey: ["/api/admin-operations/stats"]
  });

  const { data: eligibilityData, isLoading: eligibilityLoading, refetch: refetchEligibility } = useQuery<{ success: boolean; data: EligibilityRecord[] }>({
    queryKey: ["/api/admin-operations/eligibility"]
  });

  const { data: noShowData, isLoading: noShowLoading, refetch: refetchNoShow } = useQuery<{ success: boolean; data: NoShowPrediction[] }>({
    queryKey: ["/api/admin-operations/no-show/predictions"]
  });

  const { data: priorAuthData, isLoading: priorAuthLoading, refetch: refetchPriorAuth } = useQuery<{ success: boolean; data: PriorAuthorization[] }>({
    queryKey: ["/api/admin-operations/prior-auth"]
  });

  const { data: inquiriesData, isLoading: inquiriesLoading, refetch: refetchInquiries } = useQuery<{ success: boolean; data: PatientInquiry[] }>({
    queryKey: ["/api/admin-operations/inquiries"]
  });

  const { data: claimsData, isLoading: claimsLoading, refetch: refetchClaims } = useQuery<{ success: boolean; data: ClaimAnalysis[] }>({
    queryKey: ["/api/admin-operations/claims/analyses"]
  });

  const verifyEligibilityMutation = useMutation({
    mutationFn: async (data: typeof eligibilityForm) => {
      return apiRequest("POST", "/api/admin-operations/eligibility/verify", data);
    },
    onSuccess: () => {
      toast({ title: "Insurance Verified", description: "Eligibility verification complete." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/eligibility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/stats"] });
      setEligibilityForm({ patientId: "", patientName: "", insurerId: "", insurerName: "", memberId: "", groupNumber: "" });
    },
    onError: () => {
      toast({ title: "Verification Failed", description: "Could not verify insurance eligibility.", variant: "destructive" });
    }
  });

  const routeInquiryMutation = useMutation({
    mutationFn: async (data: typeof inquiryForm) => {
      return apiRequest("POST", "/api/admin-operations/inquiries/route", data);
    },
    onSuccess: () => {
      toast({ title: "Inquiry Routed", description: "Patient inquiry has been routed to the appropriate team member." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/stats"] });
      setInquiryForm({ patientId: "", patientName: "", channel: "portal", subject: "", content: "" });
    },
    onError: () => {
      toast({ title: "Routing Failed", description: "Could not route patient inquiry.", variant: "destructive" });
    }
  });

  const createPriorAuthMutation = useMutation({
    mutationFn: async (data: typeof priorAuthForm) => {
      return apiRequest("POST", "/api/admin-operations/prior-auth/create", data);
    },
    onSuccess: () => {
      toast({ title: "Prior Auth Created", description: "Prior authorization request has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/prior-auth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/stats"] });
      setPriorAuthForm({ patientId: "", patientName: "", providerId: "provider-001", providerName: "Dr. Sarah Smith", insurerId: "", insurerName: "", serviceType: "", procedureCode: "", diagnosisCode: "", urgency: "routine", notes: "" });
    },
    onError: () => {
      toast({ title: "Creation Failed", description: "Could not create prior authorization.", variant: "destructive" });
    }
  });

  const submitPriorAuthMutation = useMutation({
    mutationFn: async (authId: string) => {
      return apiRequest("POST", `/api/admin-operations/prior-auth/${authId}/submit`);
    },
    onSuccess: () => {
      toast({ title: "Prior Auth Submitted", description: "Prior authorization has been submitted to insurer." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/prior-auth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-operations/stats"] });
    },
    onError: () => {
      toast({ title: "Submission Failed", description: "Could not submit prior authorization.", variant: "destructive" });
    }
  });

  const stats = statsData?.data;
  const eligibilityRecords = eligibilityData?.data || [];
  const noShowPredictions = noShowData?.data || [];
  const priorAuths = priorAuthData?.data || [];
  const inquiries = inquiriesData?.data || [];
  const claimAnalyses = claimsData?.data || [];

  const handleRefreshAll = () => {
    refetchStats();
    refetchEligibility();
    refetchNoShow();
    refetchPriorAuth();
    refetchInquiries();
    refetchClaims();
    toast({ title: "Data Refreshed", description: "All administrative data has been refreshed." });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-8 w-8 text-primary" />
            AI Administrative Operations
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered automation for healthcare administrative tasks</p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline" data-testid="button-refresh-all">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Disclaimer:</strong> AI-generated administrative insights are for informational and operational purposes only. They do not constitute clinical decision support, medical advice, or treatment recommendations.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="eligibility" data-testid="tab-eligibility">Insurance</TabsTrigger>
          <TabsTrigger value="no-show" data-testid="tab-no-show">No-Show</TabsTrigger>
          <TabsTrigger value="prior-auth" data-testid="tab-prior-auth">Prior Auth</TabsTrigger>
          <TabsTrigger value="inquiries" data-testid="tab-inquiries">Inquiries</TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
          <TabsTrigger value="scheduling" data-testid="tab-scheduling">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  title="Insurance Verifications"
                  value={stats.eligibilityVerifications.total}
                  subValue={`${stats.eligibilityVerifications.verified} verified`}
                  icon={Shield}
                  trend="up"
                />
                <StatCard
                  title="Schedule Optimization"
                  value={`${stats.schedulingOptimization.avgGapReduction.toFixed(0)}%`}
                  subValue="Avg gap reduction"
                  icon={Calendar}
                  trend="up"
                />
                <StatCard
                  title="High-Risk Appointments"
                  value={stats.noShowPredictions.highRiskAppointments}
                  subValue={`${stats.noShowPredictions.avgAccuracy}% prediction accuracy`}
                  icon={AlertTriangle}
                  trend="neutral"
                />
                <StatCard
                  title="Prior Authorizations"
                  value={stats.priorAuthorizations.total}
                  subValue={`${stats.priorAuthorizations.pending} pending`}
                  icon={FileCheck}
                />
                <StatCard
                  title="Inquiries Routed"
                  value={stats.inquiryRouting.totalRouted}
                  subValue={`${stats.inquiryRouting.satisfactionRate}% satisfaction`}
                  icon={MessageSquareText}
                  trend="up"
                />
                <StatCard
                  title="Revenue Impact"
                  value={`$${stats.billingAnalysis.revenueRecovered.toLocaleString()}`}
                  subValue={`${stats.billingAnalysis.issuesIdentified} issues found`}
                  icon={DollarSign}
                  trend="up"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      High-Risk No-Shows
                    </CardTitle>
                    <CardDescription>Appointments with elevated no-show risk</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      {noShowLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : noShowPredictions.filter(p => p.riskCategory === "high" || p.riskCategory === "very_high").length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No high-risk appointments</p>
                      ) : (
                        <div className="space-y-3">
                          {noShowPredictions
                            .filter(p => p.riskCategory === "high" || p.riskCategory === "very_high")
                            .slice(0, 5)
                            .map((prediction) => (
                              <div key={prediction.id} className="p-3 rounded-lg border bg-card" data-testid={`card-no-show-${prediction.id}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{prediction.patientName}</span>
                                  <Badge variant={getRiskBadgeVariant(prediction.riskCategory)}>
                                    {(prediction.riskScore * 100).toFixed(0)}% risk
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {prediction.appointmentType} • {prediction.appointmentDate} at {prediction.appointmentTime}
                                </p>
                                {prediction.recommendations[0] && (
                                  <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    {prediction.recommendations[0]}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-blue-500" />
                      Pending Prior Authorizations
                    </CardTitle>
                    <CardDescription>Authorizations awaiting decision</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      {priorAuthLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : priorAuths.filter(p => p.status === "pending" || p.status === "submitted" || p.status === "draft").length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No pending authorizations</p>
                      ) : (
                        <div className="space-y-3">
                          {priorAuths
                            .filter(p => p.status === "pending" || p.status === "submitted" || p.status === "draft")
                            .slice(0, 5)
                            .map((auth) => (
                              <div key={auth.id} className="p-3 rounded-lg border bg-card" data-testid={`card-prior-auth-${auth.id}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{auth.patientName}</span>
                                  <Badge variant={getStatusBadgeVariant(auth.status)}>{auth.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{auth.serviceType}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Progress value={auth.aiComplianceScore} className="flex-1 h-2" />
                                  <span className="text-xs text-muted-foreground">{auth.aiComplianceScore}%</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="eligibility" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Verify Insurance Eligibility
                </CardTitle>
                <CardDescription>AI-powered insurance verification using EDI 270/271</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Patient ID</Label>
                    <Input id="patientId" value={eligibilityForm.patientId} onChange={(e) => setEligibilityForm({ ...eligibilityForm, patientId: e.target.value })} placeholder="patient-001" data-testid="input-eligibility-patient-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Patient Name</Label>
                    <Input id="patientName" value={eligibilityForm.patientName} onChange={(e) => setEligibilityForm({ ...eligibilityForm, patientName: e.target.value })} placeholder="John Smith" data-testid="input-eligibility-patient-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insurerId">Insurer ID</Label>
                    <Input id="insurerId" value={eligibilityForm.insurerId} onChange={(e) => setEligibilityForm({ ...eligibilityForm, insurerId: e.target.value })} placeholder="ins-bcbs" data-testid="input-eligibility-insurer-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insurerName">Insurer Name</Label>
                    <Input id="insurerName" value={eligibilityForm.insurerName} onChange={(e) => setEligibilityForm({ ...eligibilityForm, insurerName: e.target.value })} placeholder="Blue Cross Blue Shield" data-testid="input-eligibility-insurer-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberId">Member ID</Label>
                    <Input id="memberId" value={eligibilityForm.memberId} onChange={(e) => setEligibilityForm({ ...eligibilityForm, memberId: e.target.value })} placeholder="MEM123456789" data-testid="input-eligibility-member-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupNumber">Group Number (Optional)</Label>
                    <Input id="groupNumber" value={eligibilityForm.groupNumber} onChange={(e) => setEligibilityForm({ ...eligibilityForm, groupNumber: e.target.value })} placeholder="GRP-5678" data-testid="input-eligibility-group" />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => verifyEligibilityMutation.mutate(eligibilityForm)} disabled={verifyEligibilityMutation.isPending || !eligibilityForm.patientId || !eligibilityForm.memberId} className="w-full" data-testid="button-verify-eligibility">
                  {verifyEligibilityMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                  Verify Eligibility
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Verifications</CardTitle>
                <CardDescription>Latest insurance eligibility checks</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {eligibilityLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : eligibilityRecords.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No verification records</p>
                  ) : (
                    <div className="space-y-3">
                      {eligibilityRecords.map((record) => (
                        <div key={record.id} className="p-3 rounded-lg border bg-card" data-testid={`card-eligibility-${record.id}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{record.patientName}</span>
                            <Badge variant={getStatusBadgeVariant(record.status)}>{record.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{record.insurerName} • {record.memberId}</p>
                          {record.copay !== undefined && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Copay: ${record.copay}</span>
                              <span>Deductible: ${record.deductibleMet || 0}/${record.deductible || 0}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="no-show" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                No-Show Risk Predictions
              </CardTitle>
              <CardDescription>AI-powered prediction of patient appointment attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {noShowLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : noShowPredictions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No predictions available</p>
                ) : (
                  <div className="space-y-4">
                    {noShowPredictions.map((prediction) => (
                      <Card key={prediction.id} className="bg-card" data-testid={`card-prediction-${prediction.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{prediction.patientName}</CardTitle>
                            <Badge variant={getRiskBadgeVariant(prediction.riskCategory)} className="text-sm">
                              {(prediction.riskScore * 100).toFixed(0)}% Risk
                            </Badge>
                          </div>
                          <CardDescription>
                            {prediction.appointmentType} with {prediction.providerName}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {prediction.appointmentDate}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {prediction.appointmentTime}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-sm font-medium mb-2 flex items-center gap-1">
                              <Sparkles className="h-4 w-4 text-primary" />
                              AI Analysis
                            </p>
                            <p className="text-sm text-muted-foreground">{prediction.aiExplanation}</p>
                          </div>
                          {prediction.recommendations.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-1">Recommendations:</p>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {prediction.recommendations.map((rec, i) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prior-auth" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Create Prior Authorization
                </CardTitle>
                <CardDescription>AI-assisted prior authorization preparation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paPatientId">Patient ID</Label>
                    <Input id="paPatientId" value={priorAuthForm.patientId} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, patientId: e.target.value })} placeholder="patient-001" data-testid="input-prior-auth-patient-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paPatientName">Patient Name</Label>
                    <Input id="paPatientName" value={priorAuthForm.patientName} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, patientName: e.target.value })} placeholder="John Smith" data-testid="input-prior-auth-patient-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paInsurerId">Insurer ID</Label>
                    <Input id="paInsurerId" value={priorAuthForm.insurerId} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, insurerId: e.target.value })} placeholder="ins-aetna" data-testid="input-prior-auth-insurer-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paInsurerName">Insurer Name</Label>
                    <Input id="paInsurerName" value={priorAuthForm.insurerName} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, insurerName: e.target.value })} placeholder="Aetna" data-testid="input-prior-auth-insurer-name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Input id="serviceType" value={priorAuthForm.serviceType} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, serviceType: e.target.value })} placeholder="MRI - Lumbar Spine" data-testid="input-prior-auth-service" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="procedureCode">CPT Code</Label>
                    <Input id="procedureCode" value={priorAuthForm.procedureCode} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, procedureCode: e.target.value })} placeholder="72148" data-testid="input-prior-auth-cpt" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diagnosisCode">ICD-10 Code</Label>
                    <Input id="diagnosisCode" value={priorAuthForm.diagnosisCode} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, diagnosisCode: e.target.value })} placeholder="M54.5" data-testid="input-prior-auth-icd" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency</Label>
                    <Select value={priorAuthForm.urgency} onValueChange={(v) => setPriorAuthForm({ ...priorAuthForm, urgency: v })}>
                      <SelectTrigger data-testid="select-prior-auth-urgency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="emergent">Emergent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Clinical Notes</Label>
                  <Textarea id="notes" value={priorAuthForm.notes} onChange={(e) => setPriorAuthForm({ ...priorAuthForm, notes: e.target.value })} placeholder="Brief clinical justification..." rows={3} data-testid="textarea-prior-auth-notes" />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => createPriorAuthMutation.mutate(priorAuthForm)} disabled={createPriorAuthMutation.isPending || !priorAuthForm.patientId || !priorAuthForm.serviceType} className="w-full" data-testid="button-create-prior-auth">
                  {createPriorAuthMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                  Create Authorization Request
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Authorization Requests</CardTitle>
                <CardDescription>Prior authorization status and AI recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px]">
                  {priorAuthLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                    </div>
                  ) : priorAuths.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No authorization requests</p>
                  ) : (
                    <div className="space-y-4">
                      {priorAuths.map((auth) => (
                        <Card key={auth.id} className="bg-card" data-testid={`card-auth-${auth.id}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{auth.patientName}</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant={getPriorityBadgeVariant(auth.urgency)}>{auth.urgency}</Badge>
                                <Badge variant={getStatusBadgeVariant(auth.status)}>{auth.status}</Badge>
                              </div>
                            </div>
                            <CardDescription>{auth.serviceType} • {auth.insurerName}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">AI Compliance Score:</span>
                              <Progress value={auth.aiComplianceScore} className="flex-1 h-2" />
                              <span className="text-sm font-medium">{auth.aiComplianceScore}%</span>
                            </div>
                            {auth.aiRecommendations.length > 0 && (
                              <div className="p-2 rounded bg-muted/50">
                                <p className="text-xs font-medium mb-1">AI Recommendations:</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {auth.aiRecommendations.slice(0, 2).map((rec, i) => (
                                    <li key={i}>• {rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {auth.status === "draft" && (
                              <Button size="sm" onClick={() => submitPriorAuthMutation.mutate(auth.id)} disabled={submitPriorAuthMutation.isPending} className="w-full mt-2" data-testid={`button-submit-auth-${auth.id}`}>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Submit to Insurer
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5" />
                  Route Patient Inquiry
                </CardTitle>
                <CardDescription>AI-powered intelligent routing to care team</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inqPatientId">Patient ID</Label>
                    <Input id="inqPatientId" value={inquiryForm.patientId} onChange={(e) => setInquiryForm({ ...inquiryForm, patientId: e.target.value })} placeholder="patient-001" data-testid="input-inquiry-patient-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inqPatientName">Patient Name</Label>
                    <Input id="inqPatientName" value={inquiryForm.patientName} onChange={(e) => setInquiryForm({ ...inquiryForm, patientName: e.target.value })} placeholder="Jane Doe" data-testid="input-inquiry-patient-name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <Select value={inquiryForm.channel} onValueChange={(v) => setInquiryForm({ ...inquiryForm, channel: v })}>
                    <SelectTrigger data-testid="select-inquiry-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portal">Patient Portal</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={inquiryForm.subject} onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })} placeholder="Question about my prescription" data-testid="input-inquiry-subject" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Message Content</Label>
                  <Textarea id="content" value={inquiryForm.content} onChange={(e) => setInquiryForm({ ...inquiryForm, content: e.target.value })} placeholder="Patient inquiry details..." rows={4} data-testid="textarea-inquiry-content" />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => routeInquiryMutation.mutate(inquiryForm)} disabled={routeInquiryMutation.isPending || !inquiryForm.patientId || !inquiryForm.subject} className="w-full" data-testid="button-route-inquiry">
                  {routeInquiryMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquareText className="h-4 w-4 mr-2" />}
                  Route Inquiry
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Routed Inquiries</CardTitle>
                <CardDescription>AI-routed patient communications</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {inquiriesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
                    </div>
                  ) : inquiries.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No inquiries</p>
                  ) : (
                    <div className="space-y-4">
                      {inquiries.map((inquiry) => (
                        <Card key={inquiry.id} className="bg-card" data-testid={`card-inquiry-${inquiry.id}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{inquiry.patientName}</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{inquiry.category}</Badge>
                                <Badge variant={getPriorityBadgeVariant(inquiry.priority)}>{inquiry.priority}</Badge>
                              </div>
                            </div>
                            <CardDescription>{inquiry.subject}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>Routed to: <strong>{inquiry.routedTo.teamMemberName}</strong> ({inquiry.routedTo.role})</span>
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-primary" />
                                AI Routing Rationale
                              </p>
                              <p className="text-xs text-muted-foreground">{inquiry.aiRoutingRationale}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Est. response: {inquiry.estimatedResponseTime}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Billing & Claims Analysis
              </CardTitle>
              <CardDescription>AI-powered billing optimization and error detection</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {claimsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
                  </div>
                ) : claimAnalyses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No claim analyses available</p>
                ) : (
                  <div className="space-y-4">
                    {claimAnalyses.map((claim) => (
                      <Card key={claim.id} className="bg-card" data-testid={`card-claim-${claim.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{claim.patientName}</CardTitle>
                              <CardDescription>Claim #{claim.claimId} • {claim.dateOfService}</CardDescription>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">${claim.totalAmount.toLocaleString()}</p>
                              <Badge variant={getStatusBadgeVariant(claim.status)}>{claim.status}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Error Risk</p>
                              <p className="text-lg font-bold">{(claim.aiAnalysis.errorRisk * 100).toFixed(0)}%</p>
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Optimization</p>
                              <p className="text-lg font-bold">{claim.aiAnalysis.optimizationScore}%</p>
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Revenue Impact</p>
                              <p className="text-lg font-bold text-green-600">${claim.aiAnalysis.revenueImpact}</p>
                            </div>
                          </div>
                          {claim.aiAnalysis.issues.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Issues Detected
                              </p>
                              <div className="space-y-2">
                                {claim.aiAnalysis.issues.map((issue, i) => (
                                  <div key={i} className="p-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant={issue.severity === "high" || issue.severity === "critical" ? "destructive" : "outline"} className="text-xs">{issue.type}</Badge>
                                      <Badge variant="outline" className="text-xs">{issue.severity}</Badge>
                                    </div>
                                    <p className="text-sm">{issue.description}</p>
                                    {issue.suggestedFix && (
                                      <p className="text-xs text-muted-foreground mt-1">Fix: {issue.suggestedFix}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {claim.aiAnalysis.recommendations.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                                <Sparkles className="h-4 w-4 text-primary" />
                                AI Recommendations
                              </p>
                              <ul className="space-y-1">
                                {claim.aiAnalysis.recommendations.map((rec, i) => (
                                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                      {rec.description}
                                      {rec.potentialRevenue && <span className="text-green-600 ml-1">(+${rec.potentialRevenue})</span>}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Schedule Optimization
                </CardTitle>
                <CardDescription>AI-powered scheduling analytics and gap reduction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {stats && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.schedulingOptimization.avgGapReduction.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Gap Reduction</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.schedulingOptimization.avgWaitTimeReduction.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Wait Time Saved</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold">{stats.schedulingOptimization.slotsOptimized}</p>
                      <p className="text-xs text-muted-foreground">Slots Optimized</p>
                    </div>
                  </div>
                )}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    How Schedule Optimization Works
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>AI analyzes provider schedules to identify gaps and inefficiencies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>Recommends slot moves, buffer adjustments, and double-booking opportunities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>Reduces patient wait times and improves provider utilization</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>Considers no-show risk factors when suggesting optimizations</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Optimization Available:</strong> Submit a provider's schedule for AI analysis to receive personalized recommendations for reducing gaps and improving patient flow.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optimization History</CardTitle>
                <CardDescription>Past schedule optimization analyses</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {statsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                    </div>
                  ) : stats?.schedulingOptimization.slotsOptimized === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-2">No optimizations yet</p>
                      <p className="text-sm text-muted-foreground">Submit a schedule for AI-powered optimization analysis to see results here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg border bg-card" data-testid="card-optimization-summary">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Recent Optimization</span>
                          <Badge variant="default">Active</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Gap Reduction</p>
                            <p className="font-medium text-green-600">{stats?.schedulingOptimization.avgGapReduction.toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Wait Time Saved</p>
                            <p className="font-medium text-blue-600">{stats?.schedulingOptimization.avgWaitTimeReduction.toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Slots Analyzed</p>
                            <p className="font-medium">{stats?.schedulingOptimization.slotsOptimized}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Utilization Improvement</p>
                            <p className="font-medium">+17%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
