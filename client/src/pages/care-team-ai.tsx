import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
  Users,
  Calendar,
  MessageSquare,
  Bell,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Sparkles,
  Send,
  Check,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { clickable } from "@/lib/a11y";

interface PatientAlert {
  id: string;
  patientId: string;
  patientName: string;
  alertType: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

interface MeetingAgenda {
  id: string;
  generatedAt: string;
  meetingType: string;
  scheduledFor: string;
  attendees: string[];
  sections: {
    title: string;
    priority: string;
    items: {
      patientName?: string;
      topic: string;
      context: string;
      discussionPoints: string[];
    }[];
    timeAllocation: number;
  }[];
  estimatedDuration: number;
  disclaimer: string;
}

interface GroupChannel {
  id: string;
  name: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  members: { id: string; name: string; role: string }[];
  messages: {
    id: string;
    senderName: string;
    content: string;
    timestamp: string;
    type: string;
  }[];
  status: string;
}

interface CriticalNotification {
  id: string;
  type: string;
  priority: string;
  patientId: string;
  patientName: string;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

function MeetingAgendaCard() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [meetingType, setMeetingType] = useState("Care Team Huddle");
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/care-team/meeting-agenda", {
        meetingType,
        scheduledFor: new Date().toISOString(),
        attendees: ["Dr. Smith", "Nurse Garcia", "Dr. Williams"],
      });
      return result.json();
    },
    onSuccess: (data) => {
      setAgenda(data);
      toast({ title: "Agenda Generated", description: "Meeting agenda has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate agenda.", variant: "destructive" });
    },
  });

  const priorityColors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    standard: "bg-blue-500",
  };

  return (
    <Card data-testid="card-meeting-agenda">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          AI Meeting Agenda Generator
        </CardTitle>
        <CardDescription>
          Auto-generate team meeting agendas based on patient alerts and summaries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-generate-agenda">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Meeting Agenda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Meeting Agenda</DialogTitle>
              <DialogDescription>
                Create an AI-powered agenda based on current patient alerts
              </DialogDescription>
            </DialogHeader>

            {!agenda ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="care-team-ai-meeting-type">Meeting Type</Label>
                  <Select value={meetingType} onValueChange={setMeetingType}>
                    <SelectTrigger id="care-team-ai-meeting-type" data-testid="select-meeting-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="Care Team Huddle">Care Team Huddle</SelectItem>
                      <SelectItem value="Case Review">Case Review</SelectItem>
                      <SelectItem value="Quality Meeting">Quality Meeting</SelectItem>
                      <SelectItem value="Weekly Rounds">Weekly Rounds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    data-testid="button-create-agenda"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{agenda.meetingType}</h3>
                    <p className="text-sm text-muted-foreground">
                      Est. Duration: {agenda.estimatedDuration} minutes
                    </p>
                  </div>
                  <Badge variant="outline">
                    {format(new Date(agenda.generatedAt), "MMM d, h:mm a")}
                  </Badge>
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {agenda.sections.map((section, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${priorityColors[section.priority] || "bg-gray-500"}`} />
                            <h4 className="font-medium">{section.title}</h4>
                          </div>
                          <Badge variant="secondary">{section.timeAllocation} min</Badge>
                        </div>
                        
                        <div className="space-y-3">
                          {section.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="bg-muted/50 rounded p-3">
                              {item.patientName && (
                                <div className="flex items-center gap-1 mb-1">
                                  <User className="h-3 w-3" />
                                  <span className="text-sm font-medium">{item.patientName}</span>
                                </div>
                              )}
                              <p className="font-medium text-sm">{item.topic}</p>
                              <p className="text-xs text-muted-foreground mt-1">{item.context}</p>
                              <ul className="mt-2 space-y-1">
                                {item.discussionPoints.map((point, pIdx) => (
                                  <li key={pIdx} className="text-xs flex items-start gap-1">
                                    <ChevronRight className="h-3 w-3 mt-0.5 text-primary" />
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <p className="text-xs text-muted-foreground text-center">
                  {agenda.disclaimer}
                </p>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setAgenda(null)}>Generate Another</Button>
                  <Button onClick={() => setIsOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function GroupMessagingCard() {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [summary, setSummary] = useState<any>(null);

  const { data: channels, isLoading } = useQuery<GroupChannel[]>({
    queryKey: ["/api/care-team/channels"],
  });

  const { data: channelData, refetch: refetchChannel } = useQuery<GroupChannel>({
    queryKey: ["/api/care-team/channels", selectedChannel],
    enabled: !!selectedChannel,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", `/api/care-team/channels/${selectedChannel}/messages`, {
        content: newMessage,
        type: "message",
      });
      return result.json();
    },
    onSuccess: () => {
      setNewMessage("");
      refetchChannel();
      toast({ title: "Sent", description: "Message sent successfully." });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", `/api/care-team/channels/${selectedChannel}/summary`, {});
      return result.json();
    },
    onSuccess: (data) => {
      setSummary(data);
      toast({ title: "Summary Generated", description: "Discussion summary created." });
    },
  });

  const currentChannel = channels?.find(c => c.id === selectedChannel);

  return (
    <Card data-testid="card-group-messaging">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Secure Group Messaging
        </CardTitle>
        <CardDescription>
          Patient case channels with AI discussion summarization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 border rounded-lg p-3">
            <h4 className="font-medium mb-3 text-sm">Channels</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {channels?.map((channel) => (
                  <div
                    key={channel.id}
                    {...clickable(() => { setSelectedChannel(channel.id); setSummary(null); })}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedChannel === channel.id ? "bg-primary/10 border-primary border" : "hover-elevate"
                    }`}
                    data-testid={`channel-${channel.id}`}
                  >
                    <div className="font-medium text-sm truncate">{channel.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {channel.members.length} members
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 border rounded-lg p-3 min-h-[300px] flex flex-col">
            {selectedChannel && channelData ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{channelData.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Patient: {channelData.patientName}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateSummaryMutation.mutate()}
                    disabled={generateSummaryMutation.isPending}
                    data-testid="button-summarize-channel"
                  >
                    {generateSummaryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Summarize
                  </Button>
                </div>

                {summary ? (
                  <div className="bg-muted/50 rounded-lg p-3 mb-3">
                    <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Discussion Summary
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Key Points:</strong>
                        <ul className="list-disc ml-4 mt-1">
                          {summary.keyPoints?.map((p: string, i: number) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                      {summary.actionItems?.length > 0 && (
                        <div>
                          <strong>Action Items:</strong>
                          <ul className="list-disc ml-4 mt-1">
                            {summary.actionItems.map((a: any, i: number) => (
                              <li key={i}>{a.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSummary(null)}>
                      Hide Summary
                    </Button>
                  </div>
                ) : null}

                <ScrollArea className="flex-1 mb-3">
                  <div className="space-y-3">
                    {channelData.messages.map((msg) => (
                      <div key={msg.id} className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{msg.senderName}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.timestamp), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessageMutation.mutate()}
                    data-testid="input-channel-message"
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessageMutation.mutate()}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a channel to view messages
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsCard() {
  const { toast } = useToast();

  const { data: notifications, refetch } = useQuery<CriticalNotification[]>({
    queryKey: ["/api/care-team/notifications/unacknowledged"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("POST", `/api/care-team/notifications/${notificationId}/acknowledge`, {});
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/notifications"] });
      toast({ title: "Acknowledged", description: "Notification has been acknowledged." });
    },
  });

  const priorityColors: Record<string, string> = {
    critical: "border-red-500 bg-red-50 dark:bg-red-950/20",
    high: "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
    medium: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
  };

  return (
    <Card data-testid="card-notifications">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Critical Notifications
          {notifications && notifications.length > 0 && (
            <Badge variant="destructive">{notifications.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Proactive alerts for critical patient updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`border-l-4 rounded-lg p-4 ${priorityColors[notif.priority] || "border-gray-500"}`}
                data-testid={`notification-${notif.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={notif.priority === "critical" ? "destructive" : "secondary"}>
                        {notif.priority.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notif.timestamp), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <h4 className="font-medium">{notif.title}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <User className="h-3 w-3" />
                      {notif.patientName}
                    </p>
                    <p className="text-sm mt-2">{notif.message}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(notif.id)}
                    disabled={acknowledgeMutation.isPending}
                    data-testid={`button-acknowledge-${notif.id}`}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No unacknowledged notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PatientAlertsPanel() {
  const { data: alerts } = useQuery<PatientAlert[]>({
    queryKey: ["/api/care-team/patient-alerts"],
  });

  const alertTypeColors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
  };

  return (
    <Card data-testid="card-patient-alerts">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Recent Patient Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {alerts?.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${alert.acknowledged ? "opacity-60" : ""}`}
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${alertTypeColors[alert.alertType]}`} />
                  <span className="font-medium text-sm">{alert.patientName}</span>
                  <Badge variant="outline" className="text-xs">{alert.category}</Badge>
                </div>
                <p className="text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(alert.timestamp), "MMM d, h:mm a")}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function CareTeamAI() {
  const [activeTab, setActiveTab] = useState("collaboration");

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Care Team AI Collaboration
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered tools to facilitate care team coordination and communication
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="collaboration" data-testid="tab-collaboration">
            <Calendar className="h-4 w-4 mr-2" />
            Meetings & Agendas
          </TabsTrigger>
          <TabsTrigger value="messaging" data-testid="tab-messaging">
            <MessageSquare className="h-4 w-4 mr-2" />
            Group Messaging
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collaboration" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MeetingAgendaCard />
            </div>
            <div className="lg:col-span-1">
              <PatientAlertsPanel />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messaging">
          <GroupMessagingCard />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsCard />
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground">
          Informational only. All AI-generated content means educational reference. Requires clinical verification.
        </p>
      </div>
    </div>
  );
}
