import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Calendar, 
  Trophy, 
  Send, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle,
  Bell,
  Star,
  Target,
  Flame,
  Award,
  Heart,
  Activity,
  Pill,
  BookOpen,
  AlertCircle,
  ChevronRight,
  User
} from "lucide-react";

interface EngagementSummary {
  unreadMessages: number;
  upcomingAppointments: number;
  totalPoints: number;
  level: { level: number; name: string; pointsToNext: number; progress: number };
  currentStreaks: Array<{ category: string; currentStreak: number; longestStreak: number }>;
  badgeCount: number;
}

interface MessageThread {
  id: string;
  providerName: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  lastMessageAt: string;
  patientUnreadCount: number;
}

interface Message {
  id: string;
  senderType: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface Appointment {
  id: string;
  providerName: string;
  providerSpecialty: string;
  appointmentType: string;
  status: string;
  scheduledDate: string;
  durationMinutes: number;
  location: string;
  isTelehealth: boolean;
  reasonForVisit: string;
}

interface Reward {
  totalPoints: number;
  level: { level: number; name: string; pointsToNext: number; progress: number };
  badges: Array<{
    id: string;
    name: string;
    description: string;
    badgeIcon: string;
    badgeColor: string;
    earnedAt: string;
  }>;
  streaks: Array<{
    category: string;
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
  }>;
  availableBadges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    points: number;
    category: string;
    earned: boolean;
  }>;
}

const categoryIcons: Record<string, typeof MessageSquare> = {
  medication_adherence: Pill,
  appointment_attendance: Calendar,
  goal_achievement: Target,
  health_tracking: Activity,
  education: BookOpen,
  messaging: MessageSquare,
  general: Star,
};

const categoryColors: Record<string, string> = {
  medication_adherence: "text-purple-500",
  appointment_attendance: "text-green-500",
  goal_achievement: "text-blue-500",
  health_tracking: "text-red-500",
  education: "text-teal-500",
  messaging: "text-indigo-500",
  general: "text-yellow-500",
};

