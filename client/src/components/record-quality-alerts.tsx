import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  RefreshCw,
  Shield,
  Database,
  Users,
  Pill,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AlertSeverity = "info" | "warning" | "error";
type AlertCategory = "identity" | "medication" | "allergy" | "demographics" | "duplicate" | "missing";

interface RecordQualityAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedSources: string[];
  detectedAt: string;
  suggestedAction: string;
  resolved: boolean;
}

interface RecordQualityReport {
  patientId: string;
  alerts: RecordQualityAlert[];
  overallScore: number;
  lastChecked: string;
  summary: {
    total: number;
    byCategory: Record<AlertCategory, number>;
    bySeverity: Record<AlertSeverity, number>;
  };
}

const severityConfig: Record<AlertSeverity, { icon: typeof Info; color: string; bg: string; label: string }> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Info" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", label: "Warning" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", label: "Action Needed" },
};

const categoryConfig: Record<AlertCategory, { icon: typeof Database; label: string }> = {
  identity: { icon: Users, label: "Identity" },
  medication: { icon: Pill, label: "Medications" },
  allergy: { icon: AlertTriangle, label: "Allergies" },
  demographics: { icon: Users, label: "Demographics" },
  duplicate: { icon: Database, label: "Duplicates" },
  missing: { icon: Database, label: "Missing Data" },
};

function AlertItem({ alert, onDismiss }: { alert: RecordQualityAlert; onDismiss: () => void }) {
  const config = severityConfig[alert.severity];
  const catConfig = categoryConfig[alert.category];
  const Icon = config.icon;

  if (alert.resolved) return null;

  return (
    <AccordionItem value={alert.id} className="border rounded-lg px-3 mb-2">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-3 w-full">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">{alert.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{catConfig.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(alert.detectedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <div className="space-y-3 pl-11">
          <p className="text-sm text-muted-foreground">{alert.description}</p>
          
          <div>
            <p className="text-xs font-medium mb-1">Affected Sources:</p>
            <div className="flex flex-wrap gap-1">
              {alert.affectedSources.map((source, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{source}</Badge>
              ))}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs font-medium mb-1">Suggested Action:</p>
            <p className="text-xs text-muted-foreground">{alert.suggestedAction}</p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onDismiss} data-testid={`button-dismiss-${alert.id}`}>
              Mark as Resolved
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function QualityScoreBadge({ score }: { score: number }) {
  let color = "text-green-500";
  let bg = "bg-green-100 dark:bg-green-900/30";
  let label = "Good";

  if (score < 70) {
    color = "text-red-500";
    bg = "bg-red-100 dark:bg-red-900/30";
    label = "Needs Attention";
  } else if (score < 90) {
    color = "text-yellow-500";
    bg = "bg-yellow-100 dark:bg-yellow-900/30";
    label = "Fair";
  }

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${bg}`}>
      <Shield className={`h-5 w-5 ${color}`} />
      <div>
        <p className={`text-lg font-bold ${color}`}>{score}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function RecordQualityDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<RecordQualityReport>({
    queryKey: ["/api/record-quality/alerts"],
    enabled: open,
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", "/api/record-quality/dismiss", { alertId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-quality/alerts"] });
      toast({
        title: "Alert Resolved",
        description: "The data quality alert has been marked as resolved.",
      });
    },
  });

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/record-quality/check", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-quality/alerts"] });
      toast({
        title: "Quality Check Complete",
        description: "Your records have been analyzed for data quality issues.",
      });
    },
  });

  const activeAlerts = data?.alerts.filter(a => !a.resolved) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-quality-alerts">
          <Database className="h-4 w-4" />
          Record Quality
          {activeAlerts.length > 0 && (
            <Badge variant="secondary" className="text-xs">{activeAlerts.length}</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Record Quality Alerts
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <QualityScoreBadge score={data.overallScore} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Data Quality Score</span>
                    <span className="text-xs font-medium">{data.overallScore}/100</span>
                  </div>
                  <Progress value={data.overallScore} className="h-2" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{activeAlerts.length} Active Alerts</p>
                  <span className="text-xs text-muted-foreground">
                    Last checked: {new Date(data.lastChecked).toLocaleTimeString()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => runCheckMutation.mutate()}
                  disabled={runCheckMutation.isPending}
                  data-testid="button-run-quality-check"
                >
                  <RefreshCw className={`h-3 w-3 ${runCheckMutation.isPending ? "animate-spin" : ""}`} />
                  Recheck
                </Button>
              </div>

              {data.summary.bySeverity.error > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {data.summary.bySeverity.error} issue{data.summary.bySeverity.error > 1 ? "s" : ""} need{data.summary.bySeverity.error === 1 ? "s" : ""} attention
                  </p>
                </div>
              )}

              <ScrollArea className="h-[350px]">
                <Accordion type="single" collapsible className="space-y-2">
                  {activeAlerts.map((alert) => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onDismiss={() => dismissMutation.mutate(alert.id)}
                    />
                  ))}
                </Accordion>

                {activeAlerts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                    <p className="font-medium">All Clear!</p>
                    <p className="text-sm text-muted-foreground">No data quality issues detected</p>
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> These are data quality alerts about record consistency, not health recommendations. 
                  Contact your healthcare providers to correct any discrepancies.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RecordQualityCard() {
  const { data } = useQuery<RecordQualityReport>({
    queryKey: ["/api/record-quality/alerts"],
  });

  const activeAlerts = data?.alerts.filter(a => !a.resolved) || [];
  const hasErrors = (data?.summary.bySeverity.error || 0) > 0;

  return (
    <Card data-testid="card-record-quality">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className={`h-5 w-5 ${hasErrors ? "text-red-500" : "text-primary"}`} />
          Record Quality
          {activeAlerts.length > 0 && (
            <Badge variant={hasErrors ? "destructive" : "secondary"} className="text-xs">
              {activeAlerts.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Data integrity checks across your health sources</CardDescription>
      </CardHeader>
      <CardContent>
        <RecordQualityDialog />
        <p className="text-xs text-muted-foreground mt-2">
          Flags discrepancies like different DOBs, missing allergies, or duplicate records
        </p>
      </CardContent>
    </Card>
  );
}
