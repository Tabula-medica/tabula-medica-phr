import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate } from "@/components/shared/format-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MessageSquare,
  BookOpen,
  Mail,
  ClipboardCheck,
  Send,
  Bot,
  User,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  Heart,
  Activity,
  Shield,
  Lightbulb,
  TrendingUp,
  Calendar,
  Plus,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface PersonalizedEducation {
  id: string;
  patientId: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  readingLevel: string;
  relatedConditions: string[];
  keyTakeaways: string[];
  actionItems: string[];
  estimatedReadTime: number;
  delivered: boolean;
  viewed: boolean;
  createdAt: string;
  noCdsCompliance: string;
}

interface FollowUpCommunication {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  subject: string;
  message: string;
  priority: string;
  channel: string;
  status: string;
  createdAt: string;
}

interface FeedbackCollection {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  questions: { id: string; text: string; type: string; required: boolean }[];
  responses: { questionId: string; value: string | number }[];
  status: string;
  aiSentimentAnalysis?: {
    overallSentiment: string;
    keyThemes: string[];
    followUpRecommended: boolean;
    aiInsights: string;
  };
  createdAt: string;
}

interface DashboardData {
  stats: {
    activeConversations: number;
    educationCreated: number;
    pendingFollowUps: number;
    feedbackCollected: number;
    avgSentiment: string;
  };
  recentConversations: unknown[];
  recentEducation: PersonalizedEducation[];
  recentFollowUps: FollowUpCommunication[];
  recentFeedback: FeedbackCollection[];
}

interface ListResponse<T> {
  items: T[];
  noCdsCompliance: string;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function getPriorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case "high": return "destructive";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "secondary";
  }
}

function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "completed": case "sent": case "delivered": return "default";
    case "pending": case "draft": return "secondary";
    case "in_progress": return "outline";
    default: return "secondary";
  }
}

function getSentimentVariant(sentiment: string): BadgeVariant {
  switch (sentiment) {
    case "positive": return "default";
    case "neutral": return "secondary";
    case "negative": return "destructive";
    default: return "secondary";
  }
}

