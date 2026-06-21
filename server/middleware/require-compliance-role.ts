/**
 * H6 — requireComplianceRole middleware
 *
 * Gate audit-dashboard / breach-response / privacy-investigation endpoints
 * behind one of the 4 HIPAA compliance roles defined in §164.308 / §164.530.
 *
 * Reads from account_role_assignments — a separate DB-backed store from the
 * user's primary role. One account may hold multiple compliance roles. The
 * auditor_external role is always time-bounded (DB CHECK + runtime re-check).
 *
 * Every check writes a row to audit_access_log via the H5 middleware that
 * the calling router should already have installed.
 */

import type { Request, Response, NextFunction } from "express";
import { and, eq, gt, isNull, or, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  accountRoleAssignmentsTable,
  type HipaaComplianceRole,
} from "@shared/schema";
import type { AuthRequest } from "./require-feature";

export interface ComplianceRoleContext {
  accountId: string;
  email: string;
  roles: HipaaComplianceRole[];
}

declare module "express-serve-static-core" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Request {
    complianceRole?: ComplianceRoleContext;
  }
}

/**
 * Resolve every active, non-expired compliance role for an account.
 * "Active" = revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()).
 */
export async function getActiveComplianceRoles(
  accountId: string,
): Promise<HipaaComplianceRole[]> {
  const rows = await db
    .select({ role: accountRoleAssignmentsTable.role })
    .from(accountRoleAssignmentsTable)
    .where(
      and(
        eq(accountRoleAssignmentsTable.accountId, accountId),
        isNull(accountRoleAssignmentsTable.revokedAt),
        or(
          isNull(accountRoleAssignmentsTable.expiresAt),
          gt(accountRoleAssignmentsTable.expiresAt, new Date()),
        ),
      ),
    );
  // Dedupe (an account could legitimately hold the same role from two grants).
  return Array.from(new Set(rows.map((r) => r.role as HipaaComplianceRole)));
}

async function resolveAccount(
  req: AuthRequest,
): Promise<{ accountId: string; email: string } | null> {
  const email = req.user?.claims?.email;
  if (!email) return null;
  try {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return acct ? { accountId: acct.id, email } : null;
  } catch {
    return null;
  }
}

/**
 * Require any one of the listed compliance roles. Use as:
 *   router.get("/dashboard", requireComplianceRole("privacy_officer", "security_officer"), handler);
 */
export function requireComplianceRole(...allowed: HipaaComplianceRole[]) {
  return async function middleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const acct = await resolveAccount(req as AuthRequest);
    if (!acct) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    const roles = await getActiveComplianceRoles(acct.accountId);
    const allowedSet = new Set<HipaaComplianceRole>(allowed);
    const matched = roles.filter((r) => allowedSet.has(r));
    if (matched.length === 0) {
      console.warn(
        `[ComplianceRole] DENIED account=${acct.accountId} required=${allowed.join("|")} held=${roles.join(",") || "none"}`,
      );
      return res.status(403).json({
        error: "FORBIDDEN",
        reason: "compliance_role_required",
        required: allowed,
        held: roles,
      });
    }
    req.complianceRole = { accountId: acct.accountId, email: acct.email, roles };
    next();
  };
}

/**
 * Soft variant — attaches `req.complianceRole` if any role is held but does
 * NOT block the request. Useful for endpoints whose response varies by role
 * (e.g. show extra columns to a privacy_officer).
 */
export function attachComplianceRole() {
  return async function middleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    const acct = await resolveAccount(req as AuthRequest);
    if (acct) {
      const roles = await getActiveComplianceRoles(acct.accountId);
      if (roles.length > 0) {
        req.complianceRole = { accountId: acct.accountId, email: acct.email, roles };
      }
    }
    next();
  };
}
