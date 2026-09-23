import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageGate } from "@/components/page-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import { 
  Share2, MessageSquare, Bell, BellRing, Users, FileText, Clock, 
  CheckCircle, AlertTriangle, AlertCircle, RefreshCw, Plus, Send,
  Eye, Lock, Unlock, Archive, Check, ThumbsUp, Flag, MessageCircle,
  ExternalLink, Calendar, User, Activity
} from "lucide-react";

const NO_CDS_DISCLAIMER = "DISCLAIMER: This collaboration feature is for care coordination and informational purposes only. It does NOT constitute clinical decision support and should NOT replace clinical judgment.";

const ShareFormSchema = z.object({
  contentId: z.string().min(1, "Select content to share"),
  recipientName: z.string().min(1, "Recipient name is required"),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientRole: z.string().min(1, "Role is required"),
  permissions: z.array(z.enum(["view", "comment", "export"])).min(1),
  expiresInHours: z.number().min(1).max(720),
  notes: z.string().optional()
});

const AnnotationFormSchema = z.object({
  targetType: z.enum(["patient_record", "workflow_task", "ai_insight", "care_plan", "lab_result", "medication", "document"]),
  targetId: z.string().min(1),
  content: z.string().min(1).max(5000),
  annotationType: z.enum(["comment", "note", "question", "action_item", "alert", "follow_up"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  patientId: z.string().optional(),
  patientName: z.string().optional()
});

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical": return "bg-red-500";
    case "high": return "bg-orange-500";
    case "medium": return "bg-yellow-500";
    case "low": return "bg-green-500";
    default: return "bg-gray-500";
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "critical_alert": return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "task_assigned": return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case "share_received": return <Share2 className="h-4 w-4 text-purple-500" />;
    case "mention": return <MessageCircle className="h-4 w-4 text-green-500" />;
    case "ai_insight": return <Activity className="h-4 w-4 text-cyan-500" />;
    default: return <Bell className="h-4 w-4 text-gray-500" />;
  }
}

