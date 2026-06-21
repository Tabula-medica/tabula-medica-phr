import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Send,
  Users,
  MessageSquare,
  ClipboardList,
  Play,
  Pause,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Target,
  Mail,
  Bell,
  Activity,
  Sparkles,
  UserCheck,
} from "lucide-react";

interface OutreachCampaign {
  id: string;
  name: string;
  description: string;
  type: string;
  criteria: { id: string; name: string; description: string };
  messageTemplate: string;
  status: "draft" | "active" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  patientsReached: number;
  responsesReceived: number;
}

interface PatientOutreachMessage {
  id: string;
  campaignId: string;
  patientId: string;
  patientName: string;
  type: string;
  subject: string;
  content: string;
  priority: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
  respondedAt?: string;
  responseContent?: string;
}

interface CareTeamTask {
  id: string;
  patientId: string;
  patientName: string;
  assignedTo: string;
  assignedToName: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

interface IdentifiedPatient {
  patientId: string;
  patientName: string;
  reason: string;
  priority: string;
  suggestedOutreachType: string;
  dataPoints: Array<{ label: string; value: string; flag?: string }>;
}

interface OutreachAnalytics {
  totalCampaigns: number;
  activeCampaigns: number;
  messagesSent: number;
  messagesDelivered: number;
  responsesReceived: number;
  responseRate: number;
  tasksCreated: number;
  tasksCompleted: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  read: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  responded: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export default function PatientOutreach() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedPatientForMessage, setSelectedPatientForMessage] = useState<IdentifiedPatient | null>(null);

  const analyticsQuery = useQuery<{ analytics: OutreachAnalytics }>({
    queryKey: ["/api/patient-outreach/analytics"],
  });

  const campaignsQuery = useQuery<{ campaigns: OutreachCampaign[] }>({
    queryKey: ["/api/patient-outreach/campaigns"],
  });

  const messagesQuery = useQuery<{ messages: PatientOutreachMessage[] }>({
    queryKey: ["/api/patient-outreach/messages"],
  });

  const tasksQuery = useQuery<{ tasks: CareTeamTask[] }>({
    queryKey: ["/api/patient-outreach/tasks"],
  });

  const identifiedPatientsQuery = useQuery<{ patients: IdentifiedPatient[] }>({
    queryKey: ["/api/patient-outreach/identify-patients"],
  });

