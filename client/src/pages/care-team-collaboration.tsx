import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getInitials } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Users,
  CheckSquare,
  FileText,
  Send,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  Circle,
  User,
  Calendar,
  MessageCircle,
  Edit,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Settings,
  BarChart3,
  Sparkles,
  Lightbulb,
  Wand2,
  ClipboardList,
  Activity,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-500 border-red-500/30",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  normal: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  low: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  in_progress: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  on_hold: "bg-gray-500/10 text-gray-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const reviewStatusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-500",
  under_review: "bg-yellow-500/10 text-yellow-500",
  approved: "bg-green-500/10 text-green-500",
  requires_changes: "bg-orange-500/10 text-orange-500",
  finalized: "bg-emerald-500/10 text-emerald-500",
};

const annotationTypeColors: Record<string, string> = {
  comment: "bg-blue-500/10 text-blue-500",
  suggestion: "bg-purple-500/10 text-purple-500",
  correction: "bg-orange-500/10 text-orange-500",
  approval: "bg-green-500/10 text-green-500",
  concern: "bg-red-500/10 text-red-500",
};

const roleLabels: Record<string, string> = {
  primary_physician: "Primary Physician",
  specialist: "Specialist",
  nurse: "Nurse",
  care_coordinator: "Care Coordinator",
  pharmacist: "Pharmacist",
  therapist: "Therapist",
  social_worker: "Social Worker",
};

interface CareTeamConversation {
  id: string;
  patientId: string;
  patientName: string;
  teamId: string;
  participants: Array<{
    userId: string;
    name: string;
    role: string;
    lastReadAt: string;
  }>;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCounts: Record<string, number>;
  isActive: boolean;
}

interface CareTeamChatMessage {
  id: string;
  patientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  messageType: string;
  mentionedUserIds: string[];
  createdAt: string;
}

interface CareTeamSharedTask {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  status: string;
  assignedTo: Array<{ userId: string; name: string; role: string }>;
  createdBy: { userId: string; name: string; role: string };
  dueDate: string;
  completedAt?: string;
  comments: Array<{ id: string; userId: string; userName: string; content: string; createdAt: string }>;
  checklistItems: Array<{ id: string; title: string; isCompleted: boolean; completedBy?: string }>;
  tags: string[];
  updatedAt: string;
}

interface CollaborativeReportReview {
  id: string;
  patientId: string;
  patientName: string;
  reportType: string;
  reportTitle: string;
  reportContent: any;
  generatedAt: string;
  status: string;
  reviewers: Array<{ userId: string; name: string; role: string; status: string; reviewedAt?: string; comments?: string }>;
  annotations: Array<{
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    sectionId: string;
    sectionTitle: string;
    comment: string;
    annotationType: string;
    status: string;
    createdAt: string;
  }>;
  changelog: Array<{ id: string; userId: string; userName: string; action: string; details: string; timestamp: string }>;
  disclaimer: string;
}

const currentUser = {
  id: "dr-wilson",
  name: "Dr. Sarah Wilson",
  role: "primary_physician",
};

