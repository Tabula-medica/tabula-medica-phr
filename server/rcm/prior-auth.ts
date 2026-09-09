// Stage 4: prior authorization (X12 278 / FHIR Da Vinci PAS) — rule engine, request builder,
// lifecycle with CMS-0057-F decision-time SLAs, gold-carding, and unit/expiry tracking.
import type { PayerContract, ServiceLine } from "./types";
import { addDays, daysBetween, newId, nowIso, todayIso } from "./util";

export interface AuthRule {
  cpt: string;
  reason: string;
  urgencyDefault: "standard" | "urgent";
  documentation: string[]; // what the payer typically wants attached
}

// Outpatient services that commonly require auth across commercial/MA payers.
export const DEFAULT_AUTH_RULES: AuthRule[] = [
  { cpt: "70450", reason: "Advanced imaging (CT)", urgencyDefault: "standard", documentation: ["Clinical indication", "Prior conservative treatment", "Relevant exam findings"] },
  { cpt: "72148", reason: "Advanced imaging (MRI)", urgencyDefault: "standard", documentation: ["6 weeks conservative therapy", "Neuro deficit or red flags", "Imaging order"] },
  { cpt: "70553", reason: "Advanced imaging (MRI brain w/wo)", urgencyDefault: "standard", documentation: ["Clinical indication", "Neuro exam"] },
  { cpt: "78452", reason: "Nuclear cardiology", urgencyDefault: "standard", documentation: ["Symptoms", "Risk factors", "Prior ECG/stress"] },
  { cpt: "97110", reason: "Physical therapy beyond visit limit", urgencyDefault: "standard", documentation: ["Plan of care", "Functional scores"] },
  { cpt: "J0135", reason: "Specialty biologic (adalimumab)", urgencyDefault: "standard", documentation: ["Diagnosis", "Step therapy history", "TB screen"] },
  { cpt: "J1745", reason: "Specialty biologic (infliximab)", urgencyDefault: "standard", documentation: ["Diagnosis", "Step therapy", "Weight-based dosing"] },
  { cpt: "E0601", reason: "DME (CPAP)", urgencyDefault: "standard", documentation: ["Sleep study", "Face-to-face note"] },
  { cpt: "K0823", reason: "DME (power wheelchair)", urgencyDefault: "standard", documentation: ["Mobility evaluation", "Home assessment"] },
  { cpt: "64483", reason: "Interventional pain (epidural)", urgencyDefault: "standard", documentation: ["Imaging correlation", "Conservative care"] },
];

export type AuthStatus = "not-required" | "required" | "requested" | "pended" | "approved" | "denied" | "expired" | "exhausted";

export interface PriorAuth {
  id: string;
  patientId: string;
  coverageId: string;
  payerId: string;
  cpt: string;
  diagnoses: string[];
  units: number;
  unitsUsed: number;
  urgency: "standard" | "urgent";
  status: AuthStatus;
  authNumber?: string;
  requestedAt?: string;
  decidedAt?: string;
  validFrom?: string;
  validTo?: string;
  slaDeadline?: string; // CMS-0057-F: 72h urgent, 7 calendar days standard
  documentation: string[];
  missingDocumentation: string[];
  history: Array<{ at: string; status: AuthStatus; note?: string; actor: string }>;
}

export interface AuthCheck { required: boolean; reason?: string; rule?: AuthRule; goldCarded?: boolean }

export function requiresPriorAuth(cpt: string, contract?: PayerContract, rules: AuthRule[] = DEFAULT_AUTH_RULES): AuthCheck {
  const code = cpt.toUpperCase();
  if (contract?.goldCardCpts?.includes(code)) return { required: false, reason: "Gold-carded for this practice", goldCarded: true };
  const rule = rules.find((r) => r.cpt === code);
  const contractSays = contract?.requiresAuth.includes(code) ?? false;
  if (rule || contractSays) return { required: true, reason: rule?.reason ?? "Payer contract lists this code as auth-required", rule };
  return { required: false };
}

export function linesNeedingAuth(lines: ServiceLine[], contract?: PayerContract, rules?: AuthRule[]): Array<{ line: ServiceLine; check: AuthCheck }> {
  return lines.map((line) => ({ line, check: requiresPriorAuth(line.cpt, contract, rules) })).filter((x) => x.check.required);
}

// Normalized 278 request (adapters map to X12 or Da Vinci PAS Bundle).
export interface X12_278 {
  transaction: "278";
  payerId: string;
  requesterNpi: string;
  patient: { id: string; memberId: string };
  serviceLines: Array<{ cpt: string; units: number; diagnoses: string[]; fromDate: string; toDate: string }>;
  urgency: "standard" | "urgent";
  attachments: string[]; // document titles (CDex attachment references in prod)
}