export default function ProviderCollaboration() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<any>({
    queryKey: ["/api/collaboration-hub/dashboard"],
  });

  const { data: sharesData, isLoading: sharesLoading } = useQuery<any>({
    queryKey: ["/api/collaboration-hub/shares"],
  });

  const { data: shareableContentData } = useQuery<any>({
    queryKey: ["/api/collaboration-hub/shareable-content"],
  });

  const { data: annotationsData, isLoading: annotationsLoading, refetch: refetchAnnotations } = useQuery<any>({
    queryKey: ["/api/collaboration-hub/annotations"],
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery<any>({
    queryKey: ["/api/collaboration-hub/notifications"],
  });

  const shareForm = useForm<z.infer<typeof ShareFormSchema>>({
    resolver: zodResolver(ShareFormSchema),
    defaultValues: {
      contentId: "",
      recipientName: "",
      recipientEmail: "",
      recipientRole: "",
      permissions: ["view"],
      expiresInHours: 168,
      notes: ""
    }
  });

  const annotationForm = useForm<z.infer<typeof AnnotationFormSchema>>({
    resolver: zodResolver(AnnotationFormSchema),
    defaultValues: {
      targetType: "patient_record",
      targetId: "",
      content: "",
      annotationType: "note",
      priority: "medium"
    }
  });

  const createShareMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ShareFormSchema>) => {
      return apiRequest("POST", "/api/collaboration-hub/shares", {
        contentId: data.contentId,
        sharedWith: [{
          name: data.recipientName,
          email: data.recipientEmail || undefined,
          role: data.recipientRole
        }],
        permissions: data.permissions,
        expiresInHours: data.expiresInHours,
        notes: data.notes
      });
    },
    onSuccess: () => {
      toast({ title: "Share Created", description: "Content shared successfully" });
      setShareDialogOpen(false);
      shareForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration-hub/shares"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration-hub/dashboard"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create share", variant: "destructive" });
    }
  });

  const createAnnotationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof AnnotationFormSchema>) => {
      return apiRequest("POST", "/api/collaboration-hub/annotations", data);
    },
    onSuccess: () => {
      toast({ title: "Annotation Added", description: "Your note has been saved" });
      setAnnotationDialogOpen(false);
      annotationForm.reset();
      refetchAnnotations();
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add annotation", variant: "destructive" });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/collaboration-hub/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      refetchNotifications();
      refetchDashboard();
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/collaboration-hub/notifications/mark-all-read");
    },
    onSuccess: () => {
      toast({ title: "All Read", description: "All notifications marked as read" });
      refetchNotifications();
      refetchDashboard();
    }
  });

  const addReactionMutation = useMutation({
    mutationFn: async ({ annotationId, reactionType }: { annotationId: string; reactionType: string }) => {
      return apiRequest("POST", `/api/collaboration-hub/annotations/${annotationId}/reactions`, { reactionType });
    },
    onSuccess: () => {
      refetchAnnotations();
    }
  });

  const shares = sharesData?.shares || [];
  const annotations = annotationsData?.annotations || [];
  const notifications = notificationsData?.notifications || [];
  const shareableContent = shareableContentData?.content || [];

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading collaboration hub...</span>
      </div>
    );
  }

  const summary = dashboard?.summary || {};

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <PageGate feature="provider_collaboration" />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Provider Collaboration Hub</h1>
          <p className="text-muted-foreground">Secure sharing, annotations, and real-time notifications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchDashboard()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-share">
                <Share2 className="h-4 w-4 mr-2" />
                Share Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Share Content Securely</DialogTitle>
                <DialogDescription>Share patient summaries or workflow details with colleagues</DialogDescription>
              </DialogHeader>
              <Form {...shareForm}>
                <form onSubmit={shareForm.handleSubmit((data) => createShareMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={shareForm.control}
                    name="contentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content to Share</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-content">
                              <SelectValue placeholder="Select content" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {shareableContent.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={shareForm.control}
                    name="recipientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Dr. Jane Smith" data-testid="input-recipient-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={shareForm.control}
                    name="recipientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="jane@hospital.org" data-testid="input-recipient-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={shareForm.control}
                    name="recipientRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="physician">Physician</SelectItem>
                            <SelectItem value="specialist">Specialist</SelectItem>
                            <SelectItem value="nurse">Nurse</SelectItem>
                            <SelectItem value="care_coordinator">Care Coordinator</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={shareForm.control}
                    name="expiresInHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires In</FormLabel>
                        <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-expiry">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="72">3 days</SelectItem>
                            <SelectItem value="168">7 days</SelectItem>
                            <SelectItem value="336">14 days</SelectItem>
                            <SelectItem value="720">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={shareForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Add context for the recipient..." data-testid="input-share-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShareDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createShareMutation.isPending} data-testid="button-submit-share">
                      {createShareMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                      Share
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Care Coordination Only</AlertTitle>
        <AlertDescription>{NO_CDS_DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="stat-shares">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Share2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.activeShares || 0}</p>
                <p className="text-sm text-muted-foreground">Active Shares</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-annotations">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.pendingAnnotations || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Annotations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-notifications">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900">
                <Bell className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.unreadNotifications || 0}</p>
                <p className="text-sm text-muted-foreground">Unread Notifications</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-alerts">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.criticalAlerts || 0}</p>
                <p className="text-sm text-muted-foreground">Critical Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="shares" data-testid="tab-shares">Shares</TabsTrigger>
          <TabsTrigger value="annotations" data-testid="tab-annotations">Annotations</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            Notifications
            {summary.unreadNotifications > 0 && (
              <Badge variant="destructive" className="ml-2">{summary.unreadNotifications}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Recent Shares
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.recentShares?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.recentShares.slice(0, 5).map((share: any) => (
                      <div key={share.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg" data-testid={`share-item-${share.id}`}>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{share.contentTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            Shared with {share.sharedWith.map((r: any) => r.name).join(", ")}
                          </p>
                        </div>
                        <Badge variant={share.status === "active" ? "default" : "secondary"}>
                          {share.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No recent shares</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.teamActivity?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.teamActivity.map((member: any) => (
                      <div key={member.userId} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="p-2 rounded-full bg-primary/10">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{member.userName}</p>
                          <p className="text-sm text-muted-foreground">{member.userRole}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{member.activityCount} actions</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(member.lastActive).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No team activity</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5" />
                Unread Notifications
              </CardTitle>
              <CardDescription>Recent notifications requiring your attention</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.unreadNotifications?.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.unreadNotifications.slice(0, 5).map((notif: any) => (
                    <div 
                      key={notif.id} 
                      className="flex items-center gap-3 p-3 border rounded-lg hover-elevate cursor-pointer"
                      {...clickable(() => markReadMutation.mutate(notif.id))}
                      data-testid={`notification-${notif.id}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(notif.priority)}`} />
                      {getNotificationIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{notif.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{notif.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No unread notifications</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shares" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Shared Content</CardTitle>
                <CardDescription>Patient summaries and workflow details shared with colleagues</CardDescription>
              </div>
              <Button onClick={() => setShareDialogOpen(true)} data-testid="button-create-share">
                <Plus className="h-4 w-4 mr-2" />
                New Share
              </Button>
            </CardHeader>
            <CardContent>
              {sharesLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : shares.length > 0 ? (
                <div className="space-y-4">
                  {shares.map((share: any) => (
                    <Card key={share.id} className="overflow-hidden" data-testid={`share-card-${share.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <CardTitle className="text-lg">{share.contentTitle}</CardTitle>
                          <Badge variant={share.status === "active" ? "default" : share.status === "expired" ? "secondary" : "destructive"}>
                            {share.status === "active" ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                            {share.status}
                          </Badge>
                        </div>
                        <CardDescription>Type: {share.contentType.replace("_", " ")}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Shared With</p>
                            <p className="font-medium">{share.sharedWith.map((r: any) => r.name).join(", ")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Permissions</p>
                            <div className="flex gap-1 flex-wrap">
                              {share.permissions.map((p: string) => (
                                <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Access Count</p>
                            <p className="font-medium">{share.accessCount} views</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Expires</p>
                            <p className="font-medium">{new Date(share.expiresAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {share.patientName && (
                          <div className="mt-3 p-2 bg-muted rounded">
                            <p className="text-sm"><span className="text-muted-foreground">Patient:</span> {share.patientName}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No shares yet. Click "New Share" to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annotations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Annotations & Comments</CardTitle>
                <CardDescription>Notes, questions, and action items on patient records and tasks</CardDescription>
              </div>
              <Dialog open={annotationDialogOpen} onOpenChange={setAnnotationDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-annotation">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Annotation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Annotation</DialogTitle>
                    <DialogDescription>Add a note or comment to a patient record or task</DialogDescription>
                  </DialogHeader>
                  <Form {...annotationForm}>
                    <form onSubmit={annotationForm.handleSubmit((data) => createAnnotationMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={annotationForm.control}
                        name="targetType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="patient_record">Patient Record</SelectItem>
                                <SelectItem value="workflow_task">Workflow Task</SelectItem>
                                <SelectItem value="ai_insight">AI Insight</SelectItem>
                                <SelectItem value="care_plan">Care Plan</SelectItem>
                                <SelectItem value="lab_result">Lab Result</SelectItem>
                                <SelectItem value="medication">Medication</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={annotationForm.control}
                        name="targetId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="patient-001 or task-001" data-testid="input-target-id" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={annotationForm.control}
                        name="annotationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Annotation Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-annotation-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="note">Note</SelectItem>
                                <SelectItem value="comment">Comment</SelectItem>
                                <SelectItem value="question">Question</SelectItem>
                                <SelectItem value="action_item">Action Item</SelectItem>
                                <SelectItem value="alert">Alert</SelectItem>
                                <SelectItem value="follow_up">Follow-up</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={annotationForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-priority">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={annotationForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Enter your annotation..." rows={4} data-testid="input-annotation-content" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAnnotationDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createAnnotationMutation.isPending} data-testid="button-submit-annotation">
                          {createAnnotationMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                          Save
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {annotationsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : annotations.length > 0 ? (
                <div className="space-y-4">
                  {annotations.map((annotation: any) => (
                    <Card key={annotation.id} className="overflow-hidden" data-testid={`annotation-card-${annotation.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(annotation.priority)}`} />
                            <Badge variant="outline">{annotation.annotationType}</Badge>
                            <span className="text-sm text-muted-foreground">
                              on {annotation.targetType.replace("_", " ")}
                            </span>
                          </div>
                          {annotation.isResolved && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-3">{annotation.content}</p>
                        <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {annotation.author.name} ({annotation.author.role})
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(annotation.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {annotation.patientName && (
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">Patient:</span> {annotation.patientName}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-0 gap-2 flex-wrap">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => addReactionMutation.mutate({ annotationId: annotation.id, reactionType: "acknowledge" })}
                          data-testid={`button-acknowledge-${annotation.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => addReactionMutation.mutate({ annotationId: annotation.id, reactionType: "agree" })}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Agree
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => addReactionMutation.mutate({ annotationId: annotation.id, reactionType: "important" })}
                        >
                          <Flag className="h-3 w-3 mr-1" />
                          Important
                        </Button>
                        {!annotation.isResolved && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => addReactionMutation.mutate({ annotationId: annotation.id, reactionType: "resolved" })}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {annotation.reactions.length > 0 && (
                          <div className="ml-auto flex items-center gap-1">
                            {annotation.reactions.map((r: any, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{r.type}</Badge>
                            ))}
                          </div>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No annotations yet. Click "Add Annotation" to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Real-time updates from AI insights, workflows, and audits</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.length > 0 ? (
                <div className="space-y-2">
                  {notifications.map((notif: any) => (
                    <div 
                      key={notif.id} 
                      className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${!notif.isRead ? "bg-muted/50" : ""}`}
                      data-testid={`notification-item-${notif.id}`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 ${getPriorityColor(notif.priority)}`} />
                      {getNotificationIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{notif.title}</p>
                          <Badge variant="outline" className="text-xs">{notif.sourceModule}</Badge>
                          {notif.patientName && (
                            <Badge variant="secondary" className="text-xs">{notif.patientName}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(notif.createdAt).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            {notif.isRead ? <Eye className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                            {notif.isRead ? "Read" : "Unread"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!notif.isRead && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => markReadMutation.mutate(notif.id)}
                            data-testid={`button-mark-read-${notif.id}`}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        {notif.actionUrl && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={notif.actionUrl}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
