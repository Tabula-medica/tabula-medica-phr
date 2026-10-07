/**
 * HTTP surface for the Medicare care-gaps connector.
 *
 * ```
 * GET  /api/medicare-care-gaps/rules      what G-code table is loaded, and is it verified
 * POST /api/medicare-care-gaps/evaluate   documented facts in, gap candidates out
 * ```
 *
 * `evaluate` takes facts in the body rather than a patient id, for the same
 * reason `/api/care-management/evaluate` does: a route that looked up the
 * patient's enrollment date, immunization history, and care plan itself would
 * be asserting that whatever it found *is* the current state, and that gap —
 * between what a record contains and what is actually documented and
 * current — is where these gaps go stale silently. The caller states the
 * facts it is prepared to stand behind; the engine checks them.
 *
 * Medicare-specific by definition, so gated the same way `/api/hcc` gates its
 * US-only routes: `TEFCA_ENABLED=false` disables this surface entirely on a
 * non-US deployment rather than publishing G-code candidates with no local
 * meaning.
 *
 * Clinic staff only — this acts on a patient rather than for the caller.
 */

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { requireClinicStaff, callerFrom } from "./lib/middleware/require-clinic-staff";
import { logPhiAccess } from "./security/hipaa-audit";
import { gcodeRuleSet } from "./services/medicare-care-gaps/g-code-catalog";
import { evaluateMedicareGaps } from "./services/medicare-care-gaps";
import { CARE_PLAN_ELEMENTS } from "./services/care-management/care-plan";

const gapsRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many Medicare care-gaps requests" },
});

const VACCINE_KEYS = ["influenza", "pneumococcal", "zoster", "tdap", "covid19"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const evaluateSchema = z.object({
  patientId: z.string().uuid(),
  asOf: isoDate.optional(),
  medicareEnrolled: z.boolean(),
  awv: z.object({
    partBEffectiveDate: isoDate.optional(),
    lastAwvDate: isoDate.optional(),
  }),
  vaccine: z.object({
    age: z.number().int().min(0).max(130),
    doses: z.record(
      z.enum(VACCINE_KEYS),
      z.object({
        lastDoseDate: isoDate.optional(),
        doseCount: z.number().int().min(0).max(20).optional(),
      }),
    ),
  }),
  medRec: z.object({
    medicationListDocumented: z.boolean(),
    medicationListDocumentedDate: isoDate.optional(),
    hospitalDischargeDate: isoDate.optional(),
    postDischargeMedRecDate: isoDate.optional(),
  }),
  carePlan: z.object({
    chronicConditionCount: z.number().int().min(0).max(50).optional(),
    carePlan: z
      .object({
        patientId: z.string(),
        establishedAt: z.string(),
        lastReviewedAt: z.string().optional(),
        elements: z.array(z.enum(CARE_PLAN_ELEMENTS)).default([]),
        electronicAndAvailable: z.boolean(),
        sharedWithPatient: z.boolean(),
      })
      .nullable(),
  }),
});

export function registerMedicareCareGapsRoutes(app: Express): void {
  app.use("/api/medicare-care-gaps", noStorePhi);

  const usOnly = process.env.TEFCA_ENABLED !== "false";

  /** Which G-code table is in force. No PHI, so open to any signed-in caller. */
  app.get(
    "/api/medicare-care-gaps/rules",
    isAuthenticated,
    gapsRateLimiter,
    (_req: Request, res: Response) => {
      if (!usOnly) {
        return res.status(404).json({
          error: "not-available",
          detail:
            "The Medicare care-gaps connector is a US Medicare feature and is disabled " +
            "on this deployment.",
        });
      }
      const rules = gcodeRuleSet();
      res.json({
        year: rules.year,
        verified: rules.verified,
        source: rules.source || null,
        codes: rules.codes,
        warning: rules.verified
          ? null
          : "Development seed in use. G-code candidates are not billable as produced — " +
            "set MEDICARE_GAPS_CODE_TABLE_PATH to a table reconciled against the current " +
            "HCPCS release and PFS final rule.",
      });
    },
  );

  /** Documented facts in, gap candidates out. Nothing here is a claim. */
  app.post(
    "/api/medicare-care-gaps/evaluate",
    isAuthenticated,
    requireClinicStaff("Medicare care-gaps evaluation"),
    gapsRateLimiter,
    async (req: Request, res: Response) => {
      if (!usOnly) {
        return res.status(404).json({
          error: "not-available",
          detail:
            "The Medicare care-gaps connector is a US Medicare feature and is disabled " +
            "on this deployment.",
        });
      }

      const parsed = evaluateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid gap-evaluation facts", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const facts = parsed.data;

      const result = evaluateMedicareGaps(facts);

      await logPhiAccess({
        userId: caller.userId!,
        patientId: facts.patientId,
        resourceType: "medicare-care-gaps",
        action: "read",
        details:
          `${result.candidates.length} candidate(s), ${result.refused.length} refused; ` +
          `G-code table ${result.unverifiedRules ? "unverified" : "verified"}`,
      });

      res.json({
        ...result,
        disclaimer:
          "Gap candidates, not a claim. The engine checks dates and documented facts; it " +
          "cannot know whether a service actually happened. A qualified coder or clinician " +
          "decides what is submitted.",
      });
    },
  );
}
