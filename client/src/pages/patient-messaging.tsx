import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  AlertCircle,
  Mail,
  Bell,
  Smartphone,
  Users,
  TrendingUp,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  BookOpen,
  Heart,
  Activity,
  BarChart3,
  MousePointerClick,
  Inbox,
  Plus,
} from "lucide-react";
import type {
  MessageSchedule,
  PatientMessage,
  MessageInteraction,
  PatientEngagementSummary,
  GeneratedEducationContent,
  MessageTemplate,
  MessageType,
  MessageChannel,
  MessageStatus,
  GoalCategory,
} from "@shared/schema";

const messageTypeLabels: Record<MessageType, string> = {
  education: "Education",
  reminder: "Reminder",
  follow_up: "Follow-up",
  motivation: "Motivation",
  alert: "Alert",
  check_in: "Check-in",
};

const messageTypeColors: Record<MessageType, string> = {
  education: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400",
  reminder: "bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400",
  follow_up: "bg-purple-500/10 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400",
  motivation: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400",
  alert: "bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400",
  check_in: "bg-cyan-500/10 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-400",
};

const messageStatusColors: Record<MessageStatus, string> = {
  scheduled: "bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
  pending: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
  sent: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  delivered: "bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  failed: "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  cancelled: "bg-gray-500/10 text-gray-500 dark:bg-gray-500/20 dark:text-gray-500",
};

const channelIcons: Record<MessageChannel, typeof Mail> = {
  in_app: Inbox,
  sms: Smartphone,
  email: Mail,
  push: Bell,
};

