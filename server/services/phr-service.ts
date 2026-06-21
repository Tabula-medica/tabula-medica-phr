import type {
  Patient,
  Medication,
  Allergy,
  Immunization,
  LabResult,
  VitalSign,
  Appointment,
  Problem,
  MedicalRecord,
  FamilyMedicalHistory,
} from "@shared/schema";

export interface PHRSummary {
  patient: PHRPatientProfile;
  stats: PHRStats;
}

export interface PHRPatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  insuranceProvider: string;
  insuranceId: string;
  primaryPhysician: string;
  bloodType: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface PHRStats {
  activeMedications: number;
  activeAllergies: number;
  immunizationsCount: number;
  recentLabResults: number;
  upcomingAppointments: number;
  activeConditions: number;
  lastUpdated: string;
  dataSources: string[];
}

export interface PHRMedication extends Medication {
  source: string;
  instructions?: string;
  sideEffects?: string[];
  lastRefillDate?: string;
}

export interface PHRAllergy extends Allergy {
  source: string;
  crossReactivities?: string[];
  lastReaction?: string;
}

export interface PHRImmunization extends Immunization {
  source: string;
}

export interface PHRLabResult extends LabResult {
  source: string;
  trend?: "improving" | "stable" | "worsening";
  previousValue?: string;
}

export interface PHRVitalSign extends VitalSign {
  source: string;
  trend?: "improving" | "stable" | "worsening";
}

export interface PHRAppointment extends Appointment {
  source: string;
  instructions?: string;
  telehealth?: boolean;
}

export interface PHRCondition extends Problem {
  source: string;
  treatmentPlan?: string;
  lastAssessment?: string;
}

export interface PHRMedicalEvent extends MedicalRecord {
  source: string;
}

export interface PHRFamilyHistory extends FamilyMedicalHistory {
  source: string;
}

class PHRService {
  private samplePatientId = "patient-001";

  private patientProfile: PHRPatientProfile = {
    id: "patient-001",
    firstName: "Sarah",
    lastName: "Mitchell",
    dateOfBirth: "1985-03-15",
    gender: "Female",
    email: "sarah.mitchell@email.com",
    phone: "(555) 234-5678",
    address: "742 Oak Lane, Portland, OR 97205",
    insuranceProvider: "Blue Cross Blue Shield",
    insuranceId: "BCBS-892145",
    primaryPhysician: "Dr. Sarah Smith",
    bloodType: "A+",
    emergencyContact: {
      name: "James Mitchell",
      phone: "(555) 345-6789",
      relationship: "Spouse",
    },
  };

  private medications: PHRMedication[] = [
    {
      id: "med-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Lisinopril",
      dosage: "10 mg",
      frequency: "Once daily",
      prescribedBy: "Dr. Sarah Smith",
      startDate: "2024-06-15",
      status: "active",
      refillsRemaining: 3,
      patientReported: "taking",
      source: "Primary Care Provider",
      instructions: "Take in the morning with water. Avoid potassium supplements.",
      sideEffects: ["Dry cough", "Dizziness"],
      lastRefillDate: "2026-01-10",
    },
    {
      id: "med-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Metformin",
      dosage: "500 mg",
      frequency: "Twice daily with meals",
      prescribedBy: "Dr. Michael Chen",
      startDate: "2025-09-01",
      status: "active",
      refillsRemaining: 5,
      patientReported: "taking",
      source: "Primary Care Provider",
      instructions: "Take with breakfast and dinner. Monitor blood glucose levels.",
      sideEffects: ["Nausea", "Stomach upset"],
      lastRefillDate: "2026-01-20",
    },
    {
      id: "med-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Atorvastatin",
      dosage: "20 mg",
      frequency: "Once daily at bedtime",
      prescribedBy: "Dr. Sarah Smith",
      startDate: "2024-11-01",
      status: "active",
      refillsRemaining: 2,
      patientReported: "taking",
      source: "Primary Care Provider",
      instructions: "Take at bedtime. Avoid grapefruit.",
      sideEffects: ["Muscle pain", "Headache"],
      lastRefillDate: "2025-12-15",
    },
    {
      id: "med-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      name: "Vitamin D3",
      dosage: "2000 IU",
      frequency: "Once daily",
      prescribedBy: "Dr. Sarah Smith",
      startDate: "2025-03-01",
      status: "active",
      refillsRemaining: 6,
      patientReported: "taking",
      source: "Hospital Network",
      instructions: "Take with food for better absorption.",
      lastRefillDate: "2026-01-05",
    },
    {
      id: "med-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "manual",
      name: "Ibuprofen",
      dosage: "200 mg",
      frequency: "As needed for pain",
      prescribedBy: "Self",
      startDate: "2025-12-01",
      status: "active",
      refillsRemaining: 0,
      patientReported: "taking",
      source: "Patient Entry",
      instructions: "Take with food. Do not exceed 1200mg per day.",
    },
    {
      id: "med-006",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Amoxicillin",
      dosage: "500 mg",
      frequency: "Three times daily",
      prescribedBy: "Dr. Sarah Smith",
      startDate: "2025-10-15",
      endDate: "2025-10-25",
      status: "discontinued",
      refillsRemaining: 0,
      source: "Primary Care Provider",
      instructions: "Completed 10-day course for sinus infection.",
    },
  ];

