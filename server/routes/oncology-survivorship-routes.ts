/**
 * Oncology course + survivorship suggestions API — /api/oncology-survivorship
 *
 * Provider-facing only: the mount in routes.ts requires an authenticated
 * admin / provider / clinician. Suggestions are guideline-derived, computed by
 * the portable module in shared/oncology-survivorship.ts, and are never sent to
 * the patient PHR. The same endpoints serve the Tabula Medica EHR chart and the
 * World outpatient EHR mirror.
 *
 * AI boundary: /refine goes through the Vertex AI gateway (Google BAA) only.
 * The prompt carries structured, relative-time facts (no names, dates of birth,
 * identifiers or free-text report bodies). The model may re-rank, annotate and
 * ask clarifying questions about the deterministic candidates; it cannot add
 * new recommendations, and any id outside the candidate set is discarded.
 *
 * Clinician decisions (accept / defer / dismiss / completed) are kept in a
 * session-lifetime store behind the DecisionStore interface — the same tier as
 * the other chart-tool routers. Swap the implementation for the encrypted PHI
 * store when this graduates; callers do not change.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { boundedArray } from "../lib/zod-helpers";
import {
  CLINICIAN_DISCLAIMER,
  ONCOLOGY_SURVIVORSHIP_VERSION,
  PROTOCOL_SOURCES,
  buildOncologyCourse,
  buildSurvivorshipSuggestions,
  summarizeForClinician,
  type OncologyCase,
  type SuggestionDecision,
  type SuggestionPriority,
  type SurvivorContext,
  type SurvivorshipSuggestion,
} from "@shared/oncology-survivorship";
import { generatePhiSafeText } from "../services/ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";
import { logger } from "../lib/logger";
import { noStorePhi } from "../lib/middleware/no-store-phi";

const router = Router();
router.use(noStorePhi);

// ─── Validation ──────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, "ISO date required");
const short = z.string().trim().min(1).max(200);
const text = z.string().trim().max(2000);

const studySchema = z.object({
  id: z.string().max(100),
  kind: z.enum(["pathology", "imaging", "molecular", "tumor_marker", "cardiac", "bone_density", "audiology", "other"]),
  date: isoDate,
  title: short,
  modality: z.string().max(60).optional(),
  site: z.string().max(100).optional(),
  impression: text.optional(),
  response: z.enum(["ned", "response", "stable", "indeterminate", "new_finding", "progression"]).optional(),
  pathology: z
    .object({
      specimen: z.string().max(100).optional(),
      histology: z.string().max(200).optional(),
      grade: z.string().max(100).optional(),
      margins: z.enum(["negative", "close", "positive", "unknown"]).optional(),
      nodesPositive: z.number().int().min(0).max(200).optional(),
      nodesExamined: z.number().int().min(0).max(200).optional(),
      lymphovascularInvasion: z.boolean().optional(),
      tumorSizeMm: z.number().min(0).max(1000).optional(),
      pathologicStage: z.string().max(50).optional(),
    })
    .optional(),
  marker: z
    .object({ name: short, value: z.number().finite(), unit: z.string().max(30).optional(), refHigh: z.number().finite().optional() })
    .optional(),
  lvefPercent: z.number().min(5).max(90).optional(),
  tScore: z.number().min(-8).max(6).optional(),
  documentId: z.string().max(100).optional(),
});

const treatmentSchema = z.object({
  id: z.string().max(100),
  modality: z.enum(["surgery", "chemotherapy", "radiation", "immunotherapy", "targeted_therapy", "hormone_therapy", "stem_cell_transplant", "clinical_trial", "other"]),
  title: short,
  start: isoDate,
  end: isoDate.optional(),
  ongoing: z.boolean().optional(),
  intent: z.enum(["curative", "adjuvant", "neoadjuvant", "palliative", "maintenance"]).optional(),
  agents: boundedArray(z.string().max(100), 30).optional(),
  cumulativeDoseMgM2: boundedArray(z.object({ agent: z.string().max(100), dose: z.number().min(0).max(5000) }), 10).optional(),
  radiation: z.object({ site: z.string().max(200), doseGy: z.number().min(0).max(120).optional(), fractions: z.number().int().min(1).max(100).optional() }).optional(),
  surgery: z
    .object({ procedure: z.string().max(200), axillaryDissection: z.boolean().optional(), oophorectomy: z.boolean().optional(), splenectomy: z.boolean().optional() })
    .optional(),
  allogeneicTransplant: z.boolean().optional(),
  outcome: z.string().max(300).optional(),
  exposureOnly: z.boolean().optional(),
});

const caseSchema = z.object({
  primarySite: z.string().trim().min(1).max(60),
  histology: z.string().max(200).optional(),
  grade: z.string().max(100).optional(),
  stage: z.string().max(30).optional(),
  tnm: z.object({ t: z.string().max(10).optional(), n: z.string().max(10).optional(), m: z.string().max(10).optional(), basis: z.enum(["clinical", "pathologic"]).optional() }).optional(),
  diagnosisDate: isoDate,
  status: z.enum(["active_treatment", "surveillance", "remission", "recurrent", "metastatic", "unknown"]),
  remissionDate: isoDate.optional(),
  biomarkers: boundedArray(z.object({ name: short, value: z.string().max(200), status: z.enum(["positive", "negative", "equivocal", "unknown"]), testedAt: z.string().max(30).optional() }), 100),
  geneticFindings: boundedArray(z.object({ gene: z.string().max(30), result: z.enum(["pathogenic", "likely_pathogenic", "vus", "negative"]) }), 100).optional(),
  studies: boundedArray(studySchema, 500),
  treatments: boundedArray(treatmentSchema, 200),
  treatmentSummaryDocumented: z.boolean().optional(),
  survivorshipCarePlanDocumented: z.boolean().optional(),
});

const contextSchema = z.object({
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["male", "female"]).optional(),
  region: z.enum(["us", "international"]).optional(),
  smokingStatus: z.enum(["never", "former", "current"]).optional(),
  hasHypertension: z.boolean().optional(),
  hasDiabetes: z.boolean().optional(),
  hasCardiovascularDisease: z.boolean().optional(),
  completions: z.record(z.string().max(80), isoDate).optional(),
});

const analyzeSchema = z.object({ case: caseSchema, context: contextSchema.default({}) });

const patientIdSchema = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);

const decisionBody = z.object({
  status: z.enum(["pending", "accepted", "deferred", "dismissed", "completed"]),
  note: z.string().trim().max(500).optional(),
  revisitOn: isoDate.optional(),
});

// ─── Decision store (swap for the PHI store when this graduates) ─────────────

interface DecisionStore {
  list(patientId: string): Record<string, SuggestionDecision>;
  put(patientId: string, decision: SuggestionDecision): void;
}

const memory = new Map<string, Map<string, SuggestionDecision>>();
const decisionStore: DecisionStore = {
  list(patientId) {
    return Object.fromEntries(memory.get(patientId) ?? []);
  },
  put(patientId, decision) {
    const bucket = memory.get(patientId) ?? new Map<string, SuggestionDecision>();
    bucket.set(decision.suggestionId, decision);
    memory.set(patientId, bucket);
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actorId(req: Request): string | undefined {
  return (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub;
}

function audit(req: Request, patientId: string | undefined, action: "read" | "write" | "export", details: string): void {
  const uid = actorId(req);
  if (!uid) return;
  void logPhiAccess({ userId: uid, patientId, resourceType: "OncologySurvivorship", action, details });
}

function toContext(c: z.infer<typeof contextSchema>): SurvivorContext {
  return { ...c };
}

const PRIORITY_RANK: Record<SuggestionPriority, number> = { high: 0, routine: 1, consider: 2 };
const PRIORITY_BY_RANK: SuggestionPriority[] = ["high", "routine", "consider"];

// ─── Routes ──────────────────────────────────────────────────────────────────

/** Static protocol metadata — no PHI. */
router.get("/protocol", (_req: Request, res: Response) => {
  res.json({ version: ONCOLOGY_SURVIVORSHIP_VERSION, sources: PROTOCOL_SOURCES, disclaimer: CLINICIAN_DISCLAIMER, audience: "clinician" });
});

