import { logPhiAccess } from "../security/hipaa-audit";
import * as docGenService from "./ai-document-generation-service";

function auditLog(action: string, userId: string, patientId?: string, details?: string) {
  logPhiAccess({
    userId,
    patientId: patientId || "N/A",
    resourceType: "AIDocumentAutoFill",
    action: "read",
    details: `[DocumentAutoFill] ${action}: ${details || "N/A"}`,
  });
}

export interface AutoFillScenario {
  id: string;
  name: string;
  description: string;
  triggerType: "diagnosis" | "status_change" | "lab_result" | "medication" | "referral" | "vitals";
  triggerPattern: string;
  targetDocumentTypeId: string;
  fieldMappings: AutoFillFieldMapping[];
  specialtyMapping?: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface AutoFillFieldMapping {
  targetField: string;
  sourceType: "event_data" | "static" | "computed" | "patient_record";
  sourceKey?: string;
  staticValue?: string;
  computeFn?: string;
  description: string;
}

export interface AutoFillResult {
  scenarioId: string;
  scenarioName: string;
  targetDocumentTypeId: string;
  targetDocumentTypeName: string;
  prefilledFields: Record<string, string>;
  fieldsAutoFilled: number;
  totalFields: number;
  confidence: "high" | "medium" | "low";
  prompt: AutoFillPrompt;
}

export interface AutoFillPrompt {
  title: string;
  message: string;
  action: string;
  priority: "low" | "medium" | "high" | "urgent";
  dismissable: boolean;
}

export interface PatientContext {
  patientId: string;
  patientName: string;
  dateOfBirth?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  recentLabs?: { name: string; value: string; date: string; status?: string }[];
  vitalSigns?: { type: string; value: string; date: string }[];
  providers?: { name: string; role: string; specialty?: string }[];
  insuranceInfo?: string;
  socialHistory?: string;
  familyHistory?: string;
}

export interface ClinicalTriggerEvent {
  triggerType: AutoFillScenario["triggerType"];
  data: Record<string, string>;
  patientContext?: PatientContext;
}

const SPECIALTY_MAPPINGS: Record<string, { specialist: string; questions: string[] }> = {
  "heart failure|CHF|congestive heart|cardiomyopathy|arrhythmia|atrial fibrillation|valve disease": {
    specialist: "Cardiology",
    questions: [
      "Please evaluate cardiac function and disease staging",
      "Recommend optimal pharmacological management",
      "Assess need for device therapy or intervention",
    ],
  },
  "diabetes|diabetic|hyperglycemia|HbA1c|insulin resistance": {
    specialist: "Endocrinology",
    questions: [
      "Evaluate glycemic control and medication optimization",
      "Screen for diabetic complications (retinopathy, neuropathy, nephropathy)",
      "Assess need for insulin therapy or advanced agents",
    ],
  },
  "cancer|tumor|malignant|neoplasm|carcinoma|lymphoma|leukemia|melanoma|sarcoma": {
    specialist: "Oncology",
    questions: [
      "Evaluate staging and recommend treatment plan",
      "Discuss prognosis and treatment options with patient",
      "Coordinate multidisciplinary care approach",
    ],
  },
  "seizure|epilepsy|stroke|TIA|neuropathy|multiple sclerosis|parkinson|dementia|migraine": {
    specialist: "Neurology",
    questions: [
      "Evaluate neurological function and recommend diagnostic workup",
      "Optimize medication management for seizure/symptom control",
      "Assess need for advanced neuroimaging or procedures",
    ],
  },
  "kidney|renal|CKD|nephritis|proteinuria|dialysis|creatinine elevated": {
    specialist: "Nephrology",
    questions: [
      "Evaluate kidney function staging and progression rate",
      "Optimize renoprotective medication therapy",
      "Assess need for dialysis planning or transplant evaluation",
    ],
  },
  "COPD|asthma|pulmonary|respiratory failure|pneumonia|pleural|lung": {
    specialist: "Pulmonology",
    questions: [
      "Evaluate pulmonary function and disease severity",
      "Optimize bronchodilator and anti-inflammatory therapy",
      "Assess need for supplemental oxygen or pulmonary rehabilitation",
    ],
  },
  "rheumatoid|lupus|arthritis|autoimmune|fibromyalgia|gout|vasculitis": {
    specialist: "Rheumatology",
    questions: [
      "Evaluate disease activity and recommend DMARD therapy",
      "Assess for systemic involvement or complications",
      "Consider biologic therapy if conventional treatment inadequate",
    ],
  },
  "depression|anxiety|bipolar|psychosis|schizophrenia|PTSD|substance abuse|suicidal": {
    specialist: "Psychiatry",
    questions: [
      "Comprehensive psychiatric evaluation and risk assessment",
      "Recommend psychopharmacological management",
      "Coordinate psychotherapy and support services",
    ],
  },
  "hip|knee|shoulder|fracture|spinal|orthopedic|joint replacement|rotator cuff|ACL|meniscus": {
    specialist: "Orthopedic Surgery",
    questions: [
      "Evaluate for surgical vs. conservative management",
      "Recommend pre-operative optimization if surgery indicated",
      "Provide timeline for expected recovery and rehabilitation",
    ],
  },
  "abdominal pain|GI bleed|cirrhosis|hepatitis|IBD|Crohn|colitis|GERD|pancreatitis": {
    specialist: "Gastroenterology",
    questions: [
      "Evaluate gastrointestinal symptoms and recommend diagnostic endoscopy if indicated",
      "Optimize medical management for chronic GI conditions",
      "Assess liver function and need for hepatology consultation",
    ],
  },
};

function findSpecialtyMapping(diagnosisText: string): { specialist: string; questions: string[] } | null {
  const lower = diagnosisText.toLowerCase();
  for (const [pattern, mapping] of Object.entries(SPECIALTY_MAPPINGS)) {
    const terms = pattern.split("|").map((t) => t.trim().toLowerCase());
    if (terms.some((term) => lower.includes(term))) {
      return mapping;
    }
  }
  return null;
}

const AUTO_FILL_SCENARIOS: AutoFillScenario[] = [
  {
    id: "diagnosis-referral",
    name: "Specialist Referral on New Diagnosis",
    description: "When a new diagnosis is entered, pre-fill a referral letter to the appropriate specialist based on the condition",
    triggerType: "diagnosis",
    triggerPattern: ".*",
    targetDocumentTypeId: "referral-letter",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "patientDOB", sourceType: "patient_record", sourceKey: "dateOfBirth", description: "Patient date of birth" },
      { targetField: "reasonForReferral", sourceType: "computed", computeFn: "buildReferralReason", description: "Reason derived from diagnosis" },
      { targetField: "referredToProvider", sourceType: "computed", computeFn: "findSpecialty", description: "Specialist matched to diagnosis" },
      { targetField: "referringProvider", sourceType: "patient_record", sourceKey: "primaryProvider", description: "Current provider" },
      { targetField: "relevantHistory", sourceType: "patient_record", sourceKey: "conditions", description: "Existing conditions" },
      { targetField: "currentMedications", sourceType: "patient_record", sourceKey: "medications", description: "Current medication list" },
      { targetField: "clinicalQuestionsForSpecialist", sourceType: "computed", computeFn: "buildSpecialistQuestions", description: "Specialty-specific questions" },
      { targetField: "relevantLabResults", sourceType: "patient_record", sourceKey: "recentLabs", description: "Recent lab results" },
      { targetField: "insuranceInfo", sourceType: "patient_record", sourceKey: "insuranceInfo", description: "Insurance details" },
    ],
    priority: "high",
  },
  {
    id: "diagnosis-progress-note",
    name: "Progress Note on Diagnosis Update",
    description: "When a diagnosis is updated, pre-fill a progress note documenting the change",
    triggerType: "diagnosis",
    triggerPattern: ".*",
    targetDocumentTypeId: "progress-note",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "visitDate", sourceType: "computed", computeFn: "currentDate", description: "Today's date" },
      { targetField: "chiefComplaint", sourceType: "computed", computeFn: "buildDiagnosisComplaint", description: "Chief complaint from diagnosis" },
      { targetField: "assessment", sourceType: "computed", computeFn: "buildDiagnosisAssessment", description: "Assessment from diagnosis data" },
      { targetField: "plan", sourceType: "computed", computeFn: "buildDiagnosisPlan", description: "Initial plan based on diagnosis" },
      { targetField: "objective", sourceType: "patient_record", sourceKey: "vitalSigns", description: "Recent vital signs" },
    ],
    priority: "medium",
  },
  {
    id: "discharge-summary",
    name: "Discharge Summary on Status Change",
    description: "When patient status changes to discharged, pre-fill a discharge summary with all known hospitalization data",
    triggerType: "status_change",
    triggerPattern: "discharged",
    targetDocumentTypeId: "discharge-summary",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "dischargeDate", sourceType: "computed", computeFn: "currentDate", description: "Today as discharge date" },
      { targetField: "admissionDate", sourceType: "event_data", sourceKey: "admissionDate", description: "Admission date from event" },
      { targetField: "primaryDiagnosis", sourceType: "event_data", sourceKey: "primaryDiagnosis", description: "Primary diagnosis" },
      { targetField: "secondaryDiagnoses", sourceType: "patient_record", sourceKey: "conditions", description: "Active conditions as secondary diagnoses" },
      { targetField: "medicationsAtDischarge", sourceType: "patient_record", sourceKey: "medications", description: "Current medications at discharge" },
      { targetField: "reasonForAdmission", sourceType: "event_data", sourceKey: "reasonForAdmission", description: "Reason for admission" },
      { targetField: "hospitalCourse", sourceType: "event_data", sourceKey: "hospitalCourse", description: "Hospital course summary" },
      { targetField: "conditionAtDischarge", sourceType: "event_data", sourceKey: "conditionAtDischarge", description: "Condition at discharge" },
      { targetField: "followUpInstructions", sourceType: "computed", computeFn: "buildFollowUpInstructions", description: "Follow-up based on diagnosis" },
    ],
    priority: "urgent",
  },
  {
    id: "discharge-care-plan",
    name: "Post-Discharge Care Plan",
    description: "When patient is discharged, pre-fill a care plan letter with follow-up instructions and self-care guidance",
    triggerType: "status_change",
    triggerPattern: "discharged",
    targetDocumentTypeId: "care-plan-letter",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "conditions", sourceType: "event_data", sourceKey: "primaryDiagnosis", description: "Primary condition from hospitalization" },
      { targetField: "goals", sourceType: "computed", computeFn: "buildRecoveryGoals", description: "Recovery goals" },
      { targetField: "medications", sourceType: "patient_record", sourceKey: "medications", description: "Discharge medications" },
      { targetField: "emergencySigns", sourceType: "computed", computeFn: "buildWarningSignsForDiagnosis", description: "Warning signs to watch for" },
      { targetField: "selfMonitoringInstructions", sourceType: "computed", computeFn: "buildSelfMonitoring", description: "Home monitoring guidance" },
    ],
    priority: "high",
  },
  {
    id: "critical-lab-explanation",
    name: "Lab Explanation on Critical Result",
    description: "When a critical lab result is flagged, pre-fill a patient-friendly lab explanation",
    triggerType: "lab_result",
    triggerPattern: "critical|abnormal",
    targetDocumentTypeId: "lab-report-explanation",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "labTests", sourceType: "event_data", sourceKey: "labTests", description: "Lab test names and results" },
      { targetField: "labValues", sourceType: "event_data", sourceKey: "labValues", description: "Detailed lab values" },
      { targetField: "referenceRanges", sourceType: "event_data", sourceKey: "referenceRange", description: "Normal reference ranges" },
      { targetField: "testDate", sourceType: "computed", computeFn: "currentDate", description: "Test date" },
      { targetField: "clinicalContext", sourceType: "patient_record", sourceKey: "conditions", description: "Patient conditions for context" },
      { targetField: "resultSignificance", sourceType: "event_data", sourceKey: "significance", description: "Clinical significance" },
    ],
    priority: "urgent",
  },
  {
    id: "medication-prior-auth",
    name: "Prior Authorization on New Medication",
    description: "When a new medication is prescribed that may require prior authorization, pre-fill the authorization request",
    triggerType: "medication",
    triggerPattern: ".*",
    targetDocumentTypeId: "prior-authorization",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "requestedService", sourceType: "event_data", sourceKey: "medicationName", description: "Medication requested" },
      { targetField: "medicalNecessityJustification", sourceType: "computed", computeFn: "buildMedNecessity", description: "Medical necessity from diagnosis" },
      { targetField: "diagnosisCode", sourceType: "event_data", sourceKey: "diagnosisCode", description: "ICD-10 code" },
      { targetField: "previousTreatments", sourceType: "patient_record", sourceKey: "medications", description: "Prior medication history" },
      { targetField: "insuranceInfo", sourceType: "patient_record", sourceKey: "insuranceInfo", description: "Insurance information" },
    ],
    priority: "medium",
  },
  {
    id: "referral-letter-direct",
    name: "Referral Letter on Specialist Request",
    description: "When a referral is requested, pre-fill the referral letter with specialty-matched content",
    triggerType: "referral",
    triggerPattern: ".*",
    targetDocumentTypeId: "referral-letter",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "referredToProvider", sourceType: "event_data", sourceKey: "specialty", description: "Target specialty" },
      { targetField: "reasonForReferral", sourceType: "event_data", sourceKey: "reason", description: "Reason for referral" },
      { targetField: "urgency", sourceType: "event_data", sourceKey: "urgency", description: "Urgency level" },
      { targetField: "relevantHistory", sourceType: "patient_record", sourceKey: "conditions", description: "Medical history" },
      { targetField: "currentMedications", sourceType: "patient_record", sourceKey: "medications", description: "Current medications" },
      { targetField: "relevantLabResults", sourceType: "patient_record", sourceKey: "recentLabs", description: "Recent labs" },
      { targetField: "insuranceInfo", sourceType: "patient_record", sourceKey: "insuranceInfo", description: "Insurance" },
    ],
    priority: "medium",
  },
  {
    id: "vitals-care-plan",
    name: "Care Plan on Abnormal Vitals",
    description: "When vitals are abnormal, pre-fill a care plan letter with monitoring instructions",
    triggerType: "vitals",
    triggerPattern: ".*",
    targetDocumentTypeId: "care-plan-letter",
    fieldMappings: [
      { targetField: "patientName", sourceType: "patient_record", sourceKey: "patientName", description: "Patient full name" },
      { targetField: "conditions", sourceType: "computed", computeFn: "buildVitalsCondition", description: "Condition from abnormal vitals" },
      { targetField: "goals", sourceType: "computed", computeFn: "buildVitalsGoals", description: "Goals for vitals normalization" },
      { targetField: "selfMonitoringInstructions", sourceType: "computed", computeFn: "buildVitalsSelfMonitoring", description: "Home monitoring for vitals" },
      { targetField: "triggerSymptoms", sourceType: "computed", computeFn: "buildVitalsTriggers", description: "When to seek care" },
      { targetField: "medications", sourceType: "patient_record", sourceKey: "medications", description: "Current medications" },
    ],
    priority: "high",
  },
];

