/**
 * Risk-adjustment API — CMS-HCC V28 documentation support.
 *
 * Mounted at /api/hcc.
 *
 *   Everywhere (documentation quality — no payment model needed):
 *     POST /suspects            evidence-backed suspect conditions
 *     POST /recapture           chronic conditions not re-documented this year
 *     POST /meat                MEAT adequacy of a note for one condition
 *     POST /review              the two above, ranked and drafted by AI
 *     GET  /rules               the suspect rule set, for transparency
 *
 *   US only (gated on TEFCA_ENABLED, the existing US/international switch):
 *     GET  /model               loaded CMS table status and provenance
 *     POST /raf                 compute a RAF score, or refuse with a reason
 *
 * ## Why the split
 *
 * RAF is a Medicare Advantage *payment* construct. Exposing a RAF score on a
 * non-US deployment would attach a number with no meaning to a patient record,
 * and invite it to be read as a clinical severity score, which it is not.
 *
 * The documentation layer is a different thing and travels fine: "this patient
 * has two eGFRs under 60 ninety days apart and no CKD stage on the problem list"
 * is a chart-quality finding in any country. Those endpoints stay open.
 *
 * ## What this API will not do
 *
 * It does not write codes. Every response is advisory, carries the evidence it
 * rests on, and names what a clinician must confirm. Adding HCC codes without a
 * clinician's judgement is the practice that draws federal False Claims Act
 * enforcement against Medicare Advantage organisations, and no amount of model
 * confidence changes that.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { logPhiAccess } from "./security/hipaa-audit";
import { HCC_V28, type HccCondition, type HccModelSegment } from "@shared/hcc-v28";
import {
  getHccTables,
  hccForIcd10,
  hccLabel,
  hccTablesLoaded,
} from "./services/risk-adjustment/hcc-tables";
import { calculateRaf, applyHierarchy } from "./services/risk-adjustment/raf-calculator";
import {
  assessMeat,
  findRecaptureGaps,
  isChronicOrPermanent,
} from "./services/risk-adjustment/documentation-gaps";
import { SUSPECT_RULES, findSuspects } from "./services/risk-adjustment/suspect-rules";
import { reviewHccOpportunities } from "./services/risk-adjustment/hcc-ai-reviewer";

function sessionUserId(req: Request): string {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    "unknown"
  );
}

const evidenceSnapshotSchema = z.object({
  labs: z
    .array(
      z.object({
        code: z.string(),
        name: z.string().optional(),
        value: z.number(),
        unit: z.string().optional(),
        observedAt: z.string().optional(),
      }),
    )
    .optional(),
  medications: z
    .array(
      z.object({
        name: z.string(),
        rxnorm: z.string().optional(),
        active: z.boolean().optional(),
      }),
    )
    .optional(),
  vitals: z
    .array(
      z.object({
        type: z.string(),
        value: z.number(),
        unit: z.string().optional(),
        observedAt: z.string().optional(),
      }),
    )
    .optional(),
  problemList: z
    .array(z.object({ icd10: z.string().optional(), name: z.string() }))
    .optional(),
  codedThisYear: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
});

const recaptureSchema = z.object({
  priorYear: z.array(
    z.object({
      icd10: z.string().min(1),
      name: z.string().optional(),
      year: z.number().int().min(1990).max(2100),
    }),
  ),
  codedThisYear: z.array(z.string()).default([]),
  currentYear: z.number().int().min(1990).max(2100),
});

const meatSchema = z.object({
  noteText: z.string().min(1).max(100_000),
  condition: z.string().min(1),
});

const reviewSchema = z.object({
  evidence: evidenceSnapshotSchema.default({}),
  recapture: recaptureSchema.optional(),
});

const HCC_SEGMENTS = [
  "community-nondual-aged",
  "community-nondual-disabled",
  "community-fbd-aged",
  "community-fbd-disabled",
  "community-pbd-aged",
  "community-pbd-disabled",
  "institutional",
  "new-enrollee",
  "snp-new-enrollee",
] as const;

const rafSchema = z.object({
  conditions: z.array(
    z.object({
      icd10: z.string().min(1),
      origin: z.enum(["coded-encounter", "problem-list", "suspected"]),
      serviceDate: z.string().optional(),
      clinicianAttested: z.boolean().optional(),
    }),
  ),
  demographics: z.object({
    // No default: the same HCC is worth different amounts per segment, so a
    // defaulted segment produces a confidently wrong number.
    segment: z.enum(HCC_SEGMENTS),
    age: z.number().int().min(0).max(130),
    sex: z.enum(["male", "female"]),
    originallyDisabled: z.boolean().optional(),
  }),
});

export function registerHccRoutes(app: Express): void {
  app.use("/api/hcc", noStorePhi);

  const usOnly = process.env.TEFCA_ENABLED !== "false";

  // ── Transparency: the rules themselves, no PHI, no auth needed ───────────
  app.get("/api/hcc/rules", (_req: Request, res: Response) => {
    res.json({
      model: HCC_V28,
      rules: SUSPECT_RULES,
      note:
        "Suspect rules fire on affirmative evidence in structured data. They suggest " +
        "conditions for clinician review and never code anything.",
    });
  });

  // ── Suspect detection ────────────────────────────────────────────────────
  app.post("/api/hcc/suspects", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = evidenceSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid evidence snapshot", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "risk-adjustment",
      action: "read",
      details: "HCC suspect detection over a patient evidence snapshot",
    }).catch(() => {});

    const hits = findSuspects(parsed.data);
    res.json({
      suspects: hits.map((h) => ({
        ruleId: h.rule.id,
        condition: h.rule.condition,
        candidateIcd10: h.rule.candidateIcd10,
        strength: h.rule.strength,
        requiresConfirmation: h.rule.requiresConfirmation,
        rationale: h.rule.rationale,
        evidence: h.evidence,
        // Only meaningful once CMS tables are loaded; null otherwise.
        hccIfCoded: hccTablesLoaded()
          ? h.rule.candidateIcd10.map((c) => ({ icd10: c, hcc: hccForIcd10(c) }))
          : null,
      })),
      tablesLoaded: hccTablesLoaded(),
      advisory: true,
    });
  });

  // ── Annual recapture gaps ────────────────────────────────────────────────
  app.post("/api/hcc/recapture", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = recaptureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid recapture input", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "risk-adjustment",
      action: "read",
      details: "HCC annual recapture gap detection",
    }).catch(() => {});

    res.json({ gaps: findRecaptureGaps(parsed.data), advisory: true });
  });

  // ── MEAT adequacy ────────────────────────────────────────────────────────
  app.post("/api/hcc/meat", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = meatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid MEAT request", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "risk-adjustment",
      action: "read",
      details: "MEAT documentation adequacy check on a clinical note",
    }).catch(() => {});

    res.json(assessMeat(parsed.data.noteText, parsed.data.condition));
  });

  // ── Combined, AI-ranked worklist ─────────────────────────────────────────
  app.post("/api/hcc/review", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid review request", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "risk-adjustment",
      action: "read",
      details: "HCC opportunity review (suspects + recapture, AI-ranked)",
    }).catch(() => {});

    const suspects = findSuspects(parsed.data.evidence);
    const recaptures = parsed.data.recapture ? findRecaptureGaps(parsed.data.recapture) : [];

    try {
      const result = await reviewHccOpportunities(suspects, recaptures);
      res.json(result);
    } catch (err) {
      console.error("[HCC] review failed:", err);
      res.status(500).json({ error: "Review failed" });
    }
  });

  // ── US-only: model status and RAF ────────────────────────────────────────
  if (!usOnly) {
    console.log(
      "[HCC] TEFCA_ENABLED=false — RAF scoring disabled for this deployment. " +
        "CMS-HCC is a US Medicare Advantage payment model; documentation-gap " +
        "endpoints remain available.",
    );
    return;
  }

  app.get("/api/hcc/model", (_req: Request, res: Response) => {
    const tables = getHccTables();
    res.json({
      model: HCC_V28,
      tablesLoaded: tables !== null,
      paymentYear: tables?.paymentYear ?? null,
      provenance: tables?.provenance ?? null,
      categoriesLoaded: tables?.categories.size ?? 0,
      crosswalkEntriesLoaded: tables?.crosswalk.size ?? 0,
      ...(tables
        ? {}
        : {
            reason:
              "No CMS-HCC V28 tables loaded. Set HCC_V28_TABLES_PATH to a converted " +
              "CMS model release. RAF scoring stays unavailable until then — a " +
              "guessed crosswalk or coefficient would produce a false claim.",
          }),
    });
  });

  app.post("/api/hcc/raf", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = rafSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid RAF request", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "risk-adjustment",
      action: "read",
      details: `RAF calculation, segment=${parsed.data.demographics.segment}`,
    }).catch(() => {});

    const conditions: HccCondition[] = parsed.data.conditions.map((c) => ({
      icd10: c.icd10,
      hcc: hccForIcd10(c.icd10),
      origin: c.origin,
      serviceDate: c.serviceDate,
      clinicianAttested: c.clinicianAttested,
    }));

    const result = calculateRaf(conditions, {
      segment: parsed.data.demographics.segment as HccModelSegment,
      age: parsed.data.demographics.age,
      sex: parsed.data.demographics.sex,
      originallyDisabled: parsed.data.demographics.originallyDisabled,
    });

    // Report the hierarchy outcome either way — a clinician reviewing a chart
    // benefits from seeing that a milder code was trumped, whether or not a
    // score came out the far end.
    const countable = conditions
      .filter((c) => c.origin === "coded-encounter" || c.clinicianAttested)
      .map((c) => c.hcc)
      .filter((h): h is number => h !== null);
    const hierarchy = applyHierarchy(countable);

    res.json({
      ...result,
      hierarchy: {
        payable: hierarchy.payable.map((h) => ({ hcc: h, label: hccLabel(h) })),
        suppressed: hierarchy.suppressed.map((s) => ({
          hcc: s.hcc,
          label: hccLabel(s.hcc),
          suppressedBy: s.suppressedBy,
        })),
      },
      excludedFromScore: parsed.data.conditions
        .filter((c) => c.origin !== "coded-encounter" && !c.clinicianAttested)
        .map((c) => ({
          icd10: c.icd10,
          reason:
            c.origin === "suspected"
              ? "no-clinician-attestation"
              : "no-qualifying-encounter",
        })),
      chronicityNote: parsed.data.conditions
        .filter((c) => isChronicOrPermanent(c.icd10))
        .map((c) => c.icd10),
    });
  });
}
