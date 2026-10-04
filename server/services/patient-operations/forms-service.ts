/**
 * Secure digital intake forms.
 *
 * Replaces `server/services/questionnaire-service.ts`'s hardcoded-sample
 * stub (`SAMPLE_QUESTIONNAIRES`/`SAMPLE_RESPONSES`, no persistence beyond a
 * module-level array) with real, DB-backed templates and responses.
 *
 * `SEED_FORM_TEMPLATES` is a closed, deterministic field list — the same
 * discipline `g-code-catalog.ts` and `care-management/code-catalog.ts` use
 * for their candidate sets. A submission can only answer fields that exist
 * on the template; any other key is discarded in code (`discardedFields`),
 * not merely ignored by the client, so a crafted or buggy request can never
 * get an invented field stored as if the clinic asked for it.
 *
 * Delivery is a single-use, time-limited token rather than a login — most
 * patients filling out a new-patient intake form do not have an account
 * yet. The token itself is the secret (a `crypto.randomUUID`, 122 bits of
 * randomness); nothing about it is guessable from the patient's identity.
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "../../storage/phi-storage";
import {
  intakeFormAssignmentsTable,
  intakeFormResponsesTable,
  type IntakeFormAssignmentRow,
  type IntakeFormResponseRow,
} from "@shared/schema";
import {
  PATIENT_OPERATIONS_LIMITS,
  type IntakeFormAnswers,
  type IntakeFormTemplate,
  type IntakeFormTemplateKind,
  type IntakeSubmitRefused,
} from "@shared/patient-operations";

export const SEED_FORM_TEMPLATES: readonly IntakeFormTemplate[] = [
  {
    id: "new-patient-intake",
    title: "New Patient Intake",
    description: "Basic demographics and history for a first visit.",
    fields: [
      { id: "firstName", label: "Legal first name", type: "text", required: true },
      { id: "lastName", label: "Legal last name", type: "text", required: true },
      { id: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      { id: "preferredLanguage", label: "Preferred language", type: "text", required: false },
      { id: "reasonForVisit", label: "Reason for this visit", type: "textarea", required: true },
      { id: "currentMedications", label: "Current medications (name and dose)", type: "textarea", required: false },
      { id: "allergies", label: "Known allergies", type: "textarea", required: false },
      {
        id: "preferredContactMethod",
        label: "Preferred contact method",
        type: "select",
        required: false,
        options: ["phone", "email", "sms"],
      },
    ],
  },
  {
    id: "insurance-update",
    title: "Insurance Information",
    description: "Current insurance details for eligibility verification.",
    fields: [
      { id: "payerName", label: "Insurance company", type: "text", required: true },
      { id: "memberId", label: "Member ID", type: "text", required: true },
      { id: "groupNumber", label: "Group number", type: "text", required: false },
      {
        id: "subscriberRelationship",
        label: "Relationship to subscriber",
        type: "select",
        required: true,
        options: ["self", "spouse", "child", "other"],
      },
      { id: "subscriberFirstName", label: "Subscriber first name (if not self)", type: "text", required: false },
      { id: "subscriberLastName", label: "Subscriber last name (if not self)", type: "text", required: false },
      { id: "subscriberDob", label: "Subscriber date of birth (if not self)", type: "date", required: false },
    ],
  },
  {
    id: "consent-to-treat",
    title: "Consent to Treat",
    description: "Standard consent and communication authorization.",
    fields: [
      { id: "consentToTreat", label: "I consent to treatment by this practice", type: "boolean", required: true },
      { id: "consentToCommunicate", label: "I consent to receive secure messages about my care", type: "boolean", required: true },
      { id: "signatureName", label: "Typed signature (full legal name)", type: "text", required: true },
    ],
  },
];

export function findTemplate(templateId: string): IntakeFormTemplate | undefined {
  return SEED_FORM_TEMPLATES.find((t) => t.id === templateId);
}

/** Pure: splits a raw submission into answers that exist on the template and ones that don't. */
export function filterAnswers(
  template: IntakeFormTemplate,
  rawAnswers: Record<string, unknown>,
): { answers: IntakeFormAnswers; discardedFields: string[] } {
  const fieldIds = new Set(template.fields.map((f) => f.id));
  const answers: IntakeFormAnswers = {};
  const discardedFields: string[] = [];
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (fieldIds.has(key)) {
      answers[key] = value as IntakeFormAnswers[string];
    } else {
      discardedFields.push(key);
    }
  }
  return { answers, discardedFields };
}

