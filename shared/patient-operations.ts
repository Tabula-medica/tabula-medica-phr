/**
 * The Patient Operations Hub — shared types.
 *
 * Ties three real systems together behind one status, keyed by
 * `unifiedPatientId` (the same cross-source identity `complete-chart-summary`
 * and `medicare-care-gaps` use), not any single EHR connection's `patientId`:
 *
 *   1. Secure digital intake forms (new — the one true gap this connector
 *      fills; `server/services/questionnaire-service.ts` was a hardcoded-
 *      sample stub, not a real form system).
 *   2. Insurance eligibility (`server/rcm/eligibility.ts`'s real X12 270/271
 *      logic, given durable, unifiedPatientId-keyed storage — the RCM store
 *      itself is tenant-scoped and in-memory by design).
 *   3. Secure patient messaging (`server/services/patient-engagement-service.ts`,
 *      the real DB-backed system — not `server/messaging-routes.ts`, which is
 *      an in-memory stub despite being reachable from routes.ts).
 *
 * Forms are delivered via a single-use, time-limited token rather than
 * requiring the patient to already have a logged-in account — the realistic
 * shape of patient onboarding/intake (a brand-new patient has no account
 * yet) and the same pattern real intake-form products use. The field set on
 * every template is closed and deterministic (see `forms-service.ts`'s
 * `SEED_FORM_TEMPLATES`) for the same reason the Medicare G-code and HCC
 * catalogs are closed lists: nothing here lets a patient (or an AI) invent a
 * field that gets stored as if the clinic asked for it.
 *
 * No voice-conversational intake agent exists yet (unlike MiiHealth AI's
 * DAINA). `submitIntakeResponse` is the single entry point a future voice
 * agent would also call — the data model does not need to change to add one
 * later — but nothing in this connector performs speech recognition,
 * telephony, or dialogue management today. Claiming otherwise would be
 * exactly the kind of fabrication this codebase's other connectors are
 * built to avoid.
 */

export const intakeFieldTypes = ["text", "textarea", "date", "select", "multiselect", "boolean"] as const;
export type IntakeFieldType = (typeof intakeFieldTypes)[number];

export interface IntakeFormField {
  id: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  options?: readonly string[]; // for select/multiselect
}

export type IntakeFormTemplateKind = "new-patient-intake" | "insurance-update" | "consent-to-treat";

export interface IntakeFormTemplate {
  id: IntakeFormTemplateKind;
  title: string;
  description: string;
  fields: readonly IntakeFormField[];
}

export type IntakeAssignmentStatus = "pending" | "submitted" | "expired";

export interface IntakeFormAssignment {
  id: string;
  unifiedPatientId: string;
  templateId: IntakeFormTemplateKind;
  token: string;
  status: IntakeAssignmentStatus;
  createdAt: string;
  expiresAt: string;
  submittedAt?: string;
}

/** Answers keyed by `IntakeFormField.id`. Any key not on the template is dropped, not stored. */
export type IntakeFormAnswers = Record<string, string | string[] | boolean>;

export interface IntakeFormResponse {
  id: string;
  assignmentId: string;
  unifiedPatientId: string;
  templateId: IntakeFormTemplateKind;
  answers: IntakeFormAnswers;
  discardedFields: readonly string[]; // field ids submitted but not on the template
  submittedAt: string;
}

export type IntakeSubmitRefusalReason = "not-found" | "already-submitted" | "expired";
export interface IntakeSubmitRefused {
  reason: IntakeSubmitRefusalReason;
  detail: string;
}

/** Mirrors `server/rcm/types.ts`'s `BenefitSnapshot["source"]` — never relabel a stub as verified. */
export type EligibilityCheckSource = "stub" | "clearinghouse" | "manual" | "admin-override";

export interface PersistedEligibilityCheck {
  id: string;
  unifiedPatientId: string;
  active: boolean;
  planName?: string;
  copayOfficeVisit?: number;
  coinsurancePct?: number;
  deductibleRemaining?: number;
  networkStatus?: "in-network" | "out-of-network" | "unknown";
  requiresReferral?: boolean;
  source: EligibilityCheckSource;
  checkedAt: string;
}

export type OperationsStepId = "intake-forms" | "insurance-eligibility" | "welcome-message";
export type OperationsStepStatus = "not-started" | "in-progress" | "complete" | "needs-attention";

export interface OperationsStep {
  id: OperationsStepId;
  status: OperationsStepStatus;
  detail: string;
}

export interface PatientOperationsStatus {
  unifiedPatientId: string;
  steps: readonly OperationsStep[];
  generatedAt: string;
}

export const PATIENT_OPERATIONS_LIMITS = {
  /** How long an intake-form link stays valid before the token expires. */
  formAssignmentTtlHours: 72,
} as const;