export function PatientEngagementHub({ profileId }: { profileId?: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false);
  const [newThreadData, setNewThreadData] = useState({
    subject: "",
    category: "general",
    providerUserId: "",
    providerName: "",
    content: "",
  });
  const [newAppointmentData, setNewAppointmentData] = useState({
    providerUserId: "",
    providerName: "",
    appointmentType: "checkup",
    scheduledDate: "",
    durationMinutes: 30,
    reasonForVisit: "",
    isTelehealth: false,
  });
  const { toast } = useToast();

  const summaryUrl = profileId 
    ? `/api/patient-engagement-hub/summary?profileId=${profileId}` 
    : "/api/patient-engagement-hub/summary";
  
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: EngagementSummary }>({
    queryKey: [summaryUrl],
  });

  const threadsUrl = profileId 
    ? `/api/patient-engagement-hub/messages/threads?profileId=${profileId}` 
    : "/api/patient-engagement-hub/messages/threads";

  const { data: threadsData, isLoading: threadsLoading } = useQuery<{ success: boolean; data: MessageThread[] }>({
    queryKey: [threadsUrl],
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ success: boolean; data: Message[] }>({
    queryKey: [`/api/patient-engagement-hub/messages/threads/${selectedThread}`],
    enabled: !!selectedThread,
  });

  const appointmentsUrl = profileId 
    ? `/api/patient-engagement-hub/appointments?profileId=${profileId}&upcoming=true`
    : "/api/patient-engagement-hub/appointments?upcoming=true";

  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: [appointmentsUrl],
  });

  const rewardsUrl = profileId 
    ? `/api/patient-engagement-hub/rewards?profileId=${profileId}` 
    : "/api/patient-engagement-hub/rewards";

  const { data: rewardsData, isLoading: rewardsLoading } = useQuery<{ success: boolean; data: Reward }>({
    queryKey: [rewardsUrl],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { threadId: string; content: string; senderName: string }) => {
      return apiRequest("POST", "/api/patient-engagement-hub/messages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/messages/threads"] });
      setNewMessage("");
      toast({ title: "Message sent", description: "Your message has been delivered." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/patient-engagement-hub/messages/threads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/messages/threads"] });
      setShowNewThreadDialog(false);
      setNewThreadData({ subject: "", category: "general", providerUserId: "", providerName: "", content: "" });
      toast({ title: "Thread created", description: "Your message thread has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create thread.", variant: "destructive" });
    },
  });

  const scheduleAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/patient-engagement-hub/appointments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-hub/summary"] });
      setShowNewAppointmentDialog(false);
      toast({ title: "Appointment scheduled", description: "Your appointment has been scheduled." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule appointment.", variant: "destructive" });
    },
  });

  const summary = summaryData?.data;
  const threads = threadsData?.data || [];
  const messages = messagesData?.data || [];
  const appointments = appointmentsData?.data || [];
  const rewards = rewardsData?.data;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "pending": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "cancelled": return "bg-red-500/10 text-red-700 dark:text-red-400";
      case "completed": return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6" data-testid="patient-engagement-hub">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This module is for engagement and communication purposes only. For medical emergencies, please call 911 or contact your healthcare provider directly.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
            {summary && summary.unreadMessages > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 text-xs flex items-center justify-center">
                {summary.unreadMessages}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2" data-testid="tab-appointments">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Appointments</span>
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2" data-testid="tab-rewards">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Rewards</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {summaryLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : summary ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card data-testid="card-messages-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Messages</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.unreadMessages}</div>
                    <p className="text-xs text-muted-foreground">unread messages</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-appointments-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Appointments</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.upcomingAppointments}</div>
                    <p className="text-xs text-muted-foreground">upcoming</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-points-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Points</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.totalPoints}</div>
                    <p className="text-xs text-muted-foreground">total earned</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-level-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Level {summary.level.level}</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{summary.level.name}</div>
                    <Progress value={summary.level.progress} className="mt-2 h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.level.pointsToNext} pts to next level
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Active Streaks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.currentStreaks.length > 0 ? (
                      <div className="space-y-3">
                        {summary.currentStreaks.map((streak, idx) => {
                          const Icon = categoryIcons[streak.category] || Star;
                          return (
                            <div key={idx} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${categoryColors[streak.category]}`} />
                                <span className="capitalize">{streak.category.replace(/_/g, " ")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-500" />
                                <span className="font-semibold">{streak.currentStreak} days</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Start building streaks by taking your medications, attending appointments, and logging your health!
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-500" />
                      Badges Earned
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary.badgeCount}</div>
                    <p className="text-muted-foreground text-sm mt-1">
                      Keep up the great work to earn more badges!
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab("rewards")}
                      data-testid="button-view-all-badges"
                    >
                      View All Badges
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Unable to load engagement summary. Please try again later.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Secure Messages</h3>
            <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-message">
                  <Plus className="h-4 w-4 mr-2" />
                  New Message
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Conversation</DialogTitle>
                  <DialogDescription>
                    Send a secure message to your healthcare provider.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Provider Name</label>
                    <Input
                      placeholder="Dr. Smith"
                      value={newThreadData.providerName}
                      onChange={(e) => setNewThreadData({ ...newThreadData, providerName: e.target.value, providerUserId: e.target.value.toLowerCase().replace(/\s/g, "-") })}
                      data-testid="input-provider-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      placeholder="Question about my medication"
                      value={newThreadData.subject}
                      onChange={(e) => setNewThreadData({ ...newThreadData, subject: e.target.value })}
                      data-testid="input-subject"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={newThreadData.category}
                      onValueChange={(v) => setNewThreadData({ ...newThreadData, category: v })}
                    >
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="prescription_request">Prescription Request</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="lab_results">Lab Results</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      placeholder="Type your message..."
                      value={newThreadData.content}
                      onChange={(e) => setNewThreadData({ ...newThreadData, content: e.target.value })}
                      rows={4}
                      data-testid="input-message-content"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewThreadDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createThreadMutation.mutate({
                      ...newThreadData,
                      patientProfileId: profileId,
                    })}
                    disabled={!newThreadData.subject || !newThreadData.providerName}
                    data-testid="button-send-new-thread"
                  >
                    Send Message
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {threadsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : threads.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        className={`w-full p-4 text-left hover-elevate transition-colors ${selectedThread === thread.id ? "bg-muted" : ""}`}
                        onClick={() => setSelectedThread(thread.id)}
                        data-testid={`thread-${thread.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium truncate">{thread.providerName}</span>
                              {thread.patientUnreadCount > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-5 px-1">
                                  {thread.patientUnreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{thread.subject}</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(thread.lastMessageAt)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedThread ? threads.find(t => t.id === selectedThread)?.subject : "Select a conversation"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedThread ? (
                    messagesLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="max-h-64 overflow-y-auto space-y-3">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${msg.senderType === "patient" ? "bg-primary/10 ml-4" : "bg-muted mr-4"}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{msg.senderName}</span>
                                <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                              </div>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-2 border-t">
                          <Input
                            placeholder="Type your reply..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey && newMessage.trim()) {
                                sendMessageMutation.mutate({
                                  threadId: selectedThread,
                                  content: newMessage,
                                  senderName: "You",
                                });
                              }
                            }}
                            data-testid="input-reply"
                          />
                          <Button
                            size="icon"
                            onClick={() => {
                              if (newMessage.trim()) {
                                sendMessageMutation.mutate({
                                  threadId: selectedThread,
                                  content: newMessage,
                                  senderName: "You",
                                });
                              }
                            }}
                            disabled={!newMessage.trim() || sendMessageMutation.isPending}
                            data-testid="button-send-reply"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Select a conversation to view messages
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No messages yet</p>
                <Button onClick={() => setShowNewThreadDialog(true)} data-testid="button-start-first-message">
                  Start Your First Conversation
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Upcoming Appointments</h3>
            <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-schedule-appointment">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Appointment</DialogTitle>
                  <DialogDescription>
                    Request a new appointment with your healthcare provider.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Provider Name</label>
                    <Input
                      placeholder="Dr. Smith"
                      value={newAppointmentData.providerName}
                      onChange={(e) => setNewAppointmentData({ ...newAppointmentData, providerName: e.target.value, providerUserId: e.target.value.toLowerCase().replace(/\s/g, "-") })}
                      data-testid="input-appt-provider"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Appointment Type</label>
                    <Select
                      value={newAppointmentData.appointmentType}
                      onValueChange={(v) => setNewAppointmentData({ ...newAppointmentData, appointmentType: v })}
                    >
                      <SelectTrigger data-testid="select-appt-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checkup">Checkup</SelectItem>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                        <SelectItem value="urgent">Urgent Visit</SelectItem>
                        <SelectItem value="telehealth">Telehealth</SelectItem>
                        <SelectItem value="vaccination">Vaccination</SelectItem>
                        <SelectItem value="lab_work">Lab Work</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Preferred Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={newAppointmentData.scheduledDate}
                      onChange={(e) => setNewAppointmentData({ ...newAppointmentData, scheduledDate: e.target.value })}
                      data-testid="input-appt-date"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Reason for Visit</label>
                    <Textarea
                      placeholder="Briefly describe the reason for your visit..."
                      value={newAppointmentData.reasonForVisit}
                      onChange={(e) => setNewAppointmentData({ ...newAppointmentData, reasonForVisit: e.target.value })}
                      rows={3}
                      data-testid="input-appt-reason"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewAppointmentDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => scheduleAppointmentMutation.mutate({
                      ...newAppointmentData,
                      patientProfileId: profileId,
                    })}
                    disabled={!newAppointmentData.scheduledDate || !newAppointmentData.providerName}
                    data-testid="button-confirm-appointment"
                  >
                    Request Appointment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {appointmentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <Card key={appt.id} data-testid={`appointment-${appt.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="font-medium">{formatDate(appt.scheduledDate)}</span>
                          <span className="text-muted-foreground">at {formatTime(appt.scheduledDate)}</span>
                          <Badge className={getStatusColor(appt.status)}>
                            {appt.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{appt.providerName}</span>
                          {appt.providerSpecialty && (
                            <span className="text-muted-foreground">({appt.providerSpecialty})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="capitalize">{appt.appointmentType.replace(/_/g, " ")}</span>
                          <span>{appt.durationMinutes} min</span>
                          {appt.isTelehealth && (
                            <Badge variant="outline" className="text-xs">Telehealth</Badge>
                          )}
                        </div>
                        {appt.reasonForVisit && (
                          <p className="text-sm text-muted-foreground mt-2">{appt.reasonForVisit}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {appt.status === "pending" && (
                          <Button size="sm" variant="outline" data-testid={`button-confirm-${appt.id}`}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Confirm
                          </Button>
                        )}
                        {(appt.status === "pending" || appt.status === "confirmed") && (
                          <Button size="sm" variant="ghost" className="text-destructive" data-testid={`button-cancel-${appt.id}`}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                <Button onClick={() => setShowNewAppointmentDialog(true)} data-testid="button-schedule-first-appointment">
                  Schedule Your First Appointment
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4 mt-4">
          {rewardsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : rewards ? (
            <>
              <Card data-testid="card-level-progress">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Level {rewards.level.level}: {rewards.level.name}
                  </CardTitle>
                  <CardDescription>
                    {rewards.totalPoints} total points earned
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={rewards.level.progress} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {rewards.level.pointsToNext} points to reach next level
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-500" />
                      Earned Badges ({rewards.badges.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rewards.badges.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {rewards.badges.map((badge) => (
                          <div
                            key={badge.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                          >
                            <div className={`p-2 rounded-full bg-${badge.badgeColor || "yellow"}-500/20`}>
                              <Award className={`h-4 w-4 text-${badge.badgeColor || "yellow"}-500`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{badge.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        Complete activities to earn your first badge!
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      Available Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {rewards.availableBadges.filter(b => !b.earned).slice(0, 4).map((badge) => {
                        const Icon = categoryIcons[badge.category] || Star;
                        return (
                          <div
                            key={badge.id}
                            className="flex items-center gap-3 p-2 rounded-lg border border-dashed"
                          >
                            <div className="p-2 rounded-full bg-muted">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{badge.name}</p>
                              <p className="text-xs text-muted-foreground">{badge.description}</p>
                            </div>
                            <Badge variant="outline">+{badge.points}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Streaks
                  </CardTitle>
                  <CardDescription>
                    Build consistency to earn bonus points and special badges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rewards.streaks.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {rewards.streaks.map((streak, idx) => {
                        const Icon = categoryIcons[streak.category] || Star;
                        return (
                          <div key={idx} className="p-4 rounded-lg bg-muted">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className={`h-5 w-5 ${categoryColors[streak.category]}`} />
                              <span className="font-medium capitalize">
                                {streak.category.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <div className="text-2xl font-bold text-orange-500">
                                  {streak.currentStreak}
                                </div>
                                <div className="text-xs text-muted-foreground">Current</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold">{streak.longestStreak}</div>
                                <div className="text-xs text-muted-foreground">Best</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold">{streak.totalActiveDays}</div>
                                <div className="text-xs text-muted-foreground">Total Days</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Start tracking activities to build streaks!
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Unable to load rewards data. Please try again later.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
