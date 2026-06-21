import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Plus,
  UserPlus,
  Shield,
  Clock,
  MessageSquare,
  Send,
  AlertCircle,
  CheckCircle,
  Calendar,
  Pill,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  User,
  Mail,
  Loader2,
  Heart,
  MessageCircleQuestion,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface CaregiverAccess {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  relationship: string;
  accessLevel: "limited" | "standard" | "full";
  permissions: {
    viewSymptoms: boolean;
    viewAppointments: boolean;
    viewMedications: boolean;
    viewLabResults: boolean;
    viewAiInsights: boolean;
    viewJournal: boolean;
    sendMessages: boolean;
  };
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

interface CaregiverMessage {
  id: string;
  patientId: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "caregiver" | "clinician";
  recipientId: string;
  recipientRole: "patient" | "caregiver" | "clinician";
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface HealthAlert {
  type: string;
  severity: "info" | "warning" | "urgent";
  message: string;
  date: string;
}

interface CaregiverHealthSummary {
  patientName: string;
  summaryDate: string;
  overallStatus: "stable" | "improving" | "needs_attention";
  statusDescription: string;
  recentSymptoms: Array<{ name: string; severity: string; date: string }>;
  upcomingAppointments: Array<{ type: string; date: string; provider: string }>;
  medicationUpdates: string[];
  keyAlerts: HealthAlert[];
  aiInsights: string[];
  suggestedQuestions: string[];
  disclaimer: string;
}

const accessFormSchema = z.object({
  caregiverName: z.string().min(2, "Name is required"),
  caregiverEmail: z.string().email("Valid email required"),
  relationship: z.string().min(1, "Relationship is required"),
  accessLevel: z.enum(["limited", "standard", "full"]),
  expirationDays: z.string(),
  viewSymptoms: z.boolean(),
  viewAppointments: z.boolean(),
  viewMedications: z.boolean(),
  viewLabResults: z.boolean(),
  viewAiInsights: z.boolean(),
  viewJournal: z.boolean(),
  sendMessages: z.boolean(),
});

type AccessFormValues = z.infer<typeof accessFormSchema>;

const messageFormSchema = z.object({
  recipientId: z.string().min(1, "Select a recipient"),
  content: z.string().min(1, "Message cannot be empty"),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

function StatusIcon({ status }: { status: string }) {
  if (status === "improving") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (status === "needs_attention") return <AlertCircle className="h-4 w-4 text-orange-500" />;
  return <Minus className="h-4 w-4 text-blue-500" />;
}

function AlertBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  return (
    <Badge className={colors[severity] || colors.info} variant="secondary">
      {severity}
    </Badge>
  );
}

function AccessLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    limited: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    standard: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    full: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };
  return (
    <Badge className={colors[level] || colors.limited} variant="secondary">
      {level}
    </Badge>
  );
}

function CaregiverCard({ 
  access, 
  onRevoke 
}: { 
  access: CaregiverAccess; 
  onRevoke: (id: string) => void;
}) {
  const expiresAt = new Date(access.expiresAt);
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  
  return (
    <div className="p-4 rounded-lg border hover-elevate">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{access.caregiverName}</p>
            <p className="text-xs text-muted-foreground">{access.relationship}</p>
          </div>
        </div>
        <AccessLevelBadge level={access.accessLevel} />
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <Mail className="h-3 w-3" />
        {access.caregiverEmail}
      </div>
      
      <div className="flex items-center gap-2 text-xs mb-3">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className={isExpiringSoon ? "text-orange-500" : "text-muted-foreground"}>
          Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1 mb-3">
        {access.permissions.viewSymptoms && (
          <Badge variant="outline" className="text-xs">Symptoms</Badge>
        )}
        {access.permissions.viewAppointments && (
          <Badge variant="outline" className="text-xs">Appointments</Badge>
        )}
        {access.permissions.viewMedications && (
          <Badge variant="outline" className="text-xs">Medications</Badge>
        )}
        {access.permissions.viewLabResults && (
          <Badge variant="outline" className="text-xs">Lab Results</Badge>
        )}
        {access.permissions.viewAiInsights && (
          <Badge variant="outline" className="text-xs">AI Insights</Badge>
        )}
        {access.permissions.sendMessages && (
          <Badge variant="outline" className="text-xs">Messaging</Badge>
        )}
      </div>
      
      <div className="flex justify-end gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onRevoke(access.id)}
          className="text-destructive hover:text-destructive"
          data-testid={`button-revoke-${access.id}`}
        >
          <EyeOff className="h-3 w-3 mr-1" />
          Revoke Access
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: CaregiverMessage; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] ${isOwn ? "order-2" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          {!isOwn && (
            <span className="text-xs font-medium">{message.senderName}</span>
          )}
          <Badge variant="outline" className="text-xs">
            {message.senderRole}
          </Badge>
        </div>
        <div className={`p-3 rounded-lg ${
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        }`}>
          <p className="text-sm">{message.content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function HealthSummaryPanel({ summary }: { summary: CaregiverHealthSummary }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <StatusIcon status={summary.overallStatus} />
          <span className="font-medium capitalize">{summary.overallStatus.replace("_", " ")}</span>
        </div>
        <p className="text-sm text-muted-foreground">{summary.statusDescription}</p>
      </div>

      {summary.keyAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Key Alerts
          </p>
          {summary.keyAlerts.map((alert, i) => (
            <div key={i} className="p-3 rounded-lg border flex items-start gap-2">
              <AlertBadge severity={alert.severity} />
              <p className="text-sm flex-1">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {summary.recentSymptoms.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="symptoms">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Recent Symptoms ({summary.recentSymptoms.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {summary.recentSymptoms.map((symptom, i) => (
                  <div key={i} className="p-2 rounded border flex items-center justify-between">
                    <span className="text-sm">{symptom.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{symptom.severity}</Badge>
                      <span className="text-xs text-muted-foreground">{symptom.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {summary.upcomingAppointments.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="appointments">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Upcoming Appointments ({summary.upcomingAppointments.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {summary.upcomingAppointments.map((apt, i) => (
                  <div key={i} className="p-2 rounded border">
                    <p className="text-sm font-medium">{apt.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {apt.date} with {apt.provider}
                    </p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {summary.aiInsights.length > 0 && (
        <div className="p-3 rounded-lg border bg-purple-50/50 dark:bg-purple-950/20">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI Insights
          </p>
          <ul className="space-y-1">
            {summary.aiInsights.map((insight, i) => (
              <li key={i} className="text-sm">• {insight}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.suggestedQuestions.length > 0 && (
        <div className="p-3 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <MessageCircleQuestion className="h-3 w-3" />
            Questions for Discussion
          </p>
          <ul className="space-y-1">
            {summary.suggestedQuestions.map((q, i) => (
              <li key={i} className="text-sm">• {q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-2 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground text-center">
          {summary.disclaimer}
        </p>
      </div>
    </div>
  );
}

export function CaregiverSupportCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [addAccessOpen, setAddAccessOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");

  const accessForm = useForm<AccessFormValues>({
    resolver: zodResolver(accessFormSchema),
    defaultValues: {
      caregiverName: "",
      caregiverEmail: "",
      relationship: "",
      accessLevel: "standard",
      expirationDays: "30",
      viewSymptoms: true,
      viewAppointments: true,
      viewMedications: false,
      viewLabResults: false,
      viewAiInsights: true,
      viewJournal: false,
      sendMessages: true,
    },
  });

  const { data: caregivers, isLoading: caregiversLoading } = useQuery<CaregiverAccess[]>({
    queryKey: ["/api/caregivers/access"],
    enabled: open,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<CaregiverMessage[]>({
    queryKey: ["/api/caregivers/messages"],
    enabled: open,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<CaregiverHealthSummary>({
    queryKey: ["/api/caregivers/summary"],
    enabled: open,
  });

  const addAccessMutation = useMutation({
    mutationFn: async (data: AccessFormValues) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(data.expirationDays));
      
      const res = await fetch("/api/caregivers/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caregiverName: data.caregiverName,
          caregiverEmail: data.caregiverEmail,
          relationship: data.relationship,
          accessLevel: data.accessLevel,
          expiresAt: expiresAt.toISOString(),
          permissions: {
            viewSymptoms: data.viewSymptoms,
            viewAppointments: data.viewAppointments,
            viewMedications: data.viewMedications,
            viewLabResults: data.viewLabResults,
            viewAiInsights: data.viewAiInsights,
            viewJournal: data.viewJournal,
            sendMessages: data.sendMessages,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to add caregiver");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caregivers/access"] });
      accessForm.reset();
      setAddAccessOpen(false);
      toast({
        title: "Caregiver added",
        description: "Access has been granted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add caregiver access.",
        variant: "destructive",
      });
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const res = await fetch(`/api/caregivers/access/${accessId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke access");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caregivers/access"] });
      toast({ title: "Access revoked" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke access.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { recipientId: string; content: string }) => {
      const res = await fetch("/api/caregivers/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: data.recipientId,
          recipientRole: "caregiver",
          content: data.content,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caregivers/messages"] });
      setMessageInput("");
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    },
  });

  const onSubmitAccess = (data: AccessFormValues) => {
    addAccessMutation.mutate(data);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedRecipient) return;
    sendMessageMutation.mutate({
      recipientId: selectedRecipient,
      content: messageInput,
    });
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          AI Caregiver Support
        </CardTitle>
        <CardDescription>
          Grant temporary access to caregivers with AI health summaries and secure messaging
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            You control what data caregivers can see
          </span>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-open-caregiver-support">
              <Users className="h-4 w-4 mr-2" />
              Manage Caregiver Access
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Caregiver Support Center
              </DialogTitle>
              <DialogDescription>
                Manage caregiver access, view AI health summaries, and communicate securely
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="caregivers" className="w-full flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="caregivers" data-testid="tab-caregivers">
                  <Users className="h-3 w-3 mr-1" />
                  Caregivers
                </TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Summary
                </TabsTrigger>
                <TabsTrigger value="messages" data-testid="tab-messages">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Messages
                </TabsTrigger>
              </TabsList>

              <TabsContent value="caregivers" className="mt-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {caregivers?.filter(c => c.isActive).length || 0} active caregivers
                  </p>
                  <Dialog open={addAccessOpen} onOpenChange={setAddAccessOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-add-caregiver">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Caregiver
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Caregiver Access</DialogTitle>
                        <DialogDescription>
                          Grant temporary access to a family member or caregiver.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...accessForm}>
                        <form onSubmit={accessForm.handleSubmit(onSubmitAccess)} className="space-y-4">
                          <FormField
                            control={accessForm.control}
                            name="caregiverName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Caregiver Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Jane Smith" {...field} data-testid="input-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accessForm.control}
                            name="caregiverEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="jane@email.com" {...field} data-testid="input-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accessForm.control}
                            name="relationship"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Relationship</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-relationship">
                                      <SelectValue placeholder="Select relationship" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Spouse">Spouse</SelectItem>
                                    <SelectItem value="Parent">Parent</SelectItem>
                                    <SelectItem value="Adult Child">Adult Child</SelectItem>
                                    <SelectItem value="Sibling">Sibling</SelectItem>
                                    <SelectItem value="Friend">Friend</SelectItem>
                                    <SelectItem value="Professional Caregiver">Professional Caregiver</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accessForm.control}
                            name="expirationDays"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Access Duration</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-duration">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="14">14 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="90">90 days</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="space-y-3 pt-2 border-t">
                            <p className="text-sm font-medium">Data Access Permissions</p>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={accessForm.control}
                                name="viewSymptoms"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-sm">Symptoms</FormLabel>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accessForm.control}
                                name="viewAppointments"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-sm">Appointments</FormLabel>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accessForm.control}
                                name="viewMedications"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-sm">Medications</FormLabel>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accessForm.control}
                                name="viewLabResults"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-sm">Lab Results</FormLabel>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accessForm.control}
                                name="viewAiInsights"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-sm">AI Insights</FormLabel>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accessForm.control}
                                name="sendMessages"
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-sm">Messaging</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button 
                              type="submit" 
                              disabled={addAccessMutation.isPending}
                              data-testid="button-submit-access"
                            >
                              {addAccessMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                <>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Grant Access
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  {caregiversLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-32" />
                      <Skeleton className="h-32" />
                    </div>
                  ) : caregivers && caregivers.filter(c => c.isActive).length > 0 ? (
                    <div className="space-y-3">
                      {caregivers.filter(c => c.isActive).map((access) => (
                        <CaregiverCard 
                          key={access.id} 
                          access={access}
                          onRevoke={(id) => revokeAccessMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-2">No caregivers added yet</p>
                      <p className="text-sm text-muted-foreground">
                        Add a caregiver to share health data and receive support
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="summary" className="mt-4 flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {summaryLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24" />
                      <Skeleton className="h-32" />
                      <Skeleton className="h-24" />
                    </div>
                  ) : summary ? (
                    <HealthSummaryPanel summary={summary} />
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        Add health data to generate AI summaries for caregivers
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="messages" className="mt-4 flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 pr-4 mb-4">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  ) : messages && messages.length > 0 ? (
                    <div>
                      {messages.map((msg) => (
                        <MessageBubble 
                          key={msg.id} 
                          message={msg}
                          isOwn={msg.senderRole === "patient"}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No messages yet</p>
                    </div>
                  )}
                </ScrollArea>

                <div className="border-t pt-4">
                  <div className="flex gap-2 mb-2">
                    <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                      <SelectTrigger className="w-[180px]" data-testid="select-recipient">
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {caregivers?.filter(c => c.isActive && c.permissions.sendMessages).map((c) => (
                          <SelectItem key={c.caregiverId} value={c.caregiverId}>
                            {c.caregiverName}
                          </SelectItem>
                        ))}
                        <SelectItem value="clinician-1">Dr. Sarah Johnson</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Textarea 
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="min-h-[60px]"
                      data-testid="textarea-message"
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || !selectedRecipient || sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
