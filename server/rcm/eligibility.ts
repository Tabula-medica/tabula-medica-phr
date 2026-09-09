// Stage 1-3: eligibility & benefits (X12 270/271) + financial clearance.
// Pure logic + a vendor seam (`EligibilityVendor`) that is stub-by-default. Nothing pretends
// to be a live payer answer: `source` is always carried on the result.
import type { BenefitSnapshot, Coverage, Patient, ServiceLine } from "./types";
import { feeRow } from "./reference-data";
import { round2, todayIso } from "./util";

export interface EligibilityRequest {
  patient: Patient;
  coverage: Coverage;
  dateOfService: string;
  serviceTypeCode?: string; // X12 EQ01; "30" = health benefit plan coverage
  providerNpi: string;
}

// Normalized 270 payload (vendor adapters map this to their wire format).
export interface X12_270 {
  transaction: "270";
  payerId: string;
  providerNpi: string;
  subscriber: { memberId: string; firstName: string; lastName: string; dob: string };
  dependent?: { firstName: string; lastName: string; dob: string; relationshipCode: "01" | "19" | "34" };
  dateOfService: string;
  serviceTypeCode: string;
}

export function build270(req: EligibilityRequest): X12_270 {
  const c = req.coverage;
  const p = req.patient;
  const self = c.subscriberRelationship === "self";
  const rel: "01" | "19" | "34" = c.subscriberRelationship === "spouse" ? "01" : c.subscriberRelationship === "child" ? "19" : "34";
  return {
    transaction: "270",
    payerId: c.payerId,
    providerNpi: req.providerNpi,
    subscriber: self
      ? { memberId: c.memberId, firstName: p.firstName, lastName: p.lastName, dob: p.dob }
      : { memberId: c.memberId, firstName: c.subscriberFirstName ?? "", lastName: c.subscriberLastName ?? "", dob: c.subscriberDob ?? "" },
    dependent: self ? undefined : { firstName: p.firstName, lastName: p.lastName, dob: p.dob, relationshipCode: rel },
    dateOfService: req.dateOfService,
    serviceTypeCode: req.serviceTypeCode ?? "30",
  };
}

export interface EligibilityVendor {
  name: string;
  check(payload: X12_270): Promise<BenefitSnapshot>;
}

// Deterministic stub: active unless the coverage is terminated; benefits derived from plan type.
export const stubEligibilityVendor: EligibilityVendor = {
  name: "stub",
  async check(payload) {
    const isMedicare = payload.payerId.toUpperCase().startsWith("MEDICARE") || payload.payerId === "00000";
    return {
      active: true,
      planName: isMedicare ? "Medicare Part B" : "Commercial PPO (stub)",
      copayOfficeVisit: isMedicare ? 0 : 30,
      copaySpecialist: isMedicare ? 0 : 50,
      coinsurancePct: isMedicare ? 20 : 20,
      deductibleTotal: isMedicare ? 257 : 1500,
      deductibleRemaining: isMedicare ? 0 : 600,
      oopMaxTotal: isMedicare ? undefined : 6000,
      oopMaxRemaining: isMedicare ? undefined : 4200,
      requiresReferral: false,
      networkStatus: "in-network",
      checkedAt: new Date().toISOString(),
      source: "stub",
    };
  },
};

// Defensive 271 normalizer for clearinghouse JSON (Claim.MD-style keys with fallbacks).
export function parse271(raw: unknown): BenefitSnapshot {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | undefined => {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const n = parseFloat(v.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : undefined; }
    return undefined;
  };
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  const pick = (...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null);
  const activeRaw = pick("active", "coverage_active", "eligible", "status");
  const active = typeof activeRaw === "boolean" ? activeRaw : /^(1|true|active|eligible|a)$/i.test(String(activeRaw ?? ""));
  return {
    active,
    planName: str(pick("plan_name", "planName", "plan")),
    copayOfficeVisit: num(pick("copay", "copay_office", "office_copay")),
    copaySpecialist: num(pick("copay_specialist", "specialist_copay")),
    coinsurancePct: num(pick("coinsurance", "coinsurance_pct")),
    deductibleTotal: num(pick("deductible", "deductible_total")),
    deductibleRemaining: num(pick("deductible_remaining", "remaining_deductible")),
    oopMaxTotal: num(pick("oop_max", "out_of_pocket_max")),
    oopMaxRemaining: num(pick("oop_remaining", "out_of_pocket_remaining")),
    requiresReferral: typeof r.requires_referral === "boolean" ? r.requires_referral : undefined,
    pcpName: str(pick("pcp", "pcp_name")),
    networkStatus: (str(pick("network", "network_status")) as BenefitSnapshot["networkStatus"]) ?? "unknown",
    checkedAt: new Date().toISOString(),
    source: "clearinghouse",
    raw,
  };
}

export async function checkEligibility(req: EligibilityRequest, vendor: EligibilityVendor = stubEligibilityVendor): Promise<BenefitSnapshot> {
  const c = req.coverage;
  if (c.terminationDate && c.terminationDate < req.dateOfService) {
    return { active: false, planName: c.planType, checkedAt: new Date().toISOString(), source: "manual" };
  }
  if (c.planType === "SelfPay") {
    return { active: false, planName: "Self-pay", checkedAt: new Date().toISOString(), source: "manual" };
  }
  return vendor.check(build270(req));
}

