/**
 * Longevity & Preventive Health panel.
 *
 * One component, three homes: the PHR "My Health Record" tab (patient mode),
 * the clinician chart's Preventive tab (clinician mode), and the standalone
 * /longevity-preventive-health page. All logic lives in the shared protocol
 * module so the WorldEHR mirror renders identical plans from identical inputs.
 *
 * Region (US vs international guidelines) defaults from the app's region
 * provider, so the tabulamedica.world deployment shows WHO/EU windows and SI
 * units without any extra configuration. Persistence is localStorage only —
 * this tier holds no PHI server-side.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useRegion } from "@/components/region-provider";
import {
  BIOMARKER_TARGETS,
  PROTOCOL_SOURCES,
  LONGEVITY_PROTOCOL_VERSION,
  assessBiomarker,
  buildLongevityPlan,
  formatTargetRange,
  fromDisplayUnit,
  summarizePlanForClinician,
  toDisplayUnit,
  type BiomarkerStatus,
  type BiomarkerTarget,
  type GuidelineRegion,
  type LongevityProfile,
  type PlanCategory,
  type PlanItem,
  type PlanItemStatus,
  type UnitSystem,
} from "@shared/longevity-preventive";
import {
  Activity,
  BookOpen,
  Brain,
  CalendarCheck,
  ClipboardCopy,
  Dumbbell,
  Ear,
  FlaskConical,
  HeartPulse,
  Info,
  Leaf,
  Printer,
  Ribbon,
  ShieldCheck,
  Syringe,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface LongevityPreventivePanelProps {
  mode?: "patient" | "clinician";
  /** Pre-fill from the chart (clinician) or onboarding (patient). */
  initialProfile?: Partial<LongevityProfile>;
  /** localStorage key; pass null to disable persistence (e.g. shared kiosk). */
  storageKey?: string | null;
  /** Hide the page-level heading when embedded inside another tab. */
  embedded?: boolean;
}

interface PersistedState {
  profile: LongevityProfile;
  completions: Record<string, string>;
  biomarkers: Record<string, { value: number; date: string }>;
  lifestyleChecks: Record<string, boolean>;
  units?: UnitSystem;
  regionOverride?: GuidelineRegion;
}

const DEFAULT_PROFILE: LongevityProfile = { age: 45, sex: "female", smokingStatus: "never" };

const CATEGORY_META: Record<PlanCategory, { label: string; icon: LucideIcon }> = {
  cardiometabolic: { label: "Heart, metabolism & kidneys", icon: HeartPulse },
  cancer_screening: { label: "Cancer screening", icon: Ribbon },
  infectious_disease: { label: "Infectious disease", icon: ShieldCheck },
  bone_muscle: { label: "Bone, muscle & falls", icon: Dumbbell },
  brain_mood: { label: "Brain & mood", icon: Brain },
  sensory: { label: "Hearing & vision", icon: Ear },
  immunization: { label: "Immunizations", icon: Syringe },
  lifestyle: { label: "Lifestyle reviews", icon: Leaf },
};

