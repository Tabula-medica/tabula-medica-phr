/**
 * The Patient Operations status: one deterministic view over real,
 * persisted state from the forms and eligibility modules. No AI, no
 * fabricated "on track" messaging — a step is only "complete" because a
 * real row says so.
 */
import { listAssignments } from "./forms-service";
import { getLatestEligibility } from "./eligibility-bridge";
import { hasSentWelcomeMessage } from "./messaging-bridge";
import { eligibilityIsStale } from "../../rcm/eligibility";
import type { OperationsStep, PatientOperationsStatus } from "@shared/patient-operations";

export function formsStep(assignments: Awaited<ReturnType<typeof listAssignments>>): OperationsStep {
  if (assignments.length === 0) {
    return { id: "intake-forms", status: "not-started", detail: "No intake forms assigned yet." };
  }
  const submitted = assignments.filter((a) => a.status === "submitted");
  const pending = assignments.filter((a) => a.status === "pending");
  const expired = assignments.filter((a) => a.status === "expired");
  if (pending.length === 0 && expired.length === 0) {
    return { id: "intake-forms", status: "complete", detail: `${submitted.length} of ${assignments.length} forms submitted.` };
  }
  if (expired.length > 0 && pending.length === 0) {
    return { id: "intake-forms", status: "needs-attention", detail: `${expired.length} form link(s) expired unsubmitted; a new one is needed.` };
  }
  return {
    id: "intake-forms",
    status: submitted.length > 0 ? "in-progress" : "not-started",
    detail: `${submitted.length} of ${assignments.length} forms submitted, ${pending.length} pending.`,
  };
}

export function eligibilityStep(check: Awaited<ReturnType<typeof getLatestEligibility>>): OperationsStep {
  if (!check) {
    return { id: "insurance-eligibility", status: "not-started", detail: "No eligibility check has been run." };
  }
  if (!check.active) {
    return { id: "insurance-eligibility", status: "needs-attention", detail: "Coverage reported inactive." };
  }
  if (check.source === "stub") {
    return {
      id: "insurance-eligibility",
      status: "needs-attention",
      detail: "Only a demo/stub eligibility check has run — no real payer has verified this coverage yet.",
    };
  }
  // eligibilityIsStale only reads `.checkedAt` off its argument.
  if (eligibilityIsStale({ active: check.active, checkedAt: check.checkedAt, source: check.source })) {
    return { id: "insurance-eligibility", status: "needs-attention", detail: "Eligibility check is stale (>30 days old) and should be re-verified." };
  }
  return { id: "insurance-eligibility", status: "complete", detail: `Verified via ${check.source}, active coverage.` };
}

async function welcomeMessageStep(patientProfileId: string | undefined): Promise<OperationsStep> {
  // No mapping from unifiedPatientId to a logged-in profiles.id exists in this codebase (see
  // messaging-bridge.ts) — reporting anything but "not-started" here without a real profile id
  // would be exactly the kind of fabricated status this connector exists to avoid.
  if (!patientProfileId) {
    return { id: "welcome-message", status: "not-started", detail: "No linked patient account to message yet." };
  }
  const sent = await hasSentWelcomeMessage(patientProfileId);
  return sent
    ? { id: "welcome-message", status: "complete", detail: "Welcome message sent." }
    : { id: "welcome-message", status: "not-started", detail: "Not yet sent." };
}

export async function getOperationsStatus(unifiedPatientId: string, patientProfileId?: string): Promise<PatientOperationsStatus> {
  const [assignments, eligibility, welcomeMessage] = await Promise.all([
    listAssignments(unifiedPatientId),
    getLatestEligibility(unifiedPatientId),
    welcomeMessageStep(patientProfileId),
  ]);

  const steps: OperationsStep[] = [formsStep(assignments), eligibilityStep(eligibility), welcomeMessage];

  return { unifiedPatientId, steps, generatedAt: new Date().toISOString() };
}
