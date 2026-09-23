import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getInitials } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import {
  Users,
  UserPlus,
  Heart,
  MessageSquare,
  FileText,
  Shield,
  Clock,
  Send,
  RefreshCw,
  Settings,
  Eye,
  Pill,
  TestTube,
  Calendar,
  Activity,
  AlertCircle,
  XCircle,
  Mail,
  Stethoscope,
  Home,
  UserCircle,
  Lock,
  History,
  Loader2,
  Plus
} from "lucide-react";

interface CareTeamMember {
  id: string;
  patientId: string;
  userId: string;
  name: string;
  email: string;
  role: "healthcare_provider" | "family_member" | "caregiver";
  providerType?: string;
  specialty?: string;
  relationship?: string;
  permissions: {
    viewHealthRecords: boolean;
    viewMedications: boolean;
    viewLabResults: boolean;
    viewAppointments: boolean;
    addNotes: boolean;
    contributeCarePlan: boolean;
    sendMessages: boolean;
  };
  status: "pending" | "active" | "revoked";
  invitedAt: string;
  acceptedAt?: string;
  invitedBy: string;
  lastAccessAt?: string;
}

interface CareTeamInvitation {
  id: string;
  patientId: string;
  patientName: string;
  inviteeEmail: string;
  inviteeName: string;
  role: "healthcare_provider" | "family_member" | "caregiver";
  providerType?: string;
  permissions: CareTeamMember["permissions"];
  status: "pending" | "accepted" | "declined" | "expired";
  inviteCode: string;
  expiresAt: string;
  createdAt: string;
}

interface CareTeamMessage {
  id: string;
  patientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  isEncrypted: boolean;
  readBy: Array<{ memberId: string; readAt: string }>;
  createdAt: string;
}

