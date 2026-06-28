import { Router, type Request, type Response } from "express";
import { eq, asc, desc, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  accounts,
  profiles,
  documentsTable,
  auditLogTable,
} from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { resolveAccountId } from "../middleware/require-phi-access";
import { decryptPhi, isEncrypted } from "../security/phi-encryption";

const router = Router();

/**
 * GDPR / Data-Rights Core (account-scoped, self-serve)
 *
 * Three legally-mandated capabilities, all stored in EXISTING jsonb columns
 * (NO schema migration):
 *
 *   1. Right to erasure  -> safe 30-day grace-period deletion flow.
 *   2. DSAR data export  -> one-shot JSON download of the caller's own data.
 *   3. Consent recording -> append-only consent ledger.
 *
 * The `accounts` table has NO jsonb/metadata column, so account-level GDPR
 * state (deletion schedule + consent ledger) is stored on the account's
 * PRIMARY profile under `profiles.metadata.accountDeletion` and
 * `profiles.metadata.consents`. This mirrors how patient-contacts-routes.ts
 * stores `metadata.contacts`.
 *
 * Every route is gated by `isAuthenticated` and resolves ownership via
 * `resolveAccountId(req)` (account derived from the authenticated session).
 * No route can read or write another account's data.
 *
 * IMPORTANT: This file does NOT auto-delete anything. The actual hard purge is
 * a dormant, manually-invoked operator function (`purgeExpiredDeletions`).
 */

interface AuthRequest extends Request {
  user?: {
    claims?: {
      sub: string;
      email?: string;
    };
  };
}

const GRACE_DAYS = 30;

// ---- Shared helpers -------------------------------------------------------

function clientIp(req: Request): string | null {
  const xf = req.headers["x-forwarded-for"];
  const fwd = Array.isArray(xf) ? xf[0] : xf;
  const raw =
    (fwd ? fwd.split(",")[0].trim() : "") ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  const candidate = raw.replace(/^::ffff:/, "");
  const isV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(candidate);
  const isV6 = candidate.includes(":") && /^[0-9a-fA-F:]+$/.test(candidate);
  return isV4 || isV6 ? raw : null;
}

// Resolve the authenticated account, or return a structured error.
async function requireAccount(req: AuthRequest) {
  if (!req.user?.claims?.sub) {
    return { error: { status: 401, body: { error: "AUTH_REQUIRED" } } };
  }
  const accountId = await resolveAccountId(req);
  if (!accountId) {
    return {
      error: { status: 403, body: { error: "ACCOUNT_NOT_PROVISIONED" } },
    };
  }
  return { accountId };
}

// Load all profiles owned by the account, oldest first.
async function loadAccountProfiles(accountId: string) {
  return db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .orderBy(asc(profiles.createdAt));
}

// The "primary" profile carries account-level GDPR state. Prefer a "self"
// profile, otherwise the oldest. Returns null if the account has no profile.
function pickPrimary<T extends { profileType: string }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows.find((p) => p.profileType === "self") ?? rows[0];
}

// Best-effort audit row. Never throws — auditing must not block the action.
async function writeAudit(
  req: Request,
  accountId: string,
  profileId: string | null,
  action: string,
) {
  try {
    await db.insert(auditLogTable).values({
      accountId,
      profileId: profileId ?? undefined,
      action,
      targetType: "account",
      ipAddress: clientIp(req),
      userAgent:
        typeof req.headers["user-agent"] === "string"
          ? req.headers["user-agent"]
          : null,
      appSource: "tabula-medica",
    });
  } catch (err: any) {
    console.error(`[GDPR-Account] audit write failed (${action}):`, err?.message);
  }
}

// Recursively decrypt any AES-GCM-encrypted strings inside a value so the
// patient receives a HUMAN-READABLE export of their OWN data. Tolerates legacy
// plaintext. Never mutates the source object.
function decryptDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return isEncrypted(value) ? safeDecrypt(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map(decryptDeep);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decryptDeep(v);
    }
    return out;
  }
  return value;
}

function safeDecrypt(value: string): string {
  try {
    return decryptPhi(value);
  } catch {
    // If a value can't be decrypted (key rotation, corruption) we redact it
    // rather than fail the whole export.
    return "[unable to decrypt]";
  }
}

// =========================================================================
// 1. ACCOUNT DELETION — 30-day grace period (NO immediate hard delete)
// =========================================================================

const deletionRequestSchema = z.object({
  // The client MUST send the literal string "DELETE" to confirm intent.
  confirm: z.string(),
  reason: z.string().trim().max(1000).optional(),
});

