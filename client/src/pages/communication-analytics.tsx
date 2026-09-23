import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  AlertTriangle, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  Minus,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  BarChart3,
  Users,
  Activity,
  Shield,
  Bell,
  Monitor,
  LineChart,
  Settings,
  Eye,
  Play,
  Pause,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Download,
  FileText,
  Mail,
  MessagesSquare
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SentimentResult {
  score: number;
  label: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
  confidence: number;
  emotionalTone: string[];
}

interface DetectedConcern {
  id: string;
  type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
  suggestedAction?: string;
}

interface UrgentFlag {
  id: string;
  reason: string;
  urgencyLevel: "urgent" | "critical";
  category: string;
  recommendedResponse: string;
  responseTimeframe: string;
  escalationPath?: string;
}

interface CommunicationAnalysis {
  messageId: string;
  patientId: string;
  patientName?: string;
  analyzedAt: string;
  sentiment: SentimentResult;
  concerns: DetectedConcern[];
  urgentFlags: UrgentFlag[];
  keyTopics: string[];
  patientQuestions: string[];
  summary: string;
  riskScore: number;
  disclaimer: string;
}

interface AnalyticsSummary {
  totalAnalyzed: number;
  sentimentDistribution: Record<string, number>;
  concernsByType: Record<string, number>;
  urgentFlagsCount: number;
  criticalFlagsCount: number;
  averageRiskScore: number;
  topConcerns: { type: string; count: number }[];
  recentUrgentFlags: UrgentFlag[];
  disclaimer: string;
}

interface SentimentTrend {
  patientId: string;
  period: string;
  dataPoints: Array<{
    date: string;
    averageSentiment: number;
    messageCount: number;
    dominantEmotion: string;
  }>;
  trend: "improving" | "stable" | "declining" | "volatile";
  trendScore: number;
  insights: string[];
  disclaimer: string;
}

interface AlertConfig {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  conditions: Record<string, any>;
  notificationChannels: string[];
  recipients: string[];
  createdAt: string;
}

interface ActiveAlert {
  id: string;
  configurationId: string;
  patientId: string;
  triggeredAt: string;
  triggerReason: string;
  severity: "info" | "warning" | "urgent" | "critical";
  status: "pending" | "acknowledged" | "in_progress" | "resolved" | "escalated";
  assignedTo?: string;
  notes: string[];
  disclaimer: string;
}

interface AlertStats {
  total: number;
  pending: number;
  acknowledged: number;
  resolved: number;
  escalated: number;
  bySeverity: Record<string, number>;
  averageResolutionTime: number;
  disclaimer: string;
}

interface EngagementMetrics {
  patientId: string;
  period: { start: string; end: string };
  loginPatterns: {
    totalLogins: number;
    averageSessionDuration: number;
    preferredLoginTimes: string[];
    deviceDistribution: Record<string, number>;
    loginFrequency: string;
  };
  featureUsage: Array<{
    feature: string;
    usageCount: number;
    lastUsed: string;
    averageTimeSpent: number;
  }>;
  engagementScore: number;
  engagementLevel: string;
  recommendations: string[];
  disclaimer: string;
}

interface ResponseTemplate {
  id: string;
  category: string;
  tone: string;
  suggestedResponse: string;
  placeholders: string[];
  confidenceScore: number;
  requiresReview: boolean;
  disclaimer: string;
}

interface CareTeamNotification {
  id: string;
  type: string;
  patientId: string;
  patientName?: string;
  title: string;
  message: string;
  priority: string;
  recipients: string[];
  createdAt: string;
  readBy: string[];
  actionUrl?: string;
  disclaimer: string;
}

interface ExportData {
  exportId: string;
  format: string;
  type: string;
  generatedAt: string;
  data: any;
  metadata: {
    recordCount: number;
    period?: { start: string; end: string };
  };
  disclaimer: string;
}