export default function CareTeamCollaboration() {
  useSEO({
    title: "Care Team Collaboration | Tabula Medica",
    description: "Real-time care team collaboration with chat, shared tasks, and collaborative AI report review",
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<CareTeamSharedTask | null>(null);
  const [selectedReview, setSelectedReview] = useState<CollaborativeReportReview | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskComment, setTaskComment] = useState("");
  const [annotationComment, setAnnotationComment] = useState("");
  const [annotationType, setAnnotationType] = useState<string>("comment");

  const { toast } = useToast();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    success: boolean;
    dashboard: {
      conversations: { total: number; active: number; withUnread: number };
      tasks: { total: number; pending: number; inProgress: number; completed: number; urgent: number; overdue: number };
      reportReviews: { total: number; pending: number; approved: number; finalized: number; openAnnotations: number };
      recentActivity: Array<{ type: string; title: string; patient: string; timestamp: string; status?: string }>;
    };
  }>({
    queryKey: ["/api/care-team-collab/dashboard"],
  });

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{
    success: boolean;
    conversations: CareTeamConversation[];
  }>({
    queryKey: ["/api/care-team-collab/conversations"],
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{
    success: boolean;
    messages: CareTeamChatMessage[];
  }>({
    queryKey: ["/api/care-team-collab/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<{
    success: boolean;
    tasks: CareTeamSharedTask[];
    summary: { total: number; pending: number; inProgress: number; completed: number; urgent: number; overdue: number };
  }>({
    queryKey: ["/api/care-team-collab/tasks"],
  });

  const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery<{
    success: boolean;
    reviews: CollaborativeReportReview[];
    summary: { total: number; draft: number; underReview: number; approved: number; finalized: number; requiresChanges: number };
  }>({
    queryKey: ["/api/care-team-collab/report-reviews"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      return apiRequest("POST", `/api/care-team-collab/conversations/${data.conversationId}/messages`, {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        content: data.content,
        messageType: "text",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-collab/conversations", selectedConversation, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-collab/conversations"] });
      setNewMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async (data: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/care-team-collab/tasks/${data.taskId}/status`, {
        status: data.status,
        userId: currentUser.id,
        userName: currentUser.name,
      });
    },
    onSuccess: () => {
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-collab/dashboard"] });
      toast({ title: "Task Updated", description: "Task status has been updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const addTaskCommentMutation = useMutation({
    mutationFn: async (data: { taskId: string; content: string }) => {
      return apiRequest("POST", `/api/care-team-collab/tasks/${data.taskId}/comments`, {
        userId: currentUser.id,
        userName: currentUser.name,
        content: data.content,
      });
    },
    onSuccess: () => {
      refetchTasks();
      setTaskComment("");
      toast({ title: "Comment Added", description: "Your comment has been added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async (data: { taskId: string; itemId: string; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/care-team-collab/tasks/${data.taskId}/checklist/${data.itemId}`, {
        isCompleted: data.isCompleted,
        userId: currentUser.id,
      });
    },
    onSuccess: () => {
      refetchTasks();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update checklist", variant: "destructive" });
    },
  });

  const addAnnotationMutation = useMutation({
    mutationFn: async (data: { reviewId: string; sectionId: string; sectionTitle: string; comment: string; annotationType: string }) => {
      return apiRequest("POST", `/api/care-team-collab/report-reviews/${data.reviewId}/annotations`, {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        sectionId: data.sectionId,
        sectionTitle: data.sectionTitle,
        comment: data.comment,
        annotationType: data.annotationType,
      });
    },
    onSuccess: () => {
      refetchReviews();
      setAnnotationComment("");
      toast({ title: "Annotation Added", description: "Your annotation has been added to the report" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add annotation", variant: "destructive" });
    },
  });

  const updateReviewerStatusMutation = useMutation({
    mutationFn: async (data: { reviewId: string; status: string; comments?: string }) => {
      return apiRequest("PATCH", `/api/care-team-collab/report-reviews/${data.reviewId}/reviewers/${currentUser.id}`, {
        status: data.status,
        comments: data.comments,
      });
    },
    onSuccess: () => {
      refetchReviews();
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-collab/dashboard"] });
      toast({ title: "Review Submitted", description: "Your review status has been updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
    },
  });

  const dashboard = dashboardData?.dashboard;
  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];
  const tasks = tasksData?.tasks || [];
  const reviews = reviewsData?.reviews || [];

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };


  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({ conversationId: selectedConversation, content: newMessage });
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Care Team Collaboration</h1>
          <p className="text-muted-foreground">Real-time communication, task management, and collaborative report review</p>
        </div>
        <Button size="icon" variant="outline" onClick={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/care-team-collab"] });
        }} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="ai-assist" data-testid="tab-ai-assist">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Assist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {dashboardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="card-conversations-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      Team Conversations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.conversations.active}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.conversations.withUnread} with unread messages
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-tasks-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      Shared Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.tasks.inProgress}</div>
                    <p className="text-xs text-muted-foreground">
                      in progress | {dashboard.tasks.urgent} urgent | {dashboard.tasks.overdue} overdue
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-reports-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      Report Reviews
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.reportReviews.pending}</div>
                    <p className="text-xs text-muted-foreground">
                      pending review | {dashboard.reportReviews.openAnnotations} open annotations
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-recent-activity">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription>Latest updates across your care teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard.recentActivity.map((activity, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${activity.type === "task" ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                          {activity.type === "task" ? (
                            <CheckSquare className="h-4 w-4 text-green-500" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.patient} • {formatTime(activity.timestamp)}
                          </p>
                        </div>
                        {activity.status && (
                          <Badge variant="outline" className={statusColors[activity.status] || ""}>
                            {activity.status.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
            <Card className="lg:col-span-1" data-testid="card-conversation-list">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Patient Conversations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[520px]">
                  {conversationsLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No active conversations
                    </div>
                  ) : (
                    conversations.map(conv => (
                      <div
                        key={conv.id}
                        className={`p-4 cursor-pointer hover-elevate border-b ${selectedConversation === conv.id ? "bg-accent/50" : ""}`}
                        onClick={() => setSelectedConversation(conv.id)}
                        data-testid={`conversation-${conv.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(conv.patientName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium truncate">{conv.patientName}</p>
                              <span className="text-xs text-muted-foreground">{formatTime(conv.lastMessageAt)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{conv.lastMessagePreview}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{conv.participants.length} members</span>
                              {conv.unreadCounts[currentUser.id] > 0 && (
                                <Badge variant="default" className="ml-2 text-xs h-5">
                                  {conv.unreadCounts[currentUser.id]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 flex flex-col" data-testid="card-chat-view">
              {selectedConv ? (
                <>
                  <CardHeader className="pb-2 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedConv.patientName}</CardTitle>
                        <CardDescription>
                          {selectedConv.participants.map(p => p.name).join(", ")}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-[420px] p-4">
                      {messagesLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map(msg => (
                            <div
                              key={msg.id}
                              className={`flex gap-3 ${msg.senderId === currentUser.id ? "flex-row-reverse" : ""}`}
                              data-testid={`message-${msg.id}`}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(msg.senderName)}</AvatarFallback>
                              </Avatar>
                              <div className={`max-w-[70%] ${msg.senderId === currentUser.id ? "items-end" : ""}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">{msg.senderName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {roleLabels[msg.senderRole] || msg.senderRole}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                                </div>
                                <div className={`p-3 rounded-lg ${msg.senderId === currentUser.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="border-t p-4">
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={handleSendMessage}
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
                  </CardFooter>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a conversation to start chatting</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {tasksLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-xs">
                    {tasksData?.summary.pending || 0} Pending
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-blue-500/10">
                    {tasksData?.summary.inProgress || 0} In Progress
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-green-500/10">
                    {tasksData?.summary.completed || 0} Completed
                  </Badge>
                  {(tasksData?.summary.overdue || 0) > 0 && (
                    <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500">
                      {tasksData?.summary.overdue} Overdue
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tasks.map(task => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedTask(task)}
                    data-testid={`task-${task.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={priorityColors[task.priority]}>
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className={statusColors[task.status]}>
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <CardTitle className="text-base">{task.title}</CardTitle>
                          <CardDescription className="text-xs">
                            {task.patientName} • Due {new Date(task.dueDate).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {task.assignedTo.map(a => a.name.split(" ")[0]).join(", ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {task.checklistItems.filter(i => i.isCompleted).length}/{task.checklistItems.length}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {reviewsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-xs">
                  {reviewsData?.summary.underReview || 0} Under Review
                </Badge>
                <Badge variant="outline" className="text-xs bg-green-500/10">
                  {reviewsData?.summary.approved || 0} Approved
                </Badge>
                <Badge variant="outline" className="text-xs bg-emerald-500/10">
                  {reviewsData?.summary.finalized || 0} Finalized
                </Badge>
              </div>

              <div className="space-y-4">
                {reviews.map(review => (
                  <Card
                    key={review.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedReview(review)}
                    data-testid={`review-${review.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={reviewStatusColors[review.status]}>
                              {review.status.replace("_", " ")}
                            </Badge>
                            <Badge variant="outline">{review.reportType.replace("_", " ")}</Badge>
                          </div>
                          <CardTitle className="text-lg">{review.reportTitle}</CardTitle>
                          <CardDescription>
                            {review.patientName} • Generated {new Date(review.generatedAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {review.reviewers.filter(r => r.status !== "pending").length}/{review.reviewers.length} reviewed
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {review.annotations.filter(a => a.status === "open").length} open annotations
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {review.reviewers.map(r => (
                          <div key={r.userId} className="flex items-center gap-1">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">{getInitials(r.name)}</AvatarFallback>
                            </Avatar>
                            {r.status === "approved" && <CheckCircle className="h-3 w-3 text-green-500" />}
                            {r.status === "rejected" && <AlertCircle className="h-3 w-3 text-red-500" />}
                            {r.status === "reviewed" && <Eye className="h-3 w-3 text-blue-500" />}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ai-assist" className="space-y-6">
          <AICareTeamAssistant conversations={conversationsData?.conversations || []} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={priorityColors[selectedTask.priority]}>
                    {selectedTask.priority}
                  </Badge>
                  <Badge variant="outline" className={statusColors[selectedTask.status]}>
                    {selectedTask.status.replace("_", " ")}
                  </Badge>
                </div>
                <DialogTitle>{selectedTask.title}</DialogTitle>
                <DialogDescription>
                  {selectedTask.patientName} • Created by {selectedTask.createdBy.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Assigned To</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.assignedTo.map(a => (
                      <Badge key={a.userId} variant="outline" className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {a.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Checklist</h4>
                  <div className="space-y-2">
                    {selectedTask.checklistItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={item.isCompleted}
                          onCheckedChange={(checked) => {
                            updateChecklistMutation.mutate({
                              taskId: selectedTask.id,
                              itemId: item.id,
                              isCompleted: !!checked,
                            });
                          }}
                          data-testid={`checklist-${item.id}`}
                        />
                        <span className={`text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Progress
                    value={(selectedTask.checklistItems.filter(i => i.isCompleted).length / selectedTask.checklistItems.length) * 100}
                    className="mt-2 h-2"
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Comments ({selectedTask.comments.length})</h4>
                  <ScrollArea className="h-32 border rounded-lg p-2">
                    {selectedTask.comments.map(comment => (
                      <div key={comment.id} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comment.userName}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    ))}
                  </ScrollArea>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      placeholder="Add a comment..."
                      value={taskComment}
                      onChange={e => setTaskComment(e.target.value)}
                      data-testid="input-task-comment"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (taskComment.trim()) {
                          addTaskCommentMutation.mutate({ taskId: selectedTask.id, content: taskComment });
                        }
                      }}
                      disabled={!taskComment.trim() || addTaskCommentMutation.isPending}
                      data-testid="button-add-comment"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <Label>Update Status:</Label>
                  <Select
                    value={selectedTask.status}
                    onValueChange={(value) => {
                      updateTaskStatusMutation.mutate({ taskId: selectedTask.id, status: value });
                    }}
                  >
                    <SelectTrigger className="w-40" data-testid="select-task-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={reviewStatusColors[selectedReview.status]}>
                    {selectedReview.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">{selectedReview.reportType.replace("_", " ")}</Badge>
                </div>
                <DialogTitle>{selectedReview.reportTitle}</DialogTitle>
                <DialogDescription>{selectedReview.patientName}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Report Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedReview.reportContent.overview && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">Overview</h5>
                        <p className="text-sm text-muted-foreground">{selectedReview.reportContent.overview}</p>
                      </div>
                    )}
                    {selectedReview.reportContent.keyFindings && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">Key Findings</h5>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {selectedReview.reportContent.keyFindings.map((f: string, i: number) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedReview.reportContent.recommendations && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">Recommendations</h5>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {selectedReview.reportContent.recommendations.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div>
                  <h4 className="text-sm font-medium mb-2">Reviewers</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReview.reviewers.map(r => (
                      <div key={r.userId} className="flex items-center gap-2 p-2 border rounded-lg">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(r.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{roleLabels[r.role] || r.role}</p>
                        </div>
                        <Badge variant="outline" className={
                          r.status === "approved" ? "bg-green-500/10 text-green-500" :
                          r.status === "rejected" ? "bg-red-500/10 text-red-500" :
                          r.status === "reviewed" ? "bg-blue-500/10 text-blue-500" :
                          ""
                        }>
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Annotations ({selectedReview.annotations.length})</h4>
                  <ScrollArea className="h-40 border rounded-lg p-2">
                    {selectedReview.annotations.map(ann => (
                      <div key={ann.id} className="mb-3 p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={annotationTypeColors[ann.annotationType]}>
                            {ann.annotationType}
                          </Badge>
                          <span className="text-sm font-medium">{ann.userName}</span>
                          <span className="text-xs text-muted-foreground">on {ann.sectionTitle}</span>
                        </div>
                        <p className="text-sm">{ann.comment}</p>
                      </div>
                    ))}
                  </ScrollArea>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={annotationType} onValueChange={setAnnotationType}>
                        <SelectTrigger className="w-32" data-testid="select-annotation-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comment">Comment</SelectItem>
                          <SelectItem value="suggestion">Suggestion</SelectItem>
                          <SelectItem value="correction">Correction</SelectItem>
                          <SelectItem value="approval">Approval</SelectItem>
                          <SelectItem value="concern">Concern</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Add annotation..."
                        value={annotationComment}
                        onChange={e => setAnnotationComment(e.target.value)}
                        className="flex-1"
                        data-testid="input-annotation"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (annotationComment.trim()) {
                            addAnnotationMutation.mutate({
                              reviewId: selectedReview.id,
                              sectionId: "general",
                              sectionTitle: "General",
                              comment: annotationComment,
                              annotationType,
                            });
                          }
                        }}
                        disabled={!annotationComment.trim() || addAnnotationMutation.isPending}
                        data-testid="button-add-annotation"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{selectedReview.disclaimer}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateReviewerStatusMutation.mutate({ reviewId: selectedReview.id, status: "reviewed" });
                      }}
                      disabled={updateReviewerStatusMutation.isPending}
                      data-testid="button-mark-reviewed"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Mark Reviewed
                    </Button>
                    <Button
                      onClick={() => {
                        updateReviewerStatusMutation.mutate({ reviewId: selectedReview.id, status: "approved" });
                      }}
                      disabled={updateReviewerStatusMutation.isPending}
                      data-testid="button-approve"
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== AI CARE TEAM ASSISTANT ====================

interface AIThreadSummary {
  overallSummary: string;
  keyTopics: string[];
  actionItems: Array<{ description: string; suggestedAssignee?: string; priority: string }>;
  participantContributions: Array<{ name: string; role: string; messageCount: number; keyPoints: string[] }>;
  pendingQuestions: string[];
  timeline: Array<{ timestamp: string; event: string }>;
}

interface AIRelevantInfoSuggestions {
  priorityItems: Array<{ type: string; title: string; reason: string; urgency: string }>;
  recentUpdates: Array<{ source: string; summary: string; timestamp: string }>;
  suggestedReviews: Array<{ item: string; rationale: string }>;
  communicationGaps: Array<{ description: string; suggestion: string }>;
  upcomingDeadlines: Array<{ task: string; dueDate: string; status: string }>;
}

interface AIDraft {
  type: string;
  suggestedContent: string;
  suggestedTitle?: string;
  suggestedAssignees?: string[];
  suggestedPriority?: string;
  suggestedDueDate?: string;
  rationale: string;
  alternatives: Array<{ content: string; reason: string }>;
}

function AICareTeamAssistant({ conversations }: { conversations: CareTeamConversation[] }) {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [draftPatientId, setDraftPatientId] = useState<string>("");
  const [draftContext, setDraftContext] = useState("");
  const [draftType, setDraftType] = useState<"message" | "task">("message");
  const { toast } = useToast();

  const uniquePatients = Array.from(new Set(conversations.map(c => c.patientId))).map(pid => {
    const conv = conversations.find(c => c.patientId === pid);
    return { id: pid, name: conv?.patientName || pid };
  });

  const summarizeMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiRequest("POST", "/api/care-team-collab/ai/summarize-thread", { conversationId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Summary Generated", description: "AI thread summary is ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Summarization Failed", description: error.message || "Unable to generate thread summary. Please try again.", variant: "destructive" });
    },
  });

  const suggestionsMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiRequest("POST", "/api/care-team-collab/ai/suggest-relevant-info", { patientId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Suggestions Ready", description: "AI has identified relevant information for your review." });
    },
    onError: (error: Error) => {
      toast({ title: "Suggestions Failed", description: error.message || "Unable to get relevant info. Please try again.", variant: "destructive" });
    },
  });

  const draftMutation = useMutation({
    mutationFn: async (data: { patientId: string; draftType: string; context: string }) => {
      const response = await apiRequest("POST", "/api/care-team-collab/ai/draft-follow-up", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Generated", description: "AI has drafted a follow-up for your review." });
    },
    onError: (error: Error) => {
      toast({ title: "Draft Generation Failed", description: error.message || "Unable to generate draft. Please try again.", variant: "destructive" });
    },
  });

  const urgencyColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-500 border-red-500/30",
    medium: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    low: "bg-green-500/10 text-green-500 border-green-500/30",
    immediate: "bg-red-500/10 text-red-500 border-red-500/30",
    soon: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    routine: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-no-cds-disclaimer">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT clinical decision support.</strong> AI assists with coordination only. All clinical decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card data-testid="card-thread-summarizer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Thread Summarizer
            </CardTitle>
            <CardDescription>Get AI summaries of team conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Conversation</Label>
              <Select value={selectedConversation} onValueChange={setSelectedConversation}>
                <SelectTrigger data-testid="select-conversation-summarize">
                  <SelectValue placeholder="Choose a conversation..." />
                </SelectTrigger>
                <SelectContent>
                  {conversations.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.patientName} - {c.lastMessagePreview.slice(0, 30)}...</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => selectedConversation && summarizeMutation.mutate(selectedConversation)}
              disabled={!selectedConversation || summarizeMutation.isPending}
              data-testid="button-summarize-thread"
            >
              {summarizeMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Summarizing...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Summarize Thread</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-relevant-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Relevant Info
            </CardTitle>
            <CardDescription>AI-suggested items for review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Patient</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger data-testid="select-patient-suggestions">
                  <SelectValue placeholder="Choose a patient..." />
                </SelectTrigger>
                <SelectContent>
                  {uniquePatients.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => selectedPatientId && suggestionsMutation.mutate(selectedPatientId)}
              disabled={!selectedPatientId || suggestionsMutation.isPending}
              data-testid="button-get-suggestions"
            >
              {suggestionsMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
              ) : (
                <><Lightbulb className="h-4 w-4 mr-2" />Get Suggestions</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-draft-generator">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Draft Generator
            </CardTitle>
            <CardDescription>AI-drafted messages or tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Patient</Label>
              <Select value={draftPatientId} onValueChange={setDraftPatientId}>
                <SelectTrigger data-testid="select-patient-draft">
                  <SelectValue placeholder="Choose a patient..." />
                </SelectTrigger>
                <SelectContent>
                  {uniquePatients.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Draft Type</Label>
              <Select value={draftType} onValueChange={(v) => setDraftType(v as "message" | "task")}>
                <SelectTrigger data-testid="select-draft-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Follow-up Message</SelectItem>
                  <SelectItem value="task">Task Assignment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context (optional)</Label>
              <Input
                value={draftContext}
                onChange={(e) => setDraftContext(e.target.value)}
                placeholder="Recent event or reason..."
                data-testid="input-draft-context"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => draftPatientId && draftMutation.mutate({ patientId: draftPatientId, draftType, context: draftContext })}
              disabled={!draftPatientId || draftMutation.isPending}
              data-testid="button-generate-draft"
            >
              {draftMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Drafting...</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" />Generate Draft</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {summarizeMutation.data?.summary && (
        <Card data-testid="card-thread-summary-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Thread Summary
            </CardTitle>
            <CardDescription data-testid="text-summary-meta">
              {summarizeMutation.data.messageCount} messages analyzed for {summarizeMutation.data.patientName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500/30 bg-blue-500/10" data-testid="alert-summary-disclaimer">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                {summarizeMutation.data.disclaimer}
              </AlertDescription>
            </Alert>

            <div className="p-4 rounded-lg bg-muted/50" data-testid="text-overall-summary">
              <p className="text-sm">{summarizeMutation.data.summary.overallSummary}</p>
            </div>

            {summarizeMutation.data.summary.keyTopics?.length > 0 && (
              <div data-testid="section-key-topics">
                <h4 className="font-medium text-sm mb-2">Key Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {summarizeMutation.data.summary.keyTopics.map((topic: string, i: number) => (
                    <Badge key={i} variant="secondary" data-testid={`badge-topic-${i}`}>{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            {summarizeMutation.data.summary.actionItems?.length > 0 && (
              <div data-testid="section-action-items">
                <h4 className="font-medium text-sm mb-2">Action Items</h4>
                <div className="space-y-2">
                  {summarizeMutation.data.summary.actionItems.map((item: { description: string; priority: string; suggestedAssignee?: string }, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded border" data-testid={`item-action-${i}`}>
                      <Badge variant="outline" className={urgencyColors[item.priority]} data-testid={`badge-priority-${i}`}>{item.priority}</Badge>
                      <div className="flex-1">
                        <p className="text-sm">{item.description}</p>
                        {item.suggestedAssignee && <p className="text-xs text-muted-foreground">Assign to: {item.suggestedAssignee}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summarizeMutation.data.summary.pendingQuestions?.length > 0 && (
              <div data-testid="section-pending-questions">
                <h4 className="font-medium text-sm mb-2">Pending Questions</h4>
                <ul className="space-y-1">
                  {summarizeMutation.data.summary.pendingQuestions.map((q: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`item-question-${i}`}>
                      <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {suggestionsMutation.data?.suggestions && (
        <Card data-testid="card-suggestions-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Relevant Information
            </CardTitle>
            <CardDescription>AI-identified items requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500/30 bg-blue-500/10" data-testid="alert-suggestions-disclaimer">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                {suggestionsMutation.data.disclaimer}
              </AlertDescription>
            </Alert>

            {suggestionsMutation.data.suggestions.priorityItems?.length > 0 && (
              <div data-testid="section-priority-items">
                <h4 className="font-medium text-sm mb-2">Priority Items</h4>
                <div className="space-y-2">
                  {suggestionsMutation.data.suggestions.priorityItems.map((item: { type: string; title: string; reason: string; urgency: string }, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded border" data-testid={`item-priority-${i}`}>
                      <Badge variant="outline" className={urgencyColors[item.urgency]} data-testid={`badge-urgency-${i}`}>{item.urgency}</Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-type-${i}`}>{item.type}</Badge>
                          <span className="font-medium text-sm" data-testid={`text-title-${i}`}>{item.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestionsMutation.data.suggestions.communicationGaps?.length > 0 && (
              <div data-testid="section-communication-gaps">
                <h4 className="font-medium text-sm mb-2 text-amber-600">Communication Gaps</h4>
                <div className="space-y-2">
                  {suggestionsMutation.data.suggestions.communicationGaps.map((gap: { description: string; suggestion: string }, i: number) => (
                    <div key={i} className="p-3 rounded border border-amber-500/30 bg-amber-500/5" data-testid={`item-gap-${i}`}>
                      <p className="text-sm font-medium">{gap.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Suggestion: {gap.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestionsMutation.data.suggestions.upcomingDeadlines?.length > 0 && (
              <div data-testid="section-deadlines">
                <h4 className="font-medium text-sm mb-2">Upcoming Deadlines</h4>
                <div className="space-y-1">
                  {suggestionsMutation.data.suggestions.upcomingDeadlines.map((d: { task: string; dueDate: string; status: string }, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border text-sm" data-testid={`item-deadline-${i}`}>
                      <span>{d.task}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid={`badge-deadline-status-${i}`}>{d.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(d.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {draftMutation.data?.draft && (
        <Card data-testid="card-draft-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Generated {draftMutation.data.draft.type === "task" ? "Task" : "Message"} Draft
            </CardTitle>
            <CardDescription>Review and modify before using</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500/30 bg-blue-500/10" data-testid="alert-draft-disclaimer">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                {draftMutation.data.disclaimer}
              </AlertDescription>
            </Alert>

            {draftMutation.data.draft.suggestedTitle && (
              <div data-testid="section-draft-title">
                <Label className="text-sm text-muted-foreground">Suggested Title</Label>
                <p className="font-medium" data-testid="text-draft-title">{draftMutation.data.draft.suggestedTitle}</p>
              </div>
            )}

            <div data-testid="section-draft-content">
              <Label className="text-sm text-muted-foreground">Suggested Content</Label>
              <div className="p-3 rounded border bg-muted/50 mt-1">
                <p className="text-sm" data-testid="text-draft-content">{draftMutation.data.draft.suggestedContent}</p>
              </div>
            </div>

            <div className="p-3 rounded bg-muted/30" data-testid="text-draft-rationale">
              <p className="text-xs text-muted-foreground"><strong>Rationale:</strong> {draftMutation.data.draft.rationale}</p>
            </div>

            {draftMutation.data.draft.suggestedAssignees?.length > 0 && (
              <div className="flex items-center gap-2" data-testid="section-draft-assignees">
                <Label className="text-sm text-muted-foreground">Suggested Assignees:</Label>
                {draftMutation.data.draft.suggestedAssignees.map((a: string, i: number) => (
                  <Badge key={i} variant="outline" data-testid={`badge-assignee-${i}`}>{a}</Badge>
                ))}
              </div>
            )}

            {draftMutation.data.draft.alternatives?.length > 0 && (
              <div data-testid="section-draft-alternatives">
                <Label className="text-sm text-muted-foreground">Alternatives</Label>
                <div className="space-y-2 mt-1">
                  {draftMutation.data.draft.alternatives.map((alt: { content: string; reason: string }, i: number) => (
                    <div key={i} className="p-2 rounded border text-sm" data-testid={`item-alternative-${i}`}>
                      <p>{alt.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alt.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-amber-600" data-testid="text-draft-important-note"><strong>Important:</strong> {draftMutation.data.importantNote}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
