import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  FileStack,
  Layers,
  Loader2,
  Sparkles,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ChartFact,
  ChartFactCategory,
  ChartFactSet,
  CompleteChartSummary,
} from "@shared/complete-chart-summary";

const CATEGORY_GROUPS: { title: string; categories: ChartFactCategory[] }[] = [
  { title: "Active Problems & Diagnoses", categories: ["problem", "diagnosis"] },
  { title: "Medications", categories: ["medication"] },
  {
    title: "Recent Encounters & Notes",
    categories: ["note", "procedure", "imaging", "lab_result_record"],
  },
  { title: "Labs & Vitals", categories: ["lab_result", "vital"] },
  { title: "Allergies & Immunizations", categories: ["allergy", "immunization"] },
  {
    title: "Family History & Uploaded Documents",
    categories: ["family_history", "uploaded_document"],
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  ecw: "eClinicalWorks",
  fastenhealth: "Fasten Health",
  epic: "Epic",
  athena: "athenahealth",
  meditech: "MEDITECH",
  manual_entry: "Manual entry",
  unknown: "Unknown source",
};

function platformLabel(platform: string | undefined): string {
  if (!platform) return "Unknown source";
  return PLATFORM_LABELS[platform] ?? platform;
}

function factsByCategory(facts: readonly ChartFact[]): Map<ChartFactCategory, ChartFact[]> {
  const map = new Map<ChartFactCategory, ChartFact[]>();
  for (const f of facts) {
    const list = map.get(f.category) ?? [];
    list.push(f);
    map.set(f.category, list);
  }
  return map;
}

function FactRow({ fact }: { fact: ChartFact }) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm"
      data-testid={`fact-row-${fact.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="break-words">{fact.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {fact.date && <span data-testid={`fact-date-${fact.id}`}>{fact.date}</span>}
          <Badge variant="outline" className="text-xs py-0" data-testid={`fact-source-${fact.id}`}>
            <Database className="mr-1 h-3 w-3" />
            {platformLabel(fact.provenance.platform)}
          </Badge>
          {fact.provenance.facilityName && (
            <span className="truncate">{fact.provenance.facilityName}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AllFactsView({ factSet }: { factSet: ChartFactSet }) {
  const grouped = useMemo(() => factsByCategory(factSet.facts), [factSet.facts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(factSet.sourceCounts).map(([platform, count]) => (
          <Badge key={platform} variant="secondary" data-testid={`source-count-${platform}`}>
            {platformLabel(platform)}: {count}
          </Badge>
        ))}
      </div>
      {CATEGORY_GROUPS.map((group) => {
        const facts = group.categories.flatMap((c) => grouped.get(c) ?? []);
        if (facts.length === 0) return null;
        return (
          <Card key={group.title} data-testid={`facts-group-${group.title}`}>
            <CardHeader>
              <CardTitle className="text-base">{group.title}</CardTitle>
              <CardDescription>{facts.length} fact(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {facts.map((f) => (
                <FactRow key={f.id} fact={f} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function NarrativeView({ summary }: { summary: CompleteChartSummary }) {
  const factById = useMemo(
    () => new Map(summary.facts.map((f) => [f.id, f])),
    [summary.facts],
  );

  return (
    <div className="space-y-4">
      {summary.unverifiedNarrative && (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3"
          data-testid="banner-unverified-narrative"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            The AI organizer was unavailable or returned nothing groundable in the chart's own
            facts. What follows is the deterministic fact listing, not an AI narrative.
          </p>
        </div>
      )}

      {summary.discardedReferences.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-3"
          data-testid="banner-discarded-references"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-900 dark:text-red-200">
            The model cited {summary.discardedReferences.length} fact id(s) that were not in this
            patient's chart. They were discarded before display and never shown as findings.
          </p>
        </div>
      )}

      {summary.sections.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="text-no-sections">
          No section could be grounded in this patient's chart facts.
        </p>
      )}

      {summary.sections.map((section, i) => (
        <Card key={`${section.title}-${i}`} data-testid={`section-card-${i}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {summary.unverifiedNarrative ? (
                <Layers className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p
              className="text-sm whitespace-pre-line"
              data-testid={`section-narrative-${i}`}
            >
              {section.narrative}
            </p>
            <Accordion type="single" collapsible>
              <AccordionItem value="evidence">
                <AccordionTrigger
                  className="text-xs text-muted-foreground py-1"
                  data-testid={`section-evidence-toggle-${i}`}
                >
                  Evidence ({section.citedFactIds.length} fact
                  {section.citedFactIds.length === 1 ? "" : "s"})
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-1">
                  {section.citedFactIds.map((id) => {
                    const fact = factById.get(id);
                    if (!fact) return null;
                    return <FactRow key={id} fact={fact} />;
                  })}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CompleteChartSummaryPage() {
  const [unifiedPatientId, setUnifiedPatientId] = useState("");
  const [factSet, setFactSet] = useState<ChartFactSet | null>(null);
  const [summary, setSummary] = useState<CompleteChartSummary | null>(null);
  const [tab, setTab] = useState<"summary" | "facts">("facts");

  const factsMutation = useMutation<ChartFactSet, Error, string>({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "GET",
        `/api/complete-chart-summary/facts?unifiedPatientId=${encodeURIComponent(id)}`,
      );
      return (await res.json()) as ChartFactSet;
    },
    onSuccess: (data) => {
      setFactSet(data);
      setSummary(null);
      setTab("facts");
    },
  });

  const summaryMutation = useMutation<CompleteChartSummary, Error, string>({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/complete-chart-summary/generate", {
        unifiedPatientId: id,
      });
      return (await res.json()) as CompleteChartSummary;
    },
    onSuccess: (data) => {
      setSummary(data);
      setFactSet({
        unifiedPatientId: data.unifiedPatientId,
        facts: data.facts,
        sourceCounts: data.sourceCounts,
        generatedAt: data.generatedAt,
      });
      setTab("summary");
    },
  });

  const busy = factsMutation.isPending || summaryMutation.isPending;
  const activeError = summaryMutation.error ?? factsMutation.error;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <FileStack className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Complete Chart Summary
          </h1>
        </div>
        <p className="text-muted-foreground">
          Gathers every connected source for one person — eCW (or any connected EHR), Fasten
          Health-aggregated records, and this app's own PHR entries — and organizes it into a
          summary that only cites what is actually on file. Clinic staff only.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Patient</CardTitle>
          <CardDescription>
            Enter the unified patient id — the identity that spans every connected source for
            this person, not a single connection's own patient id.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="input-unified-patient-id">Unified patient id</Label>
            <Input
              id="input-unified-patient-id"
              data-testid="input-unified-patient-id"
              placeholder="e.g. 8f2c1e9a-..."
              value={unifiedPatientId}
              onChange={(e) => setUnifiedPatientId(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={busy || !unifiedPatientId.trim()}
              onClick={() => factsMutation.mutate(unifiedPatientId.trim())}
              data-testid="button-load-facts"
            >
              {factsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load facts only
            </Button>
            <Button
              disabled={busy || !unifiedPatientId.trim()}
              onClick={() => summaryMutation.mutate(unifiedPatientId.trim())}
              data-testid="button-generate-summary"
            >
              {summaryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate AI summary
            </Button>
          </div>

          {activeError && (
            <div
              data-testid="text-error"
              className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-900 dark:text-red-200"
            >
              {activeError.message}
            </div>
          )}
        </CardContent>
      </Card>

      {factSet && (
        <section className="space-y-4" data-testid="section-results">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {factSet.facts.length} fact(s) evaluated as of{" "}
              {new Date(factSet.generatedAt).toLocaleString()}
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "summary" | "facts")}>
            <TabsList>
              <TabsTrigger value="summary" disabled={!summary} data-testid="tab-summary">
                AI Summary
              </TabsTrigger>
              <TabsTrigger value="facts" data-testid="tab-facts">
                All Facts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="pt-4">
              {summary ? (
                <NarrativeView summary={summary} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate an AI summary to see it organized here.
                </p>
              )}
            </TabsContent>
            <TabsContent value="facts" className="pt-4">
              <AllFactsView factSet={factSet} />
            </TabsContent>
          </Tabs>

          {summary && (
            <div
              className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm text-amber-900 dark:text-amber-200"
              data-testid="text-summary-disclaimer"
            >
              {summary.disclaimer}
            </div>
          )}
        </section>
      )}

      <ClinicalDisclaimer variant="card" />
    </div>
  );
}
