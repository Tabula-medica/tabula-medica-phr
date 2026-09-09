// Stage 12: denial management — CARC/RARC root cause, prevention mapping back to scrubber rule
// ids, deterministic appeal letters (facts from data, never from the model), appeal deadlines,
// worklist prioritization, and write-off recommendation.
import type { Adjustment, Claim, Denial, DenialCategory } from "./types";
import { addDays, daysBetween, newId, nowIso, todayIso } from "./util";

export interface CarcInfo { category: DenialCategory; rootCause: string; remediable: boolean; remediation: string; preventionRuleIds: string[]; appealable: boolean }

export const CARC_MAP: Record<string, CarcInfo> = {
  "1": { category: "non-covered", rootCause: "Deductible amount", remediable: false, remediation: "Transfer to patient responsibility; statement", preventionRuleIds: [], appealable: false },
  "2": { category: "non-covered", rootCause: "Coinsurance amount", remediable: false, remediation: "Transfer to patient responsibility", preventionRuleIds: [], appealable: false },
  "3": { category: "non-covered", rootCause: "Copayment amount", remediable: false, remediation: "Transfer to patient responsibility", preventionRuleIds: [], appealable: false },
  "4": { category: "modifier", rootCause: "Procedure code inconsistent with modifier / required modifier missing", remediable: true, remediation: "Append the correct modifier; submit corrected claim (freq 7)", preventionRuleIds: ["missing-em-25-modifier", "unknown-modifier", "telehealth-modifier-pos"], appealable: true },
  "5": { category: "coding-mismatch", rootCause: "Procedure code inconsistent with place of service", remediable: true, remediation: "Correct POS or CPT; corrected claim", preventionRuleIds: ["pos-format", "telehealth-modifier-pos"], appealable: true },
  "6": { category: "coding-mismatch", rootCause: "Procedure/revenue code inconsistent with patient age", remediable: true, remediation: "Select age-appropriate code; corrected claim", preventionRuleIds: ["age-inappropriate-cpt"], appealable: true },
  "7": { category: "coding-mismatch", rootCause: "Procedure/revenue code inconsistent with patient sex", remediable: true, remediation: "Verify registered sex and code; corrected claim", preventionRuleIds: ["sex-inappropriate-cpt", "sex-inappropriate-icd"], appealable: true },
  "11": { category: "coding-mismatch", rootCause: "Diagnosis inconsistent with the procedure", remediable: true, remediation: "Review dx→procedure linkage; corrected claim", preventionRuleIds: ["unlinked-service-line", "icd-specificity"], appealable: true },
  "15": { category: "auth-missing", rootCause: "Authorization number missing/invalid", remediable: true, remediation: "Add valid auth number; corrected claim", preventionRuleIds: ["auth-missing"], appealable: true },
  "16": { category: "missing-info", rootCause: "Claim lacks information or has a billing/submission error", remediable: true, remediation: "Read the RARC; resubmit with the missing element", preventionRuleIds: ["line-required-fields", "no-diagnoses", "missing-member-id", "npi-format"], appealable: true },
  "18": { category: "duplicate", rootCause: "Exact duplicate claim/service", remediable: false, remediation: "Confirm not a true duplicate; if distinct add modifier 76/77/59 and resubmit", preventionRuleIds: ["duplicate-line", "duplicate-claim"], appealable: false },
  "22": { category: "cob", rootCause: "May be covered by another payer per coordination of benefits", remediable: true, remediation: "Bill primary first; resubmit with primary EOB", preventionRuleIds: [], appealable: true },
  "26": { category: "eligibility", rootCause: "Expenses incurred prior to coverage", remediable: true, remediation: "Verify effective date; bill correct payer", preventionRuleIds: ["coverage-not-effective"], appealable: false },
  "27": { category: "eligibility", rootCause: "Expenses incurred after coverage terminated", remediable: true, remediation: "Verify eligibility; bill the active payer or patient", preventionRuleIds: ["coverage-terminated"], appealable: false },
  "29": { category: "timely-filing", rootCause: "Time limit for filing has expired", remediable: false, remediation: "Appeal only with proof of timely filing; else write off (not billable to patient)", preventionRuleIds: ["timely-filing"], appealable: true },
  "31": { category: "eligibility", rootCause: "Patient cannot be identified as our insured", remediable: true, remediation: "Correct member ID/name/DOB to payer record; resubmit", preventionRuleIds: ["missing-member-id"], appealable: false },
  "45": { category: "fee-schedule", rootCause: "Charge exceeds fee schedule/maximum allowable", remediable: false, remediation: "Contractual adjustment; verify contracted rate (underpayment check)", preventionRuleIds: [], appealable: false },
  "50": { category: "medical-necessity", rootCause: "Not deemed a medical necessity by the payer", remediable: true, remediation: "Appeal with clinical documentation, LCD/NCD citation", preventionRuleIds: ["icd-specificity"], appealable: true },
  "96": { category: "non-covered", rootCause: "Non-covered charge(s)", remediable: true, remediation: "Check benefits; appeal if covered, else patient responsibility (with ABN/GFE)", preventionRuleIds: [], appealable: true },
  "97": { category: "bundling", rootCause: "Benefit for this service is included in another service already adjudicated", remediable: true, remediation: "NCCI review; if distinct, corrected claim with 59/X modifier", preventionRuleIds: ["ncci-bundling"], appealable: true },
  "109": { category: "provider-enrollment", rootCause: "Claim not covered by this payer/contractor; send to correct payer", remediable: true, remediation: "Redirect to correct payer (e.g., MA plan vs traditional Medicare)", preventionRuleIds: [], appealable: false },
  "119": { category: "frequency", rootCause: "Benefit maximum for this period reached", remediable: false, remediation: "Patient responsibility or write-off per contract", preventionRuleIds: [], appealable: true },
  "125": { category: "missing-info", rootCause: "Submission/billing error", remediable: true, remediation: "Correct per RARC and resubmit", preventionRuleIds: ["line-required-fields", "total-mismatch"], appealable: true },
  "140": { category: "eligibility", rootCause: "Patient/insured health identification number and name do not match", remediable: true, remediation: "Correct demographics to payer record", preventionRuleIds: ["missing-member-id"], appealable: false },
  "151": { category: "frequency", rootCause: "Payment adjusted because information doesn't support this many/frequency of services", remediable: true, remediation: "Reduce units to MUE or appeal with documentation", preventionRuleIds: ["mue-units-exceeded"], appealable: true },
  "167": { category: "non-covered", rootCause: "Diagnosis not covered", remediable: true, remediation: "Verify dx; appeal with policy or transfer to patient", preventionRuleIds: ["icd-specificity"], appealable: true },
  "170": { category: "provider-enrollment", rootCause: "Payment denied when performed by this type of provider", remediable: true, remediation: "Verify rendering provider taxonomy/enrollment", preventionRuleIds: [], appealable: true },
  "181": { category: "coding-mismatch", rootCause: "Procedure code invalid on date of service", remediable: true, remediation: "Use code valid for DOS; corrected claim", preventionRuleIds: ["line-required-fields"], appealable: true },
  "182": { category: "modifier", rootCause: "Procedure modifier invalid on date of service", remediable: true, remediation: "Use modifier valid for DOS", preventionRuleIds: ["unknown-modifier"], appealable: true },
  "197": { category: "auth-missing", rootCause: "Precertification/authorization/notification absent", remediable: true, remediation: "Obtain retro-auth and appeal, or add existing auth number", preventionRuleIds: ["auth-missing"], appealable: true },
  "198": { category: "auth-missing", rootCause: "Precertification/authorization exceeded", remediable: true, remediation: "Request additional units; appeal", preventionRuleIds: ["auth-missing"], appealable: true },
  "204": { category: "non-covered", rootCause: "Service not covered under the patient's current benefit plan", remediable: true, remediation: "Verify benefits; patient responsibility with notice", preventionRuleIds: [], appealable: true },
  "226": { category: "missing-info", rootCause: "Information requested from the billing/rendering provider was not provided", remediable: true, remediation: "Send requested records (CDex attachment)", preventionRuleIds: [], appealable: true },
  "227": { category: "missing-info", rootCause: "Information requested from the patient was not provided", remediable: true, remediation: "Patient outreach (COB questionnaire, accident details)", preventionRuleIds: [], appealable: true },
  "242": { category: "provider-enrollment", rootCause: "Services not provided by network/primary care providers", remediable: true, remediation: "Referral/network check; appeal", preventionRuleIds: [], appealable: true },
  "252": { category: "missing-info", rootCause: "Attachment/other documentation required to adjudicate", remediable: true, remediation: "Submit documentation", preventionRuleIds: [], appealable: true },
  "B7": { category: "provider-enrollment", rootCause: "Provider not certified/eligible to be paid for this service on this date", remediable: true, remediation: "Verify credentialing/enrollment effective dates", preventionRuleIds: [], appealable: true },
  "B15": { category: "bundling", rootCause: "Service requires a qualifying service/procedure not received", remediable: true, remediation: "Bill with the qualifying primary code", preventionRuleIds: ["ncci-bundling"], appealable: true },
  "CO-253": { category: "fee-schedule", rootCause: "Sequestration reduction", remediable: false, remediation: "Contractual adjustment", preventionRuleIds: [], appealable: false },
};

