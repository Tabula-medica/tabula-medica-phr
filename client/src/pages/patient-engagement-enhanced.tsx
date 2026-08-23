import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  MessageSquare,
  Bot,
  Target,
  Send,
  Phone,
  AlertCircle,
  TrendingUp,
  Trophy,
  Calendar,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Activity,
  Heart,
  Footprints,
  Scale,
  Pill,
  Brain,
  Moon,
  Loader2,
} from "lucide-react";

const PATIENT_ID = "patient-001";
const PATIENT_NAME = "John Smith";

interface EngagementDashboard {
  messaging: { unreadMessages: number; activeConversations: number; pendingResponses: number; averageResponseTime: string };
  chatbot: { activeSessions: number; resolvedToday: number; escalatedToProvider: number };
  healthGoals: { activeGoals: number; completedGoals: number; averageProgress: number; upcomingMilestones: number };
  recentActivity: { id: string; type: string; title: string; description: string; timestamp: string; icon: string }[];
}

interface Conversation {
  id: string; patientId: string; patientName: string; providerId?: string; providerName?: string;
  subject: string; lastMessage: string; lastMessageAt: string; unreadCount: number; status: string; category: string;
  messages: { id: string; conversationId: string; senderId: string; senderType: string; senderName: string; content: string; priority: string; status: string; createdAt: string }[];
}

interface ChatbotSession {
  id: string; patientId: string; patientName: string; status: string;
  messages: { id: string; role: string; content: string; timestamp: string; metadata?: { suggestedActions?: string[] } }[];
}

interface HealthGoal {
  id: string; patientId: string; title: string; description: string; category: string;
  targetValue: number; currentValue: number; unit: string; startDate: string; targetDate: string;
  status: string; progress: number;
  milestones: { id: string; title: string; targetValue: number; targetDate: string; achieved: boolean; achievedAt?: string }[];
  progressHistory: { id: string; value: number; note?: string; recordedAt: string }[];
  aiRecommendations?: string[];
}

const categoryIcons: Record<string, typeof Activity> = {
  blood_pressure: Heart, exercise: Footprints, weight: Scale, medication: Pill,
  mental_health: Brain, sleep: Moon, nutrition: Activity, blood_sugar: Activity, custom: Target,
};

