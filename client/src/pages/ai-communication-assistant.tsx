import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  FileText,
  TrendingUp,
  ArrowRight,
  Inbox,
  Mail,
  Building2,
  UserCheck,
  AlertCircle,
  Sparkles,
  Calendar,
  Pill,
  Activity,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
} from "lucide-react";

interface TriageResult {
  id: string;
  inquiryId: string;
  patientId: string;
  patientName: string;
  originalMessage: string;
  category: string;
  urgencyLevel: "low" | "normal" | "high" | "urgent" | "critical";
  routingDecision: {
    department: string;
    departmentCode: string;
    assignedTo?: string;
    assignedRole: string;
    escalationRequired: boolean;
    escalationReason?: string;
  };
  keyTopics: string[];
  sentiment: string;
  suggestedResponseTime: string;
  aiConfidence: number;
  triageNotes: string[];
  noCdsDisclaimer: string;
  createdAt: string;
  status: "pending" | "routed" | "in_progress" | "resolved";
}

interface PatientInquiry {
  id: string;
  patientId: string;
  patientName: string;
  subject: string;
  message: string;
  receivedAt: string;
  priority: string;
  category: string;
}

interface AIResponseDraft {
  id: string;
  inquiryId: string;
  patientId: string;
  subject: string;
  body: string;
  tone: string;
  confidenceScore: number;
  suggestedActions: string[];
  requiresProviderReview: boolean;
  reviewReason?: string;
  safetyDisclaimer: string;
  generatedAt: string;
  status: "draft" | "approved" | "sent" | "rejected";
}

interface ProactiveMessage {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  subject: string;
  body: string;
  scheduledFor: string;
  channel: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  messageTypes: string[];
  avgResponseTime: string;
  staffCount: number;
}

interface DashboardData {
  stats: {
    pendingInquiries: number;
    draftedResponses: number;
    scheduledMessages: number;
    triageQueue: number;
    avgResponseTime: string;
    aiDraftAccuracy: number;
  };
  recentInquiries: PatientInquiry[];
  recentDrafts: AIResponseDraft[];
  recentTriages: TriageResult[];
  upcomingMessages: ProactiveMessage[];
  departments: Department[];
}

function UrgencyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    critical: "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100",
  };
  return <Badge className={colors[level] || colors.normal}>{level}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
    routed: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: ArrowRight },
    in_progress: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Activity },
    resolved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
    draft: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: FileText },
    approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: ThumbsUp },
    sent: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Send },
    rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: ThumbsDown },
    scheduled: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Calendar },
  };
  const config = configs[status] || configs.pending;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {status.replace("_", " ")}
    </Badge>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    concerned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    frustrated: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    distressed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return <Badge className={colors[sentiment] || colors.neutral}>{sentiment}</Badge>;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <Progress value={value} className="h-2 flex-1" />
      <span className={`text-xs font-medium ${value >= 80 ? "text-green-600" : value >= 60 ? "text-yellow-600" : "text-red-600"}`}>
        {value}%
      </span>
    </div>
  );
}

