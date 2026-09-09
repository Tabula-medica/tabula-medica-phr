// World EHR outpatient RCM — shared domain types.
//
// Portable module: pure TypeScript, no framework imports, mirrors the omnihealth-ehr
// `api/src/rcm` conventions (stable rule ids, deterministic facts, AI = suggestion only)
// so the whole `server/rcm/` tree can be lifted into the EHR unchanged.

export type Money = number; // USD, 2dp

export type CoveragePriority = "primary" | "secondary" | "tertiary";
export type Relationship = "self" | "spouse" | "child" | "other";

export interface Patient {
  id: string;
  mrn?: string;
  firstName: string;
  lastName: string;
  dob: string; // ISO date
  sex?: "M" | "F" | "U";
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  householdSize?: number;
  annualHouseholdIncome?: Money;
}

export interface Coverage {
  id: string;
  patientId: string;
  payerId: string;
  payerName: string;
  memberId: string;
  groupNumber?: string;
  planType?: "HMO" | "PPO" | "EPO" | "POS" | "Medicare" | "Medicaid" | "Commercial" | "SelfPay" | "Other";
  priority: CoveragePriority;
  subscriberRelationship: Relationship;
  subscriberFirstName?: string;
  subscriberLastName?: string;
  subscriberDob?: string;
  effectiveDate?: string;
  terminationDate?: string;
  timelyFilingDays?: number; // payer contract default; used for deadline math
}

export interface BenefitSnapshot {
  active: boolean;
  planName?: string;
  copayOfficeVisit?: Money;
  copaySpecialist?: Money;
  coinsurancePct?: number; // 0..100, patient share
  deductibleTotal?: Money;
  deductibleRemaining?: Money;
  oopMaxTotal?: Money;
  oopMaxRemaining?: Money;
  requiresReferral?: boolean;
  pcpName?: string;
  networkStatus?: "in-network" | "out-of-network" | "unknown";
  checkedAt: string;
  source: "stub" | "clearinghouse" | "manual";
  raw?: unknown;
}

export interface ServiceLine {
  id?: string;
  cpt: string; // CPT/HCPCS
  description?: string;
  modifiers: string[];
  units: number;
  charge: Money; // per-line total charge
  dxPointers: number[]; // 1-based indexes into claim.diagnoses
  dateOfService: string;
  placeOfService: string; // 2-digit POS
  renderingNpi?: string;
  ndc?: string;
}

export interface Diagnosis {
  code: string; // ICD-10-CM
  description?: string;
  hcc?: boolean;
}

export type ClaimStatus =
  | "draft"
  | "scrubbed"
  | "ready"
  | "submitted"
  | "acknowledged" // 999 / 277CA accepted
  | "rejected" // clearinghouse/payer front-end reject
  | "pended"
  | "adjudicated"
  | "paid"
  | "partially-paid"
  | "denied"
  | "appealed"
  | "closed";

export interface Claim {
  id: string;
  encounterId: string;
  patientId: string;
  coverageId: string;
  payerId: string;
  payerName: string;
  billingNpi: string;
  billingTaxId?: string;
  renderingNpi: string;
  renderingProviderName?: string;
  placeOfService: string;
  diagnoses: Diagnosis[];
  lines: ServiceLine[];
  totalCharge: Money;
  status: ClaimStatus;
  frequencyCode: "1" | "7" | "8"; // original / replacement / void
  originalClaimId?: string;
  priorAuthNumber?: string;
  referralNumber?: string;
  cobPrimaryPaid?: Money; // for secondary claims
  createdAt: string;
  submittedAt?: string;
  lastStatusAt: string;
  timelyFilingDeadline?: string;
  history: Array<{ at: string; status: ClaimStatus; note?: string; actor: string }>;
}

export interface Adjustment {
  group: "CO" | "PR" | "OA" | "PI";
  carc: string;
  rarc?: string;
  amount: Money;
}

export interface RemitLine {
  cpt?: string;
  billed: Money;
  allowed?: Money;
  paid: Money;
  patientResp: Money;
  adjustments: Adjustment[];
}

export interface RemitClaim {
  claimId?: string; // our patient control number
  payerClaimNumber?: string;
  patientName?: string;
  statusCode?: string; // CLP02 (1 processed primary, 2 secondary, 4 denied, 22 reversal)
  billed: Money;
  allowed?: Money;
  paid: Money;
  patientResp: Money;
  lines: RemitLine[];
}

export interface Remittance {
  id: string;
  payerId?: string;
  payerName?: string;
  checkNumber?: string;
  checkAmount: Money;
  checkDate?: string;
  method?: "ACH" | "CHK" | "NON";
  claims: RemitClaim[];
  receivedAt: string;
  postedAt?: string;
}

export type LedgerEntryType = "charge" | "insurance-payment" | "patient-payment" | "contractual-adjustment" | "denial-adjustment" | "write-off" | "refund" | "transfer-to-patient";

export interface LedgerEntry {
  id: string;
  patientId: string;
  claimId?: string;
  type: LedgerEntryType;
  amount: Money; // positive; sign derived from type
  date: string;
  memo?: string;
  responsibleParty: "insurance" | "patient";
}

export type DenialCategory =
  | "eligibility"
  | "auth-missing"
  | "coding-mismatch"
  | "modifier"
  | "bundling"
  | "medical-necessity"
  | "duplicate"
  | "timely-filing"
  | "missing-info"
  | "cob"
  | "non-covered"
  | "fee-schedule"
  | "frequency"
  | "provider-enrollment"
  | "other";

export interface Denial {
  id: string;
  claimId: string;
  patientId: string;
  payerId: string;
  carc: string;
  rarc?: string;
  group: Adjustment["group"];
  amount: Money;
  category: DenialCategory;
  rootCause: string;
  remediable: boolean;
  remediation: string;
  preventionRuleIds: string[]; // scrubber rule ids that would have caught it
  receivedAt: string;
  appealDeadline?: string;
  status: "open" | "in-progress" | "appealed" | "overturned" | "upheld" | "written-off";
  priorityScore: number;
}

export type WorkQueue =
  | "eligibility"
  | "prior-auth"
  | "charge-review"
  | "coding-review"
  | "claim-edits"
  | "claim-followup"
  | "denials"
  | "underpayments"
  | "patient-balance"
  | "credit-balance"
  | "agent-approval";

export interface WorkItem {
  id: string;
  queue: WorkQueue;
  title: string;
  patientId?: string;
  claimId?: string;
  amount?: Money;
  priority: number; // 0..100, higher first
  dueAt?: string;
  slaHours?: number;
  assignedTo?: string;
  status: "open" | "in-progress" | "waiting" | "done" | "cancelled";
  source: "system" | "agent" | "voice" | "user";
  createdAt: string;
  context?: Record<string, unknown>;
}

export interface PayerContract {
  payerId: string;
  payerName: string;
  effectiveDate: string;
  timelyFilingDays: number;
  appealDays: number;
  feeSchedule: Record<string, Money>; // CPT → contracted allowed amount
  pctOfMedicare?: number; // fallback: allowed = medicare × pct
  requiresAuth: string[]; // CPT/HCPCS needing prior auth
  goldCardCpts?: string[]; // auth-exempt (gold-carded) codes for this practice
}