/** Aggregated course + suggestions for a case assembled by the caller. */
router.post("/analyze", (req: Request, res: Response) => {
  const parsed = analyzeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid oncology case", details: parsed.error.flatten() });
  const patientId = typeof req.query.patientId === "string" && patientIdSchema.safeParse(req.query.patientId).success ? req.query.patientId : undefined;

  const oncologyCase = parsed.data.case as OncologyCase;
  const context = toContext(parsed.data.context);
  const course = buildOncologyCourse(oncologyCase);
  const set = buildSurvivorshipSuggestions(oncologyCase, context);
  const decisions = patientId ? decisionStore.list(patientId) : {};
  audit(req, patientId, "read", `Oncology course built (${set.counts.total} considerations)`);
  res.json({ course, suggestions: set, decisions, clinicianSummary: summarizeForClinician(course, set, decisions) });
});

const refineOutput = z.object({
  courseNarrative: z.string().max(1500).optional(),
  items: z
    .array(
      z.object({
        id: z.string().max(80),
        adjustedPriority: z.enum(["high", "routine", "consider"]).optional(),
        patientSpecificRationale: z.string().max(500).optional(),
        dataToConfirm: z.array(z.string().max(200)).max(4).optional(),
      }),
    )
    .max(60),
  clarifyingQuestions: z.array(z.string().max(250)).max(5).optional(),
});

