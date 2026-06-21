import crypto from "crypto";
import { generateText, getProviderForFeature } from "./ai-provider";
import { sanitizePatientForSummary } from "./pii-sanitizer";

const NO_CDS_DISCLAIMER =
  "This summary is for informational purposes only. It does NOT constitute medical advice or a clinical decision. Always consult your healthcare provider before making any changes to your care.";

const PATIENT_SUMMARY_SYSTEM_PROMPT = `You are a compassionate, knowledgeable health literacy assistant embedded in a patient portal. Your role is to help patients understand their own health profile by generating clear, encouraging, and medically grounded wellness insights.

READING LEVEL & TONE:
- Write at a 6th-grade reading level (Flesch-Kincaid grade ≤ 6).
- Use short sentences (under 20 words when possible).
- Replace medical jargon with everyday words. For example: "hypertension" → "high blood pressure", "HbA1c" → "blood sugar average over 3 months", "dyslipidemia" → "cholesterol levels that need attention".
- Be warm, supportive, and motivating — like a friendly nurse explaining things at a checkup.
- Use "you/your" to speak directly to the patient.

MEDICAL ACCURACY RULES:
- Ground every insight in the data provided. Never invent conditions, lab values, or medications that are not in the input.
- When a lab value is flagged as abnormal or critical, acknowledge it honestly but calmly. Example: "Your kidney number (creatinine) is a little higher than the usual range. This is worth talking about with your doctor."
- When conditions are listed, briefly explain what each one means in plain language, and connect insights to those conditions where appropriate.
- Accurately reflect medication counts and allergy counts without naming specific drugs (because drug names were not provided — only counts).

SAFETY & COMPLIANCE (NO-CDS):
- NEVER recommend starting, stopping, or changing any medication or dose.
- NEVER diagnose or suggest a specific diagnosis.
- NEVER provide treatment plans, drug interactions, or clinical decision guidance.
- Always frame actionable items as questions to bring up with a provider: "Ask your doctor about…", "At your next visit, you might ask…".
- Do NOT include patient names, Social Security numbers, dates of birth, or addresses in your output.

OUTPUT FORMAT:
Return a JSON object with a single key "insights" containing an array of 3–5 insight objects. Each object must have exactly these fields:
{
  "category": one of "wellness" | "medication" | "prevention" | "lifestyle",
  "title": a short headline (5 words or fewer),
  "description": 2–3 plain-language sentences (max 50 words total) that explain the insight and suggest a next step the patient can take,
  "priority": one of "info" | "attention" | "important"
}

PRIORITY GUIDANCE:
- "important": Use when a lab is flagged critical, or the patient has 3+ active conditions, or there are critical flags in the input.
- "attention": Use when a lab is flagged abnormal (but not critical), or there is a notable pattern (e.g., multiple related conditions).
- "info": Use for general wellness encouragement, prevention reminders, and lifestyle suggestions.

Always include at least one "lifestyle" or "prevention" insight to keep the tone balanced and forward-looking.`;


function hashId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 12);
}

function auditLog(action: string, userId: string, patientId: string, detail: string) {
  console.log(
    `[HIPAA-AUDIT][PatientFriendlySummary] ${action} User:${hashId(userId)} Patient:${hashId(patientId)} — ${detail}`
  );
}

interface LabEntry {
  name: string;
  value: string;
  date: string;
  status?: string;
}

interface VitalEntry {
  type: string;
  value: string;
  date: string;
}

interface ProviderEntry {
  name: string;
  role: string;
  specialty?: string;
}

interface SamplePatient {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentLabs: LabEntry[];
  vitalSigns?: VitalEntry[];
  providers: ProviderEntry[];
  insuranceInfo: string;
  socialHistory?: string;
  familyHistory?: string;
}