const SAMPLE_PATIENTS: Record<string, PatientContext> = {
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
    vitalSigns: [{ type: "Blood Pressure", value: "148/92 mmHg", date: "2026-02-20" }, { type: "Heart Rate", value: "88 bpm", date: "2026-02-20" }],
    providers: [{ name: "Dr. Emily Chen", role: "Primary Care Physician", specialty: "Internal Medicine" }],
    insuranceInfo: "Blue Cross Blue Shield PPO — ID: BCB-9382716",
    socialHistory: "Non-smoker, occasional alcohol (2 drinks/week), retired teacher, lives with spouse",
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
    insuranceInfo: "Aetna HMO — ID: AET-4827156",
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
    insuranceInfo: "UnitedHealthcare — ID: UHC-3948275",
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
    insuranceInfo: "Cigna PPO — ID: CIG-5839274",
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
    insuranceInfo: "Anthem Blue Cross — ID: ANT-6729384",
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
    insuranceInfo: "Humana PPO — ID: HUM-8374625",
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
    insuranceInfo: "Medicare Part B — ID: MED-2847365",
  },
};

function getPatientContext(patientId: string): PatientContext | undefined {
  return SAMPLE_PATIENTS[patientId];
}

function computeField(fnName: string, event: ClinicalTriggerEvent, patient?: PatientContext): string {
  const data = event.data;
  const diagnosis = data.diagnosis || data.primaryDiagnosis || "";

  switch (fnName) {
    case "currentDate":
      return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    case "buildReferralReason": {
      const severity = data.severity ? ` (${data.severity})` : "";
      const code = data.diagnosisCode ? ` [${data.diagnosisCode}]` : "";
      return `Evaluation and management of newly diagnosed ${diagnosis}${severity}${code}. Requesting specialist assessment for treatment planning and ongoing management.`;
    }

    case "findSpecialty": {
      const mapping = findSpecialtyMapping(diagnosis);
      return mapping ? mapping.specialist : data.specialty || "Specialist";
    }

    case "buildSpecialistQuestions": {
      const mapping = findSpecialtyMapping(diagnosis);
      if (mapping) {
        return mapping.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
      }
      return "1. Please evaluate the condition and recommend treatment\n2. Advise on optimal management strategy\n3. Determine if additional testing or intervention is needed";
    }

    case "buildDiagnosisComplaint": {
      const prev = data.previousDiagnosis;
      if (prev) {
        return `Diagnosis update: ${prev} → ${diagnosis}`;
      }
      return `New diagnosis evaluation: ${diagnosis}`;
    }

    case "buildDiagnosisAssessment": {
      const code = data.diagnosisCode ? ` (${data.diagnosisCode})` : "";
      const severity = data.severity ? `Severity: ${data.severity}. ` : "";
      return `${diagnosis}${code}. ${severity}Patient requires ongoing monitoring and management plan.`;
    }

    case "buildDiagnosisPlan": {
      const items = [`Diagnosis documented: ${diagnosis}`];
      if (data.diagnosisCode) items.push(`ICD-10 Code: ${data.diagnosisCode}`);
      const mapping = findSpecialtyMapping(diagnosis);
      if (mapping) items.push(`Consider referral to ${mapping.specialist}`);
      items.push("Order baseline labs and diagnostic studies as appropriate");
      items.push("Patient education regarding diagnosis, treatment options, and prognosis");
      items.push("Follow-up in 2-4 weeks to review results and adjust plan");
      return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
    }

    case "buildFollowUpInstructions": {
      const items = [`Follow up with primary care within 7-14 days of discharge`];
      const mapping = findSpecialtyMapping(diagnosis);
      if (mapping) items.push(`Schedule appointment with ${mapping.specialist} within 2-4 weeks`);
      items.push("Return to ED if symptoms worsen or new concerning symptoms develop");
      if (patient?.medications?.length) items.push("Continue all discharge medications as prescribed");
      return items.join("\n");
    }

    case "buildRecoveryGoals": {
      const goals = [`Recovery from ${diagnosis}`];
      goals.push("Return to baseline functional status");
      goals.push("Prevent hospital readmission");
      if (patient?.medications?.length) goals.push("Medication adherence and understanding");
      return goals.join("\n");
    }

    case "buildWarningSignsForDiagnosis": {
      const signs = ["Fever > 101°F (38.3°C)", "Worsening shortness of breath", "Chest pain or pressure"];
      if (diagnosis.toLowerCase().includes("pneumonia")) {
        signs.push("Increasing cough or new blood in sputum", "Difficulty breathing at rest");
      }
      if (diagnosis.toLowerCase().includes("heart")) {
        signs.push("Rapid weight gain (>2 lbs/day)", "Swelling in legs or ankles", "Fainting or dizziness");
      }
      return signs.map((s) => `• ${s}`).join("\n");
    }

    case "buildSelfMonitoring": {
      const instructions = ["Check temperature twice daily"];
      if (diagnosis.toLowerCase().includes("heart")) {
        instructions.push("Weigh yourself every morning before eating", "Monitor for swelling in legs/ankles");
      }
      if (diagnosis.toLowerCase().includes("diabetes") || diagnosis.toLowerCase().includes("glucose")) {
        instructions.push("Check blood sugar before meals and at bedtime", "Keep a log of readings to bring to follow-up");
      }
      instructions.push("Track symptoms and any changes to report at your follow-up visit");
      return instructions.join("\n");
    }

    case "buildMedNecessity": {
      const med = data.medicationName || "the requested medication";
      const indication = data.indication || diagnosis || "the patient's condition";
      return `${med} is medically necessary for the treatment of ${indication}. ${
        data.previousTreatments
          ? `Previous treatments have been attempted (${data.previousTreatments}) with inadequate response.`
          : "Standard first-line therapies have been considered."
      } This medication is indicated based on current clinical guidelines.`;
    }

    case "buildVitalsCondition": {
      const vType = data.vitalType || "Vital sign";
      const vValue = data.vitalValue || "abnormal";
      return `Abnormal ${vType}: ${vValue} — requires monitoring and management`;
    }

    case "buildVitalsGoals": {
      const vType = data.vitalType || "vital sign";
      const normalRange = data.normalRange || "normal range";
      return `Normalize ${vType} to target: ${normalRange}\nPrevention of complications related to uncontrolled ${vType}\nLifestyle modifications to support treatment goals`;
    }

    case "buildVitalsSelfMonitoring": {
      const vType = data.vitalType || "vital sign";
      return `Monitor ${vType} at home daily\nRecord readings in a log with date, time, and value\nBring log to all follow-up appointments\nNote any symptoms that occur alongside abnormal readings`;
    }

    case "buildVitalsTriggers": {
      const vType = data.vitalType || "vital sign";
      return `Seek immediate medical attention if:\n• ${vType} exceeds critical thresholds\n• You experience severe headache, chest pain, or shortness of breath\n• Vision changes or confusion\n• Any sudden or severe symptoms`;
    }

    default:
      return "";
  }
}

