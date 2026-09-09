// Stage 8-9: claim assembly (837P / CMS-1500 mapping), corrected + secondary (COB) claims,
// timely-filing deadlines, and the claim status lifecycle (276/277 semantics).
import type { Claim, ClaimStatus, Coverage, Diagnosis, Patient, RemitClaim, ServiceLine } from "./types";
import { addDays, daysBetween, newId, nowIso, sum } from "./util";

export interface ClaimInput {
  encounterId: string;
  patient: Patient;
  coverage: Coverage;
  billingNpi: string;
  billingTaxId?: string;
  renderingNpi: string;
  renderingProviderName?: string;
  placeOfService: string;
  diagnoses: Diagnosis[];
  lines: ServiceLine[];
  priorAuthNumber?: string;
  referralNumber?: string;
}

export function buildClaim(input: ClaimInput): Claim {
  const at = nowIso();
  const dos = input.lines[0]?.dateOfService;
  const tf = input.coverage.timelyFilingDays ?? 90;
  return {
    id: newId("clm"),
    encounterId: input.encounterId,
    patientId: input.patient.id,
    coverageId: input.coverage.id,
    payerId: input.coverage.payerId,
    payerName: input.coverage.payerName,
    billingNpi: input.billingNpi,
    billingTaxId: input.billingTaxId,
    renderingNpi: input.renderingNpi,
    renderingProviderName: input.renderingProviderName,
    placeOfService: input.placeOfService,
    diagnoses: input.diagnoses.slice(0, 12),
    lines: input.lines,
    totalCharge: sum(input.lines.map((l) => l.charge)),
    status: "draft",
    frequencyCode: "1",
    priorAuthNumber: input.priorAuthNumber,
    referralNumber: input.referralNumber,
    createdAt: at,
    lastStatusAt: at,
    timelyFilingDeadline: dos ? addDays(dos, tf) : undefined,
    history: [{ at, status: "draft", actor: "system" }],
  };
}

// Normalized 837P (professional) — vendors (Claim.MD, Availity, Change) map from this.
export interface X12_837P {
  transaction: "837P";
  submitter: { npi: string; taxId?: string };
  receiver: { payerId: string; payerName: string };
  claim: {
    patientControlNumber: string;
    frequencyCode: "1" | "7" | "8";
    originalReferenceNumber?: string;
    totalCharge: number;
    placeOfService: string;
    priorAuthNumber?: string;
    referralNumber?: string;
    subscriber: { memberId: string; lastName: string; firstName: string; dob: string; relationshipCode: "18" | "01" | "19" | "G8" };
    patient: { lastName: string; firstName: string; dob: string; sex: "M" | "F" | "U" };
    renderingProvider: { npi: string; name?: string };
    diagnoses: Array<{ qualifier: "ABK" | "ABF"; code: string }>;
    serviceLines: Array<{ lineNumber: number; procedureCode: string; modifiers: string[]; charge: number; units: number; dateOfService: string; placeOfService: string; diagnosisPointers: number[]; ndc?: string }>;
    otherPayerPaid?: number; // COB: primary paid (secondary claims)
  };
}