  const updateCampaignStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/patient-outreach/campaigns/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/campaigns"] });
      toast({ title: "Campaign Updated", description: "Campaign status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update campaign.", variant: "destructive" });
    },
  });

  const runCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/patient-outreach/campaigns/${id}/run`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/analytics"] });
      toast({ 
        title: "Campaign Executed", 
        description: `Sent ${data.messagesGenerated} messages and created ${data.tasksCreated} tasks.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run campaign.", variant: "destructive" });
    },
  });

  const generateMessageMutation = useMutation({
    mutationFn: async (patient: IdentifiedPatient) => {
      const context: Record<string, string> = {};
      patient.dataPoints.forEach((dp) => {
        context[dp.label] = dp.value;
      });
      const response = await apiRequest("POST", "/api/patient-outreach/generate-message", {
        patientId: patient.patientId,
        patientName: patient.patientName,
        outreachType: patient.suggestedOutreachType,
        context,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Message Generated", description: data.message.subject });
      setShowGenerateDialog(false);
      setSelectedPatientForMessage(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate message.", variant: "destructive" });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/patient-outreach/tasks/${id}/status`, { status, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outreach/analytics"] });
      toast({ title: "Task Updated", description: "Task status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    },
  });

  const analytics = analyticsQuery.data?.analytics;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Patient Outreach</h1>
          <p className="text-muted-foreground">AI-driven proactive care and automated patient communication</p>
        </div>
      </div>

      <Alert className="mb-6">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>AI-Powered Outreach</AlertTitle>
        <AlertDescription>
          This system uses AI to identify patients needing outreach and generate personalized messages. All outreach is logged for compliance. AI does not provide medical advice.
        </AlertDescription>
      </Alert>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Campaigns</p>
                  <p className="text-2xl font-bold">{analytics.activeCampaigns}</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages Sent</p>
                  <p className="text-2xl font-bold">{analytics.messagesSent}</p>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                  <p className="text-2xl font-bold">{analytics.responseRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="text-2xl font-bold">{analytics.tasksCompleted}/{analytics.tasksCreated}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="campaigns">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns"><Target className="h-4 w-4 mr-2" />Campaigns</TabsTrigger>
          <TabsTrigger value="identify"><UserCheck className="h-4 w-4 mr-2" />Identify Patients</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 mr-2" />Messages</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-2" />Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <div className="space-y-4">
            {campaignsQuery.isLoading ? (
              <p className="text-muted-foreground">Loading campaigns...</p>
            ) : campaignsQuery.data?.campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{campaign.name}</CardTitle>
                      <CardDescription>{campaign.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[campaign.status]}>{campaign.status}</Badge>
                      {campaign.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => updateCampaignStatusMutation.mutate({ id: campaign.id, status: "paused" })} data-testid={`button-pause-${campaign.id}`}>
                          <Pause className="h-4 w-4 mr-1" />Pause
                        </Button>
                      ) : campaign.status === "paused" ? (
                        <Button size="sm" variant="outline" onClick={() => updateCampaignStatusMutation.mutate({ id: campaign.id, status: "active" })} data-testid={`button-resume-${campaign.id}`}>
                          <Play className="h-4 w-4 mr-1" />Resume
                        </Button>
                      ) : null}
                      {campaign.status === "active" && (
                        <Button size="sm" onClick={() => runCampaignMutation.mutate(campaign.id)} disabled={runCampaignMutation.isPending} data-testid={`button-run-${campaign.id}`}>
                          {runCampaignMutation.isPending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                          Run Now
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{campaign.type.replace("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Criteria</p>
                      <p className="font-medium">{campaign.criteria.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Patients Reached</p>
                      <p className="font-medium">{campaign.patientsReached}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Responses</p>
                      <p className="font-medium">{campaign.responsesReceived}</p>
                    </div>
                  </div>
                  {campaign.lastRunAt && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <Clock className="h-3 w-3" />Last run: {new Date(campaign.lastRunAt).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="identify" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI-Identified Patients Needing Outreach
              </CardTitle>
              <CardDescription>
                Patients automatically identified based on care gaps, overdue tasks, and critical flags
              </CardDescription>
            </CardHeader>
            <CardContent>
              {identifiedPatientsQuery.isLoading ? (
                <p className="text-muted-foreground">Analyzing patient data...</p>
              ) : (
                <div className="space-y-4">
                  {identifiedPatientsQuery.data?.patients.map((patient) => (
                    <div key={patient.patientId} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{patient.patientName}</span>
                            <Badge className={PRIORITY_COLORS[patient.priority]}>{patient.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{patient.reason}</p>
                        </div>
                        <Dialog open={showGenerateDialog && selectedPatientForMessage?.patientId === patient.patientId} onOpenChange={(open) => { setShowGenerateDialog(open); if (!open) setSelectedPatientForMessage(null); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setSelectedPatientForMessage(patient)} data-testid={`button-generate-${patient.patientId}`}>
                              <Sparkles className="h-4 w-4 mr-1" />Generate Message
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Generate Personalized Message</DialogTitle>
                              <DialogDescription>
                                AI will generate a personalized {patient.suggestedOutreachType.replace("_", " ")} message for {patient.patientName}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <h4 className="font-medium mb-2">Patient Context:</h4>
                              <div className="space-y-2">
                                {patient.dataPoints.map((dp, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                                    <span className="text-sm">{dp.label}</span>
                                    <span className={`text-sm font-medium ${dp.flag === "critical" ? "text-red-600" : dp.flag === "warning" ? "text-yellow-600" : ""}`}>
                                      {dp.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
                              <Button onClick={() => selectedPatientForMessage && generateMessageMutation.mutate(selectedPatientForMessage)} disabled={generateMessageMutation.isPending} data-testid="button-confirm-generate">
                                {generateMessageMutation.isPending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                                Generate
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {patient.dataPoints.map((dp, idx) => (
                          <div key={idx} className={`px-2 py-1 rounded text-xs ${dp.flag === "critical" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : dp.flag === "warning" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" : "bg-muted"}`}>
                            {dp.label}: {dp.value}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          Suggested: {patient.suggestedOutreachType.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {!identifiedPatientsQuery.data?.patients.length && (
                    <p className="text-center text-muted-foreground py-8">No patients currently identified for outreach.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Outreach Messages</CardTitle>
              <CardDescription>View all sent and scheduled outreach messages</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {messagesQuery.data?.messages.map((message) => (
                    <div key={message.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium">{message.patientName}</span>
                          <p className="text-sm text-muted-foreground">{message.subject}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={PRIORITY_COLORS[message.priority]}>{message.priority}</Badge>
                          <Badge className={STATUS_COLORS[message.status]}>{message.status}</Badge>
                        </div>
                      </div>
                      <p className="text-sm mb-2">{message.content}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Type: {message.type.replace("_", " ")}</span>
                        {message.sentAt && <span>Sent: {new Date(message.sentAt).toLocaleString()}</span>}
                        {message.respondedAt && <span className="text-green-600">Responded: {new Date(message.respondedAt).toLocaleString()}</span>}
                      </div>
                      {message.responseContent && (
                        <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-950 text-sm">
                          <span className="font-medium">Response: </span>{message.responseContent}
                        </div>
                      )}
                    </div>
                  ))}
                  {!messagesQuery.data?.messages.length && (
                    <p className="text-center text-muted-foreground py-8">No outreach messages yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Care Team Tasks</CardTitle>
              <CardDescription>Tasks created from outreach campaigns for complex follow-ups</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {tasksQuery.data?.tasks.map((task) => (
                    <div key={task.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{task.patientName}</span>
                            <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                            <Badge className={STATUS_COLORS[task.status]}>{task.status.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-sm">{task.description}</p>
                        </div>
                        {task.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "in_progress" })} data-testid={`button-start-${task.id}`}>
                            Start
                          </Button>
                        )}
                        {task.status === "in_progress" && (
                          <Button size="sm" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "completed" })} data-testid={`button-complete-${task.id}`}>
                            <CheckCircle className="h-4 w-4 mr-1" />Complete
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Assigned to: {task.assignedToName}</span>
                        <span>Type: {task.type}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">{task.notes}</p>
                      )}
                    </div>
                  ))}
                  {!tasksQuery.data?.tasks.length && (
                    <p className="text-center text-muted-foreground py-8">No care team tasks.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
