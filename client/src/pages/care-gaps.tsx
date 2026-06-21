import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageGate } from "@/components/page-gate";

type CareGapStatus = "overdue" | "due_soon" | "up_to_date" | "not_applicable";

interface CareGapResult {
  code: string;
  title: string;
  grade: "A" | "B";
  status: CareGapStatus;
  intervalMonths: number;
  lastDate?: string;
  nextDueDate?: string;
  reasoning: string;
  excluded?: boolean;
  excludedReason?: string;
}

interface CareGapEvaluation {
  gaps: CareGapResult[];
  summary: {
    overdue: number;
    due_soon: number;
    up_to_date: number;
    not_applicable: number;
  };
  evaluatedAt: string;
  noCdsDisclaimer: string;
}

const splitCsv = (s: string): string[] =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

const STATUS_META: Record<
  CareGapStatus,
  { label: string; icon: typeof AlertCircle; classes: string; testId: string }
> = {
  overdue: {
    label: "Overdue",
    icon: AlertCircle,
    classes:
      "border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200",
    testId: "status-overdue",
  },
  due_soon: {
    label: "Due Soon",
    icon: Clock,
    classes:
      "border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200",
    testId: "status-due-soon",
  },
  up_to_date: {
    label: "Up To Date",
    icon: CheckCircle2,
    classes:
      "border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200",
    testId: "status-up-to-date",
  },
  not_applicable: {
    label: "Not Applicable",
    icon: Info,
    classes:
      "border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300",
    testId: "status-not-applicable",
  },
};

