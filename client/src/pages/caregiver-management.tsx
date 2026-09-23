import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  Shield,
  Settings,
  Trash2,
  Send,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  FileText,
  Calendar,
  Pill,
  Heart,
  Activity,
  Download,
  Upload,
  Bell,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from "lucide-react";

interface GranularPermissions {
  viewMedications: boolean;
  editMedications: boolean;
  viewConditions: boolean;
  editConditions: boolean;
  viewAppointments: boolean;
  editAppointments: boolean;
  viewDocuments: boolean;
  uploadDocuments: boolean;
  downloadDocuments: boolean;
  viewTimeline: boolean;
  editTimeline: boolean;
  viewSideEffects: boolean;
  addSideEffects: boolean;
  viewCancerTrack: boolean;
  editCancerTrack: boolean;
  viewEmergencyInfo: boolean;
  canExportData: boolean;
  canShareWithProviders: boolean;
  receiveNotifications: boolean;
  respondToNotifications: boolean;
}

interface CaregiverInvitation {
  id: string;
  profileId: string;
  profileName: string;
  invitedEmail: string;
  invitedName: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  permissions: GranularPermissions;
  expiresAt: string | null;
  accessExpiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface CaregiverAccess {
  id: string;
  profileId: string;
  profileName: string;
  caregiverId: string;
  caregiverEmail: string;
  caregiverName: string;
  relationshipType: string;
  permissions: GranularPermissions;
  accessExpiresAt: string | null;
  grantedAt: string;
  lastAccessedAt: string | null;
  isActive: boolean;
  notes: string | null;
  updatedAt: string;
}

interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: GranularPermissions;
}

interface RelationshipType {
  id: string;
  label: string;
}

interface ExpiryOption {
  days: number | null;
  label: string;
}

const defaultPermissions: GranularPermissions = {
  viewMedications: true,
  editMedications: false,
  viewConditions: true,
  editConditions: false,
  viewAppointments: true,
  editAppointments: false,
  viewDocuments: true,
  uploadDocuments: false,
  downloadDocuments: false,
  viewTimeline: true,
  editTimeline: false,
  viewSideEffects: true,
  addSideEffects: false,
  viewCancerTrack: true,
  editCancerTrack: false,
  viewEmergencyInfo: true,
  canExportData: false,
  canShareWithProviders: false,
  receiveNotifications: true,
  respondToNotifications: false,
};

const permissionCategories = [
  {
    category: "Medical Information",
    icon: Heart,
    permissions: [
      { key: "viewMedications", label: "View Medications", icon: Pill },
      { key: "editMedications", label: "Manage Medications", icon: Edit },
      { key: "viewConditions", label: "View Conditions", icon: Activity },
      { key: "editConditions", label: "Edit Conditions", icon: Edit },
    ],
  },
  {
    category: "Appointments",
    icon: Calendar,
    permissions: [
      { key: "viewAppointments", label: "View Appointments", icon: Eye },
      { key: "editAppointments", label: "Manage Appointments", icon: Edit },
    ],
  },
  {
    category: "Documents",
    icon: FileText,
    permissions: [
      { key: "viewDocuments", label: "View Documents", icon: Eye },
      { key: "uploadDocuments", label: "Upload Documents", icon: Upload },
      { key: "downloadDocuments", label: "Download Documents", icon: Download },
    ],
  },
  {
    category: "Timeline & Tracking",
    icon: Activity,
    permissions: [
      { key: "viewTimeline", label: "View Timeline", icon: Eye },
      { key: "editTimeline", label: "Edit Timeline", icon: Edit },
      { key: "viewSideEffects", label: "View Side Effects", icon: Eye },
      { key: "addSideEffects", label: "Log Side Effects", icon: Edit },
      { key: "viewCancerTrack", label: "View Cancer Track", icon: Eye },
      { key: "editCancerTrack", label: "Edit Cancer Track", icon: Edit },
    ],
  },
  {
    category: "Emergency & Export",
    icon: Shield,
    permissions: [
      { key: "viewEmergencyInfo", label: "View Emergency Info", icon: AlertCircle },
      { key: "canExportData", label: "Export Data", icon: Download },
      { key: "canShareWithProviders", label: "Share with Providers", icon: ExternalLink },
    ],
  },
  {
    category: "Notifications",
    icon: Bell,
    permissions: [
      { key: "receiveNotifications", label: "Receive Notifications", icon: Bell },
      { key: "respondToNotifications", label: "Respond to Notifications", icon: MessageSquare },
    ],
  },
];

