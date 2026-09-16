// Stage 7: claim scrubbing — deterministic pre-submission edits with stable rule ids
// (compatible with omnihealth-ehr `rcm/scrubbing.ts` ids so denial→prevention mapping works
// across both codebases). Every edit says what is wrong AND the human fix.
import type { Claim, Coverage, Patient, ServiceLine } from "./types";
import { CPT_DEMOGRAPHIC_RULES, ICD_SEX_RULES, KNOWN_MODIFIERS, NCCI_BYPASS_MODIFIERS, NCCI_PTP_SEED, PLACE_OF_SERVICE, TELEHEALTH_CPTS, feeRow } from "./reference-data";
import { ageOn, daysBetween, isValidCpt, isValidIcd10, isValidNpi } from "./util";

export type EditSeverity = "error" | "warning";
export type EditCategory = "bundling" | "modifier" | "medical-necessity" | "frequency" | "demographic" | "coverage" | "required-field" | "format" | "timely-filing" | "authorization" | "telehealth";

export interface Edit {
  id: string;
  category: EditCategory;
  severity: EditSeverity;
  message: string;
  fix: string;
  lineNumber?: number;
  autoFixable?: boolean; // the agent may apply the fix with approval
}

export interface ScrubContext {
  patient?: Patient;
  coverage?: Coverage;
  today?: string;
  // The CPTs the claim's single on-file priorAuthNumber actually authorizes (validated against a
  // real approved PriorAuth record — see authorizedCptsOnFile in prior-auth.ts). A single auth
  // number only ever covers one CPT, so a claim with several auth-required lines must not have
  // its whole auth-missing check cleared just because one of them is covered.
  authorizedCpts?: string[];
  authRequiredCpts?: string[];
  priorClaimsSameDos?: Claim[]; // duplicate detection
}

export interface ScrubResult {
  clean: boolean;
  score: number; // 0..100 clean-claim confidence
  errors: Edit[];
  warnings: Edit[];
  edits: Edit[];
}

type Rule = (c: Claim, ctx: ScrubContext) => Edit[];

