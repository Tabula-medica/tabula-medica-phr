import { db } from "../db";
import { externalIdentities } from "@shared/models/auth";
import { and, eq } from "drizzle-orm";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import type { EhrConnection } from "@shared/schema";
import {
  mapFhirPatient,
  mapFhirCondition,
  mapFhirObservationToVital,
  mapFhirObservationToLabResult,
  mapFhirMedicationRequest,
  mapFhirAllergyIntolerance,
  mapFhirProcedure,
  mapFhirEncounterToRecord,
} from "../fhir/mapper";
import { isFastenConfigured, fastenAuthHeader } from "./fasten";
import {
  extractExportPayload,
  isAllowedFastenDownloadUrl,
  parseFhirResources,
  bucketResources,
} from "./fasten-export-parsing";
import { resolveUnifiedPatientForNewSource, attachEhrSourceToUnifiedPatient } from "../services/patient-identity-resolution";

// ---------------------------------------------------------------------------
// Fasten EHI-export ingestion.
//
// After BYOI signup, /api/auth/fasten/link kicks off an async EHI export
// (server/auth/fasten.ts triggerFastenExport). Fasten later posts a
// patient.ehi_export_success event to /api/fasten-connect/webhook — THIS
// module turns that event into actual PHR data: it resolves the linked user
// via external_identities, downloads the export, and imports the FHIR
// resources through the same mappers the EHR sync path uses, under a
// "fastenhealth" EhrConnection so provenance and the connections UI work.
// ---------------------------------------------------------------------------

const FASTEN_FACILITY_NAME = "Fasten Health";

export interface FastenImportResult {
  orgConnectionId: string;
  userId: string;
  recordsAdded: number;
  vitalsAdded: number;
  medicationsAdded: number;
  errors: string[];
}

async function findLinkedUserId(orgConnectionId: string): Promise<string | null> {
  const [identity] = await db
    .select()
    .from(externalIdentities)
    .where(
      and(
        eq(externalIdentities.provider, "fasten"),
        eq(externalIdentities.externalSub, orgConnectionId),
      ),
    )
    .limit(1);
  return identity?.userId ?? null;
}

async function getOrCreateFastenConnection(userId: string, orgConnectionId: string): Promise<EhrConnection> {
  const connections = await storage.getEhrConnections(userId);
  // Match on the specific org connection, not just "any fastenhealth
  // connection for this user" — a user can link multiple Fasten
  // organizations, and picking the wrong one would attribute this export's
  // records to a different organization's patient.
  const existing = connections.find(
    c => c.userId === userId && c.platform === "fastenhealth" && c.externalConnectionId === orgConnectionId,
  );
  if (existing) return existing;
  return storage.createEhrConnection({
    userId,
    platform: "fastenhealth",
    facilityName: FASTEN_FACILITY_NAME,
    status: "connected",
    externalConnectionId: orgConnectionId,
  });
}

