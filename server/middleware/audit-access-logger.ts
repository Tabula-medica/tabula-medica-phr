/**
 * H5 — Audit-of-audit middleware
 *
 * Wrap any router that exposes audit data (PHI access logs, disclosure
 * accountings, audit dashboards). One row per request lands in
 * `audit_access_log`, capturing who looked, when, and what they asked for.
 *
 * Per HITRUST 06.k and SOC2 CC7.2: every read of an audit trail is itself
 * a security-relevant event and must be recorded in a separate, also
 * append-only, store.
 *
 * Usage:
 *   import { auditAccessLogger } from "./middleware/audit-access-logger";
 *   router.use(auditAccessLogger("my-audit-trail"));
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { auditAccessLogTable, accounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AuthRequest } from "./require-feature";

function safeQuery(q: unknown): Record<string, unknown> | null {
  if (!q || typeof q !== "object") return null;
  // Strip anything that looks like a token or secret. Keep up to 32 keys.
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
    if (n >= 32) break;
    if (/token|secret|key|password|cookie/i.test(k)) continue;
    out[k] = typeof v === "string" && v.length > 256 ? `${v.slice(0, 256)}…` : v;
    n++;
  }
  return out;
}

async function resolveAccountId(req: AuthRequest): Promise<{ accountId: string | null; email: string | null }> {
  const email = req.user?.claims?.email ?? null;
  if (!email) return { accountId: null, email: null };
  try {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return { accountId: acct?.id ?? null, email };
  } catch {
    return { accountId: null, email };
  }
}

/**
 * Middleware factory. `surface` identifies which audit surface was hit
 * (e.g. "my-audit-trail", "admin-audit-dashboard") so reports can group.
 */
export function auditAccessLogger(surface: string) {
  return function middleware(req: Request, res: Response, next: NextFunction) {
    res.on("finish", () => {
      // Fire-and-forget; failure to write must NEVER break the request.
      // (Worst case: we lose one row of audit-of-audit, which is logged.)
      void (async () => {
        try {
          const { accountId, email } = await resolveAccountId(req as AuthRequest);
          await db.insert(auditAccessLogTable).values({
            accountId: accountId ?? undefined,
            email: email ?? undefined,
            endpoint: `${surface}${req.path}`,
            method: req.method,
            query: safeQuery(req.query),
            statusCode: res.statusCode,
            ipAddress: (req.ip ?? req.socket?.remoteAddress ?? null) as any,
            userAgent: req.get("user-agent") ?? undefined,
          });
        } catch (err) {
          console.error(`[AuditAccessLogger:${surface}] write failed`, err);
        }
      })();
    });
    next();
  };
}
