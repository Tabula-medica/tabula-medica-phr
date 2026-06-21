/**
 * H3 — Consolidated PHI Access Log Service
 *
 * Single canonical read-side contract for "all events involving a patient's
 * PHI". Today we read from two existing tables:
 *   - audit_log_new           (general PHI access events)
 *   - audit_export_requests   (formal exports = HIPAA "disclosures")
 *
 * If/when the spec's full `phi_access_logs` table lands, this service is
 * the only thing that needs to change. Every patient-facing surface
 * (H4 /my-audit-trail, R1.1/R1.2/R1.3 reports) goes through here.
 */

import { eq, desc, and, gte, lte, or, ilike } from "drizzle-orm";
import { db } from "../db";
import {
  auditLogTable,
  auditExportRequestsTable,
} from "@shared/schema";

export type PhiAccessEvent = {
  id: string;
  source: "audit_log" | "export_request";
  timestamp: Date;
  action: string;
  category: "access" | "disclosure" | "self_activity" | "system";
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
};

export type AccessLogQuery = {
  accountId: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

const DISCLOSURE_PATTERNS = [
  "%share%",
  "%export%",
  "%disclos%",
  "%send%",
  "%forward%",
  "%transmit%",
  "%release%",
];

/**
 * Categorize a raw audit action verb. Patient-facing UI uses this to bucket
 * events into the three §164.528-aligned views.
 *
 * Heuristics today:
 *   - share/export/send/disclose/forward/transmit/release  → "disclosure"
 *   - login/logout/profile/preferences/view-self/own-*     → "self_activity"
 *   - system.*, cron, sync                                 → "system"
 *   - everything else                                      → "access"
 *
 * This is conservative on purpose: when in doubt we surface the event in the
 * "access" bucket so patients see MORE of their data, not less.
 */
export function categorizeAction(action: string): PhiAccessEvent["category"] {
  const a = action.toLowerCase();
  if (
    a.includes("share") ||
    a.includes("export") ||
    a.includes("disclos") ||
    a.includes("send") ||
    a.includes("forward") ||
    a.includes("transmit") ||
    a.includes("release")
  ) {
    return "disclosure";
  }
  if (
    a.startsWith("system.") ||
    a.includes("cron") ||
    a.includes("sync") ||
    a.includes("backup")
  ) {
    return "system";
  }
  if (
    a.includes("login") ||
    a.includes("logout") ||
    a.includes("password") ||
    a.includes("mfa") ||
    a.includes("profile.update") ||
    a.includes("preferences") ||
    a.startsWith("self.") ||
    a.startsWith("own.")
  ) {
    return "self_activity";
  }
  return "access";
}

function clampLimit(n: number | undefined): number {
  if (!n || n <= 0) return 200;
  return Math.min(n, 1000);
}

/**
 * R1.2 — Full PHI access log. Every recorded event involving the patient's
 * account, regardless of who initiated it.
 */
export async function getPatientAccessLog({
  accountId,
  from,
  to,
  limit,
}: AccessLogQuery): Promise<PhiAccessEvent[]> {
  const filters = [eq(auditLogTable.accountId, accountId)];
  if (from) filters.push(gte(auditLogTable.createdAt, from));
  if (to) filters.push(lte(auditLogTable.createdAt, to));

  const rows = await db
    .select()
    .from(auditLogTable)
    .where(and(...filters))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(clampLimit(limit));

  return rows.map<PhiAccessEvent>((r) => ({
    id: r.id,
    source: "audit_log",
    timestamp: r.createdAt,
    action: r.action,
    category: categorizeAction(r.action),
    targetType: r.targetType ?? null,
    targetId: r.targetId ?? null,
    ipAddress: r.ipAddress ? String(r.ipAddress) : null,
    userAgent: r.userAgent ?? null,
    details: { profileId: r.profileId },
  }));
}

/**
 * R1.1 — Accounting of Disclosures. Per §164.528, the patient's right to a
 * record of every disclosure of their PHI outside treatment / payment /
 * operations. We pull from two sources:
 *   - audit_log_new rows whose action verb implies disclosure
 *   - audit_export_requests where requestedBy = the patient's account
 */
export async function getPatientDisclosures({
  accountId,
  from,
  to,
  limit,
}: AccessLogQuery): Promise<PhiAccessEvent[]> {
  const auditFilters = [eq(auditLogTable.accountId, accountId)];
  if (from) auditFilters.push(gte(auditLogTable.createdAt, from));
  if (to) auditFilters.push(lte(auditLogTable.createdAt, to));

  const disclosurePattern = or(
    ...DISCLOSURE_PATTERNS.map((p) => ilike(auditLogTable.action, p)),
  );
  if (disclosurePattern) auditFilters.push(disclosurePattern);

  const auditRows = await db
    .select()
    .from(auditLogTable)
    .where(and(...auditFilters))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(clampLimit(limit));

  const exportFilters = [eq(auditExportRequestsTable.requestedBy, accountId)];
  if (from) exportFilters.push(gte(auditExportRequestsTable.createdAt, from));
  if (to) exportFilters.push(lte(auditExportRequestsTable.createdAt, to));

  const exportRows = await db
    .select()
    .from(auditExportRequestsTable)
    .where(and(...exportFilters))
    .orderBy(desc(auditExportRequestsTable.createdAt))
    .limit(clampLimit(limit));

  const merged: PhiAccessEvent[] = [
    ...auditRows.map<PhiAccessEvent>((r) => ({
      id: r.id,
      source: "audit_log",
      timestamp: r.createdAt,
      action: r.action,
      category: "disclosure",
      targetType: r.targetType ?? null,
      targetId: r.targetId ?? null,
      ipAddress: r.ipAddress ? String(r.ipAddress) : null,
      userAgent: r.userAgent ?? null,
      details: { profileId: r.profileId },
    })),
    ...exportRows.map<PhiAccessEvent>((r) => ({
      id: r.id,
      source: "export_request",
      timestamp: r.createdAt,
      action: `export.${r.exportType}.${r.format}`,
      category: "disclosure",
      targetType: "export",
      targetId: null,
      ipAddress: null,
      userAgent: null,
      details: {
        status: r.status,
        format: r.format,
        exportType: r.exportType,
        completedAt: r.completedAt,
        fileUrl: r.fileUrl ? "[available]" : null,
      },
    })),
  ];

  merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return merged.slice(0, clampLimit(limit));
}

/**
 * R1.3 — Patient's own activity log. What the patient themselves did:
 * logins, profile edits, records they viewed, messages they sent.
 *
 * NOTE: audit_log_new today does not separate actor from subject
 * (a single accountId column). For now we surface events whose action verb
 * looks self-initiated. When the spec's `audit_events` table lands with
 * separate actor_id / target.patient_id columns, this will become exact.
 */
export async function getPatientOwnActivity({
  accountId,
  from,
  to,
  limit,
}: AccessLogQuery): Promise<PhiAccessEvent[]> {
  const all = await getPatientAccessLog({
    accountId,
    from,
    to,
    limit: clampLimit(limit),
  });
  return all.filter((e) => e.category === "self_activity");
}
