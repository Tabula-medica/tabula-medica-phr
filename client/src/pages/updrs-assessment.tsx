import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Brain,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Minus,
  PersonStanding,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface UPDRSItemDefinition {
  id: string;
  number: string;
  label: string;
  side?: "right" | "left";
  maxScore: number;
  anchors: string[];
}

interface HoehnYahrStageInfo {
  stage: number;
  description: string;
}

interface UPDRSScaleDefinition {
  partI: UPDRSItemDefinition[];
  partII: UPDRSItemDefinition[];
  partIII: UPDRSItemDefinition[];
  partIV: UPDRSItemDefinition[];
  hoehnYahrStages: HoehnYahrStageInfo[];
  disclaimer: string;
}

type UPDRSScores = Record<string, number>;

interface UPDRSAssessment {
  id: string;
  scores: UPDRSScores;
  hoehnYahrStage: number;
  partITotal: number;
  partIITotal: number;
  partIIITotal: number;
  partIVTotal: number;
  motorTotal: number;
  grandTotal: number;
  previousGrandTotal?: number;
  changeFromPrevious?: number;
  trend?: "improved" | "worsened" | "stable" | "baseline";
  notes?: string;
  assessedAt: string;
  disclaimer: string;
}

const PART_META: Record<"partI" | "partII" | "partIII" | "partIV", { title: string; description: string; icon: JSX.Element }> = {
  partI: { title: "Part I — Mentation, Behavior & Mood", description: "Cognition, thought content, depression, and motivation", icon: <Brain className="h-4 w-4" /> },
  partII: { title: "Part II — Activities of Daily Living", description: "Self-reported function in daily tasks", icon: <PersonStanding className="h-4 w-4" /> },
  partIII: { title: "Part III — Motor Examination", description: "Clinician-observed motor exam findings", icon: <Stethoscope className="h-4 w-4" /> },
  partIV: { title: "Part IV — Complications of Therapy", description: "Dyskinesias, motor fluctuations, and other complications over the past week", icon: <Activity className="h-4 w-4" /> },
};

const TREND_META: Record<NonNullable<UPDRSAssessment["trend"]>, { label: string; icon: JSX.Element; className: string }> = {
  baseline: { label: "Baseline assessment", icon: <Minus className="h-4 w-4" />, className: "text-muted-foreground" },
  improved: { label: "Improved since last assessment", icon: <TrendingDown className="h-4 w-4" />, className: "text-green-600 dark:text-green-400" },
  worsened: { label: "Worsened since last assessment", icon: <TrendingUp className="h-4 w-4" />, className: "text-red-600 dark:text-red-400" },
  stable: { label: "Unchanged since last assessment", icon: <Minus className="h-4 w-4" />, className: "text-muted-foreground" },
};