const STATUS_META: Record<PlanItemStatus, { label: string; className: string }> = {
  due: { label: "Due now", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  upcoming: { label: "Upcoming", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  discuss: { label: "Discuss", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  up_to_date: { label: "Up to date", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

const BIOMARKER_STATUS_META: Record<BiomarkerStatus, { label: string; className: string }> = {
  optimal: { label: "Optimal", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  borderline: { label: "Borderline", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  concern: { label: "Needs attention", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  unknown: { label: "Not entered", className: "bg-muted text-muted-foreground" },
};

const BIOMARKER_GROUP_LABEL: Record<BiomarkerTarget["group"], string> = {
  lipids: "Lipids & particles",
  glycemic: "Glucose & insulin",
  inflammation: "Inflammation",
  kidney_liver: "Kidney & liver",
  nutritional: "Nutritional",
  hormonal: "Thyroid",
  blood_pressure: "Blood pressure",
  body_composition: "Body composition",
};

function loadState(key: string | null, initialProfile?: Partial<LongevityProfile>): PersistedState {
  const base: PersistedState = {
    profile: { ...DEFAULT_PROFILE, ...(initialProfile ?? {}) },
    completions: {},
    biomarkers: {},
    lifestyleChecks: {},
  };
  if (!key) return base;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile ?? {}), ...(initialProfile ?? {}) },
    };
  } catch {
    return base;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LongevityPreventivePanel({
  mode = "patient",
  initialProfile,
  storageKey = "tabula_longevity_prevention",
  embedded = false,
}: LongevityPreventivePanelProps) {
  const { toast } = useToast();
  const { isUS } = useRegion();
  const [state, setState] = useState<PersistedState>(() => loadState(storageKey, initialProfile));
  const [activeTab, setActiveTab] = useState("plan");

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* storage may be unavailable (private mode, kiosk) — the panel still works */
    }
  }, [state, storageKey]);

  const region: GuidelineRegion = state.regionOverride ?? (isUS ? "us" : "international");
  const units: UnitSystem = state.units ?? (region === "us" ? "conventional" : "si");

  const plan = useMemo(
    () => buildLongevityPlan(state.profile, { region, completions: state.completions }),
    [state.profile, state.completions, region],
  );

  const updateProfile = (patch: Partial<LongevityProfile>) =>
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));

  const markDone = (id: string, date: string) =>
    setState((s) => {
      const completions = { ...s.completions };
      if (date) completions[id] = date;
      else delete completions[id];
      return { ...s, completions };
    });

  const setBiomarker = (target: BiomarkerTarget, displayValue: string) =>
    setState((s) => {
      const biomarkers = { ...s.biomarkers };
      const n = Number(displayValue);
      if (displayValue === "" || !Number.isFinite(n)) {
        delete biomarkers[target.id];
      } else {
        biomarkers[target.id] = { value: fromDisplayUnit(target, n, units), date: todayIso() };
      }
      return { ...s, biomarkers };
    });

  const toggleLifestyle = (key: string, checked: boolean) =>
    setState((s) => ({ ...s, lifestyleChecks: { ...s.lifestyleChecks, [key]: checked } }));

  const copySummary = async () => {
    const text = summarizePlanForClinician(plan);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Summary copied", description: "Paste it into your visit note or send it to your clinician." });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access. Use Print instead.", variant: "destructive" });
    }
  };

  const groupedScreenings = useMemo(() => {
    const groups = new Map<PlanCategory, PlanItem[]>();
    for (const item of plan.screenings) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries());
  }, [plan.screenings]);

  const groupedBiomarkers = useMemo(() => {
    const groups = new Map<BiomarkerTarget["group"], BiomarkerTarget[]>();
    for (const b of BIOMARKER_TARGETS) {
      const list = groups.get(b.group) ?? [];
      list.push(b);
      groups.set(b.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const biomarkerSummary = useMemo(() => {
    let optimal = 0;
    let borderline = 0;
    let concern = 0;
    for (const [id, entry] of Object.entries(state.biomarkers)) {
      const status = assessBiomarker(id, entry.value, state.profile.sex);
      if (status === "optimal") optimal += 1;
      else if (status === "borderline") borderline += 1;
      else if (status === "concern") concern += 1;
    }
    return { optimal, borderline, concern, entered: Object.keys(state.biomarkers).length };
  }, [state.biomarkers, state.profile.sex]);

  const p = state.profile;

  return (
    <div className="space-y-6" data-testid="longevity-preventive-panel">
      {!embedded && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-longevity-title">
              <Timer className="h-6 w-6 text-primary" />
              Longevity &amp; Preventive Health
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Screenings, vaccines, longevity biomarkers, fitness markers and lifestyle pillars in one age- and risk-adjusted plan.
            </p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">Protocol {LONGEVITY_PROTOCOL_VERSION}</Badge>
        </div>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Educational guideline summary, not medical advice or clinical decision support. Confirm every item with your clinician; individual history can move any age or interval.
        </AlertDescription>
      </Alert>

      {/* Profile & settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your profile</CardTitle>
          <CardDescription>Age, sex and risk factors decide what applies. Nothing here leaves your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="lp-age">Age</Label>
              <Input id="lp-age" type="number" min={18} max={120} value={p.age} onChange={(e) => updateProfile({ age: Math.max(18, Math.min(120, Number(e.target.value) || 18)) })} data-testid="input-lp-age" />
            </div>
            <div className="space-y-1">
              <Label>Sex at birth</Label>
              <Select value={p.sex} onValueChange={(v) => updateProfile({ sex: v as LongevityProfile["sex"] })}>
                <SelectTrigger data-testid="select-lp-sex"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Smoking</Label>
              <Select value={p.smokingStatus ?? "never"} onValueChange={(v) => updateProfile({ smokingStatus: v as LongevityProfile["smokingStatus"] })}>
                <SelectTrigger data-testid="select-lp-smoking"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="former">Former</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lp-bmi">BMI (optional)</Label>
              <Input id="lp-bmi" type="number" step="0.1" min={10} max={90} value={p.bmi ?? ""} placeholder="e.g. 26.4" onChange={(e) => updateProfile({ bmi: e.target.value === "" ? undefined : Number(e.target.value) })} data-testid="input-lp-bmi" />
            </div>
            {p.smokingStatus && p.smokingStatus !== "never" && (
              <div className="space-y-1">
                <Label htmlFor="lp-packyears">Pack-years</Label>
                <Input id="lp-packyears" type="number" min={0} value={p.packYears ?? ""} placeholder="packs/day × years" onChange={(e) => updateProfile({ packYears: e.target.value === "" ? undefined : Number(e.target.value) })} data-testid="input-lp-packyears" />
              </div>
            )}
            {p.smokingStatus === "former" && (
              <div className="space-y-1">
                <Label htmlFor="lp-quityears">Years since quitting</Label>
                <Input id="lp-quityears" type="number" min={0} value={p.quitYears ?? ""} onChange={(e) => updateProfile({ quitYears: e.target.value === "" ? undefined : Number(e.target.value) })} data-testid="input-lp-quityears" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {(
              [
                ["hasDiabetes", "Diabetes or prediabetes"],
                ["hasHypertension", "High blood pressure"],
                ["hasCardiovascularDisease", "Heart attack, stroke or stent"],
                ["hasChronicKidneyDisease", "Chronic kidney disease"],
                ["familyHistoryPrematureCvd", "Family history: early heart disease (<55 men / <65 women)"],
                ["familyHistoryColorectalCancer", "Family history: colorectal cancer"],
                ["familyHistoryBreastOrOvarianCancer", "Family history: breast or ovarian cancer"],
                ["immunocompromised", "Immunocompromised"],
                ["asianAncestry", "South or East Asian ancestry"],
                ...(p.sex === "female" ? ([["postmenopausal", "Postmenopausal"]] as const) : []),
              ] as ReadonlyArray<readonly [keyof LongevityProfile, string]>
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={Boolean(p[key])}
                  onCheckedChange={(checked) => updateProfile({ [key]: checked === true } as Partial<LongevityProfile>)}
                  data-testid={`checkbox-lp-${key}`}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <Separator />

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Guideline set</Label>
              <Select value={region} onValueChange={(v) => setState((s) => ({ ...s, regionOverride: v as GuidelineRegion }))}>
                <SelectTrigger className="w-[220px]" data-testid="select-lp-region"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States (USPSTF / ACIP)</SelectItem>
                  <SelectItem value="international">International (WHO / EU)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Lab units</Label>
              <Select value={units} onValueChange={(v) => setState((s) => ({ ...s, units: v as UnitSystem }))}>
                <SelectTrigger className="w-[180px]" data-testid="select-lp-units"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conventional">mg/dL (US, India)</SelectItem>
                  <SelectItem value="si">mmol/L (SI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={copySummary} data-testid="button-lp-copy-summary">
                <ClipboardCopy className="h-4 w-4 mr-1.5" />
                {mode === "clinician" ? "Copy note text" : "Copy for my doctor"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-lp-print">
                <Printer className="h-4 w-4 mr-1.5" />
                Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="lp-status-tiles">
        {(
          [
            ["due", plan.counts.due],
            ["upcoming", plan.counts.upcoming],
            ["discuss", plan.counts.discuss],
            ["up_to_date", plan.counts.upToDate],
          ] as Array<[PlanItemStatus, number]>
        ).map(([status, count]) => (
          <Card key={status} className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{STATUS_META[status].label}</div>
            <div className="text-2xl font-bold mt-1" data-testid={`text-lp-count-${status}`}>{count}</div>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
          <TabsList className="flex w-max sm:w-full h-auto gap-1 bg-muted/50 p-1 min-w-full" data-testid="lp-tabs">
            <TabsTrigger value="plan" className="shrink-0 sm:flex-1 text-xs sm:text-sm" data-testid="tab-lp-plan"><CalendarCheck className="h-4 w-4 mr-1.5" />Plan</TabsTrigger>
            <TabsTrigger value="biomarkers" className="shrink-0 sm:flex-1 text-xs sm:text-sm" data-testid="tab-lp-biomarkers"><FlaskConical className="h-4 w-4 mr-1.5" />Biomarkers</TabsTrigger>
            <TabsTrigger value="fitness" className="shrink-0 sm:flex-1 text-xs sm:text-sm" data-testid="tab-lp-fitness"><Activity className="h-4 w-4 mr-1.5" />Fitness</TabsTrigger>
            <TabsTrigger value="lifestyle" className="shrink-0 sm:flex-1 text-xs sm:text-sm" data-testid="tab-lp-lifestyle"><Leaf className="h-4 w-4 mr-1.5" />Lifestyle</TabsTrigger>
            <TabsTrigger value="sources" className="shrink-0 sm:flex-1 text-xs sm:text-sm" data-testid="tab-lp-sources"><BookOpen className="h-4 w-4 mr-1.5" />Sources</TabsTrigger>
          </TabsList>
        </div>

        {/* PLAN */}
        <TabsContent value="plan" className="mt-4 space-y-4">
          {groupedScreenings.map(([category, items]) => {
            const meta = CATEGORY_META[category];
            return (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <meta.icon className="h-4 w-4 text-primary" />
                    {meta.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <PlanList items={items} onMarkDone={markDone} />
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Syringe className="h-4 w-4 text-primary" />
                Immunizations
              </CardTitle>
              <CardDescription>{region === "us" ? "CDC ACIP adult schedule" : "WHO position papers; confirm against your national schedule"}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <PlanList items={plan.vaccines} onMarkDone={markDone} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* BIOMARKERS */}
        <TabsContent value="biomarkers" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Entered {biomarkerSummary.entered} of {BIOMARKER_TARGETS.length}:</span>
            <Badge className={BIOMARKER_STATUS_META.optimal.className}>{biomarkerSummary.optimal} optimal</Badge>
            <Badge className={BIOMARKER_STATUS_META.borderline.className}>{biomarkerSummary.borderline} borderline</Badge>
            <Badge className={BIOMARKER_STATUS_META.concern.className}>{biomarkerSummary.concern} need attention</Badge>
          </div>
          {groupedBiomarkers.map(([group, targets]) => (
            <Card key={group}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{BIOMARKER_GROUP_LABEL[group]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Marker</TableHead>
                      <TableHead>Longevity target</TableHead>
                      <TableHead className="min-w-[140px]">Your value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">How often</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((t) => {
                      const entry = state.biomarkers[t.id];
                      const status: BiomarkerStatus = entry ? assessBiomarker(t.id, entry.value, p.sex) : "unknown";
                      const display = entry ? toDisplayUnit(t, entry.value, units) : undefined;
                      const unit = toDisplayUnit(t, 0, units).unit;
                      return (
                        <TableRow key={t.id} data-testid={`row-lp-biomarker-${t.id}`}>
                          <TableCell>
                            <div className="font-medium">{t.name}</div>
                            {t.note && <div className="text-xs text-muted-foreground mt-0.5 max-w-[320px]">{t.note}</div>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatTargetRange(t, p.sex, units)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                step="any"
                                className="h-8 w-24"
                                value={display ? display.value : ""}
                                placeholder="—"
                                onChange={(e) => setBiomarker(t, e.target.value)}
                                data-testid={`input-lp-biomarker-${t.id}`}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={BIOMARKER_STATUS_META[status].className}>{BIOMARKER_STATUS_META[status].label}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{t.cadence}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* FITNESS */}
        <TabsContent value="fitness" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Cardiorespiratory fitness, strength and balance predict lifespan more strongly than any single lab value. Targets shown for {p.sex === "male" ? "men" : "women"}.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.functional.map((m) => (
              <Card key={m.id} data-testid={`card-lp-functional-${m.id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <CardDescription>{m.unit} · {m.cadence}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><span className="font-medium">Target: </span>{m.target[p.sex]}</div>
                  <div className="text-muted-foreground">{m.whyItMatters}</div>
                  <div className="text-xs text-muted-foreground"><span className="font-medium">How to measure: </span>{m.howToMeasure}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* LIFESTYLE */}
        <TabsContent value="lifestyle" className="mt-4 space-y-4">
          <Accordion type="multiple" defaultValue={plan.lifestyle.map((l) => l.id)} className="space-y-2">
            {plan.lifestyle.map((pillar) => (
              <AccordionItem key={pillar.id} value={pillar.id} className="border rounded-md px-4">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-medium">{pillar.title}</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  <div><span className="font-medium">Target: </span>{pillar.target}</div>
                  <div className="text-muted-foreground"><span className="font-medium text-foreground">Evidence: </span>{pillar.evidence}</div>
                  <div className="space-y-1.5">
                    {pillar.checkIns.map((c, i) => {
                      const key = `${pillar.id}:${i}`;
                      return (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={Boolean(state.lifestyleChecks[key])} onCheckedChange={(v) => toggleLifestyle(key, v === true)} data-testid={`checkbox-lp-lifestyle-${pillar.id}-${i}`} />
                          <span>{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* SOURCES */}
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guideline sources (protocol {LONGEVITY_PROTOCOL_VERSION})</CardTitle>
              <CardDescription>Where each interval comes from. Guidelines change; the protocol version is stamped on every plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                {PROTOCOL_SOURCES.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanList({ items, onMarkDone }: { items: PlanItem[]; onMarkDone: (id: string, date: string) => void }) {
  if (items.length === 0) {
    return <p className="px-6 pb-4 text-sm text-muted-foreground">Nothing in this group applies to the current profile.</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="px-6 py-3 flex flex-col md:flex-row md:items-start gap-3" data-testid={`row-lp-plan-${item.id}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{item.title}</span>
              <Badge className={STATUS_META[item.status].className} data-testid={`badge-lp-status-${item.id}`}>{STATUS_META[item.status].label}</Badge>
              <Badge variant="outline" className="text-[10px]">{item.grade}</Badge>
            </div>
            <div className="text-sm mt-1">{item.cadence}</div>
            {item.note && <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">{item.note}</div>}
            <div className="text-xs text-muted-foreground mt-1">{item.whyItMatters}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Source: {item.source}{item.nextDue ? ` · Next due ${item.nextDue}` : ""}</div>
          </div>
          <div className="shrink-0 space-y-1 md:w-[170px]">
            <Label htmlFor={`done-${item.id}`} className="text-xs text-muted-foreground">Last done</Label>
            <Input
              id={`done-${item.id}`}
              type="date"
              className="h-8"
              value={item.lastDone ?? ""}
              max={todayIso()}
              onChange={(e) => onMarkDone(item.id, e.target.value)}
              data-testid={`input-lp-done-${item.id}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default LongevityPreventivePanel;
