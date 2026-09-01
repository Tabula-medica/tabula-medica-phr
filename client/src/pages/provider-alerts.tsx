import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getStatusColor } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User,
  TrendingUp,
  TrendingDown,
  Activity,
  ClipboardList,
  Pill,
  FileText,
  Sparkles,
  Eye,
  Check,
  X
} from "lucide-react";
import { PageHeader, StatCardGrid, type StatCardItem } from "@/components/shared";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface AlertDetails {
  sourceType?: string;
  sourceId?: string;
  currentValue?: number;
  previousValue?: number;
  trendDirection?: string;
  percentageChange?: number;
  relatedData?: Record<string, any>;
}

interface ProviderAlert {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  details?: AlertDetails;
  recommendedActions?: string[];
  aiAnalysis?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

const alertTypeIcons: Record<string, any> = {
  prom_threshold: ClipboardList,
  prom_trend_change: TrendingUp,
  vital_sign: Activity,
  lab_result: FileText,
  medication_adherence: Pill,
  appointment_missed: Clock,
};

export default function ProviderAlertsPage() {
  const { toast } = useToast();
  const [selectedAlert, setSelectedAlert] = useState<ProviderAlert | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: alerts = [], isLoading } = useQuery<ProviderAlert[]>({
    queryKey: ["/api/provider/alerts"],
  });

