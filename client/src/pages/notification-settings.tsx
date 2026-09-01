import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Volume2,
  VolumeX,
  Moon,
  Clock,
  AlertTriangle,
  Heart,
  Calendar,
  Pill,
  Users,
  Settings,
  Check,
  Send,
  Info,
} from "lucide-react";

type NotificationCategory = "message" | "alert" | "health_update" | "reminder" | "appointment" | "medication" | "caregiver" | "system";

interface NotificationPreferences {
  userId: string;
  enabledCategories: NotificationCategory[];
  channels: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  emailDigest: "realtime" | "daily" | "weekly" | "none";
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showPreview: boolean;
  priorityFilter: string[];
  updatedAt: string;
}

const categoryConfig: { category: NotificationCategory; label: string; description: string; icon: typeof Bell }[] = [
  { category: "message", label: "Messages", description: "Messages from your care team and providers", icon: MessageSquare },
  { category: "alert", label: "Health Alerts", description: "Important health-related alerts and warnings", icon: AlertTriangle },
  { category: "health_update", label: "Health Updates", description: "Updates about your health records and results", icon: Heart },
  { category: "reminder", label: "Reminders", description: "General health reminders and follow-ups", icon: Clock },
  { category: "appointment", label: "Appointments", description: "Appointment reminders and scheduling updates", icon: Calendar },
  { category: "medication", label: "Medications", description: "Medication reminders and refill notifications", icon: Pill },
  { category: "caregiver", label: "Caregiver Updates", description: "Updates from caregivers and shared access", icon: Users },
  { category: "system", label: "System", description: "System updates and account notifications", icon: Settings },
];

