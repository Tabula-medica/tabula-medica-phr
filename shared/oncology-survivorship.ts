/**
 * Oncology course aggregation + provider-facing survivorship suggestions.
 *
 * Portable, dependency-free module shared by the Tabula Medica EHR (clinician
 * chart "Oncology" tab, /api/oncology-survivorship) and, by mirroring, the
 * World outpatient EHR. Keep it free of React, Express and Node imports. It
 * never touches storage: callers pass a case in and get a course summary and a
 * suggestion list out.
 *
 * Two jobs:
 *   1. buildOncologyCourse    — merge pathology, imaging, molecular, tumor
 *                               marker and treatment records into one dated
 *                               course with a pathology digest, disease-status
 *                               trajectory, alerts and data gaps.
 *   2. buildSurvivorshipSuggestions — exposure-driven, guideline-derived
 *                               considerations FOR THE CLINICIAN. Nothing here
 *                               is shown to patients, and nothing orders,
 *                               prescribes or notifies. Every item stays
 *                               "for clinician review" until a clinician
 *                               accepts, defers or dismisses it.
 *
 * Guideline provenance (named, not quoted; clinicians must confirm against the
 * current edition): ASCO survivorship and cardiac-dysfunction guidelines,
 * NCCN Survivorship and disease-site guidelines, COG Long-Term Follow-Up
 * Guidelines, IGHG, ESC 2022 cardio-oncology, ACS survivorship and
 * nutrition/physical-activity guidelines. Thresholds below are a summary and
 * can lag the source; PROTOCOL_SOURCES lists what each rule leans on.
 */

export const ONCOLOGY_SURVIVORSHIP_VERSION = "2026.10";

export type GuidelineRegion = "us" | "international";
export type Sex = "male" | "female";

// ─── Case model ──────────────────────────────────────────────────────────────

export type StudyKind =
  | "pathology"
  | "imaging"
  | "molecular"
  | "tumor_marker"
  | "cardiac"
  | "bone_density"
  | "audiology"
  | "other";

/** Radiology/oncology response language collapsed to a small closed set. */
export type DiseaseResponse = "ned" | "response" | "stable" | "indeterminate" | "new_finding" | "progression";

export interface PathologyFindings {
  specimen?: string;
  histology?: string;
  /** Free text grade, e.g. "Grade 2", "Gleason 3+4". */
  grade?: string;
  margins?: "negative" | "close" | "positive" | "unknown";
  nodesPositive?: number;
  nodesExamined?: number;
  lymphovascularInvasion?: boolean;
  tumorSizeMm?: number;
  pathologicStage?: string;
}

export interface TumorMarkerValue {
  name: string;
  value: number;
  unit?: string;
  /** Upper limit of normal for the assay; enables the "above ULN" flag. */
  refHigh?: number;
}

export interface OncologyStudy {
  id: string;
  kind: StudyKind;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  /** CT, PET/CT, MRI, mammogram, ultrasound, echo, DEXA, ... */
  modality?: string;
  site?: string;
  /** Structured impression only. Free-text report bodies are never needed here. */
  impression?: string;
  response?: DiseaseResponse;
  pathology?: PathologyFindings;
  marker?: TumorMarkerValue;
  /** Cardiac studies: LVEF percent. */
  lvefPercent?: number;
  /** Bone density studies: lowest T-score. */
  tScore?: number;
  documentId?: string;
}

export type TreatmentModality =
  | "surgery"
  | "chemotherapy"
  | "radiation"
  | "immunotherapy"
  | "targeted_therapy"
  | "hormone_therapy"
  | "stem_cell_transplant"
  | "clinical_trial"
  | "other";

export interface OncologyTreatment {
  id: string;
  modality: TreatmentModality;
  title: string;
  start: string;
  end?: string;
  ongoing?: boolean;
  intent?: "curative" | "adjuvant" | "neoadjuvant" | "palliative" | "maintenance";
  agents?: string[];
  /** Cumulative dose per agent in mg/m². Only anthracyclines are interpreted today. */
  cumulativeDoseMgM2?: { agent: string; dose: number }[];
  radiation?: { site: string; doseGy?: number; fractions?: number };
  surgery?: { procedure: string; axillaryDissection?: boolean; oophorectomy?: boolean; splenectomy?: boolean };
  allogeneicTransplant?: boolean;
  outcome?: string;
  /**
   * Dose/agent detail attached to a course documented elsewhere. Counts toward
   * exposures but is ignored for phase, timeline and treatment-end dating.
   */
  exposureOnly?: boolean;
}

export interface BiomarkerResult {
  name: string;
  value: string;
  status: "positive" | "negative" | "equivocal" | "unknown";
  testedAt?: string;
}

export interface GeneticFinding {
  gene: string;
  result: "pathogenic" | "likely_pathogenic" | "vus" | "negative";
}

export type CaseStatus = "active_treatment" | "surveillance" | "remission" | "recurrent" | "metastatic" | "unknown";

export interface OncologyCase {
  primarySite: string;
  histology?: string;
  grade?: string;
  /** Stage group, e.g. "IIA". */
  stage?: string;
  tnm?: { t?: string; n?: string; m?: string; basis?: "clinical" | "pathologic" };
  diagnosisDate: string;
  status: CaseStatus;
  remissionDate?: string;
  biomarkers: BiomarkerResult[];
  geneticFindings?: GeneticFinding[];
  studies: OncologyStudy[];
  treatments: OncologyTreatment[];
  /** Treatment summary / survivorship care plan hand-off status. */
  treatmentSummaryDocumented?: boolean;
  survivorshipCarePlanDocumented?: boolean;
}

export interface SurvivorContext {
  /** Age today. */
  age?: number;
  sex?: Sex;
  region?: GuidelineRegion;
  today?: Date;
  smokingStatus?: "never" | "former" | "current";
  hasHypertension?: boolean;
  hasDiabetes?: boolean;
  hasCardiovascularDisease?: boolean;
  /** Rule id -> ISO date the clinician last completed it. Drives due/overdue. */
  completions?: Record<string, string>;
}

// ─── Small helpers ───────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function parseDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (DAY_MS * 365.25);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (DAY_MS * 30.4375);
}

const byDateAsc = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

/** "50 Gy", "5000 cGy", "50.4Gy in 28 fx" -> 50 / 50 / 50.4. */
export function parseDoseGy(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /(\d+(?:\.\d+)?)\s*(cgy|gy)/i.exec(text);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2].toLowerCase() === "cgy" ? n / 100 : n;
}

// ─── Exposure derivation ─────────────────────────────────────────────────────

export type Exposure =
  | "anthracycline"
  | "her2_antibody"
  | "alkylator"
  | "platinum"
  | "taxane"
  | "vinca"
  | "bleomycin"
  | "topoisomerase_ii"
  | "immune_checkpoint"
  | "aromatase_inhibitor"
  | "tamoxifen"
  | "adt"
  | "tki_or_vegf"
  | "parp_inhibitor"
  | "methotrexate_or_ifosfamide"
  | "chest_rt"
  | "neck_rt"
  | "abdominal_pelvic_rt"
  | "cranial_rt"
  | "head_neck_rt"
  | "hsct"
  | "axillary_treatment"
  | "premature_ovarian_loss"
  | "splenectomy";

const DRUG_PATTERNS: Partial<Record<Exposure, RegExp>> = {
  anthracycline: /doxorubicin|adriamycin|epirubicin|daunorubicin|idarubicin|mitoxantrone|liposomal doxorubicin|doxil/i,
  her2_antibody: /trastuzumab|herceptin|pertuzumab|perjeta|t-dm1|kadcyla|enhertu|deruxtecan|margetuximab/i,
  alkylator: /cyclophosphamide|cytoxan|ifosfamide|melphalan|busulfan|chlorambucil|bendamustine|carmustine|lomustine|temozolomide|dacarbazine|procarbazine|mechlorethamine/i,
  platinum: /cisplatin|carboplatin|oxaliplatin|platinol/i,
  taxane: /paclitaxel|taxol|docetaxel|taxotere|cabazitaxel|nab-paclitaxel|abraxane/i,
  vinca: /vincristine|vinblastine|vinorelbine|eribulin/i,
  bleomycin: /bleomycin/i,
  topoisomerase_ii: /etoposide|teniposide|doxorubicin|epirubicin|mitoxantrone/i,
  immune_checkpoint: /pembrolizumab|keytruda|nivolumab|opdivo|ipilimumab|yervoy|atezolizumab|durvalumab|cemiplimab|avelumab|dostarlimab|tremelimumab|relatlimab/i,
  aromatase_inhibitor: /anastrozole|arimidex|letrozole|femara|exemestane|aromasin/i,
  tamoxifen: /tamoxifen|nolvadex|toremifene/i,
  adt: /leuprolide|lupron|goserelin|zoladex|degarelix|firmagon|relugolix|orgovyx|triptorelin|bicalutamide|abiraterone|enzalutamide|apalutamide|darolutamide/i,
  tki_or_vegf: /sunitinib|sorafenib|pazopanib|axitinib|cabozantinib|lenvatinib|bevacizumab|ramucirumab|imatinib|dasatinib|nilotinib|ponatinib|osimertinib|ibrutinib|lapatinib|neratinib|tucatinib/i,
  parp_inhibitor: /olaparib|lynparza|niraparib|zejula|rucaparib|talazoparib/i,
  methotrexate_or_ifosfamide: /methotrexate|ifosfamide|cisplatin/i,
};

/** Doxorubicin-equivalent factors from the COG Long-Term Follow-Up Guidelines. */
const ANTHRACYCLINE_DOX_EQUIVALENT: { pattern: RegExp; factor: number }[] = [
  { pattern: /doxorubicin|adriamycin|doxil/i, factor: 1 },
  { pattern: /daunorubicin/i, factor: 0.5 },
  { pattern: /epirubicin/i, factor: 0.67 },
  { pattern: /idarubicin/i, factor: 5 },
  { pattern: /mitoxantrone/i, factor: 4 },
];

function radiationRegion(site: string | undefined): Exposure[] {
  if (!site) return [];
  const s = site.toLowerCase();
  const out: Exposure[] = [];
  if (/chest|thora|mediastin|lung|breast|mantle|supraclav|axill|esophag/.test(s)) out.push("chest_rt");
  if (/neck|thyroid|nasophar|oropharyn|larynx|head and neck|head & neck|tonsil|cervical node/.test(s)) {
    out.push("neck_rt");
    out.push("head_neck_rt");
  }
  if (/abdom|pelvi|prostat|rectal|rectum|cervix|uter|bladder|anal|liver|kidney|whole abdomen|flank/.test(s)) out.push("abdominal_pelvic_rt");
  if (/brain|cranial|cranio|whole brain|skull|pituitar/.test(s)) out.push("cranial_rt");
  return out;
}

