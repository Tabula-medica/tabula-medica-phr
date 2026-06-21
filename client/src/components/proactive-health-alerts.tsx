import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Bell,
  AlertCircle,
  FlaskConical,
  Activity,
  Pill,
  Calendar,
  MessageCircleQuestion,
  ChevronRight,
  Check,
  X,
  Clock,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProactiveAlert {
  id: string;
  type: "lab_result" | "vital_change" | "symptom_report" | "medication_update" | "care_gap" | "follow_up";
  title: string;
  description: string;
  discussionPoints: string[];
  whereInRecord: {
    quote: string;
    source: string;
    date: string;
  };
  createdAt: string;
  isRead: boolean;
  isDismissed: boolean;
}

interface AlertsSummary {
  totalAlerts: number;
  unreadCount: number;
  alerts: ProactiveAlert[];
  lastUpdated: string;
}

const alertTypeIcons: Record<string, typeof FlaskConical> = {
  lab_result: FlaskConical,
  vital_change: Activity,
  symptom_report: AlertCircle,
  medication_update: Pill,
  care_gap: Calendar,
  follow_up: Stethoscope,
};

const alertTypeLabels: Record<string, string> = {
  lab_result: "Lab Result",
  vital_change: "Vital Sign",
  symptom_report: "Symptom",
  medication_update: "Medication",
  care_gap: "Care Record",
  follow_up: "Follow-up",
};

function AlertItem({ 
  alert, 
  onMarkRead, 
  onDismiss 
}: { 
  alert: ProactiveAlert; 
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = alertTypeIcons[alert.type] || Bell;
  const typeLabel = alertTypeLabels[alert.type] || "Alert";

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <div 
      className={`p-4 rounded-lg border ${!alert.isRead ? "bg-primary/5 border-primary/20" : ""}`}
      data-testid={`alert-${alert.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className={`font-medium ${!alert.isRead ? "text-foreground" : "text-muted-foreground"}`}>
              {alert.title}
            </h4>
            <Badge variant="outline" className="text-xs">
              {typeLabel}
            </Badge>
            {!alert.isRead && (
              <div className="h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
          
          {/* Where in Record - Provenance Section */}
          <div className="p-3 rounded-lg bg-muted/50 mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Where this appears in your record:</p>
            <p className="text-sm italic">"{alert.whereInRecord.quote}"</p>
            <p className="text-xs text-muted-foreground mt-1">
              Source: {alert.whereInRecord.source} ({alert.whereInRecord.date})
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Added {formatDate(alert.createdAt)}
            </span>
          </div>

          <Accordion type="single" collapsible value={expanded ? "questions" : ""} onValueChange={(v) => setExpanded(v === "questions")}>
            <AccordionItem value="questions" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium text-primary hover:no-underline" data-testid={`accordion-trigger-${alert.id}`}>
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="h-4 w-4" />
                  Questions to ask your clinician
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pl-1">
                  {alert.discussionPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" data-testid={`discussion-point-${i}`}>
                      <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 p-2 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground text-center">
                    Informational only. Not medical advice.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center gap-2 mt-2">
            {!alert.isRead && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onMarkRead(alert.id)}
                data-testid={`button-mark-read-${alert.id}`}
              >
                <Check className="h-4 w-4 mr-1" />
                Mark as read
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDismiss(alert.id)}
              data-testid={`button-dismiss-${alert.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProactiveAlertsCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: alertsSummary, isLoading, refetch } = useQuery<AlertsSummary>({
    queryKey: ["/api/health-alerts"],
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/health-alerts/${alertId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-alerts"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/health-alerts/${alertId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-alerts"] });
      toast({ title: "Alert dismissed" });
    },
  });

  // Preview query for the card
  const { data: previewData } = useQuery<AlertsSummary>({
    queryKey: ["/api/health-alerts"],
  });

  return (
    <Card data-testid="card-proactive-alerts">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" />
          Health Alerts
          {previewData && previewData.unreadCount > 0 && (
            <Badge variant="default" className="ml-auto">
              {previewData.unreadCount} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Items to discuss with your clinician</CardDescription>
      </CardHeader>
      <CardContent>
        {previewData && previewData.unreadCount > 0 && (
          <div className="mb-3 p-2 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {previewData.unreadCount} new item{previewData.unreadCount !== 1 ? "s" : ""} for discussion
            </p>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-view-alerts">
              <Bell className="h-4 w-4 mr-2" />
              View Health Alerts
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Health Alerts
              </DialogTitle>
              <DialogDescription>
                These are items from your health records that may be worth discussing with your healthcare provider. 
                They are not medical advice or diagnoses.
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : alertsSummary ? (
              <>
                <div className="flex items-center gap-4 py-2">
                  <Badge variant="outline">
                    {alertsSummary.totalAlerts} item{alertsSummary.totalAlerts !== 1 ? "s" : ""} for discussion
                  </Badge>
                  {alertsSummary.unreadCount > 0 && (
                    <Badge variant="secondary">
                      {alertsSummary.unreadCount} unread
                    </Badge>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-4">
                    {alertsSummary.alerts.length > 0 ? (
                      alertsSummary.alerts.map((alert) => (
                        <AlertItem
                          key={alert.id}
                          alert={alert}
                          onMarkRead={(id) => markReadMutation.mutate(id)}
                          onDismiss={(id) => dismissMutation.mutate(id)}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No active health alerts</p>
                        <p className="text-sm">New alerts will appear when there are items to discuss with your clinician.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <Separator />

                <div className="p-2 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground text-center">
                    Informational only. Not medical advice.
                  </p>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export function ProactiveAlertsBadge() {
  const { data } = useQuery<AlertsSummary>({
    queryKey: ["/api/health-alerts"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (!data || data.unreadCount === 0) return null;

  return (
    <Badge variant="destructive" className="ml-2" data-testid="badge-alert-count">
      {data.unreadCount}
    </Badge>
  );
}
