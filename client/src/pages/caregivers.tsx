import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  UserPlus, 
  Heart,
  Mail,
  Clock,
  CheckCircle,
  X,
  Trash2,
  Eye,
  Shield,
  MessageSquare,
  Send,
  Sparkles,
  AlertCircle,
  ClipboardList,
  Activity,
  RefreshCw,
  Settings,
  Lock,
  Unlock,
  History,
  AlertTriangle,
  Bell,
  BellOff,
  Calendar,
  FileText,
  Pill,
  Stethoscope,
  Phone,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import type { Caregiver, User, CaregiverUpdateRequest, CaregiverAccessLog, CaregiverAccessRequest } from "@shared/schema";
import { caregiverRelationships, caregiverPermissionCategories, caregiverPermissionDescriptions } from "@shared/schema";

const accessRestrictionLabels: Record<string, { label: string; icon: typeof Lock; color: string }> = {
  none: { label: "Full Access", icon: Unlock, color: "text-green-600" },
  time_limited: { label: "Time-Limited", icon: Clock, color: "text-yellow-600" },
  approval_required: { label: "Requires Approval", icon: ShieldAlert, color: "text-orange-600" },
  view_only: { label: "View Only", icon: Eye, color: "text-blue-600" },
};

const permissionIcons: Record<string, typeof Eye> = {
  view_medications: Pill,
  view_conditions: Stethoscope,
  view_lab_results: FileText,
  view_appointments: Calendar,
  view_allergies: AlertTriangle,
  view_documents: FileText,
  view_vitals: Activity,
  manage_appointments: Calendar,
  communicate_providers: MessageSquare,
  receive_notifications: Bell,
  emergency_contact: Phone,
  proxy_access: Shield,
  medical_decisions: ShieldCheck,
  financial_access: FileText,
  all_access: Lock,
};

interface CaregiversResponse {
  caregivers: Caregiver[];
  caregivingFor: (Caregiver & { patient: User | null })[];
}

interface PatientActivitySummary {
  summary: string;
  recentMedications: string[];
  recentAppointments: string[];
  recentLabResults: string[];
  healthAlerts: string[];
  generatedAt: string;
}

interface CareTeamMember {
  id: string;
  caregiverId: string;
  name: string;
  email: string;
  relationship: string;
  permissions: string[];
}

const requestTypeLabels: Record<string, string> = {
  status_update: "Status Update",
  medication_check: "Medication Check",
  appointment_reminder: "Appointment Reminder",
  general_question: "General Question",
  health_concern: "Health Concern",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const relationshipLabels: Record<string, string> = {
  spouse: "Spouse/Partner",
  parent: "Parent",
  child: "Adult Child",
  sibling: "Sibling",
  grandparent: "Grandparent",
  grandchild: "Grandchild",
  friend: "Close Friend",
  other: "Other Family Member",
};

const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().optional(),
  relationship: z.enum(caregiverRelationships, { 
    required_error: "Please select a relationship" 
  }),
});

