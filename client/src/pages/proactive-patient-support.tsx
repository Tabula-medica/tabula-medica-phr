import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  AlertTriangle, 
  Heart,
  MessageSquare,
  Calendar,
  Activity,
  Target,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  Smartphone,
  Globe,
  TrendingUp,
  TrendingDown,
  Brain,
  Lightbulb,
  Shield
} from "lucide-react";

interface SupportNeed {
  id: string;
  type: string;
  priority: string;
  description: string;
  identifiedDate: string;
  dueDate?: string;
  status: string;
  aiReasoning: string;
}

interface WellnessProgram {
  id: string;
  name: string;
  category: string;
  description: string;
  eligibilityCriteria: string[];
  duration: string;
  enrollmentStatus?: string;
  matchScore: number;
}

interface OutreachRecord {
  id: string;
  type: string;
  channel: string;
  subject: string;
  message: string;
  sentAt: string;
  status: string;
  responseReceived?: boolean;
  scheduledFollowUp?: string;
}

interface PatientSupportProfile {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  conditions: string[];
  riskLevel: string;
  supportScore: number;
  lastVisit?: string;
  nextAppointment?: string;
  communicationHistory: {
    lastContact: string;
    responseRate: number;
    preferredChannel: string;
  };
  feedbackTrend: string;
  supportNeeds: SupportNeed[];
  eligiblePrograms: WellnessProgram[];
  outreachHistory: OutreachRecord[];
}

interface OutreachCampaign {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  targetedPatients: number;
  sentCount: number;
  responseCount: number;
  createdAt: string;
}

interface ProactiveSupportStats {
  totalPatientsMonitored: number;
  highRiskPatients: number;
  pendingOutreach: number;
  activeFollowUps: number;
  programEnrollments: number;
  responseRate: number;
  careGapsIdentified: number;
  careGapsResolved: number;
  recentAdverseEvents: number;
  outreachSentToday: number;
}

