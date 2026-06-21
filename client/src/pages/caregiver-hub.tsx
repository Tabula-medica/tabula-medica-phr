import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  BellOff,
  Calendar,
  Check,
  Clock,
  Eye,
  FileText,
  Heart,
  History,
  Pill,
  Plus,
  Settings,
  Shield,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
  Activity,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { 
  CaregiverSectionConsent, 
  CaregiverNotification, 
  CaregiverNotificationPreferences,
  CaregiverActivityEntry,
  CaregiverPermissionLevel,
} from "@shared/schema";

const SAMPLE_CAREGIVER_ID = "caregiver-michael-001";

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const notificationTypeIcons: Record<string, typeof Bell> = {
  appointment_reminder: Calendar,
  appointment_scheduled: Calendar,
  appointment_changed: Calendar,
  medication_added: Pill,
  medication_changed: Pill,
  medication_reminder: Pill,
  side_effect_reported: Activity,
  side_effect_severe: AlertTriangle,
  cancer_track_update: Heart,
  cancer_track_result: FileText,
  document_uploaded: FileText,
  care_packet_shared: FileText,
  profile_access_change: Shield,
  emergency_alert: AlertTriangle,
};

const permissionLevelLabels: Record<CaregiverPermissionLevel, { label: string; description: string; color: string }> = {
  none: { label: "No Access", description: "Cannot view or modify", color: "text-muted-foreground" },
  view_only: { label: "View Only", description: "Can view summaries and entries", color: "text-blue-600" },
  add_entries: { label: "Add Entries", description: "Can view and add new entries", color: "text-green-600" },
  full: { label: "Full Access", description: "Can view, add, edit, and delete", color: "text-purple-600" },
};

interface NotificationsResponse {
  notifications: CaregiverNotification[];
  unreadCount: number;
  total: number;
}

interface CaregiverPatientAccess {
  caregiverId: string;
  profileId: string;
  profileName: string;
  patientId: string;
  relationship: string;
  accessLevel: "limited" | "standard" | "full";
  permissions: {
    viewMedications: boolean;
    viewConditions: boolean;
    viewAppointments: boolean;
    viewDocuments: boolean;
    viewLabResults: boolean;
    addNotes: boolean;
    respondToNotifications: boolean;
  };
  lastAccessed: string | null;
}

interface PatientSummary {
  profileId: string;
  profileName: string;
  relationship: string;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  conditions: Array<{ name: string; status: string }>;
  upcomingAppointments: Array<{ date: string; provider: string; type: string }>;
  recentDocuments: Array<{ id: string; name: string; type: string; date: string }>;
  alerts: Array<{ type: string; message: string; priority: string }>;
}

interface PatientsResponse {
  caregiverId: string;
  patients: CaregiverPatientAccess[];
  totalPatients: number;
}