const SAMPLE_PATIENTS: Record<string, SamplePatient> = {
  "PT-2001": {
    patientId: "PT-2001",
    patientName: "Jane Doe",
    dateOfBirth: "1958-03-14",
    conditions: ["Hypertension", "Type 2 Diabetes", "Hyperlipidemia"],
    medications: ["Metformin 1000mg BID", "Lisinopril 20mg daily", "Atorvastatin 40mg daily", "Aspirin 81mg daily"],
    allergies: ["Penicillin (rash)", "Sulfa drugs (anaphylaxis)"],
    recentLabs: [
      { name: "HbA1c", value: "8.2%", date: "2026-02-01", status: "elevated" },
      { name: "LDL", value: "142 mg/dL", date: "2026-02-01", status: "elevated" },
      { name: "Creatinine", value: "1.1 mg/dL", date: "2026-02-01", status: "normal" },
      { name: "BNP", value: "450 pg/mL", date: "2026-02-15", status: "elevated" },
    ],
    vitalSigns: [
      { type: "Blood Pressure", value: "148/92 mmHg", date: "2026-02-20" },
      { type: "Heart Rate", value: "88 bpm", date: "2026-02-20" },
    ],
    providers: [{ name: "Dr. Emily Chen", role: "Primary Care Physician", specialty: "Internal Medicine" }],
    insuranceInfo: "Blue Cross Blue Shield PPO",
    socialHistory: "Non-smoker, occasional alcohol, retired teacher, lives with spouse",
    familyHistory: "Father: MI at age 52; Mother: Type 2 DM, stroke at age 68",
  },
  "PT-2002": {
    patientId: "PT-2002",
    patientName: "Robert Wilson",
    dateOfBirth: "1965-07-22",
    conditions: ["Type 2 Diabetes", "Obesity (BMI 34)", "Peripheral Neuropathy"],
    medications: ["Metformin 500mg BID", "Gabapentin 300mg TID", "Vitamin B12 1000mcg daily"],
    allergies: ["No known drug allergies"],
    recentLabs: [
      { name: "HbA1c", value: "9.2%", date: "2026-01-15", status: "critical" },
      { name: "Fasting Glucose", value: "210 mg/dL", date: "2026-02-10", status: "elevated" },
      { name: "eGFR", value: "65 mL/min", date: "2026-02-10", status: "low" },
    ],
    providers: [{ name: "Dr. Sarah Adams", role: "Primary Care Physician" }],
    insuranceInfo: "Aetna HMO",
    vitalSigns: [],
  },
  "PT-2003": {
    patientId: "PT-2003",
    patientName: "Mary Johnson",
    dateOfBirth: "1972-11-05",
    conditions: ["Pneumonia (community-acquired)", "Asthma", "GERD"],
    medications: ["Azithromycin 500mg daily", "Albuterol inhaler PRN", "Omeprazole 20mg daily", "Prednisone 40mg taper"],
    allergies: ["Codeine (nausea)"],
    recentLabs: [
      { name: "WBC", value: "14.2 K/uL", date: "2026-02-15", status: "elevated" },
      { name: "Procalcitonin", value: "0.8 ng/mL", date: "2026-02-15", status: "elevated" },
    ],
    vitalSigns: [
      { type: "Temperature", value: "99.1°F", date: "2026-02-20" },
      { type: "O2 Saturation", value: "96%", date: "2026-02-20" },
    ],
    providers: [{ name: "Dr. James Park", role: "Hospitalist" }],
    insuranceInfo: "UnitedHealthcare",
  },
  "PT-2004": {
    patientId: "PT-2004",
    patientName: "David Chen",
    dateOfBirth: "1980-09-18",
    conditions: ["Hypertension", "Anxiety"],
    medications: ["Amlodipine 5mg daily", "Sertraline 50mg daily"],
    allergies: ["No known drug allergies"],
    recentLabs: [
      { name: "Troponin I", value: "0.8 ng/mL", date: "2026-02-20", status: "critical" },
      { name: "CK-MB", value: "28 U/L", date: "2026-02-20", status: "elevated" },
    ],
    providers: [{ name: "Dr. Lisa Wong", role: "Emergency Physician" }],
    insuranceInfo: "Cigna PPO",
    vitalSigns: [],
  },
  "PT-2005": {
    patientId: "PT-2005",
    patientName: "Sarah Miller",
    dateOfBirth: "1990-04-30",
    conditions: ["Type 2 Diabetes (newly diagnosed)", "Obesity (BMI 32)"],
    medications: [],
    allergies: ["Latex (contact dermatitis)"],
    recentLabs: [
      { name: "HbA1c", value: "7.8%", date: "2026-02-18", status: "elevated" },
      { name: "Fasting Glucose", value: "162 mg/dL", date: "2026-02-18", status: "elevated" },
    ],
    providers: [{ name: "Dr. Adams", role: "Primary Care Physician" }],
    insuranceInfo: "Anthem Blue Cross",
    vitalSigns: [],
  },
  "PT-2006": {
    patientId: "PT-2006",
    patientName: "John Smith",
    dateOfBirth: "1975-01-12",
    conditions: ["Chronic Migraines", "Tension Headaches", "Insomnia"],
    medications: ["Sumatriptan 100mg PRN", "Topiramate 50mg BID", "Melatonin 3mg HS"],
    allergies: ["NSAIDs (GI bleeding)"],
    recentLabs: [
      { name: "TSH", value: "2.4 mIU/L", date: "2026-01-20", status: "normal" },
      { name: "CBC", value: "WNL", date: "2026-01-20", status: "normal" },
    ],
    providers: [{ name: "Dr. Rachel Martinez", role: "Primary Care Physician" }],
    insuranceInfo: "Humana PPO",
    vitalSigns: [],
  },
  "PT-2008": {
    patientId: "PT-2008",
    patientName: "Michael Taylor",
    dateOfBirth: "1960-06-25",
    conditions: ["Hypertension (uncontrolled)", "Type 2 Diabetes", "CKD Stage 3"],
    medications: ["Losartan 100mg daily", "Amlodipine 10mg daily", "Metformin 1000mg BID", "Furosemide 20mg daily"],
    allergies: ["ACE inhibitors (angioedema)"],
    recentLabs: [
      { name: "Creatinine", value: "1.8 mg/dL", date: "2026-02-18", status: "elevated" },
      { name: "Potassium", value: "5.1 mEq/L", date: "2026-02-18", status: "elevated" },
    ],
    vitalSigns: [{ type: "Blood Pressure", value: "180/110 mmHg", date: "2026-02-20" }],
    providers: [{ name: "Dr. Thomas Brown", role: "Primary Care Physician" }],
    insuranceInfo: "Medicare Part B",
  },
};