export interface ExposureProfile {
  exposures: Set<Exposure>;
  /** Cumulative doxorubicin-equivalent mg/m², when documented. */
  anthracyclineDoxEquivMgM2?: number;
  anthracyclineDoseDocumented: boolean;
  chestRtDoseGy?: number;
  chestRtDoseDocumented: boolean;
  /** Highest documented dose by exposure region, for threshold rules. */
  rtDoseGyByRegion: Partial<Record<Exposure, number>>;
  /** Age at the start of the earliest radiation course, if both are known. */
  chestRtStart?: string;
  longTermTherapyAgents: string[];
}

export function deriveExposures(c: OncologyCase): ExposureProfile {
  const exposures = new Set<Exposure>();
  let doxEquiv = 0;
  let anthraDocumented = false;
  let sawAnthracycline = false;
  const rtDoseGyByRegion: Partial<Record<Exposure, number>> = {};
  let chestRtDoseDocumented = false;
  let chestRtStart: string | undefined;
  const longTerm: string[] = [];

  for (const t of c.treatments) {
    const agentText = [...(t.agents ?? []), t.title].join(" ; ");

    if (t.modality === "chemotherapy" || t.modality === "immunotherapy" || t.modality === "targeted_therapy" || t.modality === "hormone_therapy" || t.modality === "clinical_trial") {
      for (const [exposure, pattern] of Object.entries(DRUG_PATTERNS) as [Exposure, RegExp][]) {
        if (pattern.test(agentText)) exposures.add(exposure);
      }
      if (DRUG_PATTERNS.anthracycline!.test(agentText)) sawAnthracycline = true;
      if (t.ongoing && (t.modality === "hormone_therapy" || t.intent === "maintenance")) {
        longTerm.push(...(t.agents?.length ? t.agents : [t.title]));
      }
    }

    for (const dose of t.cumulativeDoseMgM2 ?? []) {
      const entry = ANTHRACYCLINE_DOX_EQUIVALENT.find((e) => e.pattern.test(dose.agent));
      if (entry && Number.isFinite(dose.dose)) {
        doxEquiv += dose.dose * entry.factor;
        anthraDocumented = true;
      }
    }

    if (t.modality === "radiation" || t.radiation) {
      const regions = radiationRegion(t.radiation?.site ?? t.title);
      for (const r of regions) {
        exposures.add(r);
        const gy = t.radiation?.doseGy;
        if (gy !== undefined) {
          rtDoseGyByRegion[r] = Math.max(rtDoseGyByRegion[r] ?? 0, gy);
          if (r === "chest_rt") chestRtDoseDocumented = true;
        }
        if (r === "chest_rt" && (!chestRtStart || t.start < chestRtStart)) chestRtStart = t.start;
      }
    }

    if (t.modality === "stem_cell_transplant") exposures.add("hsct");
    if (t.surgery?.axillaryDissection) exposures.add("axillary_treatment");
    if (t.surgery?.oophorectomy) exposures.add("premature_ovarian_loss");
    if (t.surgery?.splenectomy) exposures.add("splenectomy");
    if (t.modality === "radiation" && /axill/i.test(t.radiation?.site ?? t.title)) exposures.add("axillary_treatment");
  }

  return {
    exposures,
    anthracyclineDoxEquivMgM2: anthraDocumented ? Math.round(doxEquiv) : undefined,
    anthracyclineDoseDocumented: anthraDocumented || !sawAnthracycline,
    chestRtDoseGy: rtDoseGyByRegion.chest_rt,
    chestRtDoseDocumented,
    rtDoseGyByRegion,
    chestRtStart,
    longTermTherapyAgents: Array.from(new Set(longTerm)),
  };
}

// ─── Course aggregation ──────────────────────────────────────────────────────

export type SurvivorshipPhase = "active_treatment" | "early_survivorship" | "intermediate_survivorship" | "long_term_survivorship" | "unknown";

export type CourseEventType = "diagnosis" | "pathology" | "imaging" | "molecular" | "tumor_marker" | "treatment_start" | "treatment_end" | "recurrence" | "other_study";

export interface CourseEvent {
  date: string;
  type: CourseEventType;
  title: string;
  detail?: string;
  response?: DiseaseResponse;
  refId?: string;
}

export interface MarkerTrend {
  name: string;
  unit?: string;
  points: { date: string; value: number }[];
  latest: number;
  previous?: number;
  /** Percent change from the previous point. */
  changePercent?: number;
  direction: "rising" | "falling" | "flat" | "single";
  aboveUln: boolean;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface CourseAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

export interface PathologyDigest {
  histology?: string;
  grade?: string;
  stage?: string;
  tnm?: string;
  margins?: string;
  nodes?: string;
  lymphovascularInvasion?: string;
  tumorSizeMm?: number;
  biomarkers: { name: string; value: string; status: BiomarkerResult["status"] }[];
  genetics: GeneticFinding[];
  sources: { id: string; date: string; title: string }[];
}

export interface OncologyCourse {
  version: string;
  headline: string;
  primarySite: string;
  diagnosisDate: string;
  status: CaseStatus;
  /** Status the studies support, which can differ from the charted status. */
  derivedDiseaseStatus: "no_evidence_of_disease" | "stable_or_responding" | "progression_suspected" | "unknown";
  phase: SurvivorshipPhase;
  yearsSinceDiagnosis: number;
  yearsSinceDefinitiveTreatment?: number;
  lastDefinitiveTreatmentEnd?: string;
  ongoingTherapies: string[];
  pathology: PathologyDigest;
  studyGroups: Record<StudyKind, OncologyStudy[]>;
  latestImaging?: OncologyStudy;
  markerTrends: MarkerTrend[];
  timeline: CourseEvent[];
  treatmentSummary: string[];
  exposureLabels: string[];
  alerts: CourseAlert[];
  dataGaps: string[];
}

const EXPOSURE_LABELS: Record<Exposure, string> = {
  anthracycline: "Anthracycline",
  her2_antibody: "HER2-directed antibody",
  alkylator: "Alkylating agent",
  platinum: "Platinum",
  taxane: "Taxane",
  vinca: "Vinca / microtubule agent",
  bleomycin: "Bleomycin",
  topoisomerase_ii: "Topoisomerase II inhibitor",
  immune_checkpoint: "Immune checkpoint inhibitor",
  aromatase_inhibitor: "Aromatase inhibitor",
  tamoxifen: "Tamoxifen / SERM",
  adt: "Androgen deprivation / AR pathway",
  tki_or_vegf: "TKI / VEGF-pathway agent",
  parp_inhibitor: "PARP inhibitor",
  methotrexate_or_ifosfamide: "Nephrotoxic chemotherapy",
  chest_rt: "Chest / breast radiation",
  neck_rt: "Neck radiation",
  abdominal_pelvic_rt: "Abdominal / pelvic radiation",
  cranial_rt: "Cranial radiation",
  head_neck_rt: "Head and neck radiation",
  hsct: "Stem cell transplant",
  axillary_treatment: "Axillary surgery / radiation",
  premature_ovarian_loss: "Oophorectomy",
  splenectomy: "Splenectomy",
};

const emptyGroups = (): Record<StudyKind, OncologyStudy[]> => ({
  pathology: [],
  imaging: [],
  molecular: [],
  tumor_marker: [],
  cardiac: [],
  bone_density: [],
  audiology: [],
  other: [],
});

function trendMarkers(studies: OncologyStudy[]): MarkerTrend[] {
  const byName = new Map<string, OncologyStudy[]>();
  for (const s of studies) {
    if (s.kind !== "tumor_marker" || !s.marker) continue;
    const key = s.marker.name.toUpperCase();
    byName.set(key, [...(byName.get(key) ?? []), s]);
  }
  const trends: MarkerTrend[] = [];
  for (const group of Array.from(byName.values())) {
    const sorted = [...group].sort(byDateAsc);
    const points = sorted.map((s) => ({ date: s.date, value: s.marker!.value }));
    const last = sorted[sorted.length - 1].marker!;
    const prev = sorted.length > 1 ? sorted[sorted.length - 2].marker!.value : undefined;
    const changePercent = prev !== undefined && prev !== 0 ? ((last.value - prev) / Math.abs(prev)) * 100 : undefined;
    let direction: MarkerTrend["direction"] = "single";
    if (changePercent !== undefined) direction = changePercent > 10 ? "rising" : changePercent < -10 ? "falling" : "flat";
    trends.push({
      name: last.name,
      unit: last.unit,
      points,
      latest: last.value,
      previous: prev,
      changePercent: changePercent !== undefined ? Math.round(changePercent * 10) / 10 : undefined,
      direction,
      aboveUln: last.refHigh !== undefined ? last.value > last.refHigh : false,
    });
  }
  return trends;
}

function buildPathologyDigest(c: OncologyCase): PathologyDigest {
  const pathStudies = c.studies.filter((s) => s.kind === "pathology" && s.pathology).sort(byDateAsc);
  const withHistology = pathStudies.find((s) => s.pathology?.histology) ?? pathStudies[0];
  // Surgical pathology is the most informative for margins/nodes/pT; prefer the latest that has them.
  const surgical = [...pathStudies].reverse().find((s) => s.pathology?.margins || s.pathology?.nodesExamined !== undefined);
  const tnm = c.tnm ? [c.tnm.t, c.tnm.n, c.tnm.m].filter(Boolean).join("") : undefined;
  const nodes = surgical?.pathology?.nodesExamined !== undefined
    ? `${surgical.pathology.nodesPositive ?? 0}/${surgical.pathology.nodesExamined} positive`
    : undefined;
  const lvi = surgical?.pathology?.lymphovascularInvasion;
  return {
    histology: c.histology ?? withHistology?.pathology?.histology,
    grade: c.grade ?? withHistology?.pathology?.grade,
    stage: c.stage ?? surgical?.pathology?.pathologicStage,
    tnm: tnm ? `${c.tnm?.basis === "clinical" ? "c" : c.tnm?.basis === "pathologic" ? "p" : ""}${tnm}` : undefined,
    margins: surgical?.pathology?.margins,
    nodes,
    lymphovascularInvasion: lvi === undefined ? undefined : lvi ? "present" : "not identified",
    tumorSizeMm: surgical?.pathology?.tumorSizeMm ?? withHistology?.pathology?.tumorSizeMm,
    biomarkers: c.biomarkers.map((b) => ({ name: b.name, value: b.value, status: b.status })),
    genetics: c.geneticFindings ?? [],
    sources: pathStudies.map((s) => ({ id: s.id, date: s.date, title: s.title })),
  };
}

function derivePhase(c: OncologyCase, today: Date): {
  phase: SurvivorshipPhase;
  lastEnd?: string;
  years?: number;
  ongoing: string[];
} {
  const dated = c.treatments.filter((t) => !t.exposureOnly);
  const ongoingDefinitive = dated.filter(
    (t) => (t.ongoing || (!t.end && t.modality !== "surgery")) && t.intent !== "maintenance" && t.modality !== "hormone_therapy",
  );
  const ongoing = dated.filter((t) => t.ongoing).map((t) => t.title);
  const ended = dated
    .filter((t) => !t.ongoing && (t.end || t.modality === "surgery") && t.modality !== "hormone_therapy" && t.intent !== "maintenance" && t.intent !== "palliative")
    .map((t) => t.end ?? t.start)
    .sort();
  const lastEnd = ended[ended.length - 1];

  if (c.status === "active_treatment" || c.status === "metastatic" || c.status === "recurrent" || ongoingDefinitive.length > 0) {
    return { phase: "active_treatment", lastEnd, ongoing };
  }
  if (!lastEnd) return { phase: "unknown", ongoing };
  const end = parseDate(lastEnd);
  if (!end) return { phase: "unknown", ongoing };
  const years = yearsBetween(end, today);
  const phase: SurvivorshipPhase = years <= 1 ? "early_survivorship" : years <= 5 ? "intermediate_survivorship" : "long_term_survivorship";
  return { phase, lastEnd, years: Math.max(0, Math.round(years * 10) / 10), ongoing };
}

const PHASE_LABEL: Record<SurvivorshipPhase, string> = {
  active_treatment: "active treatment or recurrent/metastatic disease",
  early_survivorship: "early survivorship (≤1 y from treatment)",
  intermediate_survivorship: "survivorship years 1–5",
  long_term_survivorship: "long-term survivorship (>5 y)",
  unknown: "treatment end date not documented",
};

export function buildOncologyCourse(c: OncologyCase, ctx: { today?: Date } = {}): OncologyCourse {
  const today = ctx.today ?? new Date();
  const dx = parseDate(c.diagnosisDate);
  const yearsSinceDiagnosis = dx ? Math.max(0, Math.round(yearsBetween(dx, today) * 10) / 10) : 0;
  const { phase, lastEnd, years, ongoing } = derivePhase(c, today);
  const profile = deriveExposures(c);

  const studyGroups = emptyGroups();
  for (const s of [...c.studies].sort(byDateAsc).reverse()) studyGroups[s.kind].push(s);

  const imaging = studyGroups.imaging;
  const latestImaging = imaging[0];
  const markerTrends = trendMarkers(c.studies);
  const pathology = buildPathologyDigest(c);

  // Disease status the studies support: look at the most recent imaging with a response read.
  const recentRead = [...c.studies].filter((s) => s.response).sort(byDateAsc).reverse()[0];
  let derivedDiseaseStatus: OncologyCourse["derivedDiseaseStatus"] = "unknown";
  if (recentRead) {
    derivedDiseaseStatus =
      recentRead.response === "progression" || recentRead.response === "new_finding"
        ? "progression_suspected"
        : recentRead.response === "ned"
          ? "no_evidence_of_disease"
          : "stable_or_responding";
  }

  const timeline: CourseEvent[] = [{ date: c.diagnosisDate, type: "diagnosis", title: `Diagnosis: ${[c.histology, c.primarySite].filter(Boolean).join(" ")}`.trim(), detail: c.stage ? `Stage ${c.stage}` : undefined }];
  for (const s of c.studies) {
    const type: CourseEventType = s.kind === "pathology" ? "pathology" : s.kind === "imaging" ? "imaging" : s.kind === "molecular" ? "molecular" : s.kind === "tumor_marker" ? "tumor_marker" : "other_study";
    const detail =
      s.kind === "tumor_marker" && s.marker
        ? `${s.marker.name} ${s.marker.value}${s.marker.unit ? ` ${s.marker.unit}` : ""}`
        : s.impression;
    timeline.push({ date: s.date, type, title: s.title, detail, response: s.response, refId: s.id });
    if (s.response === "progression" || s.response === "new_finding") {
      timeline.push({ date: s.date, type: "recurrence", title: s.response === "progression" ? "Progression reported" : "New finding reported", detail: s.title, response: s.response, refId: s.id });
    }
  }
  for (const t of c.treatments.filter((x) => !x.exposureOnly)) {
    timeline.push({ date: t.start, type: "treatment_start", title: `${t.title} started`, detail: t.agents?.join(", "), refId: t.id });
    if (t.end) timeline.push({ date: t.end, type: "treatment_end", title: `${t.title} completed`, detail: t.outcome, refId: t.id });
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  const treatmentSummary = [...c.treatments]
    .filter((t) => !t.exposureOnly)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t) => {
      const parts = [t.title];
      if (t.agents?.length) parts.push(`(${t.agents.join(", ")})`);
      if (t.radiation) parts.push(`${t.radiation.site}${t.radiation.doseGy !== undefined ? ` ${t.radiation.doseGy} Gy` : ""}`);
      parts.push(`${t.start}${t.end ? ` → ${t.end}` : t.ongoing ? " → ongoing" : ""}`);
      return parts.join(" ");
    });