export default function PatientEngagementEnhanced() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatSession, setChatSession] = useState<ChatbotSession | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<HealthGoal | null>(null);
  const [progressValue, setProgressValue] = useState("");
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const { toast } = useToast();

  const { data: dashboard, isLoading } = useQuery<EngagementDashboard>({
    queryKey: ["/api/patient-engagement-hub/enhanced/dashboard", PATIENT_ID],
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/patient-engagement-hub/enhanced/conversations", PATIENT_ID],
  });

  const { data: healthGoals = [] } = useQuery<HealthGoal[]>({
    queryKey: ["/api/patient-engagement-hub/health-goals", PATIENT_ID],
  });

  const startChatMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/patient-engagement-hub/chatbot/start", { patientId: PATIENT_ID, patientName: PATIENT_NAME }),
    onSuccess: (data) => setChatSession(data as unknown as ChatbotSession),
  });

  const sendChatMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/patient-engagement-hub/chatbot/${chatSession?.id}/message`, { content }),
    onSuccess: (data) => {
      if (chatSession) {
        setChatSession({ ...chatSession, messages: [...chatSession.messages, data as unknown as ChatbotSession["messages"][0]] });
      }
      setChatInput("");
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/patient-engagement-hub/chatbot/${chatSession?.id}/escalate`, {}),
    onSuccess: () => {
      toast({ title: "Escalated to Care Team", description: "A provider will respond shortly." });
      setChatSession(null);
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/enhanced/conversations"] });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ goalId, value }: { goalId: string; value: number }) =>
      apiRequest("POST", `/api/patient-engagement-hub/health-goals/${goalId}/progress`, { value }),
    onSuccess: () => {
      toast({ title: "Progress Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/health-goals"] });
      setProgressValue("");
      setSelectedGoal(null);
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-engagement-hub/health-goals", data),
    onSuccess: () => {
      toast({ title: "Goal Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/health-goals"] });
      setIsNewGoalOpen(false);
    },
  });

  const formatTime = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !chatSession) return;
    chatSession.messages.push({ id: `temp-${Date.now()}`, role: "user", content: chatInput, timestamp: new Date().toISOString() });
    setChatSession({ ...chatSession });
    sendChatMutation.mutate(chatInput);
  };

  if (isLoading) {
    return <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Patient Engagement Hub</h1>
        <p className="text-muted-foreground">Communicate with your care team, get AI-powered assistance, and track your health goals</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="overview" data-testid="tab-overview"><Activity className="h-4 w-4 mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages"><MessageSquare className="h-4 w-4 mr-2" />Messages</TabsTrigger>
          <TabsTrigger value="chatbot" data-testid="tab-chatbot"><Bot className="h-4 w-4 mr-2" />AI Assistant</TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals"><Target className="h-4 w-4 mr-2" />Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-unread-messages">{dashboard?.messaging.unreadMessages || 0}</div>
                <p className="text-xs text-muted-foreground">{dashboard?.messaging.activeConversations || 0} active conversations</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Health Goals</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-goals">{dashboard?.healthGoals.activeGoals || 0}</div>
                <p className="text-xs text-muted-foreground">{dashboard?.healthGoals.averageProgress || 0}% average progress</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">AI Assistant</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-queries-resolved">{dashboard?.chatbot.resolvedToday || 0}</div>
                <p className="text-xs text-muted-foreground">queries resolved today</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard?.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        {activity.type === "message" && <MessageSquare className="h-4 w-4 text-primary" />}
                        {activity.type === "milestone" && <Trophy className="h-4 w-4 text-primary" />}
                        {activity.type === "goal_update" && <TrendingUp className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(activity.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("chatbot")} data-testid="button-start-chat"><Bot className="mr-2 h-4 w-4" />Chat with AI Assistant</Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("messages")} data-testid="button-view-messages"><MessageSquare className="mr-2 h-4 w-4" />View Messages</Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("goals")} data-testid="button-track-goals"><Target className="mr-2 h-4 w-4" />Track Health Goals</Button>
                <Button className="w-full justify-start" variant="outline" data-testid="button-schedule-appointment"><Calendar className="mr-2 h-4 w-4" />Schedule Appointment</Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Health Goals Progress</CardTitle>
              <CardDescription>Track your progress toward your health goals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthGoals.slice(0, 3).map((goal) => {
                  const IconComponent = categoryIcons[goal.category] || Target;
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{goal.title}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{goal.progress}% complete</span>
                        <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Conversations</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {conversations.map((conv) => (
                    <div key={conv.id} className={`p-4 border-b cursor-pointer hover-elevate ${selectedConversation?.id === conv.id ? "bg-accent" : ""}`} {...clickable(() => setSelectedConversation(conv))} data-testid={`conversation-${conv.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{conv.providerName || "Care Team"}</p>
                            {conv.unreadCount > 0 && <Badge variant="default" className="text-xs">{conv.unreadCount}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{conv.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{conv.lastMessage}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(conv.lastMessageAt)}</span>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              {selectedConversation ? (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{selectedConversation.subject}</CardTitle>
                        <CardDescription>with {selectedConversation.providerName || "Care Team"}</CardDescription>
                      </div>
                      <Badge variant={selectedConversation.status === "active" ? "default" : "secondary"}>{selectedConversation.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px] p-4">
                      <div className="space-y-4">
                        {selectedConversation.messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.senderType === "patient" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${msg.senderType === "patient" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <p className="text-sm">{msg.content}</p>
                              <p className="text-xs opacity-70 mt-1">{formatTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Separator />
                    <div className="p-4">
                      <div className="flex gap-2">
                        <Textarea placeholder="Type your message..." value={messageInput} onChange={(e) => setMessageInput(e.target.value)} className="min-h-[60px]" data-testid="input-message" />
                        <Button size="icon" data-testid="button-send-message"><Send className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to view messages</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chatbot" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full"><Bot className="h-6 w-6 text-primary" /></div>
                    <div>
                      <CardTitle>AI Health Assistant</CardTitle>
                      <CardDescription>Get quick answers to your health questions</CardDescription>
                    </div>
                  </div>
                  {chatSession && <Button variant="outline" size="sm" onClick={() => escalateMutation.mutate()} data-testid="button-escalate"><Phone className="h-4 w-4 mr-2" />Talk to Provider</Button>}
                </div>
              </CardHeader>
              <CardContent>
                {!chatSession ? (
                  <div className="text-center py-8">
                    <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
                    <p className="text-muted-foreground mb-4">Our AI assistant can help with medication questions, appointment scheduling, and general health information.</p>
                    <Button onClick={() => startChatMutation.mutate()} disabled={startChatMutation.isPending} data-testid="button-start-ai-chat">
                      {startChatMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}Start Chat
                    </Button>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {chatSession.messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className="flex items-start gap-2 max-w-[85%]">
                              {msg.role === "assistant" && <Avatar className="h-8 w-8"><AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback></Avatar>}
                              <div className={`p-3 rounded-lg ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                {msg.metadata?.suggestedActions && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {msg.metadata.suggestedActions.map((action, i) => <Button key={i} variant="secondary" size="sm" className="text-xs">{action}</Button>)}
                                  </div>
                                )}
                              </div>
                              {msg.role === "user" && <Avatar className="h-8 w-8"><AvatarFallback>JS</AvatarFallback></Avatar>}
                            </div>
                          </div>
                        ))}
                        {sendChatMutation.isPending && (
                          <div className="flex justify-start">
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">AI is thinking...</span></div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <Separator className="my-4" />
                    <div className="flex gap-2">
                      <Input placeholder="Type your message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSendChat()} disabled={sendChatMutation.isPending} data-testid="input-chat" />
                      <Button onClick={handleSendChat} disabled={sendChatMutation.isPending || !chatInput.trim()} data-testid="button-send-chat"><Send className="h-4 w-4" /></Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">This AI assistant provides general health information only and is not a substitute for professional medical advice. For medical emergencies, call 911.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div><h2 className="text-xl font-semibold">Health Goals</h2><p className="text-muted-foreground">Track your progress and achieve your health objectives</p></div>
            <Dialog open={isNewGoalOpen} onOpenChange={setIsNewGoalOpen}>
              <DialogTrigger asChild><Button data-testid="button-new-goal"><Plus className="h-4 w-4 mr-2" />New Goal</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Health Goal</DialogTitle><DialogDescription>Set a new health goal to track your progress</DialogDescription></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); createGoalMutation.mutate({ patientId: PATIENT_ID, title: formData.get("title"), description: formData.get("description"), category: formData.get("category"), targetValue: Number(formData.get("targetValue")), currentValue: Number(formData.get("currentValue")), unit: formData.get("unit"), targetDate: formData.get("targetDate") }); }}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label htmlFor="title">Goal Title</Label><Input id="title" name="title" placeholder="e.g., Lower Blood Pressure" required /></div>
                    <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" placeholder="Describe your goal..." /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select name="category" required><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="weight">Weight</SelectItem><SelectItem value="exercise">Exercise</SelectItem><SelectItem value="blood_pressure">Blood Pressure</SelectItem><SelectItem value="blood_sugar">Blood Sugar</SelectItem><SelectItem value="nutrition">Nutrition</SelectItem><SelectItem value="sleep">Sleep</SelectItem><SelectItem value="medication">Medication</SelectItem><SelectItem value="mental_health">Mental Health</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-2"><Label htmlFor="unit">Unit</Label><Input id="unit" name="unit" placeholder="e.g., lbs, steps" required /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="currentValue">Current Value</Label><Input id="currentValue" name="currentValue" type="number" required /></div>
                      <div className="space-y-2"><Label htmlFor="targetValue">Target Value</Label><Input id="targetValue" name="targetValue" type="number" required /></div>
                    </div>
                    <div className="space-y-2"><Label htmlFor="targetDate">Target Date</Label><Input id="targetDate" name="targetDate" type="date" required /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={createGoalMutation.isPending}>{createGoalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Goal</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthGoals.map((goal) => {
              const IconComponent = categoryIcons[goal.category] || Target;
              const achievedMilestones = goal.milestones.filter((m) => m.achieved).length;
              return (
                <Card key={goal.id} className="hover-elevate" data-testid={`goal-card-${goal.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full"><IconComponent className="h-4 w-4 text-primary" /></div>
                        <div><CardTitle className="text-base">{goal.title}</CardTitle><CardDescription className="text-xs capitalize">{goal.category.replace("_", " ")}</CardDescription></div>
                      </div>
                      <Badge variant={goal.status === "completed" ? "default" : "secondary"}>{goal.status === "completed" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}{goal.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1"><span className="font-medium">{goal.currentValue} {goal.unit}</span><span className="text-muted-foreground">Goal: {goal.targetValue} {goal.unit}</span></div>
                        <Progress value={goal.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{goal.progress}% complete</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><Trophy className="h-3 w-3" /><span>{achievedMilestones}/{goal.milestones.length} milestones</span></div>
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{new Date(goal.targetDate).toLocaleDateString()}</span></div>
                      </div>
                      {goal.aiRecommendations && goal.aiRecommendations.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-medium flex items-center gap-1 mb-2"><Brain className="h-3 w-3" />AI Recommendations</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {goal.aiRecommendations.slice(0, 2).map((rec, i) => <li key={i} className="flex items-start gap-1"><ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" /><span>{rec}</span></li>)}
                          </ul>
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedGoal(goal)} data-testid={`button-update-progress-${goal.id}`}><TrendingUp className="h-3 w-3 mr-1" />Update Progress</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Dialog open={!!selectedGoal} onOpenChange={() => setSelectedGoal(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Update Progress</DialogTitle><DialogDescription>Record your current progress for {selectedGoal?.title}</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label htmlFor="patient-engagement-enhan-current-value">Current Value ({selectedGoal?.unit})</Label><Input id="patient-engagement-enhan-current-value" type="number" value={progressValue} onChange={(e) => setProgressValue(e.target.value)} placeholder={`Enter value in ${selectedGoal?.unit}`} data-testid="input-progress-value" /></div>
                <div className="flex items-center justify-between text-sm"><span>Previous: {selectedGoal?.currentValue} {selectedGoal?.unit}</span><span>Target: {selectedGoal?.targetValue} {selectedGoal?.unit}</span></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedGoal(null)}>Cancel</Button>
                <Button onClick={() => { if (selectedGoal && progressValue) updateProgressMutation.mutate({ goalId: selectedGoal.id, value: Number(progressValue) }); }} disabled={!progressValue || updateProgressMutation.isPending} data-testid="button-save-progress">{updateProgressMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Progress</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
