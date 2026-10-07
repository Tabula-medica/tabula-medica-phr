/**
 * Seeds the single, shared, read-only "Try Demo" account that anyone can
 * sign into from the landing page without creating a real account.
 *
 * Off by default everywhere (including this repo's own dev config) — set
 * DEMO_ACCOUNT_ENABLED=1 in whichever environment should offer it. This
 * mirrors seed-admin.ts's SEED_ADMIN=1 gating: a boot can never silently
 * create or expose this account.
 *
 * Writes to two places, same split as scripts/seed-reviewer-account.ts:
 *   - the real Postgres `users` table (via authStorage), so
 *     GET /api/auth/user resolves a profile for the demo session, and
 *   - the in-memory `storage` (MemStorage), which is what every
 *     /api/patients/* route actually reads clinical data from. MemStorage
 *     resets on every restart, so this re-seeds idempotently on every boot
 *     rather than being a one-off script.
 *
 * All data below is SYNTHETIC. No real PHI.
 */
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { DEMO_USER_ID, DEMO_USER_EMAIL } from "@shared/demo-account";

const today = new Date();
const isoDate = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};
const dateOnly = (offsetDays: number) => isoDate(offsetDays).slice(0, 10);

export async function seedDemoAccount(): Promise<void> {
  if (process.env.DEMO_ACCOUNT_ENABLED !== "1") {
    return;
  }

  // Idempotent within one process lifetime — MemStorage itself resets on
  // every restart, so there's nothing to clean up across restarts, only
  // double-seeding within the same boot if this were ever called twice.
  const alreadySeeded = await storage.getUser(DEMO_USER_ID).catch(() => undefined);
  if (alreadySeeded) {
    console.log("[seed:demo] demo account already present, skipping");
    return;
  }

  console.log("[seed:demo] starting");

  // 1) Real Postgres user row, so /api/auth/user resolves a profile.
  await authStorage
    .upsertUser({
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      firstName: "Demo",
      lastName: "Account",
      authProvider: "demo",
      isVerified: true,
    } as any)
    .catch((err: any) => {
      console.error("[seed:demo] failed to upsert Postgres user row:", err?.message);
    });

  // 2) MemStorage user row — this is what storage.getUser()/getOnboardingStatus()
  // and most route handlers actually read for "the logged-in user".
  await storage.createUser({
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    firstName: "Demo",
    lastName: "Account",
    authProvider: "demo",
    emailVerified: true,
    status: "active",
  } as any);

  // 3) EHR connection (synthetic) ---------------------------------------
  const ehrConn = await storage.createEhrConnection({
    userId: DEMO_USER_ID,
    platform: "epic" as any,
    facilityName: "Tabula Medica Demo Hospital (Synthetic)",
    status: "connected",
  } as any);
  const ehrConnectionId = ehrConn.id;

  // 4) Patient ------------------------------------------------------------
  const patient = await storage.createPatient({
    ehrConnectionId,
    mrn: "DEMO-00001",
    firstName: "Demo",
    middleName: "NMN",
    lastName: "Account",
    dateOfBirth: "1985-04-12",
    gender: "other",
    email: DEMO_USER_EMAIL,
    phone: "+1-555-0100",
    address: "1 Demo Way, Sample City, CA 95014",
    insuranceProvider: "Synthetic Health Insurance Co.",
    insuranceId: "SYN-DEMO-0001",
    primaryPhysician: "Dr. Synthetic Smith",
  } as any);
  const patientId = patient.id;

  // 5) Medications ----------------------------------------------------------
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

  // 6) Conditions (problems) -------------------------------------------
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
      facility: "Tabula Medica Demo Hospital",
    } as any);
  }

  // 7) Lab results ------------------------------------------------------
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

  // 8) Vitals -------------------------------------------------------------
  const vitals = [
    { type: "blood_pressure" as const, value: "128/82", unit: "mmHg" },
    { type: "heart_rate" as const, value: "72", unit: "bpm" },
    { type: "weight" as const, value: "182", unit: "lb" },
  ];
  for (const v of vitals) {
    await storage.createVitalSign({
      patientId,
      ehrConnectionId,
      type: v.type,
      value: v.value,
      unit: v.unit,
      recordedAt: isoDate(-7),
      recordedBy: "Dr. Synthetic Smith",
    } as any);
  }

  // 9) Allergies ------------------------------------------------------------
  await storage.createAllergy({
    patientId,
    ehrConnectionId,
    name: "Penicillin",
    type: "medication",
    severity: "moderate",
    reaction: "Hives",
    status: "active",
  } as any);

  // 10) Immunizations -------------------------------------------------------
  await storage.createImmunization({
    patientId,
    ehrConnectionId,
    vaccineName: "Influenza, seasonal",
    administeredDate: dateOnly(-60),
    administeredBy: "Dr. Synthetic Smith",
  } as any);

  // 11) Upcoming appointment --------------------------------------------
  await storage.createAppointment({
    patientId,
    ehrConnectionId,
    type: "followup",
    title: "Diabetes follow-up with Dr. Smith",
    provider: "Dr. Synthetic Smith",
    facility: "Tabula Medica Demo Hospital",
    scheduledAt: isoDate(14),
    duration: 30,
    status: "scheduled",
    notes: "Review A1C trend, adjust Metformin if needed.",
  } as any);

  // 12) Care gap ---------------------------------------------------------
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

  // 13) Medical record (sample timeline entry) ------------------------
  await storage.createMedicalRecord({
    patientId,
    ehrConnectionId,
    type: "note",
    title: "Annual physical examination",
    description:
      "Patient seen for annual exam. BP 128/82. Discussed diet, exercise. Plan: continue Metformin, recheck A1C in 3 months.",
    date: dateOnly(-30),
    provider: "Dr. Synthetic Smith",
    facility: "Tabula Medica Demo Hospital",
    status: "active",
  } as any);

  console.log(`[seed:demo] done — demo account ready (userId=${DEMO_USER_ID})`);
}