const rules: Record<string, Rule> = {
  "missing-billing-npi": (c) => (!c.billingNpi ? [{ id: "missing-billing-npi", category: "required-field", severity: "error", message: "Billing NPI missing", fix: "Set the billing provider NPI (box 33a)" }] : []),
  "npi-format": (c) => [c.billingNpi, c.renderingNpi].filter(Boolean).filter((n) => !isValidNpi(n)).map((n) => ({ id: "npi-format", category: "format", severity: "error" as const, message: `NPI ${n} fails the 10-digit Luhn check`, fix: "Correct the NPI; verify against NPPES" })),
  "missing-member-id": (_c, ctx) => (ctx.coverage && !ctx.coverage.memberId ? [{ id: "missing-member-id", category: "coverage", severity: "error", message: "Member ID missing on coverage", fix: "Capture member ID from the insurance card" }] : []),
  "coverage-terminated": (c, ctx) => {
    const t = ctx.coverage?.terminationDate;
    const dos = c.lines[0]?.dateOfService;
    return t && dos && dos > t ? [{ id: "coverage-terminated", category: "coverage", severity: "error", message: `Coverage terminated ${t}, before service ${dos}`, fix: "Re-run eligibility; bill the active payer or the patient" }] : [];
  },
  "coverage-not-effective": (c, ctx) => {
    const e = ctx.coverage?.effectiveDate;
    const dos = c.lines[0]?.dateOfService;
    return e && dos && dos < e ? [{ id: "coverage-not-effective", category: "coverage", severity: "error", message: `Coverage effective ${e}, after service ${dos}`, fix: "Verify the effective date or bill prior coverage" }] : [];
  },
  "no-diagnoses": (c) => (c.diagnoses.length === 0 ? [{ id: "no-diagnoses", category: "required-field", severity: "error", message: "No diagnosis codes", fix: "Add at least one ICD-10-CM code (box 21)" }] : []),
  "icd-format": (c) => c.diagnoses.filter((d) => !isValidIcd10(d.code)).map((d) => ({ id: "icd-format", category: "format", severity: "error" as const, message: `Invalid ICD-10-CM ${d.code}`, fix: "Replace with a valid, billable ICD-10-CM code" })),
  "icd-specificity": (c) => c.diagnoses.filter((d) => /^[A-Z]\d{2}$/.test(d.code) || /\.9$/.test(d.code)).map((d) => ({ id: "icd-specificity", category: "medical-necessity", severity: "warning" as const, message: `${d.code} is a category-level or unspecified code`, fix: "Code to the highest specificity documented" })),
  "no-service-lines": (c) => (c.lines.length === 0 ? [{ id: "no-service-lines", category: "required-field", severity: "error", message: "No service lines", fix: "Add at least one charge (box 24)" }] : []),
  "line-required-fields": (c) => c.lines.flatMap((l, i) => {
    const out: Edit[] = [];
    if (!isValidCpt(l.cpt)) out.push({ id: "line-required-fields", category: "format", severity: "error", lineNumber: i + 1, message: `Line ${i + 1}: invalid CPT/HCPCS ${l.cpt}`, fix: "Enter a valid 5-character CPT/HCPCS" });
    if (!l.dateOfService) out.push({ id: "line-required-fields", category: "required-field", severity: "error", lineNumber: i + 1, message: `Line ${i + 1}: missing date of service`, fix: "Set the DOS" });
    if (!(l.units >= 1)) out.push({ id: "line-required-fields", category: "required-field", severity: "error", lineNumber: i + 1, message: `Line ${i + 1}: units must be ≥ 1`, fix: "Set units" });
    if (!(l.charge > 0)) out.push({ id: "line-required-fields", category: "required-field", severity: "error", lineNumber: i + 1, message: `Line ${i + 1}: zero charge`, fix: "Apply charge master amount" });
    return out;
  }),
  // Not autoFixable: guessing diagnosis 1 for a missing/invalid pointer can link a service to
  // a diagnosis it has nothing to do with, which is a medical-necessity/coding decision only a
  // provider or coder can make — never something to silently apply and submit.
  // CMS-1500 box 24E has room for exactly 4 diagnosis-pointer LETTERS per line — that caps how
  // many pointers a line can carry, not which diagnosis they may point to: a claim can have up
  // to 12 diagnoses (box 21, A-L), and any of a line's (at most 4) pointers may reference any of
  // them, so the value bound stays c.diagnoses.length, not 4.
  "unlinked-service-line": (c) => c.lines.flatMap((l, i) => (l.dxPointers.length === 0 || l.dxPointers.length > 4 || l.dxPointers.some((p) => p < 1 || p > c.diagnoses.length) ? [{ id: "unlinked-service-line", category: "required-field", severity: "error" as const, lineNumber: i + 1, message: `Line ${i + 1}: diagnosis pointer missing or out of range`, fix: "Link the line to 1-4 valid diagnosis pointers (box 24E)" }] : [])),
  "pos-format": (c) => c.lines.flatMap((l, i) => (!PLACE_OF_SERVICE[l.placeOfService] ? [{ id: "pos-format", category: "format", severity: "error" as const, lineNumber: i + 1, message: `Line ${i + 1}: unknown place of service ${l.placeOfService}`, fix: "Use a valid 2-digit POS (11 office, 10 telehealth home…)" }] : [])),
  "dos-in-future": (c, ctx) => {
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    return c.lines.flatMap((l, i) => (l.dateOfService > today ? [{ id: "dos-in-future", category: "format", severity: "error" as const, lineNumber: i + 1, message: `Line ${i + 1}: DOS ${l.dateOfService} is in the future`, fix: "Correct the date of service" }] : []));
  },
  "unknown-modifier": (c) => c.lines.flatMap((l, i) => l.modifiers.filter((m) => !KNOWN_MODIFIERS.has(m.toUpperCase())).map((m) => ({ id: "unknown-modifier", category: "modifier", severity: "error" as const, lineNumber: i + 1, message: `Line ${i + 1}: unknown modifier ${m}`, fix: "Remove or replace with a valid CPT/HCPCS modifier" }))),
  // Not autoFixable: this rule's own message says 25 is valid only when a significant,
  // separately identifiable E/M service was documented — a claim/service line alone can't
  // establish that. Auto-appending it risks unsupported coding and a payer audit.
  "missing-em-25-modifier": (c) => {
    const em = c.lines.map((l, i) => ({ l, i })).filter(({ l }) => /^992(0[2-5]|1[1-5])$/.test(l.cpt));
    const isProcedure = (l: ServiceLine) => { const r = feeRow(l.cpt); return r ? r.category === "procedure" : /^[1-6]\d{4}$/.test(l.cpt); };
    // Scope "same-day procedure" to the E/M line's own date of service — a multi-date claim's
    // E/M on one day must not be flagged against a procedure billed on a different day.
    return em.filter(({ l }) => c.lines.some((other) => other.dateOfService === l.dateOfService && isProcedure(other)) && !l.modifiers.includes("25")).map(({ l, i }) => ({ id: "missing-em-25-modifier", category: "modifier", severity: "error" as const, lineNumber: i + 1, message: `E/M ${l.cpt} billed with a same-day procedure without modifier 25`, fix: "Append modifier 25 to the E/M if a significant, separately identifiable service was documented" }));
  },
  "duplicate-line": (c) => {
    const seen = new Map<string, number>();
    return c.lines.flatMap((l, i) => {
      const key = `${l.cpt}|${l.dateOfService}|${l.modifiers.slice().sort().join(",")}`;
      if (seen.has(key)) return [{ id: "duplicate-line", category: "frequency", severity: "error" as const, lineNumber: i + 1, message: `Line ${i + 1} duplicates line ${seen.get(key)! + 1} (${l.cpt})`, fix: "Combine units on one line or add a distinguishing modifier (76/77/59)" }];
      seen.set(key, i);
      return [];
    });
  },
  "mue-units-exceeded": (c) => c.lines.flatMap((l, i) => { const max = feeRow(l.cpt)?.typicalUnitsMax; return max !== undefined && l.units > max ? [{ id: "mue-units-exceeded", category: "frequency", severity: "error" as const, lineNumber: i + 1, message: `Line ${i + 1}: ${l.cpt} units ${l.units} exceed MUE ${max}`, fix: "Reduce units or split across dates with documentation" }] : []; }),
  "ncci-bundling": (c) => {
    const out: Edit[] = [];
    // NCCI PTP edits apply to services on the SAME date of service, and CPTs aren't guaranteed
    // to arrive uppercased — normalize case and index every occurrence (not just the first, via
    // indexOf) so a claim with more than one instance of either code on the pair's own date is
    // still fully evaluated.
    const indexed = c.lines.map((l, i) => ({ cpt: l.cpt.toUpperCase(), dateOfService: l.dateOfService, i }));
    for (const pair of NCCI_PTP_SEED) {
      const col1Lines = indexed.filter((l) => l.cpt === pair.column1);
      const col2Lines = indexed.filter((l) => l.cpt === pair.column2);
      for (const col2 of col2Lines) {
        if (!col1Lines.some((col1) => col1.dateOfService === col2.dateOfService)) continue;
        const mods = c.lines[col2.i].modifiers.map((m) => m.toUpperCase());
        const bypass = pair.modifierIndicator === 1 && mods.some((m) => NCCI_BYPASS_MODIFIERS.has(m));
        if (!bypass) out.push({ id: "ncci-bundling", category: "bundling", severity: "error", lineNumber: col2.i + 1, message: `${pair.column2} bundles into ${pair.column1} (NCCI PTP): ${pair.rationale}`, fix: pair.modifierIndicator === 1 ? "Remove the component line, or append 59/X{ESPU} only if a distinct service is documented" : "Remove the component line; this pair can never be unbundled" });
      }
    }
    return out;
  },
  "age-inappropriate-cpt": (c, ctx) => {
    if (!ctx.patient) return [];
    return c.lines.flatMap((l, i) => {
      const r = CPT_DEMOGRAPHIC_RULES.find((x) => x.cpt === l.cpt);
      if (!r || (r.minAge === undefined && r.maxAge === undefined)) return [];
      const age = ageOn(ctx.patient!.dob, l.dateOfService);
      const bad = (r.minAge !== undefined && age < r.minAge) || (r.maxAge !== undefined && age > r.maxAge);
      return bad ? [{ id: "age-inappropriate-cpt", category: "demographic", severity: "error" as const, lineNumber: i + 1, message: `${l.cpt} not valid for age ${age}`, fix: "Select the age-appropriate code" }] : [];
    });
  },
  "sex-inappropriate-cpt": (c, ctx) => (ctx.patient?.sex && ctx.patient.sex !== "U" ? c.lines.flatMap((l, i) => { const r = CPT_DEMOGRAPHIC_RULES.find((x) => x.cpt === l.cpt && x.sex); return r && r.sex !== ctx.patient!.sex ? [{ id: "sex-inappropriate-cpt", category: "demographic", severity: "error" as const, lineNumber: i + 1, message: `${l.cpt} inconsistent with patient sex`, fix: "Verify the code and the registered sex" }] : []; }) : []),
  "sex-inappropriate-icd": (c, ctx) => (ctx.patient?.sex && ctx.patient.sex !== "U" ? c.diagnoses.flatMap((d) => { const r = ICD_SEX_RULES.find((x) => d.code.toUpperCase().startsWith(x.prefix)); return r && r.sex !== ctx.patient!.sex ? [{ id: "sex-inappropriate-icd", category: "demographic", severity: "error" as const, message: `${d.code} inconsistent with patient sex`, fix: "Verify the diagnosis and the registered sex" }] : []; }) : []),
  "telehealth-modifier-pos": (c) => c.lines.flatMap((l, i): Edit[] => {
    const tele = l.placeOfService === "02" || l.placeOfService === "10";
    const hasMod = l.modifiers.some((m) => ["95", "93", "GT", "FQ"].includes(m.toUpperCase()));
    // Not autoFixable: the claim carries no fact about audio vs. video modality, so guessing 95
    // (video) can misrepresent an audio-only encounter and violate payer-specific modifier rules.
    if (tele && !hasMod && TELEHEALTH_CPTS.has(l.cpt)) return [{ id: "telehealth-modifier-pos", category: "telehealth", severity: "warning" as const, lineNumber: i + 1, message: `Telehealth POS ${l.placeOfService} without modifier 95/93`, fix: "Append 95 (video) or 93 (audio-only) per payer policy" }];
    if (!tele && l.modifiers.includes("95")) return [{ id: "telehealth-modifier-pos", category: "telehealth", severity: "error" as const, lineNumber: i + 1, message: `Modifier 95 with non-telehealth POS ${l.placeOfService}`, fix: "Set POS 10/02 or remove modifier 95" }];
    return [];
  }),
  "auth-missing": (c, ctx) => {
    const need = new Set((ctx.authRequiredCpts ?? []).map((x) => x.toUpperCase()));
    if (!need.size) return [];
    // ctx.authorizedCpts must be computed by the caller against a real approved PriorAuth record
    // — a non-empty claim.priorAuthNumber alone is not proof of authorization (it could be stale,
    // for the wrong payer/coverage, or simply typed in). It's evaluated per-line, not as one
    // claim-wide flag: a single auth number only ever covers one CPT, so a claim with several
    // auth-required lines must still flag the ones that number doesn't cover.
    const covered = new Set((ctx.authorizedCpts ?? []).map((x) => x.toUpperCase()));
    return c.lines.flatMap((l, i) => (need.has(l.cpt.toUpperCase()) && !covered.has(l.cpt.toUpperCase()) ? [{ id: "auth-missing", category: "authorization", severity: "error" as const, lineNumber: i + 1, message: `${l.cpt} requires prior authorization; none on claim`, fix: "Attach the auth number (box 23) or obtain retro-auth" }] : []));
  },
  "timely-filing": (c, ctx) => {
    // Use the claim's own precomputed deadline (buildClaim already resolves payer contract
    // default → coverage override → 90-day fallback) instead of recomputing from
    // coverage.timelyFilingDays alone — a payer whose deadline comes from its contract (e.g.
    // Medicare's 365 days) rather than an explicit per-coverage override would otherwise get
    // flagged here at day 91 using the wrong, shorter generic default.
    const dos = c.lines[0]?.dateOfService;
    if (!dos || !c.timelyFilingDeadline) return [];
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    const daysRemaining = daysBetween(today, c.timelyFilingDeadline);
    if (daysRemaining < 0) return [{ id: "timely-filing", category: "timely-filing", severity: "error", message: `Timely-filing deadline (${c.timelyFilingDeadline}) has passed`, fix: "Submit with proof of timely filing or write off per policy" }];
    if (daysRemaining <= 14) return [{ id: "timely-filing", category: "timely-filing", severity: "warning", message: `Timely-filing deadline in ${daysRemaining} days (${c.timelyFilingDeadline})`, fix: "Submit today" }];
    return [];
  },
  "duplicate-claim": (c, ctx) => {
    // Scope to the same payer/coverage (a legitimate secondary claim to a different payer for
    // the same visit isn't a duplicate) and exclude the very claim this one replaces/voids — a
    // frequency-7/8 claim always legitimately overlaps its own originalClaimId.
    const dup = (ctx.priorClaimsSameDos ?? []).find((p) => p.id !== c.id && p.id !== c.originalClaimId && p.patientId === c.patientId && p.payerId === c.payerId && p.coverageId === c.coverageId && p.status !== "closed" && p.lines.some((pl) => c.lines.some((l) => l.cpt === pl.cpt && l.dateOfService === pl.dateOfService)));
    return dup ? [{ id: "duplicate-claim", category: "frequency", severity: "error", message: `Overlaps existing claim ${dup.id} (${dup.status})`, fix: "Send as corrected claim (frequency 7) referencing the original, or cancel" }] : [];
  },
  "total-mismatch": (c) => { const t = Math.round(c.lines.reduce((s, l) => s + l.charge, 0) * 100) / 100; return Math.abs(t - c.totalCharge) > 0.01 ? [{ id: "total-mismatch", category: "format", severity: "error", message: `Total charge ${c.totalCharge} ≠ sum of lines ${t}`, fix: "Recalculate box 28", autoFixable: true }] : []; },
};

export function scrubClaim(claim: Claim, ctx: ScrubContext = {}): ScrubResult {
  const edits = Object.values(rules).flatMap((r) => r(claim, ctx));
  const errors = edits.filter((e) => e.severity === "error");
  const warnings = edits.filter((e) => e.severity === "warning");
  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);
  return { clean: errors.length === 0, score, errors, warnings, edits };
}

export function scrubRuleCatalog(): Array<{ id: string }> {
  return Object.keys(rules).map((id) => ({ id }));
}

// Apply the auto-fixable edits that are safe and deterministic (agent path, with approval).
export function applyAutoFixes(claim: Claim, edits: Edit[]): { claim: Claim; applied: string[] } {
  const applied: string[] = [];
  const c: Claim = { ...claim, lines: claim.lines.map((l) => ({ ...l, modifiers: [...l.modifiers], dxPointers: [...l.dxPointers] })) };
  for (const e of edits) {
    if (!e.autoFixable) continue;
    if (e.id === "total-mismatch") { c.totalCharge = Math.round(c.lines.reduce((s, l) => s + l.charge, 0) * 100) / 100; applied.push(e.id); }
  }
  return { claim: c, applied: Array.from(new Set(applied)) };
}
