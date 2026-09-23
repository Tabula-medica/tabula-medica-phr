import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  Send,
  Clock,
  Calendar,
  Pill,
  Heart,
  Activity,
  FileText,
  Target,
  Sparkles,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Info,
  TrendingUp,
  BarChart3,
  Settings,
  Plus,
  Zap,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type ReminderType = "appointment" | "medication" | "preventive_care" | "follow_up" | "wellness" | "lab_result" | "prescription_refill" | "health_goal";
type ReminderChannel = "email" | "sms" | "push" | "in_app";
type ReminderPriority = "low" | "medium" | "high" | "urgent";
type ReminderStatus = "scheduled" | "sent" | "delivered" | "opened" | "acknowledged" | "snoozed" | "dismissed" | "failed";

interface SmartReminder {
  id: string;
  patientId: string;
  patientName: string;
  type: ReminderType;
  priority: ReminderPriority;
  title: string;
  message: string;
  aiPersonalizedMessage?: string;
  scheduledFor: string;
  dueDate?: string;
  channels: ReminderChannel[];
  status: ReminderStatus;
  metadata: {
    appointmentId?: string;
    medicationId?: string;
    providerName?: string;
    facilityName?: string;
  };
  deliveryAttempts: { id: string; channel: ReminderChannel; status: string; attemptedAt: string }[];
  responseHistory: { id: string; responseType: string; respondedAt: string }[];
  aiOptimization?: {
    optimalTime: string;
    optimalChannel: ReminderChannel;
    personalizedTone: string;
    confidenceScore: number;
  };
  noCdsDisclaimer: string;
}

interface ReminderAnalytics {
  totalReminders: number;
  byType: { [key: string]: number };
  byStatus: { [key: string]: number };
  deliveryRate: number;
  acknowledgeRate: number;
  actionRate: number;
  averageResponseTime: number;
  channelPerformance: { channel: ReminderChannel; sent: number; delivered: number; deliveryRate: number }[];
  aiInsights: string[];
}

function getReminderTypeIcon(type: ReminderType) {
  switch (type) {
    case "appointment": return <Calendar className="h-4 w-4" />;
    case "medication": return <Pill className="h-4 w-4" />;
    case "preventive_care": return <Heart className="h-4 w-4" />;
    case "follow_up": return <Activity className="h-4 w-4" />;
    case "wellness": return <Sparkles className="h-4 w-4" />;
    case "lab_result": return <FileText className="h-4 w-4" />;
    case "prescription_refill": return <Pill className="h-4 w-4" />;
    case "health_goal": return <Target className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
}

function getChannelIcon(channel: ReminderChannel) {
  switch (channel) {
    case "email": return <Mail className="h-3 w-3" />;
    case "sms": return <MessageSquare className="h-3 w-3" />;
    case "push": return <Smartphone className="h-3 w-3" />;
    case "in_app": return <Bell className="h-3 w-3" />;
  }
}

function getPriorityVariant(priority: ReminderPriority): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "destructive";
    case "medium": return "default";
    default: return "secondary";
  }
}

function getStatusVariant(status: ReminderStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "acknowledged": return "default";
    case "sent":
    case "delivered":
    case "opened": return "secondary";
    case "failed": return "destructive";
    default: return "outline";
  }
}