  const alerts: CourseAlert[] = [];
  const dataGaps: string[] = [];

  if (derivedDiseaseStatus === "progression_suspected") {
    alerts.push({ id: "progression-read", severity: "critical", message: `Most recent study read (${recentRead!.date}) reports ${recentRead!.response === "progression" ? "progression" : "a new finding"}. Survivorship surveillance does not apply until the treating oncologist reviews.` });
  }
  if (c.status === "remission" && derivedDiseaseStatus === "progression_suspected") {
    alerts.push({ id: "status-discordant", severity: "critical", message: "Charted status is remission but the latest study read reports progression. Reconcile with oncology." });
  }
  for (const m of markerTrends) {
    if (m.direction === "rising" && m.changePercent !== undefined && m.changePercent >= 25) {
      alerts.push({ id: `marker-rising-${m.name.toLowerCase()}`, severity: m.aboveUln ? "critical" : "warning", message: `${m.name} rose ${m.changePercent}% between the last two values (${m.previous} → ${m.latest}${m.unit ? ` ${m.unit}` : ""})${m.aboveUln ? " and is above the upper limit of normal" : ""}.` });
    } else if (m.aboveUln) {
      alerts.push({ id: `marker-uln-${m.name.toLowerCase()}`, severity: "warning", message: `${m.name} ${m.latest}${m.unit ? ` ${m.unit}` : ""} is above the upper limit of normal.` });
    }
  }
  for (const s of c.studies) {
    if (s.kind === "cardiac" && s.lvefPercent !== undefined && s.lvefPercent < 50) {
      alerts.push({ id: `lvef-${s.id}`, severity: s.lvefPercent < 40 ? "critical" : "warning", message: `LVEF ${s.lvefPercent}% on ${s.date}.` });
    }
    if (s.kind === "bone_density" && s.tScore !== undefined && s.tScore <= -2.5) {
      alerts.push({ id: `dexa-${s.id}`, severity: "warning", message: `DEXA T-score ${s.tScore} on ${s.date} (osteoporosis range).` });
    }
  }
  if (pathology.margins === "positive") alerts.push({ id: "margins-positive", severity: "warning", message: "Surgical pathology reports positive margins." });

  if (!pathology.sources.length) dataGaps.push("No pathology report on file.");
  if (!pathology.histology) dataGaps.push("Histology not documented.");
  if (!c.stage && !pathology.stage) dataGaps.push("Stage not documented.");
  if (!c.biomarkers.length) dataGaps.push("No biomarkers or molecular results on file.");
  if (!c.treatments.length) dataGaps.push("No treatments documented.");
  if (phase !== "active_treatment" && phase !== "unknown" && !c.treatmentSummaryDocumented) dataGaps.push("Treatment summary not documented.");
  if (phase !== "active_treatment" && phase !== "unknown" && !c.survivorshipCarePlanDocumented) dataGaps.push("Survivorship care plan not documented.");
  if (profile.exposures.has("anthracycline") && !profile.anthracyclineDoseDocumented) dataGaps.push("Anthracycline exposure documented without cumulative dose; cardiac risk tier cannot be assigned.");
  if (profile.exposures.has("chest_rt") && !profile.chestRtDoseDocumented) dataGaps.push("Chest radiation documented without dose.");
  if (profile.exposures.has("abdominal_pelvic_rt") && profile.rtDoseGyByRegion.abdominal_pelvic_rt === undefined) dataGaps.push("Abdominal/pelvic radiation documented without dose.");
  if (c.treatments.some((t) => t.modality === "radiation" && !t.radiation?.site)) dataGaps.push("A radiation course has no treated site.");
  if (!imaging.length && phase !== "unknown") dataGaps.push("No imaging on file.");
  if (latestImaging) {
    const lastImg = parseDate(latestImaging.date);
    if (lastImg && monthsBetween(lastImg, today) > 15 && phase !== "long_term_survivorship") {
      dataGaps.push(`Last imaging was ${Math.round(monthsBetween(lastImg, today))} months ago.`);
    }
  }

  const exposureLabels = Array.from(profile.exposures).map((e) => EXPOSURE_LABELS[e]);
  const headline = [
    [c.histology, c.primarySite].filter(Boolean).join(" "),
    c.stage ? `stage ${c.stage}` : undefined,
    `dx ${c.diagnosisDate}`,
    PHASE_LABEL[phase],
  ].filter(Boolean).join(" · ");