function resolvePatientField(sourceKey: string, patient: PatientContext): string {
  switch (sourceKey) {
    case "patientName":
      return patient.patientName;
    case "dateOfBirth":
      return patient.dateOfBirth || "";
    case "conditions":
      return patient.conditions?.join(", ") || "";
    case "medications":
      return patient.medications?.join("\n") || "";
    case "allergies":
      return patient.allergies?.join(", ") || "";
    case "recentLabs":
      return patient.recentLabs?.map((l) => `${l.name}: ${l.value} (${l.date}${l.status ? ` — ${l.status}` : ""})`).join("\n") || "";
    case "vitalSigns":
      return patient.vitalSigns?.map((v) => `${v.type}: ${v.value} (${v.date})`).join("\n") || "";
    case "primaryProvider":
      return patient.providers?.[0]?.name || "";
    case "insuranceInfo":
      return patient.insuranceInfo || "";
    case "socialHistory":
      return patient.socialHistory || "";
    case "familyHistory":
      return patient.familyHistory || "";
    default:
      return "";
  }
}

function matchesTriggerPattern(scenario: AutoFillScenario, event: ClinicalTriggerEvent): boolean {
  if (scenario.triggerType !== event.triggerType) return false;
  if (scenario.triggerPattern === ".*") return true;
  const patterns = scenario.triggerPattern.split("|").map((p) => p.trim().toLowerCase());
  const dataValues = Object.values(event.data).join(" ").toLowerCase();
  return patterns.some((p) => dataValues.includes(p));
}

