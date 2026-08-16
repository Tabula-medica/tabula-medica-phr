/**
 * Advance Care Planning — state execution-rules engine (portable ESM, JSDoc-typed).
 *
 * A faithful port of services/state_rules.py so the PHR and World EHR get the SAME answers,
 * client-side, from the SAME JSON pack. Runs in Node (tested) and in browser bundlers
 * (Vite/webpack import the JSON directly). Importable from TypeScript with full types via
 * the JSDoc annotations.
 *
 *   import { executionRequirements, signingPlan } from "./stateRules.mjs";
 *
 * LEGAL POSTURE: every jurisdiction is a counsel-unverified SEED; surface `counsel_verified`
 * and badge output as DRAFT. Not legal advice.
 */

// Bundlers (Vite/esbuild/webpack ≥5) and Node ≥20 accept the import attribute. If your
// toolchain rejects it, drop `with { type: "json" }` and keep the default import.
import pack from "./state_rules_data.json" with { type: "json" };

const DEFAULT = "US_DEFAULT";
const norm = (code) => (code || "").trim().toUpperCase();

/** @returns {{code:string,name:string,statutory_form_exists:boolean,counsel_verified:boolean}[]} */
export function knownStates() {
  return Object.keys(pack)
    .filter((k) => !k.startsWith("_"))
    .map((k) => ({
      code: pack[k].code, name: pack[k].name,
      statutory_form_exists: !!pack[k].statutory_form_exists,
      counsel_verified: !!pack[k].counsel_verified,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function meta() { return pack._meta || {}; }

/** Rules for a state, falling back to the conservative US_DEFAULT when unseeded. */
export function forState(code) {
  const c = norm(code);
  if (c && pack[c] && !c.startsWith("_")) return { ...pack[c], resolved_from: c, is_fallback: false };
  return { ...pack[DEFAULT], resolved_from: DEFAULT, is_fallback: true, requested_code: c || null };
}

/** Normalized "what it takes to execute" summary (draft, counsel-gated). */
export function executionRequirements(code) {
  const r = forState(code);
  const ex = r.execution || {};
  return {
    state: r.code, state_name: r.name, resolved_from: r.resolved_from, is_fallback: r.is_fallback,
    form_name: r.form_name, statutory_citation: r.statutory_citation,
    witnesses_required: Number(ex.witnesses_required ?? 2),
    notary_required: !!ex.notary_required,
    either_witnesses_or_notary: !!ex.either_witnesses_or_notary,
    notary_can_substitute_for_witnesses: !!ex.notary_can_substitute_for_witnesses,
    min_witness_age: Number(ex.min_witness_age ?? 18),
    prohibited_witnesses: r.prohibited_witnesses || [],
    witness_qualification_note: r.witness_qualification_note ?? null,
    special_requirements: r.special_requirements || [],
    electronic_signature_allowed: !!r.electronic_signature_allowed,
    remote_online_notarization_allowed: !!r.remote_online_notarization_allowed,
    recognizes_out_of_state: !!r.recognizes_out_of_state,
    polst_program: r.polst_program || { available: false, name: null },
    counsel_verified: !!r.counsel_verified,
    disclaimer: (pack._meta || {}).disclaimer,
    notes: r.notes ?? null,
  };
}

/** Prohibited-witness codes a proposed witness matches (empty = eligible). */
export function witnessDisqualifications(code, roles) {
  const prohibited = new Set(forState(code).prohibited_witnesses || []);
  return (roles || []).filter((x) => prohibited.has(x)).sort();
}

/**
 * Given proposed witnesses ({name, roles}) + notarization intent, report what's still
 * missing to be execution-ready under the state's rules. DRAFT / advisory only.
 */
export function signingPlan(code, witnesses = [], notarized = false) {
  const req = executionRequirements(code);
  const problems = [];
  const eligible = witnesses.map((w) => {
    const bad = witnessDisqualifications(code, w.roles || []);
    if (bad.length) problems.push(`Witness '${w.name || "(unnamed)"}' is disqualified (${bad.join(", ")}).`);
    return { name: w.name || "", roles: w.roles || [], disqualified_by: bad, eligible: bad.length === 0 };
  });
  const nEligible = eligible.filter((e) => e.eligible).length;
  const needed = req.witnesses_required;
  const witnessesOk = nEligible >= needed;
  const notaryRequiredOk = !req.notary_required || notarized;

  let methodOk;
  if (req.either_witnesses_or_notary) {
    methodOk = witnessesOk || notarized;
    if (!methodOk) problems.push(`Needs EITHER ${needed} eligible witness(es) OR a notary; have ${nEligible} and notarized=${notarized}.`);
  } else {
    methodOk = witnessesOk && notaryRequiredOk;
    if (!witnessesOk) problems.push(`Needs ${needed} eligible witness(es); have ${nEligible}.`);
    if (req.notary_required && !notarized) problems.push("Notarization is required and not yet completed.");
  }
  (req.special_requirements || []).forEach((sr) => problems.push(`Special state requirement to confirm: ${sr}.`));

  const ready = methodOk && notaryRequiredOk && !eligible.some((e) => e.disqualified_by.length);
  return {
    state: req.state, execution_ready_draft: ready, counsel_verified: req.counsel_verified,
    witnesses_required: needed, eligible_witness_count: nEligible, notarized, witnesses: eligible,
    outstanding: problems,
    disclaimer: "DRAFT readiness check — not legal advice. Final validity depends on counsel-verified state rules and proper execution.",
  };
}