async function downloadExport(downloadUrl: string): Promise<string | null> {
  if (!isAllowedFastenDownloadUrl(downloadUrl)) {
    logger.warn(`[FastenImport] refusing non-Fasten download URL host`);
    return null;
  }
  try {
    const res = await fetch(downloadUrl, {
      method: "GET",
      // The allowlist only validates the INITIAL host; fetch() follows
      // redirects by default, which would let an allowed URL silently
      // redirect our Fasten credential to an arbitrary host. "error" makes
      // fetch throw on any redirect response instead of following it.
      redirect: "error",
      headers: {
        Authorization: fastenAuthHeader(),
        Accept: "application/fhir+json, application/fhir+ndjson, application/json",
      },
    });
    if (!res.ok) {
      logger.warn(`[FastenImport] export download non-OK: ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err: any) {
    logger.error(`[FastenImport] export download error: ${err?.message}`);
    return null;
  }
}

/**
 * Handle a patient.ehi_export_success webhook event end-to-end. Returns the
 * import summary, or null when the event carries nothing importable (never
 * throws — the webhook must always 200 to Fasten).
 */
export async function processFastenExportEvent(
  event: unknown,
): Promise<FastenImportResult | null> {
  const ts = () => new Date().toISOString();
  try {
    if (!isFastenConfigured()) {
      logger.warn(`[FastenImport] export event received but Fasten is not configured`);
      return null;
    }
    const payload = extractExportPayload(event);
    if (!payload) {
      console.warn(
        `[HIPAA-AUDIT][FastenConnect] ${ts()} - EXPORT_EVENT_NO_CONNECTION_ID - preceding WEBHOOK_EVENT log has type/task/redacted-conn only; get a fresh test payload from Fasten to extend the parser`,
      );
      return null;
    }

    const userId = await findLinkedUserId(payload.orgConnectionId);
    if (!userId) {
      console.warn(
        `[HIPAA-AUDIT][FastenConnect] ${ts()} - EXPORT_EVENT_UNLINKED - conn:${payload.orgConnectionId} (no external_identities row; signup may have been abandoned)`,
      );
      return null;
    }

    const connection = await getOrCreateFastenConnection(userId, payload.orgConnectionId);

    // Idempotency: webhooks are at-least-once delivery, and a retried or
    // replayed patient.ehi_export_success would otherwise re-run every
    // resource loop below and duplicate the patient's entire clinical
    // history. Skip re-processing a task we've already imported.
    if (payload.taskId && connection.lastImportedTaskId === payload.taskId) {
      console.log(
        `[HIPAA-AUDIT][FastenConnect] ${ts()} - EXPORT_ALREADY_IMPORTED - conn:${payload.orgConnectionId} task:${payload.taskId}`,
      );
      return null;
    }

    if (!payload.downloadUrl) {
      console.warn(
        `[HIPAA-AUDIT][FastenConnect] ${ts()} - EXPORT_EVENT_NO_DOWNLOAD_URL - conn:${payload.orgConnectionId} task:${payload.taskId ?? "none"} - preceding WEBHOOK_EVENT log has type/task/redacted-conn only; get a fresh test payload from Fasten to extend the parser`,
      );
      return null;
    }

    const body = await downloadExport(payload.downloadUrl);
    if (!body) return null;

    const resources = parseFhirResources(body);
    if (resources.length === 0) {
      logger.warn(`[FastenImport] export contained no FHIR resources`);
      return null;
    }
    const buckets = bucketResources(resources);

    await storage.updateEhrConnection(connection.id, { status: "syncing" });

    // One patient row per Fasten connection: reuse it across repeat exports so
    // re-imports don't multiply patients.
    const existingPatients = await storage.getPatientsByConnection(connection.id);
    let patient = existingPatients[0];
    if (!patient) {
      const source = buckets.patient ?? { id: payload.orgConnectionId };
      const patientData = mapFhirPatient(source, connection);

      // Positive patient ID: this account may already have a matching
      // identity from a different EHR connection — link into it instead of
      // creating a second, disconnected identity for the same person. The
      // match must run BEFORE createPatient (its result only decides which
      // UnifiedPatient to use); the source is attached to it afterward, once
      // the real internal patient id exists.
      const identityMatch = await resolveUnifiedPatientForNewSource(userId, {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        dateOfBirth: patientData.dateOfBirth,
        email: patientData.email,
        phone: patientData.phone,
        ehrConnectionId: connection.id,
        platform: connection.platform,
        facilityName: connection.facilityName,
        mrn: patientData.mrn,
      });
      patientData.unifiedPatientId = identityMatch.unifiedPatientId;

      patient = await storage.createPatient(patientData);

      await attachEhrSourceToUnifiedPatient(identityMatch, {
        ehrConnectionId: connection.id,
        platform: connection.platform,
        facilityName: connection.facilityName,
        mrn: patientData.mrn,
        patientId: patient.id,
      });
    }

    const result: FastenImportResult = {
      orgConnectionId: payload.orgConnectionId,
      userId,
      recordsAdded: 0,
      vitalsAdded: 0,
      medicationsAdded: 0,
      errors: [],
    };

    for (const condition of buckets.conditions) {
      try {
        await storage.createMedicalRecord(mapFhirCondition(condition, patient.id, connection));
        result.recordsAdded++;
      } catch (e: any) {
        result.errors.push(`Condition: ${e.message}`);
      }
    }

    for (const observation of buckets.observations) {
      try {
        const vital = mapFhirObservationToVital(observation, patient.id, connection);
        if (vital) {
          await storage.createVitalSign(vital);
          result.vitalsAdded++;
        } else {
          const labResult = mapFhirObservationToLabResult(observation, patient.id, connection);
          if (labResult) {
            await storage.createMedicalRecord(labResult);
            result.recordsAdded++;
          }
        }
      } catch (e: any) {
        result.errors.push(`Observation: ${e.message}`);
      }
    }

    for (const medRequest of buckets.medications) {
      try {
        await storage.createMedication(mapFhirMedicationRequest(medRequest, patient.id, connection));
        result.medicationsAdded++;
      } catch (e: any) {
        result.errors.push(`Medication: ${e.message}`);
      }
    }

    for (const allergy of buckets.allergies) {
      try {
        await storage.createMedicalRecord(mapFhirAllergyIntolerance(allergy, patient.id, connection));
        result.recordsAdded++;
      } catch (e: any) {
        result.errors.push(`Allergy: ${e.message}`);
      }
    }

    for (const procedure of buckets.procedures) {
      try {
        await storage.createMedicalRecord(mapFhirProcedure(procedure, patient.id, connection));
        result.recordsAdded++;
      } catch (e: any) {
        result.errors.push(`Procedure: ${e.message}`);
      }
    }

    for (const encounter of buckets.encounters) {
      try {
        await storage.createMedicalRecord(mapFhirEncounterToRecord(encounter, patient.id, connection));
        result.recordsAdded++;
      } catch (e: any) {
        result.errors.push(`Encounter: ${e.message}`);
      }
    }

    for (const immunization of buckets.immunizations) {
      try {
        const title =
          immunization.vaccineCode?.text ||
          immunization.vaccineCode?.coding?.[0]?.display ||
          "Immunization";
        await storage.createMedicalRecord({
          patientId: patient.id,
          ehrConnectionId: connection.id,
          type: "note",
          title,
          description: `${title} administered`,
          date: immunization.occurrenceDateTime || new Date().toISOString(),
          provider: immunization.performer?.[0]?.actor?.display || "Unknown Provider",
          facility: immunization.location?.display || connection.facilityName,
          status: "resolved",
        });
        result.recordsAdded++;
      } catch (e: any) {
        result.errors.push(`Immunization: ${e.message}`);
      }
    }

    await storage.updateEhrConnection(connection.id, {
      status: "connected",
      lastSync: new Date().toISOString(),
      patientCount: 1,
      syncError: undefined,
      lastImportedTaskId: payload.taskId ?? connection.lastImportedTaskId,
      lastSyncResult: {
        success: result.errors.length === 0,
        recordsAdded: result.recordsAdded + result.vitalsAdded + result.medicationsAdded,
        errors: result.errors.slice(0, 10),
        partialSync: result.errors.length > 0,
        duration: 0,
      },
    });

    console.log(
      `[HIPAA-AUDIT][FastenConnect] ${ts()} - EXPORT_IMPORTED - user:${userId} conn:${payload.orgConnectionId} records:${result.recordsAdded} vitals:${result.vitalsAdded} meds:${result.medicationsAdded} skippedOther:${buckets.other} errors:${result.errors.length}`,
    );
    return result;
  } catch (err: any) {
    logger.error(`[FastenImport] unhandled import error: ${err?.message}`);
    return null;
  }
}
