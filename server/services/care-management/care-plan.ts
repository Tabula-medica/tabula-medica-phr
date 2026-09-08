/**
 * The care plan, as a thing that either exists or does not.
 *
 * "Was there a comprehensive care plan?" is the question care-management
 * audits turn on, and it is the one a checkbox on a superbill cannot answer.
 * The form this module was built from has a `CCM FIRST 20 MINS` box and a
 * signature line; nothing on it records whether a plan exists, what is in it,
 * or whether anyone looked at it this month. A practice can fill that form in
 * honestly, every month, and still be unable to produce the document an
 * auditor asks for first.
 *
 * So the plan is modelled explicitly, its required elements are enumerated,
 * and an incomplete plan **blocks the codes that depend on it** rather than
 * generating a warning nobody reads.
 *
 * ## Why "exists" is not the test
 *
 * A care plan that was written once at enrolment and never touched is the
 * common finding, and it is worse than no plan: it satisfies a naive check
 * while describing a patient who has since changed. The code requires the plan
 * to have been *established, implemented, revised or monitored* during the
 * period, which is a statement about activity rather than about a file
 * existing. `reviewedDuringPeriod` carries that, and it is required rather
 * than assumed from the plan's presence.
 *
 * ## Why the elements are enumerated rather than free text
 *
 * A free-text plan field cannot be checked, and "the practice says they have a
 * plan" is what the practice already believed on the day the finding was
 * written. Enumerating the elements means the gap is visible before the claim
 * goes out, and it means the refusal can name what is missing — which is the
 * difference between a blocker a coder can clear and one they will override.
 */

import type { ServicePeriod } from "@shared/care-management";

/**
 * Elements a comprehensive care plan is expected to contain.
 *
 * Drawn from the recurring description of a "comprehensive, electronic care
 * plan" across the care-management programs. A deployment whose MAC reads any
 * of these differently should override the list rather than quietly satisfy
 * it — `requiredPlanElements()` exists for that.
 */
export const CARE_PLAN_ELEMENTS = [
  /** The problem list the plan addresses. */
  "problem-list",
  /** Expected outcome and prognosis. */
  "expected-outcome",
  /** Measurable treatment goals. */
  "measurable-goals",
  /** Symptom management and planned interventions. */
  "planned-interventions",
  /** Medication management. */
  "medication-management",
  /** Which providers and services are involved. */
  "care-team",
  /** Community and social services being coordinated. */
  "community-services",
  /** How information is shared between everyone involved. */
  "information-sharing",
  /** A plan for periodic review and revision. */
  "review-schedule",
] as const;

export type CarePlanElement = (typeof CARE_PLAN_ELEMENTS)[number];

export interface CarePlan {
  patientId: string;
  /** When the plan was first established. */
  establishedAt: string;
  /** Last time it was revised or reviewed. */
  lastReviewedAt?: string;
  /** Elements the plan actually contains. */
  elements: readonly CarePlanElement[];
  /**
   * True when the plan is held electronically and is available to the care
   * team — including, where required, outside normal hours. A plan in a
   * drawer is not available to whoever takes the 2am call.
   */
  electronicAndAvailable: boolean;
  /** Whether it was provided to the patient or caregiver. */
  sharedWithPatient: boolean;
}

export type CarePlanVerdict =
  | { ok: true; plan: CarePlan; reviewedDuringPeriod: boolean }
  | { ok: false; reason: "absent" | "incomplete" | "not-electronic" | "stale"; detail: string };

/**
 * The elements this deployment requires.
 *
 * `CARE_MGMT_PLAN_ELEMENTS` may narrow or extend the list. Narrowing is a
 * decision an operator can make against their own MAC guidance; it is not a
 * default, and the shipped list is the full one.
 */
export function requiredPlanElements(): readonly CarePlanElement[] {
  const raw = process.env.CARE_MGMT_PLAN_ELEMENTS;
  if (!raw) return CARE_PLAN_ELEMENTS;
  const wanted = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return CARE_PLAN_ELEMENTS.filter((e) => wanted.has(e));
}

/**
 * Decide whether this plan supports billing for this period.
 *
 * Pure, and takes the plan rather than fetching it — the same shape as the
 * engagement send gate and the recording-consent check, so the awkward cases
 * are testable without a database.
 */
export function evaluateCarePlan(
  plan: CarePlan | null,
  period: ServicePeriod,
): CarePlanVerdict {
  if (!plan) {
    return {
      ok: false,
      reason: "absent",
      detail:
        "No care plan on file. Every chronic-care and advanced-primary-care code here " +
        "requires one, and its absence is the first thing an audit asks for.",
    };
  }

  if (!plan.electronicAndAvailable) {
    return {
      ok: false,
      reason: "not-electronic",
      detail:
        "The care plan is not recorded as electronic and available to the care team. " +
        "A plan that cannot be reached by whoever takes the after-hours call is not " +
        "doing the thing the requirement exists for.",
    };
  }

  const required = requiredPlanElements();
  const missing = required.filter((e) => !plan.elements.includes(e));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "incomplete",
      detail:
        `The care plan is missing: ${missing.join(", ")}. Named rather than reported as a ` +
        "bare failure, because a gap a coder can see is one they can close.",
    };
  }

  // Activity during the period, not mere existence. A plan written at
  // enrolment and never revisited satisfies a presence check while describing
  // a patient who has since changed.
  const lastTouched = plan.lastReviewedAt ?? plan.establishedAt;
  const reviewedDuringPeriod =
    lastTouched >= period.start && lastTouched <= `${period.end}T23:59:59.999Z`;

  return { ok: true, plan, reviewedDuringPeriod };
}

/**
 * Whether the plan was worked on in this period.
 *
 * Separated from the pass/fail verdict deliberately. Whether "established,
 * implemented, revised, or monitored" is satisfied by monitoring alone — which
 * leaves no timestamp — is a reading this module does not want to make on a
 * practice's behalf. So it reports the fact and lets the engine attach it to
 * the candidate as rationale, where a human coder sees it.
 */
export function planActivityNote(verdict: CarePlanVerdict): string | null {
  if (!verdict.ok) return null;
  return verdict.reviewedDuringPeriod
    ? "Care plan was established or revised during the service period."
    : "Care plan exists and is complete, but carries no establish-or-revise timestamp " +
        "inside this period. If the month's qualifying activity was monitoring rather " +
        "than revision, that needs to be evident in the record.";
}