type AccountDeletion = {
  status: "scheduled" | "cancelled";
  requestedAt: string;
  purgeAfter: string;
  reason?: string;
  cancelledAt?: string;
};

// POST /api/account/deletion/request
router.post(
  "/deletion/request",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      // GUARD: require the literal "DELETE" confirmation string. Anything else
      // is rejected before any state changes — prevents accidental deletion.
      const parsed = deletionRequestSchema.safeParse(req.body);
      if (!parsed.success || parsed.data.confirm !== "DELETE") {
        return res.status(400).json({
          error: "CONFIRMATION_REQUIRED",
          message: 'You must send confirm:"DELETE" to schedule account deletion.',
        });
      }

      const acc = await requireAccount(req);
      if ("error" in acc) {
        return res.status(acc.error.status).json(acc.error.body);
      }

      const rows = await loadAccountProfiles(acc.accountId);
      const primary = pickPrimary(rows);
      if (!primary) {
        return res.status(404).json({ error: "NO_PROFILE" });
      }

      const now = new Date();
      const purgeAfter = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);

      const deletion: AccountDeletion = {
        status: "scheduled",
        requestedAt: now.toISOString(),
        purgeAfter: purgeAfter.toISOString(),
        reason: parsed.data.reason,
      };

      const metadata = (primary.metadata ?? {}) as Record<string, unknown>;
      await db
        .update(profiles)
        .set({
          metadata: { ...metadata, accountDeletion: deletion },
          updatedAt: now,
        })
        .where(eq(profiles.id, primary.id));

      await writeAudit(req, acc.accountId, primary.id, "account_deletion_requested");

      // NOTE: data is NOT deleted now. A purge can only happen later, manually,
      // via the dormant purgeExpiredDeletions() operator function below.
      res.json({
        status: "scheduled",
        purgeAfter: deletion.purgeAfter,
        graceDays: GRACE_DAYS,
        message: `Your account is scheduled for permanent deletion on ${purgeAfter.toLocaleDateString()}. You can cancel any time before then.`,
      });
    } catch (err: any) {
      console.error("[GDPR-Account] deletion/request failed:", err?.message);
      res.status(500).json({ error: "Failed to schedule deletion" });
    }
  },
);

// POST /api/account/deletion/cancel
router.post(
  "/deletion/cancel",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const acc = await requireAccount(req);
      if ("error" in acc) {
        return res.status(acc.error.status).json(acc.error.body);
      }

      const rows = await loadAccountProfiles(acc.accountId);
      const primary = pickPrimary(rows);
      if (!primary) {
        return res.status(404).json({ error: "NO_PROFILE" });
      }

      const metadata = (primary.metadata ?? {}) as Record<string, unknown>;
      const existing = metadata.accountDeletion as AccountDeletion | undefined;
      if (!existing || existing.status !== "scheduled") {
        return res.status(404).json({ error: "NO_SCHEDULED_DELETION" });
      }

      const cancelled: AccountDeletion = {
        ...existing,
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      };

      await db
        .update(profiles)
        .set({
          metadata: { ...metadata, accountDeletion: cancelled },
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, primary.id));

      await writeAudit(req, acc.accountId, primary.id, "account_deletion_cancelled");

      res.json({ status: "cancelled" });
    } catch (err: any) {
      console.error("[GDPR-Account] deletion/cancel failed:", err?.message);
      res.status(500).json({ error: "Failed to cancel deletion" });
    }
  },
);

// GET /api/account/deletion/status
router.get(
  "/deletion/status",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const acc = await requireAccount(req);
      if ("error" in acc) {
        return res.status(acc.error.status).json(acc.error.body);
      }

      const rows = await loadAccountProfiles(acc.accountId);
      const primary = pickPrimary(rows);
      const metadata = (primary?.metadata ?? {}) as Record<string, unknown>;
      const deletion = metadata.accountDeletion as AccountDeletion | undefined;

      if (!deletion) {
        return res.json({ status: "none", purgeAfter: null });
      }
      res.json({
        status: deletion.status,
        purgeAfter: deletion.status === "scheduled" ? deletion.purgeAfter : null,
        requestedAt: deletion.requestedAt,
      });
    } catch (err: any) {
      console.error("[GDPR-Account] deletion/status failed:", err?.message);
      res.status(500).json({ error: "Failed to read deletion status" });
    }
  },
);

// =========================================================================
// 2. DSAR DATA EXPORT — one JSON file of the caller's OWN data
// =========================================================================

