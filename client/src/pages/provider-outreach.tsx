import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Calendar,
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Play,
  Pause,
  Trash2,
  Eye,
  Sparkles,
  FileText,
  Target,
  Bell,
  Activity,
  Loader2,
} from "lucide-react";

interface OutreachStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCheckIns: number;
  activeCheckIns: number;
  totalMessagesThisMonth: number;
  responseRate: number;
}

interface OutreachTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
  variables: string[];
  aiPersonalizationPrompt?: string;
  recommendedChannel: string;
  recommendedTiming?: string;
  targetAudience?: string;
  isSystemTemplate: boolean;
  usageCount: number;
  successRate?: number;
}

interface OutreachCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  targetCriteria: string;
  communicationType: string;
  channel: string;
  priority: string;
  useAiPersonalization: boolean;
  totalTargetPatients: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesOpened: number;
  responsesReceived: number;
  createdAt: string;
}

interface ScheduledCheckIn {
  id: string;
  patientId: string;
  checkInType: string;
  frequency: string;
  title: string;
  description?: string;
  questions: any[];
  nextScheduledAt: string;
  lastCompletedAt?: string;
  completionCount: number;
  isActive: boolean;
}

interface OutreachCandidate {
  patientId: string;
  patientName: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export default function ProviderOutreachPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [isCreateCheckInOpen, setIsCreateCheckInOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OutreachTemplate | null>(null);
  const [previewMessage, setPreviewMessage] = useState<{ subject: string; body: string } | null>(null);
  const [selectedCriteria, setSelectedCriteria] = useState("");
  const [candidates, setCandidates] = useState<OutreachCandidate[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery<OutreachStats>({
    queryKey: ["/api/provider-outreach/stats"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<OutreachTemplate[]>({
    queryKey: ["/api/provider-outreach/templates"],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<OutreachCampaign[]>({
    queryKey: ["/api/provider-outreach/campaigns"],
  });

  const { data: checkIns, isLoading: checkInsLoading } = useQuery<ScheduledCheckIn[]>({
    queryKey: ["/api/provider-outreach/check-ins"],
  });

  const { data: dueCheckIns } = useQuery<ScheduledCheckIn[]>({
    queryKey: ["/api/provider-outreach/due-check-ins"],
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/provider-outreach/campaigns", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-outreach/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-outreach/stats"] });
      setIsCreateCampaignOpen(false);
      toast({ title: "Campaign Created", description: "Your outreach campaign has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create campaign.", variant: "destructive" });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/provider-outreach/campaigns/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-outreach/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-outreach/stats"] });
      toast({ title: "Campaign Updated", description: "Campaign status has been updated." });
    },
  });

  const identifyCandidatesMutation = useMutation({
    mutationFn: async (criteria: string) => {
      const res = await apiRequest("POST", "/api/provider-outreach/identify-candidates", { criteria });
      return res.json();
    },
    onSuccess: (data) => {
      setCandidates(data);
      toast({ title: "Candidates Identified", description: `Found ${data.length} patients matching criteria.` });
    },
  });

  const generateMessageMutation = useMutation({
    mutationFn: async ({ patientId, templateId }: { patientId: string; templateId: string }) => {
      const res = await apiRequest("POST", "/api/provider-outreach/generate-message", { patientId, templateId });
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewMessage({ subject: data.subject, body: data.body });
    },
  });

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Paused</Badge>;
      case "draft":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Draft</Badge>;
      case "completed":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Medium</Badge>;
      case "low":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getCheckInTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      adherence: "bg-purple-500/10 text-purple-600",
      symptom_monitoring: "bg-orange-500/10 text-orange-600",
      post_visit: "bg-blue-500/10 text-blue-600",
      wellness: "bg-green-500/10 text-green-600",
      care_plan_progress: "bg-indigo-500/10 text-indigo-600",
    };
    return <Badge className={colors[type] || "bg-gray-500/10 text-gray-600"}>{type.replace(/_/g, " ")}</Badge>;
  };

  return (
    <div className="flex-1 overflow-auto p-6" data-testid="provider-outreach-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="page-title">Patient Outreach</h1>
            <p className="text-muted-foreground">AI-powered automated patient communication and check-ins</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateCheckInOpen} onOpenChange={setIsCreateCheckInOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-create-checkin">
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule Check-In
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Schedule Patient Check-In</DialogTitle>
                  <DialogDescription>Create an automated check-in for a patient</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-outreach-patient-id">Patient ID</Label>
                    <Input id="provider-outreach-patient-id" placeholder="Enter patient ID" data-testid="input-patient-id" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-outreach-check-in-type">Check-In Type</Label>
                    <Select>
                      <SelectTrigger id="provider-outreach-check-in-type" data-testid="select-checkin-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adherence">Medication Adherence</SelectItem>
                        <SelectItem value="symptom_monitoring">Symptom Monitoring</SelectItem>
                        <SelectItem value="post_visit">Post-Visit Follow-Up</SelectItem>
                        <SelectItem value="wellness">Wellness Check</SelectItem>
                        <SelectItem value="care_plan_progress">Care Plan Progress</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-outreach-frequency">Frequency</Label>
                    <Select>
                      <SelectTrigger id="provider-outreach-frequency" data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One-time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="provider-outreach-use-ai-personalization">Use AI personalization</Label>
                    <Switch id="provider-outreach-use-ai-personalization" defaultChecked data-testid="switch-ai-personalization" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateCheckInOpen(false)}>Cancel</Button>
                  <Button data-testid="button-save-checkin">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Check-In
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isCreateCampaignOpen} onOpenChange={setIsCreateCampaignOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-campaign">
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Outreach Campaign</DialogTitle>
                  <DialogDescription>Set up an AI-personalized outreach campaign for your patients</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider-outreach-campaign-name">Campaign Name</Label>
                      <Input id="provider-outreach-campaign-name" placeholder="e.g., Diabetes Care Follow-Up" data-testid="input-campaign-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="provider-outreach-target-criteria">Target Criteria</Label>
                      <Select onValueChange={setSelectedCriteria}>
                        <SelectTrigger id="provider-outreach-target-criteria" data-testid="select-target-criteria">
                          <SelectValue placeholder="Select criteria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_patients">All Patients</SelectItem>
                          <SelectItem value="high_risk">High-Risk Patients</SelectItem>
                          <SelectItem value="chronic_condition">Chronic Condition</SelectItem>
                          <SelectItem value="recent_visit">Recent Visit</SelectItem>
                          <SelectItem value="medication_adherence">Medication Adherence</SelectItem>
                          <SelectItem value="care_gap">Care Gap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-outreach-description">Description</Label>
                    <Textarea id="provider-outreach-description" placeholder="Describe the purpose of this campaign..." data-testid="input-campaign-description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider-outreach-communication-type">Communication Type</Label>
                      <Select>
                        <SelectTrigger id="provider-outreach-communication-type" data-testid="select-communication-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow_up">Follow-Up</SelectItem>
                          <SelectItem value="wellness_check">Wellness Check</SelectItem>
                          <SelectItem value="screening_reminder">Screening Reminder</SelectItem>
                          <SelectItem value="medication_reminder">Medication Reminder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="provider-outreach-channel">Channel</Label>
                      <Select>
                        <SelectTrigger id="provider-outreach-channel" data-testid="select-channel">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_app">In-App Message</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="push_notification">Push Notification</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <FieldCaption>AI Personalization</FieldCaption>
                      <p className="text-sm text-muted-foreground">Let AI personalize messages for each patient</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-campaign-ai" />
                  </div>
                  {selectedCriteria && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => identifyCandidatesMutation.mutate(selectedCriteria)}
                      disabled={identifyCandidatesMutation.isPending}
                      data-testid="button-identify-candidates"
                    >
                      {identifyCandidatesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Target className="w-4 h-4 mr-2" />
                      )}
                      Identify Matching Patients
                    </Button>
                  )}
                  {candidates.length > 0 && (
                    <div className="border rounded-lg p-3">
                      <p className="font-medium mb-2">Matching Patients ({candidates.length})</p>
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {candidates.slice(0, 5).map((c) => (
                            <div key={c.patientId} className="flex items-center justify-between text-sm">
                              <span>{c.patientName}</span>
                              {getPriorityBadge(c.priority)}
                            </div>
                          ))}
                          {candidates.length > 5 && (
                            <p className="text-sm text-muted-foreground">
                              +{candidates.length - 5} more patients
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateCampaignOpen(false)}>Cancel</Button>
                  <Button onClick={() => createCampaignMutation.mutate({
                    name: "New Campaign",
                    targetCriteria: selectedCriteria || "all_patients",
                    communicationType: "follow_up",
                    channel: "in_app",
                    priority: "normal",
                    useAiPersonalization: true,
                  })} data-testid="button-save-campaign">
                    <Send className="w-4 h-4 mr-2" />
                    Create Campaign
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">
              <Send className="w-4 h-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="check-ins" data-testid="tab-check-ins">
              <Calendar className="w-4 h-4 mr-2" />
              Check-Ins
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                  <Send className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-active-campaigns">
                    {statsLoading ? "..." : stats?.activeCampaigns || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {stats?.totalCampaigns || 0} total campaigns
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Active Check-Ins</CardTitle>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-active-checkins">
                    {statsLoading ? "..." : stats?.activeCheckIns || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {stats?.totalCheckIns || 0} total check-ins
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Messages This Month</CardTitle>
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-messages-month">
                    {statsLoading ? "..." : stats?.totalMessagesThisMonth || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Personalized messages sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                  <Activity className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-response-rate">
                    {statsLoading ? "..." : `${stats?.responseRate || 0}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">Patient engagement</p>
                </CardContent>
              </Card>
            </div>

            {(dueCheckIns?.length || 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-orange-500" />
                    Due Check-Ins
                  </CardTitle>
                  <CardDescription>Check-ins that are due or overdue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dueCheckIns?.slice(0, 5).map((checkIn) => (
                      <div
                        key={checkIn.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`due-checkin-${checkIn.id}`}
                      >
                        <div>
                          <p className="font-medium">{checkIn.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Patient: {checkIn.patientId} | {checkIn.checkInType.replace(/_/g, " ")}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Send className="w-4 h-4 mr-1" />
                          Send Reminder
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common outreach tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("campaigns")}>
                    <Target className="w-4 h-4 mr-2" />
                    Create Follow-Up Campaign
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("check-ins")}>
                    <Clock className="w-4 h-4 mr-2" />
                    Schedule Adherence Check-In
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("templates")}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    View AI Message Templates
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Campaigns</CardTitle>
                  <CardDescription>Latest outreach activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {campaignsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : campaigns?.length ? (
                    <div className="space-y-3">
                      {campaigns.slice(0, 3).map((campaign) => (
                        <div key={campaign.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {campaign.messagesSent} messages sent
                            </p>
                          </div>
                          {getCampaignStatusBadge(campaign.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No campaigns yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Outreach Campaigns</CardTitle>
                <CardDescription>Manage your patient outreach campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : campaigns?.length ? (
                  <div className="space-y-4">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="border rounded-lg p-4"
                        data-testid={`campaign-${campaign.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{campaign.name}</h3>
                            <p className="text-sm text-muted-foreground">{campaign.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCampaignStatusBadge(campaign.status)}
                            {campaign.useAiPersonalization && (
                              <Badge variant="outline" className="gap-1">
                                <Sparkles className="w-3 h-3" />
                                AI
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground">Target</p>
                            <p className="font-medium">{campaign.totalTargetPatients} patients</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sent</p>
                            <p className="font-medium">{campaign.messagesSent}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Delivered</p>
                            <p className="font-medium">{campaign.messagesDelivered}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Responses</p>
                            <p className="font-medium">{campaign.responsesReceived}</p>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex gap-2">
                          {campaign.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => updateCampaignMutation.mutate({ id: campaign.id, status: "active" })}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Activate
                            </Button>
                          )}
                          {campaign.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCampaignMutation.mutate({ id: campaign.id, status: "paused" })}
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button
                              size="sm"
                              onClick={() => updateCampaignMutation.mutate({ id: campaign.id, status: "active" })}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Campaigns Yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first outreach campaign to engage patients</p>
                    <Button onClick={() => setIsCreateCampaignOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Campaign
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="check-ins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Check-Ins</CardTitle>
                <CardDescription>Automated patient check-ins for adherence, symptoms, and wellness</CardDescription>
              </CardHeader>
              <CardContent>
                {checkInsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : checkIns?.length ? (
                  <div className="space-y-4">
                    {checkIns.map((checkIn) => (
                      <div
                        key={checkIn.id}
                        className="border rounded-lg p-4"
                        data-testid={`checkin-${checkIn.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{checkIn.title}</h3>
                            <p className="text-sm text-muted-foreground">{checkIn.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCheckInTypeBadge(checkIn.checkInType)}
                            <Badge variant={checkIn.isActive ? "default" : "secondary"}>
                              {checkIn.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground">Patient</p>
                            <p className="font-medium">{checkIn.patientId}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Frequency</p>
                            <p className="font-medium capitalize">{checkIn.frequency}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Next Due</p>
                            <p className="font-medium">
                              {new Date(checkIn.nextScheduledAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Completions</p>
                            <p className="font-medium">{checkIn.completionCount}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            View Responses
                          </Button>
                          <Button size="sm" variant="outline">
                            <Send className="w-4 h-4 mr-1" />
                            Send Now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Check-Ins Scheduled</h3>
                    <p className="text-muted-foreground mb-4">Schedule automated check-ins for your patients</p>
                    <Button onClick={() => setIsCreateCheckInOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule Check-In
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>AI-personalized templates for common communication scenarios</CardDescription>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates?.map((template) => (
                      <Card key={template.id} className="cursor-pointer hover-elevate" data-testid={`template-${template.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {template.isSystemTemplate && (
                              <Badge variant="outline" className="text-xs">System</Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">{template.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                            <Badge variant="outline" className="text-xs">{template.recommendedChannel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {template.recommendedTiming && `Timing: ${template.recommendedTiming}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Used {template.usageCount} times
                          </p>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => setSelectedTemplate(template)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Preview & Use
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{template.name}</DialogTitle>
                                <DialogDescription>{template.description}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <FieldCaption>Subject Template</FieldCaption>
                                  <div className="p-3 bg-muted rounded-lg text-sm">
                                    {template.subjectTemplate}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <FieldCaption>Body Template</FieldCaption>
                                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                                    {template.bodyTemplate}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <FieldCaption>Variables</FieldCaption>
                                  <div className="flex flex-wrap gap-2">
                                    {template.variables.map((v) => (
                                      <Badge key={v} variant="secondary">{`{{${v}}}`}</Badge>
                                    ))}
                                  </div>
                                </div>
                                {template.aiPersonalizationPrompt && (
                                  <div className="space-y-2">
                                    <FieldCaption className="flex items-center gap-2">
                                      <Sparkles className="w-4 h-4" />
                                      AI Personalization Prompt
                                    </FieldCaption>
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                      {template.aiPersonalizationPrompt}
                                    </div>
                                  </div>
                                )}
                                <Separator />
                                <div className="space-y-2">
                                  <FieldCaption>Preview with Patient</FieldCaption>
                                  <div className="flex gap-2">
                                    <Input aria-label="Preview with Patient" placeholder="Enter patient ID" className="flex-1" />
                                    <Button
                                      onClick={() => generateMessageMutation.mutate({
                                        patientId: "patient-1",
                                        templateId: template.id,
                                      })}
                                      disabled={generateMessageMutation.isPending}
                                    >
                                      {generateMessageMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                {previewMessage && (
                                  <div className="border rounded-lg p-4 space-y-3">
                                    <div>
                                      <FieldCaption className="text-xs text-muted-foreground">Subject</FieldCaption>
                                      <p className="font-medium">{previewMessage.subject}</p>
                                    </div>
                                    <div>
                                      <FieldCaption className="text-xs text-muted-foreground">Body</FieldCaption>
                                      <p className="whitespace-pre-wrap text-sm">{previewMessage.body}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <DialogFooter>
                                <Button variant="outline">Clone Template</Button>
                                <Button>
                                  <Send className="w-4 h-4 mr-2" />
                                  Use in Campaign
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
