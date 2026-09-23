import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Link2,
  Bell,
  CheckCircle,
  Clock,
  Activity,
  FileText,
  Pill,
  Calendar,
  Heart,
  FlaskConical,
  RefreshCw,
  Eye,
  ThumbsUp,
  MessageSquare,
  Shield,
  Loader2,
} from "lucide-react";

const SAMPLE_PATIENT_ID = "patient-123";
const SAMPLE_USER_ID = "care-team-user-001";

type AlertSeverity = "info" | "warning" | "critical" | "urgent";

interface CareGap {
  id: string;
  patientId: string;
  type: string;
  description: string;
  severity: AlertSeverity;
  suggestedAction: string;
  relatedModules: string[];
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  aiConfidence: number;
}

interface InterModuleLink {
  id: string;
  patientId: string;
  sourceModule: string;
  sourceId: string;
  sourceDescription: string;
  targetModule: string;
  targetId: string;
  targetDescription: string;
  linkType: string;
  aiReasoning: string;
  confidence: number;
  suggestedAt: string;
  accepted: boolean;
  acceptedBy?: string;
}

interface CriticalEvent {
  id: string;
  patientId: string;
  eventType: string;
  severity: AlertSeverity;
  summary: string;
  details: string;
  affectedModules: string[];
  triggeredAt: string;
  requiresReview: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

const moduleIcons: Record<string, typeof Activity> = {
  appointments: Calendar,
  treatments: Heart,
  symptoms: Activity,
  documents: FileText,
  medications: Pill,
  vitals: Activity,
  lab_results: FlaskConical,
};

function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
    case "urgent":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "warning":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "info":
    default:
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  }
}

function getSeverityBadgeVariant(severity: AlertSeverity): "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "critical":
    case "urgent":
      return "destructive";
    case "warning":
      return "secondary";
    default:
      return "outline";
  }
}