function getSentimentIcon(label: string) {
  switch (label) {
    case "very_negative":
    case "negative":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "positive":
    case "very_positive":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSentimentColor(label: string) {
  switch (label) {
    case "very_negative": return "bg-red-500";
    case "negative": return "bg-orange-500";
    case "neutral": return "bg-gray-400";
    case "positive": return "bg-green-400";
    case "very_positive": return "bg-green-600";
    default: return "bg-gray-400";
  }
}

function getSeverityVariant(severity: string): "destructive" | "secondary" | "outline" | "default" {
  switch (severity) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "secondary";
    default: return "outline";
  }
}

export default function CommunicationAnalytics() {
  const [activeTab, setActiveTab] = useState("analyze");
  const [messageContent, setMessageContent] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [messageType, setMessageType] = useState("portal_message");
  const [analysisResult, setAnalysisResult] = useState<CommunicationAnalysis | null>(null);
  const [trendPatientId, setTrendPatientId] = useState("patient-123");
  const [trendPeriod, setTrendPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [engagementPatientId, setEngagementPatientId] = useState("patient-123");

  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/communication-analytics/overview"]
  });

  const { data: urgentFlagsData, isLoading: flagsLoading, isError: flagsError } = useQuery<{ flags: Array<{ analysis: CommunicationAnalysis; status: string }>; disclaimer: string }>({
    queryKey: ["/api/communication-analytics/urgent-flags"]
  });

  const { data: alertConfigs, isLoading: alertConfigsLoading, isError: alertConfigsError } = useQuery<{ configurations: AlertConfig[]; disclaimer: string }>({
    queryKey: ["/api/communication-analytics/alert-configs"]
  });

  const { data: activeAlerts, isLoading: alertsLoading, isError: alertsError } = useQuery<{ alerts: ActiveAlert[]; disclaimer: string }>({
    queryKey: ["/api/communication-analytics/alerts"]
  });

  const { data: alertStats, isError: alertStatsError } = useQuery<AlertStats>({
    queryKey: ["/api/communication-analytics/alerts/stats"]
  });

  const { data: sentimentTrend, isLoading: trendLoading, isError: trendError } = useQuery<SentimentTrend>({
    queryKey: ["/api/communication-analytics/trends", trendPatientId, trendPeriod],
    enabled: activeTab === "trends"
  });

  const { data: engagementData, isLoading: engagementLoading, isError: engagementError } = useQuery<EngagementMetrics>({
    queryKey: ["/api/communication-analytics/engagement", engagementPatientId],
    enabled: activeTab === "engagement"
  });

  const { data: notificationsData, isLoading: notificationsLoading, isError: notificationsError } = useQuery<{ notifications: CareTeamNotification[]; unreadCount: number; disclaimer: string }>({
    queryKey: ["/api/communication-analytics/notifications"],
    enabled: activeTab === "notifications"
  });

  const [responseMessage, setResponseMessage] = useState("");
  const [responsePatientId, setResponsePatientId] = useState("");
  const [responseTemplates, setResponseTemplates] = useState<ResponseTemplate[]>([]);
  const [exportType, setExportType] = useState("sentiment_trends");
  const [exportFormat, setExportFormat] = useState("json");
  const [exportResult, setExportResult] = useState<ExportData | null>(null);

  const generateTemplatesMutation = useMutation({
    mutationFn: async (data: { message: { id: string; patientId: string; content: string; messageType: string; direction: string; timestamp: string }; context?: any }) => {
      const response = await apiRequest("POST", "/api/communication-analytics/response-templates", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResponseTemplates(data.templates || []);
    }
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("POST", `/api/communication-analytics/notifications/${notificationId}/read`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/notifications"] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/communication-analytics/notifications/read-all", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/notifications"] });
    }
  });

  const exportMutation = useMutation({
    mutationFn: async (data: { type: string; format: string }) => {
      const response = await apiRequest("POST", "/api/communication-analytics/export", data);
      return response.json();
    },
    onSuccess: (data) => {
      setExportResult(data);
    }
  });

  const analyzeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/communication-analytics/analyze", data);
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/urgent-flags"] });
    }
  });

  const reviewFlagMutation = useMutation({
    mutationFn: async ({ flagId, status }: { flagId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/communication-analytics/urgent-flags/${flagId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/urgent-flags"] });
    }
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/communication-analytics/alerts/${alertId}/acknowledge`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/alerts/stats"] });
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async ({ alertId, resolution }: { alertId: string; resolution: string }) => {
      const response = await apiRequest("POST", `/api/communication-analytics/alerts/${alertId}/resolve`, { resolution });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/alerts/stats"] });
    }
  });

  const toggleAlertConfigMutation = useMutation({
    mutationFn: async ({ configId, enabled }: { configId: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/communication-analytics/alert-configs/${configId}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-analytics/alert-configs"] });
    }
  });

  const handleAnalyze = () => {
    if (!messageContent.trim()) return;
    
    analyzeMutation.mutate({
      id: `msg-${Date.now()}`,
      patientId: patientId || `patient-${Date.now()}`,
      patientName: patientName || undefined,
      messageType,
      direction: "inbound",
      content: messageContent,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
          AI Communication Analytics
        </h1>
        <p className="text-muted-foreground">
          Analyze patient messages to detect sentiment, identify concerns, and flag urgent issues
        </p>
      </div>

      <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <Shield className="h-4 w-4" />
        <AlertTitle>NO-CDS Compliance Notice</AlertTitle>
        <AlertDescription className="text-sm">
          This analysis is for operational triage only, NOT clinical decision support. All flagged concerns must be reviewed by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages Analyzed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : overviewError ? (
              <div className="text-sm text-destructive">Error</div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-analyzed">
                {overview?.totalAnalyzed || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Urgent Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : overviewError ? (
              <div className="text-sm text-destructive">Error</div>
            ) : (
              <div className="text-2xl font-bold text-orange-600" data-testid="text-urgent-count">
                {overview?.urgentFlagsCount || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Critical Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : overviewError ? (
              <div className="text-sm text-destructive">Error</div>
            ) : (
              <div className="text-2xl font-bold text-red-600" data-testid="text-critical-count">
                {overview?.criticalFlagsCount || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Avg Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : overviewError ? (
              <div className="text-sm text-destructive">Error</div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-avg-risk">
                {overview?.averageRiskScore || 0}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap justify-start gap-1">
          <TabsTrigger value="analyze" data-testid="tab-analyze">
            <MessageSquare className="h-4 w-4 mr-2" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="urgent" data-testid="tab-urgent">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Urgent ({urgentFlagsData?.flags?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <LineChart className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="engagement" data-testid="tab-engagement">
            <Monitor className="h-4 w-4 mr-2" />
            Portal
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alerts ({alertStats?.pending || 0})
          </TabsTrigger>
          <TabsTrigger value="responses" data-testid="tab-responses">
            <MessagesSquare className="h-4 w-4 mr-2" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Mail className="h-4 w-4 mr-2" />
            Team ({notificationsData?.unreadCount || 0})
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <Download className="h-4 w-4 mr-2" />
            Data Export
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <BarChart3 className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Analyze Patient Communication</CardTitle>
                <CardDescription>
                  Enter a patient message to analyze sentiment, detect concerns, and flag urgent issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Patient ID (optional)</Label>
                    <Input
                      id="patientId"
                      placeholder="e.g., P-12345"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      data-testid="input-patient-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Patient Name (optional)</Label>
                    <Input
                      id="patientName"
                      placeholder="e.g., John Doe"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      data-testid="input-patient-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="messageType">Message Type</Label>
                  <Select value={messageType} onValueChange={setMessageType}>
                    <SelectTrigger data-testid="select-message-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portal_message">Portal Message</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone_note">Phone Note</SelectItem>
                      <SelectItem value="callback_request">Callback Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Message Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Paste or type the patient message here..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    className="min-h-[150px]"
                    data-testid="textarea-message-content"
                  />
                </div>

                <Button 
                  onClick={handleAnalyze} 
                  disabled={!messageContent.trim() || analyzeMutation.isPending}
                  className="w-full"
                  data-testid="button-analyze"
                >
                  {analyzeMutation.isPending ? (
                    <>Analyzing...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Analyze Message
                    </>
                  )}
                </Button>

                {analyzeMutation.isError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Analysis Failed</AlertTitle>
                    <AlertDescription>Failed to analyze message. Please try again.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  AI-powered sentiment and concern detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyzeMutation.isPending ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : analysisResult ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Sentiment:</span>
                          {getSentimentIcon(analysisResult.sentiment.label)}
                          <Badge className={getSentimentColor(analysisResult.sentiment.label)}>
                            {analysisResult.sentiment.label.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Risk:</span>
                          <Badge variant={analysisResult.riskScore > 50 ? "destructive" : "secondary"}>
                            {analysisResult.riskScore}%
                          </Badge>
                        </div>
                      </div>

                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm" data-testid="text-summary">{analysisResult.summary}</p>
                      </div>

                      {analysisResult.urgentFlags.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-red-600 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Urgent Flags ({analysisResult.urgentFlags.length})
                          </h4>
                          {analysisResult.urgentFlags.map((flag) => (
                            <Alert key={flag.id} variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle className="flex items-center gap-2">
                                {flag.urgencyLevel === "critical" ? "CRITICAL" : "URGENT"}
                                <Badge variant="outline">{flag.category}</Badge>
                              </AlertTitle>
                              <AlertDescription>
                                <p>{flag.reason}</p>
                                <p className="mt-1 text-xs">
                                  Response: {flag.recommendedResponse} ({flag.responseTimeframe})
                                </p>
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}

                      {analysisResult.concerns.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Detected Concerns ({analysisResult.concerns.length})</h4>
                          {analysisResult.concerns.map((concern) => (
                            <div key={concern.id} className="p-3 border rounded-md space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={getSeverityVariant(concern.severity)}>
                                  {concern.severity}
                                </Badge>
                                <span className="font-medium capitalize">{concern.type}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{concern.description}</p>
                              {concern.suggestedAction && (
                                <p className="text-xs text-blue-600">Action: {concern.suggestedAction}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {analysisResult.patientQuestions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Patient Questions</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {analysisResult.patientQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysisResult.keyTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {analysisResult.keyTopics.map((topic) => (
                            <Badge key={topic} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Enter a message and click Analyze to see results</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="urgent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Urgent Issues Queue
              </CardTitle>
              <CardDescription>
                Messages flagged for immediate care team review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flagsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : flagsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Failed to load urgent flags. Please try again.</AlertDescription>
                </Alert>
              ) : urgentFlagsData?.flags && urgentFlagsData.flags.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4 pr-4">
                    {urgentFlagsData.flags.map((item, index) => (
                      <Card key={index} className={item.analysis.urgentFlags.some(f => f.urgencyLevel === "critical") ? "border-red-500" : "border-orange-500"}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={item.analysis.urgentFlags.some(f => f.urgencyLevel === "critical") ? "destructive" : "secondary"}>
                                {item.analysis.urgentFlags.some(f => f.urgencyLevel === "critical") ? "CRITICAL" : "URGENT"}
                              </Badge>
                              <span className="font-medium">
                                {item.analysis.patientName || item.analysis.patientId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {new Date(item.analysis.analyzedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm">{item.analysis.summary}</p>
                          
                          {item.analysis.urgentFlags.map((flag) => (
                            <Alert key={flag.id} variant={flag.urgencyLevel === "critical" ? "destructive" : "default"}>
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>{flag.reason}</AlertTitle>
                              <AlertDescription>
                                <p>{flag.recommendedResponse}</p>
                                <p className="text-xs mt-1">
                                  Timeframe: {flag.responseTimeframe} | Escalate to: {flag.escalationPath}
                                </p>
                              </AlertDescription>
                            </Alert>
                          ))}

                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => reviewFlagMutation.mutate({ 
                                flagId: item.analysis.urgentFlags[0]?.id, 
                                status: "reviewed" 
                              })}
                              disabled={reviewFlagMutation.isPending}
                              data-testid={`button-review-${index}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Reviewed
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => reviewFlagMutation.mutate({ 
                                flagId: item.analysis.urgentFlags[0]?.id, 
                                status: "escalated" 
                              })}
                              disabled={reviewFlagMutation.isPending}
                              data-testid={`button-escalate-${index}`}
                            >
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Escalate
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No urgent flags pending review</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
                <CardDescription>
                  Overview of patient communication sentiment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : overview?.sentimentDistribution ? (
                  <div className="space-y-3">
                    {Object.entries(overview.sentimentDistribution).map(([label, count]) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getSentimentColor(label)}`} />
                        <span className="capitalize text-sm flex-1">{label.replace("_", " ")}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Concerns</CardTitle>
                <CardDescription>
                  Most frequently detected concern types
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : overview?.topConcerns && overview.topConcerns.length > 0 ? (
                  <div className="space-y-3">
                    {overview.topConcerns.map((concern) => (
                      <div key={concern.type} className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize text-sm flex-1">{concern.type.replace("_", " ")}</span>
                        <Badge variant="secondary">{concern.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No concerns detected yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ENHANCED: Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Sentiment Trends Over Time
              </CardTitle>
              <CardDescription>
                Track patient sentiment patterns and communication trends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="communication-analytics-patient-id">Patient ID</Label>
                  <Input id="communication-analytics-patient-id"
                    value={trendPatientId}
                    onChange={(e) => setTrendPatientId(e.target.value)}
                    placeholder="Enter patient ID"
                    className="w-48"
                    data-testid="input-trend-patient-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="communication-analytics-time-period">Time Period</Label>
                  <Select value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as "7d" | "30d" | "90d")}>
                    <SelectTrigger id="communication-analytics-time-period" className="w-32" data-testid="select-trend-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="90d">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {trendLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : trendError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Failed to load sentiment trends. Please try again.</AlertDescription>
                </Alert>
              ) : sentimentTrend ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Trend:</span>
                      {sentimentTrend.trend === "improving" && (
                        <Badge className="bg-green-500"><ArrowUpRight className="h-3 w-3 mr-1" />Improving</Badge>
                      )}
                      {sentimentTrend.trend === "declining" && (
                        <Badge className="bg-red-500"><ArrowDownRight className="h-3 w-3 mr-1" />Declining</Badge>
                      )}
                      {sentimentTrend.trend === "stable" && (
                        <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" />Stable</Badge>
                      )}
                      {sentimentTrend.trend === "volatile" && (
                        <Badge className="bg-orange-500"><Activity className="h-3 w-3 mr-1" />Volatile</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">Score: {sentimentTrend.trendScore}</span>
                  </div>

                  {sentimentTrend.dataPoints.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Sentiment by Date</h4>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {sentimentTrend.dataPoints.map((dp, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                              <span className="text-xs text-muted-foreground w-24">{dp.date}</span>
                              <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                                <div 
                                  className={`h-full ${dp.averageSentiment >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.abs(dp.averageSentiment) * 10 + 50}%` }}
                                />
                              </div>
                              <Badge variant="outline" className="text-xs">{dp.messageCount} msgs</Badge>
                              <span className="text-xs capitalize">{dp.dominantEmotion}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No trend data available for this patient</p>
                  )}

                  {sentimentTrend.insights.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Insights</h4>
                      {sentimentTrend.insights.map((insight, i) => (
                        <Alert key={i} variant="default">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{insight}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Enter a patient ID to view sentiment trends</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENHANCED: Portal Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Portal Engagement Metrics
              </CardTitle>
              <CardDescription>
                Track patient portal usage, login patterns, and feature engagement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="communication-analytics-patient-id-2">Patient ID</Label>
                  <Input id="communication-analytics-patient-id-2"
                    value={engagementPatientId}
                    onChange={(e) => setEngagementPatientId(e.target.value)}
                    placeholder="Enter patient ID"
                    className="w-48"
                    data-testid="input-engagement-patient-id"
                  />
                </div>
              </div>

              {engagementLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : engagementError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Failed to load engagement metrics. Please try again.</AlertDescription>
                </Alert>
              ) : engagementData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Login Patterns</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded bg-muted/50">
                        <p className="text-2xl font-bold">{engagementData.loginPatterns.totalLogins}</p>
                        <p className="text-xs text-muted-foreground">Total Logins</p>
                      </div>
                      <div className="p-4 rounded bg-muted/50">
                        <p className="text-2xl font-bold">{Math.round(engagementData.loginPatterns.averageSessionDuration / 60)}m</p>
                        <p className="text-xs text-muted-foreground">Avg Session</p>
                      </div>
                    </div>
                    <div className="p-4 rounded bg-muted/50">
                      <p className="text-sm font-medium mb-2">Login Frequency</p>
                      <Badge variant={engagementData.loginPatterns.loginFrequency === "daily" ? "default" : "secondary"}>
                        {engagementData.loginPatterns.loginFrequency}
                      </Badge>
                    </div>
                    {engagementData.loginPatterns.preferredLoginTimes.length > 0 && (
                      <div className="p-4 rounded bg-muted/50">
                        <p className="text-sm font-medium mb-2">Preferred Times</p>
                        <div className="flex flex-wrap gap-2">
                          {engagementData.loginPatterns.preferredLoginTimes.map((time, i) => (
                            <Badge key={i} variant="outline">{time}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Engagement Score</h4>
                    <div className="p-4 rounded bg-muted/50 text-center">
                      <p className="text-4xl font-bold">{engagementData.engagementScore}</p>
                      <Badge className={
                        engagementData.engagementLevel === "highly_engaged" ? "bg-green-500" :
                        engagementData.engagementLevel === "moderately_engaged" ? "bg-blue-500" :
                        engagementData.engagementLevel === "at_risk" ? "bg-orange-500" :
                        "bg-red-500"
                      }>
                        {engagementData.engagementLevel.replace("_", " ")}
                      </Badge>
                    </div>

                    {engagementData.featureUsage.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Feature Usage</h4>
                        {engagementData.featureUsage.slice(0, 5).map((feature, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                            <span className="text-sm flex-1 capitalize">{feature.feature}</span>
                            <Badge variant="secondary">{feature.usageCount}x</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {engagementData.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Recommendations</h4>
                        {engagementData.recommendations.map((rec, i) => (
                          <Alert key={i} variant="default">
                            <Eye className="h-4 w-4" />
                            <AlertDescription className="text-sm">{rec}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Enter a patient ID to view engagement metrics</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENHANCED: Automated Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Active Alerts
                  </CardTitle>
                  <CardDescription>
                    Real-time notifications for critical patient issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {alertsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : alertsError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>Failed to load alerts. Please try again.</AlertDescription>
                    </Alert>
                  ) : activeAlerts?.alerts && activeAlerts.alerts.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3 pr-4">
                        {activeAlerts.alerts.map((alert) => (
                          <Card key={alert.id} className={
                            alert.severity === "critical" ? "border-red-500" :
                            alert.severity === "urgent" ? "border-orange-500" :
                            alert.severity === "warning" ? "border-yellow-500" : ""
                          }>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge className={
                                      alert.severity === "critical" ? "bg-red-500" :
                                      alert.severity === "urgent" ? "bg-orange-500" :
                                      alert.severity === "warning" ? "bg-yellow-500" : "bg-blue-500"
                                    }>
                                      {alert.severity}
                                    </Badge>
                                    <Badge variant="outline">{alert.status}</Badge>
                                  </div>
                                  <p className="text-sm font-medium">{alert.triggerReason}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Patient: {alert.patientId} | {new Date(alert.triggeredAt).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  {alert.status === "pending" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                                      disabled={acknowledgeAlertMutation.isPending}
                                      data-testid={`button-acknowledge-${alert.id}`}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Ack
                                    </Button>
                                  )}
                                  {(alert.status === "pending" || alert.status === "acknowledged") && (
                                    <Button
                                      size="sm"
                                      onClick={() => resolveAlertMutation.mutate({ alertId: alert.id, resolution: "Reviewed and addressed" })}
                                      disabled={resolveAlertMutation.isPending}
                                      data-testid={`button-resolve-${alert.id}`}
                                    >
                                      Resolve
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="text-muted-foreground">No active alerts</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Alert Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alertStats ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded bg-muted/50 text-center">
                          <p className="text-2xl font-bold">{alertStats.total}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="p-3 rounded bg-orange-500/20 text-center">
                          <p className="text-2xl font-bold text-orange-600">{alertStats.pending}</p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                        <div className="p-3 rounded bg-blue-500/20 text-center">
                          <p className="text-2xl font-bold text-blue-600">{alertStats.acknowledged}</p>
                          <p className="text-xs text-muted-foreground">Acknowledged</p>
                        </div>
                        <div className="p-3 rounded bg-green-500/20 text-center">
                          <p className="text-2xl font-bold text-green-600">{alertStats.resolved}</p>
                          <p className="text-xs text-muted-foreground">Resolved</p>
                        </div>
                      </div>
                      <div className="p-3 rounded bg-muted/50">
                        <p className="text-sm font-medium mb-1">Avg Resolution Time</p>
                        <p className="text-lg font-bold">{alertStats.averageResolutionTime} min</p>
                      </div>
                    </div>
                  ) : (
                    <Skeleton className="h-32 w-full" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Alert Configurations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alertConfigsLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : alertConfigsError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>Failed to load configurations.</AlertDescription>
                    </Alert>
                  ) : alertConfigs?.configurations ? (
                    <div className="space-y-3">
                      {alertConfigs.configurations.map((config) => (
                        <div key={config.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{config.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{config.triggerType.replace("_", " ")}</p>
                          </div>
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(enabled) => toggleAlertConfigMutation.mutate({ configId: config.id, enabled })}
                            data-testid={`switch-config-${config.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No configurations</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Response Templates Tab */}
        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="h-5 w-5" />
                AI Response Templates
              </CardTitle>
              <CardDescription>
                Generate suggested response templates for patient inquiries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsePatientId">Patient ID</Label>
                    <Input
                      id="responsePatientId"
                      placeholder="Enter patient ID"
                      value={responsePatientId}
                      onChange={(e) => setResponsePatientId(e.target.value)}
                      data-testid="input-response-patient-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="responseMessage">Patient Message</Label>
                    <Textarea
                      id="responseMessage"
                      placeholder="Enter the patient message to generate response templates..."
                      rows={6}
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      data-testid="textarea-response-message"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (responseMessage.trim()) {
                        generateTemplatesMutation.mutate({
                          message: {
                            id: `msg-${Date.now()}`,
                            patientId: responsePatientId || `patient-${Date.now()}`,
                            content: responseMessage,
                            messageType: "portal_message",
                            direction: "inbound",
                            timestamp: new Date().toISOString()
                          }
                        });
                      }
                    }}
                    disabled={generateTemplatesMutation.isPending || !responseMessage.trim()}
                    data-testid="button-generate-templates"
                  >
                    {generateTemplatesMutation.isPending ? "Generating..." : "Generate Response Templates"}
                  </Button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Generated Templates</h4>
                  {generateTemplatesMutation.isPending ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : responseTemplates.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3 pr-4">
                        {responseTemplates.map((template) => (
                          <Card key={template.id} className="bg-primary/5">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="capitalize">{template.tone}</Badge>
                                <Badge variant="secondary" className="capitalize">{template.category.replace("_", " ")}</Badge>
                                {template.requiresReview && (
                                  <Badge variant="destructive" className="text-xs">Needs Review</Badge>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {Math.round(template.confidenceScore * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{template.suggestedResponse}</p>
                              {template.placeholders.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs text-muted-foreground">Placeholders:</span>
                                  {template.placeholders.map((p) => (
                                    <Badge key={p} variant="outline" className="text-xs">[{p}]</Badge>
                                  ))}
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigator.clipboard.writeText(template.suggestedResponse)}
                                data-testid={`button-copy-template-${template.id}`}
                              >
                                <Copy className="h-4 w-4 mr-1" /> Copy
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <MessagesSquare className="h-8 w-8 mb-2" />
                      <p>Enter a message to generate templates</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Care Team Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Care Team Notifications
                </CardTitle>
                <CardDescription>
                  Critical alerts and updates for the care team
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending || !notificationsData?.unreadCount}
                data-testid="button-mark-all-read"
              >
                Mark All Read {notificationsData?.unreadCount ? `(${notificationsData.unreadCount})` : ""}
              </Button>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : notificationsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Failed to load notifications.</AlertDescription>
                </Alert>
              ) : notificationsData?.notifications && notificationsData.notifications.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {notificationsData.notifications.map((notif) => (
                      <Card
                        key={notif.id}
                        className={
                          notif.priority === "urgent" ? "bg-red-50 dark:bg-red-950/20" :
                          notif.priority === "high" ? "bg-orange-50 dark:bg-orange-950/20" :
                          notif.priority === "medium" ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-blue-50 dark:bg-blue-950/20"
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{notif.title}</h4>
                                <Badge variant="outline" className="text-xs capitalize">{notif.type.replace("_", " ")}</Badge>
                                <Badge variant={
                                  notif.priority === "urgent" ? "destructive" :
                                  notif.priority === "high" ? "destructive" : "secondary"
                                } className="text-xs">
                                  {notif.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{notif.message}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(notif.createdAt).toLocaleString()}
                                <span>|</span>
                                <span>Patient: {notif.patientId}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markNotificationReadMutation.mutate(notif.id)}
                              disabled={markNotificationReadMutation.isPending}
                              data-testid={`button-mark-read-${notif.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mb-2" />
                  <p>No notifications</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Analytics Data
              </CardTitle>
              <CardDescription>
                Download analytics data in various formats for reporting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exportType">Data Type</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger id="exportType" data-testid="select-export-type">
                      <SelectValue placeholder="Select data type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sentiment_trends">Sentiment Trends</SelectItem>
                      <SelectItem value="engagement_metrics">Engagement Metrics</SelectItem>
                      <SelectItem value="alerts">Alerts</SelectItem>
                      <SelectItem value="full_analytics">Full Analytics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exportFormat">Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger id="exportFormat" data-testid="select-export-format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => exportMutation.mutate({ type: exportType, format: exportFormat })}
                    disabled={exportMutation.isPending}
                    data-testid="button-export"
                  >
                    {exportMutation.isPending ? "Exporting..." : "Export Data"}
                    <Download className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>

              {exportResult && (
                <Card className="border-green-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Export Complete
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Export ID</p>
                        <p className="font-medium">{exportResult.exportId}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Format</p>
                        <p className="font-medium uppercase">{exportResult.format}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">{exportResult.metadata.recordCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Generated</p>
                        <p className="font-medium">{new Date(exportResult.generatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldCaption>Data Preview</FieldCaption>
                      <ScrollArea className="h-[200px] border rounded p-2">
                        <pre className="text-xs whitespace-pre-wrap">
                          {typeof exportResult.data === "string" 
                            ? exportResult.data.slice(0, 2000) 
                            : JSON.stringify(exportResult.data, null, 2).slice(0, 2000)}
                          {(typeof exportResult.data === "string" ? exportResult.data.length : JSON.stringify(exportResult.data).length) > 2000 && "..."}
                        </pre>
                      </ScrollArea>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const content = typeof exportResult.data === "string" 
                          ? exportResult.data 
                          : JSON.stringify(exportResult.data, null, 2);
                        const blob = new Blob([content], { type: exportFormat === "csv" ? "text/csv" : "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `analytics-${exportResult.type}-${Date.now()}.${exportFormat}`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      data-testid="button-download-export"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
