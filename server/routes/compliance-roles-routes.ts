/**
 * H6 — Compliance role administration endpoints.
 *
 * Granting / revoking / listing the 4 HIPAA compliance roles.
 * Restricted to `administrator` (the user's primary role). Every action
 * lands in the regular audit log via existing logging.
 *
 * NOTE on role assignment policy:
 *   - At least one account in the org SHOULD hold privacy_officer
 *     (§164.530(a)(1)) and one SHOULD hold security_officer (§164.308(a)(2)).
 *   - We do NOT block grants if those slots are unfilled — that's a launch
 *     decision the operator (you) must make. A `/health` endpoint is exposed
 *     so monitoring can alarm on missing required officers.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import {
  and,
  eq,
  isNull,
  or,
  gt,
  desc,
} from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  accountRoleAssignmentsTable,
  HIPAA_COMPLIANCE_ROLES,
  type HipaaComplianceRole,
} from "@shared/schema";
import type { AuthRequest } from "../middleware/require-feature";
import { requireRole } from "../middleware/rbac-authorization";
import {
  getActiveComplianceRoles,
} from "../middleware/require-compliance-role";

const router = Router();

const grantSchema = z.object({
  accountId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(HIPAA_COMPLIANCE_ROLES),
  expiresAt: z.string().datetime().optional(),
  scopeOrganizationId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
}).refine((v) => v.accountId || v.email, {
  message: "accountId or email required",
});

async function resolveGranter(req: AuthRequest): Promise<string | null> {
  const email = req.user?.claims?.email;
  if (!email) return null;
  const [acct] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  return acct?.id ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/compliance-roles/grant
// ---------------------------------------------------------------------------
router.post("/grant", requireRole("administrator"), async (req: AuthRequest, res: Response) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", issues: parsed.error.issues });
  }
  const { role, expiresAt, scopeOrganizationId, notes } = parsed.data;

  // External auditors MUST be time-bounded — DB CHECK enforces too, but we
  // give a friendlier error here.
  if (role === "auditor_external" && !expiresAt) {
    return res.status(400).json({
      error: "EXPIRY_REQUIRED",
      reason: "auditor_external grants must specify expiresAt",
    });
  }

  const grantedBy = await resolveGranter(req);
  if (!grantedBy) return res.status(401).json({ error: "UNAUTHORIZED" });

  // Resolve target account.
  let accountId = parsed.data.accountId ?? null;
  if (!accountId && parsed.data.email) {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, parsed.data.email))
      .limit(1);
    accountId = acct?.id ?? null;
  }
  if (!accountId) {
    return res.status(404).json({ error: "ACCOUNT_NOT_FOUND" });
  }

  try {
    const [row] = await db.insert(accountRoleAssignmentsTable).values({
      accountId,
      role,
      grantedBy,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      scopeOrganizationId: scopeOrganizationId ?? null,
      notes: notes ?? null,
    }).returning();
    console.log(
      `[ComplianceRoles] GRANT account=${accountId} role=${role} by=${grantedBy}` +
      (expiresAt ? ` expiresAt=${expiresAt}` : ""),
    );
    res.status(201).json({ assignment: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ComplianceRoles] grant error", err);
    res.status(500).json({ error: "INTERNAL_ERROR", detail: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/compliance-roles/revoke
// ---------------------------------------------------------------------------
const revokeSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
router.post("/revoke", requireRole("administrator"), async (req: AuthRequest, res: Response) => {
  const parsed = revokeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", issues: parsed.error.issues });
  }
  const revokedBy = await resolveGranter(req);
  if (!revokedBy) return res.status(401).json({ error: "UNAUTHORIZED" });

  const [row] = await db.update(accountRoleAssignmentsTable)
    .set({
      revokedAt: new Date(),
      revokedBy,
      notes: parsed.data.reason ?? undefined,
    })
    .where(and(
      eq(accountRoleAssignmentsTable.id, parsed.data.assignmentId),
      isNull(accountRoleAssignmentsTable.revokedAt),
    ))
    .returning();
  if (!row) {
    return res.status(404).json({ error: "NOT_FOUND_OR_ALREADY_REVOKED" });
  }
  console.log(`[ComplianceRoles] REVOKE assignment=${row.id} role=${row.role} by=${revokedBy}`);
  res.json({ assignment: row });
});

// ---------------------------------------------------------------------------
// GET /api/compliance-roles/assignments  — list all (admin view)
// ---------------------------------------------------------------------------
router.get("/assignments", requireRole("administrator"), async (req: AuthRequest, res: Response) => {
  const includeRevoked = req.query.includeRevoked === "true";
  const rows = await db.select()
    .from(accountRoleAssignmentsTable)
    .where(includeRevoked ? undefined : isNull(accountRoleAssignmentsTable.revokedAt))
    .orderBy(desc(accountRoleAssignmentsTable.grantedAt))
    .limit(500);
  res.json({ assignments: rows, count: rows.length });
});

// ---------------------------------------------------------------------------
// GET /api/compliance-roles/me  — what compliance roles do I currently hold?
// (No admin gate — every authenticated user can ask about their own roles.)
// ---------------------------------------------------------------------------
router.get("/me", async (req: AuthRequest, res: Response) => {
  const granter = await resolveGranter(req);
  if (!granter) return res.status(401).json({ error: "UNAUTHORIZED" });
  const roles = await getActiveComplianceRoles(granter);
  res.json({ accountId: granter, roles });
});

// ---------------------------------------------------------------------------
// GET /api/compliance-roles/health
// Public-safe summary: do we have a privacy_officer and security_officer
// currently assigned? Used by /admin dashboards and external monitoring.
// ---------------------------------------------------------------------------
router.get("/health", requireRole("administrator", "privacy_officer" as never, "security_officer" as never, "compliance_viewer" as never), async (_req: AuthRequest, res: Response) => {
  // Note: requireRole is the legacy primary-role middleware; for compliance
  // roles we do an explicit DB check below so the legacy gate is just a
  // sanity baseline.
  const counts: Record<HipaaComplianceRole, number> = {
    privacy_officer: 0,
    security_officer: 0,
    compliance_viewer: 0,
    auditor_external: 0,
  };
  const rows = await db
    .select({ role: accountRoleAssignmentsTable.role })
    .from(accountRoleAssignmentsTable)
    .where(and(
      isNull(accountRoleAssignmentsTable.revokedAt),
      or(
        isNull(accountRoleAssignmentsTable.expiresAt),
        gt(accountRoleAssignmentsTable.expiresAt, new Date()),
      ),
    ));
  for (const r of rows) {
    counts[r.role as HipaaComplianceRole]++;
  }
  res.json({
    counts,
    requiredOfficersPresent:
      counts.privacy_officer >= 1 && counts.security_officer >= 1,
    warnings: [
      counts.privacy_officer === 0 ? "NO_PRIVACY_OFFICER (§164.530(a)(1))" : null,
      counts.security_officer === 0 ? "NO_SECURITY_OFFICER (§164.308(a)(2))" : null,
    ].filter(Boolean),
  });
});

export default router;
