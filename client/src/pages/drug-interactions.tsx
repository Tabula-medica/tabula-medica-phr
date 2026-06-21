import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Plus, X, Pill, AlertTriangle, ShieldAlert, Info, ExternalLink } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { SoftUpgradePrompt, useSoftUpgradePrompt } from "@/components/soft-upgrade-prompt";

type Severity = "contraindicated" | "major" | "moderate" | "minor" | "informational";

interface CheckResponse {
  checkedAt: string;
  drugs: Array<{
    query: string;
    brandName: string;
    genericName: string;
    manufacturer: string;
    boxedWarning: string | null;
  }>;
  unknown: string[];
  findings: Array<{
    pair: [string, string];
    severity: Severity;
    source: "openFDA";
    evidence: string[];
    recommendation: string;
  }>;
  disclaimer: string;
}

const SEVERITY_STYLES: Record<Severity, { label: string; color: string; icon: typeof AlertTriangle }> = {
  contraindicated: { label: "Contraindicated", color: "bg-red-600 text-white", icon: ShieldAlert },
  major: { label: "Major", color: "bg-red-500 text-white", icon: AlertTriangle },
  moderate: { label: "Moderate", color: "bg-amber-500 text-white", icon: AlertTriangle },
  minor: { label: "Minor", color: "bg-yellow-400 text-yellow-900", icon: Info },
  informational: { label: "No interaction found", color: "bg-emerald-500 text-white", icon: Info },
};

export default function DrugInteractions() {
  const [drugs, setDrugs] = useState<string[]>(["", ""]);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const { hasFeature, isLoading: subLoading } = useSubscription();
  const { open: upgradeOpen, setOpen: setUpgradeOpen, trigger: upgradeTrigger, show: showUpgrade } =
    useSoftUpgradePrompt("drug_interactions");

  const checkMutation = useMutation({
    mutationFn: async (drugList: string[]) => {
      const res = await apiRequest("POST", "/api/drug-label-lookup/check", { drugs: drugList });
      return (await res.json()) as CheckResponse;
    },
    onSuccess: (data) => setResult(data),
  });

  const guardedCheck = (drugList: string[]) => {
    if (!subLoading && !hasFeature("drug_interactions")) {
      showUpgrade("drug_interactions");
      return;
    }
    checkMutation.mutate(drugList);
  };

  const updateDrug = (i: number, value: string) => {
    const next = [...drugs];
    next[i] = value;
    setDrugs(next);
  };

  const addDrug = () => {
    if (drugs.length < 8) setDrugs([...drugs, ""]);
  };

  const removeDrug = (i: number) => {
    if (drugs.length > 2) setDrugs(drugs.filter((_, idx) => idx !== i));
  };

  const handleCheck = () => {
    const cleaned = drugs.map((d) => d.trim()).filter(Boolean);
    if (cleaned.length < 2) return;
    guardedCheck(cleaned);
  };

  const canCheck = drugs.filter((d) => d.trim()).length >= 2 && !checkMutation.isPending;

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Pill className="h-8 w-8 text-primary" />
          Drug Interaction Checker
        </h1>
        <p className="text-muted-foreground">
          Check whether any of your medications may interact. Powered by the FDA openFDA drug labeling database.
        </p>
      </header>

      <Card data-testid="card-drug-input">
        <CardHeader>
          <CardTitle>Your medications</CardTitle>
          <CardDescription>
            Enter brand or generic names. Add up to 8 medications and we will check every pair.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {drugs.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={d}
                onChange={(e) => updateDrug(i, e.target.value)}
                placeholder={i === 0 ? "e.g. Warfarin" : i === 1 ? "e.g. Ibuprofen" : "Another medication"}
                data-testid={`input-drug-${i}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCheck) handleCheck();
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeDrug(i)}
                disabled={drugs.length <= 2}
                data-testid={`button-remove-drug-${i}`}
                aria-label={`Remove medication ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              onClick={addDrug}
              disabled={drugs.length >= 8}
              data-testid="button-add-drug"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add another medication
            </Button>
            <Button
              onClick={handleCheck}
              disabled={!canCheck}
              data-testid="button-check-interactions"
              className="ml-auto"
            >
              {checkMutation.isPending ? "Checking..." : "Check interactions"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {checkMutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {checkMutation.isError && (
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not complete check</AlertTitle>
          <AlertDescription>
            We could not reach the FDA drug database right now. Please try again in a moment.
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-4">
          {result.unknown.length > 0 && (
            <Alert data-testid="alert-unknown-drugs">
              <Info className="h-4 w-4" />
              <AlertTitle>Some medications were not found</AlertTitle>
              <AlertDescription>
                We could not find FDA labeling for: <strong>{result.unknown.join(", ")}</strong>. Try a different
                spelling, the generic name, or the brand name.
              </AlertDescription>
            </Alert>
          )}

          {result.drugs.map(
            (d) =>
              d.boxedWarning && (
                <Alert key={d.query} variant="destructive" data-testid={`alert-boxed-warning-${d.query}`}>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Boxed warning: {d.brandName}</AlertTitle>
                  <AlertDescription className="text-sm">{d.boxedWarning.slice(0, 400)}</AlertDescription>
                </Alert>
              ),
          )}

          <h2 className="text-xl font-semibold pt-2" data-testid="text-results-heading">
            Results ({result.findings.length} pair{result.findings.length === 1 ? "" : "s"} checked)
          </h2>

          {result.findings.map((f, i) => {
            const style = SEVERITY_STYLES[f.severity];
            const Icon = style.icon;
            return (
              <Card key={i} data-testid={`card-finding-${i}`} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {f.pair[0]} <span className="text-muted-foreground">+</span> {f.pair[1]}
                      </CardTitle>
                    </div>
                    <Badge className={`${style.color} flex items-center gap-1`} data-testid={`badge-severity-${i}`}>
                      <Icon className="h-3 w-3" />
                      {style.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-sm font-medium" data-testid={`text-recommendation-${i}`}>
                    {f.recommendation}
                  </p>
                  {f.evidence.length > 0 && f.severity !== "informational" && (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        From the FDA label
                      </p>
                      {f.evidence.map((ev, k) => (
                        <p key={k} className="text-sm leading-relaxed" data-testid={`text-evidence-${i}-${k}`}>
                          {ev}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Alert data-testid="alert-disclaimer">
            <Info className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription className="text-xs">
              {result.disclaimer}{" "}
              <a
                href="https://open.fda.gov/apis/drug/label/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline"
                data-testid="link-openfda"
              >
                openFDA source <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        </div>
      )}
      <SoftUpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        trigger={upgradeTrigger}
      />
    </div>
  );
}
