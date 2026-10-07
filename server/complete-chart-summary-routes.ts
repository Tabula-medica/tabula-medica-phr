/**
 * HTTP surface for the complete chart/notes summarization connector.
 *
 * ```
 * GET  /api/complete-chart-summary/facts?unifiedPatientId=     deterministic facts, no AI
 * POST /api/complete-chart-summary/generate                    facts + AI-organized narrative
 * ```
 *
 * Both take `unifiedPatientId` rather than a single connection's `patientId`
 * — the whole point of this connector is gathering across every source
 * connected for one person (eCW, Fasten Health, this app's own PHR entries),
 * and a route keyed to one connection's patient row would silently produce
 * an incomplete "complete" summary.
 *
 * Clinic staff only — this acts on a patient rather than for the caller, the
 * same distinction `requireClinicStaff` exists to draw for
 * `/api/care-management` and `/api/hcc`.
 */

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { requireClinicStaff, callerFrom } from "./lib/middleware/require-clinic-staff";
import { gatherChartFacts } from "./services/complete-chart-summary/fact-gatherer";
import { buildCompleteChartSummary } from "./services/complete-chart-summary";

const summaryRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chart-summary requests" },
});

const unifiedPatientIdQuerySchema = z.object({
  unifiedPatientId: z.string().min(1),
});

const generateSchema = z.object({
  unifiedPatientId: z.string().min(1),
});

export function registerCompleteChartSummaryRoutes(app: Express): void {
  app.use("/api/complete-chart-summary", noStorePhi);

  /** Deterministic facts only, no AI call — for review, debugging, or a facts-only UI. */
  app.get(
    "/api/complete-chart-summary/facts",
    isAuthenticated,
    requireClinicStaff("Complete chart summary"),
    summaryRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = unifiedPatientIdQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query", detail: parsed.error.flatten() });
      }

      const { factSet, refused } = await gatherChartFacts(parsed.data.unifiedPatientId);
      if (!factSet) {
        return res.status(422).json({ error: refused!.reason, detail: refused!.detail });
      }
      res.json(factSet);
    },
  );

  /** Facts plus an AI-organized, citation-carrying narrative. Nothing here is a diagnosis. */
  app.post(
    "/api/complete-chart-summary/generate",
    isAuthenticated,
    requireClinicStaff("Complete chart summary"),
    summaryRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = generateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);

      const { summary, refused } = await buildCompleteChartSummary(parsed.data.unifiedPatientId, {
        requestedBy: caller.userId!,
      });
      if (!summary) {
        return res.status(422).json({ error: refused!.reason, detail: refused!.detail });
      }

      res.json({
        ...summary,
        // Restated on every response, same as /api/care-management/evaluate
        // and /api/medicare-care-gaps/evaluate — a summary that looks
        // authoritative will eventually be treated as one if the caller has
        // to remember the disclaimer itself.
        disclaimer: summary.disclaimer,
      });
    },
  );
}