function ManagePermissionsDialog({ 
  caregiver, 
  onSuccess 
}: { 
  caregiver: Caregiver; 
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(caregiver.permissions || []);
  const [notifyOnAccess, setNotifyOnAccess] = useState(caregiver.notifyPatientOnAccess ?? true);
  const [emergencyAccess, setEmergencyAccess] = useState(caregiver.emergencyAccessEnabled ?? false);
  const [accessRestriction, setAccessRestriction] = useState(caregiver.accessRestriction || "none");
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: { permissions: string[]; notifyPatientOnAccess: boolean; emergencyAccessEnabled: boolean; accessRestriction: string }) => {
      const res = await apiRequest("PATCH", `/api/caregivers/${caregiver.id}/permissions`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions Updated",
        description: "Caregiver access settings have been saved.",
      });
      setOpen(false);
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update permissions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev => 
      prev.includes(perm) 
        ? prev.filter(p => p !== perm) 
        : [...prev, perm]
    );
  };

  const handleSave = () => {
    updateMutation.mutate({
      permissions: selectedPermissions,
      notifyPatientOnAccess: notifyOnAccess,
      emergencyAccessEnabled: emergencyAccess,
      accessRestriction,
    });
  };

  const sensitivePermissions = caregiverPermissionCategories.filter(cat => 
    caregiverPermissionDescriptions[cat]?.sensitive
  );
  const regularPermissions = caregiverPermissionCategories.filter(cat => 
    !caregiverPermissionDescriptions[cat]?.sensitive
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-manage-permissions-${caregiver.id}`}>
          <Settings className="h-4 w-4 mr-1" />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Manage Caregiver Access
          </DialogTitle>
          <DialogDescription>
            Control what {caregiver.caregiverName || "this caregiver"} can see and do with your health records.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Standard Permissions
              </h4>
              <div className="grid gap-3">
                {regularPermissions.map(perm => {
                  const desc = caregiverPermissionDescriptions[perm];
                  const PermIcon = permissionIcons[perm] || Eye;
                  return (
                    <div 
                      key={perm}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <PermIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{desc?.label || perm}</p>
                          <p className="text-xs text-muted-foreground">{desc?.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedPermissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                        data-testid={`switch-permission-${perm}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <ShieldAlert className="h-4 w-4" />
                Sensitive Permissions
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                These permissions grant access to sensitive medical information. Enable with caution.
              </p>
              <div className="grid gap-3">
                {sensitivePermissions.map(perm => {
                  const desc = caregiverPermissionDescriptions[perm];
                  const PermIcon = permissionIcons[perm] || Eye;
                  return (
                    <div 
                      key={perm}
                      className="flex items-center justify-between p-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30"
                    >
                      <div className="flex items-center gap-3">
                        <PermIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{desc?.label || perm}</p>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700">
                              Sensitive
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{desc?.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedPermissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                        data-testid={`switch-permission-${perm}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Access Settings
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Notify me when accessed</p>
                      <p className="text-xs text-muted-foreground">Get alerts when this caregiver views your records</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifyOnAccess}
                    onCheckedChange={setNotifyOnAccess}
                    data-testid="switch-notify-on-access"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium text-sm">Emergency Access Override</p>
                      <p className="text-xs text-muted-foreground">Allow full access in medical emergencies (logged)</p>
                    </div>
                  </div>
                  <Switch
                    checked={emergencyAccess}
                    onCheckedChange={setEmergencyAccess}
                    data-testid="switch-emergency-access"
                  />
                </div>

                <div className="p-3 rounded-lg border bg-card">
                  <Label className="text-sm font-medium mb-2 block">Access Restriction Level</Label>
                  <Select value={accessRestriction} onValueChange={setAccessRestriction}>
                    <SelectTrigger data-testid="select-access-restriction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(accessRestrictionLabels).map(([value, { label, icon: Icon, color }]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${color}`} />
                            <span>{label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-permissions"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaregiverCard({ 
  caregiver, 
  onRemove,
  isRemoving,
  onUpdate
}: { 
  caregiver: Caregiver;
  onRemove: (id: string) => void;
  isRemoving: boolean;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const statusColors = {
    pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    accepted: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    declined: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    suspended: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };

  const statusIcons = {
    pending: Clock,
    accepted: CheckCircle,
    declined: X,
    suspended: Lock,
  };

  const status = caregiver.status as keyof typeof statusColors;
  const StatusIcon = statusIcons[status] || Clock;
  const relationship = relationshipLabels[caregiver.relationship] || caregiver.relationship;
  const restriction = accessRestrictionLabels[caregiver.accessRestriction || "none"];
  const RestrictionIcon = restriction?.icon || Unlock;

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/caregivers/${caregiver.id}/suspend`, {
        reason: "Suspended by patient"
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Caregiver Suspended", description: "Access has been temporarily revoked." });
      onUpdate();
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/caregivers/${caregiver.id}/reinstate`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Caregiver Reinstated", description: "Access has been restored." });
      onUpdate();
    },
  });

  const permissionCount = caregiver.permissions?.length || 0;
  const sensitiveCount = caregiver.permissions?.filter(p => 
    caregiverPermissionDescriptions[p as keyof typeof caregiverPermissionDescriptions]?.sensitive
  ).length || 0;

  return (
    <Card className="hover-elevate" data-testid={`card-caregiver-${caregiver.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold" data-testid={`text-caregiver-name-${caregiver.id}`}>
                  {caregiver.caregiverName || "Invited Caregiver"}
                </h4>
                <p className="text-sm text-muted-foreground">{relationship}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap mt-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{caregiver.caregiverEmail}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Badge variant="outline" className={statusColors[status]} data-testid={`badge-caregiver-status-${caregiver.id}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
              <Badge variant="secondary">
                <RestrictionIcon className={`h-3 w-3 mr-1 ${restriction?.color}`} />
                {restriction?.label}
              </Badge>
              <Badge variant="outline">
                <Shield className="h-3 w-3 mr-1" />
                {permissionCount} permissions
              </Badge>
              {sensitiveCount > 0 && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  {sensitiveCount} sensitive
                </Badge>
              )}
              {caregiver.notifyPatientOnAccess && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                  <Bell className="h-3 w-3 mr-1" />
                  Alerts On
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-3">
              {status === "accepted" && (
                <ManagePermissionsDialog caregiver={caregiver} onSuccess={onUpdate} />
              )}
              {status === "accepted" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => suspendMutation.mutate()}
                  disabled={suspendMutation.isPending}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950"
                  data-testid={`button-suspend-caregiver-${caregiver.id}`}
                >
                  <Lock className="h-4 w-4 mr-1" />
                  Suspend
                </Button>
              )}
              {status === "suspended" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reinstateMutation.mutate()}
                  disabled={reinstateMutation.isPending}
                  className="text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
                  data-testid={`button-reinstate-caregiver-${caregiver.id}`}
                >
                  <Unlock className="h-4 w-4 mr-1" />
                  Reinstate
                </Button>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(caregiver.id)}
            disabled={isRemoving}
            data-testid={`button-remove-caregiver-${caregiver.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteCaregiverDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      name: "",
      relationship: undefined,
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inviteFormSchema>) => {
      const res = await apiRequest("POST", "/api/caregivers/invite", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Sent",
        description: data.message,
      });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof inviteFormSchema>) => {
    inviteMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button data-testid="button-invite-caregiver">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Caregiver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Caregiver</DialogTitle>
          <DialogDescription>
            Give a trusted family member or friend view access to your health records.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="caregiver@example.com"
                      data-testid="input-caregiver-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Smith"
                      data-testid="input-caregiver-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-caregiver-relationship">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {caregiverRelationships.map((rel) => (
                        <SelectItem key={rel} value={rel} data-testid={`select-item-relationship-${rel}`}>
                          {relationshipLabels[rel]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 flex-wrap pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const updateRequestFormSchema = z.object({
  recipientId: z.string().min(1, "Please select a care team member"),
  requestType: z.enum(["status_update", "medication_check", "appointment_reminder", "general_question", "health_concern"]),
  message: z.string().min(5, "Please provide a message"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

function RequestUpdateDialog({ 
  patientUserId, 
  careTeam,
  onSuccess 
}: { 
  patientUserId: string;
  careTeam: CareTeamMember[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof updateRequestFormSchema>>({
    resolver: zodResolver(updateRequestFormSchema),
    defaultValues: {
      recipientId: "",
      requestType: "status_update",
      message: "",
      priority: "normal",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateRequestFormSchema>) => {
      const res = await apiRequest("POST", "/api/caregivers/update-requests", {
        ...data,
        patientUserId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Sent",
        description: "Your update request has been sent to the care team member.",
      });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-request-update">
          <MessageSquare className="h-4 w-4 mr-2" />
          Request Update
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an Update</DialogTitle>
          <DialogDescription>
            Ask a care team member for an update on the patient's status.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-update-recipient">
                        <SelectValue placeholder="Select care team member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {careTeam.map((member) => (
                        <SelectItem key={member.id} value={member.caregiverId}>
                          {member.name} ({member.relationship})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requestType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-request-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="status_update">Status Update</SelectItem>
                      <SelectItem value="medication_check">Medication Check</SelectItem>
                      <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                      <SelectItem value="general_question">General Question</SelectItem>
                      <SelectItem value="health_concern">Health Concern</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-request-priority">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What would you like to know?"
                      data-testid="input-request-message"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 flex-wrap pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-send-request">
                <Send className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UpdateRequestCard({ 
  request, 
  onRespond,
  isCurrentUserRecipient,
  isSubmitting
}: { 
  request: CaregiverUpdateRequest;
  onRespond: (id: string, response: string, useAI: boolean) => void;
  isCurrentUserRecipient: boolean;
  isSubmitting?: boolean;
}) {
  const [responseText, setResponseText] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const { toast } = useToast();

  const getAISuggestion = async () => {
    setIsLoadingAI(true);
    try {
      const res = await fetch(`/api/caregivers/ai-suggest-response/${request.id}`);
      if (res.ok) {
        const data = await res.json();
        setResponseText(data.suggestedResponse);
        toast({
          title: "AI Suggestion Ready",
          description: "Review and edit the suggested response before sending.",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not generate AI suggestion",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleRespond = () => {
    if (responseText.trim()) {
      onRespond(request.id, responseText, false);
    }
  };

  const isPending = request.status === "pending";

  return (
    <Card className="hover-elevate" data-testid={`card-update-request-${request.id}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={priorityColors[request.priority]}>
                {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
              </Badge>
              <Badge variant="secondary">
                {requestTypeLabels[request.requestType] || request.requestType}
              </Badge>
            </div>
            <Badge variant={isPending ? "outline" : "secondary"}>
              {isPending ? (
                <><Clock className="h-3 w-3 mr-1" /> Pending</>
              ) : (
                <><CheckCircle className="h-3 w-3 mr-1" /> Responded</>
              )}
            </Badge>
          </div>

          <p className="text-sm" data-testid={`text-request-message-${request.id}`}>
            {request.message}
          </p>

          {request.aiGeneratedContext && (
            <div className="bg-primary/5 rounded-md p-3 text-sm">
              <div className="flex items-center gap-1 text-primary mb-1">
                <Sparkles className="h-3 w-3" />
                <span className="text-xs font-medium">AI Context</span>
              </div>
              <p className="text-muted-foreground text-xs">{request.aiGeneratedContext}</p>
            </div>
          )}

          {request.response && (
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1">Response:</p>
              <p className="text-sm">{request.response}</p>
            </div>
          )}

          {isPending && isCurrentUserRecipient && (
            <div className="space-y-2 pt-2 border-t">
              <Textarea
                placeholder="Type your response..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                data-testid={`input-response-${request.id}`}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getAISuggestion}
                  disabled={isLoadingAI}
                  data-testid={`button-ai-suggest-${request.id}`}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {isLoadingAI ? "Loading..." : "AI Suggest"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleRespond}
                  disabled={!responseText.trim() || isSubmitting}
                  data-testid={`button-send-response-${request.id}`}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {isSubmitting ? "Sending..." : "Send Response"}
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CaregivingForSection({ 
  caregivingFor, 
  currentUserId 
}: { 
  caregivingFor: (Caregiver & { patient: User | null })[];
  currentUserId: string;
}) {
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(
    caregivingFor.length > 0 ? caregivingFor[0].patientUserId : null
  );

  const { data: careTeam = [] } = useQuery<CareTeamMember[]>({
    queryKey: ['/api/caregivers/care-team', selectedPatient],
    enabled: !!selectedPatient,
  });

  const { data: updateRequests = [], refetch: refetchRequests } = useQuery<CaregiverUpdateRequest[]>({
    queryKey: ['/api/caregivers/update-requests', selectedPatient],
    enabled: !!selectedPatient,
  });

  const { data: myRequests = [], refetch: refetchMyRequests } = useQuery<CaregiverUpdateRequest[]>({
    queryKey: ['/api/caregivers/my-update-requests'],
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, response, useAI }: { requestId: string; response: string; useAI: boolean }) => {
      const res = await apiRequest("POST", `/api/caregivers/update-requests/${requestId}/respond`, {
        response,
        useAIAssist: useAI,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Response Sent",
        description: "Your response has been sent successfully.",
      });
      refetchRequests();
      refetchMyRequests();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRespond = (requestId: string, response: string, useAI: boolean) => {
    respondMutation.mutate({ requestId, response, useAI });
  };

  const selectedItem = caregivingFor.find(c => c.patientUserId === selectedPatient);
  const pendingRequestsForMe = myRequests.filter(r => r.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <h3 className="text-lg font-semibold">People I Care For ({caregivingFor.length})</h3>
        {pendingRequestsForMe.length > 0 && (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            {pendingRequestsForMe.length} pending request(s)
          </Badge>
        )}
      </div>

      <Tabs value={selectedPatient || undefined} onValueChange={setSelectedPatient}>
        <TabsList className="w-full flex-wrap h-auto gap-1">
          {caregivingFor.map((item) => (
            <TabsTrigger 
              key={item.patientUserId} 
              value={item.patientUserId}
              className="flex-1 min-w-[120px]"
              data-testid={`tab-patient-${item.patientUserId}`}
            >
              <Heart className="h-3 w-3 mr-1" />
              {item.patient?.firstName || "Patient"}
            </TabsTrigger>
          ))}
        </TabsList>

        {caregivingFor.map((item) => (
          <TabsContent key={item.patientUserId} value={item.patientUserId} className="space-y-4 mt-4">
            <Card className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold" data-testid={`text-patient-name-${item.patientUserId}`}>
                        {item.patient?.firstName} {item.patient?.lastName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {relationshipLabels[item.relationship] || item.relationship}
                      </p>
                    </div>
                  </div>
                  {careTeam.length > 1 && (
                    <RequestUpdateDialog 
                      patientUserId={item.patientUserId}
                      careTeam={careTeam.filter(m => m.caregiverId !== currentUserId)}
                      onSuccess={() => refetchRequests()}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <PatientSummaryCard patientUserId={item.patientUserId} />

            {careTeam.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Care Team</CardTitle>
                  </div>
                  <CardDescription>
                    {careTeam.length} members helping care for {item.patient?.firstName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {careTeam.map((member) => (
                      <Badge 
                        key={member.id} 
                        variant={member.caregiverId === currentUserId ? "default" : "secondary"}
                      >
                        {member.name}
                        {member.caregiverId === currentUserId && " (You)"}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">Update Requests</h4>
              </div>
              
              {updateRequests.length === 0 ? (
                <Card className="p-6 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No update requests yet. Use "Request Update" to coordinate with other caregivers.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {updateRequests.map((request) => (
                    <UpdateRequestCard
                      key={request.id}
                      request={request}
                      onRespond={handleRespond}
                      isCurrentUserRecipient={request.recipientId === currentUserId}
                      isSubmitting={respondMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PatientSummaryCard({ patientUserId }: { patientUserId: string }) {
  const { data: summary, isLoading, error, refetch } = useQuery<PatientActivitySummary>({
    queryKey: ['/api/caregivers/patient-summary', patientUserId],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">AI Patient Summary</h4>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh-summary" aria-label="Refresh summary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4" data-testid="text-patient-summary">
          {summary.summary}
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {summary.recentMedications.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Active Medications</p>
              <ul className="space-y-1">
                {summary.recentMedications.slice(0, 3).map((med, i) => (
                  <li key={i} className="text-xs flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {med}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.healthAlerts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Health Alerts</p>
              <ul className="space-y-1">
                {summary.healthAlerts.slice(0, 3).map((alert, i) => (
                  <li key={i} className="text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-orange-500" />
                    {alert}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Generated: {new Date(summary.generatedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Caregivers() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<CaregiversResponse>({
    queryKey: ['/api/caregivers'],
    enabled: isAuthenticated,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/caregivers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Caregiver Removed",
        description: "The caregiver no longer has access to your records.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/caregivers'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove caregiver. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-in fade-in" data-testid="caregivers-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
        <div className="p-4 md:p-6">
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-muted-foreground mb-4">
              Sign in to manage caregiver access to your health records.
            </p>
            <Button asChild>
              <a href="/auth/login" data-testid="button-login-caregivers">Sign In</a>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 animate-in fade-in">
        <Card className="p-8 text-center" data-testid="caregivers-error">
          <Users className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Caregivers</h3>
          <p className="text-muted-foreground">
            There was a problem loading your caregiver information. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  const caregivers = data?.caregivers || [];
  const caregivingFor = data?.caregivingFor || [];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Caregiver Access</h1>
            <p className="text-muted-foreground">Share your health records with trusted family members</p>
          </div>
          <InviteCaregiverDialog onSuccess={() => refetch()} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pt-0">
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">Family Caregiver Support</h2>
                  <p className="text-muted-foreground mt-1">
                    Invite trusted family members or friends to view your health information. 
                    Caregivers can help you track medications, review test results, and stay on top of appointments.
                    You can remove access at any time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold mb-4">My Caregivers ({caregivers.length})</h3>
            {caregivers.length === 0 ? (
              <Card className="p-8 text-center" data-testid="caregivers-empty">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-semibold mb-2">No Caregivers Yet</h4>
                <p className="text-muted-foreground mb-4">
                  Invite a trusted family member or friend to help manage your health.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {caregivers.map(caregiver => (
                  <CaregiverCard
                    key={caregiver.id}
                    caregiver={caregiver}
                    onRemove={(id) => removeMutation.mutate(id)}
                    isRemoving={removeMutation.isPending}
                    onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/caregivers"] })}
                  />
                ))}
              </div>
            )}
          </div>

          {caregivingFor.length > 0 && (
            <CaregivingForSection caregivingFor={caregivingFor} currentUserId={user?.id || ""} />
          )}

          <AccessLogsSection />
          <AccessRequestsSection onReview={refetch} />
        </div>
      </div>
    </div>
  );
}

function AccessLogsSection() {
  const { data: logs, isLoading } = useQuery<CaregiverAccessLog[]>({
    queryKey: ["/api/caregivers/access-logs"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Access Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Access Logs
          </CardTitle>
          <CardDescription>
            Track when caregivers access your health records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No access logs yet. Logs will appear here when caregivers view your records.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Access Logs
        </CardTitle>
        <CardDescription>
          Recent activity from caregivers accessing your health records
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                data-testid={`log-entry-${log.id}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  log.emergencyOverride 
                    ? "bg-red-100 dark:bg-red-900" 
                    : "bg-muted"
                }`}>
                  {log.emergencyOverride ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{log.caregiverName}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.accessType}
                    </Badge>
                    {log.emergencyOverride && (
                      <Badge variant="destructive" className="text-xs">
                        Emergency Override
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {log.action} - {log.resourceType}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(log.accessedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AccessRequestsSection({ onReview }: { onReview: () => void }) {
  const { toast } = useToast();
  const { data: requests, isLoading, refetch } = useQuery<CaregiverAccessRequest[]>({
    queryKey: ["/api/caregivers/access-requests", "pending"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, approved, notes }: { id: string; approved: boolean; notes?: string }) => {
      const res = await apiRequest("POST", `/api/caregivers/access-requests/${id}/review`, { approved, notes });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.approved ? "Request Approved" : "Request Denied",
        description: variables.approved 
          ? "The caregiver now has the requested permission." 
          : "The permission request was denied.",
      });
      refetch();
      onReview();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process request. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pending Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = requests?.filter(r => r.status === "pending") || [];

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <ShieldAlert className="h-5 w-5" />
          Pending Access Requests ({pendingRequests.length})
        </CardTitle>
        <CardDescription>
          Caregivers are requesting additional permissions to your health records
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingRequests.map((request) => {
            const permDesc = caregiverPermissionDescriptions[request.requestedPermission as keyof typeof caregiverPermissionDescriptions];
            return (
              <div 
                key={request.id} 
                className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                data-testid={`access-request-${request.id}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{request.caregiverName}</span>
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300">
                        Pending
                      </Badge>
                    </div>
                    <p className="text-sm">
                      Requesting: <span className="font-medium">{permDesc?.label || request.requestedPermission}</span>
                    </p>
                    {permDesc?.sensitive && (
                      <Badge variant="outline" className="mt-1 text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300">
                        Sensitive Permission
                      </Badge>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      Reason: {request.reason}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested: {new Date(request.requestedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Expires: {new Date(request.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewMutation.mutate({ id: request.id, approved: false })}
                      disabled={reviewMutation.isPending}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                      data-testid={`button-deny-request-${request.id}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => reviewMutation.mutate({ id: request.id, approved: true })}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-approve-request-${request.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