  private allergies: PHRAllergy[] = [
    {
      id: "allergy-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Penicillin",
      type: "drug",
      severity: "severe",
      reaction: "Anaphylaxis, hives, difficulty breathing",
      onsetDate: "2010-05-20",
      status: "active",
      verifiedBy: "Dr. Sarah Smith",
      verifiedDate: "2024-06-15",
      source: "Primary Care Provider",
      crossReactivities: ["Amoxicillin", "Ampicillin", "Cephalosporins (caution)"],
      lastReaction: "2018-03-12",
    },
    {
      id: "allergy-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Sulfa Drugs",
      type: "drug",
      severity: "moderate",
      reaction: "Skin rash, itching",
      onsetDate: "2015-08-10",
      status: "active",
      verifiedBy: "Dr. Sarah Smith",
      verifiedDate: "2024-06-15",
      source: "Primary Care Provider",
      crossReactivities: ["Sulfamethoxazole", "Sulfasalazine"],
    },
    {
      id: "allergy-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      name: "Tree Nuts",
      type: "food",
      severity: "moderate",
      reaction: "Swelling of lips and tongue, stomach pain",
      onsetDate: "2005-01-01",
      status: "active",
      verifiedBy: "Dr. Emily Wong",
      verifiedDate: "2023-09-20",
      source: "Hospital Network",
      crossReactivities: ["Walnuts", "Pecans", "Almonds", "Cashews"],
      lastReaction: "2024-11-05",
    },
    {
      id: "allergy-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "manual",
      name: "Latex",
      type: "environmental",
      severity: "mild",
      reaction: "Contact dermatitis, skin redness",
      onsetDate: "2019-06-01",
      status: "active",
      source: "Patient Entry",
      notes: "Request latex-free gloves during medical procedures.",
    },
  ];

