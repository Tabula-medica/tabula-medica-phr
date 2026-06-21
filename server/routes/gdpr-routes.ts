import { Router, type Response } from "express";
import { eq, desc, and, gt } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  dataRightsRequests,
  accountPrivacyPrefs,
  type DataRightsRequest,
  type AccountPrivacyPrefs,
} from "@shared/schema";
import { type AuthRequest } from "../middleware/require-feature";

const router = Router();

const ERASURE_GRACE_DAYS = 30;

const ALLOWED_TYPES = new Set([
  "access",
  "portability",
  "erasure",
  "rectification",
  "do_not_sell",
  "limit_sensitive",
  "opt_out_automated_decisions",
]);

async function resolveAccountIdFromSession(req: AuthRequest): Promise<string | null> {
  const email = req.user?.claims?.email;
  if (!email) return null;
  try {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return acct?.id ?? null;
  } catch (err) {
    console.error("[GDPR] resolveAccountIdFromSession error", err);
    return null;
  }
}

async function getOrInitPrefs(accountId: string): Promise<AccountPrivacyPrefs> {
  const [existing] = await db
    .select()
    .from(accountPrivacyPrefs)
    .where(eq(accountPrivacyPrefs.accountId, accountId))
    .limit(1);
  if (existing) return existing;
  const [inserted] = await db
    .insert(accountPrivacyPrefs)
    .values({ accountId })
    .returning();
  return inserted;
}

function logAudit(action: string, accountId: string, meta?: Record<string, unknown>) {
  // Lightweight audit log via console — central audit pipeline already
  // captures stdout in the deployment log stream. Replace with the
  // structured audit service if/when patient-facing actions get
  // promoted into the formal audit trail.
  console.log(
    `[GDPR-AUDIT] action=${action} accountId=${accountId} ${
      meta ? `meta=${JSON.stringify(meta)}` : ""
    }`,
  );
}

// All routes below require an authenticated session. We don't use
// requireFeature here because GDPR/CCPA self-serve is legally mandated
// for ALL users — including Free tier — and must NEVER be gated.
// resolveAccountIdFromSession returns null for anonymous requests; each
// route translates that into a 401.

