import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import {
  Users,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Plus,
  Bell,
  User,
  Activity,
  ClipboardList,
  ChevronRight,
  Send,
  Hash,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Circle,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface GroupChannel {
  id: string;
  name: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  members: ChannelMember[];
  messages: ChannelMessage[];
  status: "active" | "resolved" | "archived";
}

interface ChannelMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  joinedAt: string;
}

interface ChannelMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: "message" | "update" | "alert" | "summary";
  priority?: "normal" | "high" | "urgent";
}

interface CareTeamTask {
  id: string;
  carePlanId: string;
  patientId: string;
  title: string;
  description?: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: "pending" | "in_progress" | "completed" | "cancelled" | "overdue";
  category: string;
  assignedTo: string;
  assignedBy: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

interface PatientSummary {
  patientId: string;
  patientName: string;
  conditions: string[];
  recentEvents: string[];
  pendingActions: string[];
  riskLevel: "high" | "medium" | "low";
}

interface WorkspaceStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeChannels: number;
  unreadMessages: number;
  teamMembers: number;
  criticalPatients: number;
}

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
  cancelled: "bg-gray-500/10 text-gray-500",
  overdue: "bg-red-500/10 text-red-500",
};

const riskColors: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-green-500 text-white",
};

const roleLabels: Record<string, string> = {
  primary_physician: "Primary Physician",
  specialist: "Specialist",
  nurse: "Nurse",
  care_coordinator: "Care Coordinator",
  pharmacist: "Pharmacist",
  therapist: "Therapist",
  social_worker: "Social Worker",
  caregiver: "Caregiver",
  other: "Other",
};

