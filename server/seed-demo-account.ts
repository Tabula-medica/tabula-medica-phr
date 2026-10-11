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

  // 1a) GCIP account — ensure demo@tabulamedica.health exists in Firebase Auth
  // so the "Try demo →" button can sign in via GCIP. Uses the public REST API
  // (no Admin SDK / service account needed). The account was pre-created with
  // emailVerified=true via gcloud on 2026-10-11; this block is a safety net for
  // environments where it may not exist (e.g. a new Firebase project).
  const GCIP_API_KEY =
    process.env.GCIP_API_KEY ||
    process.env.VITE_GCIP_API_KEY ||
    "AIzaSyBCCtuVajEza6yHonlkz8XkVQJjIgAMS9o";
  const DEMO_PASSWORD = "Demo@2026";
  try {
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${GCIP_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: DEMO_USER_EMAIL, password: DEMO_PASSWORD, returnSecureToken: false }),
      }
    );
    const signUpData = await signUpRes.json() as any;
    if (!signUpRes.ok) {
      const code = signUpData?.error?.message ?? "";
      if (code.includes("EMAIL_EXISTS")) {
        console.log("[seed:demo] GCIP account already exists");
      } else {
        console.warn("[seed:demo] GCIP account creation skipped:", code);
      }
    } else {
      console.log("[seed:demo] GCIP account created (localId=%s)", signUpData.localId);
    }
  } catch (err: any) {
    console.warn("[seed:demo] GCIP REST call failed (non-fatal):", err?.message);
  }

  // 1b) Real Postgres user row, so /api/auth/user resolves a profile.
  await authStorage
    .upsertUser({
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      firstName: "Margaret",
      lastName: "Chen",
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
    firstName: "Margaret",
    lastName: "Chen",
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
    firstName: "Margaret",
    middleName: "L.",
    lastName: "Chen",
    dateOfBirth: "1958-03-14",
    gender: "female",
    email: DEMO_USER_EMAIL,
    phone: "+1-571-555-0142",
    address: "4821 Arlington Blvd, Arlington, VA 22203",
    insuranceProvider: "Medicare Part B",
    insuranceId: "1EG4-TE5-MK72",
    primaryPhysician: "Dr. Priya Nair, MD",
  } as any);
  const patientId = patient.id;

  // 5) Medications ----------------------------------------------------------
  const meds = [
    { name: "Lisinopril", dosage: "10 mg", frequency: "Once daily", refillsRemaining: 3 },
    { name: "Metformin", dosage: "500 mg", frequency: "Twice daily with meals", refillsRemaining: 2 },
    { name: "Atorvastatin", dosage: "40 mg", frequency: "Once daily at bedtime", refillsRemaining: 5 },
    { name: "Amlodipine", dosage: "5 mg", frequency: "Once daily", refillsRemaining: 4 },
    { name: "Levothyroxine", dosage: "50 mcg", frequency: "Once daily on empty stomach", refillsRemaining: 6 },
  ];
  for (const m of meds) {
    await storage.createMedication({
      patientId,
      ehrConnectionId,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      prescribedBy: "Dr. Priya Nair, MD",
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
    { name: "Hypothyroidism, unspecified", icdCode: "E03.9", category: "chronic" as const },
  ];
  for (const c of conditions) {
    await storage.createProblem({
      patientId,
      ehrConnectionId,
      name: c.name,
      icdCode: c.icdCode,
      category: c.category,
      status: "active",
      facility: "NoVA Primary Care Arlington",
    } as any);
  }

  // 7) Lab results ------------------------------------------------------
  const labs = [
    { testName: "Hemoglobin A1c", value: "7.8", unit: "%", status: "abnormal" as const, offset: -14 },
    { testName: "Fasting Glucose", value: "158", unit: "mg/dL", status: "abnormal" as const, offset: -14 },
    { testName: "LDL Cholesterol", value: "122", unit: "mg/dL", status: "abnormal" as const, offset: -14 },
    { testName: "HDL Cholesterol", value: "48", unit: "mg/dL", status: "normal" as const, offset: -14 },
    { testName: "Total Cholesterol", value: "201", unit: "mg/dL", status: "abnormal" as const, offset: -14 },
    { testName: "Creatinine", value: "1.1", unit: "mg/dL", status: "normal" as const, offset: -14 },
    { testName: "eGFR", value: "62", unit: "mL/min/1.73m²", status: "normal" as const, offset: -14 },
    { testName: "TSH", value: "3.2", unit: "mIU/L", status: "normal" as const, offset: -14 },
    { testName: "Potassium", value: "4.1", unit: "mEq/L", status: "normal" as const, offset: -14 },
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
    { type: "blood_pressure" as const, value: "136/86", unit: "mmHg" },
    { type: "heart_rate" as const, value: "74", unit: "bpm" },
    { type: "weight" as const, value: "167", unit: "lb" },
    { type: "height" as const, value: "64", unit: "in" },
  ];
  for (const v of vitals) {
    await storage.createVitalSign({
      patientId,
      ehrConnectionId,
      type: v.type,
      value: v.value,
      unit: v.unit,
      recordedAt: isoDate(-7),
      recordedBy: "Dr. Priya Nair, MD",
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

  await storage.createAllergy({
    patientId,
    ehrConnectionId,
    name: "Sulfa drugs",
    type: "medication",
    severity: "mild",
    reaction: "Rash",
    status: "active",
  } as any);

  // 10) Immunizations -------------------------------------------------------
  await storage.createImmunization({
    patientId,
    ehrConnectionId,
    vaccineName: "COVID-19 (mRNA)",
    administeredDate: dateOnly(-120),
    administeredBy: "Dr. Priya Nair, MD",
  } as any);

  await storage.createImmunization({
    patientId,
    ehrConnectionId,
    vaccineName: "Influenza, seasonal (quadrivalent)",
    administeredDate: dateOnly(-60),
    administeredBy: "Dr. Priya Nair, MD",
  } as any);

  await storage.createImmunization({
    patientId,
    ehrConnectionId,
    vaccineName: "Shingrix (Zoster) dose 1",
    administeredDate: dateOnly(-180),
    administeredBy: "CVS Pharmacy",
  } as any);

  await storage.createImmunization({
    patientId,
    ehrConnectionId,
    vaccineName: "Pneumococcal (PPSV23)",
    administeredDate: dateOnly(-365),
    administeredBy: "Dr. Priya Nair, MD",
  } as any);

  // 11) Upcoming appointments --------------------------------------------
  await storage.createAppointment({
    patientId,
    ehrConnectionId,
    type: "followup",
    title: "Diabetes management followup",
    provider: "Dr. Priya Nair, MD",
    facility: "NoVA Primary Care Arlington",
    scheduledAt: isoDate(10),
    duration: 30,
    status: "scheduled",
    notes: "Review A1C trend (7.8%). Adjust Metformin dose if indicated.",
  } as any);

  await storage.createAppointment({
    patientId,
    ehrConnectionId,
    type: "wellness",
    title: "Annual wellness visit (Medicare)",
    provider: "Dr. Priya Nair, MD",
    facility: "NoVA Primary Care Arlington",
    scheduledAt: isoDate(21),
    duration: 45,
    status: "scheduled",
    notes: "Annual Medicare wellness visit. Review preventive screening status.",
  } as any);

  await storage.createAppointment({
    patientId,
    ehrConnectionId,
    type: "referral",
    title: "Endocrinology referral — Dr. Patel",
    provider: "Dr. Arun Patel, MD",
    facility: "Inova Endocrinology Associates",
    scheduledAt: isoDate(45),
    duration: 60,
    status: "scheduled",
    notes: "Referred for GLP-1 therapy evaluation.",
  } as any);

  // 12) Care gaps ---------------------------------------------------------
  await storage.createCareGap({
    patientId,
    recommendationId: "ANNUAL_A1C_FOR_DIABETES",
    status: "open",
    priority: "high",
    dueDate: dateOnly(0),
    notes: "A1C 7.8% — above target of 7.0%.",
    aiReasoning:
      "Patient has Type 2 diabetes (E11.9). Last A1C was over a year ago. ADA guidelines recommend A1C every 3-6 months for patients with A1C above target.",
  } as any);

  await storage.createCareGap({
    patientId,
    recommendationId: "COLORECTAL_CANCER_SCREENING",
    status: "open",
    priority: "high",
    dueDate: dateOnly(-30),
    notes: "Colorectal cancer screening overdue. Patient is 68, no prior colonoscopy on record.",
    aiReasoning:
      "USPSTF recommends colorectal cancer screening for adults aged 45-75. Patient is 68 with no documented prior colonoscopy.",
  } as any);

  await storage.createCareGap({
    patientId,
    recommendationId: "STATIN_THERAPY_FOR_CVD_RISK",
    status: "open",
    priority: "medium",
    dueDate: dateOnly(30),
    notes: "LDL 122 mg/dL — consider uptitration. Goal <100 mg/dL for high-risk patients.",
    aiReasoning:
      "Patient has diabetes and hypertension with LDL above goal. ACC/AHA guidelines recommend high-intensity statin for high-risk patients.",
  } as any);

  // 13) Medical records (sample timeline entries) ------------------------
  await storage.createMedicalRecord({
    patientId,
    ehrConnectionId,
    type: "note",
    title: "Quarterly diabetes management visit",
    description:
      "Patient seen for diabetes follow-up. A1C 7.8%, up from 7.4% last quarter. BP 136/86. Metformin dose unchanged. Referral placed for endocrinology/GLP-1 evaluation.",
    date: dateOnly(-30),
    provider: "Dr. Priya Nair, MD",
    facility: "NoVA Primary Care Arlington",
    status: "active",
  } as any);

  await storage.createMedicalRecord({
    patientId,
    ehrConnectionId,
    type: "note",
    title: "Telehealth visit — hypertension review",
    description:
      "BP reviewed via telehealth. Patient reports consistent Amlodipine adherence. BP log average 138/88. Plan: continue current regimen, recheck in 4 weeks.",
    date: dateOnly(-60),
    provider: "Dr. Priya Nair, MD",
    facility: "NoVA Primary Care (Telehealth)",
    status: "active",
  } as any);

  await storage.createMedicalRecord({
    patientId,
    ehrConnectionId,
    type: "note",
    title: "Annual Medicare Wellness Visit (prior year)",
    description:
      "Annual Medicare wellness visit completed. Preventive screenings reviewed. Mammogram up to date. Colorectal cancer screening deferred — patient declined colonoscopy, FIT test ordered.",
    date: dateOnly(-365),
    provider: "Dr. Priya Nair, MD",
    facility: "NoVA Primary Care Arlington",
    status: "active",
  } as any);

  await storage.createMedicalRecord({
    patientId,
    ehrConnectionId,
    type: "note",
    title: "Thyroid management visit",
    description:
      "TSH 3.2 mIU/L — within normal range. Levothyroxine 50 mcg continued. Patient reports improved energy levels. No dose adjustment required.",
    date: dateOnly(-90),
    provider: "Dr. Priya Nair, MD",
    facility: "NoVA Primary Care Arlington",
    status: "active",
  } as any);

  console.log(`[seed:demo] done — demo account ready (userId=${DEMO_USER_ID})`);
}