const SAMPLE_APPOINTMENTS: Record<string, Array<{ date: string; type: string; provider: string; notes?: string }>> = {
  "PT-2001": [
    { date: "2026-03-05", type: "Follow-up", provider: "Dr. Emily Chen", notes: "Diabetes and blood pressure review" },
    { date: "2026-03-20", type: "Lab Work", provider: "Quest Diagnostics", notes: "HbA1c, lipid panel, renal function" },
  ],
  "PT-2002": [
    { date: "2026-03-01", type: "Follow-up", provider: "Dr. Sarah Adams", notes: "Diabetes management review" },
    { date: "2026-03-15", type: "Specialist Visit", provider: "Endocrinology", notes: "Insulin therapy evaluation" },
  ],
  "PT-2003": [
    { date: "2026-03-01", type: "Follow-up", provider: "Dr. James Park", notes: "Pneumonia recovery check" },
  ],
  "PT-2004": [
    { date: "2026-03-10", type: "Cardiology Consult", provider: "Cardiology", notes: "Cardiac workup follow-up" },
  ],
  "PT-2005": [
    { date: "2026-03-08", type: "Follow-up", provider: "Dr. Adams", notes: "Diabetes education and treatment plan" },
    { date: "2026-04-01", type: "Lab Work", provider: "Lab", notes: "Repeat HbA1c in 6 weeks" },
  ],
  "PT-2006": [
    { date: "2026-03-12", type: "Neurology Consult", provider: "Neurology", notes: "Migraine management review" },
  ],
  "PT-2008": [
    { date: "2026-02-28", type: "Urgent Follow-up", provider: "Dr. Thomas Brown", notes: "Blood pressure and kidney function review" },
    { date: "2026-03-15", type: "Nephrology Consult", provider: "Nephrology", notes: "CKD Stage 3 evaluation" },
  ],
};

export interface ConditionSummary {
  name: string;
  plainLanguage: string;
  status: "active" | "monitoring" | "resolving";
}

export interface MedicationSummary {
  name: string;
  purpose: string;
  schedule: string;
}

export interface LabSummary {
  name: string;
  value: string;
  date: string;
  status: "normal" | "attention" | "critical";
  plainExplanation: string;
}

export interface VitalSummary {
  type: string;
  value: string;
  date: string;
  status: "normal" | "attention" | "critical";
  plainExplanation: string;
}