function MessageBubble({ message, isOwn }: { message: ChannelMessage; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`} data-testid={`message-${message.id}`}>
      <div className={`max-w-[70%] ${isOwn ? "order-2" : "order-1"}`}>
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {message.senderName.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{message.senderName}</span>
          </div>
        )}
        <div className={`rounded-lg p-3 ${
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : message.type === "alert" 
              ? "bg-red-500/10 border border-red-500/30" 
              : message.type === "update"
                ? "bg-blue-500/10 border border-blue-500/30"
                : "bg-muted"
        }`}>
          {message.priority === "urgent" && (
            <Badge className="mb-2 bg-red-500 text-white">Urgent</Badge>
          )}
          <p className="text-sm">{message.content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function ChannelCard({ 
  channel, 
  isSelected, 
  onClick 
}: { 
  channel: GroupChannel; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const unreadCount = channel.messages.filter(m => m.type === "alert").length;
  const lastMessage = channel.messages[channel.messages.length - 1];
  
  return (
    <Card 
      className={`cursor-pointer hover-elevate ${isSelected ? "border-primary bg-primary/5" : ""}`}
      onClick={onClick}
      data-testid={`channel-card-${channel.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="font-medium truncate">{channel.name}</h4>
              <p className="text-xs text-muted-foreground truncate">
                Patient: {channel.patientName}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={channel.status === "active" ? "border-green-500 text-green-500" : ""}>
              {channel.status}
            </Badge>
            {unreadCount > 0 && (
              <Badge className="bg-red-500">{unreadCount}</Badge>
            )}
          </div>
        </div>
        {lastMessage && (
          <p className="text-xs text-muted-foreground mt-2 truncate">
            {lastMessage.senderName}: {lastMessage.content}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{channel.members.length} members</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskAssignmentCard({ 
  task, 
  onComplete,
  onAssign
}: { 
  task: CareTeamTask; 
  onComplete: (taskId: string) => void;
  onAssign: (task: CareTeamTask) => void;
}) {
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "cancelled";
  
  return (
    <Card className={`border-l-4 ${priorityColors[task.priority]}`} data-testid={`task-card-${task.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1">
            <h4 className="font-medium">{task.title}</h4>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[isOverdue ? "overdue" : task.status]}>
              {isOverdue ? "Overdue" : task.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">{task.category}</Badge>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {task.assignedTo}
            </span>
          </div>
          <div className="flex gap-2">
            {task.status !== "completed" && task.status !== "cancelled" && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAssign(task)}
                  data-testid={`button-reassign-${task.id}`}
                >
                  Reassign
                </Button>
                <Button 
                  size="sm"
                  onClick={() => onComplete(task.id)}
                  data-testid={`button-complete-${task.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientStatusCard({ patient }: { patient: PatientSummary }) {
  return (
    <Card data-testid={`patient-status-${patient.patientId}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {patient.patientName.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium">{patient.patientName}</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {patient.conditions.slice(0, 2).map((condition, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{condition}</Badge>
                ))}
                {patient.conditions.length > 2 && (
                  <Badge variant="outline" className="text-xs">+{patient.conditions.length - 2}</Badge>
                )}
              </div>
            </div>
          </div>
          <Badge className={riskColors[patient.riskLevel]}>
            {patient.riskLevel.toUpperCase()} Risk
          </Badge>
        </div>
        
        <Separator className="my-3" />
        
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Recent Events</p>
            <ul className="space-y-1">
              {patient.recentEvents.slice(0, 2).map((event, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <Circle className="h-2 w-2 text-blue-500 flex-shrink-0" />
                  {event}
                </li>
              ))}
            </ul>
          </div>
          
          {patient.pendingActions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Pending Actions</p>
              <ul className="space-y-1">
                {patient.pendingActions.slice(0, 2).map((action, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamWorkspace() {
  useSEO({ 
    title: "Team Workspace - Tabula Medica", 
    description: "Collaborative care team workspace with secure messaging, task assignment, and patient tracking" 
  });
  
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<GroupChannel | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CareTeamTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels, isLoading: channelsLoading } = useQuery<GroupChannel[]>({
    queryKey: ["/api/care-team/channels"],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<CareTeamTask[]>({
    queryKey: ["/api/care-team/tasks"],
  });

  const { data: patientSummaries, isLoading: summariesLoading } = useQuery<PatientSummary[]>({
    queryKey: ["/api/care-team/patient-summaries"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ channelId, content }: { channelId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/care-team/channels/${channelId}/messages`, { content, type: "message", priority: "normal" });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/channels", variables.channelId] });
      setNewMessage("");
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PATCH", `/api/care-team/tasks/${taskId}`, { status: "completed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/tasks"] });
      toast({ title: "Task completed" });
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; patientId: string; patientName: string }) => {
      const res = await apiRequest("POST", "/api/care-team/channels", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/channels"] });
      setShowCreateChannel(false);
      toast({ title: "Channel created" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/care-team/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/tasks"] });
      setShowCreateTask(false);
      toast({ title: "Task created and assigned" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChannel?.messages]);

  const filteredTasks = tasks?.filter(task => {
    if (taskFilter === "all") return true;
    if (taskFilter === "overdue") return new Date(task.dueDate) < new Date() && task.status !== "completed";
    return task.status === taskFilter;
  }) || [];

  const workspaceStats: WorkspaceStats = {
    totalTasks: tasks?.length || 0,
    completedTasks: tasks?.filter(t => t.status === "completed").length || 0,
    overdueTasks: tasks?.filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed").length || 0,
    activeChannels: channels?.filter(c => c.status === "active").length || 0,
    unreadMessages: channels?.reduce((sum, c) => sum + c.messages.filter(m => m.type === "alert").length, 0) || 0,
    teamMembers: 8,
    criticalPatients: patientSummaries?.filter(p => p.riskLevel === "high").length || 0,
  };

  const taskCompletionRate = workspaceStats.totalTasks > 0 
    ? Math.round((workspaceStats.completedTasks / workspaceStats.totalTasks) * 100) 
    : 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team Workspace</h1>
          <p className="text-muted-foreground">Collaborate with your care team on patient care</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateChannel(true)} data-testid="button-create-channel">
            <Hash className="h-4 w-4 mr-2" />
            New Channel
          </Button>
          <Button onClick={() => setShowCreateTask(true)} data-testid="button-create-task">
            <Plus className="h-4 w-4 mr-2" />
            Assign Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Progress</p>
                <p className="text-2xl font-bold">{taskCompletionRate}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
            </div>
            <Progress value={taskCompletionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {workspaceStats.completedTasks} of {workspaceStats.totalTasks} completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                <p className="text-2xl font-bold text-red-500">{workspaceStats.overdueTasks}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Require immediate attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Channels</p>
                <p className="text-2xl font-bold">{workspaceStats.activeChannels}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            {workspaceStats.unreadMessages > 0 && (
              <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {workspaceStats.unreadMessages} unread alerts
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Patients</p>
                <p className="text-2xl font-bold text-orange-500">{workspaceStats.criticalPatients}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">High-risk patients needing attention</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="messaging" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messaging" data-testid="tab-messaging">
            <MessageSquare className="h-4 w-4 mr-2" />
            Team Messaging
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            Task Board
          </TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">
            <Users className="h-4 w-4 mr-2" />
            Patient Status
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Team Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messaging">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Channels</CardTitle>
                  <Button size="icon" variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/care-team/channels"] })}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search channels..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-channels"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {channelsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : !channels || channels.length === 0 ? (
                    <div className="text-center py-8">
                      <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No channels yet</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setShowCreateChannel(true)}
                      >
                        Create First Channel
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {channels
                        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     c.patientName.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(channel => (
                          <ChannelCard
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannel?.id === channel.id}
                            onClick={() => setSelectedChannel(channel)}
                          />
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              {selectedChannel ? (
                <>
                  <CardHeader className="pb-2 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Hash className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{selectedChannel.name}</CardTitle>
                          <CardDescription>Patient: {selectedChannel.patientName}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedChannel.members.length} members</Badge>
                        <Button size="sm" variant="outline">
                          <Users className="h-4 w-4 mr-1" />
                          Members
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[350px] p-4">
                      {selectedChannel.messages.map(message => (
                        <MessageBubble 
                          key={message.id} 
                          message={message} 
                          isOwn={message.senderId === "clinician-default"}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="border-t p-3">
                    <div className="flex gap-2 w-full">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newMessage.trim()) {
                            sendMessageMutation.mutate({ 
                              channelId: selectedChannel.id, 
                              content: newMessage 
                            });
                          }
                        }}
                        data-testid="input-new-message"
                      />
                      <Button 
                        onClick={() => {
                          if (newMessage.trim()) {
                            sendMessageMutation.mutate({ 
                              channelId: selectedChannel.id, 
                              content: newMessage 
                            });
                          }
                        }}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </>
              ) : (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium text-lg">Select a channel</h3>
                    <p className="text-muted-foreground">Choose a channel to start messaging</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Team Task Board
                  </CardTitle>
                  <CardDescription>Manage and assign tasks from care plans</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={taskFilter} onValueChange={setTaskFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-task-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setShowCreateTask(true)} data-testid="button-new-task">
                    <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No tasks found</p>
                  <p className="text-sm text-muted-foreground">Create a task to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map(task => (
                    <TaskAssignmentCard
                      key={task.id}
                      task={task}
                      onComplete={(taskId) => completeTaskMutation.mutate(taskId)}
                      onAssign={(t) => {
                        setSelectedTask(t);
                        setShowAssignTask(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Patient Status Dashboard
              </CardTitle>
              <CardDescription>Monitor patient conditions and pending actions</CardDescription>
            </CardHeader>
            <CardContent>
              {summariesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
                </div>
              ) : !patientSummaries || patientSummaries.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No patient summaries available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patientSummaries.map(patient => (
                    <PatientStatusCard key={patient.patientId} patient={patient} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Task Completion Rate</span>
                    <span className="text-sm font-medium">{taskCompletionRate}%</span>
                  </div>
                  <Progress value={taskCompletionRate} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response Time</span>
                    <span className="text-sm font-medium">85%</span>
                  </div>
                  <Progress value={85} className="bg-blue-100" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Collaboration Score</span>
                    <span className="text-sm font-medium">92%</span>
                  </div>
                  <Progress value={92} className="bg-green-100" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-4">
                    {[
                      { action: "Task completed", user: "Dr. Smith", time: "2 min ago", icon: CheckCircle, color: "text-green-500" },
                      { action: "New message", user: "Nurse Johnson", time: "15 min ago", icon: MessageSquare, color: "text-blue-500" },
                      { action: "Patient alert", user: "System", time: "1 hour ago", icon: AlertCircle, color: "text-orange-500" },
                      { action: "Task assigned", user: "Dr. Wilson", time: "2 hours ago", icon: ClipboardList, color: "text-primary" },
                      { action: "Handoff completed", user: "Care Coordinator", time: "3 hours ago", icon: ArrowRight, color: "text-green-500" },
                    ].map((activity, i) => (
                      <div key={i} className="flex items-center gap-3" data-testid={`activity-${i}`}>
                        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center`}>
                          <activity.icon className={`h-4 w-4 ${activity.color}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">{activity.user} - {activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Channel</DialogTitle>
            <DialogDescription>Create a secure messaging channel for patient care coordination</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createChannelMutation.mutate({
              name: formData.get("name") as string,
              patientId: formData.get("patientId") as string,
              patientName: formData.get("patientName") as string,
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Channel Name</Label>
                <Input id="name" name="name" placeholder="e.g., Diabetes Management Team" required data-testid="input-channel-name" />
              </div>
              <div>
                <Label htmlFor="patientId">Patient ID</Label>
                <Input id="patientId" name="patientId" placeholder="Enter patient ID" required data-testid="input-patient-id" />
              </div>
              <div>
                <Label htmlFor="patientName">Patient Name</Label>
                <Input id="patientName" name="patientName" placeholder="Enter patient name" required data-testid="input-patient-name" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowCreateChannel(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createChannelMutation.isPending} data-testid="button-submit-channel">
                {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create & Assign Task</DialogTitle>
            <DialogDescription>Create a new task from care plan or risk assessment</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createTaskMutation.mutate({
              carePlanId: "care-plan-1",
              patientId: "patient-1",
              title: formData.get("title"),
              description: formData.get("description"),
              priority: formData.get("priority"),
              category: formData.get("category"),
              assignedTo: formData.get("assignedTo"),
              assignedBy: "current-user",
              dueDate: new Date(formData.get("dueDate") as string).toISOString(),
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Task Title</Label>
                <Input id="title" name="title" placeholder="Enter task title" required data-testid="input-task-title" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Task details..." data-testid="input-task-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" defaultValue="normal">
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="follow_up">
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assessment">Assessment</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="documentation">Documentation</SelectItem>
                      <SelectItem value="coordination">Coordination</SelectItem>
                      <SelectItem value="patient_education">Patient Education</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="assignedTo">Assign To</Label>
                <Select name="assignedTo" defaultValue="nurse-johnson">
                  <SelectTrigger data-testid="select-assigned-to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dr-smith">Dr. Sarah Smith</SelectItem>
                    <SelectItem value="nurse-johnson">Nurse Emily Johnson</SelectItem>
                    <SelectItem value="care-coord-1">Care Coordinator</SelectItem>
                    <SelectItem value="pharmacist-1">Pharmacist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate" 
                  name="dueDate" 
                  type="date" 
                  required 
                  defaultValue={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  data-testid="input-due-date"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowCreateTask(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                {createTaskMutation.isPending ? "Creating..." : "Create & Assign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignTask} onOpenChange={setShowAssignTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
            <DialogDescription>
              {selectedTask && `Reassign: "${selectedTask.title}"`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            setShowAssignTask(false);
            toast({ title: "Task reassigned" });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newAssignee">New Assignee</Label>
                <Select name="newAssignee" defaultValue="nurse-johnson">
                  <SelectTrigger data-testid="select-new-assignee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dr-smith">Dr. Sarah Smith</SelectItem>
                    <SelectItem value="nurse-johnson">Nurse Emily Johnson</SelectItem>
                    <SelectItem value="care-coord-1">Care Coordinator</SelectItem>
                    <SelectItem value="pharmacist-1">Pharmacist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reassignReason">Reason (optional)</Label>
                <Textarea id="reassignReason" name="reassignReason" placeholder="Why are you reassigning this task?" data-testid="input-reassign-reason" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowAssignTask(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="button-confirm-reassign">
                Reassign Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