export function getAutoFillScenarios(): AutoFillScenario[] {
  auditLog("SCENARIOS_VIEWED", "system", undefined, `Viewed ${AUTO_FILL_SCENARIOS.length} scenarios`);
  return AUTO_FILL_SCENARIOS;
}

export function evaluateAutoFill(
  event: ClinicalTriggerEvent,
  userId: string
): AutoFillResult[] {
  const patient = event.patientContext || getPatientContext(event.data.patientId || "");
  const results: AutoFillResult[] = [];

  auditLog("AUTOFILL_EVALUATED", userId, patient?.patientId, `Trigger: ${event.triggerType}, Data keys: ${Object.keys(event.data).join(", ")}`);

  for (const scenario of AUTO_FILL_SCENARIOS) {
    if (!matchesTriggerPattern(scenario, event)) continue;

    const docType = docGenService.getDocumentType(scenario.targetDocumentTypeId);
    if (!docType) continue;

    const prefilledFields: Record<string, string> = {};
    let fieldsAutoFilled = 0;

    for (const mapping of scenario.fieldMappings) {
      let value = "";

      switch (mapping.sourceType) {
        case "event_data":
          value = event.data[mapping.sourceKey || ""] || "";
          break;
        case "static":
          value = mapping.staticValue || "";
          break;
        case "computed":
          value = computeField(mapping.computeFn || "", event, patient || undefined);
          break;
        case "patient_record":
          if (patient && mapping.sourceKey) {
            value = resolvePatientField(mapping.sourceKey, patient);
          }
          break;
      }

      if (value && value.trim()) {
        prefilledFields[mapping.targetField] = value;
        fieldsAutoFilled++;
      }
    }

    if (fieldsAutoFilled === 0) continue;

    const totalFields = docType.requiredFields.length + docType.optionalFields.length;
    const fillRatio = fieldsAutoFilled / totalFields;
    const confidence: "high" | "medium" | "low" = fillRatio > 0.5 ? "high" : fillRatio > 0.25 ? "medium" : "low";

    const prompt = buildPrompt(scenario, event, docType, fieldsAutoFilled);

    results.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      targetDocumentTypeId: scenario.targetDocumentTypeId,
      targetDocumentTypeName: docType.name,
      prefilledFields,
      fieldsAutoFilled,
      totalFields,
      confidence,
      prompt,
    });
  }

  auditLog("AUTOFILL_RESULTS", userId, patient?.patientId, `Results: ${results.length} auto-fill matches`);
  return results;
}