  return {
    version: ONCOLOGY_SURVIVORSHIP_VERSION,
    headline,
    primarySite: c.primarySite,
    diagnosisDate: c.diagnosisDate,
    status: c.status,
    derivedDiseaseStatus,
    phase,
    yearsSinceDiagnosis,
    yearsSinceDefinitiveTreatment: years,
    lastDefinitiveTreatmentEnd: lastEnd,
    ongoingTherapies: ongoing,
    pathology,
    studyGroups,
    latestImaging,
    markerTrends,
    timeline,
    treatmentSummary,
    exposureLabels,
    alerts,
    dataGaps,
  };
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export type SuggestionDomain =
  | "care_coordination"
  | "surveillance"
  | "cardiac"
  | "endocrine_bone"
  | "neuro_sensory"
  | "pulmonary_renal"
  | "second_cancer"
  | "genetics"
  | "psychosocial"
  | "reproductive_sexual"
  | "lifestyle"
  | "immunization"
  | "symptom_management";

export type SuggestionPriority = "high" | "routine" | "consider";
export type DueState = "overdue" | "due" | "upcoming" | "no_record";

export interface SurvivorshipSuggestion {
  /** Stable rule id; clinician decisions are stored against it. */
  id: string;
  domain: SuggestionDomain;
  title: string;
  /** What the clinician may consider. Phrased as a consideration, never an order. */
  consideration: string;
  rationale: string;
  /** Chart facts that triggered the rule. */
  triggers: string[];
  cadence: string;
  /** Interval used for due/overdue; 0 = one-time or as clinically indicated. */
  frequencyMonths: number;
  priority: SuggestionPriority;
  dueState: DueState;
  lastCompleted?: string;
  sources: string[];
  dataGaps: string[];
}

export const PROTOCOL_SOURCES: Record<string, string> = {
  "ASCO-SURV": "ASCO survivorship and disease-site follow-up guidelines",
  "ASCO-CARDIAC": "ASCO guideline: prevention and monitoring of cardiac dysfunction in survivors of adult cancers (2017)",
  "ASCO-CIPN": "ASCO guideline: chemotherapy-induced peripheral neuropathy (2020)",
  "NCCN-SURV": "NCCN Guidelines: Survivorship",
  "NCCN-DISTRESS": "NCCN Guidelines: Distress Management",
  "NCCN-SITE": "NCCN disease-site guidelines (follow-up / surveillance sections)",
  "NCCN-GEN": "NCCN Guidelines: Genetic/Familial High-Risk Assessment",
  "COG-LTFU": "Children's Oncology Group Long-Term Follow-Up Guidelines (v6)",
  "ESC-2022": "ESC 2022 cardio-oncology guideline",
  "ACS-SURV": "American Cancer Society survivorship care guidelines",
  "ACS-NPA": "ACS guideline for nutrition and physical activity for cancer survivors (2022)",
  "ACIP": "CDC/ACIP adult immunization schedule",
  "ASTCT": "ASTCT/CIBMTR recommended screening and preventive practices for long-term survivors after HCT",
  "ASCO-IRAE": "ASCO guideline: management of immune-related adverse events",
};

interface Rule {
  id: string;
  domain: SuggestionDomain;
  title: string;
  consideration: string;
  rationale: string;
  cadence: string;
  frequencyMonths: number;
  sources: string[];
  /** Return trigger strings (non-empty) when the rule applies, else null. */
  match: (k: RuleInput) => { triggers: string[]; priority?: SuggestionPriority; dataGaps?: string[] } | null;
}

interface RuleInput {
  c: OncologyCase;
  ctx: SurvivorContext;
  p: ExposureProfile;
  course: OncologyCourse;
  today: Date;
  ageNow?: number;
  ageAtDx?: number;
  female: boolean;
  male: boolean;
}

const has = (k: RuleInput, ...e: Exposure[]) => e.some((x) => k.p.exposures.has(x));
const labelOf = (e: Exposure) => EXPOSURE_LABELS[e];
const bm = (c: OncologyCase, re: RegExp) => c.biomarkers.find((b) => re.test(b.name));

function hormoneReceptorPositive(c: OncologyCase): boolean {
  const er = bm(c, /\ber\b|estrogen/i);
  const pr = bm(c, /\bpr\b|progesterone/i);
  return er?.status === "positive" || pr?.status === "positive";
}

function tripleNegative(c: OncologyCase): boolean {
  const er = bm(c, /\ber\b|estrogen/i);
  const pr = bm(c, /\bpr\b|progesterone/i);
  const her2 = bm(c, /her2|erbb2/i);
  return er?.status === "negative" && pr?.status === "negative" && her2?.status === "negative";
}

/**
 * Cardiac exposure tier. Anthracycline in doxorubicin-equivalents (COG factors)
 * and chest RT dose, combined the way the COG LTFU and ESC 2022 risk tables do
 * in broad strokes: ≥250 mg/m², ≥35 Gy, or a combined ≥100 mg/m² + ≥15 Gy is
 * high. Anything else exposed is intermediate; undocumented dose is "unknown".
 */
export function cardiacRiskTier(p: ExposureProfile, ctx: SurvivorContext): "high" | "intermediate" | "unknown" | "none" {
  const anthra = p.exposures.has("anthracycline");
  const her2 = p.exposures.has("her2_antibody");
  const chest = p.exposures.has("chest_rt");
  if (!anthra && !her2 && !chest) return "none";
  const dox = p.anthracyclineDoxEquivMgM2;
  const rt = p.chestRtDoseGy;
  if ((dox !== undefined && dox >= 250) || (rt !== undefined && rt >= 35)) return "high";
  if (dox !== undefined && rt !== undefined && dox >= 100 && rt >= 15) return "high";
  if (anthra && her2) return "high";
  const clinicalRisk = [ctx.hasHypertension, ctx.hasDiabetes, ctx.hasCardiovascularDisease, (ctx.age ?? 0) >= 65].filter(Boolean).length;
  if (clinicalRisk >= 2 && (anthra || her2 || chest)) return "high";
  if ((anthra && dox === undefined) || (chest && rt === undefined)) return "unknown";
  return "intermediate";
}

const SITE_SURVEILLANCE: Record<string, { cadence: string; detail: string[]; sources: string[]; frequencyMonths: number }> = {
  breast: {
    cadence: "Visit q3–6 mo yr 1–3, q6–12 mo yr 4–5, then yearly; mammogram yearly",
    frequencyMonths: 12,
    detail: [
      "History and physical every 3–6 months for 3 years, every 6–12 months for years 4–5, then annually.",
      "Annual mammography (after breast-conserving surgery, first mammogram ≥6 months after radiation).",
      "No routine tumor markers or body imaging in asymptomatic patients (ASCO).",
      "Annual gynecologic review if on tamoxifen with an intact uterus; prompt evaluation of abnormal bleeding.",
    ],
    sources: ["ASCO-SURV", "NCCN-SITE"],
  },
  colon: {
    cadence: "H&P + CEA q3–6 mo ×2 y then q6 mo to y5; CT q6–12 mo ×5 y; colonoscopy at 1 y, 3 y, then q5 y",
    frequencyMonths: 6,
    detail: [
      "History and physical with CEA every 3–6 months for 2 years, then every 6 months to year 5 (stage II–III).",
      "CT chest/abdomen/pelvis every 6–12 months for up to 5 years (stage II–III).",
      "Colonoscopy at 1 year, repeat at 3 years, then every 5 years if normal (earlier if incomplete pre-operative exam or advanced adenomas).",
    ],
    sources: ["NCCN-SITE", "ASCO-SURV"],
  },
  prostate: {
    cadence: "PSA q6–12 mo ×5 y then yearly; DRE yearly",
    frequencyMonths: 6,
    detail: [
      "PSA every 6–12 months for 5 years, then at least annually; DRE at least annually.",
      "After prostatectomy a confirmed PSA ≥0.2 ng/mL is the usual biochemical recurrence threshold; after radiotherapy, nadir + 2 ng/mL (Phoenix).",
      "Androgen deprivation: see bone and metabolic items.",
    ],
    sources: ["NCCN-SITE", "ASCO-SURV"],
  },
  lung: {
    cadence: "H&P + CT chest q6 mo for 2–3 y, then annual low-dose non-contrast CT",
    frequencyMonths: 6,
    detail: [
      "History and physical with CT chest (± contrast) every 6 months for 2–3 years, then annual non-contrast low-dose CT.",
      "Smoking cessation support at every visit if applicable.",
    ],
    sources: ["NCCN-SITE"],
  },
  melanoma: {
    cadence: "Skin exam q3–12 mo by stage for 5 y; lifelong yearly total-body skin exam",
    frequencyMonths: 12,
    detail: [
      "Full skin and lymph node exam; interval depends on stage (roughly 3–6 months early for higher stages, 6–12 months for stage I–IIA) and lengthens over time.",
      "Lifelong annual total-body skin examination; teach self-examination and sun protection.",
      "Imaging surveillance is stage-dependent; follow the treating oncologist's plan.",
    ],
    sources: ["NCCN-SITE"],
  },
  lymphoma: {
    cadence: "H&P + labs q3–6 mo ×1–2 y, q6–12 mo to y3, then yearly",
    frequencyMonths: 6,
    detail: [
      "Clinical review with CBC/chemistry at the intervals above; routine surveillance PET/CT is not recommended in remission—image for symptoms or abnormal findings.",
      "Annual TSH if neck radiation; see second-cancer items after chest radiation.",
    ],
    sources: ["NCCN-SITE", "COG-LTFU"],
  },
  thyroid: {
    cadence: "TSH ± thyroglobulin + neck US at 6–12 mo, then yearly",
    frequencyMonths: 12,
    detail: [
      "TSH, thyroglobulin and anti-thyroglobulin antibodies with neck ultrasound at 6–12 months, then annually if no evidence of disease.",
      "Titrate levothyroxine suppression target to recurrence risk.",
    ],
    sources: ["NCCN-SITE"],
  },
  ovarian: {
    cadence: "H&P q2–4 mo ×2 y, q3–6 mo ×3 y, then yearly",
    frequencyMonths: 6,
    detail: [
      "Pelvic exam and history at the intervals above; CA-125 or imaging if clinically indicated.",
      "Genetic counseling/testing if not done (see genetics item).",
    ],
    sources: ["NCCN-SITE"],
  },
  cervical: {
    cadence: "H&P q3–6 mo ×2 y, q6–12 mo to y5, then yearly",
    frequencyMonths: 6,
    detail: ["History, pelvic exam and cytology per site guideline at the intervals above."],
    sources: ["NCCN-SITE"],
  },
  uterine: {
    cadence: "H&P q3–6 mo ×2–3 y, then q6–12 mo to y5, then yearly",
    frequencyMonths: 6,
    detail: ["History, pelvic exam; routine vaginal cytology is not advised. Report abnormal bleeding promptly."],
    sources: ["NCCN-SITE"],
  },
  head_neck: {
    cadence: "H&P q1–3 mo y1, q2–6 mo y2, q4–8 mo y3–5, then yearly; TSH q6–12 mo",
    frequencyMonths: 3,
    detail: [
      "Examination including mirror/fiberoptic evaluation at the intervals above; baseline post-treatment imaging per oncology.",
      "TSH every 6–12 months if neck irradiated; speech, swallowing and dental rehabilitation.",
    ],
    sources: ["NCCN-SITE"],
  },
  testicular: {
    cadence: "Stage- and histology-specific markers + imaging schedule",
    frequencyMonths: 6,
    detail: ["Follow the treating oncologist's marker (AFP, hCG, LDH) and imaging schedule; long-term cardiovascular, gonadal and platinum toxicity monitoring."],
    sources: ["NCCN-SITE", "COG-LTFU"],
  },
};

const GENERIC_SURVEILLANCE = {
  cadence: "Per treating oncologist / NCCN disease-site guideline",
  frequencyMonths: 6,
  detail: ["No encoded schedule for this primary site. Confirm the disease-site follow-up plan with the treating oncologist and record it in the survivorship care plan."],
  sources: ["NCCN-SITE", "ASCO-SURV"],
};

function ageOnDate(ageNow: number | undefined, onDate: string | undefined, today: Date): number | undefined {
  const d = parseDate(onDate);
  if (ageNow === undefined || !d) return undefined;
  return Math.floor(ageNow - yearsBetween(d, today));
}

const RULES: Rule[] = [
  {
    id: "care-plan-treatment-summary",
    domain: "care_coordination",
    title: "Treatment summary and survivorship care plan",
    consideration: "Document a treatment summary (diagnosis, stage, agents, cumulative doses, radiation fields) and a survivorship care plan, and share it with the patient and the primary care clinician.",
    rationale: "A written summary and plan is the basis for every exposure-driven item below and is an expected hand-off at the end of definitive treatment.",
    cadence: "Once at end of treatment; update when the plan changes",
    frequencyMonths: 0,
    sources: ["ASCO-SURV", "NCCN-SURV", "ACS-SURV"],
    match: (k) => {
      if (k.course.phase === "active_treatment" || k.course.phase === "unknown") return null;
      const gaps: string[] = [];
      if (!k.c.treatmentSummaryDocumented) gaps.push("Treatment summary not documented");
      if (!k.c.survivorshipCarePlanDocumented) gaps.push("Survivorship care plan not documented");
      return gaps.length ? { triggers: gaps, priority: "high" } : null;
    },
  },
  {
    id: "disease-surveillance",
    domain: "surveillance",
    title: "Disease-site surveillance",
    consideration: "Confirm the follow-up visit, laboratory and imaging schedule for this primary site and that each element is booked.",
    rationale: "Recurrence surveillance follows site-specific schedules; avoiding both gaps and non-indicated testing is the guideline aim.",
    cadence: "Site-specific",
    frequencyMonths: 6,
    sources: ["NCCN-SITE", "ASCO-SURV"],
    match: (k) => {
      if (k.course.phase === "active_treatment" || k.course.derivedDiseaseStatus === "progression_suspected") return null;
      const site = SITE_SURVEILLANCE[k.c.primarySite] ?? GENERIC_SURVEILLANCE;
      return { triggers: [`Primary site: ${k.c.primarySite.replace(/_/g, " ")}`, ...site.detail], priority: "high" };
    },
  },
  {
    id: "cardiac-surveillance",
    domain: "cardiac",
    title: "Cardiotoxicity risk assessment and cardiac imaging",
    consideration: "Assign a cardiac risk tier, assess blood pressure, lipids, glucose and symptoms, and consider echocardiography (or other imaging) at an interval matched to the tier.",
    rationale: "Anthracyclines, HER2-directed antibodies and chest radiation carry delayed cardiomyopathy and coronary risk that rises with cumulative dose and with hypertension, diabetes and age.",
    cadence: "High tier: echo ~12 mo after therapy then about every 2 y; intermediate: about every 5 y; always reassess with symptoms",
    frequencyMonths: 24,
    sources: ["ASCO-CARDIAC", "ESC-2022", "COG-LTFU"],
    match: (k) => {
      const tier = cardiacRiskTier(k.p, k.ctx);
      if (tier === "none") return null;
      const t: string[] = [];
      for (const e of ["anthracycline", "her2_antibody", "chest_rt"] as Exposure[]) if (k.p.exposures.has(e)) t.push(labelOf(e));
      if (k.p.anthracyclineDoxEquivMgM2 !== undefined) t.push(`Cumulative anthracycline ${k.p.anthracyclineDoxEquivMgM2} mg/m² doxorubicin-equivalent`);
      if (k.p.chestRtDoseGy !== undefined) t.push(`Chest radiation ${k.p.chestRtDoseGy} Gy`);
      t.push(`Risk tier: ${tier}`);
      const gaps: string[] = [];
      if (!k.p.anthracyclineDoseDocumented) gaps.push("Cumulative anthracycline dose");
      if (k.p.exposures.has("chest_rt") && !k.p.chestRtDoseDocumented) gaps.push("Chest radiation dose");
      const lvef = k.c.studies.filter((s) => s.kind === "cardiac" && s.lvefPercent !== undefined).sort(byDateAsc).pop();
      if (lvef) t.push(`Last LVEF ${lvef.lvefPercent}% (${lvef.date})`);
      return { triggers: t, priority: tier === "high" ? "high" : "routine", dataGaps: gaps };
    },
  },
  {
    id: "second-cancer-breast-after-chest-rt",
    domain: "second_cancer",
    title: "Breast cancer screening after chest radiation",
    consideration: "Consider annual mammography plus breast MRI starting 8 years after radiation or at age 25, whichever is later, in women irradiated to the chest between ages 10 and 30.",
    rationale: "Chest radiation at a young age carries a markedly elevated lifetime risk of breast cancer that starts earlier than average-risk screening.",
    cadence: "Yearly mammogram + MRI",
    frequencyMonths: 12,
    sources: ["NCCN-SURV", "COG-LTFU", "ACS-SURV"],
    match: (k) => {
      if (!k.female || !has(k, "chest_rt") || !k.p.chestRtStart) return null;
      const ageAtRt = ageOnDate(k.ageNow, k.p.chestRtStart, k.today);
      if (ageAtRt === undefined) return null;
      if (ageAtRt < 10 || ageAtRt > 30) return null;
      const dose = k.p.chestRtDoseGy;
      const gaps = dose === undefined ? ["Chest radiation dose (guidance applies at ≥10 Gy)"] : [];
      if (dose !== undefined && dose < 10) return null;
      return { triggers: [`Chest radiation at age ${ageAtRt}`, dose !== undefined ? `${dose} Gy` : "dose not documented"], priority: "high", dataGaps: gaps };
    },
  },
  {
    id: "second-cancer-colorectal-after-rt",
    domain: "second_cancer",
    title: "Colorectal screening after abdominal or pelvic radiation",
    consideration: "Consider colonoscopy starting 10 years after radiation or at age 35, whichever is later, then about every 5 years, when the colon was in the field at ≥30 Gy.",
    rationale: "Abdominal/pelvic radiation increases colorectal cancer risk earlier than average-risk screening begins.",
    cadence: "Colonoscopy ~q5 y",
    frequencyMonths: 60,
    sources: ["COG-LTFU", "NCCN-SURV"],
    match: (k) => {
      if (!has(k, "abdominal_pelvic_rt")) return null;
      const dose = k.p.rtDoseGyByRegion.abdominal_pelvic_rt;
      if (dose !== undefined && dose < 30) return null;
      return { triggers: ["Abdominal/pelvic radiation", dose !== undefined ? `${dose} Gy` : "dose not documented"], priority: "routine", dataGaps: dose === undefined ? ["Abdominal/pelvic radiation dose"] : [] };
    },
  },
  {
    id: "second-cancer-heme",
    domain: "second_cancer",
    title: "Therapy-related myeloid neoplasm awareness",
    consideration: "Review CBC with differential at survivorship visits and evaluate unexplained cytopenias or macrocytosis early; the risk window is roughly 2–10 years after exposure.",
    rationale: "Alkylators, topoisomerase II inhibitors, anthracyclines, PARP inhibitors and stem cell transplant carry a risk of therapy-related MDS/AML.",
    cadence: "CBC at each survivorship visit; yearly minimum",
    frequencyMonths: 12,
    sources: ["COG-LTFU", "NCCN-SURV"],
    match: (k) => {
      const hit = (["alkylator", "topoisomerase_ii", "anthracycline", "parp_inhibitor", "hsct"] as Exposure[]).filter((e) => k.p.exposures.has(e));
      return hit.length ? { triggers: hit.map(labelOf), priority: k.p.exposures.has("parp_inhibitor") || k.p.exposures.has("hsct") ? "routine" : "consider" } : null;
    },
  },
  {
    id: "second-cancer-skin-after-rt",
    domain: "second_cancer",
    title: "Skin examination in irradiated fields",
    consideration: "Examine skin within prior radiation fields yearly and counsel on sun protection.",
    rationale: "Basal and squamous cell carcinomas arise preferentially in irradiated skin years later.",
    cadence: "Yearly",
    frequencyMonths: 12,
    sources: ["COG-LTFU", "NCCN-SURV"],
    match: (k) => (has(k, "chest_rt", "neck_rt", "abdominal_pelvic_rt", "cranial_rt") ? { triggers: ["Prior radiation therapy"], priority: "consider" } : null),
  },
  {
    id: "thyroid-function",
    domain: "endocrine_bone",
    title: "Thyroid function and neck palpation",
    consideration: "Check TSH (± free T4) at least yearly and palpate the thyroid; treat overt or symptomatic hypothyroidism.",
    rationale: "Neck or upper-chest radiation causes hypothyroidism and nodules; checkpoint inhibitors cause thyroiditis that can appear after therapy ends.",
    cadence: "TSH yearly (every 6–12 mo for checkpoint inhibitors in the first years)",
    frequencyMonths: 12,
    sources: ["COG-LTFU", "ASCO-IRAE", "NCCN-SURV"],
    match: (k) => {
      const t: string[] = [];
      if (has(k, "neck_rt")) t.push(labelOf("neck_rt"));
      if (has(k, "chest_rt") && ["lymphoma", "breast", "esophageal", "lung"].includes(k.c.primarySite)) t.push("Chest/mediastinal radiation");
      if (has(k, "immune_checkpoint")) t.push(labelOf("immune_checkpoint"));
      return t.length ? { triggers: t, priority: "routine" } : null;
    },
  },
  {
    id: "irae-late-surveillance",
    domain: "endocrine_bone",
    title: "Late immune-related adverse event watch",
    consideration: "Ask about fatigue, dyspnea, diarrhea, rash and hypotension; consider glucose and morning cortisol when symptomatic, in addition to thyroid function.",
    rationale: "Immune-related adverse events, including endocrinopathies and pneumonitis, can first appear months after checkpoint inhibitor therapy ends.",
    cadence: "Each visit for 1–2 y after therapy",
    frequencyMonths: 6,
    sources: ["ASCO-IRAE"],
    match: (k) => (has(k, "immune_checkpoint") ? { triggers: [labelOf("immune_checkpoint")], priority: "routine" } : null),
  },
  {
    id: "bone-health",
    domain: "endocrine_bone",
    title: "Bone density and fracture-risk assessment",
    consideration: "Consider baseline DEXA and repeat about every 1–2 years while on therapy; review calcium and vitamin D intake, and discuss bone-modifying treatment when criteria are met.",
    rationale: "Aromatase inhibitors, androgen deprivation, oophorectomy and premature ovarian failure accelerate bone loss.",
    cadence: "DEXA baseline, then q1–2 y while on therapy",
    frequencyMonths: 24,
    sources: ["ASCO-SURV", "NCCN-SURV"],
    match: (k) => {
      const t: string[] = [];
      for (const e of ["aromatase_inhibitor", "adt", "premature_ovarian_loss"] as Exposure[]) if (k.p.exposures.has(e)) t.push(labelOf(e));
      if (k.female && has(k, "alkylator") && (k.ageAtDx ?? 99) < 45) t.push("Alkylator exposure before age 45 (ovarian insufficiency risk)");
      const dexa = k.c.studies.filter((s) => s.kind === "bone_density").sort(byDateAsc).pop();
      if (dexa?.tScore !== undefined) t.push(`Last DEXA T-score ${dexa.tScore} (${dexa.date})`);
      return t.length ? { triggers: t, priority: dexa?.tScore !== undefined && dexa.tScore <= -2 ? "high" : "routine" } : null;
    },
  },
  {
    id: "metabolic-adt",
    domain: "endocrine_bone",
    title: "Metabolic and cardiovascular monitoring on androgen deprivation",
    consideration: "Monitor weight, blood pressure, glucose/HbA1c and lipids at least yearly and address cardiovascular risk factors.",
    rationale: "Androgen deprivation worsens insulin resistance and lipid profile and is associated with cardiovascular events.",
    cadence: "Yearly",
    frequencyMonths: 12,
    sources: ["ASCO-SURV", "NCCN-SURV"],
    match: (k) => (has(k, "adt") ? { triggers: [labelOf("adt")], priority: "routine" } : null),
  },
  {
    id: "pituitary-axis",
    domain: "endocrine_bone",
    title: "Pituitary axis screening after cranial radiation",
    consideration: "Consider screening for growth hormone, thyroid, adrenal and gonadal axis deficiency, particularly after doses ≥18 Gy or with symptoms.",
    rationale: "Cranial or skull-base radiation commonly produces delayed hypopituitarism.",
    cadence: "Yearly, then as clinically indicated",
    frequencyMonths: 12,
    sources: ["COG-LTFU"],
    match: (k) => (has(k, "cranial_rt") ? { triggers: [labelOf("cranial_rt"), k.p.rtDoseGyByRegion.cranial_rt !== undefined ? `${k.p.rtDoseGyByRegion.cranial_rt} Gy` : "dose not documented"], priority: "routine" } : null),
  },
  {
    id: "neuropathy-assessment",
    domain: "neuro_sensory",
    title: "Peripheral neuropathy assessment",
    consideration: "Assess sensory and motor symptoms, falls and function at each visit. For painful neuropathy, duloxetine is the one agent with supporting evidence in the ASCO guideline; consider PT and fall-risk review.",
    rationale: "Platinum, taxane and vinca agents cause neuropathy that can persist or worsen after treatment ('coasting' with platinum).",
    cadence: "Each survivorship visit",
    frequencyMonths: 6,
    sources: ["ASCO-CIPN", "NCCN-SURV"],
    match: (k) => {
      const hit = (["platinum", "taxane", "vinca"] as Exposure[]).filter((e) => k.p.exposures.has(e));
      return hit.length ? { triggers: hit.map(labelOf), priority: "routine" } : null;
    },
  },
  {
    id: "audiology",
    domain: "neuro_sensory",
    title: "Audiology after platinum or cranial/ear radiation",
    consideration: "Consider baseline audiometry and repeat when hearing or tinnitus symptoms appear; cisplatin carries the highest risk.",
    rationale: "Platinum-related ototoxicity is typically permanent and cumulative-dose related.",
    cadence: "Baseline, then as symptomatic",
    frequencyMonths: 0,
    sources: ["COG-LTFU", "NCCN-SURV"],
    match: (k) => {
      const t: string[] = [];
      if (k.p.exposures.has("platinum")) t.push(labelOf("platinum"));
      if (has(k, "cranial_rt", "head_neck_rt")) t.push("Radiation near the ear");
      return t.length ? { triggers: t, priority: "consider" } : null;
    },
  },
  {
    id: "pulmonary-function",
    domain: "pulmonary_renal",
    title: "Pulmonary toxicity assessment",
    consideration: "Consider baseline pulmonary function tests with DLCO and review respiratory symptoms; reassess with new dyspnea or cough. Reinforce pneumococcal and influenza vaccination and tobacco avoidance.",
    rationale: "Bleomycin, busulfan/carmustine-class alkylators and chest radiation produce delayed pulmonary fibrosis and restrictive disease.",
    cadence: "Baseline, then as clinically indicated",
    frequencyMonths: 0,
    sources: ["COG-LTFU", "NCCN-SURV"],
    match: (k) => {
      const t: string[] = [];
      if (k.p.exposures.has("bleomycin")) t.push(labelOf("bleomycin"));
      if (k.p.exposures.has("chest_rt")) t.push(labelOf("chest_rt"));
      if (k.c.treatments.some((x) => /busulfan|carmustine|lomustine/i.test((x.agents ?? []).join(" ")))) t.push("Nitrosourea / busulfan");
      return t.length ? { triggers: t, priority: "consider" } : null;
    },
  },
  {
    id: "renal-function",
    domain: "pulmonary_renal",
    title: "Kidney function and blood pressure",
    consideration: "Check eGFR, urine albumin/creatinine, magnesium and blood pressure at least yearly.",
    rationale: "Platinum, ifosfamide, methotrexate, VEGF-pathway agents and nephrectomy leave long-term renal and blood-pressure risk.",
    cadence: "Yearly",
    frequencyMonths: 12,
    sources: ["COG-LTFU", "NCCN-SURV"],
    match: (k) => {
      const t: string[] = [];
      if (k.p.exposures.has("platinum")) t.push(labelOf("platinum"));
      if (k.p.exposures.has("methotrexate_or_ifosfamide")) t.push(labelOf("methotrexate_or_ifosfamide"));
      if (k.p.exposures.has("tki_or_vegf")) t.push(labelOf("tki_or_vegf"));
      if (k.c.primarySite === "kidney") t.push("Kidney primary");
      return t.length ? { triggers: t, priority: "routine" } : null;
    },
  },
  {
    id: "lymphedema",
    domain: "symptom_management",
    title: "Lymphedema surveillance",
    consideration: "Ask about arm/limb swelling and heaviness at each visit, consider baseline and serial limb measurements, and refer early to a certified lymphedema therapist when present.",
    rationale: "Axillary or pelvic node surgery and nodal radiation carry lifelong lymphedema risk; early detection improves outcomes.",
    cadence: "Each visit",
    frequencyMonths: 6,
    sources: ["NCCN-SURV", "ASCO-SURV"],
    match: (k) => (has(k, "axillary_treatment") ? { triggers: [labelOf("axillary_treatment")], priority: "consider" } : null),
  },
  {
    id: "head-neck-function",
    domain: "symptom_management",
    title: "Dental, swallowing and trismus follow-up",
    consideration: "Reinforce dental review at least every 6 months with fluoride, screen for dysphagia and trismus, and caution before dental extractions in irradiated bone.",
    rationale: "Head and neck radiation causes xerostomia, caries, osteoradionecrosis risk, swallowing and jaw problems.",
    cadence: "Dental q6 mo",
    frequencyMonths: 6,
    sources: ["NCCN-SURV", "COG-LTFU"],
    match: (k) => (has(k, "head_neck_rt") || k.c.primarySite === "head_neck" ? { triggers: ["Head and neck cancer or radiation"], priority: "routine" } : null),
  },
  {
    id: "genetics-referral",
    domain: "genetics",
    title: "Hereditary cancer risk assessment",
    consideration: "If germline testing is not on file, consider genetic counseling and testing; results can change surveillance for the patient and relatives.",
    rationale: "Selected diagnoses and ages meet NCCN criteria for germline testing (e.g., breast ≤50, triple-negative ≤60, ovarian, pancreatic, metastatic prostate, colorectal <50 or mismatch-repair deficiency).",
    cadence: "Once",
    frequencyMonths: 0,
    sources: ["NCCN-GEN"],
    match: (k) => {
      if (k.c.geneticFindings && k.c.geneticFindings.length > 0) return null;
      const reasons: string[] = [];
      const a = k.ageAtDx;
      const site = k.c.primarySite;
      if (site === "breast" && a !== undefined && a <= 50) reasons.push(`Breast cancer diagnosed at age ${a}`);
      if (site === "breast" && a !== undefined && a <= 60 && tripleNegative(k.c)) reasons.push("Triple-negative breast cancer");
      if (site === "ovarian") reasons.push("Ovarian cancer");
      if (site === "pancreatic") reasons.push("Pancreatic cancer");
      if (site === "prostate" && (k.c.status === "metastatic" || /gleason\s*(8|9|10)|grade group\s*[45]/i.test(k.c.grade ?? ""))) reasons.push("Metastatic or high-risk prostate cancer");
      if (site === "colon" && a !== undefined && a < 50) reasons.push(`Colorectal cancer diagnosed at age ${a}`);
      if ((site === "colon" || site === "uterine") && k.c.biomarkers.some((b) => /mmr|msi|mlh1|msh2|msh6|pms2/i.test(b.name) && /deficien|high|loss/i.test(b.value))) reasons.push("Mismatch-repair deficiency / MSI-high");
      return reasons.length ? { triggers: reasons, priority: "routine", dataGaps: ["No germline testing result on file"] } : null;
    },
  },
  {
    id: "psychosocial-distress",
    domain: "psychosocial",
    title: "Distress, mood, fear of recurrence and cognition",
    consideration: "Screen for distress (e.g., NCCN Distress Thermometer), depression and anxiety, fear of recurrence, sleep and cognitive complaints; offer counseling, support groups or neuropsychology referral as indicated.",
    rationale: "Psychological distress is common across the survivorship trajectory and is under-detected without structured screening.",
    cadence: "Each survivorship visit",
    frequencyMonths: 6,
    sources: ["NCCN-DISTRESS", "ASCO-SURV", "ACS-SURV"],
    match: (k) => (k.course.phase === "unknown" && k.c.status === "unknown" ? null : { triggers: ["All patients with a cancer history"], priority: "routine" }),
  },
  {
    id: "fatigue-function",
    domain: "symptom_management",
    title: "Fatigue, function and return to work or school",
    consideration: "Screen for persistent fatigue, rule out treatable contributors (anemia, thyroid, sleep, mood, deconditioning), and consider supervised exercise or rehabilitation referral.",
    rationale: "Cancer-related fatigue can persist for years; exercise has the strongest evidence of benefit.",
    cadence: "Each visit",
    frequencyMonths: 6,
    sources: ["NCCN-SURV", "ASCO-SURV"],
    match: (k) => (k.course.phase === "active_treatment" ? null : { triggers: ["Survivorship phase"], priority: "consider" }),
  },
  {
    id: "sexual-reproductive-health",
    domain: "reproductive_sexual",
    title: "Sexual health, menopausal symptoms and fertility",
    consideration: "Ask about sexual function, vasomotor and genitourinary symptoms, and family planning. Prefer non-hormonal options for vasomotor symptoms in hormone-receptor-positive disease and coordinate any systemic hormone use with oncology; discuss contraception and the timing of pregnancy where relevant.",
    rationale: "Endocrine therapy, ADT, pelvic surgery/radiation and gonadotoxic chemotherapy commonly affect sexual function and fertility, and these concerns are seldom volunteered.",
    cadence: "Yearly",
    frequencyMonths: 12,
    sources: ["NCCN-SURV", "ASCO-SURV", "ACS-SURV"],
    match: (k) => {
      const t: string[] = [];
      if (has(k, "aromatase_inhibitor", "tamoxifen", "adt", "premature_ovarian_loss")) t.push("Endocrine / ablative therapy");
      if (has(k, "alkylator") || has(k, "abdominal_pelvic_rt")) t.push("Gonadotoxic exposure");
      if (k.ageAtDx !== undefined && k.ageAtDx < 45) t.push(`Diagnosed at age ${k.ageAtDx} (reproductive years)`);
      if (["prostate", "cervical", "uterine", "ovarian", "testicular", "bladder"].includes(k.c.primarySite)) t.push("Pelvic / genitourinary primary");
      return t.length ? { triggers: t, priority: "consider" } : null;
    },
  },
  {
    id: "endocrine-therapy-adherence",
    domain: "symptom_management",
    title: "Adjuvant endocrine therapy adherence and side effects",
    consideration: "Review adherence, arthralgia, hot flashes and mood at each visit and address side effects early to prevent premature discontinuation.",
    rationale: "Non-adherence to adjuvant endocrine therapy is common in years 2–5 and is associated with worse outcomes.",
    cadence: "Each visit while on therapy",
    frequencyMonths: 6,
    sources: ["ASCO-SURV"],
    match: (k) => {
      const ongoing = k.c.treatments.filter((t) => t.ongoing && (t.modality === "hormone_therapy" || has(k, "aromatase_inhibitor", "tamoxifen")));
      if (!ongoing.length || k.c.primarySite !== "breast") return null;
      if (!hormoneReceptorPositive(k.c)) return null;
      return { triggers: ongoing.map((t) => `${t.title} ongoing`), priority: "routine" };
    },
  },
  {
    id: "lifestyle-activity-weight",
    domain: "lifestyle",
    title: "Physical activity, weight, diet and alcohol",
    consideration: "Counsel on 150–300 minutes of moderate activity weekly plus 2 days of strength training, a healthy weight, a plant-forward diet and minimal alcohol; offer referral to a cancer exercise program or dietitian.",
    rationale: "Physical activity, weight control and diet are associated with lower recurrence and mortality for several cancers and with better quality of life.",
    cadence: "Each visit",
    frequencyMonths: 12,
    sources: ["ACS-NPA", "ACS-SURV"],
    match: (k) => (k.course.phase === "active_treatment" ? null : { triggers: ["Survivorship phase"], priority: "consider" }),
  },
  {
    id: "tobacco-cessation",
    domain: "lifestyle",
    title: "Tobacco cessation",
    consideration: "Offer cessation counseling and pharmacotherapy at every visit.",
    rationale: "Continued smoking increases recurrence, second primary cancers, treatment toxicity and cardiovascular death.",
    cadence: "Each visit",
    frequencyMonths: 3,
    sources: ["NCCN-SURV", "ASCO-SURV"],
    match: (k) => (k.ctx.smokingStatus === "current" ? { triggers: ["Current smoker"], priority: "high" } : null),
  },
  {
    id: "immunization",
    domain: "immunization",
    title: "Immunizations after cancer therapy",
    consideration: "Review inactivated influenza (yearly), COVID-19, pneumococcal conjugate and recombinant zoster vaccination. Defer live vaccines until immune reconstitution and coordinate with oncology after transplant or ongoing immunosuppression.",
    rationale: "Cancer survivors have higher infectious morbidity; post-chemotherapy, splenectomy and transplant patients need specific schedules.",
    cadence: "Yearly review",
    frequencyMonths: 12,
    sources: ["ACIP", "ASTCT", "NCCN-SURV"],
    match: (k) => (k.course.phase === "active_treatment" ? null : { triggers: has(k, "hsct", "splenectomy") ? [has(k, "hsct") ? labelOf("hsct") : labelOf("splenectomy")] : ["Post-treatment survivor"], priority: has(k, "hsct", "splenectomy") ? "routine" : "consider" }),
  },
  {
    id: "hct-long-term-followup",
    domain: "care_coordination",
    title: "Long-term follow-up after stem cell transplant",
    consideration: "Use a transplant late-effects checklist: chronic GVHD (if allogeneic), ocular, oral and dental, endocrine, bone, cardiovascular, renal and skin review, plus second-cancer screening.",
    rationale: "Transplant survivors carry cumulative multi-organ risk and need structured, lifelong screening.",
    cadence: "Yearly",
    frequencyMonths: 12,
    sources: ["ASTCT", "COG-LTFU"],
    match: (k) => (has(k, "hsct") ? { triggers: [labelOf("hsct"), k.c.treatments.some((t) => t.allogeneicTransplant) ? "Allogeneic" : "Transplant type not specified"], priority: "high" } : null),
  },
  {
    id: "general-preventive-care",
    domain: "care_coordination",
    title: "General preventive care and cardiovascular risk",
    consideration: "Keep age-appropriate screening and cardiovascular risk management current with primary care; see the Longevity & Prevention tab for the age-adjusted plan.",
    rationale: "Cardiovascular disease and second cancers are leading causes of late morbidity in survivors, and primary-care screening often lapses after oncology care.",
    cadence: "Yearly",
    frequencyMonths: 12,
    sources: ["ACS-SURV", "NCCN-SURV"],
    match: (k) => (k.course.phase === "active_treatment" ? null : { triggers: ["Survivorship phase"], priority: "consider" }),
  },
];

function dueState(frequencyMonths: number, lastISO: string | undefined, today: Date): DueState {
  if (!lastISO) return "no_record";
  const last = parseDate(lastISO);
  if (!last || frequencyMonths <= 0) return lastISO ? "upcoming" : "no_record";
  const elapsed = monthsBetween(last, today);
  if (elapsed > frequencyMonths * 1.25) return "overdue";
  if (elapsed >= frequencyMonths * 0.85) return "due";
  return "upcoming";
}

const PRIORITY_ORDER: Record<SuggestionPriority, number> = { high: 0, routine: 1, consider: 2 };
const DUE_ORDER: Record<DueState, number> = { overdue: 0, due: 1, no_record: 2, upcoming: 3 };

export interface SuggestionSet {
  version: string;
  generatedFor: "clinician";
  scope: "survivorship" | "limited_active_disease";
  scopeNote?: string;
  suggestions: SurvivorshipSuggestion[];
  counts: { total: number; high: number; overdue: number };
  disclaimer: string;
}

export const CLINICIAN_DISCLAIMER =
  "Guideline-derived considerations for clinician review only. Not shown to patients, not orders, and not a substitute for clinical judgment or the treating oncologist's plan. Confirm each item against the current edition of the cited guideline.";

export function buildSurvivorshipSuggestions(c: OncologyCase, ctx: SurvivorContext = {}): SuggestionSet {
  const today = ctx.today ?? new Date();
  const course = buildOncologyCourse(c, { today });
  const p = deriveExposures(c);
  const ageNow = ctx.age;
  const input: RuleInput = {
    c,
    ctx,
    p,
    course,
    today,
    ageNow,
    ageAtDx: ageOnDate(ageNow, c.diagnosisDate, today),
    female: ctx.sex === "female",
    male: ctx.sex === "male",
  };

  const limited = course.phase === "active_treatment" || course.derivedDiseaseStatus === "progression_suspected";
  const suggestions: SurvivorshipSuggestion[] = [];

  for (const rule of RULES) {
    const hit = rule.match(input);
    if (!hit) continue;
    const completed = ctx.completions?.[rule.id];
    const siteDef = rule.id === "disease-surveillance" ? SITE_SURVEILLANCE[c.primarySite] ?? GENERIC_SURVEILLANCE : undefined;
    const frequencyMonths = siteDef?.frequencyMonths ?? rule.frequencyMonths;
    suggestions.push({
      id: rule.id,
      domain: rule.domain,
      title: rule.title,
      consideration: rule.consideration,
      rationale: rule.rationale,
      triggers: hit.triggers,
      cadence: siteDef?.cadence ?? rule.cadence,
      frequencyMonths,
      priority: hit.priority ?? "routine",
      dueState: dueState(frequencyMonths, completed, today),
      lastCompleted: completed,
      sources: (siteDef?.sources ?? rule.sources).map((s) => PROTOCOL_SOURCES[s] ?? s),
      dataGaps: hit.dataGaps ?? [],
    });
  }

  suggestions.sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      DUE_ORDER[a.dueState] - DUE_ORDER[b.dueState] ||
      a.title.localeCompare(b.title),
  );