// GET /api/account/export
router.get(
  "/export",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const acc = await requireAccount(req);
      if ("error" in acc) {
        return res.status(acc.error.status).json(acc.error.body);
      }

      // Account — NON-secret fields only. Never include passwordHash,
      // emailHash, or any beta-consent signature/IP hash material.
      const [account] = await db
        .select({
          id: accounts.id,
          email: accounts.email,
          region: accounts.region,
          mfaEnabled: accounts.mfaEnabled,
          phiAccessUnlocked: accounts.phiAccessUnlocked,
          betaConsentVersion: accounts.betaConsentVersion,
          betaConsentSignedAt: accounts.betaConsentSignedAt,
          createdAt: accounts.createdAt,
          updatedAt: accounts.updatedAt,
        })
        .from(accounts)
        .where(eq(accounts.id, acc.accountId))
        .limit(1);

      // OWNERSHIP: every profile filtered to this account. PHI in metadata is
      // decrypted (deeply) because this is the patient's own data going to the
      // patient. Consents + deletion state ride along inside metadata.
      const profileRows = await loadAccountProfiles(acc.accountId);
      const exportedProfiles = profileRows.map((p) => ({
        id: p.id,
        profileType: p.profileType,
        fullName: p.fullName,
        dob: p.dob,
        preferredLanguage: p.preferredLanguage,
        simplifiedMode: p.simplifiedMode,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        metadata: decryptDeep(p.metadata ?? {}),
      }));

      // Documents — metadata only (titles/dates/keys), not binary content,
      // scoped to the caller's profiles.
      const profileIds = profileRows.map((p) => p.id);
      const documents = profileIds.length
        ? (await Promise.all(
            profileIds.map((pid) =>
              db
                .select({
                  id: documentsTable.id,
                  profileId: documentsTable.profileId,
                  title: documentsTable.title,
                  source: documentsTable.source,
                  dateOfService: documentsTable.dateOfService,
                  mimeType: documentsTable.mimeType,
                  isSensitive: documentsTable.isSensitive,
                  createdAt: documentsTable.createdAt,
                })
                .from(documentsTable)
                .where(eq(documentsTable.profileId, pid)),
            ),
          )).flat()
        : [];

      // Contacts / emergency info live inside profile metadata (already
      // decrypted above); surface them explicitly for convenience.
      const contactsAndEmergency = exportedProfiles.map((p) => ({
        profileId: p.id,
        contacts: (p.metadata as Record<string, unknown>)?.contacts ?? null,
        emergency: (p.metadata as Record<string, unknown>)?.emergency ?? null,
      }));

      // Audit-log rows for this account.
      const auditLog = await db
        .select({
          id: auditLogTable.id,
          action: auditLogTable.action,
          targetType: auditLogTable.targetType,
          targetId: auditLogTable.targetId,
          profileId: auditLogTable.profileId,
          createdAt: auditLogTable.createdAt,
        })
        .from(auditLogTable)
        .where(eq(auditLogTable.accountId, acc.accountId))
        .orderBy(desc(auditLogTable.createdAt))
        .limit(5000);

      await writeAudit(req, acc.accountId, null, "data_exported");

      const payload = {
        exportType: "tabula-medica-dsar",
        generatedAt: new Date().toISOString(),
        account,
        profiles: exportedProfiles,
        documents,
        contactsAndEmergency,
        auditLog,
      };

      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tabula-medica-export-${date}.json"`,
      );
      res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (err: any) {
      console.error("[GDPR-Account] export failed:", err?.message);
      res.status(500).json({ error: "Failed to export data" });
    }
  },
);

// =========================================================================
// 3. CONSENT RECORDING — append-only ledger in profile metadata
// =========================================================================

const consentSchema = z.object({
  type: z.string().trim().min(1).max(100), // e.g. gdpr_processing, emergency_sharing, research
  granted: z.boolean(),
  version: z.string().trim().max(50).optional(),
});

type ConsentRecord = {
  type: string;
  granted: boolean;
  version?: string;
  at: string;
  ip: string | null;
};

// POST /api/account/consent — append a consent record.
router.post(
  "/consent",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = consentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.issues,
        });
      }

      const acc = await requireAccount(req);
      if ("error" in acc) {
        return res.status(acc.error.status).json(acc.error.body);
      }

      const rows = await loadAccountProfiles(acc.accountId);
      const primary = pickPrimary(rows);
      if (!primary) {
        return res.status(404).json({ error: "NO_PROFILE" });
      }

      const metadata = (primary.metadata ?? {}) as Record<string, unknown>;
      const consents = Array.isArray(metadata.consents)
        ? (metadata.consents as ConsentRecord[])
        : [];

      const record: ConsentRecord = {
        type: parsed.data.type,
        granted: parsed.data.granted,
        version: parsed.data.version,
        at: new Date().toISOString(),
        ip: clientIp(req),
      };

      // APPEND-ONLY: never overwrite prior consent history.
      const nextConsents = [...consents, record];

      await db
        .update(profiles)
        .set({
          metadata: { ...metadata, consents: nextConsents },
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, primary.id));

      await writeAudit(req, acc.accountId, primary.id, "consent_updated");

      res.json({ ok: true, consent: record });
    } catch (err: any) {
      console.error("[GDPR-Account] consent POST failed:", err?.message);
      res.status(500).json({ error: "Failed to record consent" });
    }
  },
);