function buildPrompt(
  scenario: AutoFillScenario,
  event: ClinicalTriggerEvent,
  docType: docGenService.DocumentType,
  fieldsAutoFilled: number
): AutoFillPrompt {
  const diagnosis = event.data.diagnosis || event.data.primaryDiagnosis || "";
  const patientName = event.patientContext?.patientName || event.data.patientName || "the patient";

  switch (scenario.triggerType) {
    case "status_change":
      if (event.data.newStatus === "discharged") {
        return {
          title: `Discharge Documentation for ${patientName}`,
          message: `${patientName} has been discharged. A ${docType.name} has been pre-populated with ${fieldsAutoFilled} fields from available records. Review and complete the remaining fields.`,
          action: `Start ${docType.name}`,
          priority: "urgent",
          dismissable: true,
        };
      }
      return {
        title: `Status Update: ${docType.name} Recommended`,
        message: `Patient status changed to "${event.data.newStatus}". ${fieldsAutoFilled} fields have been auto-filled for a ${docType.name}.`,
        action: `Open ${docType.name}`,
        priority: scenario.priority,
        dismissable: true,
      };

    case "diagnosis":
      return {
        title: `New Diagnosis: ${diagnosis}`,
        message: `A ${docType.name} has been pre-populated with ${fieldsAutoFilled} fields based on the diagnosis of "${diagnosis}" for ${patientName}. ${
          scenario.targetDocumentTypeId === "referral-letter"
            ? `Specialty matched: ${findSpecialtyMapping(diagnosis)?.specialist || "Specialist"}.`
            : ""
        }`,
        action: `Open Pre-filled ${docType.name}`,
        priority: scenario.priority,
        dismissable: true,
      };

    case "lab_result":
      return {
        title: `Critical Lab Result — ${docType.name} Ready`,
        message: `A critical lab result has been flagged. A ${docType.name} has been pre-populated with ${fieldsAutoFilled} fields to help communicate results to ${patientName}.`,
        action: `Review ${docType.name}`,
        priority: "urgent",
        dismissable: true,
      };

    case "medication":
      return {
        title: `New Medication: ${event.data.medicationName || "Prescribed"}`,
        message: `${docType.name} for ${event.data.medicationName || "the new medication"} has been pre-populated with ${fieldsAutoFilled} fields from patient records.`,
        action: `Open ${docType.name}`,
        priority: scenario.priority,
        dismissable: true,
      };

    default:
      return {
        title: `${docType.name} Auto-Filled`,
        message: `${fieldsAutoFilled} fields have been pre-populated for a ${docType.name} based on clinical data.`,
        action: `Open ${docType.name}`,
        priority: scenario.priority,
        dismissable: true,
      };
  }
}

