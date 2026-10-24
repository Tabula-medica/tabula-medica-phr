/**
 * Oncology tab for the clinician chart.
 *
 * Aggregates the patient's cancer course (pathology, biomarkers, imaging, tumor
 * markers, treatments) from Cancer Track plus chart labs, and compiles exposure-
 * driven survivorship considerations for the PROVIDER. Nothing here is shown in
 * the patient PHR. All logic lives in shared/oncology-survivorship.ts so the
 * World outpatient EHR mirror renders the same course and list from the same
 * inputs. Clinician decisions persist through /api/oncology-survivorship.
 *
 * Strings are English-only on purpose: this is a clinician surface, like the
 * clinician mode of the Longevity panel.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CLINICIAN_DISCLAIMER,
  ONCOLOGY_SURVIVORSHIP_VERSION,
  buildOncologyCourse,
  buildSurvivorshipSuggestions,
  oncologyCaseFromCancerTrack,
  summarizeForClinician,
  tumorMarkerStudiesFromLabs,
  type CancerTrackBasicsLike,
  type CancerTrackDocumentLike,
  type CancerTrackTimelineLike,
  type CourseEventType,
  type DecisionStatus,
  type DiseaseResponse,
  type DueState,
  type MarkerTrend,
  type OncologyStudy,
  type OncologyTreatment,
  type StudyKind,
  type SuggestionDecision,
  type SuggestionPriority,
  type SurvivorshipSuggestion,
} from "@shared/oncology-survivorship";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  ClipboardCopy,
  Dna,
  Loader2,
  Microscope,
  Minus,
  Pill,
  Plus,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type CancerRecord = CancerTrackBasicsLike & { id: string };

interface ChartLab {
  id: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  collectionDate: string;
}

export interface OncologySurvivorshipPanelProps {
  patientId: string;
  /** Cancer Track groups records by profile; defaults to the chart patient id. */
  profileId?: string;
  age?: number;
  sex?: "male" | "female";
  labs?: ChartLab[];
}

interface RefineResponse {
  aiRefined: boolean;
  aiUnavailable?: boolean;
  courseNarrative?: string;
  refinements: {
    id: string;
    patientSpecificRationale?: string;
    dataToConfirm: string[];
    priorityBefore: SuggestionPriority;
    priorityAfter: SuggestionPriority;
  }[];
  clarifyingQuestions: string[];
  aiDisclosure?: string;
}

const PRIORITY_STYLE: Record<SuggestionPriority, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  routine: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  consider: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const DUE_LABEL: Record<DueState, string> = {
  overdue: "Overdue",
  due: "Due",
  upcoming: "Up to date",
  no_record: "No record",
};

const RESPONSE_LABEL: Record<DiseaseResponse, string> = {
  ned: "No evidence of disease",
  response: "Response",
  stable: "Stable",
  indeterminate: "Indeterminate",
  new_finding: "New finding",
  progression: "Progression",
};

const EVENT_ICON: Record<CourseEventType, typeof Activity> = {
  diagnosis: Stethoscope,
  pathology: Microscope,
  imaging: ScanLine,
  molecular: Dna,
  tumor_marker: Activity,
  treatment_start: Pill,
  treatment_end: CheckCircle2,
  recurrence: AlertTriangle,
  other_study: Activity,
};

const STUDY_GROUP_LABEL: Record<StudyKind, string> = {
  imaging: "Imaging",
  pathology: "Pathology",
  molecular: "Molecular",
  tumor_marker: "Tumor markers",
  cardiac: "Cardiac",
  bone_density: "Bone density",
  audiology: "Audiology",
  other: "Other",
};

const STUDY_GROUP_ORDER: StudyKind[] = ["pathology", "molecular", "imaging", "tumor_marker", "cardiac", "bone_density", "audiology", "other"];

