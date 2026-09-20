/**
 * Advance Care Planning — canonical directive model (portable ESM, JSDoc-typed).
 *
 * Port of services/directive.py: the ONE structured directive shape shared by the Tabula EHR,
 * PHR, and World EHR (matches the camelCase keys the portal/PHR already persist). Records the
 * patient's wishes verbatim; never fills in or advises. `contentHash` is async (Web Crypto) so
 * it runs identically in Node and the browser.
 */

export const CODE_STATUS = ["Full Code", "DNR", "DNI", "DNR/DNI"];

export const TREATMENT_KEYS = [
  "antibioticsIv", "antibioticsOral", "bloodTransfusion", "diagnosticTest",
  "hcProxyInvoked", "hospitalization", "ivHydration", "labTest",
  "surgicalIntervention", "feedingTube", "intubation",
];

export const TREATMENT_LABELS = {
  antibioticsIv: "IV antibiotics", antibioticsOral: "Oral antibiotics",
  bloodTransfusion: "Blood transfusion", diagnosticTest: "Diagnostic testing",
  hcProxyInvoked: "Invoke healthcare proxy", hospitalization: "Hospitalization",
  ivHydration: "IV hydration", labTest: "Lab testing",
  surgicalIntervention: "Surgical intervention", feedingTube: "Feeding tube (artificial nutrition)",
  intubation: "Intubation / mechanical ventilation",
};

const str = (v) => String(v ?? "").trim();

function person(p) {
  p = p || {};
  return { name: str(p.name), relationship: str(p.relationship), phone: str(p.phone), address: str(p.address), email: str(p.email) };
}

/** Coerce an app payload into the canonical directive shape. Never invents a value. */
export function normalize(payload) {
  payload = payload || {};
  const gridIn = payload.treatmentPreferences || payload.treatment_preferences || {};
  const grid = {};
  for (const k of TREATMENT_KEYS) {
    const v = gridIn[k];
    grid[k] = v === true || v === false ? v : (v === null || v === undefined || v === "" || v === "null" ? null : !!v);
  }
  let cs = str(payload.codeStatus || payload.code_status);
  if (!CODE_STATUS.includes(cs)) cs = cs || "";
  const pat = payload.patient || {};
  return {
    schema: "tabula.acp.directive/1",
    patient: {
      name: str(payload.patientName || pat.name),
      dob: str(payload.dob || pat.dob),
      address: str(payload.address || pat.address),
      state_of_residence: str(payload.stateOfResidence || payload.state).toUpperCase(),
      patient_id: str(payload.patientId || payload.patient_id),
    },
    healthcare_agent: person(payload.healthcareAgent || payload.healthcare_agent),
    alternate_agent: person(payload.alternateAgent || payload.alternate_agent),
    code_status: cs,
    treatment_preferences: grid,
    living_will: {
      primary_goal_of_care: str(payload.familyPrimaryGoalOfCare || payload.primary_goal_of_care),
      goals_of_care: str(payload.goalsOfCare || payload.goals_of_care),
      in_own_words: str(payload.additionalWishes || payload.in_own_words),
    },
    organ_donation: typeof payload.organDonation === "boolean" ? payload.organDonation : null,
    polst_requested: !!(payload.polstRequested || payload.polst_requested),
    source_app: str(payload.sourceApp || payload.source_app) || "unknown",
    status: "draft",
  };
}

/** Advisory-only completeness check (never blocks). */
export function missingRecommended(doc) {
  const miss = [];
  if (!doc.patient.name) miss.push("patient name");
  if (!doc.patient.state_of_residence) miss.push("state of residence");
  if (!doc.healthcare_agent.name) miss.push("healthcare agent (proxy)");
  if (!doc.code_status) miss.push("code status");
  if (!Object.values(doc.treatment_preferences).some((v) => v !== null)) miss.push("treatment preferences");
  if (!(doc.living_will.goals_of_care || doc.living_will.primary_goal_of_care)) miss.push("goals of care");
  return miss;
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

/** Stable SHA-256 over directive content (async; matches directive.py content_hash semantics). */
export async function contentHash(doc) {
  const core = {};
  for (const k of ["schema", "patient", "healthcare_agent", "alternate_agent", "code_status",
    "treatment_preferences", "living_will", "organ_donation", "polst_requested"]) {
    if (k in doc) core[k] = doc[k];
  }
  const data = new TextEncoder().encode(stableStringify(core));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "sha256:" + hex;
}

function gridLine(key, val) {
  const label = TREATMENT_LABELS[key] || key;
  const mark = val === true ? "Requested" : (val === false ? "Not to be initiated" : "Undecided");
  return `${label}: ${mark}`;
}

/** Ordered, render-agnostic sections (used by renderHtml). */
export function toSections(doc, rules) {
  const p = doc.patient, ag = doc.healthcare_agent, alt = doc.alternate_agent, lw = doc.living_will;
  const sections = [];
  sections.push({ heading: "Patient", lines: [
    `Name: ${p.name || "—"}`, `Date of birth: ${p.dob || "—"}`,
    `State of residence: ${p.state_of_residence || "—"}`, `Address: ${p.address || "—"}`,
  ] });
  const agent = [`Agent: ${ag.name || "—"}`];
  if (ag.relationship) agent.push(`Relationship: ${ag.relationship}`);
  if (ag.phone) agent.push(`Phone: ${ag.phone}`);
  if (alt.name) agent.push(`Alternate agent: ${alt.name}${alt.relationship ? ` (${alt.relationship})` : ""}`);
  sections.push({ heading: "Healthcare Power of Attorney (Agent / Proxy)", lines: agent });
  sections.push({ heading: "Code Status", lines: [doc.code_status || "Not specified"] });
  sections.push({ heading: "Treatment Preferences", lines: TREATMENT_KEYS.map((k) => gridLine(k, doc.treatment_preferences[k])) });
  const ll = [];
  if (lw.primary_goal_of_care) ll.push(`Primary goal of care: ${lw.primary_goal_of_care}`);
  if (lw.goals_of_care) ll.push(`Goals of care: ${lw.goals_of_care}`);
  if (lw.in_own_words) ll.push(`In my own words: ${lw.in_own_words}`);
  if (doc.organ_donation !== null) ll.push(`Organ donation: ${doc.organ_donation ? "Yes" : "No"}`);
  sections.push({ heading: "Living Will — My Wishes", lines: ll.length ? ll : ["(No narrative wishes recorded.)"] });
  const ex = [`Applicable form: ${rules.form_name || "—"}`, `State authority: ${rules.statutory_citation || "—"}`];
  if (rules.either_witnesses_or_notary) ex.push(`Execution: ${rules.witnesses_required} qualified witness(es) OR a notary.`);
  else ex.push(`Execution: ${rules.witnesses_required} qualified witness(es)${rules.notary_required ? " AND a notary." : "."}`);
  if (rules.witness_qualification_note) ex.push("Witness rule: " + rules.witness_qualification_note);
  sections.push({ heading: "How to Make This Legally Effective (Your State)", lines: ex });
  return sections;
}
