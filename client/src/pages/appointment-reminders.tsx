import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  Settings,
  Plus,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Edit2,
  Trash2,
  ChevronRight,
  BarChart3,
  Users,
  FileText,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface Appointment {
  id: string;
  profileId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  providerName: string;
  facilityName: string;
  appointmentType: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "confirmed" | "cancelled" | "completed";
}

interface ReminderConfig {
  id: string;
  name: string;
  intervalMinutes: number;
  enabled: boolean;
  channels: ("email" | "sms" | "push")[];
  templateId: string;
}

interface ReminderTemplate {
  id: string;
  name: string;
  subject: string;
  emailBody: string;
  smsBody: string;
  pushTitle: string;
  pushBody: string;
}

interface SentReminder {
  id: string;
  appointmentId: string;
  reminderId: string;
  channel: "email" | "sms" | "push";
  sentAt: string;
  status: "sent" | "delivered" | "failed";
  errorMessage?: string;
}

interface ReminderStats {
  total: number;
  last24Hours: number;
  last7Days: number;
  byChannel: { email: number; sms: number; push: number };
  byStatus: { sent: number; delivered: number; failed: number };
  queuedReminders: number;
  upcomingAppointments: number;
}

function formatInterval(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return `${days} day${days > 1 ? "s" : ""} before`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? "s" : ""} before`;
  }
  return `${minutes} minute${minutes > 1 ? "s" : ""} before`;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  push: Smartphone,
};

export default function AppointmentReminders() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReminderConfig | null>(null);

  const { data: appointments, isLoading: appointmentsLoading } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/appointments"],
  });

  const { data: configs, isLoading: configsLoading } = useQuery<{ configs: ReminderConfig[] }>({
    queryKey: ["/api/reminder-configs"],
  });

  const { data: templates } = useQuery<{ templates: ReminderTemplate[] }>({
    queryKey: ["/api/reminder-templates"],
  });

  const { data: sentReminders } = useQuery<{ reminders: SentReminder[] }>({
    queryKey: ["/api/reminders/sent"],
  });

  const { data: stats } = useQuery<ReminderStats>({
    queryKey: ["/api/reminders/stats"],
  });

  const { data: queue } = useQuery<{ queue: any[] }>({
    queryKey: ["/api/reminders/queue"],
  });

  const toggleConfigMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/reminder-configs/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminder-configs"] });
      toast({ title: "Configuration updated" });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async ({ appointmentId, configId }: { appointmentId: string; configId: string }) => {
      return apiRequest("POST", "/api/reminders/send-now", { appointmentId, configId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/stats"] });
      toast({ title: "Reminder sent", description: "The reminder has been sent successfully" });
    },
  });

  const upcomingAppointments = appointments?.appointments
    .filter(a => a.status === "scheduled" && new Date(a.scheduledAt) > new Date())
    .slice(0, 5) || [];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Bell className="w-6 h-6 text-primary" />
          Appointment Reminders
        </h1>
        <p className="text-muted-foreground mt-1">
          Automatically send reminders to patients before their appointments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="w-4 h-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <FileText className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reminders Sent (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.last24Hours || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reminders Sent (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.last7Days || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Queued Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.queuedReminders || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming Appointments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.upcomingAppointments || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Upcoming Appointments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : upcomingAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No upcoming appointments</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.map(apt => (
                      <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{apt.patientName}</p>
                          <p className="text-sm text-muted-foreground">
                            {apt.appointmentType} with {apt.providerName}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(apt.scheduledAt), "PPp")}
                          </p>
                        </div>
                        <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>
                          {apt.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Active Reminder Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                {configsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {configs?.configs.map(config => (
                      <div key={config.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(enabled) => toggleConfigMutation.mutate({ id: config.id, enabled })}
                            data-testid={`switch-config-${config.id}`}
                          />
                          <div>
                            <p className="font-medium">{config.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {config.channels.map(channel => {
                                const Icon = channelIcons[channel];
                                return (
                                  <Badge key={channel} variant="outline" className="text-xs">
                                    <Icon className="w-3 h-3 mr-1" />
                                    {channel}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatInterval(config.intervalMinutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Stats by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{stats.byChannel.email}</p>
                    <p className="text-sm text-muted-foreground">Emails</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold">{stats.byChannel.sms}</p>
                    <p className="text-sm text-muted-foreground">SMS</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Smartphone className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <p className="text-2xl font-bold">{stats.byChannel.push}</p>
                    <p className="text-sm text-muted-foreground">Push</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Appointments</CardTitle>
              <Button data-testid="button-add-appointment">
                <Plus className="w-4 h-4 mr-2" />
                Add Appointment
              </Button>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {appointments?.appointments.map(apt => (
                      <Card key={apt.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{apt.patientName}</p>
                              <Badge variant={
                                apt.status === "confirmed" ? "default" :
                                apt.status === "cancelled" ? "destructive" :
                                apt.status === "completed" ? "secondary" :
                                "outline"
                              }>
                                {apt.status}
                              </Badge>
                            </div>
                            <p className="text-sm">{apt.appointmentType}</p>
                            <p className="text-sm text-muted-foreground">
                              {apt.providerName} at {apt.facilityName}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(apt.scheduledAt), "PPp")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {apt.duration} min
                              </span>
                              {apt.patientEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {apt.patientEmail}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {apt.status === "scheduled" && configs?.configs[0] && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendNowMutation.mutate({
                                  appointmentId: apt.id,
                                  configId: configs.configs[0].id
                                })}
                                disabled={sendNowMutation.isPending}
                                data-testid={`button-send-reminder-${apt.id}`}
                              >
                                {sendNowMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-1" />
                                    Send Now
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Reminder Rules</CardTitle>
                <CardDescription>Configure when and how reminders are sent</CardDescription>
              </div>
              <Button onClick={() => setShowConfigDialog(true)} data-testid="button-add-rule">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {configs?.configs.map(config => {
                  const template = templates?.templates.find(t => t.id === config.templateId);
                  return (
                    <Card key={config.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(enabled) => toggleConfigMutation.mutate({ id: config.id, enabled })}
                          />
                          <div>
                            <p className="font-medium">{config.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Send reminder {formatInterval(config.intervalMinutes)}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Channels:</span>
                              {config.channels.map(channel => {
                                const Icon = channelIcons[channel];
                                return (
                                  <Badge key={channel} variant="outline" className="text-xs">
                                    <Icon className="w-3 h-3 mr-1" />
                                    {channel}
                                  </Badge>
                                );
                              })}
                            </div>
                            {template && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Template: {template.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-${config.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Customize the content of reminder messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates?.templates.map(template => (
                  <Card key={template.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Subject: {template.subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {template.emailBody.slice(0, 150)}...
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" data-testid={`button-edit-template-${template.id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sent Reminders</CardTitle>
              <CardDescription>History of all sent reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {sentReminders?.reminders.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No reminders have been sent yet
                    </p>
                  ) : (
                    sentReminders?.reminders.map(reminder => {
                      const apt = appointments?.appointments.find(a => a.id === reminder.appointmentId);
                      const Icon = channelIcons[reminder.channel];
                      return (
                        <div key={reminder.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              reminder.status === "sent" ? "bg-green-100 text-green-600" :
                              reminder.status === "failed" ? "bg-red-100 text-red-600" :
                              "bg-blue-100 text-blue-600"
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {apt?.patientName || "Unknown Patient"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {apt?.appointmentType} - {reminder.channel}
                              </p>
                              {reminder.errorMessage && (
                                <p className="text-xs text-destructive">{reminder.errorMessage}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={
                              reminder.status === "sent" ? "default" :
                              reminder.status === "failed" ? "destructive" :
                              "secondary"
                            }>
                              {reminder.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(reminder.sentAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
