import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Calendar, 
  Video, 
  FileText, 
  Bell, 
  Send, 
  Phone, 
  Clock, 
  Check, 
  CheckCheck,
  Download,
  Eye,
  AlertCircle,
  User,
  Users,
  Pin,
  Archive,
  Search,
  Plus,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";

interface Participant {
  id: string;
  name: string;
  role: "patient" | "provider" | "caregiver" | "admin" | "care_team";
  avatar?: string;
  status?: "online" | "away" | "offline";
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  contentType: string;
  status: string;
  readBy: { userId: string; readAt: string }[];
  createdAt: string;
}

interface Conversation {
  id: string;
  type: string;
  subject?: string;
  participants: Participant[];
  lastMessage?: Message;
  unreadCount: number;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SharedDocument {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  documentId: string;
  documentName: string;
  documentType: string;
  documentSize: number;
  message?: string;
  status: string;
  accessCount: number;
  firstAccessedAt?: string;
  lastAccessedAt?: string;
  accessLog: { accessedAt: string; accessedBy: string; accessType: string }[];
  createdAt: string;
}

interface TelehealthSession {
  id: string;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  status: string;
  roomUrl: string;
  waitingRoomEnabled: boolean;
  createdAt: string;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

interface HubStats {
  unreadMessages: number;
  pendingDocuments: number;
  upcomingAppointments: number;
  activeTelehealthSessions: number;
  unreadNotifications: number;
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    accessed: "default",
    expired: "destructive",
    scheduled: "outline",
    waiting: "secondary",
    in_progress: "default",
    completed: "default",
  };
  return variants[status] || "secondary";
}

export default function CommunicationHub() {
  const [activeTab, setActiveTab] = useState("messages");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: stats } = useQuery<HubStats>({
    queryKey: ["/api/communication-hub/stats"],
    queryFn: () => fetch("/api/communication-hub/stats").then(r => r.json()),
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/communication-hub/conversations"],
    queryFn: () => fetch("/api/communication-hub/conversations").then(r => r.json()),
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/communication-hub/conversations", selectedConversation, "messages"],
    queryFn: () => 
      selectedConversation 
        ? fetch(`/api/communication-hub/conversations/${selectedConversation}/messages`).then(r => r.json())
        : Promise.resolve([]),
    enabled: !!selectedConversation,
  });

  const { data: documents = [] } = useQuery<SharedDocument[]>({
    queryKey: ["/api/communication-hub/documents"],
    queryFn: () => fetch("/api/communication-hub/documents").then(r => r.json()),
  });