export default function CareMonitoringPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CriticalEvent | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { toast } = useToast();

  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["/api/care-monitoring/summary", SAMPLE_PATIENT_ID],
  });

  const { data: gapsData, isLoading: isLoadingGaps } = useQuery({
    queryKey: ["/api/care-monitoring/gaps", SAMPLE_PATIENT_ID],
  });

  const { data: linksData, isLoading: isLoadingLinks } = useQuery({
    queryKey: ["/api/care-monitoring/links", SAMPLE_PATIENT_ID],
  });

  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["/api/care-monitoring/events", SAMPLE_PATIENT_ID],
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/care-monitoring/run-analysis", {
        patientId: SAMPLE_PATIENT_ID,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/summary", SAMPLE_PATIENT_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/gaps", SAMPLE_PATIENT_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/links", SAMPLE_PATIENT_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/events", SAMPLE_PATIENT_ID] });
      toast({
        title: "Analysis Complete",
        description: "AI care monitoring analysis has been run successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to run care monitoring analysis.",
        variant: "destructive",
      });
    },
  });

  const acknowledgeGapMutation = useMutation({
    mutationFn: async (gapId: string) => {
      return apiRequest("POST", `/api/care-monitoring/gaps/${SAMPLE_PATIENT_ID}/${gapId}/acknowledge`, {
        userId: SAMPLE_USER_ID,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/gaps", SAMPLE_PATIENT_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/summary", SAMPLE_PATIENT_ID] });
      toast({ title: "Care Gap Acknowledged" });
    },
  });

  const acceptLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest("POST", `/api/care-monitoring/links/${SAMPLE_PATIENT_ID}/${linkId}/accept`, {
        userId: SAMPLE_USER_ID,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/links", SAMPLE_PATIENT_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/summary", SAMPLE_PATIENT_ID] });
      toast({ title: "Link Accepted" });
    },
  });

  const reviewEventMutation = useMutation({
    mutationFn: async ({ eventId, notes }: { eventId: string; notes: string }) => {
      return apiRequest("POST", `/api/care-monitoring/events/${SAMPLE_PATIENT_ID}/${eventId}/review`, {
        userId: SAMPLE_USER_ID,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/events", SAMPLE_PATIENT_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-monitoring/summary", SAMPLE_PATIENT_ID] });
      setReviewDialogOpen(false);
      setSelectedEvent(null);
      setReviewNotes("");
      toast({ title: "Event Reviewed" });
    },
  });

  const summary = (summaryData as any)?.summary;
  const gaps: CareGap[] = (gapsData as any)?.gaps || [];
  const links: InterModuleLink[] = (linksData as any)?.links || [];
  const events: CriticalEvent[] = (eventsData as any)?.events || [];

  const openReviewDialog = (event: CriticalEvent) => {
    setSelectedEvent(event);
    setReviewNotes("");
    setReviewDialogOpen(true);
  };

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            AI Care Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Proactive care gap detection, inter-module linking, and critical event alerts
          </p>
        </div>
        <Button
          onClick={() => runAnalysisMutation.mutate()}
          disabled={runAnalysisMutation.isPending}
          data-testid="button-run-analysis"
        >
          {runAnalysisMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run AI Analysis
        </Button>
      </div>

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <span>
            <strong>Important (NO-CDS Compliance):</strong> This AI monitoring system provides informational alerts only. 
            All outputs are for <strong>care coordination and documentation purposes</strong>. They are NOT medical advice, 
            diagnoses, or treatment recommendations. Clinical judgment is required for all healthcare decisions.
          </span>
        </p>
      </div>

      {isLoadingSummary ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.unacknowledgedGaps}</p>
                  <p className="text-sm text-muted-foreground">Care Gaps</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Link2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.pendingLinks}</p>
                  <p className="text-sm text-muted-foreground">Pending Links</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Bell className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.unreviewedEvents}</p>
                  <p className="text-sm text-muted-foreground">Unreviewed Events</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.criticalCount}</p>
                  <p className="text-sm text-muted-foreground">Critical Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="gaps" data-testid="tab-gaps">
            Care Gaps
            {gaps.filter(g => !g.acknowledged).length > 0 && (
              <Badge variant="secondary" className="ml-2">{gaps.filter(g => !g.acknowledged).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="links" data-testid="tab-links">
            Module Links
            {links.filter(l => !l.accepted).length > 0 && (
              <Badge variant="secondary" className="ml-2">{links.filter(l => !l.accepted).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            Critical Events
            {events.filter(e => e.requiresReview).length > 0 && (
              <Badge variant="destructive" className="ml-2">{events.filter(e => e.requiresReview).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Recent Care Gaps
                </CardTitle>
                <CardDescription>Documentation and scheduling gaps detected by AI</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGaps ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : gaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No care gaps detected. Run analysis to check for gaps.
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {gaps.slice(0, 5).map((gap) => (
                        <div
                          key={gap.id}
                          className={`p-3 rounded-lg border ${getSeverityColor(gap.severity)}`}
                          data-testid={`card-gap-${gap.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{gap.type.replace(/_/g, " ")}</p>
                              <p className="text-xs mt-1">{gap.description}</p>
                            </div>
                            {gap.acknowledged ? (
                              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <Badge variant={getSeverityBadgeVariant(gap.severity)} className="shrink-0">
                                {gap.severity}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-red-600" />
                  Critical Events
                </CardTitle>
                <CardDescription>Events requiring care team review</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEvents ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No critical events. Run analysis to detect events.
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {events.slice(0, 5).map((event) => (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border ${getSeverityColor(event.severity)}`}
                          data-testid={`card-event-${event.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{event.summary}</p>
                              <p className="text-xs mt-1 text-muted-foreground">
                                {new Date(event.triggeredAt).toLocaleDateString()}
                              </p>
                            </div>
                            {event.requiresReview ? (
                              <Badge variant="destructive" className="shrink-0">Needs Review</Badge>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gaps" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Care Gap Analysis</CardTitle>
              <CardDescription>
                AI-identified documentation patterns and scheduling gaps. These are for informational purposes only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingGaps ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : gaps.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No care gaps detected yet.</p>
                  <Button
                    onClick={() => runAnalysisMutation.mutate()}
                    disabled={runAnalysisMutation.isPending}
                    className="mt-4"
                  >
                    Run Analysis
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {gaps.map((gap) => (
                    <div
                      key={gap.id}
                      className={`p-4 rounded-lg border ${getSeverityColor(gap.severity)}`}
                      data-testid={`card-gap-detail-${gap.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getSeverityBadgeVariant(gap.severity)}>
                              {gap.severity}
                            </Badge>
                            <span className="font-medium">{gap.type.replace(/_/g, " ")}</span>
                            <span className="text-xs text-muted-foreground">
                              Confidence: {Math.round(gap.aiConfidence * 100)}%
                            </span>
                          </div>
                          <p className="text-sm">{gap.description}</p>
                          <p className="text-sm text-muted-foreground">
                            <strong>Suggested Action:</strong> {gap.suggestedAction}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Related:</span>
                            {gap.relatedModules.map((mod) => {
                              const Icon = moduleIcons[mod] || FileText;
                              return (
                                <Badge key={mod} variant="outline" className="text-xs">
                                  <Icon className="h-3 w-3 mr-1" />
                                  {mod.replace(/_/g, " ")}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {gap.acknowledged ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Acknowledged</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeGapMutation.mutate(gap.id)}
                              disabled={acknowledgeGapMutation.isPending}
                              data-testid={`button-acknowledge-${gap.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Inter-Module Link Suggestions</CardTitle>
              <CardDescription>
                AI-suggested connections between different health data modules to improve record organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLinks ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : links.length === 0 ? (
                <div className="text-center py-8">
                  <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No link suggestions yet.</p>
                  <Button
                    onClick={() => runAnalysisMutation.mutate()}
                    disabled={runAnalysisMutation.isPending}
                    className="mt-4"
                  >
                    Run Analysis
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {links.map((link) => {
                    const SourceIcon = moduleIcons[link.sourceModule] || FileText;
                    const TargetIcon = moduleIcons[link.targetModule] || FileText;
                    return (
                      <div
                        key={link.id}
                        className="p-4 border rounded-lg space-y-3"
                        data-testid={`card-link-${link.id}`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                            <SourceIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">{link.sourceDescription}</span>
                          </div>
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                            <TargetIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">{link.targetDescription}</span>
                          </div>
                          <Badge variant="outline">{link.linkType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Confidence: {Math.round(link.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{link.aiReasoning}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Suggested: {new Date(link.suggestedAt).toLocaleDateString()}
                          </span>
                          {link.accepted ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Accepted</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => acceptLinkMutation.mutate(link.id)}
                              disabled={acceptLinkMutation.isPending}
                              data-testid={`button-accept-link-${link.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Accept Link
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Critical Events for Review</CardTitle>
              <CardDescription>
                Events flagged for care team attention. Clinical judgment is required for all decisions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No critical events detected.</p>
                  <Button
                    onClick={() => runAnalysisMutation.mutate()}
                    disabled={runAnalysisMutation.isPending}
                    className="mt-4"
                  >
                    Run Analysis
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border ${getSeverityColor(event.severity)}`}
                      data-testid={`card-event-detail-${event.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getSeverityBadgeVariant(event.severity)}>
                              {event.severity}
                            </Badge>
                            <span className="font-medium">{event.summary}</span>
                          </div>
                          <p className="text-sm">{event.details}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Affected modules:</span>
                            {event.affectedModules.map((mod) => {
                              const Icon = moduleIcons[mod] || FileText;
                              return (
                                <Badge key={mod} variant="outline" className="text-xs">
                                  <Icon className="h-3 w-3 mr-1" />
                                  {mod.replace(/_/g, " ")}
                                </Badge>
                              );
                            })}
                          </div>
                          {event.reviewNotes && (
                            <div className="p-2 bg-muted rounded mt-2">
                              <p className="text-xs text-muted-foreground">Review Notes:</p>
                              <p className="text-sm">{event.reviewNotes}</p>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {event.requiresReview ? (
                            <Button
                              size="sm"
                              onClick={() => openReviewDialog(event)}
                              data-testid={`button-review-${event.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Reviewed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Critical Event</DialogTitle>
            <DialogDescription>
              Add review notes for this event. This does NOT constitute medical documentation.
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${getSeverityColor(selectedEvent.severity)}`}>
                <p className="font-medium">{selectedEvent.summary}</p>
                <p className="text-sm mt-1">{selectedEvent.details}</p>
              </div>
              <div>
                <label htmlFor="care-monitoring-review-notes" className="text-sm font-medium">Review Notes</label>
                <Textarea id="care-monitoring-review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this event review..."
                  className="mt-1"
                  data-testid="textarea-review-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedEvent && reviewEventMutation.mutate({ eventId: selectedEvent.id, notes: reviewNotes })}
              disabled={reviewEventMutation.isPending}
              data-testid="button-submit-review"
            >
              {reviewEventMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