interface RefinedItem {
  id: string;
  patientSpecificRationale?: string;
  dataToConfirm: string[];
  priorityBefore: SuggestionPriority;
  priorityAfter: SuggestionPriority;
}

/** Relative-time digest: no names, DOB, identifiers, calendar dates or report text go to the model. */
function buildRefinePrompt(c: OncologyCase, ctx: SurvivorContext, candidates: SurvivorshipSuggestion[]): string {
  const course = buildOncologyCourse(c);
  const today = new Date();
  const monthsAgo = (iso: string) => Math.max(0, Math.round((today.getTime() - new Date(iso).getTime()) / (86_400_000 * 30.4375)));
  const digest = {
    age: ctx.age,
    sex: ctx.sex,
    primarySite: c.primarySite,
    histology: course.pathology.histology,
    grade: course.pathology.grade,
    stage: course.pathology.stage,
    tnm: course.pathology.tnm,
    status: c.status,
    phase: course.phase,
    yearsSinceDiagnosis: course.yearsSinceDiagnosis,
    yearsSinceDefinitiveTreatment: course.yearsSinceDefinitiveTreatment,
    derivedDiseaseStatus: course.derivedDiseaseStatus,
    exposures: course.exposureLabels,
    biomarkers: c.biomarkers.map((b) => ({ name: b.name, value: b.value, status: b.status })),
    genetics: c.geneticFindings,
    markerTrends: course.markerTrends.map((m) => ({ name: m.name, latest: m.latest, previous: m.previous, changePercent: m.changePercent, direction: m.direction, aboveUln: m.aboveUln })),
    recentStudies: [...c.studies]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12)
      .map((s) => ({ kind: s.kind, modality: s.modality, monthsAgo: monthsAgo(s.date), response: s.response, lvefPercent: s.lvefPercent, tScore: s.tScore })),
    comorbidities: { hypertension: ctx.hasHypertension, diabetes: ctx.hasDiabetes, cvd: ctx.hasCardiovascularDisease, smoking: ctx.smokingStatus },
    alerts: course.alerts.map((a) => `${a.severity}: ${a.message}`),
    dataGaps: course.dataGaps,
  };
  const items = candidates.map((s) => ({ id: s.id, title: s.title, priority: s.priority, dueState: s.dueState, triggers: s.triggers.slice(0, 6), dataGaps: s.dataGaps }));
  return [
    "CASE DIGEST (structured, relative times):",
    JSON.stringify(digest),
    "",
    "CANDIDATE CONSIDERATIONS (guideline-derived; ids are fixed):",
    JSON.stringify(items),
    "",
    "Return JSON only, matching exactly:",
    '{"courseNarrative": string (<=900 chars, factual synthesis of pathology, treatment and disease course for a clinician),',
    ' "items": [{"id": string from the candidate list, "adjustedPriority": "high"|"routine"|"consider" (optional; at most one step from the current value),',
    '            "patientSpecificRationale": string (<=350 chars, why this patient\'s documented facts make the item more or less pressing),',
    '            "dataToConfirm": string[] (<=4 short items the clinician should verify before acting)}],',
    ' "clarifyingQuestions": string[] (<=5 questions about missing or inconsistent chart data)}',
  ].join("\n");
}