export const RARC_HINTS: Record<string, string> = {
  M15: "Separately billed services/tests bundled",
  M20: "Missing/incomplete/invalid HCPCS",
  M51: "Missing/incomplete/invalid procedure code(s)",
  M62: "Missing/incomplete/invalid treatment authorization code",
  M76: "Missing/incomplete/invalid diagnosis",
  M79: "Missing/incomplete/invalid charge",
  MA04: "Secondary payment cannot be considered without primary payer identity/EOB",
  MA130: "Unprocessable claim: incomplete/invalid information",
  N4: "Missing/incomplete/invalid prior insurance carrier EOB",
  N30: "Patient ineligible for this service",
  N54: "Claim information inconsistent with pre-certified/authorized services",
  N130: "Consult plan benefit documents for non-covered services",
  N179: "Additional information has been requested from the member",
  N290: "Missing/incomplete/invalid rendering provider primary identifier",
  N479: "Missing EOB (COB)",
  N522: "Duplicate of a claim processed as a different claim",
};

export function analyzeDenial(carc: string, rarc?: string): CarcInfo & { rarcHint?: string } {
  const key = String(carc).trim().toUpperCase();
  const info = CARC_MAP[key] ?? CARC_MAP[key.replace(/^(CO|PR|OA|PI)-/, "")] ?? { category: "other" as DenialCategory, rootCause: `Unmapped CARC ${carc}`, remediable: false, remediation: "Manual review", preventionRuleIds: [], appealable: true };
  return { ...info, rarcHint: rarc ? RARC_HINTS[rarc.toUpperCase()] : undefined };
}