export default function CaregiverHub() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [respondingNotificationId, setRespondingNotificationId] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<string>("acknowledge");
  const [responseMessage, setResponseMessage] = useState("");

  const notificationsUrl = `/api/caregiver/notifications?caregiverId=${SAMPLE_CAREGIVER_ID}`;
  const { data: notificationsData, isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<NotificationsResponse>({
    queryKey: [notificationsUrl],
  });

  const consentsUrl = `/api/caregiver/consents?caregiverId=${SAMPLE_CAREGIVER_ID}`;
  const { data: consents, isLoading: consentsLoading, refetch: refetchConsents } = useQuery<CaregiverSectionConsent[]>({
    queryKey: [consentsUrl],
  });

  const activityLogUrl = `/api/caregiver/activity-log?caregiverId=${SAMPLE_CAREGIVER_ID}&limit=20`;
  const { data: activityLog, isLoading: activityLoading } = useQuery<CaregiverActivityEntry[]>({
    queryKey: [activityLogUrl],
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiRequest("PATCH", `/api/caregiver/notifications/${notificationId}/read`);
      return res.json();
    },
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver/notifications/mark-all-read", {
        caregiverId: SAMPLE_CAREGIVER_ID,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Notifications Marked Read",
        description: `${data.updated} notifications marked as read.`,
      });
      refetchNotifications();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiRequest("PATCH", `/api/caregiver/notifications/${notificationId}/dismiss`);
      return res.json();
    },
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const patientsUrl = `/api/caregiver/dashboard/patients?caregiverId=${SAMPLE_CAREGIVER_ID}`;
  const { data: patientsData, isLoading: patientsLoading } = useQuery<PatientsResponse>({
    queryKey: [patientsUrl],
  });

  const patientSummaryUrl = selectedPatientId 
    ? `/api/caregiver/dashboard/patient/${selectedPatientId}?caregiverId=${SAMPLE_CAREGIVER_ID}`
    : null;
  const { data: patientSummary, isLoading: summaryLoading } = useQuery<PatientSummary>({
    queryKey: [patientSummaryUrl],
    enabled: !!selectedPatientId,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ notificationId, responseType, message }: { notificationId: string; responseType: string; message: string }) => {
      const res = await apiRequest("POST", `/api/caregiver/notifications/${notificationId}/respond`, {
        caregiverId: SAMPLE_CAREGIVER_ID,
        responseType,
        message,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Response Recorded",
        description: data.message,
      });
      setResponseDialogOpen(false);
      setRespondingNotificationId(null);
      setResponseMessage("");
      refetchNotifications();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const patients = patientsData?.patients || [];
  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const cancerTrackConsent = consents?.find(c => c.section === "cancer_track" && c.isActive);
  const sideEffectsConsent = consents?.find(c => c.section === "side_effects_journal" && c.isActive);

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6" id="main-content">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="page-title">
            <Users className="h-8 w-8 text-primary" />
            Caregiver Hub
          </h1>
          <p className="text-lg text-muted-foreground mt-1" data-testid="text-page-description">
            Manage patient care, view notifications, and track activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchNotifications()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/30" data-testid="info-alert">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          You are viewing as <strong>Michael Johnson</strong> (Primary Caregiver). All actions are logged for patient safety.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate" data-testid="card-unread-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-unread-count">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Unread Notifications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-cancer-track-access">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${cancerTrackConsent ? 'bg-green-500/10' : 'bg-muted'}`}>
                <Heart className={`h-6 w-6 ${cancerTrackConsent ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-semibold" data-testid="text-cancer-track-title">Cancer Track</p>
                <p className="text-sm text-muted-foreground" data-testid="text-cancer-track-permission">
                  {cancerTrackConsent ? permissionLevelLabels[cancerTrackConsent.permissionLevel].label : "No Access"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-side-effects-access">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${sideEffectsConsent ? 'bg-green-500/10' : 'bg-muted'}`}>
                <Activity className={`h-6 w-6 ${sideEffectsConsent ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-semibold" data-testid="text-side-effects-title">Side Effects Journal</p>
                <p className="text-sm text-muted-foreground" data-testid="text-side-effects-permission">
                  {sideEffectsConsent ? permissionLevelLabels[sideEffectsConsent.permissionLevel].label : "No Access"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 md:w-auto md:inline-grid">
          <TabsTrigger value="dashboard" className="flex items-center gap-2" data-testid="tab-dashboard">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden md:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            <span className="hidden md:inline">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1" data-testid="badge-unread-count">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2" data-testid="tab-permissions">
            <Shield className="h-4 w-4" />
            <span className="hidden md:inline">Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2" data-testid="tab-activity">
            <History className="h-4 w-4" />
            <span className="hidden md:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="quick-actions" className="flex items-center gap-2" data-testid="tab-quick-actions">
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">Quick Actions</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Patients You Care For
                </CardTitle>
                <CardDescription>Select a patient to view their health records</CardDescription>
              </CardHeader>
              <CardContent>
                {patientsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : patients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No patients assigned</p>
                ) : (
                  <div className="space-y-2">
                    {patients.map((patient) => (
                      <Button
                        key={patient.profileId}
                        variant={selectedPatientId === patient.profileId ? "default" : "outline"}
                        className="w-full justify-start h-auto py-3"
                        onClick={() => setSelectedPatientId(patient.profileId)}
                        data-testid={`patient-select-${patient.profileId}`}
                      >
                        <div className="text-left">
                          <p className="font-medium">{patient.profileName}</p>
                          <p className="text-xs text-muted-foreground">{patient.relationship}</p>
                          <Badge variant="outline" className="mt-1" data-testid={`badge-access-${patient.profileId}`}>
                            {patient.accessLevel} access
                          </Badge>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedPatientId && patientSummary ? patientSummary.profileName : "Patient"} Health Summary
                </CardTitle>
                <CardDescription>
                  {selectedPatientId ? "View medications, conditions, and appointments" : "Select a patient to view their records"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedPatientId ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a patient from the list to view their health records</p>
                  </div>
                ) : summaryLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : patientSummary ? (
                  <div className="space-y-6">
                    {patientSummary.alerts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Alerts
                        </h4>
                        {patientSummary.alerts.map((alert, i) => (
                          <Alert key={i} className="bg-orange-500/10 border-orange-500/30">
                            <AlertDescription>{alert.message}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-500" />
                        Medications ({patientSummary.medications.length})
                      </h4>
                      <div className="grid gap-2">
                        {patientSummary.medications.map((med, i) => (
                          <div key={i} className="p-3 border rounded-lg" data-testid={`med-${i}`}>
                            <p className="font-medium">{med.name}</p>
                            <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        Conditions ({patientSummary.conditions.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {patientSummary.conditions.map((condition, i) => (
                          <Badge key={i} variant="outline" data-testid={`condition-${i}`}>
                            {condition.name} - {condition.status}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-500" />
                        Upcoming Appointments ({patientSummary.upcomingAppointments.length})
                      </h4>
                      <div className="space-y-2">
                        {patientSummary.upcomingAppointments.map((apt, i) => (
                          <div key={i} className="p-3 border rounded-lg" data-testid={`apt-${i}`}>
                            <p className="font-medium">{apt.type}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(apt.date).toLocaleDateString()} with {apt.provider}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {patientSummary.recentDocuments.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-purple-500" />
                          Recent Documents ({patientSummary.recentDocuments.length})
                        </h4>
                        <div className="space-y-2">
                          {patientSummary.recentDocuments.map((doc) => (
                            <div key={doc.id} className="p-3 border rounded-lg flex items-center justify-between" data-testid={`doc-${doc.id}`}>
                              <div>
                                <p className="font-medium">{doc.name}</p>
                                <p className="text-sm text-muted-foreground">{doc.type} - {new Date(doc.date).toLocaleDateString()}</p>
                              </div>
                              <Button variant="ghost" size="icon">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Unable to load patient data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>Updates about the patient you're caring for</CardDescription>
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    data-testid="button-mark-all-read"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark All Read
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-notifications">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p data-testid="text-empty-notifications">No notifications yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const Icon = notificationTypeIcons[notification.type] || Bell;
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            !notification.isRead ? 'bg-primary/5 border-primary/20' : ''
                          }`}
                          data-testid={`notification-${notification.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${priorityColors[notification.priority]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium" data-testid={`notification-title-${notification.id}`}>
                                    {notification.title}
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1" data-testid={`notification-message-${notification.id}`}>
                                    {notification.message}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {!notification.isRead && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => markReadMutation.mutate(notification.id)}
                                      data-testid={`button-mark-read-${notification.id}`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => dismissMutation.mutate(notification.id)}
                                    data-testid={`button-dismiss-${notification.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs" data-testid={`notification-badge-profile-${notification.id}`}>
                                  {notification.profileName}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(notification.createdAt).toLocaleString()}
                                </span>
                              </div>
                              {notification.actionUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-0 mt-1 text-primary hover:text-primary/80"
                                  onClick={() => window.location.href = notification.actionUrl!}
                                  data-testid={`button-action-${notification.id}`}
                                >
                                  View Details
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  setRespondingNotificationId(notification.id);
                                  setResponseDialogOpen(true);
                                }}
                                data-testid={`button-respond-${notification.id}`}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Respond
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-cancer-track-permissions">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-600" />
                  Cancer Track Access
                </CardTitle>
                <CardDescription>
                  Your permission level for managing cancer treatment timeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {consentsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : cancerTrackConsent ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${permissionLevelLabels[cancerTrackConsent.permissionLevel].color}`} data-testid="text-cancer-track-permission-level">
                          {permissionLevelLabels[cancerTrackConsent.permissionLevel].label}
                        </p>
                        <p className="text-sm text-muted-foreground" data-testid="text-cancer-track-permission-desc">
                          {permissionLevelLabels[cancerTrackConsent.permissionLevel].description}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600" data-testid="badge-cancer-track-active">
                        Active
                      </Badge>
                    </div>
                    <Separator />
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Granted by:</span>
                        <span>Patient (Sarah Johnson)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Granted on:</span>
                        <span>{new Date(cancerTrackConsent.grantedAt).toLocaleDateString()}</span>
                      </div>
                      {cancerTrackConsent.expiresAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expires:</span>
                          <span>{new Date(cancerTrackConsent.expiresAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    {cancerTrackConsent.notes && (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <p className="text-muted-foreground">{cancerTrackConsent.notes}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild data-testid="button-view-cancer-track">
                        <a href="/cancer-track">
                          <Eye className="h-4 w-4 mr-2" />
                          View Cancer Track
                        </a>
                      </Button>
                      {(cancerTrackConsent.permissionLevel === "add_entries" || cancerTrackConsent.permissionLevel === "full") && (
                        <Button size="sm" asChild data-testid="button-add-cancer-entry">
                          <a href="/cancer-track?action=add">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Entry
                          </a>
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground" data-testid="empty-cancer-track-access">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p data-testid="text-no-cancer-track-access">No access granted</p>
                    <p className="text-sm">Ask the patient to grant you access</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-side-effects-permissions">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-amber-600" />
                  Side Effects Journal Access
                </CardTitle>
                <CardDescription>
                  Your permission level for managing symptom entries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {consentsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : sideEffectsConsent ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${permissionLevelLabels[sideEffectsConsent.permissionLevel].color}`} data-testid="text-side-effects-permission-level">
                          {permissionLevelLabels[sideEffectsConsent.permissionLevel].label}
                        </p>
                        <p className="text-sm text-muted-foreground" data-testid="text-side-effects-permission-desc">
                          {permissionLevelLabels[sideEffectsConsent.permissionLevel].description}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600" data-testid="badge-side-effects-active">
                        Active
                      </Badge>
                    </div>
                    <Separator />
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Granted by:</span>
                        <span>Patient (Sarah Johnson)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Granted on:</span>
                        <span>{new Date(sideEffectsConsent.grantedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {sideEffectsConsent.notes && (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <p className="text-muted-foreground">{sideEffectsConsent.notes}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild data-testid="button-view-side-effects">
                        <a href="/side-effects">
                          <Eye className="h-4 w-4 mr-2" />
                          View Journal
                        </a>
                      </Button>
                      {(sideEffectsConsent.permissionLevel === "add_entries" || sideEffectsConsent.permissionLevel === "full") && (
                        <Button size="sm" asChild data-testid="button-add-symptom">
                          <a href="/side-effects?action=add">
                            <Plus className="h-4 w-4 mr-2" />
                            Log Symptom
                          </a>
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground" data-testid="empty-side-effects-access">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p data-testid="text-no-side-effects-access">No access granted</p>
                    <p className="text-sm">Ask the patient to grant you access</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Log</CardTitle>
              <CardDescription>
                Your recent actions on the patient's health records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !activityLog || activityLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-activity">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p data-testid="text-empty-activity">No activity recorded yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {activityLog.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 border rounded-lg"
                        data-testid={`activity-${activity.id}`}
                      >
                        <div className={`p-2 rounded-lg ${
                          activity.action === "add" ? "bg-green-500/10 text-green-600" :
                          activity.action === "edit" ? "bg-blue-500/10 text-blue-600" :
                          activity.action === "delete" ? "bg-red-500/10 text-red-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {activity.action === "view" && <Eye className="h-4 w-4" />}
                          {activity.action === "add" && <Plus className="h-4 w-4" />}
                          {activity.action === "edit" && <Settings className="h-4 w-4" />}
                          {activity.action === "delete" && <X className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium" data-testid={`activity-description-${activity.id}`}>{activity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize" data-testid={`activity-badge-section-${activity.id}`}>
                              {activity.section.replace("_", " ")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick-actions" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover-elevate cursor-pointer" data-testid="action-add-symptom">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <Activity className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Log Symptom</p>
                    <p className="text-sm text-muted-foreground">Record a side effect on behalf of patient</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <a href="/side-effects?action=add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Symptom Entry
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="action-add-timeline">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-pink-500/10 rounded-lg">
                    <Heart className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Add Timeline Entry</p>
                    <p className="text-sm text-muted-foreground">Record a treatment or appointment</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <a href="/cancer-track?action=add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Timeline Entry
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="action-view-summaries">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">View Summaries</p>
                    <p className="text-sm text-muted-foreground">See patient health overview</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <a href="/care-packets">
                    <Eye className="h-4 w-4 mr-2" />
                    View Care Packets
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="action-view-medications">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Pill className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Medications</p>
                    <p className="text-sm text-muted-foreground">View current medication list</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <a href="/medications">
                    <Eye className="h-4 w-4 mr-2" />
                    View Medications
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="action-appointments">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Appointments</p>
                    <p className="text-sm text-muted-foreground">View upcoming appointments</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <a href="/appointments">
                    <Eye className="h-4 w-4 mr-2" />
                    View Appointments
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="action-settings">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <Settings className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Notification Settings</p>
                    <p className="text-sm text-muted-foreground">Manage your alert preferences</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <a href="/caregivers?tab=settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Settings
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Respond to Notification
            </DialogTitle>
            <DialogDescription>
              Record your response or action taken for this notification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Response Type</Label>
              <Select value={responseType} onValueChange={setResponseType}>
                <SelectTrigger data-testid="select-response-type">
                  <SelectValue placeholder="Select response type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acknowledge">Acknowledge</SelectItem>
                  <SelectItem value="action_taken">Action Taken</SelectItem>
                  <SelectItem value="delegate">Delegate to Care Team</SelectItem>
                  <SelectItem value="note">Add Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message (Optional)</Label>
              <Textarea
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder="Add details about your response or action..."
                rows={3}
                data-testid="textarea-response-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResponseDialogOpen(false);
                setRespondingNotificationId(null);
                setResponseMessage("");
              }}
              data-testid="button-cancel-response"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (respondingNotificationId) {
                  respondMutation.mutate({
                    notificationId: respondingNotificationId,
                    responseType,
                    message: responseMessage,
                  });
                }
              }}
              disabled={respondMutation.isPending}
              data-testid="button-submit-response"
            >
              {respondMutation.isPending ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Response
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