export default function AICommunicationAssistant() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/ai-patient-communication/dashboard"],
  });

  const triageMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/inquiries/${inquiryId}/triage`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/dashboard"] });
    },
  });

  const draftResponseMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/inquiries/${inquiryId}/draft-response`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/dashboard"] });
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/response-drafts/${draftId}/approve`, { approvedBy: "Current User" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/dashboard"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = dashboard?.stats;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Communication Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Draft responses, triage messages, and manage patient communications
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription>
          This AI assistant provides communication suggestions for informational purposes only. 
          All drafted responses should be reviewed by qualified healthcare staff before sending. 
          Triage recommendations are not clinical decision support.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-pending-inquiries">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending Inquiries</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingInquiries || 0}</div>
            <p className="text-xs text-muted-foreground">Messages awaiting response</p>
          </CardContent>
        </Card>

        <Card data-testid="card-triage-queue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Triage Queue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.triageQueue || 0}</div>
            <p className="text-xs text-muted-foreground">Messages pending routing</p>
          </CardContent>
        </Card>

        <Card data-testid="card-drafted-responses">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Drafted Responses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.draftedResponses || 0}</div>
            <p className="text-xs text-muted-foreground">AI drafts awaiting review</p>
          </CardContent>
        </Card>

        <Card data-testid="card-ai-accuracy">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">AI Draft Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.aiDraftAccuracy || 0}%</div>
            <Progress value={stats?.aiDraftAccuracy || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="inquiries" data-testid="tab-inquiries">Patient Inquiries</TabsTrigger>
          <TabsTrigger value="triage" data-testid="tab-triage">Message Triage</TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">Response Drafts</TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">Scheduled Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  Recent Patient Inquiries
                </CardTitle>
                <CardDescription>Latest messages from patients</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {dashboard?.recentInquiries?.map((inquiry) => (
                      <div key={inquiry.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{inquiry.patientName}</span>
                          <Badge variant="outline">{inquiry.category}</Badge>
                        </div>
                        <p className="text-sm font-medium">{inquiry.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{inquiry.message}</p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(inquiry.receivedAt).toLocaleString()}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => triageMutation.mutate(inquiry.id)}
                              disabled={triageMutation.isPending}
                              data-testid={`button-triage-${inquiry.id}`}
                            >
                              <RotateCw className="h-3 w-3 mr-1" />
                              Triage
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => draftResponseMutation.mutate(inquiry.id)}
                              disabled={draftResponseMutation.isPending}
                              data-testid={`button-draft-${inquiry.id}`}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Draft
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Recent Triage Results
                </CardTitle>
                <CardDescription>AI-assisted message routing</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {dashboard?.recentTriages?.map((triage) => (
                      <div key={triage.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{triage.patientName}</span>
                          <div className="flex gap-2">
                            <UrgencyBadge level={triage.urgencyLevel} />
                            <StatusBadge status={triage.status} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{triage.routingDecision.department}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-muted-foreground">{triage.routingDecision.assignedRole}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {triage.keyTopics.slice(0, 3).map((topic, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                        <ConfidenceBar value={triage.aiConfidence} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Departments
                </CardTitle>
                <CardDescription>Available routing destinations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {dashboard?.departments?.map((dept) => (
                      <div key={dept.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <div className="font-medium">{dept.name}</div>
                          <div className="text-xs text-muted-foreground">{dept.description}</div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{dept.code}</Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {dept.avgResponseTime}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Scheduled Messages
                </CardTitle>
                <CardDescription>Proactive patient outreach</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {dashboard?.upcomingMessages?.map((msg) => (
                      <div key={msg.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{msg.patientName}</span>
                          <StatusBadge status={msg.status} />
                        </div>
                        <p className="text-sm">{msg.subject}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(msg.scheduledFor).toLocaleString()}
                          </span>
                          <Badge variant="outline">{msg.type.replace("_", " ")}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                All Patient Inquiries
              </CardTitle>
              <CardDescription>
                Incoming patient messages requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {dashboard?.recentInquiries?.map((inquiry) => (
                    <Card key={inquiry.id} className="border">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{inquiry.patientName}</h4>
                            <p className="text-sm text-muted-foreground">ID: {inquiry.patientId}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{inquiry.category}</Badge>
                            <UrgencyBadge level={inquiry.priority} />
                          </div>
                        </div>
                        <Separator />
                        <div>
                          <p className="font-medium">{inquiry.subject}</p>
                          <p className="text-sm text-muted-foreground mt-1">{inquiry.message}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            Received: {new Date(inquiry.receivedAt).toLocaleString()}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => triageMutation.mutate(inquiry.id)}
                              disabled={triageMutation.isPending}
                            >
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Auto-Triage
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => draftResponseMutation.mutate(inquiry.id)}
                              disabled={draftResponseMutation.isPending}
                            >
                              <Sparkles className="h-4 w-4 mr-1" />
                              Generate Draft
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triage" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Triage Disclaimer</AlertTitle>
            <AlertDescription>
              AI-assisted triage recommendations are for routing purposes only and do not constitute 
              clinical decision support. All routing decisions should be verified by qualified staff.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Message Triage Queue
              </CardTitle>
              <CardDescription>
                AI-analyzed messages with routing recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {dashboard?.recentTriages?.map((triage) => (
                    <Card key={triage.id} className="border">
                      <CardContent className="pt-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{triage.patientName}</h4>
                            <p className="text-sm text-muted-foreground">Category: {triage.category}</p>
                          </div>
                          <div className="flex gap-2">
                            <UrgencyBadge level={triage.urgencyLevel} />
                            <SentimentBadge sentiment={triage.sentiment} />
                            <StatusBadge status={triage.status} />
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm italic">"{triage.originalMessage}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              Routing Decision
                            </h5>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Department:</span>
                                <span className="font-medium">{triage.routingDecision.department}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Assigned Role:</span>
                                <span>{triage.routingDecision.assignedRole}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Response Time:</span>
                                <span>{triage.suggestedResponseTime}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium mb-2">Key Topics</h5>
                            <div className="flex flex-wrap gap-1">
                              {triage.keyTopics.map((topic, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {triage.routingDecision.escalationRequired && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Escalation Required</AlertTitle>
                            <AlertDescription>
                              {triage.routingDecision.escalationReason}
                            </AlertDescription>
                          </Alert>
                        )}

                        {triage.triageNotes.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-2">Triage Notes</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {triage.triageNotes.map((note, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>
                                  {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex-1 max-w-[200px]">
                            <div className="text-xs text-muted-foreground mb-1">AI Confidence</div>
                            <ConfidenceBar value={triage.aiConfidence} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <UserCheck className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                            <Button size="sm">
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Confirm Route
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                AI-Generated Response Drafts
              </CardTitle>
              <CardDescription>
                Review and approve AI-drafted responses before sending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {dashboard?.recentDrafts?.map((draft) => (
                    <Card key={draft.id} className="border">
                      <CardContent className="pt-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{draft.subject}</h4>
                            <p className="text-sm text-muted-foreground">
                              Patient ID: {draft.patientId}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{draft.tone}</Badge>
                            <StatusBadge status={draft.status} />
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
                        </div>

                        <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {draft.safetyDisclaimer}
                          </AlertDescription>
                        </Alert>

                        {draft.requiresProviderReview && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Provider Review Required</AlertTitle>
                            <AlertDescription>
                              {draft.reviewReason || "This response requires provider review before sending"}
                            </AlertDescription>
                          </Alert>
                        )}

                        {draft.suggestedActions.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-2">Suggested Actions</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {draft.suggestedActions.map((action, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex-1 max-w-[200px]">
                            <div className="text-xs text-muted-foreground mb-1">Confidence Score</div>
                            <ConfidenceBar value={draft.confidenceScore} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveDraftMutation.mutate(draft.id)}
                              disabled={approveDraftMutation.isPending || draft.status !== "draft"}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="default" disabled={draft.status !== "approved"}>
                              <Send className="h-4 w-4 mr-1" />
                              Send
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduled Proactive Messages
              </CardTitle>
              <CardDescription>
                Appointment reminders, follow-ups, and wellness check-ins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {dashboard?.upcomingMessages?.map((msg) => (
                    <Card key={msg.id} className="border">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{msg.patientName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {msg.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{msg.channel}</Badge>
                            <StatusBadge status={msg.status} />
                          </div>
                        </div>

                        <div>
                          <p className="font-medium">{msg.subject}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{msg.body}</p>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {new Date(msg.scheduledFor).toLocaleString()}
                            </span>
                            <UrgencyBadge level={msg.priority} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              Cancel
                            </Button>
                            <Button size="sm">
                              <Send className="h-4 w-4 mr-1" />
                              Send Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