// Denial priority: dollars × remediability × urgency (days to appeal deadline).
export function denialPriority(amount: number, remediable: boolean, appealDeadline: string | undefined, today: string = todayIso()): number {
  const dollars = Math.min(60, Math.log10(Math.max(1, amount)) * 20);
  const rem = remediable ? 25 : 5;
  let urgency = 5;
  if (appealDeadline) { const d = daysBetween(today, appealDeadline); urgency = d <= 7 ? 15 : d <= 30 ? 10 : 5; }
  return Math.round(Math.min(100, dollars + rem + urgency));
}

export function denialFromAdjustment(claim: Claim, adj: Adjustment, opts: { appealDays?: number; receivedAt?: string } = {}): Denial {
  const info = analyzeDenial(adj.carc, adj.rarc);
  const receivedAt = opts.receivedAt ?? nowIso();
  const appealDeadline = info.appealable ? addDays(receivedAt.slice(0, 10), opts.appealDays ?? 180) : undefined;
  return {
    id: newId("den"),
    claimId: claim.id,
    patientId: claim.patientId,
    payerId: claim.payerId,
    carc: adj.carc,
    rarc: adj.rarc,
    group: adj.group,
    amount: adj.amount,
    category: info.category,
    rootCause: info.rootCause,
    remediable: info.remediable,
    remediation: info.remediation,
    preventionRuleIds: info.preventionRuleIds,
    receivedAt,
    appealDeadline,
    status: "open",
    priorityScore: denialPriority(adj.amount, info.remediable, appealDeadline),
  };
}

export interface AppealInput {
  denial: Denial;
  claim: Claim;
  patientName: string;
  providerName: string;
  practiceName: string;
  clinicalSummary?: string; // provider-authored medical-necessity statement
  policyCitation?: string; // LCD/NCD or plan policy reference
  attachments?: string[];
}

