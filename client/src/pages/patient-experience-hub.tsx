import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate } from "@/components/shared/format-helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  MessageSquare,
  Bell,
  Heart,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Send,
  Loader2,
  Clock,
  User,
  ChevronRight,
  Info,
  Lightbulb,
  Stethoscope,
  Pill
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DashboardData {
  patientId: string;
  upcomingAppointments: Appointment[];
  activeAlerts: PatientAlert[];
  recommendations: HealthRecommendation[];
  unreadMessages: number;
  lastUpdated: string;
}

interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  type: string;
  scheduledAt: string;
  status: string;
  notes?: string;
}

interface PatientAlert {
  id: string;
  patientId: string;
  type: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  isRead: boolean;
  createdAt: string;
}

interface HealthRecommendation {
  id: string;
  patientId: string;
  type: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: string;
  createdBy: string;
  createdAt: string;
}

interface MessageThread {
  id: string;
  patientId: string;
  subject: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const SEVERITY_CONFIG = {
  low: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Info },
  medium: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertCircle },
  high: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: AlertTriangle },
  critical: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: AlertTriangle }
};

const PRIORITY_CONFIG = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
};

const RECOMMENDATION_ICONS: Record<string, typeof Heart> = {
  preventive: Heart,
  medication: Pill,
  lifestyle: Lightbulb,
  follow_up: Stethoscope
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function PatientExperienceHub() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/patient-experience/dashboard"]
  });

  const { data: threads, isLoading: threadsLoading } = useQuery<MessageThread[]>({
    queryKey: ["/api/patient-experience/messages/threads"]
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<HealthRecommendation[]>({
    queryKey: ["/api/patient-experience/recommendations"]
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      return apiRequest("POST", `/api/patient-experience/messages/threads/${threadId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-experience/messages/threads"] });
      setNewMessage("");
    }
  });

  const markAlertReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/patient-experience/alerts/${alertId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-experience/dashboard"] });
    }
  });

  const acknowledgeRecommendationMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      return apiRequest("POST", `/api/patient-experience/recommendations/${recommendationId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-experience/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-experience/dashboard"] });
    }
  });

  const selectedThreadData = threads?.find(t => t.id === selectedThread);

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-dashboard">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Patient Experience Hub</h1>
          <p className="text-muted-foreground">Your health dashboard, messages, and recommendations</p>
        </div>
        {dashboardData && (
          <Badge variant="outline" className="text-sm" data-testid="badge-last-updated">
            <Clock className="h-3 w-3 mr-1" />
            Updated {formatDateTime(dashboardData.lastUpdated)}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-patient-experience">
        <TabsList className="mb-6" data-testid="tablist-patient-experience">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
            {dashboardData?.unreadMessages ? (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                {dashboardData.unreadMessages}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Lightbulb className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Appointments
                </CardTitle>
                <CardDescription>Your scheduled visits</CardDescription>
              </CardHeader>
              <CardContent>
                {!dashboardData?.upcomingAppointments?.length ? (
                  <p className="text-muted-foreground text-center py-4">No upcoming appointments</p>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.upcomingAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
                        data-testid={`appointment-item-${apt.id}`}
                      >
                        <div className="p-2 rounded-full bg-primary/10">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{apt.type}</p>
                          <p className="text-sm text-muted-foreground">{apt.providerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(apt.scheduledAt)} at {formatTime(apt.scheduledAt)}
                          </p>
                        </div>
                        <Badge variant="outline">{apt.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alerts
                </CardTitle>
                <CardDescription>Important notifications about your health</CardDescription>
              </CardHeader>
              <CardContent>
                {!dashboardData?.activeAlerts?.length ? (
                  <p className="text-muted-foreground text-center py-4">No active alerts</p>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.activeAlerts.map((alert) => {
                      const config = SEVERITY_CONFIG[alert.severity];
                      const Icon = config.icon;
                      return (
                        <div
                          key={alert.id}
                          className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                          data-testid={`alert-item-${alert.id}`}
                        >
                          <div className={`p-2 rounded-full ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{alert.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(alert.createdAt)}
                            </p>
                          </div>
                          {!alert.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAlertReadMutation.mutate(alert.id)}
                              data-testid={`button-dismiss-alert-${alert.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Health Recommendations
                </CardTitle>
                <CardDescription>
                  Personalized suggestions from your care team. These are educational only and do not constitute medical advice.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!dashboardData?.recommendations?.length ? (
                  <p className="text-muted-foreground text-center py-4">No active recommendations</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.recommendations.slice(0, 4).map((rec) => {
                      const Icon = RECOMMENDATION_ICONS[rec.type] || Lightbulb;
                      return (
                        <div
                          key={rec.id}
                          className="flex items-start gap-3 p-4 rounded-lg border hover-elevate"
                          data-testid={`recommendation-item-${rec.id}`}
                        >
                          <div className="p-2 rounded-full bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{rec.title}</p>
                              <Badge className={PRIORITY_CONFIG[rec.priority]} variant="secondary">
                                {rec.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {rec.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              By {rec.createdBy}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setActiveTab("recommendations")}
                            data-testid={`button-view-recommendation-${rec.id}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Conversations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {threadsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !threads?.length ? (
                  <p className="text-muted-foreground text-center py-8">No conversations yet</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    {threads.map((thread) => {
                      const unreadCount = thread.messages.filter(m => !m.isRead && m.senderRole !== "patient").length;
                      const lastMessage = thread.messages[thread.messages.length - 1];
                      return (
                        <div
                          key={thread.id}
                          className={`p-4 border-b cursor-pointer hover-elevate ${
                            selectedThread === thread.id ? "bg-muted" : ""
                          }`}
                          onClick={() => setSelectedThread(thread.id)}
                          data-testid={`thread-item-${thread.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {thread.participants[0]?.charAt(0) || "C"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{thread.subject}</p>
                                {unreadCount > 0 && (
                                  <Badge variant="destructive" className="h-5 px-1.5">
                                    {unreadCount}
                                  </Badge>
                                )}
                              </div>
                              {lastMessage && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {lastMessage.senderName}: {lastMessage.content}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedThreadData?.subject || "Select a conversation"}
                </CardTitle>
                {selectedThreadData && (
                  <CardDescription>
                    With {selectedThreadData.participants.join(", ")}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedThread ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a conversation to view messages</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-[400px]">
                    <ScrollArea className="flex-1 pr-4">
                      <div className="space-y-4">
                        {selectedThreadData?.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex gap-3 ${
                              msg.senderRole === "patient" ? "flex-row-reverse" : ""
                            }`}
                            data-testid={`message-item-${msg.id}`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {msg.senderName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                msg.senderRole === "patient"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <p className="text-sm font-medium mb-1">{msg.senderName}</p>
                              <p className="text-sm">{msg.content}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {formatDateTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Separator className="my-4" />
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 resize-none"
                        rows={2}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={() => {
                          if (selectedThread && newMessage.trim()) {
                            sendMessageMutation.mutate({
                              threadId: selectedThread,
                              content: newMessage.trim()
                            });
                          }
                        }}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
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
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Health Recommendations</CardTitle>
              <CardDescription>
                Personalized health suggestions from your care team. These are educational recommendations, 
                not medical advice. Please consult your healthcare provider for clinical decisions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !recommendations?.length ? (
                <p className="text-muted-foreground text-center py-8">No recommendations at this time</p>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => {
                    const Icon = RECOMMENDATION_ICONS[rec.type] || Lightbulb;
                    return (
                      <div
                        key={rec.id}
                        className="flex items-start gap-4 p-4 rounded-lg border hover-elevate"
                        data-testid={`recommendation-detail-${rec.id}`}
                      >
                        <div className="p-3 rounded-full bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="font-semibold">{rec.title}</h3>
                            <Badge className={PRIORITY_CONFIG[rec.priority]} variant="secondary">
                              {rec.priority} priority
                            </Badge>
                            <Badge variant="outline">{rec.type.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-muted-foreground mb-3">{rec.description}</p>
                          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                            <span>From: {rec.createdBy}</span>
                            <span>{formatDate(rec.createdAt)}</span>
                            <span className="capitalize">Status: {rec.status}</span>
                          </div>
                        </div>
                        {rec.status !== "acknowledged" && (
                          <Button
                            variant="outline"
                            onClick={() => acknowledgeRecommendationMutation.mutate(rec.id)}
                            disabled={acknowledgeRecommendationMutation.isPending}
                            data-testid={`button-acknowledge-${rec.id}`}
                          >
                            {acknowledgeRecommendationMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