export interface AppointmentSummary {
  date: string;
  type: string;
  provider: string;
  purpose: string;
  daysUntil: number;
}

export interface AIInsight {
  category: "wellness" | "medication" | "prevention" | "lifestyle";
  title: string;
  description: string;
  priority: "info" | "attention" | "important";
}

export interface PatientFriendlySummary {
  patientId: string;
  firstName: string;
  generatedAt: string;
  overallStatus: "good" | "needs-attention" | "urgent";
  overallMessage: string;
  conditions: ConditionSummary[];
  medications: MedicationSummary[];
  recentLabs: LabSummary[];
  vitals: VitalSummary[];
  upcomingAppointments: AppointmentSummary[];
  aiInsights: AIInsight[];
  allergies: string[];
  disclaimer: string;
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0];
}

function conditionToPlainLanguage(condition: string): string {
  const map: Record<string, string> = {
    "hypertension": "Your blood pressure has been higher than normal and is being managed",
    "hypertension (uncontrolled)": "Your blood pressure is higher than the target range and needs closer attention",
    "type 2 diabetes": "Your body has difficulty regulating blood sugar levels",
    "type 2 diabetes (newly diagnosed)": "You were recently found to have difficulty regulating blood sugar levels",
    "hyperlipidemia": "Your cholesterol levels are higher than recommended",
    "obesity (bmi 34)": "Your weight is above the healthy range, which can affect other health areas",
    "obesity (bmi 32)": "Your weight is above the healthy range, which can affect other health areas",
    "peripheral neuropathy": "Nerve damage is causing tingling or numbness, often in the hands or feet",
    "pneumonia (community-acquired)": "You have a lung infection that is being treated with antibiotics",
    "asthma": "A condition where your airways can become narrow and inflamed, sometimes causing breathing difficulty",
    "gerd": "Stomach acid sometimes flows back into your throat, which can cause heartburn",
    "anxiety": "A condition involving excessive worry that is being managed with medication",
    "chronic migraines": "You experience recurring severe headaches that are being managed",
    "tension headaches": "Recurring headaches related to muscle tension or stress",
    "insomnia": "Difficulty falling or staying asleep",
    "ckd stage 3": "Your kidneys are not filtering as well as they should and need monitoring",
  };
  return map[condition.toLowerCase()] || `A health condition that your care team is monitoring`;
}

function conditionStatus(condition: string): "active" | "monitoring" | "resolving" {
  const lower = condition.toLowerCase();
  if (lower.includes("uncontrolled") || lower.includes("newly diagnosed")) return "active";
  if (lower.includes("pneumonia")) return "resolving";
  return "monitoring";
}

function labToPlainLanguage(lab: LabEntry): string {
  const name = lab.name.toLowerCase();
  const status = lab.status || "normal";

  if (name.includes("hba1c")) {
    if (status === "critical") return "This measures your average blood sugar over 3 months. Your level is significantly above the target range.";
    if (status === "elevated") return "This measures your average blood sugar over 3 months. Your level is above the target range.";
    return "This measures your average blood sugar over 3 months. Your level is within an acceptable range.";
  }
  if (name.includes("ldl")) {
    if (status === "elevated") return "This is your 'bad' cholesterol. It is higher than recommended.";
    return "This is your 'bad' cholesterol level.";
  }
  if (name.includes("creatinine")) {
    if (status === "elevated") return "This measures how well your kidneys are working. Your level is higher than normal.";
    return "This measures how well your kidneys are working. Your level is normal.";
  }
  if (name.includes("bnp")) {
    if (status === "elevated") return "This measures heart strain. An elevated level may indicate your heart is working harder than usual.";
    return "This measures heart strain.";
  }
  if (name.includes("glucose") || name.includes("fasting glucose")) {
    if (status === "elevated") return "This is your blood sugar when you haven't eaten. It is higher than the normal range.";
    return "This is your blood sugar when you haven't eaten.";
  }
  if (name.includes("egfr")) {
    if (status === "low") return "This estimates how well your kidneys are filtering. A lower number means reduced kidney function.";
    return "This estimates how well your kidneys are filtering.";
  }
  if (name.includes("wbc")) {
    if (status === "elevated") return "This counts white blood cells that fight infection. A higher count may indicate your body is fighting an infection.";
    return "This counts your infection-fighting white blood cells.";
  }
  if (name.includes("procalcitonin")) {
    if (status === "elevated") return "This helps detect bacterial infections. An elevated level supports the diagnosis of a bacterial infection.";
    return "This helps detect bacterial infections.";
  }
  if (name.includes("troponin")) {
    if (status === "critical") return "This measures a protein released when the heart muscle is stressed or damaged. Your level needs urgent evaluation.";
    return "This measures a protein related to heart muscle health.";
  }
  if (name.includes("ck-mb") || name.includes("ckmb")) {
    if (status === "elevated") return "This enzyme is released when heart muscle is stressed. Your level is above normal.";
    return "This enzyme relates to heart muscle health.";
  }
  if (name.includes("potassium")) {
    if (status === "elevated") return "This mineral is important for heart and muscle function. Your level is slightly above normal.";
    return "This mineral is important for heart and muscle function.";
  }
  if (name.includes("tsh")) {
    return "This measures your thyroid function. Your level is normal.";
  }
  if (name.includes("cbc")) {
    return "A complete blood count that checks your overall blood health.";
  }

  if (status === "critical") return `This test result needs prompt attention from your care team.`;
  if (status === "elevated" || status === "low") return `This result is outside the normal range and is being monitored.`;
  return "This result is within the normal range.";
}