export default function AIProactivePatientEngagementChatbotPage() {
  const [activeTab, setActiveTab] = useState("chatbot");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId] = useState(`conv-${Date.now()}`);
  const [patientId] = useState("patient-1");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/ai-engagement-chatbot/dashboard"],
  });

  const { data: educationResponse, isLoading: educationLoading } = useQuery<ListResponse<PersonalizedEducation>>({
    queryKey: ["/api/ai-engagement-chatbot/education/all"],
  });

  const { data: followUpsResponse, isLoading: followUpsLoading } = useQuery<ListResponse<FollowUpCommunication>>({
    queryKey: ["/api/ai-engagement-chatbot/followup/all"],
  });

  const { data: feedbackResponse, isLoading: feedbackLoading } = useQuery<ListResponse<FeedbackCollection>>({
    queryKey: ["/api/ai-engagement-chatbot/feedback/all"],
  });

  const allEducation = educationResponse?.items;
  const allFollowUps = followUpsResponse?.items;
  const allFeedback = feedbackResponse?.items;

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", "/api/ai-engagement-chatbot/chat/message", {
        conversationId,
        patientId,
        message
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  });

  const generateEducationMutation = useMutation({
    mutationFn: async (data: { conditions: string[]; healthLiteracyLevel: string }) => {
      return apiRequest("POST", "/api/ai-engagement-chatbot/education/generate", {
        patientId,
        conditions: data.conditions,
        medications: [],
        healthLiteracyLevel: data.healthLiteracyLevel
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/education/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/dashboard"] });
      toast({ title: "Education content generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate education content", variant: "destructive" });
    }
  });

  const createFollowUpMutation = useMutation({
    mutationFn: async (data: { type: string; patientName: string }) => {
      return apiRequest("POST", "/api/ai-engagement-chatbot/followup/create", {
        patientId,
        patientName: data.patientName,
        type: data.type
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/followup/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/dashboard"] });
      toast({ title: "Follow-up communication created" });
    },
    onError: () => {
      toast({ title: "Failed to create follow-up", variant: "destructive" });
    }
  });

  const createFeedbackMutation = useMutation({
    mutationFn: async (data: { type: string; patientName: string }) => {
      return apiRequest("POST", "/api/ai-engagement-chatbot/feedback/create", {
        patientId,
        patientName: data.patientName,
        type: data.type
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/feedback/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/dashboard"] });
      toast({ title: "Feedback collection created" });
    },
    onError: () => {
      toast({ title: "Failed to create feedback collection", variant: "destructive" });
    }
  });

  const sendFollowUpMutation = useMutation({
    mutationFn: async (followUpId: string) => {
      return apiRequest("POST", `/api/ai-engagement-chatbot/followup/${followUpId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-engagement-chatbot/followup/all"] });
      toast({ title: "Follow-up sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send follow-up", variant: "destructive" });
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate(inputMessage);
    setInputMessage("");
  };

  const stats = dashboard?.stats || {
    activeConversations: 0,
    educationCreated: 0,
    pendingFollowUps: 0,
    feedbackCollected: 0,
    avgSentiment: 'neutral'
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="page-title">
            AI Patient Engagement Chatbot
          </h1>
          <p className="text-muted-foreground mt-1">
            Proactive patient communication with AI-powered assistance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDashboard()}
            disabled={dashboardLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${dashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4 text-muted-foreground" />
        <AlertTitle className="text-foreground">INFORMATIONAL ONLY - NO-CDS Compliance</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          AI-generated responses are for patient engagement purposes only. Not intended for clinical decision-making. 
          Always consult healthcare providers for medical advice.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card data-testid="stat-conversations">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeConversations}</div>
          </CardContent>
        </Card>
        
        <Card data-testid="stat-education">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Education Created</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.educationCreated}</div>
          </CardContent>
        </Card>
        
        <Card data-testid="stat-followups">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Follow-ups</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingFollowUps}</div>
          </CardContent>
        </Card>
        
        <Card data-testid="stat-feedback">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Collected</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.feedbackCollected}</div>
          </CardContent>
        </Card>
        
        <Card data-testid="stat-sentiment">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={getSentimentVariant(stats.avgSentiment)}>
              {stats.avgSentiment}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chatbot" data-testid="tab-chatbot">
            <Bot className="h-4 w-4 mr-2" />
            Chatbot
          </TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">
            <BookOpen className="h-4 w-4 mr-2" />
            Education
          </TabsTrigger>
          <TabsTrigger value="followup" data-testid="tab-followup">
            <Mail className="h-4 w-4 mr-2" />
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chatbot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                Healthcare Assistant Chatbot
              </CardTitle>
              <CardDescription>
                AI-powered assistant for appointment reminders and basic health queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col h-96">
                <ScrollArea className="flex-1 p-4 border rounded-lg bg-muted/20">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Bot className="h-12 w-12 mb-4" />
                      <p className="text-center">
                        Hello! I'm your healthcare assistant. I can help with appointment reminders, 
                        medication information, and general health questions.
                      </p>
                      <p className="text-xs mt-2 text-muted-foreground">
                        Note: I provide general information only. Please consult your healthcare provider for medical advice.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                            data-testid={`message-${msg.role}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                
                <div className="flex gap-2 mt-4">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-chat-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common questions and actions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputMessage("When is my next appointment?");
                  handleSendMessage();
                }}
                data-testid="quick-action-appointment"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Next Appointment
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputMessage("What medications am I taking?");
                  handleSendMessage();
                }}
                data-testid="quick-action-medications"
              >
                <Activity className="h-4 w-4 mr-2" />
                My Medications
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputMessage("I need to reschedule my appointment");
                  handleSendMessage();
                }}
                data-testid="quick-action-reschedule"
              >
                <Clock className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                Generate Personalized Education
              </CardTitle>
              <CardDescription>
                Create tailored health education content based on patient conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Condition</label>
                  <Select defaultValue="diabetes">
                    <SelectTrigger data-testid="select-condition">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diabetes">Type 2 Diabetes</SelectItem>
                      <SelectItem value="hypertension">Hypertension</SelectItem>
                      <SelectItem value="heart_disease">Heart Disease</SelectItem>
                      <SelectItem value="asthma">Asthma</SelectItem>
                      <SelectItem value="wellness">General Wellness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reading Level</label>
                  <Select defaultValue="intermediate">
                    <SelectTrigger data-testid="select-reading-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic (Simple Language)</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced (Detailed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => generateEducationMutation.mutate({
                      conditions: ['Type 2 Diabetes'],
                      healthLiteracyLevel: 'intermediate'
                    })}
                    disabled={generateEducationMutation.isPending}
                    data-testid="button-generate-education"
                  >
                    {generateEducationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Lightbulb className="h-4 w-4 mr-2" />
                    )}
                    Generate Content
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Education Content Library</CardTitle>
              <CardDescription>Previously generated education materials</CardDescription>
            </CardHeader>
            <CardContent>
              {educationLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : allEducation && allEducation.length > 0 ? (
                <div className="space-y-4">
                  {allEducation.map((edu) => (
                    <Card key={edu.id} data-testid={`education-item-${edu.id}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{edu.title}</CardTitle>
                            <CardDescription>{edu.summary}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={getStatusVariant(edu.viewed ? 'completed' : 'pending')}>
                              {edu.viewed ? 'Viewed' : 'Not Viewed'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {edu.relatedConditions.map((condition, idx) => (
                            <Badge key={idx} variant="outline">{condition}</Badge>
                          ))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="mr-4">Reading Level: {edu.readingLevel}</span>
                          <span>Est. Read Time: {edu.estimatedReadTime} min</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4" />
                  <p>No education content created yet</p>
                  <p className="text-sm">Generate personalized content above</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                Create Follow-up Communication
              </CardTitle>
              <CardDescription>
                AI-assisted patient follow-up messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Follow-up Type</label>
                  <Select defaultValue="appointment_followup">
                    <SelectTrigger data-testid="select-followup-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointment_followup">Appointment Follow-up</SelectItem>
                      <SelectItem value="medication_check">Medication Check</SelectItem>
                      <SelectItem value="wellness_check">Wellness Check</SelectItem>
                      <SelectItem value="feedback_request">Feedback Request</SelectItem>
                      <SelectItem value="care_plan_update">Care Plan Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Patient Name</label>
                  <Input defaultValue="John Smith" data-testid="input-patient-name" />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => createFollowUpMutation.mutate({
                      type: 'appointment_followup',
                      patientName: 'John Smith'
                    })}
                    disabled={createFollowUpMutation.isPending}
                    data-testid="button-create-followup"
                  >
                    {createFollowUpMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Follow-up
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-up Communications</CardTitle>
              <CardDescription>Draft and sent follow-up messages</CardDescription>
            </CardHeader>
            <CardContent>
              {followUpsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : allFollowUps && allFollowUps.length > 0 ? (
                <div className="space-y-4">
                  {allFollowUps.map((followUp) => (
                    <Card key={followUp.id} data-testid={`followup-item-${followUp.id}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{followUp.subject}</CardTitle>
                            <CardDescription>To: {followUp.patientName}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={getPriorityVariant(followUp.priority)}>
                              {followUp.priority}
                            </Badge>
                            <Badge variant={getStatusVariant(followUp.status)}>
                              {followUp.status}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">{followUp.message}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xs text-muted-foreground">
                            Created: {formatDate(followUp.createdAt)}
                          </span>
                          {followUp.status === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => sendFollowUpMutation.mutate(followUp.id)}
                              disabled={sendFollowUpMutation.isPending}
                              data-testid={`button-send-followup-${followUp.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4" />
                  <p>No follow-up communications yet</p>
                  <p className="text-sm">Create a follow-up message above</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                Create Feedback Collection
              </CardTitle>
              <CardDescription>
                Collect patient feedback with AI sentiment analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Feedback Type</label>
                  <Select defaultValue="satisfaction_survey">
                    <SelectTrigger data-testid="select-feedback-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="satisfaction_survey">Satisfaction Survey</SelectItem>
                      <SelectItem value="experience_rating">Experience Rating</SelectItem>
                      <SelectItem value="nps_score">NPS Score</SelectItem>
                      <SelectItem value="open_feedback">Open Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Patient Name</label>
                  <Input defaultValue="John Smith" data-testid="input-feedback-patient-name" />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => createFeedbackMutation.mutate({
                      type: 'satisfaction_survey',
                      patientName: 'John Smith'
                    })}
                    disabled={createFeedbackMutation.isPending}
                    data-testid="button-create-feedback"
                  >
                    {createFeedbackMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Survey
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback Collections</CardTitle>
              <CardDescription>Patient feedback with AI analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : allFeedback && allFeedback.length > 0 ? (
                <div className="space-y-4">
                  {allFeedback.map((feedback) => (
                    <Card key={feedback.id} data-testid={`feedback-item-${feedback.id}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{feedback.type.replace(/_/g, ' ')}</CardTitle>
                            <CardDescription>Patient: {feedback.patientName}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={getStatusVariant(feedback.status)}>
                              {feedback.status}
                            </Badge>
                            {feedback.aiSentimentAnalysis && (
                              <Badge variant={getSentimentVariant(feedback.aiSentimentAnalysis.overallSentiment)}>
                                {feedback.aiSentimentAnalysis.overallSentiment}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="text-sm text-muted-foreground">
                          Questions: {feedback.questions.length}
                        </div>
                        {feedback.aiSentimentAnalysis && (
                          <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                            <p className="text-sm font-medium">AI Insights:</p>
                            <p className="text-sm text-muted-foreground">{feedback.aiSentimentAnalysis.aiInsights}</p>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Created: {formatDate(feedback.createdAt)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4" />
                  <p>No feedback collections yet</p>
                  <p className="text-sm">Create a survey above</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
