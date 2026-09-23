/**
 * eRx cancellation orchestration.
 *
 * Owns the lifecycle of a CancelRx request: creation (from any of the three
 * triggers), approval, transmission with retry, and response reconciliation.
 * Pure message-shaping and decision logic lives in `erx-script-messages.ts`;
 * network I/O lives in `erx-transport.ts`. This module is the part that touches
 * the database.
 *
 * Safety properties worth preserving if this is edited:
 *   - Every request carries an idempotency key enforced by a unique index, so a
 *     double-save or a retried HTTP request cannot produce two CancelRx
 *     messages for the same prescription.
 *   - A patient-initiated cancellation always requires prescriber approval;
 *     only prescribers and verified death reports transmit unattended.
 *   - A death report can be rescinded, and rescinding stops any cancellation
 *     that has not yet been transmitted.
 */

import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  erxCancellationEventsTable,
  erxCancellationRequestsTable,
  medicationsTable,
  patientMortalityRecordsTable,
  type ErxCancellationInitiator,
  type ErxCancellationRequestDB,
  type ErxCancellationStatus,
  type ErxCancellationTrigger,
  type MortalitySource,
  type PatientMortalityRecordDB,
} from "@shared/schema";
import { logger } from "../lib/logger";
import {
  decryptPhiRow,
  decryptPhiRows,
  encryptPhiRow,
  phiDb,
} from "../storage/phi-storage";
import {
  assessDoseChange,
  buildCancelRxMessage,
  buildIdempotencyKey,
  CANCEL_REASON_BY_TRIGGER,
  DEFAULT_SCRIPT_VERSION,
  estimateWasteAvoidedCents,
  hashPayload,
  interpretCancelRxResponse,
  MAX_TRANSMISSION_ATTEMPTS,
  nextRetryDelayMs,
  RETRYABLE_TRANSPORT_ERRORS,
  type DoseChangeAssessment,
} from "./erx-script-messages";
import { getErxTransport } from "./erx-transport";

const REQUESTS_TABLE = "erxCancellationRequestsTable";
const EVENTS_TABLE = "erxCancellationEventsTable";
const MORTALITY_TABLE = "patientMortalityRecordsTable";

/** Statuses at which the request has left our control and must not be edited. */
const IN_FLIGHT_STATUSES: ErxCancellationStatus[] = ["transmitting", "transmitted"];
const TERMINAL_STATUSES: ErxCancellationStatus[] = [
  "acknowledged",
  "denied",
  "failed",
  "cancelled",
];

/** Death reports from these sources are authoritative enough to act on at once. */
const AUTHORITATIVE_MORTALITY_SOURCES: MortalitySource[] = [
  "clinician_attested",
  "ehr_feed",
  "state_registry",
  "ssa_death_master_file",
];

/** Roles allowed to send a CancelRx without a separate prescriber sign-off. */
const SELF_APPROVING_ROLES: ErxCancellationInitiator[] = ["prescriber", "system_automation"];

function hashId(id: string): string {
  return `${id.slice(0, 8)}***`;
}

function auditLog(action: string, details: Record<string, unknown>): void {
  logger.info({ component: "ErxCancel", audit: "HIPAA", action, details }, "eRx cancellation audit event");
}

// ---------------------------------------------------------------------------
// Event trail
// ---------------------------------------------------------------------------

