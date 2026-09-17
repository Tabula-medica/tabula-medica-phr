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
  // The visit this request was actually opened for — used to anchor the approved validity
  // window to the visit date rather than to whenever a human happens to decide it, so a request
  // opened well before (or approved well after) the visit still covers the date it was for.
  dateOfService?: string;
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

export function createAuthRequest(input: { patientId: string; coverageId: string; payerId: string; cpt: string; diagnoses: string[]; dateOfService?: string; units?: number; urgency?: "standard" | "urgent"; availableDocs?: string[] }, rules: AuthRule[] = DEFAULT_AUTH_RULES): PriorAuth {
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
    dateOfService: input.dateOfService,
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

// Legal auth lifecycle transitions. Blocks skipping a new payer decision — e.g. a caller
// cannot move a `denied` or `expired` auth straight to `approved`; it must go back through
// `requested`/`pended` first.
const AUTH_TRANSITIONS: Record<AuthStatus, AuthStatus[]> = {
  "not-required": [],
  required: ["requested", "not-required"],
  requested: ["pended", "approved", "denied", "expired"],
  pended: ["approved", "denied", "expired"],
  approved: ["expired", "exhausted"],
  denied: ["requested"],
  expired: ["requested"],
  exhausted: [],
};

export function canTransitionAuth(from: AuthStatus, to: AuthStatus): boolean {
  return AUTH_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionAuth(auth: PriorAuth, to: AuthStatus, opts: { actor: string; note?: string; authNumber?: string; validFrom?: string; validTo?: string; approvedUnits?: number } = { actor: "system" }): PriorAuth {
  if (!canTransitionAuth(auth.status, to)) throw new Error(`Illegal auth transition ${auth.status} → ${to}`);
  const at = nowIso();
  const next: PriorAuth = { ...auth, status: to, history: [...auth.history, { at, status: to, actor: opts.actor, note: opts.note }] };
  if (to === "requested") {
    next.requestedAt = at;
    next.slaDeadline = slaDeadlineFor(at, auth.urgency);
    // Reopening a denied/expired request must not carry over its old decision — otherwise an
    // approval that doesn't explicitly supply a fresh authNumber (opts.authNumber undefined)
    // would silently reuse the stale one from the prior, no-longer-valid attempt. Units consumed
    // under that old cycle don't carry over either: a renewal is a fresh payer decision with its
    // own allocation, not a continuation of the expired one's remaining balance.
    next.authNumber = undefined;
    next.validFrom = undefined;
    next.validTo = undefined;
    next.unitsUsed = 0;
  }
  if (to === "approved") {
    next.decidedAt = at;
    next.authNumber = opts.authNumber ?? next.authNumber;
    // Anchor validity to the visit this was actually requested for, not to whenever a human
    // happens to approve it — otherwise an auth requested well ahead of (or decided well after)
    // the visit can end up with a validity window that doesn't actually cover that visit's date.
    next.validFrom = opts.validFrom ?? next.dateOfService ?? todayIso();
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
export function authCoversService(auth: PriorAuth, cpt: string, dateOfService: string, requestedUnits = 1): { ok: boolean; reason?: string } {
  if (auth.cpt !== cpt.toUpperCase()) return { ok: false, reason: "Auth is for a different code" };
  if (auth.status !== "approved") return { ok: false, reason: `Auth status is ${auth.status}` };
  if (!auth.authNumber) return { ok: false, reason: "Auth approved but no authorization number on file" };
  if (auth.validFrom && dateOfService < auth.validFrom) return { ok: false, reason: "Service date before auth validity" };
  if (auth.validTo && dateOfService > auth.validTo) return { ok: false, reason: "Auth expired for this service date" };
  // Compare against the units this service actually needs, not just whether any unit remains —
  // an auth for 1 unit must not clear a line requesting many.
  if (auth.unitsUsed + Math.max(1, requestedUnits) > auth.units) return { ok: false, reason: "Authorized units exhausted" };
  return { ok: true };
}

// Does an open search of the auths on file for this coverage/payer cover ALL of the given lines
// together, reserving units per CPT+date-of-service bucket as they're assigned — so two lines
// sharing one CPT can't each independently "pass" against the very same auth's static
// `unitsUsed` when it only actually has enough units for one of them. Mirrors submit-claim's own
// execution-time reservation in agents/index.ts (kept separate rather than shared code, since that
// version also needs patientId scoping, per-tenant auth locking, and a real store lookup this pure
// function has no business doing) — this is the earlier "preview" version of the same question,
// for financial clearance to answer before a visit; submit-claim re-fetches and re-verifies for
// real at submission time regardless of what this reports, so a false "clearance" here can
// disappoint at check-in but never actually let a claim submit with insufficient units.
export function authUnitsReserved(lines: Array<{ cpt: string; dateOfService: string; units: number }>, coverageId: string, payerId: string, auths: PriorAuth[]): boolean {
  const byCptAndDate = new Map<string, { cpt: string; dateOfService: string; units: number }>();
  for (const l of lines) {
    const key = `${l.cpt.toUpperCase()}|${l.dateOfService}`;
    const existing = byCptAndDate.get(key);
    if (existing) existing.units += l.units;
    else byCptAndDate.set(key, { cpt: l.cpt.toUpperCase(), dateOfService: l.dateOfService, units: l.units });
  }
  const reservedByAuthId = new Map<string, number>();
  const coveringFor = (cpt: string) => auths.filter((a) => a.coverageId === coverageId && a.payerId === payerId && a.cpt === cpt);
  const stillCovers = (a: PriorAuth, cpt: string, dateOfService: string, units: number) => authCoversService({ ...a, unitsUsed: a.unitsUsed + (reservedByAuthId.get(a.id) ?? 0) }, cpt, dateOfService, units).ok;
  const buckets = Array.from(byCptAndDate.values());
  // Same two-pass, date-exact-first assignment as submit-claim: give every bucket first dibs on
  // an auth actually dated for its own service before any bucket falls back to a differently-dated
  // auth that merely happens to also cover it.
  const assigned = new Map<string, PriorAuth>();
  for (const bucket of buckets) {
    const exact = coveringFor(bucket.cpt).find((a) => a.dateOfService === bucket.dateOfService && stillCovers(a, bucket.cpt, bucket.dateOfService, bucket.units));
    if (exact) { assigned.set(`${bucket.cpt}|${bucket.dateOfService}`, exact); reservedByAuthId.set(exact.id, (reservedByAuthId.get(exact.id) ?? 0) + bucket.units); }
  }
  for (const bucket of buckets) {
    const key = `${bucket.cpt}|${bucket.dateOfService}`;
    if (assigned.has(key)) continue;
    const match = coveringFor(bucket.cpt).find((a) => stillCovers(a, bucket.cpt, bucket.dateOfService, bucket.units));
    if (!match) return false;
    reservedByAuthId.set(match.id, (reservedByAuthId.get(match.id) ?? 0) + bucket.units);
  }
  return true;
}

// Which of a claim's service lines is `priorAuthNumber` actually backed by, per a real approved
// PriorAuth record? A non-empty string alone isn't proof — it could be stale, for the wrong
// payer/coverage, or hand-typed — and neither is a bare "approved" status: the auth could have
// since expired, cover a different date of service, or have too few units remaining. This runs
// every line through the same authCoversService check a fresh prior-auth lookup would use, and
// returns the (at most one, in practice — a single auth number only ever covers one CPT) CPT it
// actually clears, so a claim with several auth-required lines doesn't get every one of them
// waved through by an auth that's only good for one of them.
export function authorizedCptsOnFile(priorAuthNumber: string | undefined, patientId: string, coverageId: string, payerId: string, lines: Array<Pick<ServiceLine, "cpt" | "dateOfService" | "units">>, auths: PriorAuth[]): string[] {
  if (!priorAuthNumber) return [];
  // Consider every record sharing this auth number for this patient/coverage/payer, not just the
  // first one found — a leftover expired/exhausted row with the same number must never shadow a
  // later valid approval for the same request.
  const candidates = auths.filter((a) => a.authNumber === priorAuthNumber && a.patientId === patientId && a.coverageId === coverageId && a.payerId === payerId);
  if (!candidates.length) return [];
  return lines.filter((l) => candidates.some((a) => authCoversService(a, l.cpt, l.dateOfService, l.units).ok)).map((l) => l.cpt.toUpperCase());
}

export function slaBreached(auth: PriorAuth, now: string = nowIso()): boolean {
  return !!auth.slaDeadline && (auth.status === "requested" || auth.status === "pended") && now > auth.slaDeadline;
}

export function authsExpiringWithin(auths: PriorAuth[], days: number, today: string = todayIso()): PriorAuth[] {
  return auths.filter((a) => a.status === "approved" && a.validTo && daysBetween(today, a.validTo) >= 0 && daysBetween(today, a.validTo) <= days);
}
