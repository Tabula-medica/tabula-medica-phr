// In-memory RCM store (tenant-scoped). Mirrors the EHR pattern: runtime in-memory until a
// DATABASE_URL-backed store is provided. Interface is async so a Drizzle/PgStore drop-in
// needs no route changes.
import type { Claim, Coverage, Denial, LedgerEntry, Patient, PayerContract, Remittance, WorkItem, BenefitSnapshot } from "./types";
import type { PriorAuth } from "./prior-auth";
import { DEFAULT_CONTRACTS } from "./contracts";
import { newId, nowIso } from "./util";

export interface AgentAuditRow { id: string; at: string; tenantId: string; agent: string; step: string; detail: Record<string, unknown>; outcome: "ok" | "blocked" | "needs-approval" | "error" }
export interface Approval { id: string; tenantId: string; agent: string; action: string; payload: Record<string, unknown>; reason: string; status: "pending" | "approved" | "rejected"; createdAt: string; decidedAt?: string; decidedBy?: string }

interface Tenant {
  patients: Map<string, Patient>;
  coverages: Map<string, Coverage>;
  benefits: Map<string, BenefitSnapshot>; // by coverageId
  claims: Map<string, Claim>;
  denials: Map<string, Denial>;
  remittances: Map<string, Remittance>;
  ledger: LedgerEntry[];
  auths: Map<string, PriorAuth>;
  workItems: Map<string, WorkItem>;
  contracts: Map<string, PayerContract>;
  agentAudit: AgentAuditRow[];
  approvals: Map<string, Approval>;
  scrubStats: { total: number; firstPassClean: number };
  chargeLagSamples: number[];
}

function freshTenant(): Tenant {
  return { patients: new Map(), coverages: new Map(), benefits: new Map(), claims: new Map(), denials: new Map(), remittances: new Map(), ledger: [], auths: new Map(), workItems: new Map(), contracts: new Map(DEFAULT_CONTRACTS.map((c) => [c.payerId, c])), agentAudit: [], approvals: new Map(), scrubStats: { total: 0, firstPassClean: 0 }, chargeLagSamples: [] };
}

export class RcmStore {
  private tenants = new Map<string, Tenant>();
  private t(tenantId: string): Tenant { let t = this.tenants.get(tenantId); if (!t) { t = freshTenant(); this.tenants.set(tenantId, t); } return t; }
  reset(tenantId?: string): void { if (tenantId) this.tenants.delete(tenantId); else this.tenants.clear(); }

  async upsertPatient(tid: string, p: Patient): Promise<Patient> { this.t(tid).patients.set(p.id, p); return p; }
  async getPatient(tid: string, id: string): Promise<Patient | undefined> { return this.t(tid).patients.get(id); }
  async listPatients(tid: string): Promise<Patient[]> { return Array.from(this.t(tid).patients.values()); }

  async upsertCoverage(tid: string, c: Coverage): Promise<Coverage> { this.t(tid).coverages.set(c.id, c); return c; }
  async getCoverage(tid: string, id: string): Promise<Coverage | undefined> { return this.t(tid).coverages.get(id); }
  async coveragesForPatient(tid: string, patientId: string): Promise<Coverage[]> { return Array.from(this.t(tid).coverages.values()).filter((c) => c.patientId === patientId).sort((a, b) => a.priority.localeCompare(b.priority)); }
  async setBenefits(tid: string, coverageId: string, b: BenefitSnapshot): Promise<void> { this.t(tid).benefits.set(coverageId, b); }
  async getBenefits(tid: string, coverageId: string): Promise<BenefitSnapshot | undefined> { return this.t(tid).benefits.get(coverageId); }

  async upsertClaim(tid: string, c: Claim): Promise<Claim> { this.t(tid).claims.set(c.id, c); return c; }
  async getClaim(tid: string, id: string): Promise<Claim | undefined> { return this.t(tid).claims.get(id); }
  async listClaims(tid: string, filter?: { status?: Claim["status"]; patientId?: string }): Promise<Claim[]> { return Array.from(this.t(tid).claims.values()).filter((c) => (!filter?.status || c.status === filter.status) && (!filter?.patientId || c.patientId === filter.patientId)); }
  async claimsById(tid: string): Promise<Record<string, Claim>> { return Object.fromEntries(this.t(tid).claims); }

  async upsertDenial(tid: string, d: Denial): Promise<Denial> { this.t(tid).denials.set(d.id, d); return d; }
  async getDenial(tid: string, id: string): Promise<Denial | undefined> { return this.t(tid).denials.get(id); }
  async listDenials(tid: string, status?: Denial["status"]): Promise<Denial[]> { return Array.from(this.t(tid).denials.values()).filter((d) => !status || d.status === status); }