export default function UPDRSAssessmentPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("assessment");
  const [scores, setScores] = useState<UPDRSScores>({});
  const [hoehnYahrStage, setHoehnYahrStage] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<UPDRSAssessment | null>(null);

  const scaleQuery = useQuery<UPDRSScaleDefinition>({
    queryKey: ["/api/updrs/scale-definition"],
  });

  const historyQuery = useQuery<UPDRSAssessment[]>({
    queryKey: ["/api/updrs/history"],
  });

  const assessMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/updrs/assess", { scores, hoehnYahrStage, notes: notes || undefined }),
    onSuccess: async (response) => {
      const data = await response.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/updrs/history"] });
      setActiveTab("results");
      toast({ title: "UPDRS assessment saved" });
    },
    onError: (err: any) => {
      toast({ title: "Assessment failed", description: err.message, variant: "destructive" });
    },
  });

  const scale = scaleQuery.data;
  const allItems = scale ? [...scale.partI, ...scale.partII, ...scale.partIII, ...scale.partIV] : [];
  const scoredCount = allItems.filter(i => scores[i.id] !== undefined).length;
  const canSubmit = scale !== undefined && hoehnYahrStage !== undefined && scoredCount === allItems.length && allItems.length > 0;

  const setItemScore = (id: string, value: number) => {
    setScores(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6" data-testid="updrs-assessment-page">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800" data-testid="disclaimer-alert">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-300">Clinical Tool — Requires Trained Administration</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
          {scale?.disclaimer ?? "This UPDRS tool is for educational tracking purposes only and does not constitute medical advice."}
        </AlertDescription>
      </Alert>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
          <Stethoscope className="h-7 w-7 text-indigo-500" />
          UPDRS Assessment
        </h1>
        <p className="text-muted-foreground text-sm">Unified Parkinson&apos;s Disease Rating Scale &amp; Hoehn and Yahr Staging</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
          <TabsTrigger value="assessment" data-testid="tab-assessment">Assessment</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="space-y-4" data-testid="assessment-tab-content">
          {scaleQuery.isLoading || !scale ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <>
              <Alert className="border-muted" data-testid="rater-consistency-note">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  UPDRS scores vary between raters, especially for bradykinesia and tremor items. For meaningful trends, have the same trained rater score each visit at a consistent time relative to medication doses.{" "}
                  <a
                    href="https://doi.org/10.1016/j.prdoa.2024.100278"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Kenny et al., 2024
                  </a>
                </AlertDescription>
              </Alert>

              <Card data-testid="card-hoehn-yahr">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hoehn and Yahr Stage</CardTitle>
                  <CardDescription>Overall disease stage based on bilateral involvement and postural stability</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={hoehnYahrStage?.toString() ?? ""} onValueChange={v => setHoehnYahrStage(parseFloat(v))}>
                    <SelectTrigger id="updrs-hoehn-yahr-stage" data-testid="select-hoehn-yahr"><SelectValue placeholder="Select stage" /></SelectTrigger>
                    <SelectContent>
                      {scale.hoehnYahrStages.map(s => (
                        <SelectItem key={s.stage} value={s.stage.toString()}>Stage {s.stage} — {s.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Accordion type="multiple" defaultValue={["partI"]} className="space-y-2">
                {(["partI", "partII", "partIII", "partIV"] as const).map(partKey => {
                  const meta = PART_META[partKey];
                  const items = scale[partKey];
                  const partScored = items.filter(i => scores[i.id] !== undefined).length;
                  return (
                    <AccordionItem key={partKey} value={partKey} className="border rounded-lg px-4" data-testid={`accordion-${partKey}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          {meta.icon}
                          <div>
                            <p className="font-semibold text-sm">{meta.title}</p>
                            <p className="text-xs text-muted-foreground font-normal">{meta.description}</p>
                          </div>
                        </div>
                        <Badge variant={partScored === items.length ? "secondary" : "outline"} className="ml-auto mr-2 shrink-0">
                          {partScored}/{items.length}
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        {items.map(itemDef => (
                          <div key={itemDef.id} className="space-y-1" data-testid={`item-${itemDef.id}`}>
                            <Label htmlFor={`updrs-item-${itemDef.id}`}>Item {itemDef.number}: {itemDef.label}</Label>
                            <Select value={scores[itemDef.id]?.toString() ?? ""} onValueChange={v => setItemScore(itemDef.id, parseInt(v))}>
                              <SelectTrigger id={`updrs-item-${itemDef.id}`} data-testid={`select-item-${itemDef.id}`}>
                                <SelectValue placeholder="Score" />
                              </SelectTrigger>
                              <SelectContent>
                                {itemDef.anchors.map((anchor, score) => (
                                  <SelectItem key={score} value={score.toString()}>{score} — {anchor}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <Card data-testid="card-notes">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Notes (optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Medication timing relative to exam, patient-reported context, etc."
                    data-testid="textarea-notes"
                  />
                </CardContent>
              </Card>

              <Button
                onClick={() => assessMutation.mutate()}
                disabled={!canSubmit || assessMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-save-assessment"
              >
                {assessMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <>Save Assessment ({scoredCount}/{allItems.length} items scored{hoehnYahrStage === undefined ? ", stage not set" : ""})</>
                )}
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4" data-testid="results-tab-content">
          {result ? <ResultDisplay result={result} scale={scale} /> : (
            <Card className="text-center py-12" data-testid="card-no-result">
              <CardContent>
                <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Complete and save an assessment to see results here.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4" data-testid="history-tab-content">
          <HistoryPanel history={historyQuery.data || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultDisplay({ result, scale }: { result: UPDRSAssessment; scale?: UPDRSScaleDefinition }) {
  const hyDescription = scale?.hoehnYahrStages.find(s => s.stage === result.hoehnYahrStage)?.description;
  const trend = result.trend ? TREND_META[result.trend] : undefined;

  return (
    <div className="space-y-4">
      <Card data-testid="card-total-score">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">UPDRS Total Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-5xl font-bold" data-testid="text-grand-total">{result.grandTotal}</span>
            <span className="text-muted-foreground mb-1">/ 199</span>
          </div>
          {trend && (
            <div className={`flex items-center gap-2 text-sm ${trend.className}`} data-testid="text-trend">
              {trend.icon}
              <span>{trend.label}{result.changeFromPrevious !== undefined ? ` (${result.changeFromPrevious > 0 ? "+" : ""}${result.changeFromPrevious})` : ""}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-part-i-total">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Part I</p>
            <p className="text-2xl font-bold">{result.partITotal}</p>
            <p className="text-xs text-muted-foreground">Mentation/Mood</p>
          </CardContent>
        </Card>
        <Card data-testid="card-part-ii-total">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Part II</p>
            <p className="text-2xl font-bold">{result.partIITotal}</p>
            <p className="text-xs text-muted-foreground">ADL</p>
          </CardContent>
        </Card>
        <Card data-testid="card-part-iii-total">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Part III</p>
            <p className="text-2xl font-bold">{result.partIIITotal}</p>
            <p className="text-xs text-muted-foreground">Motor Exam</p>
          </CardContent>
        </Card>
        <Card data-testid="card-part-iv-total">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Part IV</p>
            <p className="text-2xl font-bold">{result.partIVTotal}</p>
            <p className="text-xs text-muted-foreground">Complications</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-hoehn-yahr-result">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hoehn and Yahr Stage {result.hoehnYahrStage}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{hyDescription}</p>
        </CardContent>
      </Card>

      {result.notes && (
        <Card data-testid="card-result-notes">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{result.notes}</p>
          </CardContent>
        </Card>
      )}

      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10" data-testid="result-disclaimer">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">{result.disclaimer}</AlertDescription>
      </Alert>
    </div>
  );
}

function HistoryPanel({ history }: { history: UPDRSAssessment[] }) {
  if (history.length === 0) {
    return (
      <Card className="text-center py-12" data-testid="card-no-history">
        <CardContent>
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No assessment history yet. Complete an assessment to start tracking.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Assessment History</h3>
      <div className="space-y-3">
        {history.map(r => {
          const trend = r.trend ? TREND_META[r.trend] : undefined;
          return (
            <Card key={r.id} data-testid={`history-${r.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
                      <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{r.grandTotal}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">Stage {r.hoehnYahrStage}</Badge>
                        {trend && (
                          <span className={`flex items-center gap-1 text-xs ${trend.className}`}>
                            {trend.icon}
                            {r.changeFromPrevious !== undefined ? `${r.changeFromPrevious > 0 ? "+" : ""}${r.changeFromPrevious}` : "Baseline"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(r.assessedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Motor: {r.motorTotal}</p>
                    <p className="text-xs">I:{r.partITotal} II:{r.partIITotal} III:{r.partIIITotal} IV:{r.partIVTotal}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Most recent assessment shown first.
      </p>
    </div>
  );
}