async function recordEvent(input: {
  requestId: string;
  profileId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  detail?: string | null;
  payloadHash?: string | null;
  actor?: string | null;
}): Promise<void> {
  await phiDb.insert(erxCancellationEventsTable).values(
    encryptPhiRow(EVENTS_TABLE, {
      requestId: input.requestId,
      profileId: input.profileId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      detail: input.detail ?? null,
      payloadHash: input.payloadHash ?? null,
      actor: input.actor ?? null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export interface CreateCancellationInput {
  profileId: string;
  medicationId?: string | null;
  medicationName: string;
  triggerType: ErxCancellationTrigger;
  previousDose?: string | null;
  newDose?: string | null;
  rxReferenceNumber?: string | null;
  originalMessageId?: string | null;
  pharmacyNcpdpId?: string | null;
  pharmacyName?: string | null;
  prescriberNpi?: string | null;
  prescriberName?: string | null;
  reasonText?: string | null;
  daysSupplyRemaining?: number | null;
  initiatedBy?: string | null;
  initiatorRole?: ErxCancellationInitiator;
  batchId?: string | null;
  /** Distinguishes repeat cancellations of the same drug over time. */
  idempotencyDiscriminator?: string | null;
  /** Set by the death workflow, which has already established authority. */
  forceAutoApprove?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CreateCancellationResult {
  request: ErxCancellationRequestDB;
  /** False when an identical request already existed and was returned as-is. */
  created: boolean;
}

/**
 * Create a cancellation request, or return the existing one when an identical
 * request is already open. Auto-transmits when the initiator can self-approve.
 */
export async function createCancellationRequest(
  input: CreateCancellationInput,
): Promise<CreateCancellationResult> {
  const initiatorRole = input.initiatorRole ?? "system_automation";
  const idempotencyKey = buildIdempotencyKey({
    profileId: input.profileId,
    medicationId: input.medicationId,
    medicationName: input.medicationName,
    triggerType: input.triggerType,
    rxReferenceNumber: input.rxReferenceNumber,
    discriminator: input.idempotencyDiscriminator,
  });

  const existing = await findByIdempotencyKey(idempotencyKey);
  if (existing) {
    // A previously failed or withdrawn request should not block a fresh attempt,
    // but an open or completed one must not be duplicated.
    if (!["failed", "cancelled"].includes(existing.status)) {
      return { request: existing, created: false };
    }
  }

  const requiresApproval =
    !input.forceAutoApprove && !SELF_APPROVING_ROLES.includes(initiatorRole);

  const reason = CANCEL_REASON_BY_TRIGGER[input.triggerType];
  const wasteAvoidedCents = estimateWasteAvoidedCents({
    medicationName: input.medicationName,
    daysSupplyRemaining: input.daysSupplyRemaining,
  });

  // Reuse the row when retrying a previously failed/withdrawn request so the
  // unique idempotency index still holds.
  const values = {
    profileId: input.profileId,
    medicationId: input.medicationId ?? null,
    medicationName: input.medicationName,
    previousDose: input.previousDose ?? null,
    newDose: input.newDose ?? null,
    rxReferenceNumber: input.rxReferenceNumber ?? null,
    originalMessageId: input.originalMessageId ?? null,
    messageType: "CancelRx",
    scriptVersion: DEFAULT_SCRIPT_VERSION,
    reasonCode: reason.code,
    reasonText: input.reasonText ?? reason.text,
    pharmacyNcpdpId: input.pharmacyNcpdpId ?? null,
    pharmacyName: input.pharmacyName ?? null,
    prescriberNpi: input.prescriberNpi ?? null,
    prescriberName: input.prescriberName ?? null,
    triggerType: input.triggerType,
    status: (requiresApproval ? "pending_review" : "queued") as ErxCancellationStatus,
    requiresPrescriberApproval: requiresApproval,
    approvedBy: requiresApproval ? null : input.initiatedBy ?? "system",
    approvedAt: requiresApproval ? null : new Date(),
    estimatedWasteAvoidedCents: wasteAvoidedCents,
    daysSupplyRemaining: input.daysSupplyRemaining ?? null,
    initiatedBy: input.initiatedBy ?? null,
    initiatorRole,
    batchId: input.batchId ?? null,
    idempotencyKey,
    metadata: input.metadata ?? null,
    attemptCount: 0,
    lastError: null,
    responseStatus: null,
    responseCode: null,
    responseText: null,
    updatedAt: new Date(),
  };

  let row: ErxCancellationRequestDB;
  if (existing) {
    const [updated] = await phiDb
      .update(erxCancellationRequestsTable)
      .set(encryptPhiRow(REQUESTS_TABLE, values))
      .where(eq(erxCancellationRequestsTable.id, existing.id))
      .returning();
    row = decryptPhiRow(REQUESTS_TABLE, updated);
  } else {
    const [inserted] = await phiDb
      .insert(erxCancellationRequestsTable)
      .values(encryptPhiRow(REQUESTS_TABLE, values))
      .returning();
    row = decryptPhiRow(REQUESTS_TABLE, inserted);
  }

  await recordEvent({
    requestId: row.id,
    profileId: row.profileId,
    eventType: "created",
    toStatus: row.status,
    detail: `Trigger: ${input.triggerType}`,
    actor: input.initiatedBy ?? "system",
  });

  auditLog("ERX_CANCELLATION_CREATED", {
    profileId: hashId(input.profileId),
    requestId: hashId(row.id),
    trigger: input.triggerType,
    requiresApproval,
  });

  if (!requiresApproval) {
    return { request: await transmitCancellationRequest(row.id), created: true };
  }

  return { request: row, created: true };
}

async function findByIdempotencyKey(key: string): Promise<ErxCancellationRequestDB | null> {
  const [row] = await phiDb
    .select()
    .from(erxCancellationRequestsTable)
    .where(eq(erxCancellationRequestsTable.idempotencyKey, key))
    .limit(1);
  return row ? decryptPhiRow(REQUESTS_TABLE, row) : null;
}

// ---------------------------------------------------------------------------
// Trigger 1 — dose change
// ---------------------------------------------------------------------------

export interface DoseChangeTriggerInput {
  profileId: string;
  medicationId: string;
  medicationName: string;
  previousDose?: string | null;
  newDose?: string | null;
  initiatedBy?: string | null;
  initiatorRole?: ErxCancellationInitiator;
  pharmacyNcpdpId?: string | null;
  pharmacyName?: string | null;
  prescriberNpi?: string | null;
  prescriberName?: string | null;
  rxReferenceNumber?: string | null;
  daysSupplyRemaining?: number | null;
}

export interface DoseChangeTriggerResult {
  triggered: boolean;
  assessment: DoseChangeAssessment;
  request?: ErxCancellationRequestDB;
  /** Set when the change was material but no request was created. */
  skippedReason?: string;
}

/**
 * Called when a medication's dose is edited. Cancels the superseded prescription
 * at the pharmacy so the old strength is not dispensed alongside the new one.
 *
 * Returns without creating anything when the edit is cosmetic — a spurious
 * CancelRx disrupts a pharmacy as much as a missed one.
 */
export async function handleDoseChange(
  input: DoseChangeTriggerInput,
): Promise<DoseChangeTriggerResult> {
  const assessment = assessDoseChange(input.previousDose, input.newDose);

  if (!assessment.isMaterial) {
    return { triggered: false, assessment };
  }

  const result = await createCancellationRequest({
    profileId: input.profileId,
    medicationId: input.medicationId,
    medicationName: input.medicationName,
    triggerType: "dose_change",
    previousDose: input.previousDose ?? null,
    newDose: input.newDose ?? null,
    rxReferenceNumber: input.rxReferenceNumber ?? null,
    pharmacyNcpdpId: input.pharmacyNcpdpId ?? null,
    pharmacyName: input.pharmacyName ?? null,
    prescriberNpi: input.prescriberNpi ?? null,
    prescriberName: input.prescriberName ?? null,
    daysSupplyRemaining: input.daysSupplyRemaining ?? null,
    initiatedBy: input.initiatedBy ?? null,
    initiatorRole: input.initiatorRole ?? "patient",
    // Each distinct dose transition earns its own request; without this a second
    // titration of the same drug would collide with the first one's key.
    idempotencyDiscriminator: `${assessment.previous.raw}->${assessment.next.raw}`,
    metadata: { doseChangeReason: assessment.reason },
  });

  return { triggered: true, assessment, request: result.request };
}

// ---------------------------------------------------------------------------
// Transmission
// ---------------------------------------------------------------------------

/**
 * Send a queued request to the pharmacy network. Safe to call repeatedly: a
 * request already in flight or terminal is returned untouched.
 */
export async function transmitCancellationRequest(
  requestId: string,
): Promise<ErxCancellationRequestDB> {
  const request = await getCancellationRequest(requestId);
  if (!request) throw new Error("Cancellation request not found");

  if (TERMINAL_STATUSES.includes(request.status as ErxCancellationStatus)) return request;
  if (IN_FLIGHT_STATUSES.includes(request.status as ErxCancellationStatus)) return request;
  if (request.status === "pending_review") {
    throw new Error("Cancellation request has not been approved");
  }

  const transport = getErxTransport();
  const message = buildCancelRxMessage({
    requestId: request.id,
    // The gateway resolves this opaque reference to network demographics; the
    // patient's name never enters the outbound payload built here.
    profileReference: request.profileId,
    medicationName: request.medicationName,
    triggerType: request.triggerType as ErxCancellationTrigger,
    previousDose: request.previousDose,
    newDose: request.newDose,
    rxReferenceNumber: request.rxReferenceNumber,
    originalMessageId: request.originalMessageId,
    pharmacyNcpdpId: request.pharmacyNcpdpId,
    pharmacyName: request.pharmacyName,
    prescriberNpi: request.prescriberNpi,
    prescriberName: request.prescriberName,
    reasonText: request.reasonText,
    deceasedDate: (request.metadata as Record<string, unknown> | null)?.deceasedDate as
      | string
      | undefined,
    scriptVersion: request.scriptVersion ?? DEFAULT_SCRIPT_VERSION,
    senderId: process.env.SURESCRIPTS_SENDER_ID ?? "TABULA-MEDICA",
    senderName: process.env.SURESCRIPTS_SENDER_NAME,
  });

  await applyStatus(request, "transmitting", { scriptMessageId: message.header.messageId });

  const attemptCount = request.attemptCount + 1;
  const payloadHash = hashPayload(message);

  // A transport that throws instead of returning would strand the row in
  // `transmitting`, where the in-flight guard makes it unreachable forever.
  // Normalise a throw into a retryable error result.
  let result: Awaited<ReturnType<typeof transport.send>>;
  try {
    result = await transport.send(message);
  } catch (error) {
    result = {
      outcome: "error",
      errorKind: "network_error",
      errorMessage: error instanceof Error ? error.message : "Transport threw",
    };
  }

  if (result.outcome === "sent") {
    const updated = await applyStatus(request, "transmitted", {
      scriptMessageId: message.header.messageId,
      transport: transport.name,
      transmittedAt: new Date(),
      attemptCount,
      lastError: null,
      nextAttemptAt: null,
      responseStatus: result.responseStatus ?? null,
      responseCode: result.responseCode ?? null,
      responseText: result.responseText ?? null,
    });
    await recordEvent({
      requestId: request.id,
      profileId: request.profileId,
      eventType: "transmitted",
      fromStatus: request.status,
      toStatus: "transmitted",
      payloadHash,
      detail: `Transport: ${transport.name}`,
      actor: "system",
    });
    auditLog("ERX_CANCELLATION_TRANSMITTED", {
      requestId: hashId(request.id),
      transport: transport.name,
    });
    return updated;
  }

  if (result.outcome === "queued") {
    const updated = await applyStatus(request, "queued", {
      scriptMessageId: message.header.messageId,
      transport: transport.name,
      attemptCount,
      responseText: result.responseText ?? null,
      nextAttemptAt: new Date(Date.now() + nextRetryDelayMs(attemptCount)),
    });
    await recordEvent({
      requestId: request.id,
      profileId: request.profileId,
      eventType: "queued_no_gateway",
      toStatus: "queued",
      payloadHash,
      detail: result.responseText ?? null,
      actor: "system",
    });
    return updated;
  }

  const retryable =
    result.outcome === "error" &&
    RETRYABLE_TRANSPORT_ERRORS.has(result.errorKind ?? "") &&
    attemptCount < MAX_TRANSMISSION_ATTEMPTS;

  const updated = await applyStatus(request, retryable ? "queued" : "failed", {
    transport: transport.name,
    attemptCount,
    lastError: result.errorMessage ?? result.errorKind ?? "Transmission failed",
    nextAttemptAt: retryable ? new Date(Date.now() + nextRetryDelayMs(attemptCount)) : null,
  });

  await recordEvent({
    requestId: request.id,
    profileId: request.profileId,
    eventType: retryable ? "transmission_retry_scheduled" : "transmission_failed",
    fromStatus: request.status,
    toStatus: updated.status,
    payloadHash,
    detail: result.errorMessage ?? result.errorKind ?? null,
    actor: "system",
  });

  logger.error(
    {
      component: "ErxCancel",
      requestId: hashId(request.id),
      errorKind: result.errorKind,
      attemptCount,
      retryable,
    },
    "CancelRx transmission unsuccessful",
  );

  return updated;
}

async function applyStatus(
  request: ErxCancellationRequestDB,
  status: ErxCancellationStatus,
  extra: Partial<ErxCancellationRequestDB> = {},
): Promise<ErxCancellationRequestDB> {
  const [updated] = await phiDb
    .update(erxCancellationRequestsTable)
    .set(encryptPhiRow(REQUESTS_TABLE, { ...extra, status, updatedAt: new Date() }))
    .where(eq(erxCancellationRequestsTable.id, request.id))
    .returning();
  return decryptPhiRow(REQUESTS_TABLE, updated);
}

/**
 * Retry sweep for queued requests whose backoff has elapsed. Intended to be
 * driven by the existing job scheduler; returns a summary for the admin route.
 */
export async function processPendingTransmissions(limit = 50): Promise<{
  processed: number;
  transmitted: number;
  failed: number;
  stillQueued: number;
}> {
  const due = await phiDb
    .select()
    .from(erxCancellationRequestsTable)
    .where(
      and(
        eq(erxCancellationRequestsTable.status, "queued"),
        or(
          isNull(erxCancellationRequestsTable.nextAttemptAt),
          lte(erxCancellationRequestsTable.nextAttemptAt, new Date()),
        ),
      ),
    )
    .orderBy(erxCancellationRequestsTable.createdAt)
    .limit(limit);

  let transmitted = 0;
  let failed = 0;
  let stillQueued = 0;

  for (const row of due) {
    try {
      const result = await transmitCancellationRequest(row.id);
      if (result.status === "transmitted") transmitted += 1;
      else if (result.status === "failed") failed += 1;
      else stillQueued += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        { component: "ErxCancel", err: error, requestId: hashId(row.id) },
        "Queued CancelRx retry threw",
      );
    }
  }

  return { processed: due.length, transmitted, failed, stillQueued };
}

// ---------------------------------------------------------------------------
// Approval / withdrawal
// ---------------------------------------------------------------------------

export async function approveCancellationRequest(
  requestId: string,
  approvedBy: string,
): Promise<ErxCancellationRequestDB> {
  const request = await getCancellationRequest(requestId);
  if (!request) throw new Error("Cancellation request not found");
  if (request.status !== "pending_review") {
    throw new Error(`Cannot approve a request in status "${request.status}"`);
  }

  await applyStatus(request, "queued", { approvedBy, approvedAt: new Date() });
  await recordEvent({
    requestId,
    profileId: request.profileId,
    eventType: "approved",
    fromStatus: "pending_review",
    toStatus: "queued",
    actor: approvedBy,
  });
  auditLog("ERX_CANCELLATION_APPROVED", { requestId: hashId(requestId) });

  return transmitCancellationRequest(requestId);
}

/** Withdraw a request that has not yet left for the pharmacy network. */
export async function withdrawCancellationRequest(
  requestId: string,
  actor: string,
  reason?: string,
): Promise<ErxCancellationRequestDB> {
  const request = await getCancellationRequest(requestId);
  if (!request) throw new Error("Cancellation request not found");
  if (IN_FLIGHT_STATUSES.includes(request.status as ErxCancellationStatus)) {
    throw new Error("Request has already been transmitted and cannot be withdrawn");
  }
  if (TERMINAL_STATUSES.includes(request.status as ErxCancellationStatus)) {
    return request;
  }

  const updated = await applyStatus(request, "cancelled", { lastError: null, nextAttemptAt: null });
  await recordEvent({
    requestId,
    profileId: request.profileId,
    eventType: "withdrawn",
    fromStatus: request.status,
    toStatus: "cancelled",
    detail: reason ?? null,
    actor,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Pharmacy response reconciliation
// ---------------------------------------------------------------------------

export interface CancelRxResponseInput {
  /** MessageID of the CancelRx being answered. */
  scriptMessageId: string;
  responseStatus: string;
  denialCode?: string | null;
  denialText?: string | null;
}

/**
 * Apply an inbound CancelRxResponse. Returns null when the referenced message is
 * unknown, which the webhook route reports as a 404 rather than silently
 * swallowing — an unmatched response means a real cancellation is unaccounted for.
 */
export async function recordCancelRxResponse(
  input: CancelRxResponseInput,
): Promise<ErxCancellationRequestDB | null> {
  const [row] = await phiDb
    .select()
    .from(erxCancellationRequestsTable)
    .where(eq(erxCancellationRequestsTable.scriptMessageId, input.scriptMessageId))
    .limit(1);

  if (!row) return null;
  const request = decryptPhiRow(REQUESTS_TABLE, row);

  const interpretation = interpretCancelRxResponse({
    responseStatus: input.responseStatus,
    denialCode: input.denialCode,
  });

  const updated = await applyStatus(request, interpretation.status, {
    acknowledgedAt: new Date(),
    responseStatus: input.responseStatus,
    responseCode: input.denialCode ?? null,
    responseText: input.denialText ?? interpretation.denialDescription ?? null,
    // Waste is only counted when the pharmacy confirms the drug never left.
    estimatedWasteAvoidedCents: interpretation.wasteAvoided
      ? request.estimatedWasteAvoidedCents
      : 0,
  });

  await recordEvent({
    requestId: request.id,
    profileId: request.profileId,
    eventType: "response_received",
    fromStatus: request.status,
    toStatus: interpretation.status,
    detail: interpretation.denialDescription ?? input.responseStatus,
    actor: "pharmacy",
  });

  auditLog("ERX_CANCELLATION_RESPONSE", {
    requestId: hashId(request.id),
    status: interpretation.status,
    wasteAvoided: interpretation.wasteAvoided,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Trigger 3 — patient demise
// ---------------------------------------------------------------------------

export interface RecordMortalityInput {
  profileId: string;
  deceasedDate?: string | null;
  source: MortalitySource;
  reportedBy?: string | null;
  reporterRelationship?: string | null;
  notes?: string | null;
  cancelImmediately?: boolean;
  actor: string;
}

export interface MortalityResult {
  record: PatientMortalityRecordDB;
  batchId: string | null;
  cancellationsCreated: number;
  medicationsConsidered: number;
  /** Set when cancellations were withheld pending verification. */
  heldForVerification: boolean;
}

/**
 * Record a death and, when the report is authoritative, cancel every open
 * prescription in one batch.
 *
 * A death report from a non-authoritative source (family, obituary match) is
 * stored as `pending_verification` and sends nothing. Cancelling a living
 * patient's prescriptions on an unverified report is a patient-safety event, so
 * the unattended path is restricted to sources that can stand on their own.
 */
export async function recordPatientMortality(
  input: RecordMortalityInput,
): Promise<MortalityResult> {
  const authoritative = AUTHORITATIVE_MORTALITY_SOURCES.includes(input.source);
  const shouldCancelNow = authoritative && input.cancelImmediately !== false;

  const verificationStatus = authoritative ? "verified" : "pending_verification";
  const now = new Date();

  const [existingRow] = await phiDb
    .select()
    .from(patientMortalityRecordsTable)
    .where(eq(patientMortalityRecordsTable.profileId, input.profileId))
    .limit(1);

  const values = {
    profileId: input.profileId,
    deceasedDate: input.deceasedDate ?? null,
    source: input.source,
    verificationStatus,
    reportedBy: input.reportedBy ?? input.actor,
    reporterRelationship: input.reporterRelationship ?? null,
    verifiedBy: authoritative ? input.actor : null,
    verifiedAt: authoritative ? now : null,
    notes: input.notes ?? null,
    rescindedAt: null,
    rescindedBy: null,
    rescindReason: null,
    updatedAt: now,
  };

  let record: PatientMortalityRecordDB;
  if (existingRow) {
    const [updated] = await phiDb
      .update(patientMortalityRecordsTable)
      .set(encryptPhiRow(MORTALITY_TABLE, values))
      .where(eq(patientMortalityRecordsTable.id, existingRow.id))
      .returning();
    record = decryptPhiRow(MORTALITY_TABLE, updated);
  } else {
    const [inserted] = await phiDb
      .insert(patientMortalityRecordsTable)
      .values(encryptPhiRow(MORTALITY_TABLE, values))
      .returning();
    record = decryptPhiRow(MORTALITY_TABLE, inserted);
  }

  auditLog("PATIENT_MORTALITY_RECORDED", {
    profileId: hashId(input.profileId),
    source: input.source,
    verificationStatus,
    willCancel: shouldCancelNow,
  });

  if (!shouldCancelNow) {
    return {
      record,
      batchId: null,
      cancellationsCreated: 0,
      medicationsConsidered: 0,
      heldForVerification: true,
    };
  }

  const outcome = await cancelAllOpenPrescriptions({
    profileId: input.profileId,
    deceasedDate: input.deceasedDate ?? null,
    actor: input.actor,
  });

  const [finalRow] = await phiDb
    .update(patientMortalityRecordsTable)
    .set(
      encryptPhiRow(MORTALITY_TABLE, {
        cancellationBatchId: outcome.batchId,
        prescriptionsCancelled: outcome.cancellationsCreated,
        cancellationRunAt: new Date(),
        updatedAt: new Date(),
      }),
    )
    .where(eq(patientMortalityRecordsTable.id, record.id))
    .returning();

  return {
    record: decryptPhiRow(MORTALITY_TABLE, finalRow),
    batchId: outcome.batchId,
    cancellationsCreated: outcome.cancellationsCreated,
    medicationsConsidered: outcome.medicationsConsidered,
    heldForVerification: false,
  };
}

/**
 * Verify a previously-unverified death report and run the cancellation batch
 * that was withheld at intake.
 */
export async function verifyPatientMortality(
  profileId: string,
  verifiedBy: string,
): Promise<MortalityResult> {
  const record = await getMortalityRecord(profileId);
  if (!record) throw new Error("No mortality record on file for this patient");
  if (record.verificationStatus === "rescinded") {
    throw new Error("This death report was rescinded and cannot be verified");
  }

  const outcome = await cancelAllOpenPrescriptions({
    profileId,
    deceasedDate: record.deceasedDate,
    actor: verifiedBy,
  });

  const [updated] = await phiDb
    .update(patientMortalityRecordsTable)
    .set(
      encryptPhiRow(MORTALITY_TABLE, {
        verificationStatus: "verified",
        verifiedBy,
        verifiedAt: new Date(),
        cancellationBatchId: outcome.batchId,
        prescriptionsCancelled: outcome.cancellationsCreated,
        cancellationRunAt: new Date(),
        updatedAt: new Date(),
      }),
    )
    .where(eq(patientMortalityRecordsTable.id, record.id))
    .returning();

  auditLog("PATIENT_MORTALITY_VERIFIED", {
    profileId: hashId(profileId),
    cancellations: outcome.cancellationsCreated,
  });

  return {
    record: decryptPhiRow(MORTALITY_TABLE, updated),
    batchId: outcome.batchId,
    cancellationsCreated: outcome.cancellationsCreated,
    medicationsConsidered: outcome.medicationsConsidered,
    heldForVerification: false,
  };
}

async function cancelAllOpenPrescriptions(input: {
  profileId: string;
  deceasedDate: string | null;
  actor: string;
}): Promise<{ batchId: string; cancellationsCreated: number; medicationsConsidered: number }> {
  const batchId = randomUUID();

  const encRows = await phiDb
    .select()
    .from(medicationsTable)
    .where(
      and(
        eq(medicationsTable.profileId, input.profileId),
        inArray(medicationsTable.status, ["active", "inactive"]),
      ),
    );
  const medications = decryptPhiRows("medicationsTable", encRows);

  let cancellationsCreated = 0;

  for (const medication of medications) {
    try {
      const result = await createCancellationRequest({
        profileId: input.profileId,
        medicationId: medication.id,
        medicationName: medication.name,
        triggerType: "patient_deceased",
        previousDose: medication.dose,
        initiatedBy: input.actor,
        initiatorRole: "system_automation",
        batchId,
        // Authority was established by the mortality workflow before this runs.
        forceAutoApprove: true,
        idempotencyDiscriminator: batchId,
        metadata: input.deceasedDate ? { deceasedDate: input.deceasedDate } : null,
      });
      if (result.created) cancellationsCreated += 1;
    } catch (error) {
      logger.error(
        {
          component: "ErxCancel",
          err: error,
          profileId: hashId(input.profileId),
          batchId,
        },
        "Failed to queue a CancelRx during the mortality batch",
      );
    }
  }

  // Mark the medications themselves discontinued so the PHR stops surfacing them.
  if (medications.length > 0) {
    await phiDb
      .update(medicationsTable)
      .set(encryptPhiRow("medicationsTable", { status: "discontinued" }))
      .where(
        and(
          eq(medicationsTable.profileId, input.profileId),
          inArray(
            medicationsTable.id,
            medications.map((m) => m.id),
          ),
        ),
      );
  }

  auditLog("MORTALITY_CANCELLATION_BATCH", {
    profileId: hashId(input.profileId),
    batchId,
    medicationsConsidered: medications.length,
    cancellationsCreated,
  });

  return { batchId, cancellationsCreated, medicationsConsidered: medications.length };
}

/**
 * Reverse an erroneous death report. Any cancellation from the batch that has
 * not yet been transmitted is withdrawn; already-transmitted ones cannot be
 * recalled and are reported back so a human can phone the pharmacy.
 */
export async function rescindPatientMortality(input: {
  profileId: string;
  rescindedBy: string;
  rescindReason: string;
}): Promise<{
  record: PatientMortalityRecordDB;
  withdrawn: number;
  alreadyTransmitted: ErxCancellationRequestDB[];
}> {
  const record = await getMortalityRecord(input.profileId);
  if (!record) throw new Error("No mortality record on file for this patient");

  const [updated] = await phiDb
    .update(patientMortalityRecordsTable)
    .set(
      encryptPhiRow(MORTALITY_TABLE, {
        verificationStatus: "rescinded",
        rescindedAt: new Date(),
        rescindedBy: input.rescindedBy,
        rescindReason: input.rescindReason,
        updatedAt: new Date(),
      }),
    )
    .where(eq(patientMortalityRecordsTable.id, record.id))
    .returning();

  let withdrawn = 0;
  const alreadyTransmitted: ErxCancellationRequestDB[] = [];

  if (record.cancellationBatchId) {
    const encRows = await phiDb
      .select()
      .from(erxCancellationRequestsTable)
      .where(eq(erxCancellationRequestsTable.batchId, record.cancellationBatchId));

    for (const row of decryptPhiRows(REQUESTS_TABLE, encRows)) {
      if (
        IN_FLIGHT_STATUSES.includes(row.status as ErxCancellationStatus) ||
        row.status === "acknowledged"
      ) {
        alreadyTransmitted.push(row);
        continue;
      }
      if (TERMINAL_STATUSES.includes(row.status as ErxCancellationStatus)) continue;
      await withdrawCancellationRequest(row.id, input.rescindedBy, "Death report rescinded");
      withdrawn += 1;
    }
  }

  logger.warn(
    {
      component: "ErxCancel",
      profileId: hashId(input.profileId),
      withdrawn,
      alreadyTransmitted: alreadyTransmitted.length,
    },
    "Death report rescinded",
  );
  auditLog("PATIENT_MORTALITY_RESCINDED", {
    profileId: hashId(input.profileId),
    withdrawn,
    unrecoverable: alreadyTransmitted.length,
  });

  return { record: decryptPhiRow(MORTALITY_TABLE, updated), withdrawn, alreadyTransmitted };
}

export async function getMortalityRecord(
  profileId: string,
): Promise<PatientMortalityRecordDB | null> {
  const [row] = await phiDb
    .select()
    .from(patientMortalityRecordsTable)
    .where(eq(patientMortalityRecordsTable.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow(MORTALITY_TABLE, row) : null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getCancellationRequest(
  requestId: string,
): Promise<ErxCancellationRequestDB | null> {
  const [row] = await phiDb
    .select()
    .from(erxCancellationRequestsTable)
    .where(eq(erxCancellationRequestsTable.id, requestId))
    .limit(1);
  return row ? decryptPhiRow(REQUESTS_TABLE, row) : null;
}

export async function listCancellationRequests(
  profileId: string,
  filters: { status?: ErxCancellationStatus; triggerType?: ErxCancellationTrigger; limit?: number } = {},
): Promise<ErxCancellationRequestDB[]> {
  const conditions = [eq(erxCancellationRequestsTable.profileId, profileId)];
  if (filters.status) conditions.push(eq(erxCancellationRequestsTable.status, filters.status));
  if (filters.triggerType) {
    conditions.push(eq(erxCancellationRequestsTable.triggerType, filters.triggerType));
  }

  const rows = await phiDb
    .select()
    .from(erxCancellationRequestsTable)
    .where(and(...conditions))
    .orderBy(desc(erxCancellationRequestsTable.createdAt))
    .limit(Math.min(filters.limit ?? 100, 500));

  return decryptPhiRows(REQUESTS_TABLE, rows);
}

export async function getCancellationEvents(requestId: string) {
  const rows = await phiDb
    .select()
    .from(erxCancellationEventsTable)
    .where(eq(erxCancellationEventsTable.requestId, requestId))
    .orderBy(erxCancellationEventsTable.createdAt);
  return decryptPhiRows(EVENTS_TABLE, rows);
}

export interface WasteSavingsSummary {
  totalRequests: number;
  acknowledged: number;
  pendingReview: number;
  inFlight: number;
  denied: number;
  failed: number;
  /** Only counts requests the pharmacy confirmed as cancelled before dispensing. */
  confirmedWasteAvoidedCents: number;
  /** Includes requests still awaiting a pharmacy response. */
  projectedWasteAvoidedCents: number;
  byTrigger: Record<string, number>;
}

/**
 * Waste-avoidance rollup. Confirmed and projected are reported separately so the
 * headline number is not inflated by cancellations the pharmacy has not
 * acknowledged yet.
 */
export async function getWasteSavingsSummary(profileId: string): Promise<WasteSavingsSummary> {
  const rows = await listCancellationRequests(profileId, { limit: 500 });

  const summary: WasteSavingsSummary = {
    totalRequests: rows.length,
    acknowledged: 0,
    pendingReview: 0,
    inFlight: 0,
    denied: 0,
    failed: 0,
    confirmedWasteAvoidedCents: 0,
    projectedWasteAvoidedCents: 0,
    byTrigger: {},
  };

  for (const row of rows) {
    const cents = row.estimatedWasteAvoidedCents ?? 0;
    summary.byTrigger[row.triggerType] = (summary.byTrigger[row.triggerType] ?? 0) + 1;

    switch (row.status) {
      case "acknowledged":
        summary.acknowledged += 1;
        summary.confirmedWasteAvoidedCents += cents;
        summary.projectedWasteAvoidedCents += cents;
        break;
      case "pending_review":
        summary.pendingReview += 1;
        break;
      case "queued":
      case "transmitting":
      case "transmitted":
        summary.inFlight += 1;
        summary.projectedWasteAvoidedCents += cents;
        break;
      case "denied":
        summary.denied += 1;
        // A denial with a "returned to stock" code still avoided the waste; the
        // response handler zeroes the estimate when it did not.
        summary.confirmedWasteAvoidedCents += cents;
        summary.projectedWasteAvoidedCents += cents;
        break;
      case "failed":
        summary.failed += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

/** Operational counters for the admin dashboard, across all patients. */
export async function getQueueHealth(): Promise<{
  transport: string;
  transportIsLive: boolean;
  byStatus: Record<string, number>;
  oldestQueuedAt: string | null;
}> {
  const rows = await phiDb
    .select({
      status: erxCancellationRequestsTable.status,
      count: sql<number>`count(*)::int`,
      oldest: sql<string | null>`min(${erxCancellationRequestsTable.createdAt})::text`,
    })
    .from(erxCancellationRequestsTable)
    .groupBy(erxCancellationRequestsTable.status);

  const byStatus: Record<string, number> = {};
  let oldestQueuedAt: string | null = null;
  for (const row of rows) {
    byStatus[row.status] = row.count;
    if (row.status === "queued") oldestQueuedAt = row.oldest;
  }

  const transport = getErxTransport();
  return {
    transport: transport.name,
    transportIsLive: transport.isLive,
    byStatus,
    oldestQueuedAt,
  };
}