  const { data: unacknowledgedAlerts = [] } = useQuery<ProviderAlert[]>({
    queryKey: ["/api/provider/alerts/unacknowledged"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/provider/alerts/${alertId}/acknowledge`, { acknowledgedBy: "dr-chen-1" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/alerts/unacknowledged"] });
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been marked as acknowledged.",
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/provider/alerts/${alertId}/resolve`, { resolvedBy: "dr-chen-1", notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/alerts/unacknowledged"] });
      setResolveDialogOpen(false);
      setSelectedAlert(null);
      setResolutionNotes("");
      toast({
        title: "Alert Resolved",
        description: "The alert has been resolved and closed.",
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/provider/alerts/${alertId}`, { status: "dismissed" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/alerts/unacknowledged"] });
      toast({
        title: "Alert Dismissed",
        description: "The alert has been dismissed.",
      });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-black";
      case "low": return "bg-blue-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };


  const getAlertTypeIcon = (alertType: string) => {
    const Icon = alertTypeIcons[alertType] || Bell;
    return <Icon className="h-4 w-4" />;
  };

  const newAlerts = alerts.filter(a => a.status === "new");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged" || a.status === "in_review");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved" || a.status === "dismissed");

  const renderAlertCard = (alert: ProviderAlert, showActions: boolean = true) => (
    <Card
      key={alert.id}
      className={`cursor-pointer hover-elevate ${alert.status === "new" ? "border-red-500/50" : ""}`}
      onClick={() => setSelectedAlert(alert)}
      data-testid={`card-alert-${alert.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
              {getAlertTypeIcon(alert.alertType)}
            </div>
            <div>
              <CardTitle className="text-base">{alert.title}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{alert.patientName}</span>
                <span className="mx-1">•</span>
                <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getSeverityColor(alert.severity)}>
              {alert.severity}
            </Badge>
            <Badge className={getStatusColor(alert.status)}>
              {alert.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">{alert.description}</p>
        
        {showActions && alert.status === "new" && (
          <div role="presentation" className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => acknowledgeMutation.mutate(alert.id)}
              disabled={acknowledgeMutation.isPending}
              data-testid={`button-acknowledge-${alert.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dismissMutation.mutate(alert.id)}
              disabled={dismissMutation.isPending}
              data-testid={`button-dismiss-${alert.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ScrollArea className="h-full">
      <div className="container py-6 space-y-6">
        <PageHeader
          title="Provider Alerts"
          subtitle="AI-powered anomaly detection and patient monitoring alerts"
          actions={
            unacknowledgedAlerts.length > 0 ? (
              <Badge variant="destructive" className="text-lg px-4 py-2">
                <Bell className="h-4 w-4 mr-2" />
                {unacknowledgedAlerts.length} New
              </Badge>
            ) : undefined
          }
        />

        <StatCardGrid
          columns={4}
          stats={[
            { label: "New Alerts", value: newAlerts.length, icon: AlertTriangle, color: "text-red-500", testId: "stat-new-alerts" },
            { label: "In Review", value: acknowledgedAlerts.length, icon: Clock, color: "text-blue-500", testId: "stat-in-review" },
            { label: "Resolved", value: resolvedAlerts.length, icon: CheckCircle2, color: "text-green-500", testId: "stat-resolved" },
            { label: "Total", value: alerts.length, icon: Bell, color: "text-muted-foreground", testId: "stat-total" },
          ] satisfies StatCardItem[]}
        />

        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new" data-testid="tab-new">
              New {newAlerts.length > 0 && <Badge className="ml-2" variant="destructive">{newAlerts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="in-review" data-testid="tab-in-review">In Review</TabsTrigger>
            <TabsTrigger value="resolved" data-testid="tab-resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {newAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No new alerts</p>
                  <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
                </CardContent>
              </Card>
            ) : (
              newAlerts.map(alert => renderAlertCard(alert))
            )}
          </TabsContent>

          <TabsContent value="in-review" className="space-y-4">
            {acknowledgedAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No alerts in review</p>
                </CardContent>
              </Card>
            ) : (
              acknowledgedAlerts.map(alert => renderAlertCard(alert, false))
            )}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-4">
            {resolvedAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No resolved alerts</p>
                </CardContent>
              </Card>
            ) : (
              resolvedAlerts.map(alert => renderAlertCard(alert, false))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No alerts</p>
                </CardContent>
              </Card>
            ) : (
              alerts.map(alert => renderAlertCard(alert, alert.status === "new"))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedAlert && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${getSeverityColor(selectedAlert.severity)}`}>
                      {getAlertTypeIcon(selectedAlert.alertType)}
                    </div>
                    <div>
                      <DialogTitle>{selectedAlert.title}</DialogTitle>
                      <DialogDescription>
                        {selectedAlert.patientName} • {format(new Date(selectedAlert.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Badge className={getSeverityColor(selectedAlert.severity)}>
                      {selectedAlert.severity}
                    </Badge>
                    <Badge className={getStatusColor(selectedAlert.status)}>
                      {selectedAlert.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {selectedAlert.alertType.replace("_", " ")}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedAlert.description}</p>
                  </div>

                  {selectedAlert.details && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {selectedAlert.details.currentValue !== undefined && (
                          <>
                            <span className="text-muted-foreground">Current Value:</span>
                            <span className="font-medium">{selectedAlert.details.currentValue}%</span>
                          </>
                        )}
                        {selectedAlert.details.previousValue !== undefined && (
                          <>
                            <span className="text-muted-foreground">Previous Value:</span>
                            <span className="font-medium">{selectedAlert.details.previousValue}%</span>
                          </>
                        )}
                        {selectedAlert.details.percentageChange !== undefined && (
                          <>
                            <span className="text-muted-foreground">Change:</span>
                            <span className={`font-medium flex items-center gap-1 ${
                              selectedAlert.details.trendDirection === "up" ? "text-red-500" : "text-green-500"
                            }`}>
                              {selectedAlert.details.trendDirection === "up" ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {selectedAlert.details.percentageChange.toFixed(0)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedAlert.aiAnalysis && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Analysis
                      </h4>
                      <p className="text-sm text-muted-foreground">{selectedAlert.aiAnalysis}</p>
                    </div>
                  )}

                  {selectedAlert.recommendedActions && selectedAlert.recommendedActions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Recommended Actions</h4>
                      <ul className="space-y-2">
                        {selectedAlert.recommendedActions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedAlert.resolutionNotes && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <h4 className="font-medium mb-2 text-green-800 dark:text-green-400">Resolution Notes</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">{selectedAlert.resolutionNotes}</p>
                      {selectedAlert.resolvedAt && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          Resolved {format(new Date(selectedAlert.resolvedAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {(selectedAlert.status === "new" || selectedAlert.status === "acknowledged") && (
                  <DialogFooter className="gap-2">
                    {selectedAlert.status === "new" && (
                      <Button
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(selectedAlert.id)}
                        disabled={acknowledgeMutation.isPending}
                        data-testid="button-dialog-acknowledge"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      onClick={() => setResolveDialogOpen(true)}
                      data-testid="button-dialog-resolve"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Resolve Alert
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Alert</DialogTitle>
              <DialogDescription>
                Add notes about how this alert was addressed.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Enter resolution notes..."
              rows={4}
              data-testid="textarea-resolution-notes"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setResolveDialogOpen(false)}
                data-testid="button-cancel-resolve"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedAlert) {
                    resolveMutation.mutate({ alertId: selectedAlert.id, notes: resolutionNotes });
                  }
                }}
                disabled={resolveMutation.isPending}
                data-testid="button-confirm-resolve"
              >
                {resolveMutation.isPending ? "Resolving..." : "Resolve Alert"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