export function claimTo837P(claim: Claim, patient: Patient, coverage: Coverage): X12_837P {
  const self = coverage.subscriberRelationship === "self";
  const relationshipCode: X12_837P["claim"]["subscriber"]["relationshipCode"] = self ? "18" : coverage.subscriberRelationship === "spouse" ? "01" : coverage.subscriberRelationship === "child" ? "19" : "G8";
  return {
    transaction: "837P",
    submitter: { npi: claim.billingNpi, taxId: claim.billingTaxId },
    receiver: { payerId: claim.payerId, payerName: claim.payerName },
    claim: {
      patientControlNumber: claim.id,
      frequencyCode: claim.frequencyCode,
      originalReferenceNumber: claim.originalClaimId,
      totalCharge: claim.totalCharge,
      placeOfService: claim.placeOfService,
      priorAuthNumber: claim.priorAuthNumber,
      referralNumber: claim.referralNumber,
      subscriber: {
        memberId: coverage.memberId,
        lastName: self ? patient.lastName : coverage.subscriberLastName ?? patient.lastName,
        firstName: self ? patient.firstName : coverage.subscriberFirstName ?? patient.firstName,
        dob: self ? patient.dob : coverage.subscriberDob ?? patient.dob,
        relationshipCode,
      },
      patient: { lastName: patient.lastName, firstName: patient.firstName, dob: patient.dob, sex: patient.sex ?? "U" },
      renderingProvider: { npi: claim.renderingNpi, name: claim.renderingProviderName },
      diagnoses: claim.diagnoses.map((d, i) => ({ qualifier: i === 0 ? "ABK" : "ABF", code: d.code.toUpperCase().replace(".", "") })),
      serviceLines: claim.lines.map((l, i) => ({ lineNumber: i + 1, procedureCode: l.cpt, modifiers: l.modifiers, charge: l.charge, units: l.units, dateOfService: l.dateOfService, placeOfService: l.placeOfService, diagnosisPointers: l.dxPointers, ndc: l.ndc })),
      otherPayerPaid: claim.cobPrimaryPaid,
    },
  };
}

// CMS-1500 box map (for the paper/PDF path and for the existing /cms-1500 page).
export function claimToCms1500Boxes(claim: Claim, patient: Patient, coverage: Coverage): Record<string, string> {
  const boxes: Record<string, string> = {
    "1a": coverage.memberId,
    "2": `${patient.lastName}, ${patient.firstName}`,
    "3": `${patient.dob} ${patient.sex ?? ""}`.trim(),
    "4": coverage.subscriberRelationship === "self" ? `${patient.lastName}, ${patient.firstName}` : `${coverage.subscriberLastName ?? ""}, ${coverage.subscriberFirstName ?? ""}`,
    "6": coverage.subscriberRelationship,
    "11": coverage.groupNumber ?? "",
    "11c": coverage.payerName,
    "22": claim.frequencyCode === "1" ? "" : `${claim.frequencyCode} ${claim.originalClaimId ?? ""}`,
    "23": claim.priorAuthNumber ?? claim.referralNumber ?? "",
    "24J": claim.renderingNpi,
    "25": claim.billingTaxId ?? "",
    "26": claim.id,
    "28": claim.totalCharge.toFixed(2),
    "33a": claim.billingNpi,
  };
  claim.diagnoses.forEach((d, i) => { boxes[`21${String.fromCharCode(65 + i)}`] = d.code; });
  claim.lines.forEach((l, i) => {
    const n = i + 1;
    boxes[`24A-${n}`] = l.dateOfService;
    boxes[`24B-${n}`] = l.placeOfService;
    boxes[`24D-${n}`] = [l.cpt, ...l.modifiers].join(" ");
    boxes[`24E-${n}`] = l.dxPointers.map((p) => String.fromCharCode(64 + p)).join("");
    boxes[`24F-${n}`] = l.charge.toFixed(2);
    boxes[`24G-${n}`] = String(l.units);
  });
  return boxes;
}

const TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ["scrubbed", "closed"],
  scrubbed: ["ready", "draft", "closed"],
  ready: ["submitted", "draft", "closed"],
  submitted: ["acknowledged", "rejected", "pended", "adjudicated", "paid", "partially-paid", "denied"],
  acknowledged: ["pended", "adjudicated", "paid", "partially-paid", "denied", "rejected"],
  rejected: ["draft", "closed"],
  pended: ["adjudicated", "paid", "partially-paid", "denied"],
  adjudicated: ["paid", "partially-paid", "denied"],
  paid: ["closed", "appealed"],
  "partially-paid": ["appealed", "closed"],
  denied: ["appealed", "draft", "closed"],
  appealed: ["paid", "partially-paid", "denied", "closed"],
  closed: [],
};

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionClaim(claim: Claim, to: ClaimStatus, actor: string, note?: string): Claim {
  if (!canTransition(claim.status, to)) throw new Error(`Illegal claim transition ${claim.status} → ${to}`);
  const at = nowIso();
  return { ...claim, status: to, lastStatusAt: at, submittedAt: to === "submitted" ? at : claim.submittedAt, history: [...claim.history, { at, status: to, actor, note }] };
}

