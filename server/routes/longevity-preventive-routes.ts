/**
 * Longevity & Preventive Health API — /api/longevity-preventive
 *
 * Thin, PHI-light surface over the shared protocol module. The plan is
 * computed from an anonymous profile (age, sex, risk flags) so the same
 * endpoints serve the PHR (patient), the clinician chart, the mobile app, and
 * the WorldEHR mirror. Per-user tracking (completions + biomarker values) is
 * kept in memory, the same pattern as the other patient-tool routers; move it
 * to the encrypted PHI store when it graduates from the tools tier.
 *
 * Educational only: nothing here orders, prescribes or alerts. See the shared
 * module header for the guideline provenance.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  ADULT_VACCINES,
  BIOMARKER_TARGETS,
  FUNCTIONAL_MARKERS,
  LIFESTYLE_PILLARS,
  LONGEVITY_PROTOCOL_VERSION,
  PREVENTIVE_SCREENINGS,
  PROTOCOL_SOURCES,
  assessBiomarker,
  buildLongevityPlan,
  summarizePlanForClinician,
  type GuidelineRegion,
  type LongevityProfile,
} from "@shared/longevity-preventive";
import { isAuthenticated } from "../replit_integrations/auth";
import { logPhiAccess } from "../security/hipaa-audit";

const router = Router();

const profileSchema = z.object({
  age: z.coerce.number().int().min(18).max(120),
  sex: z.enum(["male", "female"]),
  smokingStatus: z.enum(["never", "former", "current"]).optional(),
  packYears: z.coerce.number().min(0).max(300).optional(),
  quitYears: z.coerce.number().min(0).max(100).optional(),
  bmi: z.coerce.number().min(10).max(90).optional(),
  hasDiabetes: z.coerce.boolean().optional(),
  hasHypertension: z.coerce.boolean().optional(),
  hasCardiovascularDisease: z.coerce.boolean().optional(),
  hasChronicKidneyDisease: z.coerce.boolean().optional(),
  familyHistoryPrematureCvd: z.coerce.boolean().optional(),
  familyHistoryColorectalCancer: z.coerce.boolean().optional(),
  familyHistoryBreastOrOvarianCancer: z.coerce.boolean().optional(),
  postmenopausal: z.coerce.boolean().optional(),
  immunocompromised: z.coerce.boolean().optional(),
  asianAncestry: z.coerce.boolean().optional(),
});

const regionSchema = z.enum(["us", "international"]).default("us");

const planRequestSchema = z.object({
  profile: profileSchema,
  region: regionSchema,
  completions: z.record(z.string(), z.string()).optional(),
});

const assessSchema = z.object({
  sex: z.enum(["male", "female"]),
  values: z.array(z.object({ id: z.string(), value: z.number() })).max(100),
});

const entrySchema = z.object({
  completions: z.record(z.string(), z.string()).optional(),
  biomarkers: z.record(z.string(), z.object({ value: z.number(), date: z.string() })).optional(),
  profile: profileSchema.partial().optional(),
});

interface UserEntries {
  profile: Partial<LongevityProfile>;
  completions: Record<string, string>;
  biomarkers: Record<string, { value: number; date: string }>;
  updatedAt: string;
}

// Session-lifetime store keyed by auth subject. Not PHI-persistent by design.
const entriesByUser = new Map<string, UserEntries>();

function userId(req: Request): string | undefined {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  return user?.claims?.sub;
}

function defaultRegion(req: Request): GuidelineRegion {
  const header = String(req.headers["x-guideline-region"] ?? "").toLowerCase();
  return header === "international" ? "international" : "us";
}

/** Static protocol reference — no PHI, cacheable. */
router.get("/protocol", (_req: Request, res: Response) => {
  res.json({
    protocolVersion: LONGEVITY_PROTOCOL_VERSION,
    screenings: PREVENTIVE_SCREENINGS.map(({ appliesWhen: _a, earlierStartWhen: _e, ...rest }) => rest),
    vaccines: ADULT_VACCINES.map(({ appliesWhen: _a, ...rest }) => rest),
    biomarkers: BIOMARKER_TARGETS,
    functional: FUNCTIONAL_MARKERS,
    lifestyle: LIFESTYLE_PILLARS,
    sources: PROTOCOL_SOURCES,
    disclaimer: "Educational guideline summary. Not medical advice and not clinical decision support. Confirm every item with the treating clinician.",
  });
});

/** Build a plan for an explicit profile. Works logged-out (anonymous profile). */
router.post("/plan", (req: Request, res: Response) => {
  const parsed = planRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid plan request", details: parsed.error.flatten() });
  }
  const { profile, region, completions } = parsed.data;
  const uid = userId(req);
  const stored = uid ? entriesByUser.get(uid) : undefined;
  const plan = buildLongevityPlan(profile as LongevityProfile, {
    region: region ?? defaultRegion(req),
    completions: { ...(stored?.completions ?? {}), ...(completions ?? {}) },
  });
  if (uid) {
    logPhiAccess({
      userId: uid,
      patientId: uid,
      resourceType: "LongevityPreventivePlan",
      action: "read",
      details: `Plan generated (${plan.region}, ${plan.counts.due} due)`,
    });
  }
  res.json({ plan, clinicianSummary: summarizePlanForClinician(plan) });
});

/** Classify biomarker values against longevity targets. Stateless. */
router.post("/assess", (req: Request, res: Response) => {
  const parsed = assessSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid assessment request", details: parsed.error.flatten() });
  }
  const { sex, values } = parsed.data;
  res.json({
    results: values.map(({ id, value }) => ({ id, value, status: assessBiomarker(id, value, sex) })),
  });
});

/** Per-user tracked completions and values (session-lifetime). */
router.get("/entries", isAuthenticated, (req: Request, res: Response) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const entries = entriesByUser.get(uid) ?? { profile: {}, completions: {}, biomarkers: {}, updatedAt: new Date(0).toISOString() };
  logPhiAccess({ userId: uid, patientId: uid, resourceType: "LongevityPreventiveEntries", action: "read", details: "Entries read" });
  res.json(entries);
});

router.put("/entries", isAuthenticated, (req: Request, res: Response) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const parsed = entrySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid entries", details: parsed.error.flatten() });
  }
  const current = entriesByUser.get(uid) ?? { profile: {}, completions: {}, biomarkers: {}, updatedAt: "" };
  const next: UserEntries = {
    profile: { ...current.profile, ...(parsed.data.profile ?? {}) },
    completions: { ...current.completions, ...(parsed.data.completions ?? {}) },
    biomarkers: { ...current.biomarkers, ...(parsed.data.biomarkers ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  entriesByUser.set(uid, next);
  logPhiAccess({ userId: uid, patientId: uid, resourceType: "LongevityPreventiveEntries", action: "write", details: "Entries updated" });
  res.json(next);
});

export default router;