export default function NotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefsData, isLoading } = useQuery<{ success: boolean; preferences: NotificationPreferences }>({
    queryKey: ["/api/unified-notifications/preferences"],
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return apiRequest("PUT", "/api/unified-notifications/preferences", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-notifications/preferences"] });
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/unified-notifications/test");
    },
    onSuccess: () => {
      toast({
        title: "Test notification sent",
        description: "Check your notifications to verify settings.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/unified-notifications"] });
    },
  });

  const preferences = prefsData?.preferences;

  const toggleCategory = (category: NotificationCategory) => {
    if (!preferences) return;
    const enabled = preferences.enabledCategories || [];
    const newEnabled = enabled.includes(category)
      ? enabled.filter(c => c !== category)
      : [...enabled, category];
    updatePrefsMutation.mutate({ enabledCategories: newEnabled });
  };

  const toggleChannel = (channel: keyof NotificationPreferences["channels"]) => {
    if (!preferences) return;
    updatePrefsMutation.mutate({
      channels: {
        ...preferences.channels,
        [channel]: !preferences.channels[channel],
      },
    });
  };

  const updateQuietHours = (updates: Partial<NotificationPreferences["quietHours"]>) => {
    if (!preferences) return;
    updatePrefsMutation.mutate({
      quietHours: {
        ...preferences.quietHours,
        ...updates,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notification Settings</h1>
            <p className="text-muted-foreground">Loading your preferences...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Notification Settings</h1>
            <p className="text-muted-foreground">Manage how you receive notifications</p>
          </div>
        </div>
        <Button
          onClick={() => sendTestMutation.mutate()}
          disabled={sendTestMutation.isPending}
          variant="outline"
          className="gap-2"
          data-testid="button-send-test"
        >
          <Send className="h-4 w-4" />
          Send Test Notification
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Delivery Channels
          </CardTitle>
          <CardDescription>Choose how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <FieldCaption className="font-medium">In-App</FieldCaption>
                  <p className="text-xs text-muted-foreground">Show notifications in the app</p>
                </div>
              </div>
              <Switch
                checked={preferences?.channels?.in_app ?? true}
                onCheckedChange={() => toggleChannel("in_app")}
                data-testid="switch-channel-in-app"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <FieldCaption className="font-medium">Email</FieldCaption>
                  <p className="text-xs text-muted-foreground">Receive email notifications</p>
                </div>
              </div>
              <Switch
                checked={preferences?.channels?.email ?? true}
                onCheckedChange={() => toggleChannel("email")}
                data-testid="switch-channel-email"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <FieldCaption className="font-medium">SMS</FieldCaption>
                  <p className="text-xs text-muted-foreground">Text message alerts</p>
                </div>
              </div>
              <Switch
                checked={preferences?.channels?.sms ?? false}
                onCheckedChange={() => toggleChannel("sms")}
                data-testid="switch-channel-sms"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <div>
                  <FieldCaption className="font-medium">Push</FieldCaption>
                  <p className="text-xs text-muted-foreground">Browser push notifications</p>
                </div>
              </div>
              <Switch
                checked={preferences?.channels?.push ?? true}
                onCheckedChange={() => toggleChannel("push")}
                data-testid="switch-channel-push"
              />
            </div>
          </div>

          {preferences?.channels?.email && (
            <div className="p-4 border rounded-lg">
              <Label htmlFor="notification-settings-email-digest-frequency" className="font-medium mb-2 block">Email Digest Frequency</Label>
              <Select
                value={preferences?.emailDigest || "daily"}
                onValueChange={(value) => updatePrefsMutation.mutate({ emailDigest: value as any })}
              >
                <SelectTrigger id="notification-settings-email-digest-frequency" className="w-full sm:w-48" data-testid="select-email-digest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                  <SelectItem value="none">No emails</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Sound & Display
          </CardTitle>
          <CardDescription>Configure notification alerts and previews</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {preferences?.soundEnabled ? (
                <Volume2 className="h-5 w-5 text-primary" />
              ) : (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <FieldCaption className="font-medium">Notification Sound</FieldCaption>
                <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
              </div>
            </div>
            <Switch
              checked={preferences?.soundEnabled ?? true}
              onCheckedChange={(checked) => updatePrefsMutation.mutate({ soundEnabled: checked })}
              data-testid="switch-sound"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-primary" />
              <div>
                <FieldCaption className="font-medium">Vibration</FieldCaption>
                <p className="text-xs text-muted-foreground">Vibrate on mobile devices</p>
              </div>
            </div>
            <Switch
              checked={preferences?.vibrationEnabled ?? true}
              onCheckedChange={(checked) => updatePrefsMutation.mutate({ vibrationEnabled: checked })}
              data-testid="switch-vibration"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-primary" />
              <div>
                <FieldCaption className="font-medium">Show Preview</FieldCaption>
                <p className="text-xs text-muted-foreground">Show message preview in notifications</p>
              </div>
            </div>
            <Switch
              checked={preferences?.showPreview ?? true}
              onCheckedChange={(checked) => updatePrefsMutation.mutate({ showPreview: checked })}
              data-testid="switch-preview"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Pause notifications during specific hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-primary" />
              <div>
                <FieldCaption className="font-medium">Enable Quiet Hours</FieldCaption>
                <p className="text-xs text-muted-foreground">Mute non-urgent notifications</p>
              </div>
            </div>
            <Switch
              checked={preferences?.quietHours?.enabled ?? false}
              onCheckedChange={(checked) => updateQuietHours({ enabled: checked })}
              data-testid="switch-quiet-hours"
            />
          </div>

          {preferences?.quietHours?.enabled && (
            <div className="grid gap-4 sm:grid-cols-2 p-4 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="notification-settings-start-time" className="text-sm mb-2 block">Start Time</Label>
                <Input id="notification-settings-start-time"
                  type="time"
                  value={preferences?.quietHours?.start || "22:00"}
                  onChange={(e) => updateQuietHours({ start: e.target.value })}
                  data-testid="input-quiet-start"
                />
              </div>
              <div>
                <Label htmlFor="notification-settings-end-time" className="text-sm mb-2 block">End Time</Label>
                <Input id="notification-settings-end-time"
                  type="time"
                  value={preferences?.quietHours?.end || "07:00"}
                  onChange={(e) => updateQuietHours({ end: e.target.value })}
                  data-testid="input-quiet-end"
                />
              </div>
            </div>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Urgent Notifications</AlertTitle>
            <AlertDescription>
              Urgent health alerts will always be delivered, even during quiet hours.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Categories
          </CardTitle>
          <CardDescription>Choose which types of notifications to receive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryConfig.map(({ category, label, description, icon: Icon }) => {
              const isEnabled = preferences?.enabledCategories?.includes(category) ?? true;
              return (
                <div
                  key={category}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <FieldCaption className="font-medium">{label}</FieldCaption>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleCategory(category)}
                    data-testid={`switch-category-${category}`}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="secondary" className="text-xs">
          <Check className="h-3 w-3 mr-1" />
          Changes saved automatically
        </Badge>
      </div>
    </div>
  );
}