function labStatusToSummary(status?: string): "normal" | "attention" | "critical" {
  if (status === "critical") return "critical";
  if (status === "elevated" || status === "low") return "attention";
  return "normal";
}

function vitalToPlainLanguage(vital: VitalEntry): { status: "normal" | "attention" | "critical"; explanation: string } {
  const t = vital.type.toLowerCase();
  if (t.includes("blood pressure")) {
    const match = vital.value.match(/(\d+)\/(\d+)/);
    if (match) {
      const sys = parseInt(match[1]);
      if (sys >= 180) return { status: "critical", explanation: "Your blood pressure is very high and needs prompt attention." };
      if (sys >= 140) return { status: "attention", explanation: "Your blood pressure is above the recommended range." };
    }
    return { status: "normal", explanation: "Your blood pressure is within a reasonable range." };
  }
  if (t.includes("heart rate")) {
    return { status: "normal", explanation: "Your heart rate is within a normal range." };
  }
  if (t.includes("temperature")) {
    const val = parseFloat(vital.value);
    if (val > 100.4) return { status: "attention", explanation: "You have a fever, which may indicate an infection." };
    if (val > 99.0) return { status: "attention", explanation: "Your temperature is slightly elevated." };
    return { status: "normal", explanation: "Your temperature is normal." };
  }
  if (t.includes("o2") || t.includes("oxygen") || t.includes("saturation")) {
    const val = parseFloat(vital.value);
    if (val < 92) return { status: "critical", explanation: "Your oxygen level is low and needs attention." };
    if (val < 95) return { status: "attention", explanation: "Your oxygen level is slightly below normal." };
    return { status: "normal", explanation: "Your oxygen level is normal." };
  }
  return { status: "normal", explanation: "This measurement is within an expected range." };
}

function medicationToPurpose(medString: string, conditions: string[]): { name: string; purpose: string; schedule: string } {
  const parts = medString.split(/\s+/);
  const medName = parts[0];
  const schedule = parts.slice(1).join(" ");

  const purposeMap: Record<string, string> = {
    metformin: "Helps your body manage blood sugar levels",
    lisinopril: "Helps lower blood pressure and protect your heart",
    atorvastatin: "Helps lower cholesterol to reduce heart disease risk",
    aspirin: "Helps prevent blood clots",
    gabapentin: "Helps manage nerve pain and tingling",
    azithromycin: "An antibiotic to fight your lung infection",
    albuterol: "Opens your airways when you have breathing difficulty",
    omeprazole: "Reduces stomach acid to help with heartburn",
    prednisone: "Reduces inflammation to help with your recovery",
    amlodipine: "Helps lower blood pressure",
    sertraline: "Helps manage anxiety and improve mood",
    sumatriptan: "Provides relief during migraine attacks",
    topiramate: "Helps prevent migraines from occurring",
    melatonin: "Supports your natural sleep cycle",
    losartan: "Helps lower blood pressure and protect your kidneys",
    furosemide: "Removes extra fluid to reduce swelling and lower blood pressure",
    "vitamin": "Supports nerve health and overall wellness",
  };

  const lower = medName.toLowerCase();
  let purpose = "Prescribed by your care team for your health management";
  for (const [key, desc] of Object.entries(purposeMap)) {
    if (lower.includes(key)) {
      purpose = desc;
      break;
    }
  }

  const friendlySchedule = schedule
    .replace("BID", "twice daily")
    .replace("TID", "three times daily")
    .replace("PRN", "as needed")
    .replace("HS", "at bedtime")
    .replace("daily", "once daily");

  return { name: medString, purpose, schedule: friendlySchedule || "As directed" };
}

