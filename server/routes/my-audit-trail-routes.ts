/**
 * H4 — Patient-facing audit-trail routes
 *
 * Surfaces R1.1 (Accounting of Disclosures, §164.528), R1.2 (Full PHI access
 * log), and R1.3 (Patient's own activity log) for the authenticated patient.
 *
 * Free tier — patient access to one's own audit record is a regulatory
 * right, not a paid feature. Mirrors /api/gdpr/* in that respect.
 */

import { Router, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts, auditLogTable } from "@shared/schema";
import { type AuthRequest } from "../middleware/require-feature";
import {
  getPatientAccessLog,
  getPatientDisclosures,
  getPatientOwnActivity,
} from "../services/phi-access-log-service";
import { auditAccessLogger } from "../middleware/audit-access-logger";
import { getReportSigner } from "../services/report-signer";

const router = Router();

// H5 — every read of this audit surface is itself logged to audit_access_log.
router.use(auditAccessLogger("my-audit-trail"));

const MAX_RANGE_DAYS = 365 * 6; // §164.316(b)(2)(i) — 6 year retention

async function resolveAccountIdFromSession(
  req: AuthRequest,
): Promise<string | null> {
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
    console.error("[MyAuditTrail] resolveAccountIdFromSession error", err);
    return null;
  }
}

function parseRange(req: AuthRequest): { from?: Date; to?: Date; limit: number } {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 200;
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

  // Clamp absurdly old `from` to the 6-year retention boundary.
  if (from && !Number.isNaN(from.getTime())) {
    const earliest = new Date();
    earliest.setDate(earliest.getDate() - MAX_RANGE_DAYS);
    if (from < earliest) from.setTime(earliest.getTime());
  }

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    limit,
  };
}

function logAudit(action: string, accountId: string, meta?: Record<string, unknown>) {
  console.log(
    `[MY-AUDIT-TRAIL] action=${action} accountId=${accountId} ${
      meta ? `meta=${JSON.stringify(meta)}` : ""
    }`,
  );
}

// ---------------------------------------------------------------------------
// GET /api/my-audit-trail/access-log  (R1.2)
// ---------------------------------------------------------------------------
router.get("/access-log", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const range = parseRange(req);
    const events = await getPatientAccessLog({ accountId, ...range });
    logAudit("view_access_log", accountId, {
      count: events.length,
      from: range.from,
      to: range.to,
    });
    res.json({ events, count: events.length, range });
  } catch (err) {
    console.error("[MyAuditTrail] /access-log error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/my-audit-trail/disclosures  (R1.1 — §164.528)
// ---------------------------------------------------------------------------
router.get("/disclosures", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const range = parseRange(req);
    const events = await getPatientDisclosures({ accountId, ...range });
    logAudit("view_disclosures", accountId, {
      count: events.length,
      from: range.from,
      to: range.to,
    });
    res.json({ events, count: events.length, range });
  } catch (err) {
    console.error("[MyAuditTrail] /disclosures error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/my-audit-trail/my-activity  (R1.3)
// ---------------------------------------------------------------------------
router.get("/my-activity", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const range = parseRange(req);
    const events = await getPatientOwnActivity({ accountId, ...range });
    logAudit("view_my_activity", accountId, {
      count: events.length,
      from: range.from,
      to: range.to,
    });
    res.json({ events, count: events.length, range });
  } catch (err) {
    console.error("[MyAuditTrail] /my-activity error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/my-audit-trail/summary — single-call dashboard counts
// ---------------------------------------------------------------------------
router.get("/summary", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    // Default summary window: last 12 months (matches /gdpr/requests).
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 12);

    const [accessRows, disclosures, ownActivity] = await Promise.all([
      getPatientAccessLog({ accountId, from, to, limit: 1000 }),
      getPatientDisclosures({ accountId, from, to, limit: 1000 }),
      getPatientOwnActivity({ accountId, from, to, limit: 1000 }),
    ]);

    res.json({
      window: { from, to },
      counts: {
        totalEvents: accessRows.length,
        disclosures: disclosures.length,
        myActivity: ownActivity.length,
      },
      lastEventAt: accessRows[0]?.timestamp ?? null,
    });
  } catch (err) {
    console.error("[MyAuditTrail] /summary error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/my-audit-trail/signed-report  (H10 — Ed25519-signed envelope)
// Returns the full disclosure-accounting + access log + own-activity in one
// signed JSON document. The recipient (patient, regulator, attorney) can
// verify integrity via POST /api/reports/verify or out-of-band with the JWK.
// ---------------------------------------------------------------------------
router.get("/signed-report", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const range = parseRange(req);
    const [accessLog, disclosures, myActivity] = await Promise.all([
      getPatientAccessLog({ accountId, ...range }),
      getPatientDisclosures({ accountId, ...range }),
      getPatientOwnActivity({ accountId, ...range }),
    ]);
    const payload = {
      issuer: "tabula-medica",
      reportType: "patient-audit-trail",
      reportSpec: "HIPAA §164.528 + §164.312(b)",
      subject: { accountId },
      generatedAt: new Date().toISOString(),
      window: {
        from: range.from?.toISOString() ?? null,
        to: range.to?.toISOString() ?? null,
      },
      counts: {
        totalEvents: accessLog.length,
        disclosures: disclosures.length,
        myActivity: myActivity.length,
      },
      events: { accessLog, disclosures, myActivity },
    };
    const envelope = await getReportSigner().sign(payload);
    logAudit("signed_report", accountId, {
      keyId: envelope.signature.keyId,
      events: accessLog.length,
    });
    res.setHeader("X-Signature-KeyId", envelope.signature.keyId);
    res.setHeader("X-Signature-Algorithm", envelope.signature.algorithm);
    res.json(envelope);
  } catch (err) {
    console.error("[MyAuditTrail] /signed-report error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// Sanity probe — counts raw audit_log rows for the user without any
// categorization. Useful for "why are my exports empty" debugging.
router.get("/_debug/raw-count", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const rows = await db
      .select({ id: auditLogTable.id })
      .from(auditLogTable)
      .where(eq(auditLogTable.accountId, accountId))
      .limit(1000);
    res.json({ rawCount: rows.length });
  } catch (err) {
    console.error("[MyAuditTrail] /_debug/raw-count error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
