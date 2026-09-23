import { randomUUID } from "crypto";
import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = `DISCLAIMER: This consolidated patient view is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.`;

export interface PatientDemographics {
  patientId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate: string;
  age: number;
  gender: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  mrn?: string;
  insuranceProvider?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface PatientCondition {
  id: string;
  name: string;
  code?: string;
  codeSystem?: string;
  status: "active" | "resolved" | "inactive";
  severity?: "mild" | "moderate" | "severe";
  onsetDate?: string;
  recordedDate: string;
  source: string;
}

export interface PatientMedication {
  id: string;
  name: string;
  code?: string;
  dosage?: string;
  frequency?: string;
  status: "active" | "completed" | "stopped" | "on-hold";
  prescribedDate?: string;
  prescriber?: string;
  source: string;
}

export interface PatientAllergy {
  id: string;
  allergen: string;
  type: "allergy" | "intolerance";
  category: "medication" | "food" | "environment" | "other";
  severity: "low" | "moderate" | "high";
  reactions?: string[];
  recordedDate: string;
  source: string;
}

export interface VitalSign {
  id: string;
  type: string;
  value: number;
  unit: string;
  effectiveDate: string;
  interpretation?: "normal" | "low" | "high" | "critical";
  source: string;
}

export interface LabResult {
  id: string;
  testName: string;
  code?: string;
  value: number | string;
  unit?: string;
  referenceRange?: string;
  interpretation?: "normal" | "abnormal" | "critical";
  effectiveDate: string;
  source: string;
}

export interface TelehealthSession {
  id: string;
  providerId: string;
  providerName: string;
  specialty: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled" | "no-show";
  type: "video" | "audio" | "chat";
  chiefComplaint?: string;
  summary?: string;
  followUpRequired: boolean;
  recordingAvailable: boolean;
}

export interface Appointment {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  facilityName: string;
  facilityAddress?: string;
  type: "checkup" | "followup" | "specialist" | "lab" | "imaging" | "procedure" | "telehealth";
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no-show";
  isTelehealth: boolean;
  telehealthUrl?: string;
  preVisitInstructions?: string;
}

export interface RiskAssessment {
  id: string;
  category: string;
  conditionName: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  timeframe: string;
  topFactors: string[];
  aiConfidence: number;
  generatedAt: string;
}

export interface MedicationSafetySummary {
  overallSafetyLevel: "safe" | "concerns_identified" | "review_urgently";
  safetyScore: number;
  interactionsCount: number;
  allergyConcerns: number;
  dosingConcerns: number;
  lastAnalyzedAt: string;
}

export interface CarePlanSummary {
  id: string;
  title: string;
  status: "active" | "completed" | "draft";
  priorityRecommendations: string[];
  upcomingScreenings: { name: string; dueDate: string }[];
  wellnessGoals: { goal: string; progress: number }[];
  lastUpdated: string;
}

export interface QuickModuleLink {
  id: string;
  name: string;
  path: string;
  icon: string;
  description: string;
  category: "clinical" | "administrative" | "ai" | "communication";
  badgeCount?: number;
}

export interface ViewPreference {
  sectionId: string;
  visible: boolean;
  order: number;
  collapsed: boolean;
}

export interface ComprehensivePatient360View {
  patientId: string;
  demographics: PatientDemographics;
  conditions: PatientCondition[];
  medications: PatientMedication[];
  allergies: PatientAllergy[];
  recentVitals: VitalSign[];
  recentLabs: LabResult[];
  telehealthHistory: TelehealthSession[];
  upcomingAppointments: Appointment[];
  pastAppointments: Appointment[];
  riskAssessments: RiskAssessment[];
  medicationSafety: MedicationSafetySummary;
  carePlan: CarePlanSummary | null;
  quickLinks: QuickModuleLink[];
  dataQualitySummary: {
    overallScore: number;
    sourcesCount: number;
    lastUpdated: string;
    issuesCount: number;
  };
  aiSummary: string | null;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

const patientData = new Map<string, ComprehensivePatient360View>();

function initializePatientData(): void {
  const now = new Date();
  
  const patient1: ComprehensivePatient360View = {
    patientId: "patient-001",
    demographics: {
      patientId: "patient-001",
      name: "John Smith",
      firstName: "John",
      lastName: "Smith",
      birthDate: "1975-06-15",
      age: 49,
      gender: "Male",
      address: "123 Main St, Springfield, IL 62701",
      city: "Springfield",
      state: "IL",
      phone: "(555) 123-4567",
      email: "j.smith@email.com",
      preferredLanguage: "English",
      mrn: "MRN-12345",
      insuranceProvider: "Blue Cross Blue Shield",
      emergencyContact: {
        name: "Jane Smith",
        relationship: "Spouse",
        phone: "(555) 123-4568"
      }
    },
    conditions: [
      { id: "cond-001", name: "Essential Hypertension", code: "I10", codeSystem: "ICD-10", status: "active", severity: "moderate", onsetDate: "2018-03-15", recordedDate: "2018-03-15", source: "Primary Care Provider" },
      { id: "cond-002", name: "Type 2 Diabetes Mellitus", code: "E11", codeSystem: "ICD-10", status: "active", severity: "moderate", onsetDate: "2020-01-10", recordedDate: "2020-01-10", source: "Primary Care Provider" },
      { id: "cond-003", name: "Hyperlipidemia", code: "E78.5", codeSystem: "ICD-10", status: "active", severity: "mild", onsetDate: "2019-06-22", recordedDate: "2019-06-22", source: "Primary Care Provider" },
      { id: "cond-004", name: "Seasonal Allergies", code: "J30.1", codeSystem: "ICD-10", status: "active", severity: "mild", onsetDate: "2010-04-01", recordedDate: "2010-04-01", source: "Primary Care Provider" }
    ],
    medications: [
      { id: "med-001", name: "Metformin 500mg", dosage: "500mg", frequency: "Twice daily", status: "active", prescribedDate: "2020-01-15", prescriber: "Dr. Sarah Johnson", source: "Primary Care Provider" },
      { id: "med-002", name: "Lisinopril 10mg", dosage: "10mg", frequency: "Once daily", status: "active", prescribedDate: "2018-03-20", prescriber: "Dr. Sarah Johnson", source: "Primary Care Provider" },
      { id: "med-003", name: "Atorvastatin 20mg", dosage: "20mg", frequency: "Once daily at bedtime", status: "active", prescribedDate: "2019-07-01", prescriber: "Dr. Sarah Johnson", source: "CVS Pharmacy" },
      { id: "med-004", name: "Aspirin 81mg", dosage: "81mg", frequency: "Once daily", status: "active", prescribedDate: "2019-07-01", prescriber: "Dr. Sarah Johnson", source: "CVS Pharmacy" },
      { id: "med-005", name: "Loratadine 10mg", dosage: "10mg", frequency: "As needed", status: "active", prescribedDate: "2022-04-10", prescriber: "Dr. Sarah Johnson", source: "Primary Care Provider" }
    ],
    allergies: [
      { id: "allergy-001", allergen: "Penicillin", type: "allergy", category: "medication", severity: "high", reactions: ["Hives", "Difficulty breathing"], recordedDate: "2010-05-15", source: "Primary Care Provider" },
      { id: "allergy-002", allergen: "Shellfish", type: "allergy", category: "food", severity: "moderate", reactions: ["Swelling", "Itching"], recordedDate: "2015-08-20", source: "Primary Care Provider" }
    ],
    recentVitals: [
      { id: "vital-001", type: "Blood Pressure", value: 138, unit: "mmHg (systolic)", effectiveDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "high", source: "Primary Care Provider" },
      { id: "vital-002", type: "Heart Rate", value: 72, unit: "bpm", effectiveDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Apple HealthKit" },
      { id: "vital-003", type: "Weight", value: 185, unit: "lbs", effectiveDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Primary Care Provider" },
      { id: "vital-004", type: "Blood Glucose", value: 126, unit: "mg/dL", effectiveDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "high", source: "Patient Reported" },
      { id: "vital-005", type: "SpO2", value: 98, unit: "%", effectiveDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Apple HealthKit" }
    ],
    recentLabs: [
      { id: "lab-001", testName: "HbA1c", code: "4548-4", value: 7.2, unit: "%", referenceRange: "< 5.7%", interpretation: "abnormal", effectiveDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), source: "Quest Diagnostics" },
      { id: "lab-002", testName: "LDL Cholesterol", code: "13457-7", value: 128, unit: "mg/dL", referenceRange: "< 100 mg/dL", interpretation: "abnormal", effectiveDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), source: "Quest Diagnostics" },
      { id: "lab-003", testName: "Creatinine", code: "2160-0", value: 1.1, unit: "mg/dL", referenceRange: "0.7-1.3 mg/dL", interpretation: "normal", effectiveDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), source: "Quest Diagnostics" },
      { id: "lab-004", testName: "eGFR", code: "33914-3", value: 78, unit: "mL/min/1.73m2", referenceRange: "> 60", interpretation: "normal", effectiveDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), source: "Quest Diagnostics" }
    ],
    telehealthHistory: [
      { id: "telehealth-001", providerId: "prov-001", providerName: "Dr. Sarah Johnson", specialty: "Internal Medicine", scheduledAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), duration: 25, status: "completed", type: "video", chiefComplaint: "Diabetes follow-up", summary: "Blood sugar levels discussed. Continuing current medication regimen.", followUpRequired: true, recordingAvailable: true },
      { id: "telehealth-002", providerId: "prov-002", providerName: "Dr. Michael Chen", specialty: "Cardiology", scheduledAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), duration: 30, status: "completed", type: "video", chiefComplaint: "Blood pressure management", summary: "BP trending better. Continue current regimen.", followUpRequired: false, recordingAvailable: true }
    ],
    upcomingAppointments: [
      { id: "apt-001", providerId: "prov-001", providerName: "Dr. Sarah Johnson", providerSpecialty: "Internal Medicine", facilityName: "City Health Center", facilityAddress: "123 Medical Drive", type: "checkup", title: "Annual Physical Examination", description: "Comprehensive annual health checkup", scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), duration: 45, status: "confirmed", isTelehealth: false, preVisitInstructions: "Fast for 12 hours" },
      { id: "apt-002", providerId: "prov-002", providerName: "Dr. Michael Chen", providerSpecialty: "Cardiology", facilityName: "Heart & Vascular Institute", type: "telehealth", title: "Cardiology Follow-up", description: "Review ECG results", scheduledAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(), duration: 30, status: "scheduled", isTelehealth: true, telehealthUrl: "https://telehealth.example.com/room/abc123" },
      { id: "apt-003", providerId: "prov-003", providerName: "Lab Services", providerSpecialty: "Diagnostics", facilityName: "Quest Diagnostics", type: "lab", title: "Blood Work - Lipid Panel", scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), duration: 15, status: "scheduled", isTelehealth: false, preVisitInstructions: "Fast for 9-12 hours" }
    ],
    pastAppointments: [
      { id: "apt-past-001", providerId: "prov-001", providerName: "Dr. Sarah Johnson", providerSpecialty: "Internal Medicine", facilityName: "City Health Center", type: "followup", title: "Diabetes Management Review", scheduledAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), duration: 30, status: "completed", isTelehealth: false },
      { id: "apt-past-002", providerId: "prov-004", providerName: "Dr. Emily Rodriguez", providerSpecialty: "Ophthalmology", facilityName: "Eye Care Center", type: "specialist", title: "Diabetic Eye Exam", scheduledAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), duration: 45, status: "completed", isTelehealth: false }
    ],
    riskAssessments: [
      { id: "risk-001", category: "cardiovascular", conditionName: "Cardiovascular Disease", riskLevel: "moderate", riskScore: 0.42, timeframe: "10 years", topFactors: ["Hypertension", "Hyperlipidemia", "Age"], aiConfidence: 0.78, generatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "risk-002", category: "diabetes_complications", conditionName: "Diabetes Complications", riskLevel: "moderate", riskScore: 0.38, timeframe: "5 years", topFactors: ["HbA1c above target", "Duration of diabetes"], aiConfidence: 0.75, generatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "risk-003", category: "renal", conditionName: "Chronic Kidney Disease Progression", riskLevel: "low", riskScore: 0.18, timeframe: "5 years", topFactors: ["Diabetes", "Hypertension"], aiConfidence: 0.72, generatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    medicationSafety: {
      overallSafetyLevel: "safe",
      safetyScore: 0.92,
      interactionsCount: 0,
      allergyConcerns: 0,
      dosingConcerns: 0,
      lastAnalyzedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    carePlan: {
      id: "careplan-001",
      title: "Chronic Disease Management Plan",
      status: "active",
      priorityRecommendations: [
        "Continue current diabetes management with target HbA1c < 7%",
        "Blood pressure monitoring twice weekly",
        "Annual diabetic eye exam",
        "Statin therapy for cardiovascular protection"
      ],
      upcomingScreenings: [
        { name: "Annual Physical", dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() },
        { name: "Colonoscopy", dueDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString() },
        { name: "Flu Vaccination", dueDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() }
      ],
      wellnessGoals: [
        { goal: "Walk 30 minutes daily", progress: 70 },
        { goal: "Maintain weight under 180 lbs", progress: 85 },
        { goal: "Blood glucose under 130 mg/dL", progress: 60 }
      ],
      lastUpdated: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    quickLinks: [
      { id: "link-001", name: "AI Risk Analysis", path: "/ai-patient-intelligence", icon: "Brain", description: "View detailed AI risk predictions", category: "ai" },
      { id: "link-002", name: "Medication Safety", path: "/ai-medication-management", icon: "Pill", description: "Drug interactions and safety checks", category: "clinical" },
      { id: "link-003", name: "Care Plan", path: "/ai-care-plan", icon: "ClipboardList", description: "View and update care plans", category: "clinical" },
      { id: "link-004", name: "FHIR Data Quality", path: "/fhir-data-quality", icon: "CheckCircle", description: "Data validation and quality", category: "administrative", badgeCount: 3 },
      { id: "link-005", name: "Clinical Analysis", path: "/fhir-clinical-analysis", icon: "Stethoscope", description: "Deep clinical data analysis", category: "clinical" },
      { id: "link-006", name: "Appointments", path: "/appointments", icon: "Calendar", description: "Manage appointments", category: "administrative" },
      { id: "link-007", name: "Telehealth", path: "/telehealth", icon: "Video", description: "Start or join video consultation", category: "communication" },
      { id: "link-008", name: "Messages", path: "/messages", icon: "MessageSquare", description: "Patient communication", category: "communication", badgeCount: 2 }
    ],
    dataQualitySummary: {
      overallScore: 91.5,
      sourcesCount: 4,
      lastUpdated: new Date().toISOString(),
      issuesCount: 3
    },
    aiSummary: null,
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };

  patientData.set("patient-001", patient1);

  const patient2: ComprehensivePatient360View = {
    patientId: "patient-002",
    demographics: {
      patientId: "patient-002",
      name: "Sarah Johnson",
      firstName: "Sarah",
      lastName: "Johnson",
      birthDate: "1988-11-22",
      age: 36,
      gender: "Female",
      address: "456 Oak Avenue, Chicago, IL 60601",
      city: "Chicago",
      state: "IL",
      phone: "(555) 987-6543",
      email: "s.johnson@email.com",
      preferredLanguage: "English",
      mrn: "MRN-67890",
      insuranceProvider: "Aetna"
    },
    conditions: [
      { id: "cond-101", name: "Asthma", code: "J45.20", codeSystem: "ICD-10", status: "active", severity: "mild", onsetDate: "2005-08-10", recordedDate: "2005-08-10", source: "Hospital Network" }
    ],
    medications: [
      { id: "med-101", name: "Albuterol Inhaler", dosage: "90mcg", frequency: "As needed", status: "active", prescribedDate: "2023-01-15", prescriber: "Dr. Robert Williams", source: "Hospital Network" },
      { id: "med-102", name: "Fluticasone Inhaler", dosage: "110mcg", frequency: "Twice daily", status: "active", prescribedDate: "2023-01-15", prescriber: "Dr. Robert Williams", source: "Hospital Network" }
    ],
    allergies: [
      { id: "allergy-101", allergen: "Dust Mites", type: "allergy", category: "environment", severity: "moderate", reactions: ["Sneezing", "Congestion"], recordedDate: "2005-08-10", source: "Hospital Network" }
    ],
    recentVitals: [
      { id: "vital-101", type: "Blood Pressure", value: 118, unit: "mmHg (systolic)", effectiveDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Hospital Network" },
      { id: "vital-102", type: "Heart Rate", value: 68, unit: "bpm", effectiveDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Hospital Network" },
      { id: "vital-103", type: "Peak Flow", value: 450, unit: "L/min", effectiveDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Patient Reported" }
    ],
    recentLabs: [
      { id: "lab-101", testName: "Complete Blood Count", value: "Normal", effectiveDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), interpretation: "normal", source: "Hospital Network" }
    ],
    telehealthHistory: [
      { id: "telehealth-101", providerId: "prov-101", providerName: "Dr. Robert Williams", specialty: "Pulmonology", scheduledAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), duration: 20, status: "completed", type: "video", chiefComplaint: "Asthma check-up", summary: "Asthma well-controlled. Continue current regimen.", followUpRequired: false, recordingAvailable: true }
    ],
    upcomingAppointments: [
      { id: "apt-101", providerId: "prov-101", providerName: "Dr. Robert Williams", providerSpecialty: "Pulmonology", facilityName: "Respiratory Care Center", type: "followup", title: "Asthma Management Review", scheduledAt: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(), duration: 30, status: "scheduled", isTelehealth: true, telehealthUrl: "https://telehealth.example.com/room/xyz789" }
    ],
    pastAppointments: [
      { id: "apt-past-101", providerId: "prov-102", providerName: "Dr. Lisa Park", providerSpecialty: "Primary Care", facilityName: "Family Health Clinic", type: "checkup", title: "Annual Wellness Visit", scheduledAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), duration: 45, status: "completed", isTelehealth: false }
    ],
    riskAssessments: [
      { id: "risk-101", category: "respiratory", conditionName: "Asthma Exacerbation", riskLevel: "low", riskScore: 0.15, timeframe: "1 year", topFactors: ["Well-controlled asthma", "Good medication adherence"], aiConfidence: 0.82, generatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    medicationSafety: {
      overallSafetyLevel: "safe",
      safetyScore: 0.98,
      interactionsCount: 0,
      allergyConcerns: 0,
      dosingConcerns: 0,
      lastAnalyzedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    carePlan: {
      id: "careplan-002",
      title: "Asthma Action Plan",
      status: "active",
      priorityRecommendations: [
        "Continue daily controller medication",
        "Keep rescue inhaler accessible",
        "Monitor peak flow weekly"
      ],
      upcomingScreenings: [
        { name: "Pulmonary Function Test", dueDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString() }
      ],
      wellnessGoals: [
        { goal: "Exercise 3 times weekly", progress: 80 },
        { goal: "Peak flow above 400 L/min", progress: 100 }
      ],
      lastUpdated: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    quickLinks: [
      { id: "link-001", name: "AI Risk Analysis", path: "/ai-patient-intelligence", icon: "Brain", description: "View detailed AI risk predictions", category: "ai" },
      { id: "link-002", name: "Medication Safety", path: "/ai-medication-management", icon: "Pill", description: "Drug interactions and safety checks", category: "clinical" },
      { id: "link-003", name: "Care Plan", path: "/ai-care-plan", icon: "ClipboardList", description: "View and update care plans", category: "clinical" },
      { id: "link-004", name: "FHIR Data Quality", path: "/fhir-data-quality", icon: "CheckCircle", description: "Data validation and quality", category: "administrative" },
      { id: "link-005", name: "Telehealth", path: "/telehealth", icon: "Video", description: "Start or join video consultation", category: "communication" }
    ],
    dataQualitySummary: {
      overallScore: 88.7,
      sourcesCount: 2,
      lastUpdated: new Date().toISOString(),
      issuesCount: 0
    },
    aiSummary: null,
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };

  patientData.set("patient-002", patient2);
}

initializePatientData();

export async function getComprehensivePatient360(
  patientId: string,
  userId: string,
  options?: {
    includeSections?: string[];
    generateAISummary?: boolean;
  }
): Promise<ComprehensivePatient360View | null> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "Patient360",
    resourceId: patientId,
    details: `View patient 360 - sections: ${options?.includeSections?.join(", ") || "all"}`
  });

  const patient = patientData.get(patientId);
  if (!patient) {
    return null;
  }

  const view = { ...patient };

  if (options?.generateAISummary) {
    view.aiSummary = await generateAISummary(patient, userId);
  }

  return view;
}

async function generateAISummary(patient: ComprehensivePatient360View, userId: string): Promise<string> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "Patient360",
    resourceId: patient.patientId,
    details: "Generate AI summary for patient 360"
  });

  try {
    const prompt = `Generate a concise patient overview summary (3-4 sentences) for healthcare coordination purposes. Include data integration status ONLY - no clinical recommendations.

Patient: ${patient.demographics.name}, ${patient.demographics.age}yo ${patient.demographics.gender}
Active Conditions: ${patient.conditions.filter(c => c.status === "active").length}
Active Medications: ${patient.medications.filter(m => m.status === "active").length}
Data Sources: ${patient.dataQualitySummary.sourcesCount}
Data Quality Score: ${patient.dataQualitySummary.overallScore}%
Upcoming Appointments: ${patient.upcomingAppointments.length}

Focus on data completeness and care coordination status only. No clinical advice.`;

    const aiText = await generatePhiSafeText({
      system: "You provide healthcare data integration summaries. Never provide clinical advice or recommendations. Focus only on data completeness and care coordination status.",
      user: prompt,
      maxTokens: 200
    });

    return aiText || generateFallbackSummary(patient);
  } catch {
    return generateFallbackSummary(patient);
  }
}