  private immunizations: PHRImmunization[] = [
    {
      id: "imm-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      vaccineName: "COVID-19 (Pfizer-BioNTech) Booster",
      vaccineCode: "CVX-308",
      manufacturer: "Pfizer",
      lotNumber: "FL3456",
      doseNumber: 5,
      administeredDate: "2025-10-15",
      administeredBy: "Nurse Emily Johnson",
      facility: "Portland Health Center",
      status: "completed",
      seriesComplete: false,
      createdAt: "2025-10-15T10:00:00Z",
      source: "Primary Care Provider",
    },
    {
      id: "imm-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      vaccineName: "Influenza (Flu Shot) 2025-2026",
      vaccineCode: "CVX-197",
      manufacturer: "Sanofi Pasteur",
      lotNumber: "FLU2526-A",
      doseNumber: 1,
      administeredDate: "2025-09-20",
      administeredBy: "Nurse Emily Johnson",
      facility: "Portland Health Center",
      status: "completed",
      seriesComplete: true,
      createdAt: "2025-09-20T14:30:00Z",
      source: "Primary Care Provider",
    },
    {
      id: "imm-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      vaccineName: "Tdap (Tetanus, Diphtheria, Pertussis)",
      vaccineCode: "CVX-115",
      manufacturer: "GlaxoSmithKline",
      lotNumber: "TD8901",
      doseNumber: 1,
      administeredDate: "2023-04-10",
      administeredBy: "Dr. Sarah Smith",
      facility: "OHSU Medical Center",
      status: "completed",
      seriesComplete: true,
      nextDoseDate: "2033-04-10",
      createdAt: "2023-04-10T09:00:00Z",
      source: "Hospital Network",
    },
    {
      id: "imm-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      vaccineName: "Hepatitis B",
      vaccineCode: "CVX-08",
      manufacturer: "Merck",
      lotNumber: "HB4567",
      doseNumber: 3,
      administeredDate: "2020-02-15",
      administeredBy: "Nurse Patricia Adams",
      facility: "Portland Health Center",
      status: "completed",
      seriesComplete: true,
      createdAt: "2020-02-15T11:00:00Z",
      source: "Primary Care Provider",
    },
    {
      id: "imm-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      vaccineName: "Shingrix (Shingles)",
      vaccineCode: "CVX-187",
      manufacturer: "GlaxoSmithKline",
      lotNumber: "SH7890",
      doseNumber: 1,
      administeredDate: "2025-11-05",
      administeredBy: "Pharmacist David Lee",
      facility: "Walgreens Pharmacy",
      status: "completed",
      seriesComplete: false,
      nextDoseDate: "2026-05-05",
      createdAt: "2025-11-05T16:00:00Z",
      source: "Pharmacy Record",
      notes: "Second dose due in 2-6 months.",
    },
    {
      id: "imm-006",
      patientId: this.samplePatientId,
      vaccineName: "Pneumococcal (PCV20)",
      vaccineCode: "CVX-216",
      doseNumber: 1,
      administeredDate: "2026-03-15",
      facility: "Portland Health Center",
      status: "scheduled" as any,
      seriesComplete: false,
      createdAt: "2026-01-20T10:00:00Z",
      source: "Primary Care Provider",
      notes: "Scheduled - recommended based on age and medical history.",
    },
  ];