// ---------------------------------------------------------------------------
// GET /api/gdpr/requests — last 12 months of data-rights requests
// ---------------------------------------------------------------------------
router.get("/requests", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const rows = await db
      .select()
      .from(dataRightsRequests)
      .where(
        and(
          eq(dataRightsRequests.accountId, accountId),
          gt(dataRightsRequests.requestedAt, since),
        ),
      )
      .orderBy(desc(dataRightsRequests.requestedAt))
      .limit(100);
    res.json({ requests: rows });
  } catch (err) {
    console.error("[GDPR] GET /requests error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/gdpr/preferences — current privacy preferences (auto-init if absent)
// ---------------------------------------------------------------------------
router.get("/preferences", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const prefs = await getOrInitPrefs(accountId);
    res.json({ preferences: prefs });
  } catch (err) {
    console.error("[GDPR] GET /preferences error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/gdpr/processing-prefs — update opt-out toggles
// ---------------------------------------------------------------------------
router.patch("/processing-prefs", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });

  const allowed = [
    "aiProcessingOptOut",
    "marketingEmailsOptOut",
    "analyticsOptOut",
    "doNotSell",
    "limitSensitivePi",
    "optOutAutomatedDecisions",
  ] as const;
  const updates: Partial<AccountPrivacyPrefs> = {};
  for (const k of allowed) {
    if (typeof req.body?.[k] === "boolean") {
      (updates as Record<string, unknown>)[k] = req.body[k];
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "NO_VALID_FIELDS" });
  }

  try {
    await getOrInitPrefs(accountId); // ensure row exists
    const [row] = await db
      .update(accountPrivacyPrefs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountPrivacyPrefs.accountId, accountId))
      .returning();
    logAudit("update_processing_prefs", accountId, updates as Record<string, unknown>);
    res.json({ preferences: row });
  } catch (err) {
    console.error("[GDPR] PATCH /processing-prefs error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// Generic request creator. Used by all "right to ..." POSTs.
// ---------------------------------------------------------------------------
async function createRequest(
  accountId: string,
  type: string,
  framework: "gdpr" | "ccpa",
  opts: Partial<DataRightsRequest> = {},
): Promise<DataRightsRequest> {
  const [row] = await db
    .insert(dataRightsRequests)
    .values({
      accountId,
      type,
      framework,
      status: opts.status ?? "pending",
      notes: opts.notes ?? null,
      fulfillmentRef: opts.fulfillmentRef ?? null,
      scheduledFor: opts.scheduledFor ?? null,
    })
    .returning();
  logAudit(`request_${type}`, accountId, { framework, requestId: row.id });
  return row;
}

router.post("/access-request", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  const framework = (req.body?.framework as "gdpr" | "ccpa") === "ccpa" ? "ccpa" : "gdpr";
  try {
    // The actual bulk-export pipeline runs server-side and emails the link
    // (see fhir-export-routes for the existing exporter). We record the
    // intent here as a tracked request so the patient can see status.
    const row = await createRequest(accountId, "access", framework, {
      status: "in_progress",
    });
    res.json({
      request: row,
      message:
        "We've started preparing a complete copy of your data. You'll receive an email with a secure download link within 30 days (typically much sooner).",
    });
  } catch (err) {
    console.error("[GDPR] POST /access-request error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/portability-request", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  const framework = (req.body?.framework as "gdpr" | "ccpa") === "ccpa" ? "ccpa" : "gdpr";
  try {
    const row = await createRequest(accountId, "portability", framework, {
      status: "in_progress",
      notes: "FHIR R4 JSON bundle requested",
    });
    res.json({
      request: row,
      message:
        "We've started preparing a FHIR R4 JSON bundle of your data. You'll receive an email with a secure download link.",
    });
  } catch (err) {
    console.error("[GDPR] POST /portability-request error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/erasure-request", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  const framework = (req.body?.framework as "gdpr" | "ccpa") === "ccpa" ? "ccpa" : "gdpr";
  try {
    // Reject if there is already a pending erasure within the grace window.
    const [existing] = await db
      .select()
      .from(dataRightsRequests)
      .where(
        and(
          eq(dataRightsRequests.accountId, accountId),
          eq(dataRightsRequests.type, "erasure"),
          eq(dataRightsRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) {
      return res.status(409).json({
        error: "ERASURE_ALREADY_PENDING",
        request: existing,
      });
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + ERASURE_GRACE_DAYS);

    const row = await createRequest(accountId, "erasure", framework, {
      status: "pending",
      scheduledFor,
      notes: `30-day grace period — scheduled for ${scheduledFor.toISOString()}`,
    });
    res.json({
      request: row,
      graceDays: ERASURE_GRACE_DAYS,
      scheduledFor: scheduledFor.toISOString(),
      message: `Your account is scheduled for permanent deletion on ${scheduledFor.toLocaleDateString()}. You can cancel this request any time before then.`,
    });
  } catch (err) {
    console.error("[GDPR] POST /erasure-request error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/erasure-cancel/:id", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ error: "MISSING_ID" });
  try {
    const [row] = await db
      .update(dataRightsRequests)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(
        and(
          eq(dataRightsRequests.id, id),
          eq(dataRightsRequests.accountId, accountId),
          eq(dataRightsRequests.type, "erasure"),
          eq(dataRightsRequests.status, "pending"),
        ),
      )
      .returning();
    if (!row) {
      return res.status(404).json({ error: "ERASURE_REQUEST_NOT_FOUND" });
    }
    logAudit("cancel_erasure", accountId, { requestId: row.id });
    res.json({ request: row });
  } catch (err) {
    console.error("[GDPR] POST /erasure-cancel error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// CCPA-specific: do-not-sell toggle. Records a request AND flips the pref.
router.post("/do-not-sell", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    await getOrInitPrefs(accountId);
    const [prefs] = await db
      .update(accountPrivacyPrefs)
      .set({ doNotSell: true, updatedAt: new Date() })
      .where(eq(accountPrivacyPrefs.accountId, accountId))
      .returning();
    const row = await createRequest(accountId, "do_not_sell", "ccpa", {
      status: "completed",
      notes: "Honored immediately — Tabula Medica does not sell PHI under any circumstance.",
    });
    // Mark completed_at for the row we just created.
    await db
      .update(dataRightsRequests)
      .set({ completedAt: new Date() })
      .where(eq(dataRightsRequests.id, row.id));
    res.json({ request: row, preferences: prefs });
  } catch (err) {
    console.error("[GDPR] POST /do-not-sell error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/gdpr/dpo — DPA / DPO contact card. Static, no auth needed beyond
// the router.use above.
// ---------------------------------------------------------------------------
router.get("/dpo", async (_req: AuthRequest, res: Response) => {
  res.json({
    dpo: {
      name: "Tabula Medica Data Protection Officer",
      email: "dpo@tabulamedica.health",
      address: "Tabula Medica, Attn: DPO, 1 Health Way, Wilmington DE 19801, USA",
      euRepresentative: {
        name: "Tabula Medica EU Representative",
        email: "eu-rep@tabulamedica.health",
        address: "Tabula Medica EU, Calle de Serrano 90, 28006 Madrid, Spain",
      },
      responseSlaDays: 30,
      escalation: "Lead supervisory authority — Spain AEPD (www.aepd.es).",
    },
  });
});

export default router;
