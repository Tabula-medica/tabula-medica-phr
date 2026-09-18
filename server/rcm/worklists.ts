// Unified work queue — every RCM stage emits WorkItems; humans (or agents with approval)
// work them by priority with SLA tracking. Pure prioritization helpers + builders.
import type { Claim, Denial, WorkItem, WorkQueue } from "./types";
import type { PriorAuth } from "./prior-auth";
import { addDays, daysBetween, newId, nowIso, todayIso } from "./util";

export const QUEUE_SLA_HOURS: Record<WorkQueue, number> = {
  eligibility: 24,
  "prior-auth": 48,
  "charge-review": 48,
  "coding-review": 48,
  "claim-edits": 24,
  "claim-followup": 72,
  denials: 72,
  underpayments: 120,
  "patient-balance": 168,
  "credit-balance": 720,
  "agent-approval": 24,
};

export function makeWorkItem(input: Omit<WorkItem, "id" | "createdAt" | "status" | "slaHours" | "dueAt"> & { dueAt?: string }): WorkItem {
  const createdAt = nowIso();
  const slaHours = QUEUE_SLA_HOURS[input.queue];
  return { ...input, id: newId("wi"), createdAt, status: "open", slaHours, dueAt: input.dueAt ?? new Date(Date.parse(createdAt) + slaHours * 3_600_000).toISOString() };
}

export function itemsFromDenials(denials: Denial[]): WorkItem[] {
  return denials.filter((d) => d.status === "open").map((d) => makeWorkItem({ queue: "denials", title: `Denial CARC ${d.carc} (${d.category}) $${d.amount.toFixed(2)}`, patientId: d.patientId, claimId: d.claimId, amount: d.amount, priority: d.priorityScore, dueAt: d.appealDeadline ? new Date(Date.parse(d.appealDeadline) - 7 * 86_400_000).toISOString() : undefined, source: "system", context: { denialId: d.id, remediation: d.remediation } }));
}

export function itemsFromClaimFollowUp(rows: Array<{ claim: Claim; daysOutstanding: number; reason: string }>): WorkItem[] {
  return rows.map((r) => makeWorkItem({ queue: "claim-followup", title: `${r.reason}: ${r.claim.payerName} $${r.claim.totalCharge.toFixed(2)}`, patientId: r.claim.patientId, claimId: r.claim.id, amount: r.claim.totalCharge, priority: Math.min(100, 40 + r.daysOutstanding + (r.claim.timelyFilingDeadline && daysBetween(todayIso(), r.claim.timelyFilingDeadline) <= 14 ? 30 : 0)), source: "system", context: { daysOutstanding: r.daysOutstanding } }));
}

export function itemsFromAuths(auths: PriorAuth[], today: string = todayIso()): WorkItem[] {
  const out: WorkItem[] = [];
  for (const a of auths) {
    if (a.status === "required") out.push(makeWorkItem({ queue: "prior-auth", title: `Auth needed: ${a.cpt}${a.missingDocumentation.length ? ` (missing: ${a.missingDocumentation.join(", ")})` : ""}`, patientId: a.patientId, priority: a.urgency === "urgent" ? 90 : 60, source: "system", context: { authId: a.id } }));
    else if ((a.status === "requested" || a.status === "pended") && a.slaDeadline && a.slaDeadline < nowIso()) out.push(makeWorkItem({ queue: "prior-auth", title: `Payer SLA breached on auth ${a.cpt}; escalate`, patientId: a.patientId, priority: 85, source: "system", context: { authId: a.id } }));
    else if (a.status === "approved" && a.validTo && daysBetween(today, a.validTo) <= 14 && daysBetween(today, a.validTo) >= 0) out.push(makeWorkItem({ queue: "prior-auth", title: `Auth ${a.cpt} expires ${a.validTo}; renew if ongoing`, patientId: a.patientId, priority: 50, dueAt: addDays(a.validTo, -7), source: "system", context: { authId: a.id } }));
  }
  return out;
}

export function itemsFromScrub(claim: Claim, errorCount: number): WorkItem[] {
  return errorCount > 0 ? [makeWorkItem({ queue: "claim-edits", title: `${errorCount} scrub error(s) on claim ${claim.id} (${claim.payerName})`, patientId: claim.patientId, claimId: claim.id, amount: claim.totalCharge, priority: Math.min(100, 50 + errorCount * 10), source: "system" })] : [];
}

export function sortQueue(items: WorkItem[], now: string = nowIso()): WorkItem[] {
  const overdue = (w: WorkItem) => (w.dueAt && w.dueAt < now ? 1 : 0);
  return [...items].filter((w) => w.status === "open" || w.status === "in-progress").sort((a, b) => overdue(b) - overdue(a) || b.priority - a.priority || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

export function queueSummary(items: WorkItem[], now: string = nowIso()): Record<WorkQueue, { open: number; overdue: number; amount: number }> {
  const out = Object.fromEntries((Object.keys(QUEUE_SLA_HOURS) as WorkQueue[]).map((q) => [q, { open: 0, overdue: 0, amount: 0 }])) as Record<WorkQueue, { open: number; overdue: number; amount: number }>;
  for (const w of items) {
    if (w.status !== "open" && w.status !== "in-progress") continue;
    out[w.queue].open++;
    if (w.dueAt && w.dueAt < now) out[w.queue].overdue++;
    out[w.queue].amount = Math.round((out[w.queue].amount + (w.amount ?? 0)) * 100) / 100;
  }
  return out;
}