export default function ProactivePatientSupport() {
  const { toast } = useToast();

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; data: ProactiveSupportStats }>({
    queryKey: ["/api/proactive-support/stats"]
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery<{ success: boolean; data: PatientSupportProfile[] }>({
    queryKey: ["/api/proactive-support/patients"]
  });

  const { data: needsSupportData } = useQuery<{ success: boolean; data: PatientSupportProfile[] }>({
    queryKey: ["/api/proactive-support/patients/needs-support"]
  });

  const { data: campaignsData } = useQuery<{ success: boolean; data: OutreachCampaign[] }>({
    queryKey: ["/api/proactive-support/campaigns"]
  });

  const { data: programsData } = useQuery<{ success: boolean; data: WellnessProgram[] }>({
    queryKey: ["/api/proactive-support/wellness-programs"]
  });

  const generateOutreachMutation = useMutation({
    mutationFn: async ({ patientId, outreachType }: { patientId: string; outreachType: string }) => {
      return apiRequest("POST", `/api/proactive-support/patients/${patientId}/outreach`, { outreachType });
    },
    onSuccess: () => {
      toast({ title: "Outreach message generated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-support"] });
    },
    onError: () => {
      toast({ title: "Failed to generate outreach", variant: "destructive" });
    }
  });

  const analyzePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return apiRequest("POST", `/api/proactive-support/patients/${patientId}/analyze`);
    },
    onSuccess: () => {
      toast({ title: "Patient analysis complete" });
    },
    onError: () => {
      toast({ title: "Failed to analyze patient", variant: "destructive" });
    }
  });

  const stats = statsData?.data;
  const patients = patientsData?.data || [];
  const needsSupport = needsSupportData?.data || [];
  const campaigns = campaignsData?.data || [];
  const programs = programsData?.data || [];

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "high": return <Badge className="bg-orange-500">High Risk</Badge>;
      case "moderate": return <Badge className="bg-yellow-500">Moderate</Badge>;
      case "low": return <Badge variant="secondary">Low Risk</Badge>;
      default: return <Badge variant="outline">{riskLevel}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "identified": return <Badge variant="outline">Identified</Badge>;
      case "outreach_sent": return <Badge className="bg-blue-500">Outreach Sent</Badge>;
      case "in_progress": return <Badge className="bg-purple-500">In Progress</Badge>;
      case "resolved": return <Badge variant="default">Resolved</Badge>;
      case "declined": return <Badge variant="secondary">Declined</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <Smartphone className="h-4 w-4" />;
      case "phone": return <Phone className="h-4 w-4" />;
      case "portal": return <Globe className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getFeedbackTrendIcon = (trend: string) => {
    switch (trend) {
      case "positive": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case "concerning": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <ArrowRight className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Heart className="h-8 w-8 text-primary" />
          Proactive Patient Support
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-driven identification of patients who may benefit from additional support, personalized outreach, and wellness programs
        </p>
      </div>

      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>AI Insights Disclaimer:</strong> Recommendations are generated by AI for informational purposes only. They do not constitute clinical decision support or medical advice. All clinical decisions must be made by qualified healthcare professionals.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">Patients</TabsTrigger>
          <TabsTrigger value="outreach" data-testid="tab-outreach">Outreach</TabsTrigger>
          <TabsTrigger value="programs" data-testid="tab-programs">Programs</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="card-monitored-patients">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Patients Monitored</p>
                        <p className="text-3xl font-bold">{stats.totalPatientsMonitored}</p>
                      </div>
                      <Users className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-high-risk">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">High Risk Patients</p>
                        <p className="text-3xl font-bold text-orange-600">{stats.highRiskPatients}</p>
                      </div>
                      <AlertTriangle className="h-10 w-10 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-pending-outreach">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Outreach</p>
                        <p className="text-3xl font-bold">{stats.pendingOutreach}</p>
                      </div>
                      <Send className="h-10 w-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-response-rate">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Response Rate</p>
                        <p className="text-3xl font-bold">{(stats.responseRate * 100).toFixed(0)}%</p>
                      </div>
                      <Activity className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Follow-ups</p>
                        <p className="text-3xl font-bold">{stats.activeFollowUps}</p>
                      </div>
                      <Clock className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Care Gaps</p>
                        <p className="text-3xl font-bold">{stats.careGapsIdentified}</p>
                      </div>
                      <Target className="h-10 w-10 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Adverse Events</p>
                        <p className="text-3xl font-bold text-red-600">{stats.recentAdverseEvents}</p>
                      </div>
                      <Shield className="h-10 w-10 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Sent Today</p>
                        <p className="text-3xl font-bold">{stats.outreachSentToday}</p>
                      </div>
                      <MessageSquare className="h-10 w-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Patients Needing Attention
                  </CardTitle>
                  <CardDescription>Patients identified by AI as potentially benefiting from additional support</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {needsSupport.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                        <p className="text-muted-foreground">All patients are up to date with their care</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {needsSupport.slice(0, 5).map((patient) => (
                          <div key={patient.id} className="p-4 rounded-lg border bg-card" data-testid={`card-patient-${patient.id}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{patient.patientName}</span>
                                  {getRiskBadge(patient.riskLevel)}
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    {getFeedbackTrendIcon(patient.feedbackTrend)}
                                    {patient.feedbackTrend}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {patient.conditions.slice(0, 3).join(", ")}
                                </p>
                                {patient.supportNeeds.filter(n => n.status === "identified").slice(0, 2).map((need) => (
                                  <div key={need.id} className="flex items-center gap-2 text-sm">
                                    {getPriorityBadge(need.priority)}
                                    <span>{need.description}</span>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => generateOutreachMutation.mutate({ 
                                  patientId: patient.patientId, 
                                  outreachType: "care_gap" 
                                })}
                                disabled={generateOutreachMutation.isPending}
                                data-testid={`button-outreach-${patient.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Send Outreach
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Support Profiles</CardTitle>
              <CardDescription>All patients being monitored for proactive support opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {patientsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patients.map((patient) => (
                      <div key={patient.id} className="p-6 rounded-lg border bg-card" data-testid={`card-patient-detail-${patient.id}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-lg font-medium">{patient.patientName}</h4>
                              {getRiskBadge(patient.riskLevel)}
                              <span className="text-sm text-muted-foreground">Age {patient.age}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {patient.conditions.join(", ")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => analyzePatientMutation.mutate(patient.patientId)}
                              disabled={analyzePatientMutation.isPending}
                              data-testid={`button-analyze-${patient.id}`}
                            >
                              <Brain className="h-4 w-4 mr-1" />
                              Analyze
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => generateOutreachMutation.mutate({ 
                                patientId: patient.patientId, 
                                outreachType: "initial" 
                              })}
                              disabled={generateOutreachMutation.isPending}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Outreach
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Support Score</p>
                            <p className="text-lg font-bold">{(patient.supportScore * 100).toFixed(0)}%</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Response Rate</p>
                            <p className="text-lg font-bold">{(patient.communicationHistory.responseRate * 100).toFixed(0)}%</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Preferred Channel</p>
                            <div className="flex items-center gap-1">
                              {getChannelIcon(patient.communicationHistory.preferredChannel)}
                              <span className="text-sm capitalize">{patient.communicationHistory.preferredChannel}</span>
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Feedback Trend</p>
                            <div className="flex items-center gap-1">
                              {getFeedbackTrendIcon(patient.feedbackTrend)}
                              <span className="text-sm capitalize">{patient.feedbackTrend}</span>
                            </div>
                          </div>
                        </div>

                        {patient.supportNeeds.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-2">Support Needs</p>
                            <div className="space-y-2">
                              {patient.supportNeeds.map((need) => (
                                <div key={need.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {getPriorityBadge(need.priority)}
                                      {getStatusBadge(need.status)}
                                      <Badge variant="outline" className="capitalize">{need.type.replace("_", " ")}</Badge>
                                    </div>
                                    <p className="text-sm">{need.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1 italic">{need.aiReasoning}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {patient.eligiblePrograms.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Eligible Wellness Programs</p>
                            <div className="flex flex-wrap gap-2">
                              {patient.eligiblePrograms.map((program) => (
                                <Badge key={program.id} variant="outline" className="flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  {program.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Recent Outreach Activity
              </CardTitle>
              <CardDescription>AI-generated personalized messages sent to patients</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {patients.flatMap(p => p.outreachHistory).length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No outreach messages sent yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Generate outreach from the Patients tab</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patients.flatMap(p => 
                      p.outreachHistory.map(o => ({ ...o, patientName: p.patientName, patientId: p.patientId }))
                    ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()).map((outreach) => (
                      <div key={outreach.id} className="p-4 rounded-lg border bg-card" data-testid={`card-outreach-${outreach.id}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(outreach.channel)}
                            <span className="font-medium">{outreach.patientName}</span>
                            <Badge variant="outline" className="capitalize">{outreach.type.replace("_", " ")}</Badge>
                            <Badge variant={outreach.status === "responded" ? "default" : outreach.status === "delivered" ? "secondary" : "outline"}>
                              {outreach.status}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(outreach.sentAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-1">{outreach.subject}</p>
                        <p className="text-sm text-muted-foreground">{outreach.message}</p>
                        {outreach.responseReceived && (
                          <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Response received
                          </div>
                        )}
                        {outreach.scheduledFollowUp && (
                          <div className="mt-2 flex items-center gap-1 text-sm text-blue-600">
                            <Calendar className="h-4 w-4" />
                            Follow-up: {new Date(outreach.scheduledFollowUp).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Wellness Programs
              </CardTitle>
              <CardDescription>Available wellness and preventative care programs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {programs.map((program) => (
                  <div key={program.id} className="p-6 rounded-lg border bg-card" data-testid={`card-program-${program.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-lg">{program.name}</h4>
                        <Badge variant="outline" className="capitalize mt-1">{program.category.replace("_", " ")}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Match Score</p>
                        <p className="text-xl font-bold text-green-600">{(program.matchScore * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{program.description}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{program.duration}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Eligibility Criteria:</p>
                      <div className="flex flex-wrap gap-1">
                        {program.eligibilityCriteria.map((criteria, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{criteria}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Outreach Campaigns
              </CardTitle>
              <CardDescription>Organized outreach initiatives for patient groups</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No active campaigns</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="p-6 rounded-lg border bg-card" data-testid={`card-campaign-${campaign.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-medium text-lg">{campaign.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">{campaign.type.replace("_", " ")}</Badge>
                            <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              {getChannelIcon(campaign.channel)}
                              {campaign.channel}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-2xl font-bold">{campaign.targetedPatients}</p>
                          <p className="text-xs text-muted-foreground">Targeted</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-2xl font-bold text-blue-600">{campaign.sentCount}</p>
                          <p className="text-xs text-muted-foreground">Sent</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-2xl font-bold text-green-600">{campaign.responseCount}</p>
                          <p className="text-xs text-muted-foreground">Responses</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">
                          Response rate: {campaign.sentCount > 0 ? ((campaign.responseCount / campaign.sentCount) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How AI Proactive Support Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-4">
                  <Brain className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">1. Identify</h4>
                  <p className="text-sm text-muted-foreground">
                    AI analyzes health data, communication patterns, and feedback to identify patients needing support.
                  </p>
                </div>
                <div className="text-center p-4">
                  <Lightbulb className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">2. Recommend</h4>
                  <p className="text-sm text-muted-foreground">
                    Wellness programs and preventative care opportunities are matched to each patient.
                  </p>
                </div>
                <div className="text-center p-4">
                  <Send className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">3. Outreach</h4>
                  <p className="text-sm text-muted-foreground">
                    Personalized messages are generated and sent through preferred communication channels.
                  </p>
                </div>
                <div className="text-center p-4">
                  <Calendar className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">4. Follow-up</h4>
                  <p className="text-sm text-muted-foreground">
                    Automated follow-ups ensure patients with adverse events or specific conditions receive timely care.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