export function getPatientAutoFillData(patientId: string, documentTypeId: string, userId: string): Record<string, string> | null {
  const patient = getPatientContext(patientId);
  if (!patient) return null;

  const docType = docGenService.getDocumentType(documentTypeId);
  if (!docType) return null;

  auditLog("PATIENT_AUTOFILL", userId, patientId, `Document: ${documentTypeId}`);

  const allFields = [...docType.requiredFields, ...docType.optionalFields];
  const result: Record<string, string> = {};

  for (const field of allFields) {
    const value = resolvePatientField(mapDocFieldToPatientKey(field), patient);
    if (value && value.trim()) {
      result[field] = value;
    }
  }

  return result;
}

function mapDocFieldToPatientKey(field: string): string {
  const mapping: Record<string, string> = {
    patientName: "patientName",
    patientDOB: "dateOfBirth",
    conditions: "conditions",
    medications: "medications",
    currentMedications: "medications",
    medicationsAtDischarge: "medications",
    allergies: "allergies",
    recentLabs: "recentLabs",
    vitalSigns: "vitalSigns",
    relevantHistory: "conditions",
    insuranceInfo: "insuranceInfo",
    socialHistory: "socialHistory",
    familyHistory: "familyHistory",
    relevantFamilyHistory: "familyHistory",
    referringProvider: "primaryProvider",
    orderingProvider: "primaryProvider",
    requestingProvider: "primaryProvider",
  };
  return mapping[field] || field;
}

console.log("[DocumentAutoFill] Service initialized");
console.log(`[DocumentAutoFill] Scenarios: ${AUTO_FILL_SCENARIOS.length}`);
console.log(`[DocumentAutoFill] Specialty mappings: ${Object.keys(SPECIALTY_MAPPINGS).length}`);
console.log(`[DocumentAutoFill] Sample patients: ${Object.keys(SAMPLE_PATIENTS).length}`);