  const { data: telehealthSessions = [] } = useQuery<TelehealthSession[]>({
    queryKey: ["/api/communication-hub/telehealth"],
    queryFn: () => fetch("/api/communication-hub/telehealth").then(r => r.json()),
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/communication-hub/notifications"],
    queryFn: () => fetch("/api/communication-hub/notifications").then(r => r.json()),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      return apiRequest(
        "POST",
        `/api/communication-hub/conversations/${data.conversationId}/messages`,
        { content: data.content, contentType: "text" }
      );
    },
    onSuccess: () => {
      setMessageInput("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/stats"] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const accessDocumentMutation = useMutation({
    mutationFn: async (data: { shareId: string; accessType: string }) => {
      return apiRequest(
        "POST",
        `/api/communication-hub/documents/${data.shareId}/access`,
        { accessType: data.accessType }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/stats"] });
      toast({ title: "Document accessed" });
    },
  });

  const startTelehealthMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(
        "POST",
        `/api/communication-hub/telehealth/${sessionId}/start`
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/telehealth"] });
      if (data.roomUrl) {
        window.open(data.roomUrl, "_blank");
      }
      toast({ title: "Telehealth session started" });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(
        "PATCH",
        `/api/communication-hub/notifications/${notificationId}/read`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-hub/stats"] });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({ conversationId: selectedConversation, content: messageInput });
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  const filteredConversations = conversations.filter(c => 
    !searchQuery || 
    c.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.participants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="page-communication-hub">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-hub-title">Communication Hub</h1>
            <p className="text-muted-foreground">Unified messaging, appointments, telehealth, and document sharing</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stats && (
              <>
                {stats.unreadMessages > 0 && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-unread-messages">
                    <MessageSquare className="w-3 h-3" /> {stats.unreadMessages} unread
                  </Badge>
                )}
                {stats.pendingDocuments > 0 && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-pending-docs">
                    <FileText className="w-3 h-3" /> {stats.pendingDocuments} pending
                  </Badge>
                )}
                {stats.upcomingAppointments > 0 && (
                  <Badge variant="outline" className="gap-1" data-testid="badge-upcoming-appointments">
                    <Calendar className="w-3 h-3" /> {stats.upcomingAppointments} upcoming
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger value="telehealth" className="gap-2" data-testid="tab-telehealth">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Telehealth</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2" data-testid="tab-appointments">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Appointments</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alerts</span>
              {stats && stats.unreadNotifications > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {stats.unreadNotifications}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
              <Card className="lg:col-span-1 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search conversations..." 
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-conversations"
                      />
                    </div>
                    <Button size="icon" variant="outline" data-testid="button-new-conversation">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <div className="px-4 pb-4 space-y-2">
                    {conversationsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : filteredConversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No conversations</div>
                    ) : (
                      filteredConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors hover-elevate ${
                            selectedConversation === conv.id 
                              ? "bg-accent" 
                              : "hover:bg-muted"
                          }`}
                          {...clickable(() => setSelectedConversation(conv.id))}
                          data-testid={`conversation-${conv.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback>
                                {conv.type === "care_team" ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {conv.isPinned && <Pin className="w-3 h-3 text-muted-foreground" />}
                                <span className="font-medium truncate">
                                  {conv.subject || conv.participants.map(p => p.name).join(", ")}
                                </span>
                                {conv.unreadCount > 0 && (
                                  <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5">
                                    {conv.unreadCount}
                                  </Badge>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-sm text-muted-foreground truncate mt-0.5">
                                  {conv.lastMessage.content}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {conv.type.replace("_", " ")}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(conv.updatedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </Card>

              <Card className="lg:col-span-2 flex flex-col">
                {selectedConv ? (
                  <>
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {selectedConv.subject || selectedConv.participants.map(p => p.name).join(", ")}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Users className="w-3 h-3" />
                            {selectedConv.participants.length} participants
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost">
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <Video className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.senderId === "patient-001" ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[70%] ${msg.senderId === "patient-001" ? "order-2" : ""}`}>
                              <div
                                className={`p-3 rounded-lg ${
                                  msg.senderId === "patient-001"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                <p className="text-sm font-medium mb-1">{msg.senderName}</p>
                                <p>{msg.content}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{formatTime(msg.createdAt)}</span>
                                {msg.senderId === "patient-001" && (
                                  msg.readBy.length > 0 ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <CardFooter className="border-t p-3">
                      <div className="flex gap-2 w-full">
                        <Textarea
                          placeholder="Type a message..."
                          className="min-h-[44px] max-h-32 resize-none"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          data-testid="input-message"
                        />
                        <Button 
                          onClick={handleSendMessage} 
                          disabled={!messageInput.trim() || sendMessageMutation.isPending}
                          data-testid="button-send-message"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to view messages</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No shared documents</p>
                  </CardContent>
                </Card>
              ) : (
                documents.map((doc) => (
                  <Card key={doc.id} data-testid={`document-${doc.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-medium">{doc.documentName}</CardTitle>
                            <CardDescription className="text-xs">
                              {formatFileSize(doc.documentSize)}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={getStatusBadge(doc.status)}>{doc.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground">From: {doc.senderName}</p>
                        {doc.message && <p className="mt-2 italic">"{doc.message}"</p>}
                      </div>
                      
                      {doc.accessLog.length > 0 && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Read Receipt
                          </p>
                          {doc.accessLog.slice(-2).map((log, i) => (
                            <p key={i}>
                              {log.accessType} - {formatTime(log.accessedAt)}
                            </p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 gap-1"
                        onClick={() => accessDocumentMutation.mutate({ shareId: doc.id, accessType: "view" })}
                        data-testid={`button-view-document-${doc.id}`}
                      >
                        <Eye className="w-3 h-3" /> View
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 gap-1"
                        onClick={() => accessDocumentMutation.mutate({ shareId: doc.id, accessType: "download" })}
                        data-testid={`button-download-document-${doc.id}`}
                      >
                        <Download className="w-3 h-3" /> Download
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="telehealth" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {telehealthSessions.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No telehealth sessions scheduled</p>
                  </CardContent>
                </Card>
              ) : (
                telehealthSessions.map((session) => (
                  <Card key={session.id} data-testid={`telehealth-session-${session.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback>
                              <Video className="w-5 h-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{session.providerName}</CardTitle>
                            <CardDescription>Video Visit</CardDescription>
                          </div>
                        </div>
                        <Badge variant={getStatusBadge(session.status)}>{session.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDate(session.scheduledAt)}</span>
                      </div>
                      {session.waitingRoomEnabled && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>Waiting room enabled</span>
                        </div>
                      )}
                      {session.duration && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>Duration: {session.duration} minutes</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      {session.status === "scheduled" && new Date(session.scheduledAt) <= new Date(Date.now() + 15 * 60 * 1000) ? (
                        <Button 
                          className="w-full gap-2" 
                          onClick={() => startTelehealthMutation.mutate(session.id)}
                          disabled={startTelehealthMutation.isPending}
                          data-testid={`button-join-telehealth-${session.id}`}
                        >
                          <Video className="w-4 h-4" /> Join Session
                        </Button>
                      ) : session.status === "waiting" || session.status === "in_progress" ? (
                        <Button 
                          className="w-full gap-2"
                          onClick={() => window.open(session.roomUrl, "_blank")}
                          data-testid={`button-rejoin-telehealth-${session.id}`}
                        >
                          <ExternalLink className="w-4 h-4" /> Rejoin Session
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full" disabled>
                          {session.status === "completed" ? "Session Completed" : `Starts ${formatDate(session.scheduledAt)}`}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Appointments</CardTitle>
                    <CardDescription>View and manage your scheduled appointments</CardDescription>
                  </div>
                  <Button variant="outline" className="gap-2" data-testid="button-schedule-appointment">
                    <Plus className="w-4 h-4" /> Schedule New
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>View appointments in the Telehealth tab or visit the Appointments page</p>
                  <Button variant="ghost" className="mt-2" data-testid="button-go-appointments">Go to Appointments</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Recent Notifications</h3>
              <Button variant="ghost" size="sm" className="gap-1" data-testid="button-refresh-notifications">
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No notifications</p>
                  </CardContent>
                </Card>
              ) : (
                notifications.map((notif) => (
                  <Card 
                    key={notif.id} 
                    className={`${!notif.read ? "border-l-4 border-l-primary" : ""}`}
                    data-testid={`notification-${notif.id}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${
                          notif.priority === "urgent" ? "bg-destructive/10" :
                          notif.priority === "high" ? "bg-orange-100 dark:bg-orange-900/20" :
                          "bg-muted"
                        }`}>
                          {notif.type === "message" ? <MessageSquare className="w-4 h-4" /> :
                           notif.type === "document" ? <FileText className="w-4 h-4" /> :
                           notif.type === "telehealth" ? <Video className="w-4 h-4" /> :
                           notif.type === "appointment" ? <Calendar className="w-4 h-4" /> :
                           <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{notif.title}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTime(notif.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">{notif.type}</Badge>
                            {notif.priority !== "normal" && (
                              <Badge variant={notif.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                                {notif.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!notif.read && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => markNotificationReadMutation.mutate(notif.id)}
                            data-testid={`button-mark-read-${notif.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              <AlertCircle className="w-4 h-4 inline-block mr-1" />
              All communications are secure and HIPAA-compliant. Messages are encrypted in transit and at rest.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