  private labResults: PHRLabResult[] = [
    {
      id: "lab-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "HbA1c (Hemoglobin A1c)",
      value: "6.2",
      unit: "%",
      referenceRange: "4.0 - 5.6",
      status: "abnormal",
      date: "2026-02-01",
      orderedBy: "Dr. Michael Chen",
      facility: "Portland Health Center Lab",
      notes: "Pre-diabetic range. Continue lifestyle modifications.",
      source: "Primary Care Provider",
      trend: "improving",
      previousValue: "6.8",
    },
    {
      id: "lab-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "Fasting Glucose",
      value: "118",
      unit: "mg/dL",
      referenceRange: "70 - 99",
      status: "abnormal",
      date: "2026-02-01",
      orderedBy: "Dr. Michael Chen",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "improving",
      previousValue: "132",
    },
    {
      id: "lab-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "Total Cholesterol",
      value: "198",
      unit: "mg/dL",
      referenceRange: "< 200",
      status: "normal",
      date: "2026-01-15",
      orderedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "improving",
      previousValue: "225",
    },
    {
      id: "lab-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "LDL Cholesterol",
      value: "118",
      unit: "mg/dL",
      referenceRange: "< 100",
      status: "abnormal",
      date: "2026-01-15",
      orderedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "improving",
      previousValue: "145",
    },
    {
      id: "lab-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "HDL Cholesterol",
      value: "58",
      unit: "mg/dL",
      referenceRange: "> 40",
      status: "normal",
      date: "2026-01-15",
      orderedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "stable",
      previousValue: "55",
    },
    {
      id: "lab-006",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      testName: "TSH (Thyroid Stimulating Hormone)",
      value: "2.8",
      unit: "mIU/L",
      referenceRange: "0.4 - 4.0",
      status: "normal",
      date: "2026-01-15",
      orderedBy: "Dr. Sarah Smith",
      facility: "OHSU Medical Center",
      source: "Hospital Network",
      trend: "stable",
      previousValue: "2.5",
    },
    {
      id: "lab-007",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "Vitamin D, 25-Hydroxy",
      value: "42",
      unit: "ng/mL",
      referenceRange: "30 - 100",
      status: "normal",
      date: "2025-12-10",
      orderedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "improving",
      previousValue: "22",
    },
    {
      id: "lab-008",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "Complete Blood Count (WBC)",
      value: "7.2",
      unit: "x10^3/uL",
      referenceRange: "4.5 - 11.0",
      status: "normal",
      date: "2026-02-01",
      orderedBy: "Dr. Michael Chen",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "stable",
    },
    {
      id: "lab-009",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      testName: "Creatinine",
      value: "0.9",
      unit: "mg/dL",
      referenceRange: "0.6 - 1.2",
      status: "normal",
      date: "2026-02-01",
      orderedBy: "Dr. Michael Chen",
      facility: "Portland Health Center Lab",
      source: "Primary Care Provider",
      trend: "stable",
      previousValue: "0.8",
    },
    {
      id: "lab-010",
      patientId: this.samplePatientId,
      ehrConnectionId: "wearable",
      testName: "Blood Pressure (Home Avg)",
      value: "128/82",
      unit: "mmHg",
      referenceRange: "< 120/80",
      status: "abnormal",
      date: "2026-02-05",
      facility: "Home Monitoring",
      source: "Withings Blood Pressure Monitor",
      trend: "improving",
      previousValue: "138/88",
    },
  ];

  private vitals: PHRVitalSign[] = [
    {
      id: "vital-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "blood_pressure",
      value: "128/82",
      unit: "mmHg",
      recordedAt: "2026-02-05T08:30:00Z",
      recordedBy: "Home Monitor",
      source: "Withings BP Monitor",
      trend: "improving",
    },
    {
      id: "vital-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "wearable",
      type: "heart_rate",
      value: "72",
      unit: "bpm",
      recordedAt: "2026-02-06T07:00:00Z",
      recordedBy: "Wearable",
      source: "Apple Watch",
      trend: "stable",
    },
    {
      id: "vital-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "weight",
      value: "165",
      unit: "lbs",
      recordedAt: "2026-02-03T09:15:00Z",
      recordedBy: "Nurse Emily Johnson",
      source: "Primary Care Provider",
      trend: "improving",
    },
    {
      id: "vital-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "wearable",
      type: "oxygen_saturation",
      value: "98",
      unit: "%",
      recordedAt: "2026-02-06T06:30:00Z",
      recordedBy: "Wearable",
      source: "Apple Watch",
      trend: "stable",
    },
    {
      id: "vital-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "temperature",
      value: "98.4",
      unit: "°F",
      recordedAt: "2026-02-03T09:15:00Z",
      recordedBy: "Nurse Emily Johnson",
      source: "Primary Care Provider",
      trend: "stable",
    },
    {
      id: "vital-006",
      patientId: this.samplePatientId,
      ehrConnectionId: "wearable",
      type: "respiratory_rate",
      value: "16",
      unit: "breaths/min",
      recordedAt: "2026-02-06T07:00:00Z",
      recordedBy: "Wearable",
      source: "Apple Watch",
      trend: "stable",
    },
  ];