interface CareTeamNote {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  title: string;
  content: string;
  category: "general" | "medication" | "care_plan" | "observation" | "recommendation";
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SharedHealthView {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  recentConditions: Array<{ name: string; diagnosedDate: string; status: string }>;
  activeMedications: Array<{ name: string; dosage: string; frequency: string; prescribedBy: string }>;
  recentLabResults: Array<{ testName: string; value: string; unit: string; date: string; status: string }>;
  upcomingAppointments: Array<{ title: string; date: string; provider: string; location: string }>;
  healthSummary: string;
  lastUpdated: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  patientId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
}

const roleLabels: Record<string, string> = {
  healthcare_provider: "Healthcare Provider",
  family_member: "Family Member",
  caregiver: "Caregiver",
  patient: "Patient"
};

const roleIcons: Record<string, React.ReactNode> = {
  healthcare_provider: <Stethoscope className="h-4 w-4" />,
  family_member: <Home className="h-4 w-4" />,
  caregiver: <Heart className="h-4 w-4" />,
  patient: <UserCircle className="h-4 w-4" />
};

const categoryLabels: Record<string, string> = {
  general: "General",
  medication: "Medication",
  care_plan: "Care Plan",
  observation: "Observation",
  recommendation: "Recommendation"
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400",
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  revoked: "bg-red-500/10 text-red-600 dark:text-red-400",
  normal: "bg-green-500/10 text-green-600 dark:text-green-400",
  borderline: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  abnormal: "bg-red-500/10 text-red-600 dark:text-red-400"
};

const currentUser = {
  id: "patient-001",
  name: "John Smith",
  role: "patient"
};

export default function PatientCareTeam() {
  useSEO({
    title: "My Care Team | Tabula Medica",
    description: "Manage your care team, invite healthcare providers and family members, and collaborate on your health journey"
  });

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CareTeamMember | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "family_member" as "healthcare_provider" | "family_member" | "caregiver",
    relationship: "",
    providerType: "",
    permissions: {
      viewHealthRecords: true,
      viewMedications: true,
      viewLabResults: false,
      viewAppointments: true,
      addNotes: false,
      contributeCarePlan: false,
      sendMessages: true
    }
  });

  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
    category: "observation" as CareTeamNote["category"],
    isPrivate: false
  });

  const { toast } = useToast();

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<{
    success: boolean;
    dashboard: {
      teamMembers: { total: number; providers: number; family: number; pendingInvites: number };
      messaging: { unreadCount: number; totalMessages: number; lastMessageAt: string };
      notes: { totalNotes: number; recentNotesCount: number };
      recentActivity: Array<{ type: string; title: string; timestamp: string; description: string }>;
    };
  }>({
    queryKey: ["/api/care-team-hub/dashboard"]
  });

  const { data: membersData, isLoading: membersLoading, refetch: refetchMembers } = useQuery<{
    success: boolean;
    members: CareTeamMember[];
    summary: { total: number; active: number; pending: number; revoked: number };
  }>({
    queryKey: ["/api/care-team-hub/team-members"]
  });

  const { data: invitationsData, refetch: refetchInvitations } = useQuery<{
    success: boolean;
    invitations: CareTeamInvitation[];
  }>({
    queryKey: ["/api/care-team-hub/invitations"]
  });

  const { data: healthViewData, isLoading: healthViewLoading } = useQuery<{
    success: boolean;
    healthView: SharedHealthView;
  }>({
    queryKey: ["/api/care-team-hub/shared-health-view"]
  });

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<{
    success: boolean;
    messages: CareTeamMessage[];
  }>({
    queryKey: ["/api/care-team-hub/messages"]
  });

  const { data: notesData, isLoading: notesLoading, refetch: refetchNotes } = useQuery<{
    success: boolean;
    notes: CareTeamNote[];
  }>({
    queryKey: ["/api/care-team-hub/notes"]
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<{
    success: boolean;
    auditLogs: AuditLogEntry[];
    disclaimer: string;
  }>({
    queryKey: ["/api/care-team-hub/audit-log"]
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      return apiRequest("POST", "/api/care-team-hub/invite", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-hub"] });
      refetchInvitations();
      refetchDashboard();
      setShowInviteDialog(false);
      setInviteForm({
        name: "",
        email: "",
        role: "family_member",
        relationship: "",
        providerType: "",
        permissions: {
          viewHealthRecords: true,
          viewMedications: true,
          viewLabResults: false,
          viewAppointments: true,
          addNotes: false,
          contributeCarePlan: false,
          sendMessages: true
        }
      });
      toast({ title: "Invitation Sent", description: "Your care team invitation has been sent" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to send invitation", variant: "destructive" });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/care-team-hub/messages", {
        content,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role
      });
    },
    onSuccess: () => {
      refetchMessages();
      setNewMessage("");
      toast({ title: "Message Sent", description: "Your message has been sent to the care team" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: typeof noteForm) => {
      return apiRequest("POST", "/api/care-team-hub/notes", {
        ...data,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorRole: currentUser.role
      });
    },
    onSuccess: () => {
      refetchNotes();
      refetchDashboard();
      setShowNoteDialog(false);
      setNoteForm({ title: "", content: "", category: "observation", isPrivate: false });
      toast({ title: "Note Added", description: "Your note has been added to the care plan" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    }
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ memberId, permissions }: { memberId: string; permissions: CareTeamMember["permissions"] }) => {
      return apiRequest("PATCH", `/api/care-team-hub/team-members/${memberId}/permissions`, { permissions });
    },
    onSuccess: () => {
      refetchMembers();
      setShowPermissionsDialog(false);
      setSelectedMember(null);
      toast({ title: "Permissions Updated", description: "Team member permissions have been updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update permissions", variant: "destructive" });
    }
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("POST", `/api/care-team-hub/team-members/${memberId}/revoke`, {});
    },
    onSuccess: () => {
      refetchMembers();
      refetchDashboard();
      toast({ title: "Access Revoked", description: "Team member access has been revoked" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke access", variant: "destructive" });
    }
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("DELETE", `/api/care-team-hub/invitations/${invitationId}`, {});
    },
    onSuccess: () => {
      refetchInvitations();
      refetchDashboard();
      toast({ title: "Invitation Cancelled", description: "The invitation has been cancelled" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel invitation", variant: "destructive" });
    }
  });

  const dashboard = dashboardData?.dashboard;
  const members = membersData?.members || [];
  const invitations = invitationsData?.invitations || [];
  const healthView = healthViewData?.healthView;
  const messages = messagesData?.messages || [];
  const notes = notesData?.notes || [];
  const auditLogs = auditData?.auditLogs || [];

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


  const handleSendInvite = () => {
    if (!inviteForm.name || !inviteForm.email) return;
    sendInviteMutation.mutate(inviteForm);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleAddNote = () => {
    if (!noteForm.title || !noteForm.content) return;
    addNoteMutation.mutate(noteForm);
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Care Team</h1>
          <p className="text-muted-foreground">Manage who can access your health information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/care-team-hub"] });
          }} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-invite-member">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite to Care Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Invite to Your Care Team</DialogTitle>
                <DialogDescription>
                  Invite a healthcare provider or family member to view and contribute to your health journey
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Name</Label>
                  <Input
                    id="invite-name"
                    placeholder="Enter name"
                    value={inviteForm.name}
                    onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                    data-testid="input-invite-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="Enter email address"
                    value={inviteForm.email}
                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patient-care-team-role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value: "healthcare_provider" | "family_member" | "caregiver") =>
                      setInviteForm({ ...inviteForm, role: value })
                    }
                  >
                    <SelectTrigger id="patient-care-team-role" data-testid="select-invite-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="healthcare_provider">Healthcare Provider</SelectItem>
                      <SelectItem value="family_member">Family Member</SelectItem>
                      <SelectItem value="caregiver">Caregiver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteForm.role === "healthcare_provider" && (
                  <div className="space-y-2">
                    <Label htmlFor="provider-type">Provider Type</Label>
                    <Input
                      id="provider-type"
                      placeholder="e.g., Physician, Nurse, Specialist"
                      value={inviteForm.providerType}
                      onChange={e => setInviteForm({ ...inviteForm, providerType: e.target.value })}
                      data-testid="input-provider-type"
                    />
                  </div>
                )}
                {(inviteForm.role === "family_member" || inviteForm.role === "caregiver") && (
                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship</Label>
                    <Input
                      id="relationship"
                      placeholder="e.g., Spouse, Child, Parent"
                      value={inviteForm.relationship}
                      onChange={e => setInviteForm({ ...inviteForm, relationship: e.target.value })}
                      data-testid="input-relationship"
                    />
                  </div>
                )}
                <Separator />
                <div className="space-y-3">
                  <Label htmlFor="perm-records" className="text-sm font-medium">Permissions</Label>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-records" className="text-sm font-normal">View Health Records</Label>
                      <Switch
                        id="perm-records"
                        checked={inviteForm.permissions.viewHealthRecords}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, viewHealthRecords: c }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-meds" className="text-sm font-normal">View Medications</Label>
                      <Switch
                        id="perm-meds"
                        checked={inviteForm.permissions.viewMedications}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, viewMedications: c }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-labs" className="text-sm font-normal">View Lab Results</Label>
                      <Switch
                        id="perm-labs"
                        checked={inviteForm.permissions.viewLabResults}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, viewLabResults: c }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-appts" className="text-sm font-normal">View Appointments</Label>
                      <Switch
                        id="perm-appts"
                        checked={inviteForm.permissions.viewAppointments}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, viewAppointments: c }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-notes" className="text-sm font-normal">Add Notes</Label>
                      <Switch
                        id="perm-notes"
                        checked={inviteForm.permissions.addNotes}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, addNotes: c }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-careplan" className="text-sm font-normal">Contribute to Care Plan</Label>
                      <Switch
                        id="perm-careplan"
                        checked={inviteForm.permissions.contributeCarePlan}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, contributeCarePlan: c }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perm-messages" className="text-sm font-normal">Send Messages</Label>
                      <Switch
                        id="perm-messages"
                        checked={inviteForm.permissions.sendMessages}
                        onCheckedChange={c => setInviteForm({
                          ...inviteForm,
                          permissions: { ...inviteForm.permissions, sendMessages: c }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)} data-testid="button-cancel-invite">
                  Cancel
                </Button>
                <Button
                  onClick={handleSendInvite}
                  disabled={!inviteForm.name || !inviteForm.email || sendInviteMutation.isPending}
                  data-testid="button-send-invite"
                >
                  {sendInviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert className="border-blue-500/20 bg-blue-500/5">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-600 dark:text-blue-400">HIPAA-Aligned Design</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          All care team interactions are encrypted and logged. Team members only see what you explicitly allow through granular permissions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">
            <Users className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <Heart className="h-4 w-4 mr-2" />
            Health View
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="card-team-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Care Team Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.teamMembers.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.teamMembers.providers} providers, {dashboard.teamMembers.family} family
                    </p>
                    {dashboard.teamMembers.pendingInvites > 0 && (
                      <Badge variant="outline" className="mt-2">{dashboard.teamMembers.pendingInvites} pending invites</Badge>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-messages-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      Team Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.messaging.totalMessages}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.messaging.unreadCount} unread
                    </p>
                    {dashboard.messaging.lastMessageAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {formatTime(dashboard.messaging.lastMessageAt)}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-notes-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      Care Plan Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.notes.totalNotes}</div>
                    <p className="text-xs text-muted-foreground">
                      Collaborative notes from your care team
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-recent-activity">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription>Latest updates from your care team</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard.recentActivity.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No recent activity</p>
                    ) : (
                      dashboard.recentActivity.map((activity, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${activity.type === "message" ? "bg-blue-500/10" : "bg-purple-500/10"}`}>
                            {activity.type === "message" ? (
                              <MessageSquare className="h-4 w-4 text-blue-500" />
                            ) : (
                              <FileText className="h-4 w-4 text-purple-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{activity.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {membersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.filter(m => m.status === "active").map(member => (
                  <Card key={member.id} data-testid={`card-member-${member.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{member.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {roleIcons[member.role]}
                                <span className="ml-1">{roleLabels[member.role]}</span>
                              </Badge>
                              {member.specialty && <Badge variant="secondary" className="text-xs">{member.specialty}</Badge>}
                              {member.relationship && <Badge variant="secondary" className="text-xs">{member.relationship}</Badge>}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedMember(member);
                            setShowPermissionsDialog(true);
                          }}
                          data-testid={`button-edit-permissions-${member.id}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {member.permissions.viewHealthRecords && <Badge variant="outline" className="text-xs"><Eye className="h-3 w-3 mr-1" />Records</Badge>}
                        {member.permissions.viewMedications && <Badge variant="outline" className="text-xs"><Pill className="h-3 w-3 mr-1" />Meds</Badge>}
                        {member.permissions.viewLabResults && <Badge variant="outline" className="text-xs"><TestTube className="h-3 w-3 mr-1" />Labs</Badge>}
                        {member.permissions.addNotes && <Badge variant="outline" className="text-xs"><FileText className="h-3 w-3 mr-1" />Notes</Badge>}
                        {member.permissions.sendMessages && <Badge variant="outline" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Messages</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member.lastAccessAt ? `Last active: ${formatTime(member.lastAccessAt)}` : "Never accessed"}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          if (confirm(`Are you sure you want to revoke access for ${member.name}?`)) {
                            revokeAccessMutation.mutate(member.id);
                          }
                        }}
                        data-testid={`button-revoke-${member.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Revoke Access
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {invitations.filter(i => i.status === "pending").length > 0 && (
                <>
                  <h3 className="text-lg font-semibold mt-6">Pending Invitations</h3>
                  <div className="space-y-3">
                    {invitations.filter(i => i.status === "pending").map(invite => (
                      <Card key={invite.id} data-testid={`card-invitation-${invite.id}`}>
                        <CardContent className="flex items-center justify-between py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-yellow-500/10">
                              <Clock className="h-4 w-4 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-medium">{invite.inviteeName}</p>
                              <p className="text-sm text-muted-foreground">{invite.inviteeEmail}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{roleLabels[invite.role]}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  Expires {formatTime(invite.expiresAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInviteMutation.mutate(invite.id)}
                            data-testid={`button-cancel-invitation-${invite.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          {healthViewLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : healthView ? (
            <>
              <Alert className="border-green-500/20 bg-green-500/5">
                <Eye className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-600 dark:text-green-400">Permission-Filtered Health View</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  This preview shows the health data your authorized care team members can access. Each team member only sees data matching their specific permissions set by you. Access is logged in alignment with HIPAA audit trail practices.
                </AlertDescription>
              </Alert>

              <Card data-testid="card-health-summary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    Health Summary
                  </CardTitle>
                  <CardDescription>Last updated: {formatTime(healthView.lastUpdated)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{healthView.healthSummary}</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card data-testid="card-conditions">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Active Conditions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {healthView.recentConditions.map((condition, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{condition.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Diagnosed: {new Date(condition.diagnosedDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={statusColors[condition.status]}>{condition.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-medications">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4 text-blue-500" />
                      Active Medications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {healthView.activeMedications.map((med, idx) => (
                        <div key={idx}>
                          <p className="font-medium text-sm">{med.name} {med.dosage}</p>
                          <p className="text-xs text-muted-foreground">{med.frequency}</p>
                          <p className="text-xs text-muted-foreground">Prescribed by {med.prescribedBy}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-labs">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TestTube className="h-4 w-4 text-purple-500" />
                      Recent Lab Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {healthView.recentLabResults.map((lab, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{lab.testName}</p>
                            <p className="text-xs text-muted-foreground">
                              {lab.value} {lab.unit} - {new Date(lab.date).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={statusColors[lab.status]}>{lab.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-appointments">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-500" />
                      Upcoming Appointments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {healthView.upcomingAppointments.map((appt, idx) => (
                        <div key={idx}>
                          <p className="font-medium text-sm">{appt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(appt.date).toLocaleDateString()} with {appt.provider}
                          </p>
                          <p className="text-xs text-muted-foreground">{appt.location}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card className="h-[600px] flex flex-col" data-testid="card-messages">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-green-500" />
                    Secure Team Chat
                  </CardTitle>
                  <CardDescription>All messages are encrypted end-to-end</CardDescription>
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
                  <div className="text-center text-muted-foreground py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Start the conversation!</p>
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
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium">{msg.senderName}</span>
                            <Badge variant="outline" className="text-xs">
                              {roleIcons[msg.senderRole]}
                              <span className="ml-1">{roleLabels[msg.senderRole] || msg.senderRole}</span>
                            </Badge>
                            {msg.isEncrypted && <Lock className="h-3 w-3 text-green-500" />}
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
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold">Care Plan Notes</h3>
              <p className="text-sm text-muted-foreground">Collaborative notes from your care team</p>
            </div>
            <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-note">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Care Plan Note</DialogTitle>
                  <DialogDescription>
                    Add an observation, recommendation, or update to your care plan
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="note-title">Title</Label>
                    <Input
                      id="note-title"
                      placeholder="Enter note title"
                      value={noteForm.title}
                      onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                      data-testid="input-note-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-care-team-category">Category</Label>
                    <Select
                      value={noteForm.category}
                      onValueChange={(value: CareTeamNote["category"]) =>
                        setNoteForm({ ...noteForm, category: value })
                      }
                    >
                      <SelectTrigger id="patient-care-team-category" data-testid="select-note-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="observation">Observation</SelectItem>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="care_plan">Care Plan</SelectItem>
                        <SelectItem value="recommendation">Recommendation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note-content">Content</Label>
                    <Textarea
                      id="note-content"
                      placeholder="Enter your note..."
                      rows={4}
                      value={noteForm.content}
                      onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                      data-testid="input-note-content"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddNote}
                    disabled={!noteForm.title || !noteForm.content || addNoteMutation.isPending}
                    data-testid="button-save-note"
                  >
                    {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Note
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {notesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : notes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">No notes yet. Add one to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <Card key={note.id} data-testid={`card-note-${note.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{note.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{categoryLabels[note.category]}</Badge>
                          <span className="text-xs text-muted-foreground">by {note.authorName}</span>
                          <Badge variant="outline" className="text-xs">
                            {roleLabels[note.authorRole] || note.authorRole}
                          </Badge>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTime(note.createdAt)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Alert className="border-purple-500/20 bg-purple-500/5">
            <Shield className="h-4 w-4 text-purple-500" />
            <AlertTitle className="text-purple-600 dark:text-purple-400">HIPAA-Aligned Audit Trail</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {auditData?.disclaimer || "All access to your health information is logged. Audit records are retained in alignment with HIPAA audit trail best practices."}
            </AlertDescription>
          </Alert>

          <Card data-testid="card-audit-log">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-500" />
                Access History
              </CardTitle>
              <CardDescription>Who accessed your health information and when</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No audit logs available yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {auditLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30" data-testid={`audit-log-${log.id}`}>
                        <div className={`p-2 rounded-full ${log.action.includes("VIEW") ? "bg-blue-500/10" : "bg-purple-500/10"}`}>
                          {log.action.includes("VIEW") ? (
                            <Eye className="h-4 w-4 text-blue-500" />
                          ) : log.action.includes("SEND") ? (
                            <Send className="h-4 w-4 text-green-500" />
                          ) : log.action.includes("ADD") || log.action.includes("UPDATE") ? (
                            <FileText className="h-4 w-4 text-purple-500" />
                          ) : (
                            <Shield className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{log.actorName}</span>
                            <Badge variant="outline" className="text-xs">{log.action.replace(/_/g, " ")}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{log.details}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              {selectedMember ? `Manage what ${selectedMember.name} can access` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar>
                  <AvatarFallback>{getInitials(selectedMember.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedMember.name}</p>
                  <p className="text-sm text-muted-foreground">{roleLabels[selectedMember.role]}</p>
                </div>
              </div>
              <div className="grid gap-3">
                {Object.entries(selectedMember.permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm font-normal capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </Label>
                    <Switch
                      checked={value}
                      onCheckedChange={c => {
                        setSelectedMember({
                          ...selectedMember,
                          permissions: { ...selectedMember.permissions, [key]: c }
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPermissionsDialog(false);
              setSelectedMember(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember) {
                  updatePermissionsMutation.mutate({
                    memberId: selectedMember.id,
                    permissions: selectedMember.permissions
                  });
                }
              }}
              disabled={updatePermissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {updatePermissionsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