  const visible = limited
    ? suggestions.filter((s) => s.id !== "disease-surveillance" && s.id !== "care-plan-treatment-summary")
    : suggestions;

  return {
    version: ONCOLOGY_SURVIVORSHIP_VERSION,
    generatedFor: "clinician",
    scope: limited ? "limited_active_disease" : "survivorship",
    scopeNote: limited
      ? "Active treatment, recurrent/metastatic disease or a progression read is present. Surveillance schedules are intended for patients after curative-intent treatment; items shown are supportive and late-effect considerations. The treating oncologist directs disease-directed follow-up."
      : undefined,
    suggestions: visible,
    counts: {
      total: visible.length,
      high: visible.filter((s) => s.priority === "high").length,
      overdue: visible.filter((s) => s.dueState === "overdue").length,
    },
    disclaimer: CLINICIAN_DISCLAIMER,
  };
}

// ─── Clinician decisions + export ────────────────────────────────────────────

export type DecisionStatus = "pending" | "accepted" | "deferred" | "dismissed" | "completed";

export interface SuggestionDecision {
  suggestionId: string;
  status: DecisionStatus;
  /** Free text reason. Must stay PHI-free in logs; stored with the chart decision only. */
  note?: string;
  decidedBy: string;
  decidedAt: string;
  /** ISO date to resurface a deferred item. */
  revisitOn?: string;
}