const REFINE_SYSTEM =
  "You assist a licensed clinician reviewing a cancer survivor's chart. You do NOT create new recommendations: you only " +
  "(a) summarise the documented course, (b) annotate and re-rank the candidate considerations you are given, using only ids " +
  "from the list, and (c) ask clarifying questions about missing or inconsistent data. Never invent findings, doses or dates. " +
  "If a fact is not in the digest, say it is not documented. Output valid JSON only.";

/** Vertex-backed refinement of the deterministic candidates. Falls back cleanly on any failure. */
router.post("/refine", async (req: Request, res: Response) => {
  const parsed = analyzeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid oncology case", details: parsed.error.flatten() });

  const oncologyCase = parsed.data.case as OncologyCase;
  const context = toContext(parsed.data.context);
  const set = buildSurvivorshipSuggestions(oncologyCase, context);
  const base = { suggestions: set, aiRefined: false as const };

  if (!set.suggestions.length) return res.json({ ...base, refinements: [], clarifyingQuestions: [] });

  try {
    const raw = await generatePhiSafeText({
      purpose: "oncology-survivorship-refine",
      system: REFINE_SYSTEM,
      user: buildRefinePrompt(oncologyCase, context, set.suggestions),
      responseMimeType: "application/json",
      maxTokens: 2500,
      temperature: 0.1,
    });
    const out = refineOutput.safeParse(JSON.parse(raw));
    if (!out.success) throw new Error("model output failed schema validation");

    const byId = new Map(set.suggestions.map((s) => [s.id, s]));
    const refinements: RefinedItem[] = [];
    for (const item of out.data.items) {
      const s = byId.get(item.id);
      if (!s) continue; // never accept an id outside the deterministic candidate set
      const before = PRIORITY_RANK[s.priority];
      let after = before;
      if (item.adjustedPriority) {
        const wanted = PRIORITY_RANK[item.adjustedPriority];
        after = Math.min(before + 1, Math.max(before - 1, wanted)); // at most one step
        // Rule-assigned "high" never drops below "routine" and "consider" never jumps to "high".
        if (s.priority === "high") after = Math.min(after, 1);
      }
      refinements.push({
        id: s.id,
        patientSpecificRationale: item.patientSpecificRationale,
        dataToConfirm: item.dataToConfirm ?? [],
        priorityBefore: s.priority,
        priorityAfter: PRIORITY_BY_RANK[after],
      });
    }

    audit(req, undefined, "read", `Oncology survivorship refinement (${refinements.length} items annotated)`);
    return res.json({
      ...base,
      aiRefined: true,
      courseNarrative: out.data.courseNarrative,
      refinements,
      clarifyingQuestions: out.data.clarifyingQuestions ?? [],
      aiDisclosure: "AI-assisted annotation of guideline-derived candidates (Vertex AI, Google BAA). Review every item before acting.",
    });
  } catch (err) {
    // PHI-free: log the failure class only.
    logger.warn({ component: "OncologySurvivorship", errName: (err as Error)?.name }, "ai refinement unavailable; returning deterministic list");
    return res.json({ ...base, refinements: [], clarifyingQuestions: [], aiUnavailable: true });
  }
});

/** Read the clinician's decisions for a patient. */
router.get("/patients/:patientId/decisions", (req: Request, res: Response) => {
  const id = patientIdSchema.safeParse(req.params.patientId);
  if (!id.success) return res.status(400).json({ error: "Invalid patient id" });
  audit(req, id.data, "read", "Oncology survivorship decisions read");
  res.json({ decisions: decisionStore.list(id.data) });
});

/** Record a clinician decision on one suggestion. */
router.put("/patients/:patientId/decisions/:suggestionId", (req: Request, res: Response) => {
  const id = patientIdSchema.safeParse(req.params.patientId);
  const sid = z.string().regex(/^[a-z0-9-]{1,80}$/).safeParse(req.params.suggestionId);
  if (!id.success || !sid.success) return res.status(400).json({ error: "Invalid id" });
  const body = decisionBody.safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "Invalid decision", details: body.error.flatten() });
  const uid = actorId(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const decision: SuggestionDecision = {
    suggestionId: sid.data,
    status: body.data.status,
    note: body.data.note,
    revisitOn: body.data.revisitOn,
    decidedBy: uid,
    decidedAt: new Date().toISOString(),
  };
  decisionStore.put(id.data, decision);
  audit(req, id.data, "write", `Survivorship consideration ${body.data.status}`);
  res.json({ decision });
});

export default router;