function computeOverallStatus(patient: SamplePatient): { status: "good" | "needs-attention" | "urgent"; message: string } {
  const criticalLabs = patient.recentLabs.filter((l) => l.status === "critical");
  const elevatedLabs = patient.recentLabs.filter((l) => l.status === "elevated" || l.status === "low");
  const uncontrolled = patient.conditions.some((c) => c.toLowerCase().includes("uncontrolled"));

  if (criticalLabs.length > 0) {
    return {
      status: "urgent",
      message: `You have ${criticalLabs.length} test result${criticalLabs.length > 1 ? "s" : ""} that need${criticalLabs.length === 1 ? "s" : ""} prompt attention. Please follow up with your care team as recommended.`,
    };
  }
  if (uncontrolled || elevatedLabs.length >= 2) {
    return {
      status: "needs-attention",
      message: "Some of your health numbers are outside the target range. Your care team is working with you to improve them.",
    };
  }
  if (elevatedLabs.length === 1) {
    return {
      status: "needs-attention",
      message: "Most of your health numbers look good, with one area that your care team is keeping an eye on.",
    };
  }
  return {
    status: "good",
    message: "Your recent results are looking stable. Keep up with your current care plan and upcoming appointments.",
  };
}

function generateFallbackInsights(patient: SamplePatient): AIInsight[] {
  const insights: AIInsight[] = [];
  const conditions = patient.conditions.map((c) => c.toLowerCase());

  if (conditions.some((c) => c.includes("diabetes"))) {
    insights.push({
      category: "wellness",
      title: "Blood Sugar Management",
      description: "Regular meals, staying active, and taking your medications consistently can help keep your blood sugar levels closer to the target range.",
      priority: "attention",
    });
  }

  if (conditions.some((c) => c.includes("hypertension"))) {
    insights.push({
      category: "lifestyle",
      title: "Heart-Healthy Habits",
      description: "Reducing salt intake, staying physically active, and managing stress can support better blood pressure control alongside your medications.",
      priority: "attention",
    });
  }

  if (patient.medications.length >= 3) {
    insights.push({
      category: "medication",
      title: "Medication Routine",
      description: "You take several medications. Consider using a pill organizer or setting daily reminders to help stay on track.",
      priority: "info",
    });
  }

  if (conditions.some((c) => c.includes("ckd") || c.includes("kidney"))) {
    insights.push({
      category: "prevention",
      title: "Kidney Health",
      description: "Staying hydrated, limiting salt, and keeping blood pressure and blood sugar in range all help protect your kidney function.",
      priority: "important",
    });
  }

  if (conditions.some((c) => c.includes("obesity"))) {
    insights.push({
      category: "lifestyle",
      title: "Weight Management",
      description: "Even modest weight loss can improve blood sugar, blood pressure, and overall well-being. Small, sustainable changes work best.",
      priority: "info",
    });
  }

  if (conditions.some((c) => c.includes("migraine"))) {
    insights.push({
      category: "wellness",
      title: "Migraine Tracking",
      description: "Keeping a headache diary noting triggers, frequency, and severity can help your care team fine-tune your treatment plan.",
      priority: "info",
    });
  }

  if (conditions.some((c) => c.includes("pneumonia"))) {
    insights.push({
      category: "prevention",
      title: "Recovery Support",
      description: "Get plenty of rest, stay hydrated, and finish your full course of antibiotics even if you feel better sooner.",
      priority: "attention",
    });
  }

  if (patient.allergies.some((a) => !a.toLowerCase().includes("no known"))) {
    insights.push({
      category: "medication",
      title: "Allergy Awareness",
      description: "You have known medication allergies. Always remind any new healthcare provider about your allergies before starting new treatments.",
      priority: "info",
    });
  }

  insights.push({
    category: "prevention",
    title: "Preventive Care",
    description: "Stay up to date with recommended screenings and vaccinations. Ask your provider about what's due at your next visit.",
    priority: "info",
  });

  return insights.slice(0, 5);
}

