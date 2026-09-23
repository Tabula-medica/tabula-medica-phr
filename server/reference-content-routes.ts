/**
 * Reference-content reviewer API (Phase 1.1).
 *
 * Reviewer console for reference content drafts: list drafts,
 * inspect a row, and transition status (draft → in-review → published, or
 * retire). Publishing a patient-education row runs a final NO-CDS compliance
 * check and is blocked if it fails. Reviewer identity + timestamp are recorded.
 *
 * Gated to clinician/admin. Public read of PUBLISHED content is a separate,
 * patient-facing concern (not in this router).
 */
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { referenceContent } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";
import { validateNoCDSCompliance } from "./security/no-cds-guardrails";

const router = Router();

// Everything here requires an authenticated clinician or admin reviewer.
router.use(isAuthenticated as any);
router.use(requireRole("clinician", "admin"));

const STATUSES = ["draft", "in-review", "published", "retired"] as const;
type Status = (typeof STATUSES)[number];

// Allowed status transitions (reviewer workflow).
const TRANSITIONS: Record<Status, Status[]> = {
  draft: ["in-review", "published"],
  "in-review": ["published", "draft"],
  published: ["retired"],
  retired: ["draft"],
};

/** GET /api/reference-content?status=&source=&surface=&limit= — reviewer list. */
router.get("/", async (req, res) => {
  try {
    const { status, source, surface } = req.query as Record<string, string | undefined>;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const conds = [];
    if (status) conds.push(eq(referenceContent.status, status));
    if (source) conds.push(eq(referenceContent.source, source));
    if (surface) conds.push(eq(referenceContent.surface, surface));
    const rows = await db
      .select()
      .from(referenceContent)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(referenceContent.updatedAt))
      .limit(limit);
    res.json({ count: rows.length, items: rows });
  } catch (err) {
    console.error("[reference-content] list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/reference-content/:id — full row. */
router.get("/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(referenceContent).where(eq(referenceContent.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    console.error("[reference-content] get error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /api/reference-content/:id/status  body: { status, note? } */
router.patch("/:id/status", async (req: any, res) => {
  try {
    const target = req.body?.status as Status | undefined;
    if (!target || !STATUSES.includes(target)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }

    const [row] = await db.select().from(referenceContent).where(eq(referenceContent.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });

    const current = row.status as Status;
    if (current === target) return res.json(row); // no-op
    if (!TRANSITIONS[current]?.includes(target)) {
      return res.status(409).json({ error: `Illegal transition ${current} → ${target}`, allowed: TRANSITIONS[current] ?? [] });
    }

    // Defense in depth: never publish non-NO-CDS-compliant patient-facing content.
    if (target === "published" && row.surface === "patient-education") {
      const check = validateNoCDSCompliance(`${row.title}\n\n${row.body ?? ""}`);
      if (!check.compliant) {
        return res.status(422).json({ error: "NO-CDS compliance failed — cannot publish", violations: check.violations });
      }
    }

    const reviewerId = req.user?.claims?.sub ?? null;
    const publishing = target === "published";
    const [updated] = await db
      .update(referenceContent)
      .set({
        status: target,
        updatedAt: new Date(),
        // stamp reviewer on publish; keep prior stamp otherwise
        ...(publishing ? { reviewedBy: reviewerId, reviewedAt: new Date() } : {}),
      })
      .where(eq(referenceContent.id, row.id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("[reference-content] status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export const referenceContentRoutes = router;