function MessageTypeBadge({ type }: { type: MessageType }) {
  return (
    <Badge variant="outline" className={messageTypeColors[type]} data-testid={`badge-message-type-${type}`}>
      {messageTypeLabels[type]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: MessageStatus }) {
  const labels: Record<MessageStatus, string> = {
    scheduled: "Scheduled",
    pending: "Pending",
    sent: "Sent",
    delivered: "Delivered",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return (
    <Badge variant="outline" className={messageStatusColors[status]} data-testid={`badge-status-${status}`}>
      {labels[status]}
    </Badge>
  );
}

function ChannelBadge({ channel }: { channel: MessageChannel }) {
  const Icon = channelIcons[channel];
  const labels: Record<MessageChannel, string> = {
    in_app: "In-App",
    sms: "SMS",
    email: "Email",
    push: "Push",
  };
  return (
    <Badge variant="secondary" className="gap-1" data-testid={`badge-channel-${channel}`}>
      <Icon className="h-3 w-3" />
      {labels[channel]}
    </Badge>
  );
}

function EngagementCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof TrendingUp;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card data-testid={`card-engagement-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold" data-testid={`text-metric-${title.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-full ${
            trend === "up" ? "bg-green-500/10 text-green-600" :
            trend === "down" ? "bg-red-500/10 text-red-600" :
            "bg-muted text-muted-foreground"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageCard({ message, onView }: {
  message: PatientMessage;
  onView: () => void;
}) {
  const ChannelIcon = channelIcons[message.channel];
  
  return (
    <Card className="hover-elevate" data-testid={`card-message-${message.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <MessageTypeBadge type={message.type} />
              <StatusBadge status={message.status} />
            </div>
            <h4 className="font-medium truncate" data-testid={`text-message-subject-${message.id}`}>
              {message.subject}
            </h4>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {message.body}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <ChannelIcon className="h-3 w-3" />
                {message.channel === "in_app" ? "In-App" : message.channel.toUpperCase()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {message.sentAt ? format(new Date(message.sentAt), "MMM d, h:mm a") : "Scheduled"}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onView} data-testid={`button-view-message-${message.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleCard({ schedule, onCancel }: {
  schedule: MessageSchedule;
  onCancel: () => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-schedule-${schedule.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <MessageTypeBadge type={schedule.type} />
              <Badge variant={schedule.isActive ? "default" : "secondary"} data-testid={`badge-schedule-status-${schedule.id}`}>
                {schedule.isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <h4 className="font-medium truncate" data-testid={`text-schedule-title-${schedule.id}`}>
              {schedule.title}
            </h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Next: {format(new Date(schedule.nextScheduledDate), "MMM d")}
              </span>
              <div className="flex gap-1">
                {schedule.channels.map(ch => (
                  <ChannelBadge key={ch} channel={ch} />
                ))}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onCancel}
            disabled={!schedule.isActive}
            data-testid={`button-cancel-schedule-${schedule.id}`}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GenerateContentDialog({ onGenerate }: { onGenerate: (content: GeneratedEducationContent) => void }) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [carePlanId, setCarePlanId] = useState("");
  const [contentType, setContentType] = useState<MessageType>("education");
  const [focusArea, setFocusArea] = useState<GoalCategory>("medication_management");
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-messaging/generate-content", {
        patientId,
        carePlanId,
        contentType,
        focusAreas: [focusArea],
        preferredReadingLevel: "intermediate",
      });
      return response.json();
    },
    onSuccess: (data: GeneratedEducationContent) => {
      toast({
        title: "Content Generated",
        description: "AI education content has been generated successfully.",
      });
      onGenerate(data);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-generate-content">
          <Sparkles className="h-4 w-4" />
          Generate Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" data-testid="dialog-generate-content">
        <DialogHeader>
          <DialogTitle>Generate AI Education Content</DialogTitle>
          <DialogDescription>
            Create personalized patient education content using AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient ID</Label>
            <Input
              id="patientId"
              placeholder="Enter patient ID"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              data-testid="input-patient-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carePlanId">Care Plan ID</Label>
            <Input
              id="carePlanId"
              placeholder="Enter care plan ID"
              value={carePlanId}
              onChange={(e) => setCarePlanId(e.target.value)}
              data-testid="input-care-plan-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as MessageType)}>
              <SelectTrigger id="contentType" data-testid="select-content-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="motivation">Motivation</SelectItem>
                <SelectItem value="check_in">Check-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="focusArea">Focus Area</Label>
            <Select value={focusArea} onValueChange={(v) => setFocusArea(v as GoalCategory)}>
              <SelectTrigger id="focusArea" data-testid="select-focus-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medication_management">Medication Management</SelectItem>
                <SelectItem value="vital_monitoring">Vital Monitoring</SelectItem>
                <SelectItem value="lifestyle_modification">Lifestyle Modification</SelectItem>
                <SelectItem value="disease_management">Disease Management</SelectItem>
                <SelectItem value="preventive_care">Preventive Care</SelectItem>
                <SelectItem value="mental_health">Mental Health</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-generate">
            Cancel
          </Button>
          <Button 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !patientId || !carePlanId}
            data-testid="button-submit-generate"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendMessageDialog({ initialContent }: { initialContent?: GeneratedEducationContent }) {
  const [open, setOpen] = useState(!!initialContent);
  const [patientId, setPatientId] = useState("");
  const [channel, setChannel] = useState<MessageChannel>("in_app");
  const [subject, setSubject] = useState(initialContent?.subject || "");
  const [body, setBody] = useState(initialContent?.body || "");
  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-messaging/send", {
        patientId,
        type: "education",
        channel,
        subject,
        body,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "The message has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-messaging/messages"] });
      setOpen(false);
      setPatientId("");
      setSubject("");
      setBody("");
    },
    onError: (error: Error) => {
      toast({
        title: "Send Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-send-message">
          <Send className="h-4 w-4" />
          Send Message
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="dialog-send-message">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            Send a personalized message to a patient.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sendPatientId">Patient ID</Label>
            <Input
              id="sendPatientId"
              placeholder="Enter patient ID"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              data-testid="input-send-patient-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel">Delivery Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as MessageChannel)}>
              <SelectTrigger id="channel" data-testid="select-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-App Notification</SelectItem>
                <SelectItem value="sms">SMS Text Message</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-subject"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Message Body</Label>
            <Textarea
              id="body"
              placeholder="Enter your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              data-testid="textarea-body"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-send">
            Cancel
          </Button>
          <Button 
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !patientId || !subject || !body}
            data-testid="button-submit-send"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateScheduleDialog() {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [carePlanId, setCarePlanId] = useState("");
  const [type, setType] = useState<MessageType>("education");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"once" | "daily" | "weekly" | "biweekly" | "monthly">("weekly");
  const [channel, setChannel] = useState<MessageChannel>("in_app");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-messaging/schedules", {
        patientId,
        carePlanId,
        type,
        title,
        frequency,
        startDate: new Date().toISOString(),
        channels: [channel],
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Schedule Created",
        description: "Message schedule has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-messaging/schedules"] });
      setOpen(false);
      setPatientId("");
      setCarePlanId("");
      setTitle("");
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-create-schedule">
          <Plus className="h-4 w-4" />
          Create Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" data-testid="dialog-create-schedule">
        <DialogHeader>
          <DialogTitle>Create Message Schedule</DialogTitle>
          <DialogDescription>
            Set up automated messages for a patient.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="schedPatientId">Patient ID</Label>
            <Input
              id="schedPatientId"
              placeholder="Enter patient ID"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              data-testid="input-sched-patient-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedCarePlanId">Care Plan ID</Label>
            <Input
              id="schedCarePlanId"
              placeholder="Enter care plan ID"
              value={carePlanId}
              onChange={(e) => setCarePlanId(e.target.value)}
              data-testid="input-sched-care-plan-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedTitle">Schedule Title</Label>
            <Input
              id="schedTitle"
              placeholder="e.g., Weekly Medication Reminder"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-sched-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedType">Message Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MessageType)}>
              <SelectTrigger id="schedType" data-testid="select-sched-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="motivation">Motivation</SelectItem>
                <SelectItem value="check_in">Check-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedFrequency">Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
              <SelectTrigger id="schedFrequency" data-testid="select-sched-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedChannel">Delivery Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as MessageChannel)}>
              <SelectTrigger id="schedChannel" data-testid="select-sched-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-App</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-schedule">
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !patientId || !carePlanId || !title}
            data-testid="button-submit-schedule"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Create Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewMessageDialog({ message, open, onOpenChange }: {
  message: PatientMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-view-message">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <MessageSquare className="h-5 w-5" />
            {message.subject}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <MessageTypeBadge type={message.type} />
            <StatusBadge status={message.status} />
            <ChannelBadge channel={message.channel} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Message Content</h4>
            <div className="bg-muted rounded-md p-4">
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            </div>
          </div>
          
          {message.personalizedContent && (
            <>
              {message.personalizedContent.educationTips && message.personalizedContent.educationTips.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Education Tips
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {message.personalizedContent.educationTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {message.personalizedContent.actionItems && message.personalizedContent.actionItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Action Items
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {message.personalizedContent.actionItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {message.personalizedContent.encouragement && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Encouragement
                  </h4>
                  <p className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/30 p-3 rounded-md">
                    {message.personalizedContent.encouragement}
                  </p>
                </div>
              )}
            </>
          )}
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Patient ID:</span>
              <span className="ml-2 font-medium">{message.patientId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sent:</span>
              <span className="ml-2 font-medium">
                {message.sentAt ? format(new Date(message.sentAt), "MMM d, yyyy h:mm a") : "Not sent"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Delivered:</span>
              <span className="ml-2 font-medium">
                {message.deliveredAt ? format(new Date(message.deliveredAt), "MMM d, yyyy h:mm a") : "Pending"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Retry Count:</span>
              <span className="ml-2 font-medium">{message.retryCount}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-message">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientMessagingPage() {
  const [activeTab, setActiveTab] = useState("messages");
  const [selectedMessage, setSelectedMessage] = useState<PatientMessage | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedEducationContent | null>(null);
  const { toast } = useToast();

  const { data: messages = [], isLoading: messagesLoading } = useQuery<PatientMessage[]>({
    queryKey: ["/api/patient-messaging/messages"],
    queryFn: async () => {
      const response = await fetch("/api/patient-messaging/messages");
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<MessageSchedule[]>({
    queryKey: ["/api/patient-messaging/schedules"],
    queryFn: async () => {
      const response = await fetch("/api/patient-messaging/schedules");
      if (!response.ok) throw new Error("Failed to fetch schedules");
      return response.json();
    },
  });

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/patient-messaging/templates"],
    queryFn: async () => {
      const response = await fetch("/api/patient-messaging/templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const response = await apiRequest("DELETE", `/api/patient-messaging/schedules/${scheduleId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Schedule Cancelled",
        description: "The message schedule has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-messaging/schedules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processScheduledMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-messaging/process-scheduled");
      return response.json();
    },
    onSuccess: (data: { processed: number; failed: number }) => {
      toast({
        title: "Schedules Processed",
        description: `Processed ${data.processed} messages, ${data.failed} failed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-messaging/messages"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewMessage = (message: PatientMessage) => {
    setSelectedMessage(message);
    setMessageDialogOpen(true);
  };

  const handleGeneratedContent = (content: GeneratedEducationContent) => {
    setGeneratedContent(content);
    toast({
      title: "Content Ready",
      description: "Generated content is ready. You can now send it to a patient.",
    });
  };

  // Calculate engagement metrics
  const totalMessages = messages.length;
  const deliveredMessages = messages.filter(m => m.status === "delivered").length;
  const activeSchedules = schedules.filter(s => s.isActive).length;
  const deliveryRate = totalMessages > 0 ? Math.round((deliveredMessages / totalMessages) * 100) : 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-patient-messaging">
            <MessageSquare className="h-6 w-6" />
            Patient Education Messaging
          </h1>
          <p className="text-muted-foreground">
            AI-powered personalized education and follow-up messaging
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GenerateContentDialog onGenerate={handleGeneratedContent} />
          <SendMessageDialog initialContent={generatedContent || undefined} />
          <CreateScheduleDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <EngagementCard
          title="Total Messages"
          value={totalMessages}
          subtitle="All time"
          icon={MessageSquare}
        />
        <EngagementCard
          title="Delivered"
          value={deliveredMessages}
          subtitle={`${deliveryRate}% delivery rate`}
          icon={CheckCircle2}
          trend={deliveryRate > 80 ? "up" : deliveryRate < 50 ? "down" : "neutral"}
        />
        <EngagementCard
          title="Active Schedules"
          value={activeSchedules}
          subtitle="Automated messaging"
          icon={Calendar}
        />
        <EngagementCard
          title="Templates"
          value={templates.length}
          subtitle="Available templates"
          icon={BookOpen}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-2" data-testid="tab-schedules">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedules</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>View and manage patient messages</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground">Send a message or create a schedule to get started</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {messages.map(message => (
                      <MessageCard
                        key={message.id}
                        message={message}
                        onView={() => handleViewMessage(message)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>Message Schedules</CardTitle>
                <CardDescription>Automated messaging based on care plans</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => processScheduledMutation.mutate()}
                disabled={processScheduledMutation.isPending}
                data-testid="button-process-scheduled"
              >
                {processScheduledMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Process Now
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {schedulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No schedules configured</p>
                  <p className="text-sm text-muted-foreground">Create a schedule to automate patient messaging</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {schedules.map(schedule => (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                        onCancel={() => cancelScheduleMutation.mutate(schedule.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Pre-configured templates for patient education</CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No templates available</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {templates.map(template => (
                      <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <MessageTypeBadge type={template.type} />
                                <Badge variant="secondary">{template.category.replace(/_/g, " ")}</Badge>
                              </div>
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{template.subject}</p>
                              <div className="flex gap-1 mt-2">
                                {template.channels.map(ch => (
                                  <ChannelBadge key={ch} channel={ch} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {generatedContent && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              AI-Generated Content Ready
            </CardTitle>
            <CardDescription>
              This content was generated using AI and is ready to send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Subject</h4>
              <p className="text-sm bg-background rounded-md p-2">{generatedContent.subject}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Body</h4>
              <p className="text-sm bg-background rounded-md p-2 whitespace-pre-wrap">{generatedContent.body}</p>
            </div>
            {generatedContent.educationTips.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">Education Tips</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {generatedContent.educationTips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                {generatedContent.safetyDisclaimer}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setGeneratedContent(null)} variant="outline" data-testid="button-clear-generated">
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ViewMessageDialog
        message={selectedMessage}
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
      />
    </div>
  );
}
