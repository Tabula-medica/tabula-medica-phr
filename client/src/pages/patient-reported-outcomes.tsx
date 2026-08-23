import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldCaption } from "@/components/ui/field-caption";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSubscription } from "@/hooks/use-subscription";
import {
  SoftUpgradePrompt,
  useSoftUpgradePrompt,
} from "@/components/soft-upgrade-prompt";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Send,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Phone,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

interface InstrumentItem {
  id: string;
  text: string;
  options: Array<{ label: string; value: number }>;
}

interface SeverityBand {
  min: number;
  max: number;
  severity: string;
  color: string;
}

interface Instrument {
  code: string;
  name: string;
  version: string;
  description: string;
  items: InstrumentItem[];
  scoringFn: string;
  severityBands: SeverityBand[];
}

interface ProResponseRow {
  id: string;
  accountId: string;
  instrumentCode: string;
  answers: Record<string, number>;
  score: number;
  severity: string;
  flagged: boolean;
  submittedAt: string;
}

interface ClinicianBanner {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}

function severityColor(instrument: Instrument | undefined, score: number): string {
  if (!instrument) return "#64748b";
  const band = instrument.severityBands.find((b) => score >= b.min && score <= b.max);
  return band?.color ?? "#64748b";
}

function FreeTeaser() {
  const upgrade = useSoftUpgradePrompt("pro_outcomes");
  return (
    <>
      <Card
        className="max-w-3xl mx-auto border-dashed border-2"
        data-testid="card-pro-free-teaser"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle data-testid="text-pro-teaser-title">
                Patient-Reported Outcomes
              </CardTitle>
              <CardDescription>
                Track validated questionnaires like PHQ-9 and GAD-7 over time.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="ml-auto">
              Pro
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>
                Submit standardized PHQ-9, GAD-7, and PROMIS-29 questionnaires.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>
                Auto-scored severity bands so you know what your score means.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>
                Trend visualization over time — share with your clinician.
              </span>
            </li>
          </ul>
          <Button
            className="w-full"
            onClick={() => upgrade.show("pro_outcomes")}
            data-testid="button-unlock-pro-outcomes"
          >
            Unlock with Pro
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
      <SoftUpgradePrompt
        open={upgrade.open}
        onOpenChange={upgrade.setOpen}
        trigger={upgrade.trigger}
        requiredTier="pro"
        currentTier="free"
      />
    </>
  );
}

