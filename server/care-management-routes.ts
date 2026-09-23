/**
 * HTTP surface for care-management coding.
 *
 * Three routes, and none of them bills anything:
 *
 * ```
 * GET  /api/care-management/rules      what rule set is loaded, and is it verified
 * GET  /api/care-management/plan-elements  what a care plan has to contain here
 * POST /api/care-management/evaluate   documented facts in, candidates out
 * ```
 *
 * `evaluate` takes facts in the body rather than a patient id, and that is
 * deliberate. A route that loaded the month's time entries itself would be
 * asserting that whatever it found in the database *is* the documented time —
 * and the gap between "minutes logged in a system" and "minutes documented as
 * care management" is exactly where these claims go wrong. The caller states
 * the facts it is prepared to stand behind; the engine checks them.
 *
 * Clinic staff only. This is a clinician-facing billing tool: it acts on a
 * patient rather than for the caller, which is the distinction
 * `requireClinicStaff` exists to draw.
 */

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { requireClinicStaff, callerFrom } from "./lib/middleware/require-clinic-staff";
import { logPhiAccess } from "./security/hipaa-audit";
import { CARE_MGMT_LIMITS } from "@shared/care-management";
import { ruleSet } from "./services/care-management/code-catalog";
import {
  CARE_PLAN_ELEMENTS,
  requiredPlanElements,
} from "./services/care-management/care-plan";
import { evaluateCoding } from "./services/care-management/eligibility";

const careMgmtRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many care-management requests" },
});

const PREREQUISITES = [
  "patient-consent",
  "care-plan",
  "two-plus-chronic-conditions",
  "one-complex-chronic-condition",
  "moderate-high-mdm",
  "initiating-visit",
  "round-the-clock-access",
  "device-supplied",
  "sixteen-device-days",
  "interactive-communication",
] as const;

const PROGRAMS = ["ccm", "complex-ccm", "pcm", "apcm", "rpm", "care-plan"] as const;

const evaluateSchema = z.object({
  patientId: z.string().uuid(),
  period: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  documented: z.array(z.enum(PREREQUISITES)).default([]),
  time: z
    .array(
      z.object({
        program: z.enum(PROGRAMS),
        performer: z.enum(["qhp", "clinical-staff"]),
        // Capped at a working month. A four-figure figure for one patient in
        // one month is a data-entry error, and accepting it would put it on a
        // claim.
        minutes: z.number().int().min(0).max(6000),
        source: z.string().min(1).max(200),
      }),
    )
    .max(500)
    .default([]),
  carePlan: z
    .object({
      patientId: z.string(),
      establishedAt: z.string(),
      lastReviewedAt: z.string().optional(),
      elements: z.array(z.enum(CARE_PLAN_ELEMENTS)).default([]),
      electronicAndAvailable: z.boolean(),
      sharedWithPatient: z.boolean(),
    })
    .nullable()
    .default(null),
  deviceDays: z.number().int().min(0).max(31).optional(),
  chronicConditionCount: z.number().int().min(0).max(50).optional(),
  isQmb: z.boolean().optional(),
});

export function registerCareManagementRoutes(app: Express): void {
  /**
   * Which rules are in force.
   *
   * Open to any signed-in caller because it discloses configuration, not
   * patients — and it exists so nobody has to infer from a claim whether the
   * rules behind it were verified.
   */
  app.get(
    "/api/care-management/rules",
    isAuthenticated,
    careMgmtRateLimiter,
    (_req: Request, res: Response) => {
      const rules = ruleSet();
      res.json({
        year: rules.year,
        verified: rules.verified,
        source: rules.source || null,
        codeCount: rules.codes.length,
        programs: Array.from(new Set(rules.codes.map((c) => c.program))),
        limits: CARE_MGMT_LIMITS,
        warning: rules.verified
          ? null
          : "Development seed in use. Candidates are not billable as produced — set " +
            "CARE_MGMT_RULES_PATH to a rule set reconciled against the current CPT " +
            "release and PFS final rule.",
      });
    },
  );

  /** What a care plan has to contain for this deployment. */
  app.get(
    "/api/care-management/plan-elements",
    isAuthenticated,
    careMgmtRateLimiter,
    (_req: Request, res: Response) => {
      res.json({
        all: CARE_PLAN_ELEMENTS,
        required: requiredPlanElements(),
        note:
          "An incomplete plan blocks every code that requires one. The refusal names " +
          "the missing elements so the gap can be closed rather than overridden.",
      });
    },
  );

  /** Documented facts in, candidates out. Nothing here is a bill. */
  app.post(
    "/api/care-management/evaluate",
    isAuthenticated,
    requireClinicStaff("Care-management coding"),
    noStorePhi,
    careMgmtRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = evaluateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid coding facts", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const facts = parsed.data;

      if (facts.period.end < facts.period.start) {
        return res.status(422).json({
          error: "no-service-period",
          detail: "The service period ends before it starts.",
        });
      }

      const result = evaluateCoding({
        patientId: facts.patientId,
        period: facts.period,
        documented: facts.documented,
        time: facts.time,
        carePlan: facts.carePlan,
        deviceDays: facts.deviceDays,
        chronicConditionCount: facts.chronicConditionCount,
        isQmb: facts.isQmb,
      });

      await logPhiAccess({
        userId: caller.userId!,
        patientId: facts.patientId,
        resourceType: "care-management-coding",
        action: "read",
        details:
          `${result.candidates.length} candidate(s), ${result.refused.length} refused, ` +
          `${result.conflicts.length} conflict(s); rules ${result.unverifiedRules ? "unverified" : "verified"}`,
      });

      res.json({
        ...result,
        // Restated on every response rather than left to the client to
        // remember. A candidate list that looks like a claim will eventually
        // be treated as one.
        disclaimer:
          "Candidates, not a claim. The engine checks arithmetic and prerequisites; it " +
          "cannot know whether the time was really spent. A qualified coder decides " +
          "what is submitted, and resolves any conflicts listed above.",
      });
    },
  );
}
