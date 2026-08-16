/**
 * Advance Care Planning — CPT 99497/99498 capture (portable ESM). Port of services/billing.py.
 * Validates Medicare's documentation elements and returns a DRAFT charge suggestion. Never a
 * claim, never transmits. For the World EHR (provider) surface; the PHR consumes it read-only.
 */

export const ACP_FEES = { "99497": 80.0, "99498": 60.0 };
const FIRST_CODE_MIN = 16;

function units99498(totalMinutes) {
  if (totalMinutes < 46) return 0;
  return 1 + Math.floor((totalMinutes - 46) / 30);
}

/** @param {object} payload see billing.py::capture */
export function capture(payload) {
  payload = payload || {};
  const voluntary = payload.voluntary === true;
  const minutes = Number(payload.total_minutes || 0);
  const participants = (payload.participants || []).map((x) => String(x).trim()).filter(Boolean);
  const summary = String(payload.discussion_summary || "").trim();
  const npi = String(payload.rendering_provider_npi || "").trim();
  const provider = String(payload.rendering_provider_name || "").trim();
  const sameDayAwv = !!payload.same_day_awv;
  const formCompleted = !!payload.form_completed;

  const missing = [];
  if (!voluntary) missing.push("voluntary attestation (the discussion must be voluntary)");
  if (minutes < FIRST_CODE_MIN) missing.push(`total face-to-face time ≥ ${FIRST_CODE_MIN} minutes (have ${minutes})`);
  if (!participants.length) missing.push("participants present");
  if (!summary) missing.push("brief description of the discussion");
  if (!(npi || provider)) missing.push("furnishing provider");

  const billable = missing.length === 0;
  const codes = [];
  const modifiers = [];
  let total = 0;
  if (billable) {
    codes.push({ cpt: "99497", units: 1, descriptor: "Advance care planning, first 30 minutes", allowable: ACP_FEES["99497"] });
    total += ACP_FEES["99497"];
    const add = units99498(minutes);
    if (add) { codes.push({ cpt: "99498", units: add, descriptor: "Advance care planning, each additional 30 minutes", allowable: ACP_FEES["99498"] }); total += ACP_FEES["99498"] * add; }
    if (sameDayAwv) modifiers.push("33");
  }

  return {
    billable_draft: billable,
    suggested_codes: codes,
    modifiers,
    estimated_allowable_usd: Math.round(total * 100) / 100,
    cost_sharing: sameDayAwv
      ? "No patient cost-sharing: furnished with the Annual Wellness Visit and reported with modifier 33 (deductible/coinsurance waived)."
      : "Standard Part B cost-sharing (deductible/coinsurance) applies unless furnished with the AWV and reported with modifier 33.",
    documentation: {
      voluntary, total_minutes: minutes, participants, discussion_summary: summary,
      form_completed: formCompleted, rendering_provider: { npi, name: provider },
      same_day_awv: sameDayAwv, encounter_date: String(payload.encounter_date || "").trim(),
    },
    missing_elements: missing,
    coder_review_required: true,
    transmitted: false,
    disclaimer: "DRAFT charge suggestion for biller review only. Not a claim; nothing is transmitted. Add-on time units and payer policy must be confirmed by a certified coder.",
  };
}
