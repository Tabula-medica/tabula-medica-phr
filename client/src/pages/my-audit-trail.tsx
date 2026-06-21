import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Download,
  Eye,
  Share2,
  Activity,
  Info,
  ArrowLeft,
  FileText,
} from "lucide-react";

interface PhiAccessEvent {
  id: string;
  source: "audit_log" | "export_request";
  timestamp: string;
  action: string;
  category: "access" | "disclosure" | "self_activity" | "system";
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
}

interface ListResponse {
  events: PhiAccessEvent[];
  count: number;
  range: { from?: string; to?: string; limit: number };
}

interface SummaryResponse {
  window: { from: string; to: string };
  counts: { totalEvents: number; disclosures: number; myActivity: number };
  lastEventAt: string | null;
}

const CATEGORY_BADGE: Record<PhiAccessEvent["category"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  access: { label: "Access", variant: "secondary" },
  disclosure: { label: "Disclosure", variant: "destructive" },
  self_activity: { label: "You", variant: "default" },
  system: { label: "System", variant: "outline" },
};

function downloadCsv(filename: string, events: PhiAccessEvent[]) {
  const headers = ["timestamp", "action", "category", "source", "targetType", "targetId", "ipAddress"];
  const rows = events.map((e) => [
    e.timestamp,
    e.action,
    e.category,
    e.source,
    e.targetType ?? "",
    e.targetId ?? "",
    e.ipAddress ?? "",
  ]);
  const meta = [
    ["# Tabula Medica — patient audit trail export"],
    [`# Generated: ${new Date().toISOString()}`],
    [`# Section: ${filename}`],
    [`# Rows: ${events.length}`],
    [`# Per HIPAA §164.528 / §164.316(b)(2)(i)`],
    [],
  ];
  const csv = [...meta, headers, ...rows]
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function EventTable({
  data,
  loading,
  emptyText,
}: {
  data: PhiAccessEvent[] | undefined;
  loading: boolean;
  emptyText: string;
}) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-events">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {data.map((e) => {
        const cfg = CATEGORY_BADGE[e.category];
        return (
          <div
            key={`${e.source}-${e.id}`}
            className="border rounded p-3 flex items-start justify-between gap-3"
            data-testid={`row-event-${e.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                <span className="font-mono text-sm break-all">{e.action}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(e.timestamp).toLocaleString()}
                {e.targetType && (
                  <>
                    {" · "}
                    <span className="font-mono">{e.targetType}</span>
                    {e.targetId && (
                      <>
                        {" "}
                        <span className="font-mono opacity-70">
                          {e.targetId.slice(0, 8)}…
                        </span>
                      </>
                    )}
                  </>
                )}
                {e.ipAddress && <> · {e.ipAddress}</>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MyAuditTrailPage() {
  const today = new Date();
  const aYearAgo = new Date();
  aYearAgo.setFullYear(today.getFullYear() - 1);

  const [from, setFrom] = useState<string>(aYearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today.toISOString().slice(0, 10));

  const range = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }
    params.set("limit", "500");
    return params.toString();
  }, [from, to]);

  const summaryQ = useQuery<SummaryResponse>({
    queryKey: ["/api/my-audit-trail/summary"],
  });

  const accessQ = useQuery<ListResponse>({
    queryKey: ["/api/my-audit-trail/access-log", range],
    queryFn: async () => {
      const res = await fetch(`/api/my-audit-trail/access-log?${range}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const disclosuresQ = useQuery<ListResponse>({
    queryKey: ["/api/my-audit-trail/disclosures", range],
    queryFn: async () => {
      const res = await fetch(`/api/my-audit-trail/disclosures?${range}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const myActivityQ = useQuery<ListResponse>({
    queryKey: ["/api/my-audit-trail/my-activity", range],
    queryFn: async () => {
      const res = await fetch(`/api/my-audit-trail/my-activity?${range}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const summary = summaryQ.data?.counts;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div>
        <Link href="/gdpr">
          <Button variant="ghost" size="sm" data-testid="link-back-gdpr">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to data rights
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            My audit trail
          </h1>
          <p className="text-sm text-muted-foreground">
            Every recorded event involving your personal health information.
            Per HIPAA §164.528 and §164.316(b)(2)(i), we retain this for at
            least 6 years and you can review or export it at any time.
          </p>
        </div>
        <Badge variant="secondary">Free for everyone</Badge>
      </div>

      <Alert data-testid="alert-disclaimer">
        <Info className="h-4 w-4" />
        <AlertTitle>About this view</AlertTitle>
        <AlertDescription>
          This page consolidates audit data from across the Tabula Medica
          platform. Events are bucketed by their action verb — disclosures
          (sharing/exporting your data), your own activity (logins, profile
          edits), and other access. We do not include the actual content of
          your records here, only the metadata about who/what/when.
        </AlertDescription>
      </Alert>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={<Eye className="h-5 w-5 text-primary" />}
          label="Total events (last 12 mo)"
          value={summaryQ.isLoading ? "—" : String(summary?.totalEvents ?? 0)}
          testId="kpi-total"
        />
        <KpiCard
          icon={<Share2 className="h-5 w-5 text-destructive" />}
          label="Disclosures (last 12 mo)"
          value={summaryQ.isLoading ? "—" : String(summary?.disclosures ?? 0)}
          testId="kpi-disclosures"
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-primary" />}
          label="Your own activity (last 12 mo)"
          value={summaryQ.isLoading ? "—" : String(summary?.myActivity ?? 0)}
          testId="kpi-my-activity"
        />
      </div>

      {/* Range picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date range</CardTitle>
          <CardDescription>
            Up to 6 years back. Older entries are archived to cold storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
              data-testid="input-from"
            />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
              data-testid="input-to"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="disclosures">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="disclosures" data-testid="tab-disclosures">
            <Share2 className="mr-2 h-4 w-4" /> Disclosures
          </TabsTrigger>
          <TabsTrigger value="all-access" data-testid="tab-all-access">
            <Eye className="mr-2 h-4 w-4" /> All access
          </TabsTrigger>
          <TabsTrigger value="my-activity" data-testid="tab-my-activity">
            <Activity className="mr-2 h-4 w-4" /> My activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disclosures">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Accounting of
                  disclosures
                </CardTitle>
                <CardDescription>
                  Every time your data was shared, exported, sent, or otherwise
                  disclosed. Required by HIPAA §164.528.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    "tabula-medica-disclosures",
                    disclosuresQ.data?.events ?? [],
                  )
                }
                disabled={!disclosuresQ.data?.events?.length}
                data-testid="button-export-disclosures"
              >
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <EventTable
                data={disclosuresQ.data?.events}
                loading={disclosuresQ.isLoading}
                emptyText="No disclosures recorded in this period. We have not shared, exported, or disclosed your data."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-access">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" /> Full PHI access log
                </CardTitle>
                <CardDescription>
                  Every recorded event involving your account, regardless of who
                  initiated it.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    "tabula-medica-access-log",
                    accessQ.data?.events ?? [],
                  )
                }
                disabled={!accessQ.data?.events?.length}
                data-testid="button-export-access"
              >
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <EventTable
                data={accessQ.data?.events}
                loading={accessQ.isLoading}
                emptyText="No events recorded in this period."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-activity">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> Your own
                  activity
                </CardTitle>
                <CardDescription>
                  Logins, profile edits, password changes, MFA events. Things you
                  did yourself.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    "tabula-medica-my-activity",
                    myActivityQ.data?.events ?? [],
                  )
                }
                disabled={!myActivityQ.data?.events?.length}
                data-testid="button-export-my-activity"
              >
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <EventTable
                data={myActivityQ.data?.events}
                loading={myActivityQ.isLoading}
                emptyText="No self-initiated activity recorded in this period."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">
        Data retention: 6+ years per §164.316(b)(2)(i). Patients cannot delete
        audit log entries — see our{" "}
        <Link href="/privacy-policy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <Card data-testid={`card-${testId}`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold" data-testid={`text-${testId}`}>
              {value}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