export default function EnhancedPatientReminders() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: remindersData, isLoading: remindersLoading, refetch } = useQuery<{ reminders: SmartReminder[] }>({
    queryKey: ["/api/enhanced-reminders/reminders"],
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<{ analytics: ReminderAnalytics }>({
    queryKey: ["/api/enhanced-reminders/analytics"],
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/enhanced-reminders/reminders/${id}/send`);
    },
    onSuccess: () => {
      toast({ title: "Reminder sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-reminders/reminders"] });
    },
    onError: () => {
      toast({ title: "Failed to send reminder", variant: "destructive" });
    }
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ id, responseType }: { id: string; responseType: string }) => {
      return apiRequest("POST", `/api/enhanced-reminders/reminders/${id}/acknowledge`, { responseType });
    },
    onSuccess: () => {
      toast({ title: "Reminder acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-reminders/reminders"] });
    }
  });

  const reminders = remindersData?.reminders || [];
  const analytics = analyticsData?.analytics;

  const filteredReminders = reminders.filter(r => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  if (remindersLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
              Smart Patient Reminders
            </h1>
            <p className="text-muted-foreground">
              AI-powered personalized reminders with smart timing and multi-channel delivery
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-reminder">
                  <Plus className="h-4 w-4 mr-2" />
                  New Reminder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Reminder</DialogTitle>
                  <DialogDescription>
                    Create a smart reminder with AI personalization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="text-sm text-muted-foreground">
                    Reminder creation form would go here. Sample reminders are pre-populated.
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(false)}>
                    Create Reminder
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription className="text-sm">
            These reminders are for informational purposes only. They do NOT constitute medical advice. Always consult with your healthcare provider.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Total Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-reminders">
                {analytics?.totalReminders || reminders.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4" />
                Delivery Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-delivery-rate">
                {analytics?.deliveryRate?.toFixed(1) || 0}%
              </div>
              <Progress value={analytics?.deliveryRate || 0} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Acknowledge Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-acknowledge-rate">
                {analytics?.acknowledgeRate?.toFixed(1) || 0}%
              </div>
              <Progress value={analytics?.acknowledgeRate || 0} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Action Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-action-rate">
                {analytics?.actionRate?.toFixed(1) || 0}%
              </div>
              <Progress value={analytics?.actionRate || 0} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reminders" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="reminders" data-testid="tab-reminders">
              <Bell className="h-4 w-4 mr-2 hidden sm:inline" />
              Reminders
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2 hidden sm:inline" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2 hidden sm:inline" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reminders" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-4">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="select-type-filter">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="appointment">Appointments</SelectItem>
                  <SelectItem value="medication">Medications</SelectItem>
                  <SelectItem value="preventive_care">Preventive Care</SelectItem>
                  <SelectItem value="prescription_refill">Prescription Refills</SelectItem>
                  <SelectItem value="wellness">Wellness</SelectItem>
                  <SelectItem value="health_goal">Health Goals</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="snoozed">Snoozed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              {filteredReminders.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No reminders found matching your filters.
                  </CardContent>
                </Card>
              ) : (
                filteredReminders.map((reminder) => (
                  <Card key={reminder.id} data-testid={`card-reminder-${reminder.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getReminderTypeIcon(reminder.type)}
                          <div>
                            <CardTitle className="text-base">{reminder.title}</CardTitle>
                            <CardDescription>{reminder.patientName}</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={getPriorityVariant(reminder.priority)}>
                            {reminder.priority}
                          </Badge>
                          <Badge variant={getStatusVariant(reminder.status)}>
                            {reminder.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{reminder.message}</p>
                        {reminder.aiPersonalizedMessage && (
                          <div className="bg-muted/50 rounded-md p-3">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <Sparkles className="h-3 w-3" />
                              AI Personalized
                            </div>
                            <p className="text-sm">{reminder.aiPersonalizedMessage}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>Scheduled: {format(new Date(reminder.scheduledFor), "MMM d, h:mm a")}</span>
                        </div>
                        {reminder.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>Due: {format(new Date(reminder.dueDate), "MMM d")}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Channels:</span>
                        {reminder.channels.map((channel) => (
                          <Badge key={channel} variant="outline" className="text-xs">
                            {getChannelIcon(channel)}
                            <span className="ml-1">{channel}</span>
                          </Badge>
                        ))}
                      </div>

                      {reminder.aiOptimization && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          <span>
                            AI suggests: {reminder.aiOptimization.optimalChannel} at {reminder.aiOptimization.optimalTime}
                            ({(reminder.aiOptimization.confidenceScore * 100).toFixed(0)}% confidence)
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {reminder.status === "scheduled" && (
                          <Button
                            size="sm"
                            onClick={() => sendMutation.mutate(reminder.id)}
                            disabled={sendMutation.isPending}
                            data-testid={`button-send-${reminder.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send Now
                          </Button>
                        )}
                        {(reminder.status === "sent" || reminder.status === "delivered") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeMutation.mutate({ id: reminder.id, responseType: "acknowledged" })}
                            data-testid={`button-acknowledge-${reminder.id}`}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 mt-4">
            {analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analytics?.aiInsights?.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Channel Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics?.channelPerformance?.map((channel) => (
                          <div key={channel.channel} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="flex items-center gap-1 capitalize">
                                {getChannelIcon(channel.channel)}
                                {channel.channel}
                              </span>
                              <span>{channel.deliveryRate.toFixed(1)}%</span>
                            </div>
                            <Progress value={channel.deliveryRate} className="h-2" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Reminders by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analytics?.byType && Object.entries(analytics.byType).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-sm">
                            <span className="flex items-center gap-2 capitalize">
                              {getReminderTypeIcon(type as ReminderType)}
                              {type.replace("_", " ")}
                            </span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reminder Preferences</CardTitle>
                <CardDescription>Configure how and when you receive reminders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <FieldCaption>AI Personalization</FieldCaption>
                    <p className="text-sm text-muted-foreground">Use AI to personalize reminder messages</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-ai-personalization" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <FieldCaption>Smart Timing</FieldCaption>
                    <p className="text-sm text-muted-foreground">Optimize delivery times based on your response patterns</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-smart-timing" />
                </div>

                <div className="space-y-2">
                  <FieldCaption>Preferred Channels</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {["email", "sms", "push", "in_app"].map((channel) => (
                      <Badge 
                        key={channel} 
                        variant="outline" 
                        className="cursor-pointer toggle-elevate"
                      >
                        {getChannelIcon(channel as ReminderChannel)}
                        <span className="ml-1 capitalize">{channel.replace("_", " ")}</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="enhanced-patient-reminde-quiet-hours-start">Quiet Hours Start</Label>
                    <Input id="enhanced-patient-reminde-quiet-hours-start" type="time" defaultValue="22:00" data-testid="input-quiet-start" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enhanced-patient-reminde-quiet-hours-end">Quiet Hours End</Label>
                    <Input id="enhanced-patient-reminde-quiet-hours-end" type="time" defaultValue="07:00" data-testid="input-quiet-end" />
                  </div>
                </div>

                <Button className="w-full" data-testid="button-save-preferences">
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