// GET /api/account/consent — list current consents (full ledger).
router.get(
  "/consent",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const acc = await requireAccount(req);
      if ("error" in acc) {
        return res.status(acc.error.status).json(acc.error.body);
      }

      const rows = await loadAccountProfiles(acc.accountId);
      const primary = pickPrimary(rows);
      const metadata = (primary?.metadata ?? {}) as Record<string, unknown>;
      const consents = Array.isArray(metadata.consents)
        ? (metadata.consents as ConsentRecord[])
        : [];

      // Also return the latest state per consent type for easy toggling.
      const latestByType: Record<string, ConsentRecord> = {};
      for (const c of consents) {
        latestByType[c.type] = c;
      }

      res.json({ consents, latestByType });
    } catch (err: any) {
      console.error("[GDPR-Account] consent GET failed:", err?.message);
      res.status(500).json({ error: "Failed to read consents" });
    }
  },
);

// =========================================================================
// DORMANT OPERATOR FUNCTION — NOT auto-invoked, NOT scheduled.
// =========================================================================
/**
 * purgeExpiredDeletions
 * ---------------------
 * Hard-deletes accounts whose scheduled deletion grace period has elapsed.
 *
 * ⚠️ THIS IS INTENTIONALLY NOT WIRED TO ANY CRON / TIMER / STARTUP HOOK.
 *    It must be invoked MANUALLY by an operator, after review, e.g. from a
 *    one-off maintenance script:
 *
 *        import { purgeExpiredDeletions } from "./routes/account-gdpr-routes";
 *        await purgeExpiredDeletions({ dryRun: true });   // inspect first
 *        await purgeExpiredDeletions({ dryRun: false });  // then commit
 *
 *    Rationale: shipping an auto-deleter against a fragile production DB is
 *    unacceptable. Deletion of real patient data must be a deliberate,
 *    reviewed, reversible-until-the-last-moment operation.
 *
 * Behaviour:
 *   - Finds primary profiles whose metadata.accountDeletion.status ==
 *     "scheduled" AND purgeAfter <= now.
 *   - Deletes the parent `accounts` row. Drizzle/Postgres ON DELETE CASCADE
 *     on profiles/documents/etc. removes all child rows automatically.
 *
 * TODO (operator, before enabling): also delete the patient's GCS objects
 *   (documentsTable.objectKey, profiles.photoObjectKey). The DB cascade does
 *   NOT touch object storage — orphaned blobs must be swept separately.
 */
export async function purgeExpiredDeletions(
  opts: { dryRun?: boolean } = { dryRun: true },
): Promise<{ candidates: string[]; purged: string[] }> {
  const dryRun = opts.dryRun !== false; // default to dry-run for safety
  const now = new Date();

  // Scan profiles that carry a scheduled deletion. metadata is jsonb; we filter
  // in JS for clarity rather than relying on jsonb operators.
  const candidateProfiles = await db
    .select({
      accountId: profiles.accountId,
      metadata: profiles.metadata,
    })
    .from(profiles)
    .where(lte(profiles.createdAt, now)); // cheap predicate; real filter below

  const candidates: string[] = [];
  for (const p of candidateProfiles) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    const del = meta.accountDeletion as AccountDeletion | undefined;
    if (
      del &&
      del.status === "scheduled" &&
      new Date(del.purgeAfter).getTime() <= now.getTime()
    ) {
      candidates.push(p.accountId);
    }
  }

  if (dryRun) {
    console.log(
      `[GDPR-Account] purgeExpiredDeletions DRY-RUN — ${candidates.length} account(s) eligible:`,
      candidates,
    );
    return { candidates, purged: [] };
  }

  const purged: string[] = [];
  for (const accountId of candidates) {
    // TODO: delete GCS objects for this account's profiles/documents FIRST.
    await db.delete(accounts).where(eq(accounts.id, accountId)); // cascade
    purged.push(accountId);
    console.log(`[GDPR-Account] purged account ${accountId} (cascade)`);
  }
  return { candidates, purged };
}

console.log("[GDPR-Account] Data-rights routes initialized (deletion/export/consent)");

export default router;