function Sparkline({ trend }: { trend: MarkerTrend }) {
  const values = trend.points.map((p) => p.value);
  if (values.length < 2) return <span className="text-xs text-muted-foreground">single value</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 80;
  const h = 24;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} role="img" aria-label={`${trend.name} trend, ${trend.direction}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TrendIcon({ direction }: { direction: MarkerTrend["direction"] }) {
  if (direction === "rising") return <TrendingUp className="h-4 w-4 text-red-600" aria-hidden />;
  if (direction === "falling") return <TrendingDown className="h-4 w-4 text-emerald-600" aria-hidden />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Rule ids are shared across cancers; persist decisions under the cancer that was reviewed. */
function storedSuggestionId(cancerId: string, ruleId: string): string {
  return `${cancerId}--${ruleId}`;
}

export function OncologySurvivorshipPanel({ patientId, profileId, age, sex, labs = [] }: OncologySurvivorshipPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = profileId ?? patientId;

  const [cancerId, setCancerId] = useState<string | undefined>();
  const [manualStudies, setManualStudies] = useState<OncologyStudy[]>([]);
  const [manualTreatments, setManualTreatments] = useState<OncologyTreatment[]>([]);
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [refined, setRefined] = useState<RefineResponse | null>(null);

  const switchCancer = (id: string) => {
    setCancerId(id);
    setManualStudies([]);
    setManualTreatments([]);
    setRefined(null);
  };

  const { data: cancers, isLoading: cancersLoading } = useQuery<CancerRecord[]>({ queryKey: ["/api/cancer-track/profiles", profile] });
  const activeCancer = cancers?.find((c) => c.id === cancerId) ?? cancers?.[0];
  const activeId = activeCancer?.id;

  const { data: timeline } = useQuery<(CancerTrackTimelineLike & { cancerId?: string })[]>({
    queryKey: ["/api/cancer-track", activeId ?? "none", "timeline"],
    enabled: !!activeId,
  });
  const { data: documents } = useQuery<CancerTrackDocumentLike[]>({
    queryKey: ["/api/cancer-track", activeId ?? "none", "documents"],
    enabled: !!activeId,
  });

  const decisionsKey = ["/api/oncology-survivorship/patients", patientId, "decisions"];
  const { data: decisionData } = useQuery<{ decisions: Record<string, SuggestionDecision> }>({ queryKey: decisionsKey });
  const storedDecisions = decisionData?.decisions ?? {};
  const decisions = useMemo(() => {
    if (!activeId) return {} as Record<string, SuggestionDecision>;
    const prefix = `${activeId}--`;
    const out: Record<string, SuggestionDecision> = {};
    for (const [key, decision] of Object.entries(storedDecisions)) {
      if (!key.startsWith(prefix)) continue;
      const ruleId = key.slice(prefix.length);
      out[ruleId] = { ...decision, suggestionId: ruleId };
    }
    return out;
  }, [storedDecisions, activeId]);

  const completions = useMemo(() => {
    const out: Record<string, string> = {};
    for (const d of Object.values(decisions)) if (d.status === "completed") out[d.suggestionId] = d.decidedAt.slice(0, 10);
    return out;
  }, [decisions]);

  const oncologyCase = useMemo(() => {
    if (!activeCancer || !timeline || !documents) return undefined;
    const base = oncologyCaseFromCancerTrack(activeCancer, timeline, documents, {
      studies: [...tumorMarkerStudiesFromLabs(labs), ...manualStudies],
    });
    return { ...base, treatments: [...base.treatments, ...manualTreatments] };
  }, [activeCancer, timeline, documents, labs, manualStudies, manualTreatments]);

  const course = useMemo(() => (oncologyCase ? buildOncologyCourse(oncologyCase) : undefined), [oncologyCase]);
  const suggestionSet = useMemo(
    () => (oncologyCase ? buildSurvivorshipSuggestions(oncologyCase, { age, sex, completions }) : undefined),
    [oncologyCase, age, sex, completions],
  );

  const decide = useMutation({
    mutationFn: async (v: { id: string; cancerId: string; status: DecisionStatus; note?: string }) => {
      const storedId = storedSuggestionId(v.cancerId, v.id);
      const res = await apiRequest("PUT", `/api/oncology-survivorship/patients/${patientId}/decisions/${storedId}`, { status: v.status, note: v.note });
      return (await res.json()) as { decision: SuggestionDecision };
    },
    onSuccess: ({ decision }) => {
      queryClient.setQueryData<{ decisions: Record<string, SuggestionDecision> }>(decisionsKey, (prev) => ({
        decisions: { ...(prev?.decisions ?? {}), [decision.suggestionId]: decision },
      }));
    },
    onError: () => toast({ title: "Could not save decision", variant: "destructive" }),
  });

  const refine = useMutation({
    mutationFn: async () => {
      if (!oncologyCase) throw new Error("no case");
      const res = await apiRequest("POST", "/api/oncology-survivorship/refine", { case: oncologyCase, context: { age, sex, completions } });
      return (await res.json()) as RefineResponse;
    },
    onSuccess: (r) => {
      setRefined(r);
      if (r.aiUnavailable) toast({ title: "AI refinement unavailable", description: "Showing the guideline-derived list unchanged." });
    },
    onError: () => toast({ title: "AI refinement failed", variant: "destructive" }),
  });

  const refinementById = useMemo(() => new Map((refined?.refinements ?? []).map((r) => [r.id, r])), [refined]);

  const copySummary = async () => {
    if (!course || !suggestionSet) return;
    try {
      await navigator.clipboard.writeText(summarizeForClinician(course, suggestionSet, decisions));
      toast({ title: "Summary copied", description: "Paste into the visit note after review." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (cancersLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground" data-testid="oncology-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading oncology record…
      </div>
    );
  }

  if (!cancers?.length) {
    return (
      <Card data-testid="oncology-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Oncology
          </CardTitle>
          <CardDescription>No cancer record is linked to this chart.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Create a Cancer Track entry (diagnosis, biomarkers, treatments, pathology and imaging documents) and this tab will aggregate the course and compile
          survivorship considerations for review.
        </CardContent>
      </Card>
    );
  }

  const visibleSuggestions = (suggestionSet?.suggestions ?? []).filter((s) => {
    const st = decisions[s.id]?.status ?? "pending";
    return statusFilter === "all" || st === "pending" || st === "deferred";
  });

  return (
    <div className="space-y-6" data-testid="oncology-panel">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          <strong>Provider-only.</strong> Survivorship considerations are compiled for clinician review and are never shown to the patient. {CLINICIAN_DISCLAIMER}
        </AlertDescription>
      </Alert>

      <Card data-testid="card-oncology-header">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" /> Oncology course
              </CardTitle>
              <CardDescription data-testid="text-oncology-headline">{course ? course.headline : "Loading course…"}</CardDescription>
            </div>
            {cancers.length > 1 && (
              <Select value={activeId} onValueChange={switchCancer}>
                <SelectTrigger className="w-56" aria-label="Select cancer record" data-testid="select-cancer">
                  <SelectValue placeholder="Select cancer" />
                </SelectTrigger>
                <SelectContent>
                  {cancers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cancerType.replace(/_/g, " ")} · {c.diagnosisDate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        {course && (
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Status: {course.status.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">Studies suggest: {course.derivedDiseaseStatus.replace(/_/g, " ")}</Badge>
              {course.yearsSinceDefinitiveTreatment !== undefined && <Badge variant="outline">{course.yearsSinceDefinitiveTreatment} y since treatment</Badge>}
              {course.ongoingTherapies.map((t) => (
                <Badge key={t} variant="secondary">
                  On: {t}
                </Badge>
              ))}
              {course.exposureLabels.map((e) => (
                <Badge key={e} className={PRIORITY_STYLE.consider}>
                  {e}
                </Badge>
              ))}
            </div>
            {course.alerts.map((a) => (
              <Alert key={a.id} variant={a.severity === "critical" ? "destructive" : "default"} data-testid={`alert-${a.id}`}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{a.message}</AlertDescription>
              </Alert>
            ))}
            {course.dataGaps.length > 0 && (
              <div className="rounded-md border p-3 text-sm" data-testid="oncology-data-gaps">
                <div className="mb-1 font-medium">Data gaps</div>
                <ul className="list-inside list-disc text-muted-foreground">
                  {course.dataGaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {course && suggestionSet && (
        <Tabs defaultValue="survivorship" className="w-full">
          <TabsList className="grid w-full grid-cols-5" data-testid="tabs-oncology">
            <TabsTrigger value="survivorship" data-testid="subtab-survivorship">
              Survivorship ({suggestionSet.counts.total})
            </TabsTrigger>
            <TabsTrigger value="course" data-testid="subtab-course">
              Course
            </TabsTrigger>
            <TabsTrigger value="pathology" data-testid="subtab-pathology">
              Pathology
            </TabsTrigger>
            <TabsTrigger value="studies" data-testid="subtab-studies">
              Studies
            </TabsTrigger>
            <TabsTrigger value="add" data-testid="subtab-add-data">
              Add data
            </TabsTrigger>
          </TabsList>

          {/* ── Survivorship (provider review list) ── */}
          <TabsContent value="survivorship" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {suggestionSet.counts.high} high priority · {suggestionSet.counts.overdue} overdue · protocol {ONCOLOGY_SURVIVORSHIP_VERSION}
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "open" | "all")}>
                  <SelectTrigger className="w-40" aria-label="Filter considerations by decision status" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open items</SelectItem>
                    <SelectItem value="all">All items</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => refine.mutate()} disabled={refine.isPending} data-testid="button-ai-refine">
                  {refine.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Refine with AI
                </Button>
                <Button variant="outline" size="sm" onClick={copySummary} data-testid="button-copy-oncology-summary">
                  <ClipboardCopy className="mr-2 h-4 w-4" /> Copy for note
                </Button>
              </div>
            </div>

            {suggestionSet.scopeNote && (
              <Alert data-testid="alert-limited-scope">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{suggestionSet.scopeNote}</AlertDescription>
              </Alert>
            )}

            {refined?.aiRefined && (
              <Card data-testid="card-ai-refinement">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" /> AI-assisted synthesis
                  </CardTitle>
                  <CardDescription>{refined.aiDisclosure}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {refined.courseNarrative && <p>{refined.courseNarrative}</p>}
                  {refined.clarifyingQuestions.length > 0 && (
                    <div>
                      <div className="font-medium">Questions to resolve in the chart</div>
                      <ul className="list-inside list-disc text-muted-foreground">
                        {refined.clarifyingQuestions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {visibleSuggestions.length === 0 && <p className="py-6 text-center text-muted-foreground">No open considerations.</p>}

            {visibleSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                decision={decisions[s.id]}
                refinement={refinementById.get(s.id)}
                busy={decide.isPending}
                onDecide={(status, note) => activeId && decide.mutate({ id: s.id, cancerId: activeId, status, note })}
              />
            ))}
          </TabsContent>

          {/* ── Course timeline ── */}
          <TabsContent value="course" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Treatment summary</CardTitle>
              </CardHeader>
              <CardContent>
                {course.treatmentSummary.length ? (
                  <ul className="space-y-1 text-sm" data-testid="list-treatment-summary">
                    {course.treatmentSummary.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No treatments documented.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3" data-testid="list-course-timeline">
                  {course.timeline.map((e, i) => {
                    const Icon = EVENT_ICON[e.type];
                    return (
                      <li key={`${e.date}-${e.type}-${i}`} className="flex gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${e.type === "recurrence" ? "text-red-600" : "text-muted-foreground"}`} aria-hidden />
                        <div className="text-sm">
                          <div className="font-medium">
                            {e.date} · {e.title}
                          </div>
                          {e.detail && <div className="text-muted-foreground">{e.detail}</div>}
                          {e.response && <Badge variant="outline">{RESPONSE_LABEL[e.response]}</Badge>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pathology & biomarkers ── */}
          <TabsContent value="pathology" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Microscope className="h-4 w-4" /> Pathology digest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2" data-testid="pathology-digest">
                  {(
                    [
                      ["Histology", course.pathology.histology],
                      ["Grade", course.pathology.grade],
                      ["Stage", course.pathology.stage],
                      ["TNM", course.pathology.tnm],
                      ["Margins", course.pathology.margins],
                      ["Nodes", course.pathology.nodes],
                      ["Lymphovascular invasion", course.pathology.lymphovascularInvasion],
                      ["Tumor size", course.pathology.tumorSizeMm !== undefined ? `${course.pathology.tumorSizeMm} mm` : undefined],
                    ] as [string, string | undefined][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b py-1">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v ?? "Not documented"}</dd>
                    </div>
                  ))}
                </dl>
                {course.pathology.sources.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">Sources: {course.pathology.sources.map((s) => `${s.title} (${s.date})`).join("; ")}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Dna className="h-4 w-4" /> Biomarkers and genetics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {course.pathology.biomarkers.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marker</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {course.pathology.biomarkers.map((b) => (
                        <TableRow key={b.name}>
                          <TableCell>{b.name}</TableCell>
                          <TableCell>{b.value}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{b.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No biomarkers on file.</p>
                )}
                {course.pathology.genetics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {course.pathology.genetics.map((g) => (
                      <Badge key={g.gene} variant={g.result === "pathogenic" || g.result === "likely_pathogenic" ? "destructive" : "outline"}>
                        {g.gene}: {g.result.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Studies ── */}
          <TabsContent value="studies" className="space-y-4">
            {course.markerTrends.length > 0 && (
              <Card data-testid="card-marker-trends">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" /> Tumor marker trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marker</TableHead>
                        <TableHead>Latest</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {course.markerTrends.map((m) => (
                        <TableRow key={m.name}>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell>
                            {m.latest} {m.unit}
                            {m.aboveUln && <Badge className="ml-2" variant="destructive">above ULN</Badge>}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1">
                              <TrendIcon direction={m.direction} />
                              {m.changePercent !== undefined ? `${m.changePercent > 0 ? "+" : ""}${m.changePercent}%` : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Sparkline trend={m} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            {STUDY_GROUP_ORDER.filter((k) => k !== "tumor_marker" && course.studyGroups[k].length > 0).map((kind) => (
              <Card key={kind} data-testid={`card-studies-${kind}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {STUDY_GROUP_LABEL[kind]} ({course.studyGroups[kind].length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {course.studyGroups[kind].map((s) => (
                    <div key={s.id} className="rounded-md border p-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {s.date} · {s.title}
                          {s.modality ? ` (${s.modality})` : ""}
                        </span>
                        {s.response && <Badge variant={s.response === "progression" || s.response === "new_finding" ? "destructive" : "outline"}>{RESPONSE_LABEL[s.response]}</Badge>}
                      </div>
                      {s.impression && <p className="mt-1 text-muted-foreground">{s.impression}</p>}
                      {s.lvefPercent !== undefined && <p className="mt-1 text-muted-foreground">LVEF {s.lvefPercent}%</p>}
                      {s.tScore !== undefined && <p className="mt-1 text-muted-foreground">T-score {s.tScore}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Add data ── */}
          <TabsContent value="add" className="space-y-4">
            <AddDataForms
              key={activeId}
              onStudy={(s) => setManualStudies((prev) => [...prev, s])}
              onTreatment={(t) => setManualTreatments((prev) => [...prev, t])}
            />
            <p className="text-xs text-muted-foreground">
              Entries here apply to this session only so the considerations can be explored. Record durable data in Cancer Track (pathology, imaging, treatments) so it persists.
            </p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion: s,
  decision,
  refinement,
  busy,
  onDecide,
}: {
  suggestion: SurvivorshipSuggestion;
  decision?: SuggestionDecision;
  refinement?: RefineResponse["refinements"][number];
  busy: boolean;
  onDecide: (status: DecisionStatus, note?: string) => void;
}) {
  const [note, setNote] = useState(decision?.note ?? "");
  const [open, setOpen] = useState(false);
  const status = decision?.status ?? "pending";
  const priority = refinement?.priorityAfter ?? s.priority;
  return (
    <Card data-testid={`suggestion-${s.id}`} className={status === "dismissed" ? "opacity-60" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{s.title}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge className={PRIORITY_STYLE[priority]}>
              {priority}
              {refinement && refinement.priorityAfter !== refinement.priorityBefore ? ` (was ${refinement.priorityBefore})` : ""}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {DUE_LABEL[s.dueState]}
            </Badge>
            {status !== "pending" && <Badge variant="secondary">{status}</Badge>}
          </div>
        </div>
        <CardDescription>{s.consideration}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1">
          {s.triggers.slice(0, 4).map((t) => (
            <Badge key={t} variant="outline" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
        <div className="text-muted-foreground">Cadence: {s.cadence}</div>

        {refinement?.patientSpecificRationale && (
          <div className="rounded-md bg-muted p-2" data-testid={`ai-note-${s.id}`}>
            <span className="font-medium">AI note: </span>
            {refinement.patientSpecificRationale}
            {refinement.dataToConfirm.length > 0 && <div className="mt-1 text-muted-foreground">Confirm: {refinement.dataToConfirm.join("; ")}</div>}
          </div>
        )}

        {s.dataGaps.length > 0 && <div className="text-amber-700 dark:text-amber-400">Missing: {s.dataGaps.join("; ")}</div>}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} /> Rationale and sources
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 text-muted-foreground">
            <p>{s.rationale}</p>
            {s.triggers.length > 4 && (
              <ul className="list-inside list-disc">
                {s.triggers.slice(4).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            <p className="text-xs">Sources: {s.sources.join(" · ")}</p>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (no patient identifiers)" className="h-8 max-w-xs" maxLength={500} aria-label={`Note for ${s.title}`} />
          <Button size="sm" variant={status === "accepted" ? "default" : "outline"} disabled={busy} onClick={() => onDecide("accepted", note || undefined)} data-testid={`button-accept-${s.id}`}>
            Accept
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("completed", note || undefined)} data-testid={`button-complete-${s.id}`}>
            Mark done
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("deferred", note || undefined)} data-testid={`button-defer-${s.id}`}>
            Defer
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("dismissed", note || undefined)} data-testid={`button-dismiss-${s.id}`}>
            Dismiss
          </Button>
        </div>
        {decision && (
          <div className="text-xs text-muted-foreground">
            {decision.status} {decision.decidedAt.slice(0, 10)}
            {decision.note ? ` — ${decision.note}` : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddDataForms({ onStudy, onTreatment }: { onStudy: (s: OncologyStudy) => void; onTreatment: (t: OncologyTreatment) => void }) {
  const [kind, setKind] = useState<StudyKind>("imaging");
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [response, setResponse] = useState<DiseaseResponse | "none">("none");
  const [markerValue, setMarkerValue] = useState("");
  const [lvef, setLvef] = useState("");

  const [agent, setAgent] = useState("");
  const [cumDose, setCumDose] = useState("");
  const [rtSite, setRtSite] = useState("");
  const [rtDose, setRtDose] = useState("");
  const [rtStart, setRtStart] = useState(todayISO());

  const addStudy = () => {
    if (!title.trim()) return;
    const study: OncologyStudy = { id: `manual-${Date.now()}`, kind, date, title: title.trim() };
    if (response !== "none") study.response = response;
    if (kind === "tumor_marker" && markerValue) study.marker = { name: title.trim(), value: Number(markerValue) };
    if (kind === "cardiac" && lvef) study.lvefPercent = Number(lvef);
    onStudy(study);
    setTitle("");
    setMarkerValue("");
    setLvef("");
  };

  const addAnthracycline = () => {
    if (!agent.trim() || !cumDose) return;
    onTreatment({
      id: `manual-tx-${Date.now()}`,
      modality: "chemotherapy",
      title: `${agent.trim()} (recorded dose)`,
      start: todayISO(),
      exposureOnly: true,
      agents: [agent.trim()],
      cumulativeDoseMgM2: [{ agent: agent.trim(), dose: Number(cumDose) }],
    });
    setAgent("");
    setCumDose("");
  };

  const addRadiation = () => {
    if (!rtSite.trim()) return;
    onTreatment({
      id: `manual-rt-${Date.now()}`,
      modality: "radiation",
      title: `Radiation ${rtSite.trim()}`,
      start: rtStart,
      end: rtStart,
      radiation: { site: rtSite.trim(), doseGy: rtDose ? Number(rtDose) : undefined },
    });
    setRtSite("");
    setRtDose("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a study</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="onc-kind">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as StudyKind)}>
                <SelectTrigger id="onc-kind" data-testid="select-study-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDY_GROUP_ORDER.map((k) => (
                    <SelectItem key={k} value={k}>
                      {STUDY_GROUP_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="onc-date">Date</Label>
              <Input id="onc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="onc-title">{kind === "tumor_marker" ? "Marker (e.g. CEA)" : "Title"}</Label>
            <Input id="onc-title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-study-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="onc-response">Read</Label>
              <Select value={response} onValueChange={(v) => setResponse(v as DiseaseResponse | "none")}>
                <SelectTrigger id="onc-response">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not stated</SelectItem>
                  {(Object.keys(RESPONSE_LABEL) as DiseaseResponse[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RESPONSE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kind === "tumor_marker" && (
              <div>
                <Label htmlFor="onc-marker">Value</Label>
                <Input id="onc-marker" inputMode="decimal" value={markerValue} onChange={(e) => setMarkerValue(e.target.value)} />
              </div>
            )}
            {kind === "cardiac" && (
              <div>
                <Label htmlFor="onc-lvef">LVEF %</Label>
                <Input id="onc-lvef" inputMode="decimal" value={lvef} onChange={(e) => setLvef(e.target.value)} />
              </div>
            )}
          </div>
          <Button size="sm" onClick={addStudy} data-testid="button-add-study">
            <Plus className="mr-2 h-4 w-4" /> Add study
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record exposure details</CardTitle>
          <CardDescription>Cumulative doses and radiation fields refine the cardiac and second-cancer rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="onc-agent">Anthracycline</Label>
              <Input id="onc-agent" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Doxorubicin" />
            </div>
            <div>
              <Label htmlFor="onc-dose">Cumulative mg/m²</Label>
              <Input id="onc-dose" inputMode="decimal" value={cumDose} onChange={(e) => setCumDose(e.target.value)} />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={addAnthracycline} data-testid="button-add-anthracycline">
            <Plus className="mr-2 h-4 w-4" /> Add dose
          </Button>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="onc-rt-site">Radiation site</Label>
              <Input id="onc-rt-site" value={rtSite} onChange={(e) => setRtSite(e.target.value)} placeholder="Chest wall, neck, pelvis…" />
            </div>
            <div>
              <Label htmlFor="onc-rt-dose">Dose (Gy)</Label>
              <Input id="onc-rt-dose" inputMode="decimal" value={rtDose} onChange={(e) => setRtDose(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="onc-rt-start">Radiation date</Label>
            <Input id="onc-rt-start" type="date" value={rtStart} onChange={(e) => setRtStart(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={addRadiation} data-testid="button-add-radiation">
            <Plus className="mr-2 h-4 w-4" /> Add radiation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default OncologySurvivorshipPanel;
