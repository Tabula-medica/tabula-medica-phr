/**
 * AI Clinician Review Queue — REST Routes (Task #297)
 *
 * POST   /api/ai-review/submit       — guardrail pipeline submits flagged output
 * GET    /api/ai-review/queue        — provider-only: list pending items
 * PUT    /api/ai-review/approve/:id  — approve (releases output to patient context)
 * PUT    /api/ai-review/reject/:id   — reject (discards output)
 *
 * All routes require authentication. The queue and approve/reject actions
 * additionally require the authenticated user to hold the `provider` role
 * as verified against the DB via accessControlService (fail-closed).
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/require-auth";
import { db } from "../db";
import { aiReviewQueue } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { accessControlService } from "../access-control-service";

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

/**
 * DB-backed provider-role gate. Queries the user_roles table via
 * accessControlService — never trusts client-controlled headers or claims.
 */
async function requireProviderRole(req: Request, res: Response): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  let roles: Array<{ name: string }>;
  try {
    roles = await accessControlService.getUserRoles(userId);
  } catch {
    roles = [];
  }
  const hasRole = roles.some((r) => r.name === "provider" || r.name === "admin");
  if (!hasRole) {
    res.status(403).json({ error: "Provider role required" });
    return false;
  }
  return true;
}

export function registerAiReviewRoutes(app: Express): void {

  // ── Submit flagged output to the review queue ─────────────────────────────
  // Called internally by the guardrail pipeline, but also accepts external
  // submissions (e.g., a clinician manually flags an AI response).

  app.post("/api/ai-review/submit", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { route, aiOutput, guardrailFlags, blockedPhrases, requestContext } = req.body;

    if (!aiOutput || typeof aiOutput !== "string") {
      return res.status(400).json({ error: "aiOutput required" });
    }

    try {
      const [row] = await db
        .insert(aiReviewQueue)
        .values({
          userId,
          route: route ?? "manual-submit",
          aiOutput,
          requestContext: requestContext ?? null,
          guardrailFlags: guardrailFlags ?? null,
          blockedPhrases: blockedPhrases ?? null,
          status: "pending",
        })
        .returning();
      return res.status(201).json({ id: row.id, status: row.status });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "DB error" });
    }
  });

  // ── List pending review queue (provider-only) ────────────────────────────

  app.get("/api/ai-review/queue", requireAuth, async (req: Request, res: Response) => {
    if (!await requireProviderRole(req, res)) return;

    const status = (req.query.status as string) || "pending";
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    try {
      const rows = await db
        .select()
        .from(aiReviewQueue)
        .where(eq(aiReviewQueue.status, status))
        .orderBy(desc(aiReviewQueue.createdAt))
        .limit(limit);

      return res.json({ items: rows, count: rows.length });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "DB error" });
    }
  });

  // ── Get single review item ────────────────────────────────────────────────

  app.get("/api/ai-review/queue/:id", requireAuth, async (req: Request, res: Response) => {
    if (!await requireProviderRole(req, res)) return;
    try {
      const [row] = await db
        .select()
        .from(aiReviewQueue)
        .where(eq(aiReviewQueue.id, req.params.id as string));
      if (!row) return res.status(404).json({ error: "Not found" });
      return res.json(row);
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "DB error" });
    }
  });

  // ── Approve ───────────────────────────────────────────────────────────────

  app.put("/api/ai-review/approve/:id", requireAuth, async (req: Request, res: Response) => {
    if (!await requireProviderRole(req, res)) return;
    const userId = getUserId(req);
    const { reviewerNotes } = req.body;

    try {
      const [row] = await db
        .update(aiReviewQueue)
        .set({
          status: "approved",
          reviewedBy: userId,
          reviewerNotes: reviewerNotes ?? null,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(aiReviewQueue.id, req.params.id as string),
            eq(aiReviewQueue.status, "pending")
          )
        )
        .returning();

      if (!row) return res.status(404).json({ error: "Item not found or already reviewed" });
      return res.json({ id: row.id, status: row.status, reviewedAt: row.reviewedAt });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "DB error" });
    }
  });

  // ── Reject ────────────────────────────────────────────────────────────────

  app.put("/api/ai-review/reject/:id", requireAuth, async (req: Request, res: Response) => {
    if (!await requireProviderRole(req, res)) return;
    const userId = getUserId(req);
    const { reviewerNotes } = req.body;

    try {
      const [row] = await db
        .update(aiReviewQueue)
        .set({
          status: "rejected",
          reviewedBy: userId,
          reviewerNotes: reviewerNotes ?? null,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(aiReviewQueue.id, req.params.id as string),
            eq(aiReviewQueue.status, "pending")
          )
        )
        .returning();

      if (!row) return res.status(404).json({ error: "Item not found or already reviewed" });
      return res.json({ id: row.id, status: row.status, reviewedAt: row.reviewedAt });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "DB error" });
    }
  });

  // ── Stats (provider-only) ─────────────────────────────────────────────────

  app.get("/api/ai-review/stats", requireAuth, async (req: Request, res: Response) => {
    if (!await requireProviderRole(req, res)) return;
    try {
      const [pending, approved, rejected] = await Promise.all([
        db.select().from(aiReviewQueue).where(eq(aiReviewQueue.status, "pending")),
        db.select().from(aiReviewQueue).where(eq(aiReviewQueue.status, "approved")),
        db.select().from(aiReviewQueue).where(eq(aiReviewQueue.status, "rejected")),
      ]);
      return res.json({
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        total: pending.length + approved.length + rejected.length,
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "DB error" });
    }
  });
}