export function summarizeForClinician(course: OncologyCourse, set: SuggestionSet, decisions: Record<string, SuggestionDecision> = {}): string {
  const lines: string[] = [];
  lines.push(`ONCOLOGY COURSE — ${course.headline}`);
  const p = course.pathology;
  const path = [
    p.histology && `Histology: ${p.histology}`,
    p.grade && `Grade: ${p.grade}`,
    p.tnm && `TNM: ${p.tnm}`,
    p.margins && `Margins: ${p.margins}`,
    p.nodes && `Nodes: ${p.nodes}`,
  ].filter(Boolean);
  if (path.length) lines.push(`Pathology: ${path.join("; ")}`);
  if (p.biomarkers.length) lines.push(`Biomarkers: ${p.biomarkers.map((b) => `${b.name} ${b.value}`).join("; ")}`);
  if (course.treatmentSummary.length) {
    lines.push("Treatment:");
    for (const t of course.treatmentSummary) lines.push(`  - ${t}`);
  }
  if (course.latestImaging) lines.push(`Latest imaging: ${course.latestImaging.date} ${course.latestImaging.title}${course.latestImaging.impression ? ` — ${course.latestImaging.impression}` : ""}`);
  if (course.alerts.length) {
    lines.push("Alerts:");
    for (const a of course.alerts) lines.push(`  - [${a.severity}] ${a.message}`);
  }
  if (course.dataGaps.length) lines.push(`Data gaps: ${course.dataGaps.join(" ")}`);
  lines.push("");
  lines.push(`SURVIVORSHIP CONSIDERATIONS FOR CLINICIAN REVIEW (protocol ${set.version})`);
  for (const s of set.suggestions) {
    const d = decisions[s.id];
    const status = d && d.status !== "pending" ? ` [${d.status}]` : "";
    lines.push(`- (${s.priority}${s.dueState === "overdue" ? ", overdue" : ""}) ${s.title}${status}: ${s.consideration} Cadence: ${s.cadence}.`);
  }
  lines.push("");
  lines.push(set.disclaimer);
  return lines.join("\n");
}