export function build278(auth: PriorAuth, memberId: string, requesterNpi: string, fromDate: string, toDate: string): X12_278 {
  return {
    transaction: "278",
    payerId: auth.payerId,
    requesterNpi,
    patient: { id: auth.patientId, memberId },
    serviceLines: [{ cpt: auth.cpt, units: auth.units, diagnoses: auth.diagnoses, fromDate, toDate }],
    urgency: auth.urgency,
    attachments: auth.documentation.filter((d) => !auth.missingDocumentation.includes(d)),
  };
}

export function createAuthRequest(input: { patientId: string; coverageId: string; payerId: string; cpt: string; diagnoses: string[]; units?: number; urgency?: "standard" | "urgent"; availableDocs?: string[] }, rules: AuthRule[] = DEFAULT_AUTH_RULES): PriorAuth {
  const rule = rules.find((r) => r.cpt === input.cpt.toUpperCase());
  const documentation = rule?.documentation ?? ["Clinical note supporting medical necessity"];
  const have = new Set((input.availableDocs ?? []).map((d) => d.toLowerCase()));
  const missing = documentation.filter((d) => !have.has(d.toLowerCase()));
  const at = nowIso();
  return {
    id: newId("pa"),
    patientId: input.patientId,
    coverageId: input.coverageId,
    payerId: input.payerId,
    cpt: input.cpt.toUpperCase(),
    diagnoses: input.diagnoses,
    units: input.units ?? 1,
    unitsUsed: 0,
    urgency: input.urgency ?? rule?.urgencyDefault ?? "standard",
    status: "required",
    documentation,
    missingDocumentation: missing,
    history: [{ at, status: "required", actor: "system", note: rule?.reason }],
  };
}

export function slaDeadlineFor(requestedAtIso: string, urgency: "standard" | "urgent"): string {
  const ms = urgency === "urgent" ? 72 * 3_600_000 : 7 * 86_400_000;
  return new Date(Date.parse(requestedAtIso) + ms).toISOString();
}

export function transitionAuth(auth: PriorAuth, to: AuthStatus, opts: { actor: string; note?: string; authNumber?: string; validFrom?: string; validTo?: string; approvedUnits?: number } = { actor: "system" }): PriorAuth {
  const at = nowIso();
  const next: PriorAuth = { ...auth, status: to, history: [...auth.history, { at, status: to, actor: opts.actor, note: opts.note }] };
  if (to === "requested") { next.requestedAt = at; next.slaDeadline = slaDeadlineFor(at, auth.urgency); }
  if (to === "approved") {
    next.decidedAt = at;
    next.authNumber = opts.authNumber ?? next.authNumber;
    next.validFrom = opts.validFrom ?? todayIso();
    next.validTo = opts.validTo ?? addDays(next.validFrom, 90);
    if (opts.approvedUnits !== undefined) next.units = opts.approvedUnits;
  }
  if (to === "denied" || to === "pended") next.decidedAt = at;
  return next;
}

export function consumeAuthUnit(auth: PriorAuth, units = 1): PriorAuth {
  const used = auth.unitsUsed + units;
  return { ...auth, unitsUsed: used, status: used >= auth.units ? "exhausted" : auth.status };
}

// Is this auth usable for a service on `dateOfService`?
export function authCoversService(auth: PriorAuth, cpt: string, dateOfService: string): { ok: boolean; reason?: string } {
  if (auth.cpt !== cpt.toUpperCase()) return { ok: false, reason: "Auth is for a different code" };
  if (auth.status !== "approved") return { ok: false, reason: `Auth status is ${auth.status}` };
  if (auth.validFrom && dateOfService < auth.validFrom) return { ok: false, reason: "Service date before auth validity" };
  if (auth.validTo && dateOfService > auth.validTo) return { ok: false, reason: "Auth expired for this service date" };
  if (auth.unitsUsed >= auth.units) return { ok: false, reason: "Authorized units exhausted" };
  return { ok: true };
}

export function slaBreached(auth: PriorAuth, now: string = nowIso()): boolean {
  return !!auth.slaDeadline && (auth.status === "requested" || auth.status === "pended") && now > auth.slaDeadline;
}

export function authsExpiringWithin(auths: PriorAuth[], days: number, today: string = todayIso()): PriorAuth[] {
  return auths.filter((a) => a.status === "approved" && a.validTo && daysBetween(today, a.validTo) >= 0 && daysBetween(today, a.validTo) <= days);
}