async function generateAIInsights(patient: SamplePatient): Promise<AIInsight[]> {
  try {
    const { sanitized, audit } = sanitizePatientForSummary(patient);

    if (audit.piiDetected.length > 0) {
      auditLog("PII_STRIPPED", "system", patient.patientId, `PII fields removed before AI call: ${audit.piiDetected.join(", ")}`);
    }

    const provider = getProviderForFeature("patient-summary");
    console.log(`[PatientFriendlySummary] Using AI provider: ${provider}, sanitization hash: ${audit.auditHash}`);

    const content = await generateText({
      systemPrompt: PATIENT_SUMMARY_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(sanitized),
      temperature: 0.6,
      maxTokens: 1200,
      responseFormat: "json",
    }, "patient-summary");

    if (content) {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const insights = Array.isArray(parsed) ? parsed : parsed.insights;
      if (Array.isArray(insights)) return insights.slice(0, 5);
    }
  } catch (err) {
    console.log("[PatientFriendlySummary] AI insights fallback:", (err as Error).message);
  }

  return generateFallbackInsights(patient);
}

export function listAvailablePatients(): Array<{ id: string; firstName: string; conditionCount: number }> {
  return Object.values(SAMPLE_PATIENTS).map((p) => ({
    id: p.patientId,
    firstName: getFirstName(p.patientName),
    conditionCount: p.conditions.length,
  }));
}

export async function generatePatientFriendlySummary(
  patientId: string,
  userId: string
): Promise<PatientFriendlySummary | null> {
  const patient = SAMPLE_PATIENTS[patientId];
  if (!patient) return null;

  auditLog("GENERATE_FRIENDLY_SUMMARY", userId, patientId, "Summary requested");

  const { status, message } = computeOverallStatus(patient);

  const conditions: ConditionSummary[] = patient.conditions.map((c) => ({
    name: c,
    plainLanguage: conditionToPlainLanguage(c),
    status: conditionStatus(c),
  }));

  const medications: MedicationSummary[] = patient.medications.map((m) =>
    medicationToPurpose(m, patient.conditions)
  );

  const recentLabs: LabSummary[] = patient.recentLabs.map((l) => ({
    name: l.name,
    value: l.value,
    date: l.date,
    status: labStatusToSummary(l.status),
    plainExplanation: labToPlainLanguage(l),
  }));

  const vitals: VitalSummary[] = (patient.vitalSigns || []).map((v) => {
    const { status: vStatus, explanation } = vitalToPlainLanguage(v);
    return { type: v.type, value: v.value, date: v.date, status: vStatus, plainExplanation: explanation };
  });

  const now = new Date();
  const appointments = (SAMPLE_APPOINTMENTS[patientId] || []).map((a) => {
    const apptDate = new Date(a.date);
    const daysUntil = Math.max(0, Math.ceil((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      date: a.date,
      type: a.type,
      provider: a.provider,
      purpose: a.notes || a.type,
      daysUntil,
    };
  }).sort((a, b) => a.daysUntil - b.daysUntil);

  const aiInsights = await generateAIInsights(patient);

  const allergies = patient.allergies.filter((a) => !a.toLowerCase().includes("no known"));

  auditLog("SUMMARY_GENERATED", userId, patientId, `Conditions:${conditions.length} Meds:${medications.length} Labs:${recentLabs.length}`);

  return {
    patientId,
    firstName: getFirstName(patient.patientName),
    generatedAt: new Date().toISOString(),
    overallStatus: status,
    overallMessage: message,
    conditions,
    medications,
    recentLabs,
    vitals,
    upcomingAppointments: appointments,
    aiInsights,
    allergies,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

console.log("[PatientFriendlySummary] Service initialized");
console.log(`[PatientFriendlySummary] Available patients: ${Object.keys(SAMPLE_PATIENTS).length}`);
