import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  Activity,
  Pill,
  AlertTriangle,
  CalendarClock,
  Lock,
  ArrowRight,
  Info,
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SoftUpgradePrompt,
  useSoftUpgradePrompt,
} from "@/components/soft-upgrade-prompt";

interface SummaryItem {
  label: string;
  detail?: string;
  priority?: "low" | "medium" | "high";
}

interface SummarySection {
  title: string;
  items: SummaryItem[];
  emptyMessage: string;
}

interface PatientChartSummary {
  generatedAt: string;
  modelVersion: string;
  modelGenerated: boolean;
  disclaimer: string;
  headline: string;
  sections: {
    activeConditions: SummarySection;
    activeMedications: SummarySection;
    recentLabsOrAllergies: SummarySection;
    next90Days: SummarySection;
  };
}

interface SummaryResponse {
  success: boolean;
  cached: boolean;
  ageMs: number;
  summary: PatientChartSummary;
}

const REFRESH_LOCAL_KEY = "tm.ai-patient-summary.last-refresh";
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

function isWithinClientCooldown(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(REFRESH_LOCAL_KEY);
    if (!raw) return false;
    const last = Number(raw);
    if (!Number.isFinite(last)) return false;
    return Date.now() - last < REFRESH_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markClientRefresh() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REFRESH_LOCAL_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function AiPatientChartSummaryWidget() {
  const { hasFeature, isLoading: subLoading } = useSubscription();
  const isPro = hasFeature("ai_summaries");

  // Free-tier teaser variant
  if (!subLoading && !isPro) {
    return <FreeTierTeaser />;
  }

  if (subLoading) {
    return <WidgetSkeleton />;
  }

  return <ProSummary />;
}

function ProSummary() {
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<SummaryResponse>({
    queryKey: ["/api/ai-patient-chart-summary/me"],
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        "/api/ai-patient-chart-summary/regenerate",
        {},
      );
      return (await res.json()) as SummaryResponse;
    },
    onSuccess: (fresh) => {
      markClientRefresh();
      queryClient.setQueryData(["/api/ai-patient-chart-summary/me"], fresh);
      toast({
        title: "Summary refreshed",
        description: "We just regenerated your AI health summary.",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Could not refresh summary.";
      toast({
        title: "Couldn't refresh yet",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    if (isWithinClientCooldown()) {
      toast({
        title: "Just a moment",
        description:
          "You can refresh your AI summary again in a bit — we limit it to once per hour.",
      });
      return;
    }
    regenerate.mutate();
  };

  if (isLoading) return <WidgetSkeleton />;
  if (isError || !data) return <WidgetError onRetry={() => regenerate.mutate()} />;

  const summary = data.summary;
  const sections: SummarySection[] = [
    summary.sections.activeConditions,
    summary.sections.activeMedications,
    summary.sections.recentLabsOrAllergies,
    summary.sections.next90Days,
  ];

  return (
    <Card data-testid="ai-patient-chart-summary-widget" className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-950 p-2">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Your AI Health Summary
                <Badge variant="outline" className="text-xs font-normal">
                  Pro
                </Badge>
              </CardTitle>
              <p
                className="text-sm text-muted-foreground mt-1"
                data-testid="text-ai-summary-headline"
              >
                {summary.headline}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={regenerate.isPending}
            data-testid="button-refresh-ai-summary"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${regenerate.isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((section, idx) => (
            <SectionCard key={section.title} section={section} index={idx} />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
          <span data-testid="text-ai-summary-disclaimer" className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            {summary.disclaimer}
          </span>
          <span data-testid="text-ai-summary-generated-at">
            Generated {new Date(summary.generatedAt).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ section, index }: { section: SummarySection; index: number }) {
  const icons = [Activity, Pill, AlertTriangle, CalendarClock];
  const Icon = icons[index] ?? Activity;
  return (
    <div
      className="rounded-lg border bg-card p-3"
      data-testid={`ai-summary-section-${index}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-medium text-sm">{section.title}</h4>
      </div>
      {section.items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{section.emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5">
          {section.items.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="text-sm flex items-start gap-2"
              data-testid={`ai-summary-item-${index}-${i}`}
            >
              {item.priority === "high" && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{item.label}</div>
                {item.detail && (
                  <div className="text-xs text-muted-foreground truncate">{item.detail}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <Card data-testid="ai-summary-skeleton">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card data-testid="ai-summary-error">
      <CardContent className="py-6 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
        <p className="text-sm text-muted-foreground mb-3">
          We couldn't load your AI summary right now.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry-ai-summary">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function FreeTierTeaser() {
  const [open, setOpen] = useState(false);
  const { trigger } = useSoftUpgradePrompt("ai_summaries");

  return (
    <>
      <Card
        data-testid="ai-summary-teaser"
        className="border-dashed bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30"
      >
        <CardContent className="py-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="rounded-lg bg-white dark:bg-card p-2.5 shadow-sm">
              <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">AI Health Summary</h3>
                <Badge variant="secondary" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Pro
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Wake up to a plain-language summary of your active conditions,
                medications, allergies, and what to do in the next 90 days —
                regenerated for you every day.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  trigger();
                  setOpen(true);
                }}
                data-testid="button-upgrade-ai-summary"
              >
                Unlock with Pro
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <SoftUpgradePrompt
        trigger="ai_summaries"
        open={open}
        onOpenChange={setOpen}
        requiredTier="pro"
        currentTier="free"
      />
    </>
  );
}
