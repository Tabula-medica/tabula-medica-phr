import { storage } from "./storage";
import type { InsertHealthRecord } from "@shared/schema";

/**
 * Seed a small, deterministic set of demo data sources and health records
 * for an App Store reviewer demo user. Per-record failures are logged and
 * counted but do not abort the seeding pass — leaving the reviewer with a
 * partial dashboard is strictly better than an empty one. Returns the
 * number of records actually persisted so the caller can decide whether
 * a partial seed should be surfaced.
 */
export async function createDemoData(userId: string): Promise<{ seeded: number; total: number; failures: string[] }> {
  const demoSource = await storage.createDataSource({
    userId,
    name: "City Medical Center",
    type: "hospital",
    fhirEndpoint: "https://demo.smarthealthit.org/v/r4/fhir",
    isConnected: true,
    lastSyncAt: new Date(),
    recordCount: 5,
    clientId: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    patientId: null,
  });

  const demoSource2 = await storage.createDataSource({
    userId,
    name: "Quest Diagnostics",
    type: "lab",
    fhirEndpoint: null,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    recordCount: 2,
    clientId: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    patientId: null,
  });

  const demoRecords: InsertHealthRecord[] = [
    {
      userId,
      type: "visit",
      title: "Annual Physical Examination",
      summary: "Routine wellness visit with comprehensive health assessment. All vitals within normal limits.",
      date: new Date("2024-01-15"),
      provider: "Dr. Sarah Chen",
      facility: "City Medical Center",
      sourceId: demoSource.id,
      fhirResourceType: "Encounter",
      fhirResourceId: "enc-001",
      isManual: false,
      details: null,
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    },
    {
      userId,
      type: "lab",
      title: "Complete Blood Count (CBC)",
      summary: "All values within normal reference ranges. WBC 7.2, RBC 4.8, Hemoglobin 14.2, Platelets 250.",
      date: new Date("2024-01-15"),
      provider: "Dr. Sarah Chen",
      facility: "Quest Diagnostics",
      sourceId: demoSource2.id,
      fhirResourceType: "Observation",
      fhirResourceId: "obs-001",
      isManual: false,
      details: { wbc: "7.2", rbc: "4.8", hemoglobin: "14.2", platelets: "250" },
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    },
    {
      userId,
      type: "medication",
      title: "Lisinopril 10mg",
      summary: "Blood pressure medication. Take once daily in the morning.",
      date: new Date("2024-01-10"),
      provider: "Dr. Sarah Chen",
      facility: "City Medical Center",
      sourceId: demoSource.id,
      fhirResourceType: "MedicationRequest",
      fhirResourceId: "med-001",
      isManual: false,
      details: { dosage: "10mg", frequency: "Once daily", route: "Oral" },
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    },
    {
      userId,
      type: "imaging",
      title: "Chest X-Ray",
      summary: "No acute cardiopulmonary findings. Heart size normal. Lungs are clear.",
      date: new Date("2024-01-08"),
      provider: "Dr. Michael Roberts",
      facility: "City Medical Center Imaging",
      sourceId: demoSource.id,
      fhirResourceType: "DiagnosticReport",
      fhirResourceId: "img-001",
      isManual: false,
      details: { modality: "X-Ray", bodyPart: "Chest", findings: "Normal" },
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    },
    {
      userId,
      type: "immunization",
      title: "Influenza Vaccine",
      summary: "Annual flu vaccination administered. Quadrivalent formulation.",
      date: new Date("2023-11-01"),
      provider: "Nurse Johnson",
      facility: "City Medical Center",
      sourceId: demoSource.id,
      fhirResourceType: "Immunization",
      fhirResourceId: "imm-001",
      isManual: false,
      details: { vaccineType: "Quadrivalent", manufacturer: "Sanofi" },
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    },
  ];

  let seeded = 0;
  const failures: string[] = [];
  for (const record of demoRecords) {
    try {
      await storage.createHealthRecord(record);
      seeded++;
    } catch (err: unknown) {
      const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
      failures.push(`${record.title}: ${detail}`);
      console.warn(`[Reviewer] createDemoData: failed to seed record "${record.title}":`, detail);
    }
  }
  console.log(`[Reviewer] createDemoData: seeded ${seeded}/${demoRecords.length} records for user ${userId}`);
  return { seeded, total: demoRecords.length, failures };
}