export default function CareGapsPage() {
  const [age, setAge] = useState("52");
  const [biologicalSex, setBiologicalSex] = useState<"female" | "male">("female");
  const [bmi, setBmi] = useState("");
  const [smokingStatus, setSmokingStatus] = useState<"never" | "current" | "former">("never");
  const [packYears, setPackYears] = useState("");
  const [yearsQuit, setYearsQuit] = useState("");
  const [cvdRiskFactorCount, setCvdRiskFactorCount] = useState("0");
  const [conditionsText, setConditionsText] = useState("");
  const [medicationsText, setMedicationsText] = useState("");

  const mutation = useMutation<CareGapEvaluation, Error, void>({
    mutationFn: async () => {
      const payload = {
        patient: {
          age: Number(age),
          biologicalSex,
          bmi: bmi ? Number(bmi) : undefined,
          smokingStatus,
          smokingPackYears: packYears ? Number(packYears) : undefined,
          yearsQuit: yearsQuit ? Number(yearsQuit) : undefined,
          cvdRiskFactorCount: cvdRiskFactorCount ? Number(cvdRiskFactorCount) : 0,
          conditions: splitCsv(conditionsText),
          medications: splitCsv(medicationsText),
        },
      };
      const res = await apiRequest("POST", "/api/chart-intelligence/care-gaps", payload);
      return (await res.json()) as CareGapEvaluation;
    },
  });

  const evaluation = mutation.data;
  const sortedGaps = evaluation
    ? [...evaluation.gaps].sort((a, b) => {
        const order: Record<CareGapStatus, number> = {
          overdue: 0,
          due_soon: 1,
          up_to_date: 2,
          not_applicable: 3,
        };
        return order[a.status] - order[b.status];
      })
    : [];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <PageGate feature="care_gaps" />
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Preventive Care Gaps
          </h1>
        </div>
        <p className="text-muted-foreground">
          Check whether you may be due for any USPSTF Grade A or B preventive
          screenings based on your age, biological sex, conditions, and
          medications. This tool is informational only.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>About You</CardTitle>
          <CardDescription>
            We use biological sex (anatomy) — not gender identity — to evaluate
            screenings such as mammography and cervical screening. Your input
            stays in this session and is not saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="input-age">Age</Label>
              <Input
                id="input-age"
                data-testid="input-age"
                type="number"
                min={0}
                max={130}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="select-sex">Biological sex</Label>
              <Select
                value={biologicalSex}
                onValueChange={(v) => setBiologicalSex(v as "female" | "male")}
              >
                <SelectTrigger id="select-sex" data-testid="select-biological-sex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="input-bmi">BMI (optional)</Label>
              <Input
                id="input-bmi"
                data-testid="input-bmi"
                type="number"
                step="0.1"
                min={10}
                max={70}
                placeholder="e.g. 27.5"
                value={bmi}
                onChange={(e) => setBmi(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="select-smoking">Smoking status</Label>
              <Select
                value={smokingStatus}
                onValueChange={(v) => setSmokingStatus(v as typeof smokingStatus)}
              >
                <SelectTrigger id="select-smoking" data-testid="select-smoking-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never smoker</SelectItem>
                  <SelectItem value="current">Current smoker</SelectItem>
                  <SelectItem value="former">Former smoker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="input-pack-years">Pack-years (if smoker)</Label>
              <Input
                id="input-pack-years"
                data-testid="input-pack-years"
                type="number"
                min={0}
                disabled={smokingStatus === "never"}
                placeholder="e.g. 25"
                value={packYears}
                onChange={(e) => setPackYears(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="input-years-quit">Years since quitting</Label>
              <Input
                id="input-years-quit"
                data-testid="input-years-quit"
                type="number"
                min={0}
                disabled={smokingStatus !== "former"}
                placeholder="e.g. 8"
                value={yearsQuit}
                onChange={(e) => setYearsQuit(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="input-cvd-risks">CVD risk factor count</Label>
              <Input
                id="input-cvd-risks"
                data-testid="input-cvd-risk-count"
                type="number"
                min={0}
                max={10}
                value={cvdRiskFactorCount}
                onChange={(e) => setCvdRiskFactorCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Count of: dyslipidemia, hypertension, diabetes, smoking, family
                history of early heart disease.
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="textarea-conditions">Existing conditions</Label>
              <Textarea
                id="textarea-conditions"
                data-testid="textarea-conditions"
                rows={3}
                placeholder="One per line — e.g. Type 2 Diabetes, Hypertension"
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Conditions you already have are excluded from screening
                recommendations (e.g. existing diabetes excludes diabetes
                screening).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="textarea-medications">Current medications</Label>
              <Textarea
                id="textarea-medications"
                data-testid="textarea-medications"
                rows={3}
                placeholder="One per line — e.g. atorvastatin, lisinopril"
                value={medicationsText}
                onChange={(e) => setMedicationsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Medications you already take are excluded from related
                assessments (e.g. an existing statin excludes the statin
                assessment).
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              data-testid="button-evaluate"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mutation.isPending ? "Evaluating…" : "Check my care gaps"}
            </Button>
          </div>

          {mutation.isError && (
            <div
              data-testid="text-error"
              className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-900 dark:text-red-200"
            >
              {mutation.error.message}
            </div>
          )}
        </CardContent>
      </Card>

      {evaluation && (
        <section className="space-y-4" data-testid="section-results">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Evaluated {new Date(evaluation.evaluatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryTile
                  label="Overdue"
                  count={evaluation.summary.overdue}
                  status="overdue"
                  testId="text-summary-overdue"
                />
                <SummaryTile
                  label="Due soon"
                  count={evaluation.summary.due_soon}
                  status="due_soon"
                  testId="text-summary-due-soon"
                />
                <SummaryTile
                  label="Up to date"
                  count={evaluation.summary.up_to_date}
                  status="up_to_date"
                  testId="text-summary-up-to-date"
                />
                <SummaryTile
                  label="Not applicable"
                  count={evaluation.summary.not_applicable}
                  status="not_applicable"
                  testId="text-summary-not-applicable"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {sortedGaps.map((gap) => (
              <GapCard key={gap.code} gap={gap} />
            ))}
          </div>
        </section>
      )}

      <ClinicalDisclaimer variant="card" />
    </div>
  );
}

function SummaryTile({
  label,
  count,
  status,
  testId,
}: {
  label: string;
  count: number;
  status: CareGapStatus;
  testId: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className={cn("rounded-md border p-3 flex flex-col gap-1", meta.classes)}>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold" data-testid={testId}>
        {count}
      </div>
    </div>
  );
}

function GapCard({ gap }: { gap: CareGapResult }) {
  const meta = STATUS_META[gap.status];
  const Icon = meta.icon;
  return (
    <Card data-testid={`card-gap-${gap.code}`}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-base font-semibold"
                data-testid={`text-title-${gap.code}`}
              >
                {gap.title}
              </h3>
              <Badge variant="outline" className="text-xs">
                USPSTF Grade {gap.grade}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{gap.code}</p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              meta.classes,
            )}
            data-testid={`${meta.testId}-${gap.code}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </div>
        </div>

        <p
          className="mt-3 text-sm text-muted-foreground"
          data-testid={`text-reasoning-${gap.code}`}
        >
          {gap.reasoning}
        </p>

        {(gap.lastDate || gap.nextDueDate) && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {gap.lastDate && (
              <span data-testid={`text-last-date-${gap.code}`}>
                <strong className="text-foreground">Last:</strong> {gap.lastDate}
              </span>
            )}
            {gap.nextDueDate && (
              <span data-testid={`text-next-due-${gap.code}`}>
                <strong className="text-foreground">Next due:</strong> {gap.nextDueDate}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
