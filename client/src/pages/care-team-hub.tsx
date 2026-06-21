import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  MessageSquare,
  ArrowRightLeft,
  Plus,
  Bell,
  User,
  Activity,
  ClipboardList,
  ChevronRight,
  AlertTriangle,
  Send,
  RefreshCw,
  Phone,
  Mail,
  BarChart3,
  FileText,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Circle,
  Settings,
  Play,
  Award,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  CareTeamTask,
  CareHandoff,
  CareTeamNote,
  CareTeamActivity,
  CareTeamMember,
  CareTeamMemberExtended,
  CareProtocolTemplate,
  EscalationRule,
  EscalationEvent,
  TeamPerformanceMetrics,
} from "@shared/schema";

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

const handoffStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  acknowledged: "bg-blue-500/10 text-blue-500",
  accepted: "bg-green-500/10 text-green-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  declined: "bg-red-500/10 text-red-500",
};

const urgencyColors: Record<string, string> = {
  stat: "bg-red-500/10 text-red-500 border-red-500/30",
  urgent: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  routine: "bg-blue-500/10 text-blue-500 border-blue-500/30",
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

const categoryLabels: Record<string, string> = {
  assessment: "Assessment",
  medication: "Medication",
  follow_up: "Follow-up",
  documentation: "Documentation",
  coordination: "Coordination",
  patient_education: "Patient Education",
  other: "Other",
};

const activityIcons: Record<string, typeof Activity> = {
  task_created: ClipboardList,
  task_assigned: User,
  task_completed: CheckCircle,
  handoff_initiated: ArrowRightLeft,
  handoff_accepted: CheckCircle,
  handoff_completed: CheckCircle,
  note_added: MessageSquare,
  member_joined: Users,
  member_left: Users,
  goal_updated: Activity,
  intervention_completed: CheckCircle,
  patient_update: User,
  alert: Bell,
};

function TaskCard({ task, onComplete }: { task: CareTeamTask; onComplete: (taskId: string) => void }) {
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "cancelled";
  
  return (
    <Card className={`border-l-4 ${priorityColors[task.priority]}`} data-testid={`task-card-${task.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1">
            <CardTitle className="text-base">{task.title}</CardTitle>
            <CardDescription className="mt-1">{task.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[isOverdue ? "overdue" : task.status]}>
              {isOverdue ? "Overdue" : task.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">{categoryLabels[task.category]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Assigned to: {task.assignedTo}
            </span>
          </div>
          {task.status !== "completed" && task.status !== "cancelled" && (
            <Button 
              size="sm" 
              onClick={() => onComplete(task.id)}
              data-testid={`button-complete-task-${task.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HandoffCard({ handoff, onAccept }: { handoff: CareHandoff; onAccept: (handoffId: string) => void }) {
  return (
    <Card className={`border-l-4 ${urgencyColors[handoff.urgency]}`} data-testid={`handoff-card-${handoff.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Care Handoff</CardTitle>
            </div>
            <CardDescription className="mt-1">{handoff.reason}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={handoffStatusColors[handoff.status]}>
              {handoff.status}
            </Badge>
            <Badge variant="outline" className={urgencyColors[handoff.urgency]}>
              {handoff.urgency}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">From:</span>
          <span className="font-medium">{handoff.fromMemberName}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">To:</span>
          <span className="font-medium">{handoff.toMemberName}</span>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">Summary</p>
          <p className="text-sm text-muted-foreground">{handoff.summary}</p>
        </div>

        {handoff.criticalInfo.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Critical Information
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              {handoff.criticalInfo.map((info, i) => (
                <li key={i}>{info}</li>
              ))}
            </ul>
          </div>
        )}

        {handoff.pendingTasks.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Pending Tasks</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              {handoff.pendingTasks.map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
          </div>
        )}

        {handoff.status === "pending" && (
          <div className="flex gap-2">
            <Button onClick={() => onAccept(handoff.id)} data-testid={`button-accept-handoff-${handoff.id}`}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Accept Handoff
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NoteCard({ note }: { note: CareTeamNote }) {
  return (
    <Card data-testid={`note-card-${note.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{note.authorName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{note.authorName}</span>
                <Badge variant="outline" className="text-xs">{roleLabels[note.authorRole]}</Badge>
                {note.isUrgent && (
                  <Badge className="bg-red-500/10 text-red-500">Urgent</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm">{note.content}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity }: { activity: CareTeamActivity }) {
  const Icon = activityIcons[activity.type] || Activity;
  
  return (
    <div className="flex items-start gap-3 py-2" data-testid={`activity-item-${activity.id}`}>
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-medium">{activity.actorName}</span>
          <span className="text-muted-foreground"> {activity.description}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(activity.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default function CareTeamHubPage() {
  useSEO({
    title: "Care Team Hub - Tabula Medica",
    description: "Collaborate with your care team members",
  });

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showNewHandoffDialog, setShowNewHandoffDialog] = useState(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [selectedCarePlanId] = useState("cp-1");

  const { data: tasks, isLoading: tasksLoading } = useQuery<CareTeamTask[]>({
    queryKey: ["/api/care-team/tasks/care-plan", selectedCarePlanId],
  });

  const { data: handoffs, isLoading: handoffsLoading } = useQuery<CareHandoff[]>({
    queryKey: ["/api/care-team/handoffs/care-plan", selectedCarePlanId],
  });

  const { data: notes, isLoading: notesLoading } = useQuery<CareTeamNote[]>({
    queryKey: ["/api/care-team/notes/care-plan", selectedCarePlanId],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<CareTeamActivity[]>({
    queryKey: ["/api/care-team/activities/care-plan", selectedCarePlanId],
  });

  const { data: stats } = useQuery<{
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    overdueTasks: number;
    activeHandoffs: number;
    unreadNotes: number;
    recentActivityCount: number;
  }>({
    queryKey: [`/api/care-team/stats/${selectedCarePlanId}`],
  });

  // Advanced Care Team Management queries
  const { data: teamMembers, isLoading: membersLoading } = useQuery<CareTeamMemberExtended[]>({
    queryKey: ["/api/care-team/members"],
  });

  const { data: protocols, isLoading: protocolsLoading } = useQuery<CareProtocolTemplate[]>({
    queryKey: ["/api/care-team/protocols"],
  });

  const { data: escalationRules } = useQuery<EscalationRule[]>({
    queryKey: ["/api/care-team/escalation-rules"],
  });

  const { data: escalationEvents, isLoading: eventsLoading } = useQuery<EscalationEvent[]>({
    queryKey: ["/api/care-team/escalation-events"],
  });

  const { data: performanceMetrics, isLoading: metricsLoading } = useQuery<TeamPerformanceMetrics>({
    queryKey: ["/api/care-team/performance"],
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("PATCH", `/api/care-team/tasks/${taskId}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/tasks/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/activities/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: [`/api/care-team/stats/${selectedCarePlanId}`] });
      toast({ title: "Task completed", description: "The task has been marked as completed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete task.", variant: "destructive" });
    },
  });

  const acceptHandoffMutation = useMutation({
    mutationFn: async (handoffId: string) => {
      return apiRequest("PATCH", `/api/care-team/handoffs/${handoffId}`, { status: "accepted" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/handoffs/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/activities/care-plan", selectedCarePlanId] });
      toast({ title: "Handoff accepted", description: "You have accepted this care handoff." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept handoff.", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/care-team/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/tasks/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/activities/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: [`/api/care-team/stats/${selectedCarePlanId}`] });
      setShowNewTaskDialog(false);
      toast({ title: "Task created", description: "New task has been assigned." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/care-team/notes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/notes/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/activities/care-plan", selectedCarePlanId] });
      setShowNewNoteDialog(false);
      toast({ title: "Note added", description: "Your note has been shared with the team." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    },
  });

  const createHandoffMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/care-team/handoffs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/handoffs/care-plan", selectedCarePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/activities/care-plan", selectedCarePlanId] });
      setShowNewHandoffDialog(false);
      toast({ title: "Handoff initiated", description: "Care handoff has been sent to the team member." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create handoff.", variant: "destructive" });
    },
  });

  const pendingTasks = tasks?.filter(t => t.status === "pending" || t.status === "in_progress") || [];
  const activeHandoffs = handoffs?.filter(h => h.status !== "completed" && h.status !== "declined") || [];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Care Team Hub
        </h1>
        <p className="text-muted-foreground mt-1">
          Collaborate with your care team to provide coordinated patient care
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{stats?.pendingTasks || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{stats?.overdueTasks || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Handoffs</p>
                <p className="text-2xl font-bold">{stats?.activeHandoffs || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ArrowRightLeft className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Activity</p>
                <p className="text-2xl font-bold">{stats?.recentActivityCount || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
            <TabsTrigger value="handoffs" data-testid="tab-handoffs">Handoffs</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Team Notes</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">Team Directory</TabsTrigger>
            <TabsTrigger value="protocols" data-testid="tab-protocols">Protocols</TabsTrigger>
            <TabsTrigger value="escalations" data-testid="tab-escalations">Escalations</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowNewTaskDialog(true)} data-testid="button-new-task">
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewNoteDialog(true)} data-testid="button-new-note">
              <MessageSquare className="h-4 w-4 mr-1" />
              Add Note
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewHandoffDialog(true)} data-testid="button-new-handoff">
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              Initiate Handoff
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Pending Tasks
                </CardTitle>
                <CardDescription>Tasks requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : pendingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4">
                      {pendingTasks.slice(0, 5).map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onComplete={(id) => completeTaskMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Team actions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {activitiesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !activities || activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1 pr-4">
                      {activities.slice(0, 10).map(activity => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {activeHandoffs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Active Care Handoffs
                </CardTitle>
                <CardDescription>Pending care transitions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {activeHandoffs.map(handoff => (
                    <HandoffCard 
                      key={handoff.id} 
                      handoff={handoff}
                      onAccept={(id) => acceptHandoffMutation.mutate(id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Manage care team task assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No tasks yet</p>
                  <Button className="mt-4" onClick={() => setShowNewTaskDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create First Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task}
                      onComplete={(id) => completeTaskMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="handoffs">
          <Card>
            <CardHeader>
              <CardTitle>Care Handoffs</CardTitle>
              <CardDescription>Manage care transitions between team members</CardDescription>
            </CardHeader>
            <CardContent>
              {handoffsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : !handoffs || handoffs.length === 0 ? (
                <div className="text-center py-8">
                  <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No care handoffs</p>
                  <Button className="mt-4" onClick={() => setShowNewHandoffDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Initiate Handoff
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {handoffs.map(handoff => (
                    <HandoffCard 
                      key={handoff.id} 
                      handoff={handoff}
                      onAccept={(id) => acceptHandoffMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Team Notes</CardTitle>
              <CardDescription>Secure communication between care team members</CardDescription>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !notes || notes.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No team notes yet</p>
                  <Button className="mt-4" onClick={() => setShowNewNoteDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Note
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map(note => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>Complete history of team actions</CardDescription>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !activities || activities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No activity recorded yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {activities.map(activity => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Directory Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Directory
              </CardTitle>
              <CardDescription>View and manage care team members</CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : !teamMembers || teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No team members found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamMembers.map(member => (
                    <Card key={member.id} className="overflow-hidden" data-testid={`member-card-${member.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-medium ${
                            member.availabilityStatus === "available" ? "bg-green-500" :
                            member.availabilityStatus === "busy" ? "bg-yellow-500" :
                            member.availabilityStatus === "on_call" ? "bg-blue-500" :
                            "bg-gray-400"
                          }`}>
                            {member.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{member.name}</h3>
                            <p className="text-sm text-muted-foreground capitalize">{member.role.replace("_", " ")}</p>
                            <Badge variant="outline" className={`mt-1 ${
                              member.availabilityStatus === "available" ? "border-green-500 text-green-600" :
                              member.availabilityStatus === "busy" ? "border-yellow-500 text-yellow-600" :
                              member.availabilityStatus === "on_call" ? "border-blue-500 text-blue-600" :
                              "border-gray-400 text-gray-600"
                            }`}>
                              {member.availabilityStatus?.replace("_", " ") || "Unknown"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                          {member.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <span className="truncate">{member.email}</span>
                            </div>
                          )}
                          {member.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <span>{member.phone}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Shift: {member.currentShift || "N/A"}</span>
                          <span className="text-muted-foreground">Workload: {member.workload?.activeTasks || 0}</span>
                        </div>
                        {member.skills && member.skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {member.skills.slice(0, 3).map((skill, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">{skill}</Badge>
                            ))}
                            {member.skills.length > 3 && (
                              <Badge variant="secondary" className="text-xs">+{member.skills.length - 3}</Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Protocols Tab */}
        <TabsContent value="protocols">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Care Protocol Templates
              </CardTitle>
              <CardDescription>Standardized care workflows for common scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              {protocolsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : !protocols || protocols.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No protocol templates available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {protocols.map(protocol => (
                    <Card key={protocol.id} data-testid={`protocol-card-${protocol.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{protocol.name}</h3>
                              <Badge variant="outline" className="capitalize">
                                {protocol.category.replace("_", " ")}
                              </Badge>
                              {protocol.isActive && <Badge className="bg-green-500">Active</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{protocol.description}</p>
                            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Est. Duration: {protocol.estimatedDuration} min</span>
                              <span>Tasks: {protocol.tasks?.length || 0}</span>
                            </div>
                            {protocol.tasks && protocol.tasks.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium mb-2">Tasks in Protocol:</p>
                                <div className="space-y-1">
                                  {protocol.tasks.slice(0, 3).map((task, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <CheckCircle className="h-3 w-3" />
                                      <span>{task.title}</span>
                                      <Badge variant="secondary" className="text-xs capitalize">
                                        {task.priority}
                                      </Badge>
                                    </div>
                                  ))}
                                  {protocol.tasks.length > 3 && (
                                    <p className="text-xs text-muted-foreground">+{protocol.tasks.length - 3} more tasks</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button variant="outline" size="sm" data-testid={`button-apply-protocol-${protocol.id}`}>
                            <Play className="h-4 w-4 mr-1" />
                            Apply
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escalations Tab */}
        <TabsContent value="escalations">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Active Escalations
                </CardTitle>
                <CardDescription>Issues requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : !escalationEvents || escalationEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-muted-foreground">No active escalations</p>
                    <p className="text-sm text-muted-foreground">All care processes are running smoothly</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {escalationEvents.map(event => (
                      <Card key={event.id} className={`border-l-4 ${
                        event.severity === "critical" ? "border-l-red-500" :
                        event.severity === "high" ? "border-l-orange-500" :
                        event.severity === "medium" ? "border-l-yellow-500" :
                        "border-l-blue-500"
                      }`} data-testid={`escalation-event-${event.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className={`${
                                  event.severity === "critical" ? "bg-red-500" :
                                  event.severity === "high" ? "bg-orange-500" :
                                  event.severity === "medium" ? "bg-yellow-500" :
                                  "bg-blue-500"
                                }`}>
                                  {event.severity.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {event.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <p className="text-sm mt-2">{event.ruleName}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Triggered: {new Date(event.createdAt).toLocaleString()}
                              </p>
                            </div>
                            {event.status === "pending" && (
                              <Button size="sm" variant="outline" data-testid={`button-resolve-${event.id}`}>
                                Resolve
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Escalation Rules
                </CardTitle>
                <CardDescription>Automated monitoring and alert configurations</CardDescription>
              </CardHeader>
              <CardContent>
                {!escalationRules || escalationRules.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No escalation rules configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {escalationRules.map(rule => (
                      <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`rule-${rule.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${rule.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {rule.trigger.replace("_", " ")} | Threshold: {rule.triggerCondition?.thresholdMinutes || rule.triggerCondition?.thresholdHours ? `${rule.triggerCondition.thresholdHours}h ${rule.triggerCondition.thresholdMinutes || 0}m` : "N/A"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {rule.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Avg Completion Time</p>
                    <p className="text-2xl font-bold">
                      {performanceMetrics?.overview?.averageCompletionTimeHours 
                        ? `${Math.round(performanceMetrics.overview.averageCompletionTimeHours * 60)} min`
                        : "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Handoff Response</p>
                    <p className="text-2xl font-bold">
                      {performanceMetrics?.handoffMetrics?.averageResponseTimeMinutes
                        ? `${Math.round(performanceMetrics.handoffMetrics.averageResponseTimeMinutes)} min`
                        : "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Team Collaboration</p>
                    <p className="text-2xl font-bold">
                      {performanceMetrics?.communicationMetrics?.teamEngagementScore
                        ? `${Math.round(performanceMetrics.communicationMetrics.teamEngagementScore)}%`
                        : "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Team Workload</p>
                    <p className="text-2xl font-bold">
                      {performanceMetrics?.memberMetrics?.[0]?.workloadScore
                        ? `${Math.round(performanceMetrics.memberMetrics.reduce((sum, m) => sum + m.workloadScore, 0) / performanceMetrics.memberMetrics.length)}%`
                        : "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Member Performance
                </CardTitle>
                <CardDescription>Individual team member metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !performanceMetrics?.memberMetrics || performanceMetrics.memberMetrics.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No performance data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {performanceMetrics.memberMetrics.map(member => (
                      <Card key={member.memberId} data-testid={`performance-member-${member.memberId}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{member.memberName}</p>
                                <p className="text-sm text-muted-foreground capitalize">{member.role.replace("_", " ")}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Tasks</p>
                                <p className="font-medium">{member.tasksCompleted}/{member.tasksAssigned}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Avg Time</p>
                                <p className="font-medium">{Math.round(member.averageCompletionTimeHours * 60)} min</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Workload</p>
                                <p className="font-medium">{Math.round(member.workloadScore)}%</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Collab Score</p>
                                <p className="font-medium">{Math.round(member.collaborationScore)}%</p>
                              </div>
                              <div className="flex items-center gap-1">
                                {member.responseTimeScore > 70 ? (
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                ) : member.responseTimeScore < 40 ? (
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Minus className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Assign a task to a care team member</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createTaskMutation.mutate({
              carePlanId: selectedCarePlanId,
              patientId: "patient-1",
              title: formData.get("title"),
              description: formData.get("description"),
              priority: formData.get("priority"),
              assignedTo: formData.get("assignedTo"),
              assignedBy: "current-user",
              dueDate: new Date(formData.get("dueDate") as string).toISOString(),
              category: formData.get("category"),
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="Task title" required data-testid="input-task-title" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Task description" data-testid="input-task-description" />
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
                  <Select name="category" defaultValue="other">
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
                      <SelectItem value="other">Other</SelectItem>
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
              <Button type="button" variant="outline" onClick={() => setShowNewTaskDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-create-task">
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewNoteDialog} onOpenChange={setShowNewNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Note</DialogTitle>
            <DialogDescription>Share information with the care team</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createNoteMutation.mutate({
              carePlanId: selectedCarePlanId,
              patientId: "patient-1",
              authorId: "current-user",
              authorName: "Current User",
              authorRole: "care_coordinator",
              content: formData.get("content"),
              visibility: formData.get("visibility"),
              isUrgent: formData.get("isUrgent") === "on",
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="content">Note</Label>
                <Textarea 
                  id="content" 
                  name="content" 
                  placeholder="Enter your note..." 
                  rows={4}
                  required 
                  data-testid="input-note-content"
                />
              </div>
              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <Select name="visibility" defaultValue="team">
                  <SelectTrigger data-testid="select-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Entire Team</SelectItem>
                    <SelectItem value="specific_roles">Specific Roles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isUrgent" name="isUrgent" data-testid="checkbox-urgent" />
                <Label htmlFor="isUrgent">Mark as Urgent</Label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowNewNoteDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createNoteMutation.isPending} data-testid="button-add-note">
                {createNoteMutation.isPending ? "Adding..." : "Add Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewHandoffDialog} onOpenChange={setShowNewHandoffDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Initiate Care Handoff</DialogTitle>
            <DialogDescription>Transfer care responsibility to another team member</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createHandoffMutation.mutate({
              carePlanId: selectedCarePlanId,
              patientId: "patient-1",
              fromMemberId: "current-user",
              fromMemberName: "Current User",
              toMemberId: formData.get("toMemberId"),
              toMemberName: formData.get("toMemberName") || "Selected Team Member",
              urgency: formData.get("urgency"),
              reason: formData.get("reason"),
              summary: formData.get("summary"),
              pendingTasks: (formData.get("pendingTasks") as string || "").split("\n").filter(Boolean),
              criticalInfo: (formData.get("criticalInfo") as string || "").split("\n").filter(Boolean),
              medications: [],
              recentChanges: [],
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="toMemberId">Hand Off To</Label>
                <Select name="toMemberId" defaultValue="dr-jones">
                  <SelectTrigger data-testid="select-handoff-to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dr-jones">Dr. Michael Jones</SelectItem>
                    <SelectItem value="dr-wilson">Dr. Lisa Wilson</SelectItem>
                    <SelectItem value="nurse-davis">Nurse Robert Davis</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="toMemberName" value="Dr. Michael Jones" />
              </div>
              <div>
                <Label htmlFor="urgency">Urgency</Label>
                <Select name="urgency" defaultValue="routine">
                  <SelectTrigger data-testid="select-urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stat">STAT - Immediate</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reason">Reason for Handoff</Label>
                <Input 
                  id="reason" 
                  name="reason" 
                  placeholder="e.g., Weekend coverage, Specialist referral" 
                  required 
                  data-testid="input-handoff-reason"
                />
              </div>
              <div>
                <Label htmlFor="summary">Clinical Summary</Label>
                <Textarea 
                  id="summary" 
                  name="summary" 
                  placeholder="Brief summary of patient status and care plan..."
                  rows={3}
                  required
                  data-testid="input-handoff-summary"
                />
              </div>
              <div>
                <Label htmlFor="criticalInfo">Critical Information (one per line)</Label>
                <Textarea 
                  id="criticalInfo" 
                  name="criticalInfo" 
                  placeholder="Allergies, warnings, special considerations..."
                  rows={2}
                  data-testid="input-critical-info"
                />
              </div>
              <div>
                <Label htmlFor="pendingTasks">Pending Tasks (one per line)</Label>
                <Textarea 
                  id="pendingTasks" 
                  name="pendingTasks" 
                  placeholder="Tasks to be completed..."
                  rows={2}
                  data-testid="input-pending-tasks"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowNewHandoffDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createHandoffMutation.isPending} data-testid="button-initiate-handoff">
                {createHandoffMutation.isPending ? "Initiating..." : "Initiate Handoff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
