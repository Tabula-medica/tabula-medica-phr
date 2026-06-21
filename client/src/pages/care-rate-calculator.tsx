import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/components/language-provider";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Loader2, Info, ExternalLink } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/intl-format";

interface EligibilityProgram {
  id: string;
  name: string;
  type: string;
  description: string;
  eligible: boolean;
  reason: string;
}

interface EligibilityResponse {
  eligible: boolean;
  programs: EligibilityProgram[];
  estimatedSubsidy: number;
  fplPercent: number;
  marketplace: Array<{
    id: string;
    name: string;
    metalLevel: string;
    monthlyPremium: number;
    estimatedPremiumAfterSubsidy: number;
    deductible: number;
    outOfPocketMax: number;
    features: string[];
  }>;
  csr: { eligible: boolean; tier: string; reducedDeductible: number; reducedOOP: number } | null;
  enrollmentUrl: string;
  disclaimer: string;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

function parseLocaleNumber(input: string, locale: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d.,\-\u0660-\u0669\u06F0-\u06F9]/g, "");
  if (!cleaned) return null;
  const western = cleaned
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const groupSep = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimalSep = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const normalized = western
    .split("")
    .map((c) => {
      if (c === groupSep) return "";
      if (c === decimalSep) return ".";
      return c;
    })
    .join("");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export default function CareRateCalculatorPage() {
  const { language } = useLanguage();
  const [incomeInput, setIncomeInput] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [zipCode, setZipCode] = useState("");
  const [age, setAge] = useState("35");
  const [state, setState] = useState("");
  const [submitted, setSubmitted] = useState<EligibilityResponse | null>(null);

  const parsedIncome = useMemo(
    () => parseLocaleNumber(incomeInput, language),
    [incomeInput, language],
  );

  const incomePreview = useMemo(() => {
    if (parsedIncome === null) return "";
    return formatCurrency(parsedIncome, language, "USD", { maximumFractionDigits: 0 });
  }, [parsedIncome, language]);

  const checkMutation = useMutation({
    mutationFn: async (): Promise<EligibilityResponse> => {
      const res = await apiRequest("POST", "/api/cms-marketplace/check-eligibility", {
        annualIncome: parsedIncome,
        householdSize: parseInt(householdSize, 10),
        zipCode,
        age: parseInt(age, 10),
        state,
      });
      return res.json();
    },
    onSuccess: (data) => setSubmitted(data),
  });

  const canSubmit =
    parsedIncome !== null &&
    parsedIncome > 0 &&
    /^\d{5}$/.test(zipCode) &&
    parseInt(householdSize, 10) >= 1;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <header className="mb-6 text-start">
        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight"
          data-testid="text-eligibility-title"
        >
          Coverage Eligibility Screener
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Find out which programs you may qualify for. This is an estimate
          based on the 2026 Federal Poverty Level — not an official decision.
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Tell us about your household</CardTitle>
          <CardDescription>
            We don't store this information. It's used only to estimate your
            eligibility right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="income">Annual household income (USD)</Label>
              <Input
                id="income"
                inputMode="decimal"
                placeholder="e.g. 32,000"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                data-testid="input-income"
              />
              {incomePreview && (
                <p className="text-xs text-muted-foreground" data-testid="text-income-preview">
                  Reading as {incomePreview}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="household-size">Household size</Label>
              <Input
                id="household-size"
                type="number"
                min={1}
                max={20}
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
                data-testid="input-household-size"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP code</Label>
              <Input
                id="zip"
                inputMode="numeric"
                maxLength={5}
                placeholder="5-digit ZIP"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ""))}
                data-testid="input-zip"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age of primary applicant</Label>
              <Input
                id="age"
                type="number"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                data-testid="input-age"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="state">State (optional)</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state" data-testid="select-state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full sm:w-auto"
            disabled={!canSubmit || checkMutation.isPending}
            onClick={() => checkMutation.mutate()}
            data-testid="button-check-eligibility"
          >
            {checkMutation.isPending ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              "Check eligibility"
            )}
          </Button>
        </CardContent>
      </Card>

      {submitted && (
        <Card className="mb-4" data-testid="card-results">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-teal-700" />
              Your estimate
            </CardTitle>
            <CardDescription>
              Income is at{" "}
              <span className="font-semibold" data-testid="text-fpl-percent">
                {formatNumber(submitted.fplPercent, language, { maximumFractionDigits: 0 })}%
              </span>{" "}
              of the Federal Poverty Level for a household of {householdSize}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {submitted.programs.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                  data-testid={`program-${p.id}`}
                >
                  {p.eligible ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 text-start">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant={p.eligible ? "default" : "secondary"}>
                        {p.eligible ? "Likely eligible" : "Not eligible"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.reason}</p>
                  </div>
                </div>
              ))}
            </div>

            {submitted.estimatedSubsidy > 0 && (
              <>
                <Separator />
                <div className="text-start" data-testid="text-subsidy">
                  <p className="text-sm text-muted-foreground">
                    Estimated monthly subsidy
                  </p>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(submitted.estimatedSubsidy, language, "USD", {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </>
            )}

            <Separator />
            <a
              href={submitted.enrollmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300 hover:underline"
              data-testid="link-healthcare-gov"
            >
              Continue at Healthcare.gov
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="text-xs text-muted-foreground">{submitted.disclaimer}</p>
          </CardContent>
        </Card>
      )}

      {checkMutation.isError && (
        <p className="text-sm text-destructive mb-4" data-testid="text-error">
          We couldn't check eligibility right now. Please try again.
        </p>
      )}

      <ClinicalDisclaimer variant="card" />
    </div>
  );
}