// ─── Adapter: existing Cancer Track records -> OncologyCase ──────────────────

/** Structural subsets of the Cancer Track records, so this module stays schema-free. */
export interface CancerTrackBasicsLike {
  cancerType: string;
  subtype?: string;
  stage?: string;
  diagnosisDate: string;
  biomarkers?: { name: string; value: string; status: BiomarkerResult["status"]; testedAt?: string }[];
  inRemission?: boolean;
  remissionDate?: string;
  isActive?: boolean;
}

export interface CancerTrackTimelineLike {
  id: string;
  treatmentType: string;
  title: string;
  startDate: string;
  endDate?: string;
  isOngoing?: boolean;
  details?: {
    drugs?: string[];
    radiationSite?: string;
    radiationDose?: string;
    radiationFractions?: number;
    surgeryType?: string;
    outcome?: string;
  };
}

export interface CancerTrackDocumentLike {
  id: string;
  folderType: string;
  title: string;
  documentDate: string;
  summary?: string;
}

const TREATMENT_MODALITY: Record<string, TreatmentModality | undefined> = {
  surgery: "surgery",
  chemotherapy: "chemotherapy",
  radiation: "radiation",
  immunotherapy: "immunotherapy",
  hormone_therapy: "hormone_therapy",
  targeted_therapy: "targeted_therapy",
  stem_cell_transplant: "stem_cell_transplant",
  bone_marrow_transplant: "stem_cell_transplant",
  clinical_trial: "clinical_trial",
};

