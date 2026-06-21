import { FhirClient } from "./client";
import {
  mapFhirPatient,
  mapFhirCondition,
  mapFhirObservationToVital,
  mapFhirObservationToLabResult,
  mapFhirMedicationRequest,
  mapFhirAllergyIntolerance,
  mapFhirProcedure,
  mapFhirEncounterToRecord,
} from "./mapper";
import { storage } from "../storage";
import type { EhrConnection } from "@shared/schema";

export interface SyncResult {
  success: boolean;
  patientsAdded: number;
  recordsAdded: number;
  medicationsAdded: number;
  vitalsAdded: number;
  allergiesAdded: number;
  proceduresAdded: number;
  encountersAdded: number;
  immunizationsAdded: number;
  errors: string[];
  duration: number;
}

export async function syncEhrConnection(connection: EhrConnection): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    patientsAdded: 0,
    recordsAdded: 0,
    medicationsAdded: 0,
    vitalsAdded: 0,
    allergiesAdded: 0,
    proceduresAdded: 0,
    encountersAdded: 0,
    immunizationsAdded: 0,
    errors: [],
    duration: 0,
  };

  try {
    if (!connection.tokens || !connection.fhirConfig) {
      throw new Error("Connection is not authenticated");
    }

    if (!connection.smartContext?.patientId) {
      throw new Error("No patient ID in SMART context");
    }

    await storage.updateEhrConnection(connection.id, { status: "syncing" });
    console.log(`[FhirSync] Starting sync for connection ${connection.id} (${connection.platform})`);

    const client = new FhirClient(connection);
    const patientId = connection.smartContext.patientId;

    const data = await client.getAllPatientData(patientId);

    const patientData = mapFhirPatient(data.patient, connection);
    const patient = await storage.createPatient(patientData);
    result.patientsAdded = 1;

    for (const condition of data.conditions) {
      try {
        const record = mapFhirCondition(condition, patient.id, connection);
        await storage.createMedicalRecord(record);
        result.recordsAdded++;
      } catch (e: any) {
        result.errors.push(`Condition: ${e.message}`);
      }
    }

    for (const observation of data.observations) {
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

    for (const medRequest of data.medications) {
      try {
        const medication = mapFhirMedicationRequest(medRequest, patient.id, connection);
        await storage.createMedication(medication);
        result.medicationsAdded++;
      } catch (e: any) {
        result.errors.push(`Medication: ${e.message}`);
      }
    }

    for (const allergy of data.allergies) {
      try {
        const record = mapFhirAllergyIntolerance(allergy, patient.id, connection);
        await storage.createMedicalRecord(record);
        result.allergiesAdded++;
      } catch (e: any) {
        result.errors.push(`Allergy: ${e.message}`);
      }
    }

    for (const procedure of data.procedures) {
      try {
        const record = mapFhirProcedure(procedure, patient.id, connection);
        await storage.createMedicalRecord(record);
        result.proceduresAdded++;
      } catch (e: any) {
        result.errors.push(`Procedure: ${e.message}`);
      }
    }

    for (const encounter of data.encounters) {
      try {
        const record = mapFhirEncounterToRecord(encounter, patient.id, connection);
        await storage.createMedicalRecord(record);
        result.encountersAdded++;
      } catch (e: any) {
        result.errors.push(`Encounter: ${e.message}`);
      }
    }

    for (const immunization of data.immunizations) {
      try {
        const title = immunization.vaccineCode?.text ||
          immunization.vaccineCode?.coding?.[0]?.display || "Immunization";
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
        result.immunizationsAdded++;
      } catch (e: any) {
        result.errors.push(`Immunization: ${e.message}`);
      }
    }

    const totalRecords =
      result.recordsAdded +
      result.medicationsAdded +
      result.vitalsAdded +
      result.allergiesAdded +
      result.proceduresAdded +
      result.encountersAdded +
      result.immunizationsAdded;

    await storage.updateEhrConnection(connection.id, {
      status: "connected",
      lastSync: new Date().toISOString(),
      patientCount: 1,
      syncError: undefined,
    });

    result.success = true;
    result.duration = Date.now() - startTime;

    console.log(
      `[FhirSync] Sync complete for ${connection.platform}: ` +
        `${totalRecords} records, ${result.vitalsAdded} vitals, ` +
        `${result.medicationsAdded} meds, ${result.allergiesAdded} allergies, ` +
        `${result.proceduresAdded} procedures, ${result.encountersAdded} encounters, ` +
        `${result.immunizationsAdded} immunizations ` +
        `(${result.duration}ms, ${result.errors.length} errors)`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.duration = Date.now() - startTime;

    await storage.updateEhrConnection(connection.id, {
      status: "error",
      syncError: errorMessage,
    });

    console.error(`[FhirSync] Sync failed for ${connection.platform}: ${errorMessage}`);
  }

  return result;
}