export function generateAppealLetter(a: AppealInput): { letter: string; level: "reconsideration" | "formal-appeal"; deadline?: string } {
  const info = analyzeDenial(a.denial.carc, a.denial.rarc);
  const dos = a.claim.lines[0]?.dateOfService ?? "";
  const dx = a.claim.diagnoses.map((d) => d.code).join(", ");
  const cpts = a.claim.lines.map((l) => [l.cpt, ...l.modifiers].join("-")).join(", ");
  const lines = [
    `${a.practiceName}`,
    `${todayIso()}`,
    ``,
    `${a.claim.payerName} — Appeals Department`,
    `Re: Appeal of denied claim ${a.claim.id}`,
    `Patient: ${a.patientName}   Date of service: ${dos}`,
    `Services: ${cpts}   Diagnoses: ${dx}`,
    `Denial: CARC ${a.denial.carc}${a.denial.rarc ? ` / RARC ${a.denial.rarc}` : ""} — ${info.rootCause}   Amount: $${a.denial.amount.toFixed(2)}`,
    ``,
    `We respectfully request reconsideration of the above denial.`,
    a.clinicalSummary ? `Clinical summary: ${a.clinicalSummary}` : `Clinical summary: the services were medically necessary for the documented diagnoses (${dx}) as recorded in the attached encounter note.`,
    a.policyCitation ? `Supporting policy: ${a.policyCitation}` : "",
    `Requested action: ${info.remediation}`,
    a.attachments?.length ? `Enclosures: ${a.attachments.join("; ")}` : "Enclosures: encounter note; claim copy; remittance advice",
    ``,
    `Please contact our office with any questions. Thank you for your prompt review.`,
    ``,
    `Sincerely,`,
    `${a.providerName}`,
  ].filter((l) => l !== "");
  return { letter: lines.join("\n"), level: info.category === "medical-necessity" ? "formal-appeal" : "reconsideration", deadline: a.denial.appealDeadline };
}

export interface WriteOffRecommendation { action: "appeal" | "corrected-claim" | "bill-patient" | "write-off" | "manual"; reason: string; requiresApproval: boolean }

export function recommendAction(d: Denial, opts: { smallBalanceThreshold?: number; costToAppeal?: number } = {}): WriteOffRecommendation {
  const small = opts.smallBalanceThreshold ?? 15;
  const cost = opts.costToAppeal ?? 25;
  if (d.group === "PR") return { action: "bill-patient", reason: "Patient-responsibility group code", requiresApproval: false };
  if (d.category === "timely-filing") return { action: "write-off", reason: "Timely filing expired; not billable to patient", requiresApproval: true };
  if (d.category === "fee-schedule") return { action: "write-off", reason: "Contractual adjustment", requiresApproval: false };
  if (d.amount < small) return { action: "write-off", reason: `Below small-balance threshold $${small}`, requiresApproval: d.amount >= 5 };
  if (d.remediable && ["modifier", "coding-mismatch", "missing-info", "bundling", "frequency", "eligibility", "auth-missing"].includes(d.category)) return { action: "corrected-claim", reason: d.remediation, requiresApproval: true };
  if (d.category === "medical-necessity" || d.category === "non-covered") return d.amount > cost ? { action: "appeal", reason: "Appealable with clinical documentation", requiresApproval: true } : { action: "write-off", reason: "Appeal cost exceeds recoverable amount", requiresApproval: true };
  return { action: "manual", reason: d.rootCause, requiresApproval: true };
}

export function denialTrends(denials: Denial[]): { byCategory: Record<string, { count: number; amount: number }>; byPayer: Record<string, { count: number; amount: number }>; preventable: { count: number; amount: number }; topPreventionRules: Array<{ ruleId: string; count: number }> } {
  const byCategory: Record<string, { count: number; amount: number }> = {};
  const byPayer: Record<string, { count: number; amount: number }> = {};
  const rules = new Map<string, number>();
  let pc = 0, pa = 0;
  for (const d of denials) {
    byCategory[d.category] = byCategory[d.category] ?? { count: 0, amount: 0 };
    byCategory[d.category].count++; byCategory[d.category].amount += d.amount;
    byPayer[d.payerId] = byPayer[d.payerId] ?? { count: 0, amount: 0 };
    byPayer[d.payerId].count++; byPayer[d.payerId].amount += d.amount;
    if (d.preventionRuleIds.length) { pc++; pa += d.amount; d.preventionRuleIds.forEach((r) => rules.set(r, (rules.get(r) ?? 0) + 1)); }
  }
  return { byCategory, byPayer, preventable: { count: pc, amount: Math.round(pa * 100) / 100 }, topPreventionRules: Array.from(rules.entries()).map(([ruleId, count]) => ({ ruleId, count })).sort((a, b) => b.count - a.count).slice(0, 10) };
}
