// Voice payer-call script builder. Produces the structured script a voice agent (or a human
// on the phone) follows: IVR navigation, HIPAA verification, questions, and a disposition
// schema whose answers map straight back onto the claim lifecycle.
import type { Claim, Coverage, Patient } from "../types";
import { mapStatusCategory } from "../claims";

export interface PayerCallScript {
  claimId: string;
  payer: string;
  ivrPath: string[];
  verification: Array<{ field: string; value: string }>;
  questions: string[];
  dispositionSchema: Array<{ key: string; type: "string" | "date" | "money" | "enum"; options?: string[] }>;
  mapDisposition: string; // human-readable rule for how answers update the claim
  maxDurationMinutes: number;
  escalation: string;
}

export function buildPayerCallScript(claim: Claim, coverage?: Coverage, patient?: Patient): PayerCallScript {
  const dos = claim.lines[0]?.dateOfService ?? "";
  return {
    claimId: claim.id,
    payer: claim.payerName,
    ivrPath: ["Provider services", "Claim status", "Enter tax ID / NPI", `Enter member ID ${coverage?.memberId ?? "[member id]"}`, `Enter date of service ${dos}`],
    verification: [
      { field: "Billing NPI", value: claim.billingNpi },
      { field: "Tax ID", value: claim.billingTaxId ?? "[tax id]" },
      { field: "Member ID", value: coverage?.memberId ?? "[member id]" },
      { field: "Patient DOB", value: patient?.dob ?? "[dob]" },
      { field: "Date of service", value: dos },
      { field: "Billed amount", value: `$${claim.totalCharge.toFixed(2)}` },
    ],
    questions: [
      "Was the claim received? On what date?",
      "What is the current status (in process, pended, paid, denied)?",
      "If pended: what is needed and from whom, and what is the reference/case number?",
      "If paid: paid amount, check/EFT number, date, and where it was sent.",
      "If denied: denial reason code and whether a corrected claim or appeal is appropriate, plus the appeal deadline.",
      "What is the call reference number and representative name?",
    ],
    dispositionSchema: [
      { key: "receivedDate", type: "date" },
      { key: "status", type: "enum", options: ["in-process", "pended", "paid", "denied", "not-on-file"] },
      { key: "statusCategoryCode", type: "string" },
      { key: "paidAmount", type: "money" },
      { key: "checkNumber", type: "string" },
      { key: "denialReason", type: "string" },
      { key: "appealDeadline", type: "date" },
      { key: "callReference", type: "string" },
      { key: "representative", type: "string" },
    ],
    mapDisposition: "not-on-file → resubmit (claim back to draft); pended → claim pended + work item with what's needed; paid → expect ERA, mark adjudicated; denied → create denial from reason code and route to the denials agent; any 277 category code is mapped via mapStatusCategory().",
    maxDurationMinutes: 20,
    escalation: "If hold exceeds 15 minutes or the representative cannot locate the claim, capture the reference number and schedule a callback work item for the next business day.",
  };
}

export function applyDisposition(claim: Claim, d: { status?: string; statusCategoryCode?: string }): Claim["status"] | null {
  if (d.statusCategoryCode) { const mapped = mapStatusCategory(d.statusCategoryCode); if (mapped) return mapped; }
  switch (d.status) {
    case "not-on-file": return "draft";
    case "pended": return "pended";
    case "paid": return "adjudicated";
    case "denied": return "denied";
    case "in-process": return "acknowledged";
    default: return null;
  }
}