  private conditions: PHRCondition[] = [
    {
      id: "cond-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Pre-diabetes (Impaired Glucose Tolerance)",
      icdCode: "R73.03",
      category: "chronic",
      status: "active",
      onsetDate: "2025-09-01",
      severity: "moderate",
      diagnosedBy: "Dr. Michael Chen",
      facility: "Portland Health Center",
      source: "Primary Care Provider",
      treatmentPlan: "Metformin 500mg BID, dietary modifications, exercise 150min/week, HbA1c monitoring every 3 months",
      lastAssessment: "2026-02-01",
    },
    {
      id: "cond-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Essential Hypertension",
      icdCode: "I10",
      category: "chronic",
      status: "active",
      onsetDate: "2024-06-15",
      severity: "mild",
      diagnosedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center",
      source: "Primary Care Provider",
      treatmentPlan: "Lisinopril 10mg daily, DASH diet, regular BP monitoring, sodium restriction < 2300mg/day",
      lastAssessment: "2026-01-20",
    },
    {
      id: "cond-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Hyperlipidemia",
      icdCode: "E78.5",
      category: "chronic",
      status: "active",
      onsetDate: "2024-11-01",
      severity: "mild",
      diagnosedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center",
      source: "Primary Care Provider",
      treatmentPlan: "Atorvastatin 20mg at bedtime, heart-healthy diet, lipid panel every 6 months",
      lastAssessment: "2026-01-15",
    },
    {
      id: "cond-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      name: "Vitamin D Deficiency",
      icdCode: "E55.9",
      category: "chronic",
      status: "active",
      onsetDate: "2025-03-01",
      severity: "mild",
      diagnosedBy: "Dr. Sarah Smith",
      facility: "OHSU Medical Center",
      source: "Hospital Network",
      treatmentPlan: "Vitamin D3 2000 IU daily, recheck levels in 6 months",
      lastAssessment: "2025-12-10",
    },
    {
      id: "cond-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Acute Sinusitis",
      icdCode: "J01.90",
      category: "acute",
      status: "resolved",
      onsetDate: "2025-10-15",
      resolvedDate: "2025-10-28",
      severity: "moderate",
      diagnosedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center",
      source: "Primary Care Provider",
      treatmentPlan: "Amoxicillin 500mg TID x 10 days (completed)",
    },
    {
      id: "cond-006",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      name: "Annual Wellness Exam",
      category: "preventive",
      status: "active",
      onsetDate: "2026-01-20",
      diagnosedBy: "Dr. Sarah Smith",
      facility: "Portland Health Center",
      source: "Primary Care Provider",
      lastAssessment: "2026-01-20",
    },
  ];

  private appointments: PHRAppointment[] = [
    {
      id: "appt-phr-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "followup",
      title: "Endocrinology Follow-Up",
      provider: "Dr. Michael Chen",
      facility: "Portland Health Center - Specialty Care, Suite 305",
      scheduledAt: "2026-02-20T10:00:00Z",
      duration: 30,
      status: "scheduled",
      notes: "Discuss HbA1c results and glucose management. Fast 8 hours before.",
      source: "Primary Care Provider",
      instructions: "Fasting required. Bring glucose log and home BP readings.",
    },
    {
      id: "appt-phr-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "lab",
      title: "Fasting Blood Work",
      provider: "Lab Services",
      facility: "Portland Health Center - Lab & Diagnostics, 1st Floor",
      scheduledAt: "2026-03-15T08:30:00Z",
      duration: 15,
      status: "scheduled",
      notes: "Annual metabolic panel and lipid panel",
      source: "Primary Care Provider",
      instructions: "No food or drink (except water) for 12 hours prior.",
    },
    {
      id: "appt-phr-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "specialist",
      title: "Ophthalmology - Diabetic Eye Screening",
      provider: "Dr. Lisa Park",
      facility: "Pacific Eye Associates",
      scheduledAt: "2026-04-05T14:00:00Z",
      duration: 45,
      status: "scheduled",
      notes: "Annual diabetic retinopathy screening",
      source: "Primary Care Provider",
      instructions: "Bring current glasses. Eyes will be dilated - arrange a ride.",
      telehealth: false,
    },
    {
      id: "appt-phr-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "checkup",
      title: "Annual Physical Exam",
      provider: "Dr. Sarah Smith",
      facility: "Portland Health Center",
      scheduledAt: "2026-01-20T09:00:00Z",
      duration: 45,
      status: "completed",
      notes: "Comprehensive wellness exam completed. All screenings up to date.",
      source: "Primary Care Provider",
    },
    {
      id: "appt-phr-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      type: "specialist",
      title: "Nutrition Counseling",
      provider: "Sarah Thompson, RD",
      facility: "OHSU Medical Center - Nutrition Services",
      scheduledAt: "2026-02-28T11:00:00Z",
      duration: 60,
      status: "scheduled",
      source: "Hospital Network",
      instructions: "Bring 3-day food diary.",
      telehealth: true,
    },
  ];