function toAssignment(row: IntakeFormAssignmentRow) {
  return {
    id: row.id,
    unifiedPatientId: row.unifiedPatientId,
    templateId: row.templateId as IntakeFormTemplateKind,
    token: row.token,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString(),
  };
}

export async function createAssignment(unifiedPatientId: string, templateId: IntakeFormTemplateKind) {
  const template = findTemplate(templateId);
  if (!template) return { assignment: undefined, error: `Unknown form template: ${templateId}` };

  const expiresAt = new Date(Date.now() + PATIENT_OPERATIONS_LIMITS.formAssignmentTtlHours * 3_600_000);
  const [row] = await db
    .insert(intakeFormAssignmentsTable)
    .values({ unifiedPatientId, templateId, token: randomUUID(), expiresAt })
    .returning();
  return { assignment: toAssignment(row), error: undefined };
}

export async function listAssignments(unifiedPatientId: string) {
  const rows = await db
    .select()
    .from(intakeFormAssignmentsTable)
    .where(eq(intakeFormAssignmentsTable.unifiedPatientId, unifiedPatientId));
  return rows.map(toAssignment);
}

/** Expires a pending assignment in place if its TTL has passed, without a second write-then-read round trip. */
function withLiveStatus(row: IntakeFormAssignmentRow): IntakeFormAssignmentRow {
  if (row.status === "pending" && row.expiresAt.getTime() < Date.now()) {
    return { ...row, status: "expired" };
  }
  return row;
}

export async function getAssignmentByToken(token: string) {
  const [row] = await db.select().from(intakeFormAssignmentsTable).where(eq(intakeFormAssignmentsTable.token, token));
  if (!row) return { assignment: undefined, template: undefined };
  const live = withLiveStatus(row);
  return { assignment: toAssignment(live), template: findTemplate(live.templateId) };
}

export async function submitResponse(
  token: string,
  rawAnswers: Record<string, unknown>,
): Promise<{ response?: IntakeFormResponseRow; refused?: IntakeSubmitRefused }> {
  const [row] = await db.select().from(intakeFormAssignmentsTable).where(eq(intakeFormAssignmentsTable.token, token));
  if (!row) return { refused: { reason: "not-found", detail: "No intake form assignment matches this link." } };

  const live = withLiveStatus(row);
  if (live.status === "submitted") {
    return { refused: { reason: "already-submitted", detail: "This intake form was already submitted." } };
  }
  if (live.status === "expired") {
    return { refused: { reason: "expired", detail: "This intake form link has expired. Ask the clinic to send a new one." } };
  }

  const template = findTemplate(live.templateId);
  const { answers, discardedFields } = filterAnswers(template ?? { id: live.templateId as IntakeFormTemplateKind, title: "", description: "", fields: [] }, rawAnswers);

  const [responseRow] = await phiDb
    .insert(intakeFormResponsesTable)
    .values(
      encryptPhiRow("intakeFormResponsesTable", {
        assignmentId: live.id,
        unifiedPatientId: live.unifiedPatientId,
        templateId: live.templateId,
        answers,
        discardedFields,
      }),
    )
    .returning();

  await db
    .update(intakeFormAssignmentsTable)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(intakeFormAssignmentsTable.token, token));

  return { response: decryptPhiRow("intakeFormResponsesTable", responseRow) };
}

export async function getResponse(assignmentId: string): Promise<IntakeFormResponseRow | undefined> {
  const rows = await phiDb.select().from(intakeFormResponsesTable).where(eq(intakeFormResponsesTable.assignmentId, assignmentId));
  const decrypted = decryptPhiRows("intakeFormResponsesTable", rows);
  return decrypted[0];
}