  async addRemittance(tid: string, r: Remittance): Promise<Remittance> { this.t(tid).remittances.set(r.id, r); return r; }
  async listRemittances(tid: string): Promise<Remittance[]> { return Array.from(this.t(tid).remittances.values()); }

  async postLedger(tid: string, entries: LedgerEntry[]): Promise<void> { this.t(tid).ledger.push(...entries); }
  async ledger(tid: string, patientId?: string): Promise<LedgerEntry[]> { const l = this.t(tid).ledger; return patientId ? l.filter((e) => e.patientId === patientId) : [...l]; }
  async ledgerByPatient(tid: string): Promise<Record<string, LedgerEntry[]>> { const out: Record<string, LedgerEntry[]> = {}; for (const e of this.t(tid).ledger) (out[e.patientId] = out[e.patientId] ?? []).push(e); return out; }

  async upsertAuth(tid: string, a: PriorAuth): Promise<PriorAuth> { this.t(tid).auths.set(a.id, a); return a; }
  async getAuth(tid: string, id: string): Promise<PriorAuth | undefined> { return this.t(tid).auths.get(id); }
  async listAuths(tid: string, patientId?: string): Promise<PriorAuth[]> { return Array.from(this.t(tid).auths.values()).filter((a) => !patientId || a.patientId === patientId); }

  async addWorkItems(tid: string, items: WorkItem[]): Promise<WorkItem[]> { const t = this.t(tid); for (const w of items) t.workItems.set(w.id, w); return items; }
  async updateWorkItem(tid: string, id: string, patch: Partial<WorkItem>): Promise<WorkItem | undefined> { const t = this.t(tid); const w = t.workItems.get(id); if (!w) return undefined; const n = { ...w, ...patch }; t.workItems.set(id, n); return n; }
  async listWorkItems(tid: string, queue?: WorkItem["queue"]): Promise<WorkItem[]> { return Array.from(this.t(tid).workItems.values()).filter((w) => !queue || w.queue === queue); }
  async findOpenWorkItem(tid: string, pred: (w: WorkItem) => boolean): Promise<WorkItem | undefined> { return Array.from(this.t(tid).workItems.values()).find((w) => (w.status === "open" || w.status === "in-progress") && pred(w)); }

  async contracts(tid: string): Promise<Record<string, PayerContract>> { return Object.fromEntries(this.t(tid).contracts); }
  async getContract(tid: string, payerId: string): Promise<PayerContract | undefined> { return this.t(tid).contracts.get(payerId); }
  async upsertContract(tid: string, c: PayerContract): Promise<PayerContract> { this.t(tid).contracts.set(c.payerId, c); return c; }

  async audit(tid: string, row: Omit<AgentAuditRow, "id" | "at" | "tenantId">): Promise<AgentAuditRow> { const r: AgentAuditRow = { id: newId("aud"), at: nowIso(), tenantId: tid, ...row }; this.t(tid).agentAudit.push(r); return r; }
  async listAudit(tid: string, limit = 200): Promise<AgentAuditRow[]> { return this.t(tid).agentAudit.slice(-limit).reverse(); }

  async requestApproval(tid: string, a: Omit<Approval, "id" | "tenantId" | "status" | "createdAt">): Promise<Approval> { const r: Approval = { id: newId("apr"), tenantId: tid, status: "pending", createdAt: nowIso(), ...a }; this.t(tid).approvals.set(r.id, r); return r; }
  async decideApproval(tid: string, id: string, status: "approved" | "rejected", by: string): Promise<Approval | undefined> { const t = this.t(tid); const a = t.approvals.get(id); if (!a) return undefined; const n: Approval = { ...a, status, decidedAt: nowIso(), decidedBy: by }; t.approvals.set(id, n); return n; }
  async listApprovals(tid: string, status?: Approval["status"]): Promise<Approval[]> { return Array.from(this.t(tid).approvals.values()).filter((a) => !status || a.status === status); }

  async recordScrub(tid: string, clean: boolean): Promise<void> { const s = this.t(tid).scrubStats; s.total++; if (clean) s.firstPassClean++; }
  async scrubStats(tid: string): Promise<{ total: number; firstPassClean: number }> { return { ...this.t(tid).scrubStats }; }
  async recordChargeLag(tid: string, days: number): Promise<void> { this.t(tid).chargeLagSamples.push(days); }
  async chargeLagSamples(tid: string): Promise<number[]> { return [...this.t(tid).chargeLagSamples]; }
}

export const rcmStore = new RcmStore();
