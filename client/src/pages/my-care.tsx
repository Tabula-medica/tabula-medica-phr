import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pill,
  Activity,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

// ── Types ────────────────────────────────────────────────────────────────────

interface CareGapResult {
  code: string;
  title: string;
  grade: string;
  status: "overdue" | "due_soon" | "up_to_date" | "not_applicable";
  intervalMonths: number;
  lastDate?: string;
  nextDueDate?: string;
  reasoning: string;
  excluded?: boolean;
  excludedReason?: string;
}

interface CareSummary {
  profile: { name: string; age: number | null; gender: string | null; dateOfBirth: string | null } | null;
  careGaps: {
    gaps: CareGapResult[];
    summary: { overdue: number; due_soon: number; up_to_date: number; not_applicable: number };
    disclaimer: string;
  } | null;
  problems: { id: string; name: string; icdCode?: string; category: string; status: string }[];
  medications: { id: string; name: string; dosage: string; frequency: string; status: string }[];
  disclaimer: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    className: "text-destructive",
    badge: "destructive" as const,
  },
  due_soon: {
    label: "Due Soon",
    icon: Clock,
    className: "text-yellow-600",
    badge: "outline" as const,
  },
  up_to_date: {
    label: "Up to Date",
    icon: CheckCircle2,
    className: "text-green-600",
    badge: "secondary" as const,
  },
  not_applicable: {
    label: "N/A",
    icon: Info,
    className: "text-muted-foreground",
    badge: "outline" as const,
  },
} as const;

function GapCard({ gap }: { gap: CareGapResult }) {
  const cfg = STATUS_CONFIG[gap.status] ?? STATUS_CONFIG.not_applicable;
  const Icon = cfg.icon;
  return (
    <div
      className="flex items-start gap-3 rounded-lg border p-3"
      data-testid={`gap-card-${gap.code}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.className}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-medium text-sm">{gap.title}</span>
          <Badge variant={cfg.badge} className="text-xs">{cfg.label}</Badge>
          <Badge variant="outline" className="text-xs">USPSTF {gap.grade}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{gap.reasoning}</p>
        {gap.nextDueDate && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Next due: {new Date(gap.nextDueDate).toLocaleDateString()}
          </p>
        )}
        {gap.lastDate && (
          <p className="text-xs text-muted-foreground">
            Last: {new Date(gap.lastDate).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MyCarePage() {
  const { data, isLoading, error } = useQuery<CareSummary>({
    queryKey: ["/api/my/care-summary"],
    queryFn: () =>
      apiRequest("GET", "/api/my/care-summary").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const actionableGaps =
    data?.careGaps?.gaps.filter((g) => g.status === "overdue" || g.status === "due_soon") ?? [];
  const upToDate =
    data?.careGaps?.gaps.filter((g) => g.status === "up_to_date") ?? [];

  return (
    <div
      className="container mx-auto p-4 max-w-3xl space-y-6"
      data-testid="page-my-care"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/care">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Care
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">My Personalised Care</h1>
          {data?.profile && (
            <p className="text-sm text-muted-foreground">
              {data.profile.name}
              {data.profile.age ? `, age ${data.profile.age}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Could not load your care summary. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No profile */}
      {data && !data.profile && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground text-sm">{data.disclaimer}</p>
            <Link href="/provider-onboarding">
              <Button className="mt-4" size="sm">Set up your profile</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data?.profile && (
        <>
          {/* Summary chips */}
          {data.careGaps && (
            <div className="flex flex-wrap gap-2" data-testid="care-summary-chips">
              {data.careGaps.summary.overdue > 0 && (
                <Badge variant="destructive">
                  {data.careGaps.summary.overdue} overdue
                </Badge>
              )}
              {data.careGaps.summary.due_soon > 0 && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                  {data.careGaps.summary.due_soon} due soon
                </Badge>
              )}
              {data.careGaps.summary.up_to_date > 0 && (
                <Badge variant="secondary">
                  {data.careGaps.summary.up_to_date} up to date
                </Badge>
              )}
            </div>
          )}

          {/* Actionable screenings */}
          {actionableGaps.length > 0 && (
            <Card data-testid="card-actionable-gaps">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Screenings to discuss with your doctor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {actionableGaps.map((g) => (
                  <GapCard key={g.code} gap={g} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Up to date */}
          {upToDate.length > 0 && (
            <Card data-testid="card-up-to-date">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Up to date
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upToDate.map((g) => (
                  <GapCard key={g.code} gap={g} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* No care gap data (DOB missing) */}
          {!data.careGaps && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Add your date of birth to your profile to see personalised screening recommendations.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Conditions */}
          {data.problems.length > 0 && (
            <Card data-testid="card-conditions">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Active conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.problems.map((p) => (
                    <Badge key={p.id} variant="outline" className="text-xs">
                      {p.name}
                      {p.icdCode ? ` (${p.icdCode})` : ""}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medications */}
          {data.medications.length > 0 && (
            <Card data-testid="card-medications">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Active medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {data.medications.map((m) => (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span>{m.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {m.dosage} · {m.frequency}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center pb-4">
            {data.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