export default function CaregiverManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverAccess | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    invitedEmail: "",
    invitedName: "",
    relationshipType: "family",
    preset: "view_only",
    permissions: { ...defaultPermissions },
    inviteExpiresInDays: 7,
    accessExpiresInDays: null as number | null,
    notes: "",
  });

  const { data: presetsData } = useQuery<{
    presets: PermissionPreset[];
    relationshipTypes: RelationshipType[];
    expiryOptions: ExpiryOption[];
  }>({
    queryKey: ["/api/caregiver/permission-presets"],
  });

  const { data: caregivers, isLoading: loadingCaregivers } = useQuery<{ caregivers: CaregiverAccess[] }>({
    queryKey: ["/api/caregiver/access"],
  });

  const { data: invitations, isLoading: loadingInvitations } = useQuery<{ invitations: CaregiverInvitation[] }>({
    queryKey: ["/api/caregiver/invitations"],
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      return apiRequest("POST", "/api/caregiver/invitations", {
        profileId: "profile-self-001",
        invitedEmail: data.invitedEmail,
        invitedName: data.invitedName,
        relationshipType: data.relationshipType,
        permissions: data.permissions,
        inviteExpiresInDays: data.inviteExpiresInDays,
        accessExpiresInDays: data.accessExpiresInDays,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: `Invitation sent to ${inviteForm.invitedName}` });
      setInviteDialogOpen(false);
      resetInviteForm();
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/invitations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invitation", description: error.message, variant: "destructive" });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CaregiverAccess> }) => {
      return apiRequest("PATCH", `/api/caregiver/access/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Permissions updated", description: "Caregiver permissions have been updated" });
      setEditDialogOpen(false);
      setSelectedCaregiver(null);
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/access"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/caregiver/access/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Access revoked", description: "Caregiver access has been revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/access"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to revoke access", description: error.message, variant: "destructive" });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/caregiver/invitations/${id}/revoke`);
    },
    onSuccess: () => {
      toast({ title: "Invitation revoked", description: "The invitation has been cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/invitations"] });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/caregiver/invitations/${id}/resend`);
    },
    onSuccess: () => {
      toast({ title: "Invitation resent", description: "A new invitation has been sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/invitations"] });
    },
  });

  const resetInviteForm = () => {
    setInviteForm({
      invitedEmail: "",
      invitedName: "",
      relationshipType: "family",
      preset: "view_only",
      permissions: { ...defaultPermissions },
      inviteExpiresInDays: 7,
      accessExpiresInDays: null,
      notes: "",
    });
    setExpandedPermissions(false);
  };

  const applyPreset = (presetId: string) => {
    const preset = presetsData?.presets.find((p) => p.id === presetId);
    if (preset) {
      setInviteForm((prev) => ({
        ...prev,
        preset: presetId,
        permissions: { ...preset.permissions },
      }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "accepted":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
      case "declined":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      case "expired":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      case "revoked":
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateStr);
  };

  const activeCount = caregivers?.caregivers.filter((c) => c.isActive).length || 0;
  const pendingCount = invitations?.invitations.filter((i) => i.status === "pending").length || 0;

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Caregiver Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Invite and manage people who help care for you
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-caregiver">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Caregiver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invite a Caregiver</DialogTitle>
              <DialogDescription>
                Send an invitation to someone who will help manage your health records
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="caregiver-management-name">Name</Label>
                  <Input id="caregiver-management-name"
                    placeholder="John Smith"
                    value={inviteForm.invitedName}
                    onChange={(e) => setInviteForm((p) => ({ ...p, invitedName: e.target.value }))}
                    data-testid="input-caregiver-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caregiver-management-email">Email</Label>
                  <Input id="caregiver-management-email"
                    type="email"
                    placeholder="john@example.com"
                    value={inviteForm.invitedEmail}
                    onChange={(e) => setInviteForm((p) => ({ ...p, invitedEmail: e.target.value }))}
                    data-testid="input-caregiver-email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="caregiver-management-relationship">Relationship</Label>
                  <Select
                    value={inviteForm.relationshipType}
                    onValueChange={(v) => setInviteForm((p) => ({ ...p, relationshipType: v }))}
                  >
                    <SelectTrigger id="caregiver-management-relationship" data-testid="select-relationship">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presetsData?.relationshipTypes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caregiver-management-access-level">Access Level</Label>
                  <Select
                    value={inviteForm.preset}
                    onValueChange={applyPreset}
                  >
                    <SelectTrigger id="caregiver-management-access-level" data-testid="select-access-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presetsData?.presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="caregiver-management-invitation-expires-in">Invitation Expires In</Label>
                  <Select
                    value={String(inviteForm.inviteExpiresInDays)}
                    onValueChange={(v) => setInviteForm((p) => ({ ...p, inviteExpiresInDays: Number(v) }))}
                  >
                    <SelectTrigger id="caregiver-management-invitation-expires-in" data-testid="select-invite-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Days</SelectItem>
                      <SelectItem value="7">1 Week</SelectItem>
                      <SelectItem value="14">2 Weeks</SelectItem>
                      <SelectItem value="30">1 Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caregiver-management-access-expires-after">Access Expires After</Label>
                  <Select
                    value={inviteForm.accessExpiresInDays ? String(inviteForm.accessExpiresInDays) : "never"}
                    onValueChange={(v) => setInviteForm((p) => ({ ...p, accessExpiresInDays: v === "never" ? null : Number(v) }))}
                  >
                    <SelectTrigger id="caregiver-management-access-expires-after" data-testid="select-access-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presetsData?.expiryOptions.map((o) => (
                        <SelectItem key={o.days || "never"} value={o.days ? String(o.days) : "never"}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => setExpandedPermissions(!expandedPermissions)}
                  data-testid="button-toggle-permissions"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Customize Permissions
                  </span>
                  {expandedPermissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {expandedPermissions && (
                  <ScrollArea className="h-64 mt-4 border rounded-lg p-4">
                    <div className="space-y-6">
                      {permissionCategories.map((category) => (
                        <div key={category.category}>
                          <h4 className="font-medium flex items-center gap-2 mb-3">
                            <category.icon className="h-4 w-4" />
                            {category.category}
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {category.permissions.map((perm) => (
                              <div key={perm.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                <span className="text-sm flex items-center gap-2">
                                  <perm.icon className="h-3 w-3 text-muted-foreground" />
                                  {perm.label}
                                </span>
                                <Switch
                                  checked={inviteForm.permissions[perm.key as keyof GranularPermissions]}
                                  onCheckedChange={(checked) =>
                                    setInviteForm((p) => ({
                                      ...p,
                                      permissions: { ...p.permissions, [perm.key]: checked },
                                    }))
                                  }
                                  data-testid={`switch-${perm.key}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="caregiver-management-notes-optional">Notes (Optional)</Label>
                <Textarea id="caregiver-management-notes-optional"
                  placeholder="Add any notes about this caregiver's role..."
                  value={inviteForm.notes}
                  onChange={(e) => setInviteForm((p) => ({ ...p, notes: e.target.value }))}
                  data-testid="textarea-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setInviteDialogOpen(false); resetInviteForm(); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createInvitationMutation.mutate(inviteForm)}
                disabled={!inviteForm.invitedEmail || !inviteForm.invitedName || createInvitationMutation.isPending}
                data-testid="button-send-invitation"
              >
                {createInvitationMutation.isPending ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active Caregivers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Mail className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending Invitations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Shield className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">HIPAA</p>
                <p className="text-sm text-muted-foreground">Compliant Access</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-caregivers">
            Active Caregivers ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-invitations">
            Pending Invitations ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {loadingCaregivers ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : caregivers?.caregivers.filter((c) => c.isActive).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Active Caregivers</h3>
                <p className="text-muted-foreground mb-4">Invite someone to help manage your health records</p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Caregiver
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {caregivers?.caregivers.filter((c) => c.isActive).map((caregiver) => (
                <Card key={caregiver.id} data-testid={`card-caregiver-${caregiver.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-medium text-primary">
                            {caregiver.caregiverName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium">{caregiver.caregiverName}</h3>
                          <p className="text-sm text-muted-foreground">{caregiver.caregiverEmail}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{caregiver.relationshipType}</Badge>
                            {caregiver.accessExpiresAt && (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Expires {formatDate(caregiver.accessExpiresAt)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Last accessed: {formatRelativeTime(caregiver.lastAccessedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedCaregiver(caregiver); setEditDialogOpen(true); }}
                          data-testid={`button-edit-${caregiver.id}`}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => revokeAccessMutation.mutate(caregiver.id)}
                          data-testid={`button-revoke-${caregiver.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {loadingInvitations ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : invitations?.invitations.filter((i) => i.status === "pending").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Pending Invitations</h3>
                <p className="text-muted-foreground">All invitations have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {invitations?.invitations.filter((i) => i.status === "pending").map((inv) => (
                <Card key={inv.id} data-testid={`card-invitation-${inv.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{inv.invitedName}</h3>
                          {getStatusBadge(inv.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{inv.invitedEmail}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Sent {formatRelativeTime(inv.createdAt)} | Expires {formatDate(inv.expiresAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendInvitationMutation.mutate(inv.id)}
                          disabled={resendInvitationMutation.isPending}
                          data-testid={`button-resend-${inv.id}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Resend
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => revokeInvitationMutation.mutate(inv.id)}
                          data-testid={`button-cancel-${inv.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Access History</CardTitle>
              <CardDescription>Past invitations and revoked access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invitations?.invitations.filter((i) => i.status !== "pending").map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{inv.invitedName}</p>
                      <p className="text-sm text-muted-foreground">{inv.invitedEmail}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(inv.status)}
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(inv.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {caregivers?.caregivers.filter((c) => !c.isActive).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{c.caregiverName}</p>
                      <p className="text-sm text-muted-foreground">{c.caregiverEmail}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">Access Revoked</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(c.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Caregiver Permissions</DialogTitle>
            <DialogDescription>
              Update access permissions for {selectedCaregiver?.caregiverName}
            </DialogDescription>
          </DialogHeader>
          {selectedCaregiver && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="caregiver-management-access-expiry">Access Expiry</Label>
                <Select
                  value={selectedCaregiver.accessExpiresAt ? "custom" : "never"}
                  onValueChange={(v) => {
                    if (v === "never") {
                      setSelectedCaregiver({ ...selectedCaregiver, accessExpiresAt: null });
                    } else {
                      const days = Number(v);
                      const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                      setSelectedCaregiver({ ...selectedCaregiver, accessExpiresAt: expiry });
                    }
                  }}
                >
                  <SelectTrigger id="caregiver-management-access-expiry" data-testid="select-edit-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">No Expiry</SelectItem>
                    <SelectItem value="30">1 Month from now</SelectItem>
                    <SelectItem value="90">3 Months from now</SelectItem>
                    <SelectItem value="180">6 Months from now</SelectItem>
                    <SelectItem value="365">1 Year from now</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <ScrollArea className="h-72">
                <div className="space-y-6 pr-4">
                  {permissionCategories.map((category) => (
                    <div key={category.category}>
                      <h4 className="font-medium flex items-center gap-2 mb-3">
                        <category.icon className="h-4 w-4" />
                        {category.category}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {category.permissions.map((perm) => (
                          <div key={perm.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <span className="text-sm flex items-center gap-2">
                              <perm.icon className="h-3 w-3 text-muted-foreground" />
                              {perm.label}
                            </span>
                            <Switch
                              checked={selectedCaregiver.permissions[perm.key as keyof GranularPermissions]}
                              onCheckedChange={(checked) =>
                                setSelectedCaregiver({
                                  ...selectedCaregiver,
                                  permissions: { ...selectedCaregiver.permissions, [perm.key]: checked },
                                })
                              }
                              data-testid={`switch-edit-${perm.key}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-2">
                <Label htmlFor="caregiver-management-notes">Notes</Label>
                <Textarea id="caregiver-management-notes"
                  value={selectedCaregiver.notes || ""}
                  onChange={(e) => setSelectedCaregiver({ ...selectedCaregiver, notes: e.target.value })}
                  data-testid="textarea-edit-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedCaregiver(null); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCaregiver) {
                  updateAccessMutation.mutate({
                    id: selectedCaregiver.id,
                    data: {
                      permissions: selectedCaregiver.permissions,
                      accessExpiresAt: selectedCaregiver.accessExpiresAt,
                      notes: selectedCaregiver.notes,
                    },
                  });
                }
              }}
              disabled={updateAccessMutation.isPending}
              data-testid="button-save-permissions"
            >
              {updateAccessMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
