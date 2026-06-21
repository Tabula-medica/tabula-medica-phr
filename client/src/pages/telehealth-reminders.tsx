import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Bell, BellRing, Clock, Mail,
  MessageSquare, Check, CheckCheck, Settings,
  Calendar, AlertTriangle, Loader2, Smartphone
} from "lucide-react";
import type {
  TelehealthReminderPreference,
  TelehealthReminder,
  TelehealthNotification,
  ReminderTiming,
  ReminderChannel,
} from "@shared/schema";

const TIMING_OPTIONS: { value: ReminderTiming; label: string }[] = [
  { value: "24_hours", label: "24 hours before" },
  { value: "2_hours", label: "2 hours before" },
  { value: "1_hour", label: "1 hour before" },
  { value: "30_minutes", label: "30 minutes before" },
  { value: "15_minutes", label: "15 minutes before" },
];

const CHANNEL_OPTIONS: { value: ReminderChannel; label: string; icon: typeof Bell }[] = [
  { value: "in_app", label: "In-App Notification", icon: Bell },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: Smartphone },
  { value: "push", label: "Push Notification", icon: BellRing },
];

export default function TelehealthRemindersPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const userId = "patient-001";

  const [selectedTimings, setSelectedTimings] = useState<ReminderTiming[]>(["1_hour"]);
  const [selectedChannels, setSelectedChannels] = useState<ReminderChannel[]>(["in_app"]);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const { data: preferences, isLoading: prefsLoading } = useQuery<TelehealthReminderPreference>({
    queryKey: ["/api/telehealth/reminder-preferences", userId],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/reminder-preferences/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  const { data: reminders, isLoading: remindersLoading } = useQuery<TelehealthReminder[]>({
    queryKey: ["/api/telehealth/reminders", { recipientId: userId }],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/reminders?recipientId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch reminders");
      return res.json();
    },
  });

  const { data: notifications, isLoading: notifsLoading } = useQuery<TelehealthNotification[]>({
    queryKey: ["/api/telehealth/notifications", userId],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/notifications/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/telehealth/reminders/stats", { userId }],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/reminders/stats?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  useEffect(() => {
    if (preferences) {
      setSelectedTimings(preferences.timings);
      setSelectedChannels(preferences.channels);
      setRemindersEnabled(preferences.enabled);
    }
  }, [preferences]);

  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/telehealth/reminder-preferences", {
        userId,
        userRole: "patient",
        channels: selectedChannels,
        timings: selectedTimings,
        enabled: remindersEnabled,
      });
      if (!response.ok) throw new Error("Failed to save preferences");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/reminder-preferences", userId] });
      toast({ title: "Preferences Saved", description: "Your reminder preferences have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const response = await apiRequest("PATCH", `/api/telehealth/reminders/${reminderId}/acknowledge`, {});
      if (!response.ok) throw new Error("Failed to acknowledge");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/reminders", { recipientId: userId }] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PATCH", `/api/telehealth/notifications/${notificationId}/read`, {});
      if (!response.ok) throw new Error("Failed to mark read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/notifications", userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/telehealth/notifications/${userId}/read-all`, {});
      if (!response.ok) throw new Error("Failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/notifications", userId] });
      toast({ title: "Done", description: "All notifications marked as read." });
    },
  });

  const toggleTiming = (timing: ReminderTiming) => {
    setSelectedTimings((prev) =>
      prev.includes(timing) ? prev.filter((t) => t !== timing) : [...prev, timing]
    );
  };

  const toggleChannel = (channel: ReminderChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" data-testid={`badge-status-${status}`}><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "sent":
        return <Badge variant="default" data-testid={`badge-status-${status}`}><Check className="h-3 w-3 mr-1" />Sent</Badge>;
      case "acknowledged":
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}><CheckCheck className="h-3 w-3 mr-1" />Acknowledged</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <Smartphone className="h-4 w-4" />;
      case "push": return <BellRing className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/telehealth")} data-testid="button-back-reminders">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Appointment Reminders</h1>
          <p className="text-muted-foreground">Manage your telehealth appointment reminder preferences and view notifications</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" data-testid="stat-total">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Reminders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" data-testid="stat-scheduled">{stats.scheduled}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" data-testid="stat-sent">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" data-testid="stat-acknowledged">{stats.acknowledged}</p>
              <p className="text-xs text-muted-foreground">Acknowledged</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="preferences" className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-reminders">
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="reminders" data-testid="tab-reminders">
            <Clock className="h-4 w-4 mr-2" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                Reminder Settings
                <div className="flex items-center gap-2">
                  <Label htmlFor="reminders-enabled" className="text-sm font-normal text-muted-foreground">
                    {remindersEnabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id="reminders-enabled"
                    checked={remindersEnabled}
                    onCheckedChange={setRemindersEnabled}
                    data-testid="switch-reminders-enabled"
                  />
                </div>
              </CardTitle>
              <CardDescription>
                Choose when and how you want to be reminded about upcoming telehealth appointments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Reminder Timing</Label>
                <p className="text-xs text-muted-foreground">Select when you want to receive reminders before your appointment</p>
                <div className="space-y-2">
                  {TIMING_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                      onClick={() => toggleTiming(option.value)}
                      data-testid={`timing-option-${option.value}`}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{option.label}</span>
                      </div>
                      <Switch
                        checked={selectedTimings.includes(option.value)}
                        onCheckedChange={() => toggleTiming(option.value)}
                        data-testid={`switch-timing-${option.value}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Notification Channels</Label>
                <p className="text-xs text-muted-foreground">Choose how you want to receive your reminders</p>
                <div className="space-y-2">
                  {CHANNEL_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <div
                        key={option.value}
                        className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                        onClick={() => toggleChannel(option.value)}
                        data-testid={`channel-option-${option.value}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{option.label}</span>
                        </div>
                        <Switch
                          checked={selectedChannels.includes(option.value)}
                          onCheckedChange={() => toggleChannel(option.value)}
                          data-testid={`switch-channel-${option.value}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Email and SMS reminders require verified contact information. In-app notifications are always available.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => savePreferencesMutation.mutate()}
                disabled={savePreferencesMutation.isPending || selectedTimings.length === 0 || selectedChannels.length === 0}
                className="w-full"
                data-testid="button-save-preferences"
              >
                {savePreferencesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reminders</CardTitle>
              <CardDescription>View all your upcoming and past appointment reminders</CardDescription>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !reminders || reminders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No reminders yet</p>
                  <p className="text-sm">Reminders will appear here when you have upcoming appointments</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border"
                        data-testid={`reminder-item-${reminder.id}`}
                      >
                        <div className="flex items-start gap-3">
                          {getChannelIcon(reminder.channel)}
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{reminder.appointmentTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              With {reminder.providerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {new Date(reminder.scheduledTime).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Reminder: {TIMING_OPTIONS.find(t => t.value === reminder.timing)?.label}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(reminder.status)}
                          {reminder.status === "sent" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeMutation.mutate(reminder.id)}
                              disabled={acknowledgeMutation.isPending}
                              data-testid={`button-acknowledge-${reminder.id}`}
                            >
                              <CheckCheck className="h-3 w-3 mr-1" />
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Your appointment reminder notifications</CardDescription>
                </div>
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    data-testid="button-mark-all-read"
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark All Read
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notifsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No notifications</p>
                  <p className="text-sm">You'll see appointment reminders here</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer hover-elevate ${
                          !notification.read ? "bg-primary/5 border-primary/20" : ""
                        }`}
                        onClick={() => {
                          if (!notification.read) markReadMutation.mutate(notification.id);
                          if (notification.actionUrl) navigate(notification.actionUrl);
                        }}
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${!notification.read ? "text-primary" : "text-muted-foreground"}`}>
                            {notification.type === "appointment_reminder" ? (
                              <BellRing className="h-4 w-4" />
                            ) : notification.type === "session_starting" ? (
                              <Calendar className="h-4 w-4" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className={`text-sm ${!notification.read ? "font-medium" : ""}`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