// 277 claim status category codes → our lifecycle.
export function mapStatusCategory(code: string): ClaimStatus | null {
  const c = code.toUpperCase();
  if (c.startsWith("A0") || c.startsWith("A1") || c.startsWith("A2") || c.startsWith("A5")) return "acknowledged";
  if (c.startsWith("A3") || c.startsWith("A4") || c.startsWith("A6") || c.startsWith("A7") || c.startsWith("A8")) return "rejected";
  if (c.startsWith("P0") || c.startsWith("P1") || c.startsWith("P2") || c.startsWith("P3") || c.startsWith("P4") || c.startsWith("P5")) return "pended";
  if (c.startsWith("F1")) return "paid";
  if (c.startsWith("F2")) return "denied";
  if (c.startsWith("F0") || c.startsWith("F3") || c.startsWith("F4")) return "adjudicated";
  return null;
}

// Corrected/replacement claim (frequency 7) or void (8).
export function correctedClaim(original: Claim, patch: Partial<Pick<Claim, "diagnoses" | "lines" | "priorAuthNumber" | "referralNumber" | "placeOfService">>, kind: "7" | "8" = "7"): Claim {
  const at = nowIso();
  const lines = patch.lines ?? original.lines;
  return {
    ...original,
    ...patch,
    id: newId("clm"),
    lines,
    totalCharge: sum(lines.map((l) => l.charge)),
    status: "draft",
    frequencyCode: kind,
    originalClaimId: original.id,
    createdAt: at,
    submittedAt: undefined,
    lastStatusAt: at,
    history: [{ at, status: "draft", actor: "system", note: `${kind === "7" ? "Replacement" : "Void"} of ${original.id}` }],
  };
}

// Secondary claim from the primary remittance (COB) — carries primary paid + adjustments.
export function secondaryClaim(primary: Claim, secondary: Coverage, primaryRemit: RemitClaim): Claim {
  const at = nowIso();
  return {
    ...primary,
    id: newId("clm"),
    coverageId: secondary.id,
    payerId: secondary.payerId,
    payerName: secondary.payerName,
    status: "draft",
    frequencyCode: "1",
    originalClaimId: undefined,
    cobPrimaryPaid: primaryRemit.paid,
    createdAt: at,
    submittedAt: undefined,
    lastStatusAt: at,
    timelyFilingDeadline: primary.lines[0] ? addDays(primary.lines[0].dateOfService, secondary.timelyFilingDays ?? 90) : undefined,
    history: [{ at, status: "draft", actor: "system", note: `Secondary to ${primary.id}; primary paid ${primaryRemit.paid}` }],
  };
}

// Stale-claim detection for the follow-up queue: submitted/acknowledged with no adjudication.
export function claimsNeedingFollowUp(claims: Claim[], today: string, thresholdDays = 30): Array<{ claim: Claim; daysOutstanding: number; reason: string }> {
  return claims
    .filter((c) => ["submitted", "acknowledged", "pended"].includes(c.status))
    .map((c) => ({ claim: c, daysOutstanding: daysBetween((c.submittedAt ?? c.lastStatusAt).slice(0, 10), today) }))
    .filter((x) => x.daysOutstanding >= thresholdDays || (x.claim.timelyFilingDeadline !== undefined && daysBetween(today, x.claim.timelyFilingDeadline) <= 14))
    .map((x) => ({ ...x, reason: x.daysOutstanding >= thresholdDays ? `No adjudication after ${x.daysOutstanding} days` : "Timely-filing deadline approaching" }));
}
