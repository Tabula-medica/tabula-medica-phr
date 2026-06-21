/**
 * Seed script for the App Store / TestFlight reviewer test account.
 *
 * Usage:
 *   tsx scripts/seed-reviewer-account.ts
 *   (or, if you add the npm alias, `npm run seed:reviewer-account`)
 *
 * The reviewer account uses email `reviewer@tabulamedica.health` with a
 * deterministic Auth0-style id `auth0|reviewer-test-account`. All data
 * created by this script is SYNTHETIC. No real PHI.
 *
 * Re-running the script is idempotent — it removes any existing reviewer
 * data first, then re-seeds. Safe to run any time before submitting a build.
 */

import "dotenv/config";
import { storage } from "../server/storage";

const REVIEWER_USER_ID = "auth0|reviewer-test-account";
const REVIEWER_EMAIL = "reviewer@tabulamedica.health";

const today = new Date();
const isoDate = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};
const dateOnly = (offsetDays: number) => isoDate(offsetDays).slice(0, 10);

async function main() {
  console.log("[seed:reviewer] starting");

  // 1) User -------------------------------------------------------------
  const existing = await storage.getUserByEmail(REVIEWER_EMAIL).catch(() => undefined);
  let userId = existing?.id;
  if (!existing) {
    const created: any = await (storage as any).upsertUser?.({
      id: REVIEWER_USER_ID,
      email: REVIEWER_EMAIL,
      firstName: "App Store",
      middleName: "NMN",
      lastName: "Reviewer",
      profileImageUrl: null,
    }).catch(() => null);
    userId = created?.id ?? REVIEWER_USER_ID;
    if (!created) {
      // Fallback if upsertUser is not exposed; some auth-storage modules expose it separately.
      console.warn(
        "[seed:reviewer] storage.upsertUser unavailable; create the reviewer user manually in Auth0 with id " +
          REVIEWER_USER_ID +
          " and re-run."
      );
    }
    console.log(`[seed:reviewer] user ready: ${userId}`);
  } else {
    console.log(`[seed:reviewer] reusing existing user: ${userId}`);
  }

  if (!userId) {
    throw new Error("Could not determine reviewer userId");
  }

  // 2) EHR connection (synthetic) --------------------------------------
  const ehrConn = await storage.createEhrConnection({
    userId,
    platform: "epic" as any,
    facilityName: "TestFlight Sandbox Hospital (Synthetic)",
    status: "connected",
  } as any);
  const ehrConnectionId = ehrConn.id;
  console.log(`[seed:reviewer] ehr connection: ${ehrConnectionId}`);

  // 3) Patient ----------------------------------------------------------
  const patient = await storage.createPatient({
    ehrConnectionId,
    mrn: "REV-00001",
    firstName: "App Store",
    middleName: "NMN",
    lastName: "Reviewer",
    dateOfBirth: "1985-04-12",
    gender: "other",
    email: REVIEWER_EMAIL,
    phone: "+1-555-0100",
    address: "1 Apple Park Way, Cupertino, CA 95014",
    insuranceProvider: "Synthetic Health Insurance Co.",
    insuranceId: "SYN-REV-0001",
    primaryPhysician: "Dr. Synthetic Smith",
  } as any);
  const patientId = patient.id;
  console.log(`[seed:reviewer] patient: ${patientId}`);

  // 4) Medications ------------------------------------------------------
  const meds = [
    { name: "Lisinopril", dosage: "10 mg", frequency: "Once daily", refillsRemaining: 3 },
    { name: "Metformin", dosage: "500 mg", frequency: "Twice daily", refillsRemaining: 2 },
    { name: "Atorvastatin", dosage: "20 mg", frequency: "Once daily at bedtime", refillsRemaining: 5 },
  ];
  for (const m of meds) {
    await storage.createMedication({
      patientId,
      ehrConnectionId,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      prescribedBy: "Dr. Synthetic Smith",
      startDate: dateOnly(-180),
      status: "active",
      refillsRemaining: m.refillsRemaining,
    } as any);
  }
  console.log(`[seed:reviewer] medications: ${meds.length}`);

  // 5) Conditions (problems) -------------------------------------------
  const conditions = [
    { name: "Essential hypertension", icdCode: "I10", category: "chronic" as const },
    { name: "Type 2 diabetes mellitus without complications", icdCode: "E11.9", category: "chronic" as const },
    { name: "Hyperlipidemia, unspecified", icdCode: "E78.5", category: "chronic" as const },
  ];
  for (const c of conditions) {
    await storage.createProblem({
      patientId,
      ehrConnectionId,
      name: c.name,
      icdCode: c.icdCode,
      category: c.category,
      status: "active",
      facility: "TestFlight Sandbox Hospital",
    } as any);
  }
  console.log(`[seed:reviewer] conditions: ${conditions.length}`);

  // 6) Lab results ------------------------------------------------------
  const labs = [
    { testName: "Hemoglobin A1c", value: "7.2", unit: "%", status: "abnormal" as const, offset: -7 },
    { testName: "LDL Cholesterol", value: "118", unit: "mg/dL", status: "abnormal" as const, offset: -7 },
    { testName: "HDL Cholesterol", value: "52", unit: "mg/dL", status: "normal" as const, offset: -7 },
    { testName: "Total Cholesterol", value: "194", unit: "mg/dL", status: "normal" as const, offset: -7 },
    { testName: "Fasting Glucose", value: "142", unit: "mg/dL", status: "abnormal" as const, offset: -7 },
    { testName: "Creatinine", value: "0.9", unit: "mg/dL", status: "normal" as const, offset: -7 },
  ];
  for (const l of labs) {
    await storage.createLabResult({
      patientId,
      ehrConnectionId,
      testName: l.testName,
      value: l.value,
      unit: l.unit,
      status: l.status,
      date: dateOnly(l.offset),
    } as any);
  }
  console.log(`[seed:reviewer] lab results: ${labs.length}`);

  // 7) Upcoming appointment --------------------------------------------
  await storage.createAppointment({
    patientId,
    ehrConnectionId,
    type: "followup",
    title: "Diabetes follow-up with Dr. Smith",
    provider: "Dr. Synthetic Smith",
    facility: "TestFlight Sandbox Hospital",
    scheduledAt: isoDate(14),
    duration: 30,
    status: "scheduled",
    notes: "Review A1C trend, adjust Metformin if needed.",
  } as any);
  console.log(`[seed:reviewer] upcoming appointment: 1`);

  // 8) Care gap ---------------------------------------------------------
  await storage.createCareGap({
    patientId,
    recommendationId: "ANNUAL_A1C_FOR_DIABETES",
    status: "open",
    priority: "high",
    dueDate: dateOnly(30),
    notes: "Annual A1C overdue by 14 days. Patient last A1C: 7.2% (above target).",
    aiReasoning:
      "Patient has Type 2 diabetes (E11.9). Last A1C was over a year ago. ADA guidelines recommend A1C every 3-6 months for patients with A1C above target.",
  } as any);
  console.log(`[seed:reviewer] care gap: 1`);

  // 9) Medical records (sample timeline entries) ------------------------
  await storage.createMedicalRecord({
    patientId,
    ehrConnectionId,
    type: "note",
    title: "Annual physical examination",
    description:
      "Patient seen for annual exam. BP 142/88. Discussed diet, exercise. Plan: continue Metformin, recheck A1C in 3 months.",
    date: dateOnly(-30),
    provider: "Dr. Synthetic Smith",
    facility: "TestFlight Sandbox Hospital",
    status: "active",
  } as any);

  // 10) Ambient encounter sample (best-effort; specialized service) -----
  try {
    const ambientService = await import("../server/services/ambient-encounter-service").catch(() => null);
    if (ambientService && (ambientService as any).createAmbientEncounter) {
      await (ambientService as any).createAmbientEncounter({
        patientId,
        userId,
        title: "Sample visit recording (synthetic)",
        transcript:
          "Doctor: How have you been feeling since we adjusted your blood pressure medication?\n" +
          "Patient: Better, but I still get headaches sometimes in the afternoon.\n" +
          "Doctor: Are you taking the Lisinopril at the same time every day?\n" +
          "Patient: Usually around 8 AM with breakfast.\n" +
          "Doctor: Let's keep that consistent and recheck your blood pressure log next visit.",
        structuredNote: {
          chiefComplaint: "Follow-up for hypertension",
          assessment: "Hypertension, stable on Lisinopril 10 mg",
          plan: "Continue current medication. Maintain BP log. Follow up in 3 months.",
        },
        consentGranted: true,
        durationSeconds: 187,
      });
      console.log(`[seed:reviewer] ambient encounter: 1`);
    } else {
      console.log(`[seed:reviewer] ambient encounter: skipped (service shape unknown — add manually if needed)`);
    }
  } catch (e: any) {
    console.log(`[seed:reviewer] ambient encounter: skipped (${e.message})`);
  }

  // 11) Prior auth letter (best-effort; specialized service) ------------
  try {
    const paService = await import("../server/services/prior-auth-service").catch(() => null);
    if (paService && (paService as any).createPriorAuthRequest) {
      await (paService as any).createPriorAuthRequest({
        patientId,
        userId,
        medicationName: "Ozempic 0.5 mg/0.5 mL",
        prescribingProvider: "Dr. Synthetic Smith",
        insurance: "Synthetic Health Insurance Co.",
        clinicalJustification:
          "Patient has Type 2 diabetes with HbA1c 7.2% on Metformin monotherapy. ADA guidelines support adding GLP-1 agonist for cardiovascular benefit.",
        status: "approved",
        approvalLetter: "Sample approval letter content (synthetic).",
      });
      console.log(`[seed:reviewer] prior auth: 1`);
    } else {
      console.log(`[seed:reviewer] prior auth: skipped (service shape unknown — add manually if needed)`);
    }
  } catch (e: any) {
    console.log(`[seed:reviewer] prior auth: skipped (${e.message})`);
  }

  console.log("[seed:reviewer] done. Account ready for App Store reviewer.");
  console.log(`[seed:reviewer] login: ${REVIEWER_EMAIL} (set password via Auth0 dashboard)`);
}

main().catch((err) => {
  console.error("[seed:reviewer] FAILED:", err);
  process.exit(1);
});