// Registration-vs-payer discrepancy detection (the #1 front-end denial driver).
export interface Discrepancy { field: string; ours: string; payer: string; severity: "error" | "warning" }
export function detectDiscrepancies(ours: { firstName: string; lastName: string; dob: string; memberId: string }, payer: Partial<{ firstName: string; lastName: string; dob: string; memberId: string }>): Discrepancy[] {
  const out: Discrepancy[] = [];
  const norm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (payer.memberId && norm(payer.memberId) !== norm(ours.memberId)) out.push({ field: "memberId", ours: ours.memberId, payer: payer.memberId, severity: "error" });
  if (payer.dob && payer.dob !== ours.dob) out.push({ field: "dob", ours: ours.dob, payer: payer.dob, severity: "error" });
  if (payer.lastName && norm(payer.lastName) !== norm(ours.lastName)) out.push({ field: "lastName", ours: ours.lastName, payer: payer.lastName, severity: "error" });
  if (payer.firstName && norm(payer.firstName) !== norm(ours.firstName)) out.push({ field: "firstName", ours: ours.firstName, payer: payer.firstName, severity: "warning" });
  return out;
}

// Pre-visit patient responsibility estimate (drives point-of-service collection + GFE).
export interface ResponsibilityEstimate {
  estimatedAllowed: number;
  copay: number;
  deductibleApplied: number;
  coinsurance: number;
  patientResponsibility: number;
  insuranceResponsibility: number;
  assumptions: string[];
}

export function estimatePatientResponsibility(lines: Pick<ServiceLine, "cpt" | "units">[], benefits: BenefitSnapshot, contracted?: Record<string, number>): ResponsibilityEstimate {
  const assumptions: string[] = [];
  let allowed = 0;
  for (const l of lines) {
    const contractRate = contracted?.[l.cpt];
    const ref = feeRow(l.cpt)?.medicareAllowed;
    const rate = contractRate ?? ref ?? 0;
    if (contractRate === undefined) assumptions.push(`${l.cpt}: no contract rate; used reference allowable ${ref ?? 0}`);
    allowed += rate * Math.max(1, l.units);
  }
  allowed = round2(allowed);
  if (!benefits.active) {
    assumptions.push("Coverage inactive: full allowed amount is patient responsibility");
    return { estimatedAllowed: allowed, copay: 0, deductibleApplied: 0, coinsurance: 0, patientResponsibility: allowed, insuranceResponsibility: 0, assumptions };
  }
  const hasEm = lines.some((l) => /^992(0[2-5]|1[1-5])$/.test(l.cpt));
  const copay = hasEm ? benefits.copayOfficeVisit ?? 0 : 0;
  const remainingAfterCopay = Math.max(0, allowed - copay);
  const deductibleApplied = round2(Math.min(benefits.deductibleRemaining ?? 0, remainingAfterCopay));
  const afterDeductible = round2(remainingAfterCopay - deductibleApplied);
  const coinsurance = round2(afterDeductible * ((benefits.coinsurancePct ?? 0) / 100));
  let patient = round2(copay + deductibleApplied + coinsurance);
  if (benefits.oopMaxRemaining !== undefined && patient > benefits.oopMaxRemaining) {
    assumptions.push("Patient share capped at remaining out-of-pocket maximum");
    patient = round2(benefits.oopMaxRemaining);
  }
  return {
    estimatedAllowed: allowed,
    copay,
    deductibleApplied,
    coinsurance,
    patientResponsibility: patient,
    insuranceResponsibility: round2(Math.max(0, allowed - patient)),
    assumptions,
  };
}

// Financial clearance decision for the front desk / kiosk / agent.
export interface ClearanceDecision {
  cleared: boolean;
  reasons: string[];
  actions: string[]; // human or agent next steps
  collectAtVisit: number;
}

export function financialClearance(benefits: BenefitSnapshot, estimate: ResponsibilityEstimate, discrepancies: Discrepancy[], opts: { requiresAuth?: boolean; authOnFile?: boolean; referralOnFile?: boolean } = {}): ClearanceDecision {
  const reasons: string[] = [];
  const actions: string[] = [];
  if (!benefits.active) { reasons.push("Coverage inactive on date of service"); actions.push("Ask patient for updated insurance or convert to self-pay with Good Faith Estimate"); }
  if (discrepancies.some((d) => d.severity === "error")) { reasons.push("Registration data does not match payer"); actions.push("Correct demographics/member ID to match the payer record before claim submission"); }
  if (benefits.requiresReferral && !opts.referralOnFile) { reasons.push("Plan requires PCP referral; none on file"); actions.push("Obtain referral number from PCP"); }
  if (opts.requiresAuth && !opts.authOnFile) { reasons.push("Prior authorization required; none on file"); actions.push("Submit 278 prior authorization request"); }
  if (benefits.networkStatus === "out-of-network") { reasons.push("Provider out of network"); actions.push("Deliver No Surprises Act notice and consent, or reschedule with in-network provider"); }
  const collectAtVisit = estimate.patientResponsibility;
  if (collectAtVisit > 0) actions.push(`Collect estimated $${collectAtVisit.toFixed(2)} at check-in`);
  return { cleared: reasons.length === 0, reasons, actions, collectAtVisit };
}

export function eligibilityIsStale(snapshot: BenefitSnapshot | undefined, dateOfService: string = todayIso(), maxAgeDays = 30): boolean {
  if (!snapshot) return true;
  const ageMs = Date.parse(dateOfService) - Date.parse(snapshot.checkedAt);
  return ageMs > maxAgeDays * 86_400_000 || ageMs < -86_400_000 * 2;
}