function studyKindFromFolder(folder: string): { kind: StudyKind; modality?: string } | undefined {
  if (/pathology|biopsy/.test(folder)) return { kind: "pathology" };
  if (/molecular|biomarker/.test(folder)) return { kind: "molecular" };
  if (/tumor_markers/.test(folder)) return { kind: "tumor_marker" };
  if (/imaging_pet/.test(folder)) return { kind: "imaging", modality: "PET/CT" };
  if (/imaging_ct/.test(folder)) return { kind: "imaging", modality: "CT" };
  if (/imaging_mri/.test(folder)) return { kind: "imaging", modality: "MRI" };
  if (/imaging_ultrasound/.test(folder)) return { kind: "imaging", modality: "Ultrasound" };
  if (/imaging/.test(folder)) return { kind: "imaging" };
  return undefined;
}

export function oncologyCaseFromCancerTrack(
  basics: CancerTrackBasicsLike,
  timeline: CancerTrackTimelineLike[],
  documents: CancerTrackDocumentLike[],
  extras: { studies?: OncologyStudy[]; geneticFindings?: GeneticFinding[]; treatmentSummaryDocumented?: boolean; survivorshipCarePlanDocumented?: boolean } = {},
): OncologyCase {
  const treatments: OncologyTreatment[] = [];
  for (const t of timeline) {
    const modality = TREATMENT_MODALITY[t.treatmentType];
    if (!modality) continue;
    const doseGy = parseDoseGy(t.details?.radiationDose);
    treatments.push({
      id: t.id,
      modality,
      title: t.title,
      start: t.startDate,
      end: t.endDate,
      ongoing: t.isOngoing,
      agents: t.details?.drugs,
      radiation: modality === "radiation" ? { site: t.details?.radiationSite ?? "", doseGy, fractions: t.details?.radiationFractions } : undefined,
      surgery: modality === "surgery" ? { procedure: t.details?.surgeryType ?? t.title, axillaryDissection: /axillary (lymph node )?dissection|alnd|modified radical mastectomy/i.test(`${t.details?.surgeryType ?? ""} ${t.title}`), oophorectomy: /oophorectomy|salpingo/i.test(`${t.details?.surgeryType ?? ""} ${t.title}`), splenectomy: /splenectomy/i.test(`${t.details?.surgeryType ?? ""} ${t.title}`) } : undefined,
      outcome: t.details?.outcome,
    });
  }

  const studies: OncologyStudy[] = [];
  for (const d of documents) {
    const mapped = studyKindFromFolder(d.folderType);
    if (!mapped) continue;
    studies.push({ id: d.id, kind: mapped.kind, modality: mapped.modality, date: d.documentDate, title: d.title, impression: d.summary, documentId: d.id });
  }
  studies.push(...(extras.studies ?? []));

  const status: CaseStatus = basics.inRemission ? "remission" : basics.isActive === false ? "surveillance" : "unknown";

  return {
    primarySite: basics.cancerType,
    histology: basics.subtype,
    stage: basics.stage,
    diagnosisDate: basics.diagnosisDate,
    status,
    remissionDate: basics.remissionDate,
    biomarkers: (basics.biomarkers ?? []).map((b) => ({ name: b.name, value: b.value, status: b.status, testedAt: b.testedAt })),
    geneticFindings: extras.geneticFindings,
    studies,
    treatments,
    treatmentSummaryDocumented: extras.treatmentSummaryDocumented ?? documents.some((d) => d.folderType === "survivorship" || d.folderType === "survivorship_care_plan" ? /treatment summary/i.test(d.title) : false),
    survivorshipCarePlanDocumented: extras.survivorshipCarePlanDocumented ?? documents.some((d) => d.folderType === "survivorship_care_plan"),
  };
}

/** Study kinds for chart lab rows that are tumor markers. */
const TUMOR_MARKER_NAMES = /\b(psa|cea|ca[- ]?125|ca[- ]?19[- ]?9|ca[- ]?15[- ]?3|ca[- ]?27[- ]?29|afp|hcg|β-?hcg|ldh|thyroglobulin|m[- ]?protein|calcitonin)\b/i;

export interface ChartLabLike {
  id: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  collectionDate: string;
}

/** Turn chart lab rows that are tumor markers into studies so they join the trend view. */
export function tumorMarkerStudiesFromLabs(labs: ChartLabLike[]): OncologyStudy[] {
  const out: OncologyStudy[] = [];
  for (const l of labs) {
    if (!TUMOR_MARKER_NAMES.test(l.testName)) continue;
    const value = Number.parseFloat(l.value);
    if (!Number.isFinite(value)) continue;
    const hi = /(?:<|-|to)\s*(\d+(?:\.\d+)?)/i.exec(l.referenceRange ?? "");
    out.push({
      id: `lab-${l.id}`,
      kind: "tumor_marker",
      date: l.collectionDate.slice(0, 10),
      title: l.testName,
      marker: { name: l.testName.replace(/\s*\(.*\)\s*$/, "").trim(), value, unit: l.unit, refHigh: hi ? Number(hi[1]) : undefined },
    });
  }
  return out;
}
