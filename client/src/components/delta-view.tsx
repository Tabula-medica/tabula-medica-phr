import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  FlaskConical,
  Pill,
  FileText,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Clock,
  TrendingUp,
  Bell,
  ChevronRight,
  RefreshCw,
  Heart,
  AlertCircle,
} from "lucide-react";

interface ChangeItem {
  id: string;
  type: "lab" | "medication" | "document" | "condition" | "allergy" | "appointment" | "message";
  title: string;
  description: string;
  source?: string;
  timestamp: string;
  isNew: boolean;
  isUpdated: boolean;
  priority: "high" | "medium" | "low";
}

interface DiscrepancyItem {
  id: string;
  type: "medication" | "lab" | "condition" | "allergy";
  title: string;
  description: string;
  sources: string[];
  detectedAt: string;
}

interface DeltaSummary {
  newLabs: number;
  newMedications: number;
  newDocuments: number;
  newConditions: number;
  newAllergies: number;
  newAppointments: number;
  newMessages: number;
  discrepanciesDetected: number;
  totalChanges: number;
}

interface DeltaViewResponse {
  patientId: string;
  lastVisit: string;
  currentVisit: string;
  daysSinceLastVisit: number;
  summary: DeltaSummary;
  recentChanges: ChangeItem[];
  discrepancies: DiscrepancyItem[];
  highlights: string[];
}

const changeTypeConfig: Record<ChangeItem["type"], { icon: typeof FlaskConical; color: string; label: string }> = {
  lab: { icon: FlaskConical, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", label: "Lab" },
  medication: { icon: Pill, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Medication" },
  document: { icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", label: "Document" },
  condition: { icon: Heart, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Condition" },
  allergy: { icon: AlertTriangle, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", label: "Allergy" },
  appointment: { icon: Calendar, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", label: "Appointment" },
  message: { icon: MessageSquare, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: "Message" },
};

const priorityConfig: Record<ChangeItem["priority"], { color: string; label: string }> = {
  high: { color: "bg-red-500", label: "High" },
  medium: { color: "bg-yellow-500", label: "Medium" },
  low: { color: "bg-green-500", label: "Low" },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? "s" : ""} ago`;
}

function SummaryBadge({ 
  count, 
  label, 
  icon: Icon, 
  variant 
}: { 
  count: number; 
  label: string; 
  icon: typeof FlaskConical; 
  variant: "default" | "warning" 
}) {
  if (count === 0) return null;

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
        variant === "warning" 
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" 
          : "bg-primary/10 text-primary"
      }`}
      data-testid={`delta-badge-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon className="h-4 w-4" />
      <span className="font-semibold">{count}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ChangeCard({ change }: { change: ChangeItem }) {
  const config = changeTypeConfig[change.type];
  const Icon = config.icon;

  return (
    <div 
      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
      data-testid={`change-item-${change.id}`}
    >
      <div className={`p-2 rounded-md ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{change.title}</span>
          {change.isNew && (
            <Badge variant="default" className="text-xs">New</Badge>
          )}
          {change.isUpdated && (
            <Badge variant="secondary" className="text-xs">Updated</Badge>
          )}
          {change.priority === "high" && (
            <Badge variant="destructive" className="text-xs">Important</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{change.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {change.source && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {change.source}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(change.timestamp)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

function DiscrepancyCard({ discrepancy }: { discrepancy: DiscrepancyItem }) {
  return (
    <div 
      className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
      data-testid={`discrepancy-${discrepancy.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-800/50">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-800 dark:text-amber-200">{discrepancy.title}</h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{discrepancy.description}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {discrepancy.sources.map((source, idx) => (
              <Badge key={idx} variant="outline" className="text-xs border-amber-300 dark:border-amber-700">
                {source}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeltaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DeltaView() {
  const { data, isLoading, refetch, isFetching } = useQuery<DeltaViewResponse>({
    queryKey: ["/api/delta-view"],
  });

  if (isLoading) {
    return (
      <Card data-testid="delta-view-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What Changed Since Last Time?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.summary.totalChanges === 0) {
    return (
      <Card data-testid="delta-view-empty">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>What Changed Since Last Time?</CardTitle>
              <CardDescription>You're all caught up!</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No new updates since your last visit.</p>
            <p className="text-sm mt-1">Check back later for new health information.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full" data-testid="delta-view-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              What Changed Since Last Time?
              {data.summary.totalChanges > 0 && (
                <Badge variant="default" className="ml-2">
                  {data.summary.totalChanges} update{data.summary.totalChanges !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {data.daysSinceLastVisit === 0 
                ? "Changes since earlier today" 
                : data.daysSinceLastVisit === 1 
                  ? "Changes since yesterday"
                  : `Changes from the past ${data.daysSinceLastVisit} days`}
            </CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh changes"
          data-testid="button-refresh-delta"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3" data-testid="delta-summary">
          <SummaryBadge count={data.summary.newLabs} label="new labs" icon={FlaskConical} variant="default" />
          <SummaryBadge count={data.summary.newMedications} label="medication update" icon={Pill} variant="default" />
          <SummaryBadge count={data.summary.newDocuments} label="documents added" icon={FileText} variant="default" />
          <SummaryBadge count={data.summary.discrepanciesDetected} label="discrepancy detected" icon={AlertTriangle} variant="warning" />
          <SummaryBadge count={data.summary.newAppointments} label="appointment" icon={Calendar} variant="default" />
          <SummaryBadge count={data.summary.newMessages} label="new message" icon={MessageSquare} variant="default" />
        </div>

        {data.discrepancies.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Discrepancies Requiring Attention
            </h3>
            {data.discrepancies.map((discrepancy) => (
              <DiscrepancyCard key={discrepancy.id} discrepancy={discrepancy} />
            ))}
          </div>
        )}

        <Accordion type="single" collapsible defaultValue="recent-changes">
          <AccordionItem value="recent-changes" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent Changes ({data.recentChanges.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {data.recentChanges.map((change) => (
                    <ChangeCard key={change.id} change={change} />
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Last visit: {new Date(data.lastVisit).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