function SubmitTab({
  instruments,
  onSubmitted,
}: {
  instruments: Instrument[];
  onSubmitted: (banner: ClinicianBanner | null) => void;
}) {
  const { toast } = useToast();
  const [selectedCode, setSelectedCode] = useState<string>(
    instruments[0]?.code ?? "",
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const instrument = instruments.find((i) => i.code === selectedCode);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pro/responses", {
        instrumentCode: selectedCode,
        answers,
      });
      return (await res.json()) as {
        response: ProResponseRow;
        clinicianBanner: ClinicianBanner | null;
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Response saved",
        description: `${selectedCode}: score ${data.response.score} (${data.response.severity})`,
      });
      setAnswers({});
      queryClient.invalidateQueries({ queryKey: ["/api/pro/responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/responses/by-instrument", selectedCode] });
      onSubmitted(data.clinicianBanner);
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save response",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const allAnswered = instrument
    ? instrument.items.every((it) => typeof answers[it.id] === "number")
    : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose a questionnaire</CardTitle>
          <CardDescription>
            All instruments are validated, clinician-grade tools. Your answers stay
            private to you and the providers you share with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedCode}
            onValueChange={(v) => {
              setSelectedCode(v);
              setAnswers({});
            }}
          >
            <SelectTrigger data-testid="select-instrument" className="w-full md:w-96">
              <SelectValue placeholder="Pick an instrument" />
            </SelectTrigger>
            <SelectContent>
              {instruments.map((i) => (
                <SelectItem
                  key={i.code}
                  value={i.code}
                  data-testid={`select-item-${i.code}`}
                >
                  {i.code} — {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {instrument && (
        <Card data-testid={`card-instrument-${instrument.code}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{instrument.name}</CardTitle>
              <Badge variant="outline">v{instrument.version}</Badge>
            </div>
            <CardDescription>{instrument.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {instrument.items.map((item, idx) => (
              <div key={item.id} className="space-y-2" data-testid={`question-${item.id}`}>
                <FieldCaption className="text-sm font-medium leading-snug">
                  {idx + 1}. {item.text}
                </FieldCaption>
                <RadioGroup
                  value={
                    typeof answers[item.id] === "number"
                      ? String(answers[item.id])
                      : undefined
                  }
                  onValueChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [item.id]: Number(v) }))
                  }
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  {item.options.map((opt) => (
                    <FieldCaption
                      key={opt.value}
                      className="flex items-center gap-2 rounded border px-3 py-2 cursor-pointer hover-elevate"
                    >
                      <RadioGroupItem
                        value={String(opt.value)}
                        data-testid={`radio-${item.id}-${opt.value}`}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </FieldCaption>
                  ))}
                </RadioGroup>
              </div>
            ))}

            <Button
              className="w-full"
              disabled={!allAnswered || submit.isPending}
              onClick={() => submit.mutate()}
              data-testid="button-submit-pro"
            >
              {submit.isPending ? (
                "Saving…"
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit & score
                </>
              )}
            </Button>
            {!allAnswered && (
              <p className="text-xs text-muted-foreground text-center">
                Answer every question to submit.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TrendTab({ instruments }: { instruments: Instrument[] }) {
  const [code, setCode] = useState<string>(instruments[0]?.code ?? "");
  const instrument = instruments.find((i) => i.code === code);

  const responsesQ = useQuery<{ responses: ProResponseRow[] }>({
    queryKey: ["/api/pro/responses/by-instrument", code],
    enabled: Boolean(code),
  });

  const chartData = useMemo(() => {
    const rows = responsesQ.data?.responses ?? [];
    return [...rows]
      .reverse()
      .map((r) => ({
        date: new Date(r.submittedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        score: r.score,
        severity: r.severity,
      }));
  }, [responsesQ.data]);

  const yMax = instrument
    ? instrument.severityBands[instrument.severityBands.length - 1]?.max ?? 30
    : 30;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pick an instrument to chart</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger data-testid="select-trend-instrument" className="w-full md:w-96">
              <SelectValue placeholder="Pick an instrument" />
            </SelectTrigger>
            <SelectContent>
              {instruments.map((i) => (
                <SelectItem key={i.code} value={i.code}>
                  {i.code} — {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card data-testid="card-trend-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {instrument?.name ?? code} — score over time
          </CardTitle>
          <CardDescription>
            Lower is better for symptom-burden screeners. Severity bands are shaded by
            the instrument's published cutoffs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {responsesQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div
              className="text-sm text-muted-foreground text-center py-12"
              data-testid="text-trend-empty"
            >
              No submissions yet. Submit a response on the previous tab to start a trend.
            </div>
          ) : (
            <div className="h-64 w-full" data-testid="chart-trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, yMax]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  {instrument?.severityBands.map((band) => (
                    <ReferenceLine
                      key={band.severity}
                      y={band.min}
                      stroke={band.color}
                      strokeDasharray="2 4"
                      strokeOpacity={0.5}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab({ instruments }: { instruments: Instrument[] }) {
  const responsesQ = useQuery<{ responses: ProResponseRow[] }>({
    queryKey: ["/api/pro/responses"],
  });
  const rows = responsesQ.data?.responses ?? [];

  if (responsesQ.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          You haven't submitted any responses yet. Head to the "Submit" tab to start.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent responses</CardTitle>
        <CardDescription>Your last 200 PRO submissions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const inst = instruments.find((i) => i.code === r.instrumentCode);
          const color = severityColor(inst, r.score);
          return (
            <div
              key={r.id}
              className="flex items-center justify-between border rounded p-3"
              data-testid={`row-response-${r.id}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <div className="font-medium text-sm">
                    {r.instrumentCode}
                    {r.flagged && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        flagged
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.submittedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">Score {r.score}</div>
                <div className="text-xs" style={{ color }}>
                  {r.severity}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProAuthenticated() {
  const { toast: _toast } = useToast();
  const [banner, setBanner] = useState<ClinicianBanner | null>(null);

  const instrumentsQ = useQuery<{ instruments: Instrument[] }>({
    queryKey: ["/api/pro/instruments"],
  });

  const instruments = instrumentsQ.data?.instruments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Patient-Reported Outcomes
          </h1>
          <p className="text-sm text-muted-foreground">
            Validated questionnaires that help you and your care team see how you're doing.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          Pro
        </Badge>
      </div>

      {banner && (
        <Alert variant="destructive" data-testid="alert-clinician-banner">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{banner.description}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={banner.ctaHref}>
                <Button size="sm" variant="secondary" data-testid="button-banner-cta">
                  {banner.ctaLabel}
                </Button>
              </Link>
              <a href="tel:988" className="inline-flex">
                <Button size="sm" variant="destructive" data-testid="button-call-988">
                  <Phone className="mr-2 h-4 w-4" />
                  Call 988
                </Button>
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {instrumentsQ.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : instruments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No instruments available yet. Check back shortly.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="submit" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="submit" data-testid="tab-submit">
              Submit
            </TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">
              Trends
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="submit" className="mt-6">
            <SubmitTab instruments={instruments} onSubmitted={setBanner} />
          </TabsContent>
          <TabsContent value="trends" className="mt-6">
            <TrendTab instruments={instruments} />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <HistoryTab instruments={instruments} />
          </TabsContent>
        </Tabs>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Validated PRO instruments for self-monitoring. Not a substitute for medical advice.
        If you're in crisis, call or text 988.
      </p>
    </div>
  );
}

export default function PatientReportedOutcomesPage() {
  const sub = useSubscription();
  const isPro = sub.tier === "pro" || sub.tier === "concierge" || sub.tier === "enterprise";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {sub.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isPro ? (
        <ProAuthenticated />
      ) : (
        <FreeTeaser />
      )}
    </div>
  );
}