  private medicalHistory: PHRMedicalEvent[] = [
    {
      id: "event-001",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "procedure",
      title: "Colonoscopy",
      description: "Routine screening colonoscopy. No polyps found. Normal results.",
      date: "2025-06-10",
      provider: "Dr. Robert Kim",
      facility: "Portland Gastroenterology Center",
      status: "resolved",
      source: "Primary Care Provider",
    },
    {
      id: "event-002",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "diagnosis",
      title: "Pre-diabetes Diagnosis",
      description: "HbA1c of 6.8% confirmed pre-diabetic status. Lifestyle modifications and Metformin initiated.",
      date: "2025-09-01",
      provider: "Dr. Michael Chen",
      facility: "Portland Health Center",
      status: "active",
      source: "Primary Care Provider",
    },
    {
      id: "event-003",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "diagnosis",
      title: "Hypertension Diagnosis",
      description: "Elevated blood pressure readings over 3 visits. Started on Lisinopril 10mg.",
      date: "2024-06-15",
      provider: "Dr. Sarah Smith",
      facility: "Portland Health Center",
      status: "active",
      source: "Primary Care Provider",
    },
    {
      id: "event-004",
      patientId: this.samplePatientId,
      ehrConnectionId: "cerner-001",
      type: "imaging",
      title: "Chest X-Ray",
      description: "PA and lateral views. Normal cardiac silhouette. Lungs clear bilaterally.",
      date: "2025-02-20",
      provider: "Dr. Sarah Smith",
      facility: "OHSU Medical Center",
      status: "resolved",
      source: "Hospital Network",
    },
    {
      id: "event-005",
      patientId: this.samplePatientId,
      ehrConnectionId: "epic-001",
      type: "procedure",
      title: "Dermatology - Skin Biopsy",
      description: "Excisional biopsy of suspicious mole on left shoulder. Pathology: benign compound nevus.",
      date: "2024-08-22",
      provider: "Dr. Angela Torres",
      facility: "Portland Dermatology Clinic",
      status: "resolved",
      source: "Primary Care Provider",
    },
  ];