function generateFallbackSummary(patient: ComprehensivePatient360View): string {
  const activeConditions = patient.conditions.filter(c => c.status === "active").length;
  const activeMeds = patient.medications.filter(m => m.status === "active").length;
  const upcomingAppts = patient.upcomingAppointments.length;

  return `${patient.demographics.name} has ${activeConditions} active condition(s) and ${activeMeds} active medication(s). Data is sourced from ${patient.dataQualitySummary.sourcesCount} system(s) with a quality score of ${patient.dataQualitySummary.overallScore}%. ${upcomingAppts > 0 ? `${upcomingAppts} upcoming appointment(s) scheduled.` : "No upcoming appointments."}`;
}

export function listAllPatients(): { patientId: string; name: string; age: number; conditionsCount: number; lastUpdated: string }[] {
  const patients: { patientId: string; name: string; age: number; conditionsCount: number; lastUpdated: string }[] = [];

  patientData.forEach((patient, id) => {
    patients.push({
      patientId: id,
      name: patient.demographics.name,
      age: patient.demographics.age,
      conditionsCount: patient.conditions.filter(c => c.status === "active").length,
      lastUpdated: patient.lastUpdated
    });
  });

  return patients;
}

export function getPatient360DashboardStats(): {
  totalPatients: number;
  avgDataQuality: number;
  totalAppointments: number;
  totalRiskAssessments: number;
  patientsAtHighRisk: number;
} {
  let totalQuality = 0;
  let totalAppts = 0;
  let totalRisks = 0;
  let highRiskCount = 0;

  patientData.forEach(patient => {
    totalQuality += patient.dataQualitySummary.overallScore;
    totalAppts += patient.upcomingAppointments.length;
    totalRisks += patient.riskAssessments.length;
    if (patient.riskAssessments.some(r => r.riskLevel === "high" || r.riskLevel === "critical")) {
      highRiskCount++;
    }
  });

  return {
    totalPatients: patientData.size,
    avgDataQuality: patientData.size > 0 ? Math.round(totalQuality / patientData.size * 10) / 10 : 0,
    totalAppointments: totalAppts,
    totalRiskAssessments: totalRisks,
    patientsAtHighRisk: highRiskCount
  };
}

export function updateViewPreferences(
  patientId: string,
  userId: string,
  preferences: ViewPreference[]
): boolean {
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "Patient360",
    resourceId: patientId,
    details: `Update view preferences - ${preferences.length} sections`
  });
  return true;
}

export function getQuickLinksForPatient(patientId: string): QuickModuleLink[] {
  const patient = patientData.get(patientId);
  return patient?.quickLinks || [];
}