  private familyHistory: PHRFamilyHistory[] = [
    {
      id: "fh-001",
      patientId: this.samplePatientId,
      relationship: "father",
      relativeName: "Robert Mitchell",
      conditionName: "Type 2 Diabetes Mellitus",
      icdCode: "E11",
      ageOfOnset: 52,
      isDeceased: false,
      notes: "Managed with oral medications and insulin. Well-controlled.",
      createdAt: "2024-06-15T10:00:00Z",
      source: "Primary Care Provider",
    },
    {
      id: "fh-002",
      patientId: this.samplePatientId,
      relationship: "mother",
      relativeName: "Patricia Mitchell",
      conditionName: "Hypertension",
      icdCode: "I10",
      ageOfOnset: 48,
      isDeceased: false,
      notes: "On ACE inhibitor. Good control.",
      createdAt: "2024-06-15T10:00:00Z",
      source: "Primary Care Provider",
    },
    {
      id: "fh-003",
      patientId: this.samplePatientId,
      relationship: "maternal_grandmother",
      relativeName: "Eleanor Hayes",
      conditionName: "Breast Cancer",
      ageOfOnset: 65,
      ageAtDeath: 78,
      isDeceased: true,
      causeOfDeath: "Breast cancer (metastatic)",
      notes: "Diagnosed at 65, treated with surgery and chemotherapy.",
      createdAt: "2024-06-15T10:00:00Z",
      source: "Patient Entry",
    },
    {
      id: "fh-004",
      patientId: this.samplePatientId,
      relationship: "paternal_grandfather",
      relativeName: "William Mitchell",
      conditionName: "Coronary Artery Disease",
      ageOfOnset: 60,
      ageAtDeath: 72,
      isDeceased: true,
      causeOfDeath: "Myocardial infarction",
      createdAt: "2024-06-15T10:00:00Z",
      source: "Patient Entry",
    },
    {
      id: "fh-005",
      patientId: this.samplePatientId,
      relationship: "brother",
      relativeName: "David Mitchell",
      conditionName: "Pre-diabetes",
      ageOfOnset: 38,
      isDeceased: false,
      notes: "Managing with diet and exercise.",
      createdAt: "2025-01-10T10:00:00Z",
      source: "Patient Entry",
    },
  ];

  getSummary(patientId: string): { success: boolean; summary: PHRSummary } {
    const activeMeds = this.medications.filter(m => m.status === "active");
    const activeAllergies = this.allergies.filter(a => a.status === "active");
    const activeConditions = this.conditions.filter(c => c.status === "active");
    const upcomingAppts = this.appointments.filter(a => a.status === "scheduled");

    return {
      success: true,
      summary: {
        patient: this.patientProfile,
        stats: {
          activeMedications: activeMeds.length,
          activeAllergies: activeAllergies.length,
          immunizationsCount: this.immunizations.filter(i => i.status === "completed").length,
          recentLabResults: this.labResults.length,
          upcomingAppointments: upcomingAppts.length,
          activeConditions: activeConditions.length,
          lastUpdated: new Date().toISOString(),
          dataSources: ["Primary Care Provider", "Hospital Network", "Apple Watch", "Withings BP Monitor", "Patient Entry", "Pharmacy Record"],
        },
      },
    };
  }

  getMedications(patientId: string, filter?: string): { success: boolean; medications: PHRMedication[] } {
    let meds = [...this.medications];
    if (filter && filter !== "all") {
      meds = meds.filter(m => m.status === filter);
    }
    return { success: true, medications: meds };
  }

  getAllergies(patientId: string): { success: boolean; allergies: PHRAllergy[] } {
    return { success: true, allergies: this.allergies };
  }

  getImmunizations(patientId: string): { success: boolean; immunizations: PHRImmunization[] } {
    return { success: true, immunizations: this.immunizations };
  }

  getLabResults(patientId: string): { success: boolean; labResults: PHRLabResult[] } {
    return { success: true, labResults: this.labResults };
  }

  getVitals(patientId: string): { success: boolean; vitals: PHRVitalSign[] } {
    return { success: true, vitals: this.vitals };
  }

  getConditions(patientId: string, filter?: string): { success: boolean; conditions: PHRCondition[] } {
    let conds = [...this.conditions];
    if (filter && filter !== "all") {
      conds = conds.filter(c => c.status === filter);
    }
    return { success: true, conditions: conds };
  }

  getAppointments(patientId: string, filter?: string): { success: boolean; appointments: PHRAppointment[] } {
    let appts = [...this.appointments];
    if (filter && filter !== "all") {
      appts = appts.filter(a => a.status === filter);
    }
    appts.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return { success: true, appointments: appts };
  }

  getMedicalHistory(patientId: string): { success: boolean; history: PHRMedicalEvent[] } {
    const history = [...this.medicalHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { success: true, history };
  }

  getFamilyHistory(patientId: string): { success: boolean; familyHistory: PHRFamilyHistory[] } {
    return { success: true, familyHistory: this.familyHistory };
  }
}

export const phrService = new PHRService();
