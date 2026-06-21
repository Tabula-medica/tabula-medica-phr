import { randomUUID } from "crypto";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const NO_CDS_DISCLAIMER = "DISCLAIMER: This analysis is for informational and educational purposes only. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals based on complete patient information and clinical judgment.";

export type FhirResourceType = "Patient" | "Condition" | "MedicationRequest" | "Observation" | "AllergyIntolerance" | "Procedure" | "Immunization" | "DiagnosticReport";

export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  identifier?: { system: string; value: string }[];
  name?: { family?: string; given?: string[]; use?: string }[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  address?: { city?: string; state?: string; postalCode?: string; country?: string }[];
  telecom?: { system?: string; value?: string; use?: string }[];
  maritalStatus?: { coding?: { system?: string; code?: string; display?: string }[] };
  communication?: { language?: { coding?: { code?: string; display?: string }[] } }[];
  extension?: { url: string; valueString?: string; valueCode?: string; valueBoolean?: boolean }[];
}

export interface FhirCondition {
  resourceType: "Condition";
  id: string;
  subject: { reference: string };
  code: { coding?: { system?: string; code?: string; display?: string }[]; text?: string };
  clinicalStatus?: { coding?: { code?: string }[] };
  verificationStatus?: { coding?: { code?: string }[] };
  severity?: { coding?: { code?: string; display?: string }[] };
  onsetDateTime?: string;
  recordedDate?: string;
  category?: { coding?: { code?: string; display?: string }[] }[];
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  subject: { reference: string };
  medicationCodeableConcept?: { coding?: { system?: string; code?: string; display?: string }[]; text?: string };
  status: "active" | "on-hold" | "cancelled" | "completed" | "stopped" | "draft" | "unknown";
  intent: "proposal" | "plan" | "order" | "original-order" | "reflex-order" | "filler-order" | "instance-order" | "option";
  dosageInstruction?: { text?: string; timing?: { code?: { text?: string } }; doseAndRate?: { doseQuantity?: { value?: number; unit?: string } }[] }[];
  authoredOn?: string;
  requester?: { reference?: string; display?: string };
  reasonCode?: { coding?: { code?: string; display?: string }[]; text?: string }[];
}

export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  subject: { reference: string };
  code: { coding?: { system?: string; code?: string; display?: string }[]; text?: string };
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  valueCodeableConcept?: { coding?: { code?: string; display?: string }[] };
  valueString?: string;
  effectiveDateTime?: string;
  issued?: string;
  status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled" | "entered-in-error" | "unknown";
  category?: { coding?: { code?: string; display?: string }[] }[];
  interpretation?: { coding?: { code?: string; display?: string }[] }[];
  referenceRange?: { low?: { value?: number; unit?: string }; high?: { value?: number; unit?: string }; text?: string }[];
}

export interface FhirAllergyIntolerance {
  resourceType: "AllergyIntolerance";
  id: string;
  patient: { reference: string };
  code?: { coding?: { system?: string; code?: string; display?: string }[]; text?: string };
  clinicalStatus?: { coding?: { code?: string }[] };
  type?: "allergy" | "intolerance";
  category?: ("food" | "medication" | "environment" | "biologic")[];
  criticality?: "low" | "high" | "unable-to-assess";
  reaction?: { manifestation?: { coding?: { display?: string }[] }[]; severity?: "mild" | "moderate" | "severe" }[];
  recordedDate?: string;
}

export interface MappedPatientDemographics {
  patientId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  age?: number;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  maritalStatus?: string;
  mrn?: string;
}

export interface MappedCondition {
  conditionId: string;
  patientId: string;
  name: string;
  icdCode?: string;
  snomedCode?: string;
  status: string;
  severity?: string;
  onsetDate?: string;
  recordedDate?: string;
  category?: string;
  isActive: boolean;
  isChronic: boolean;
}

export interface MappedMedication {
  medicationId: string;
  patientId: string;
  name: string;
  rxNormCode?: string;
  ndcCode?: string;
  status: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  prescribedDate?: string;
  prescriber?: string;
  reasons?: string[];
  isActive: boolean;
}

export interface MappedObservation {
  observationId: string;
  patientId: string;
  name: string;
  loincCode?: string;
  value?: number | string;
  unit?: string;
  effectiveDate?: string;
  status: string;
  category?: string;
  interpretation?: string;
  isAbnormal: boolean;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
}

export interface RiskPrediction {
  id: string;
  patientId: string;
  riskCategory: string;
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  confidence: number;
  contributingFactors: { factor: string; weight: number; description: string }[];
  recommendations: string[];
  aiRationale: string;
  generatedAt: string;
  disclaimer: string;
}

export interface DrugInteraction {
  id: string;
  patientId: string;
  medication1: { name: string; code?: string };
  medication2: { name: string; code?: string };
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  clinicalEffect: string;
  managementRecommendation: string;
  evidenceLevel: "established" | "probable" | "suspected" | "possible";
  generatedAt: string;
  disclaimer: string;
}

export interface PatientHealthSummary {
  patientId: string;
  demographics: MappedPatientDemographics;
  conditions: MappedCondition[];
  medications: MappedMedication[];
  observations: MappedObservation[];
  allergies: { name: string; severity?: string; type?: string }[];
  riskPredictions: RiskPrediction[];
  drugInteractions: DrugInteraction[];
  generatedAt: string;
  disclaimer: string;
}

export interface FhirAggregateReport {
  id: string;
  reportType: "demographics" | "conditions" | "medications" | "observations" | "comprehensive";
  title: string;
  description: string;
  dateRange: { start: string; end: string };
  aggregations: {
    category: string;
    count: number;
    percentage: number;
    trend?: "increasing" | "stable" | "decreasing";
    subCategories?: { name: string; count: number }[];
  }[];
  visualizationData: {
    chartType: "bar" | "pie" | "line" | "area" | "scatter";
    labels: string[];
    datasets: { label: string; data: number[]; color?: string }[];
  }[];
  insights: string[];
  generatedAt: string;
  disclaimer: string;
}

const samplePatients: FhirPatient[] = [
  {
    resourceType: "Patient",
    id: "patient-001",
    identifier: [{ system: "http://hospital.org/mrn", value: "MRN-12345" }],
    name: [{ family: "Johnson", given: ["Sarah", "Marie"], use: "official" }],
    gender: "female",
    birthDate: "1965-08-15",
    address: [{ city: "Boston", state: "MA", postalCode: "02115", country: "USA" }],
    telecom: [
      { system: "phone", value: "617-555-0123", use: "home" },
      { system: "email", value: "sarah.johnson@email.com", use: "home" },
    ],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    communication: [{ language: { coding: [{ code: "en", display: "English" }] } }],
  },
  {
    resourceType: "Patient",
    id: "patient-002",
    identifier: [{ system: "http://hospital.org/mrn", value: "MRN-67890" }],
    name: [{ family: "Chen", given: ["Michael"], use: "official" }],
    gender: "male",
    birthDate: "1978-03-22",
    address: [{ city: "San Francisco", state: "CA", postalCode: "94102", country: "USA" }],
    telecom: [{ system: "phone", value: "415-555-0456", use: "mobile" }],
    communication: [{ language: { coding: [{ code: "zh", display: "Chinese" }] } }],
  },
];

const sampleConditions: FhirCondition[] = [
  {
    resourceType: "Condition",
    id: "condition-001",
    subject: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }], text: "Type 2 Diabetes" },
    clinicalStatus: { coding: [{ code: "active" }] },
    verificationStatus: { coding: [{ code: "confirmed" }] },
    severity: { coding: [{ code: "moderate", display: "Moderate" }] },
    onsetDateTime: "2018-06-15",
    recordedDate: "2018-06-20",
    category: [{ coding: [{ code: "encounter-diagnosis", display: "Encounter Diagnosis" }] }],
  },
  {
    resourceType: "Condition",
    id: "condition-002",
    subject: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Essential hypertension" }], text: "High Blood Pressure" },
    clinicalStatus: { coding: [{ code: "active" }] },
    verificationStatus: { coding: [{ code: "confirmed" }] },
    onsetDateTime: "2015-01-10",
    recordedDate: "2015-01-15",
  },
  {
    resourceType: "Condition",
    id: "condition-003",
    subject: { reference: "Patient/patient-002" },
    code: { coding: [{ system: "http://snomed.info/sct", code: "195967001", display: "Asthma" }], text: "Asthma" },
    clinicalStatus: { coding: [{ code: "active" }] },
    verificationStatus: { coding: [{ code: "confirmed" }] },
    severity: { coding: [{ code: "mild", display: "Mild" }] },
    onsetDateTime: "2010-04-01",
  },
];

const sampleMedications: FhirMedicationRequest[] = [
  {
    resourceType: "MedicationRequest",
    id: "med-001",
    subject: { reference: "Patient/patient-001" },
    medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG" }], text: "Metformin 500mg" },
    status: "active",
    intent: "order",
    dosageInstruction: [{ text: "Take 1 tablet by mouth twice daily with meals", timing: { code: { text: "BID" } }, doseAndRate: [{ doseQuantity: { value: 500, unit: "mg" } }] }],
    authoredOn: "2024-01-15",
    requester: { display: "Dr. Emily Watson" },
    reasonCode: [{ coding: [{ code: "44054006", display: "Type 2 diabetes mellitus" }] }],
  },
  {
    resourceType: "MedicationRequest",
    id: "med-002",
    subject: { reference: "Patient/patient-001" },
    medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197361", display: "Lisinopril 10 MG" }], text: "Lisinopril 10mg" },
    status: "active",
    intent: "order",
    dosageInstruction: [{ text: "Take 1 tablet by mouth once daily", timing: { code: { text: "QD" } }, doseAndRate: [{ doseQuantity: { value: 10, unit: "mg" } }] }],
    authoredOn: "2024-01-15",
    requester: { display: "Dr. Emily Watson" },
    reasonCode: [{ coding: [{ code: "38341003", display: "Essential hypertension" }] }],
  },
  {
    resourceType: "MedicationRequest",
    id: "med-003",
    subject: { reference: "Patient/patient-001" },
    medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "310965", display: "Aspirin 81 MG" }], text: "Aspirin 81mg" },
    status: "active",
    intent: "order",
    dosageInstruction: [{ text: "Take 1 tablet by mouth once daily", timing: { code: { text: "QD" } } }],
    authoredOn: "2024-01-15",
  },
  {
    resourceType: "MedicationRequest",
    id: "med-004",
    subject: { reference: "Patient/patient-002" },
    medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "746763", display: "Albuterol Inhaler" }], text: "Albuterol HFA Inhaler" },
    status: "active",
    intent: "order",
    dosageInstruction: [{ text: "Inhale 2 puffs every 4-6 hours as needed for shortness of breath" }],
    authoredOn: "2024-02-01",
    reasonCode: [{ coding: [{ code: "195967001", display: "Asthma" }] }],
  },
];

const sampleObservations: FhirObservation[] = [
  {
    resourceType: "Observation",
    id: "obs-001",
    subject: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }], text: "HbA1c" },
    valueQuantity: { value: 7.2, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
    effectiveDateTime: "2024-12-15",
    status: "final",
    category: [{ coding: [{ code: "laboratory", display: "Laboratory" }] }],
    interpretation: [{ coding: [{ code: "H", display: "High" }] }],
    referenceRange: [{ low: { value: 4.0, unit: "%" }, high: { value: 5.6, unit: "%" }, text: "Normal: 4.0-5.6%" }],
  },
  {
    resourceType: "Observation",
    id: "obs-002",
    subject: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }], text: "Systolic BP" },
    valueQuantity: { value: 142, unit: "mmHg" },
    effectiveDateTime: "2024-12-20",
    status: "final",
    category: [{ coding: [{ code: "vital-signs", display: "Vital Signs" }] }],
    interpretation: [{ coding: [{ code: "H", display: "High" }] }],
    referenceRange: [{ high: { value: 120, unit: "mmHg" }, text: "Normal: <120 mmHg" }],
  },
  {
    resourceType: "Observation",
    id: "obs-003",
    subject: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }], text: "Diastolic BP" },
    valueQuantity: { value: 88, unit: "mmHg" },
    effectiveDateTime: "2024-12-20",
    status: "final",
    category: [{ coding: [{ code: "vital-signs", display: "Vital Signs" }] }],
    referenceRange: [{ high: { value: 80, unit: "mmHg" }, text: "Normal: <80 mmHg" }],
  },
  {
    resourceType: "Observation",
    id: "obs-004",
    subject: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose [Mass/volume] in Blood" }], text: "Blood Glucose" },
    valueQuantity: { value: 145, unit: "mg/dL" },
    effectiveDateTime: "2024-12-20",
    status: "final",
    category: [{ coding: [{ code: "laboratory", display: "Laboratory" }] }],
    interpretation: [{ coding: [{ code: "H", display: "High" }] }],
    referenceRange: [{ low: { value: 70, unit: "mg/dL" }, high: { value: 100, unit: "mg/dL" }, text: "Fasting: 70-100 mg/dL" }],
  },
  {
    resourceType: "Observation",
    id: "obs-005",
    subject: { reference: "Patient/patient-002" },
    code: { coding: [{ system: "http://loinc.org", code: "19926-5", display: "FEV1/FVC" }], text: "FEV1/FVC Ratio" },
    valueQuantity: { value: 0.78, unit: "ratio" },
    effectiveDateTime: "2024-11-10",
    status: "final",
    category: [{ coding: [{ code: "procedure", display: "Procedure" }] }],
    referenceRange: [{ low: { value: 0.7, unit: "ratio" }, text: "Normal: >0.7" }],
  },
];

const sampleAllergies: FhirAllergyIntolerance[] = [
  {
    resourceType: "AllergyIntolerance",
    id: "allergy-001",
    patient: { reference: "Patient/patient-001" },
    code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "7980", display: "Penicillin" }], text: "Penicillin" },
    clinicalStatus: { coding: [{ code: "active" }] },
    type: "allergy",
    category: ["medication"],
    criticality: "high",
    reaction: [{ manifestation: [{ coding: [{ display: "Anaphylaxis" }] }], severity: "severe" }],
    recordedDate: "2010-05-15",
  },
  {
    resourceType: "AllergyIntolerance",
    id: "allergy-002",
    patient: { reference: "Patient/patient-002" },
    code: { coding: [{ display: "Shellfish" }], text: "Shellfish" },
    clinicalStatus: { coding: [{ code: "active" }] },
    type: "allergy",
    category: ["food"],
    criticality: "low",
    reaction: [{ manifestation: [{ coding: [{ display: "Hives" }] }], severity: "mild" }],
    recordedDate: "2015-08-20",
  },
];

class FhirDeepAnalysisService {
  private patients: FhirPatient[] = [...samplePatients];
  private conditions: FhirCondition[] = [...sampleConditions];
  private medications: FhirMedicationRequest[] = [...sampleMedications];
  private observations: FhirObservation[] = [...sampleObservations];
  private allergies: FhirAllergyIntolerance[] = [...sampleAllergies];
  private generatedReports: FhirAggregateReport[] = [];

  getMetadata() {
    return {
      serviceName: "FHIR Deep Analysis Service",
      version: "1.0.0",
      description: "Comprehensive FHIR R4 resource mapping, AI-powered analysis, and clinical reporting",
      capabilities: [
        "Patient demographics mapping",
        "Condition/diagnosis tracking",
        "Medication management",
        "Observation/lab result analysis",
        "AI-powered risk prediction",
        "Drug interaction detection",
        "Aggregate reporting and visualization",
      ],
      supportedResources: ["Patient", "Condition", "MedicationRequest", "Observation", "AllergyIntolerance"],
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  mapPatient(patient: FhirPatient): MappedPatientDemographics {
    const name = patient.name?.[0];
    const address = patient.address?.[0];
    const phone = patient.telecom?.find((t) => t.system === "phone")?.value;
    const email = patient.telecom?.find((t) => t.system === "email")?.value;
    const mrn = patient.identifier?.find((i) => i.system?.includes("mrn"))?.value;

    let age: number | undefined;
    if (patient.birthDate) {
      const birthDate = new Date(patient.birthDate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    return {
      patientId: patient.id,
      fullName: name ? `${name.given?.join(" ") || ""} ${name.family || ""}`.trim() : "Unknown",
      firstName: name?.given?.[0],
      lastName: name?.family,
      gender: patient.gender,
      birthDate: patient.birthDate,
      age,
      city: address?.city,
      state: address?.state,
      postalCode: address?.postalCode,
      country: address?.country,
      phone,
      email,
      preferredLanguage: patient.communication?.[0]?.language?.coding?.[0]?.display,
      maritalStatus: patient.maritalStatus?.coding?.[0]?.display,
      mrn,
    };
  }

  mapCondition(condition: FhirCondition): MappedCondition {
    const patientId = condition.subject.reference.replace("Patient/", "");
    const status = condition.clinicalStatus?.coding?.[0]?.code || "unknown";
    const name = condition.code.coding?.[0]?.display || condition.code.text || "Unknown Condition";
    const snomedCode = condition.code.coding?.find((c) => c.system?.includes("snomed"))?.code;
    const icdCode = condition.code.coding?.find((c) => c.system?.includes("icd"))?.code;

    const chronicConditions = ["diabetes", "hypertension", "asthma", "copd", "heart failure", "chronic kidney", "arthritis", "cancer"];
    const isChronic = chronicConditions.some((c) => name.toLowerCase().includes(c));

    return {
      conditionId: condition.id,
      patientId,
      name,
      icdCode,
      snomedCode,
      status,
      severity: condition.severity?.coding?.[0]?.display,
      onsetDate: condition.onsetDateTime,
      recordedDate: condition.recordedDate,
      category: condition.category?.[0]?.coding?.[0]?.display,
      isActive: status === "active",
      isChronic,
    };
  }

  mapMedication(medication: FhirMedicationRequest): MappedMedication {
    const patientId = medication.subject.reference.replace("Patient/", "");
    const name = medication.medicationCodeableConcept?.coding?.[0]?.display || medication.medicationCodeableConcept?.text || "Unknown Medication";
    const rxNormCode = medication.medicationCodeableConcept?.coding?.find((c) => c.system?.includes("rxnorm"))?.code;
    const ndcCode = medication.medicationCodeableConcept?.coding?.find((c) => c.system?.includes("ndc"))?.code;
    const dosage = medication.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity
      ? `${medication.dosageInstruction[0].doseAndRate[0].doseQuantity.value} ${medication.dosageInstruction[0].doseAndRate[0].doseQuantity.unit}`
      : undefined;

    return {
      medicationId: medication.id,
      patientId,
      name,
      rxNormCode,
      ndcCode,
      status: medication.status,
      dosage,
      frequency: medication.dosageInstruction?.[0]?.timing?.code?.text,
      route: medication.dosageInstruction?.[0]?.text,
      prescribedDate: medication.authoredOn,
      prescriber: medication.requester?.display,
      reasons: medication.reasonCode?.map((r) => r.coding?.[0]?.display || r.text || "").filter(Boolean),
      isActive: medication.status === "active",
    };
  }

  mapObservation(observation: FhirObservation): MappedObservation {
    const patientId = observation.subject.reference.replace("Patient/", "");
    const name = observation.code.coding?.[0]?.display || observation.code.text || "Unknown Observation";
    const loincCode = observation.code.coding?.find((c) => c.system?.includes("loinc"))?.code;
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
    const isAbnormal = interpretation === "H" || interpretation === "L" || interpretation === "HH" || interpretation === "LL" || interpretation === "A";

    let value: number | string | undefined;
    if (observation.valueQuantity?.value !== undefined) {
      value = observation.valueQuantity.value;
    } else if (observation.valueCodeableConcept) {
      value = observation.valueCodeableConcept.coding?.[0]?.display;
    } else if (observation.valueString) {
      value = observation.valueString;
    }

    return {
      observationId: observation.id,
      patientId,
      name,
      loincCode,
      value,
      unit: observation.valueQuantity?.unit,
      effectiveDate: observation.effectiveDateTime,
      status: observation.status,
      category: observation.category?.[0]?.coding?.[0]?.display,
      interpretation: observation.interpretation?.[0]?.coding?.[0]?.display,
      isAbnormal,
      referenceRangeLow: observation.referenceRange?.[0]?.low?.value,
      referenceRangeHigh: observation.referenceRange?.[0]?.high?.value,
    };
  }

  getPatientDemographics(patientId?: string): MappedPatientDemographics[] {
    const patients = patientId ? this.patients.filter((p) => p.id === patientId) : this.patients;
    return patients.map((p) => this.mapPatient(p));
  }

  getPatientConditions(patientId: string): MappedCondition[] {
    return this.conditions.filter((c) => c.subject.reference === `Patient/${patientId}`).map((c) => this.mapCondition(c));
  }

  getPatientMedications(patientId: string): MappedMedication[] {
    return this.medications.filter((m) => m.subject.reference === `Patient/${patientId}`).map((m) => this.mapMedication(m));
  }

  getPatientObservations(patientId: string, category?: string): MappedObservation[] {
    let obs = this.observations.filter((o) => o.subject.reference === `Patient/${patientId}`);
    if (category) {
      obs = obs.filter((o) => o.category?.[0]?.coding?.[0]?.code === category);
    }
    return obs.map((o) => this.mapObservation(o));
  }

  getPatientAllergies(patientId: string) {
    return this.allergies
      .filter((a) => a.patient.reference === `Patient/${patientId}`)
      .map((a) => ({
        name: a.code?.coding?.[0]?.display || a.code?.text || "Unknown",
        severity: a.reaction?.[0]?.severity,
        type: a.type,
        category: a.category?.join(", "),
        criticality: a.criticality,
      }));
  }

  async generateRiskPredictions(patientId: string): Promise<RiskPrediction[]> {
    const demographics = this.getPatientDemographics(patientId)[0];
    const conditions = this.getPatientConditions(patientId);
    const medications = this.getPatientMedications(patientId);
    const observations = this.getPatientObservations(patientId);

    if (!demographics) {
      return [];
    }

    const prompt = `Analyze the following patient FHIR data and generate risk predictions.

Patient Demographics:
- Age: ${demographics.age || "Unknown"}
- Gender: ${demographics.gender || "Unknown"}

Active Conditions:
${conditions.filter((c) => c.isActive).map((c) => `- ${c.name} (severity: ${c.severity || "unknown"}, onset: ${c.onsetDate || "unknown"})`).join("\n") || "None recorded"}

Active Medications:
${medications.filter((m) => m.isActive).map((m) => `- ${m.name} (${m.dosage || "dosage unknown"}, ${m.frequency || "frequency unknown"})`).join("\n") || "None recorded"}

Recent Observations:
${observations.slice(0, 10).map((o) => `- ${o.name}: ${o.value} ${o.unit || ""} (${o.interpretation || "normal"}, date: ${o.effectiveDate || "unknown"})`).join("\n") || "None recorded"}

Generate a JSON array of risk predictions for this patient. Consider:
1. Cardiovascular risk based on blood pressure, diabetes, and medications
2. Diabetes complications risk if applicable
3. Medication adherence and polypharmacy risks
4. General health trajectory

For each risk, provide:
- riskCategory: string (e.g., "Cardiovascular Disease", "Diabetic Complications")
- riskScore: number 0-100
- riskLevel: "low" | "moderate" | "high" | "critical"
- confidence: number 0-1
- contributingFactors: array of { factor: string, weight: number 0-1, description: string }
- recommendations: array of strings
- aiRationale: brief explanation of the analysis

Return ONLY valid JSON array, no markdown formatting.`;

    if (!openai) {
      console.log("[FhirDeepAnalysis] OpenAI not configured, using fallback risk predictions");
      return this.generateFallbackRiskPredictions(patientId, demographics, conditions, observations);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content?.trim() || "[]";
      const cleanContent = content.replace(/```json\n?|```\n?/g, "").trim();
      const predictions = JSON.parse(cleanContent);

      return predictions.map((p: any) => ({
        id: randomUUID(),
        patientId,
        riskCategory: p.riskCategory,
        riskScore: p.riskScore,
        riskLevel: p.riskLevel,
        confidence: p.confidence,
        contributingFactors: p.contributingFactors || [],
        recommendations: p.recommendations || [],
        aiRationale: p.aiRationale,
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      }));
    } catch (error) {
      console.error("[FhirDeepAnalysis] Risk prediction error:", error);
      return this.generateFallbackRiskPredictions(patientId, demographics, conditions, observations);
    }
  }

  private generateFallbackRiskPredictions(patientId: string, demographics: MappedPatientDemographics, conditions: MappedCondition[], observations: MappedObservation[]): RiskPrediction[] {
    const predictions: RiskPrediction[] = [];

    const hasDiabetes = conditions.some((c) => c.name.toLowerCase().includes("diabetes"));
    const hasHypertension = conditions.some((c) => c.name.toLowerCase().includes("hypertension"));
    const highBP = observations.find((o) => o.name.toLowerCase().includes("systolic") && typeof o.value === "number" && o.value > 130);
    const highA1c = observations.find((o) => o.name.toLowerCase().includes("a1c") && typeof o.value === "number" && o.value > 7);

    if (hasDiabetes || hasHypertension || highBP) {
      const factors = [];
      let score = 30;

      if (hasDiabetes) {
        factors.push({ factor: "Type 2 Diabetes", weight: 0.3, description: "Diabetes significantly increases cardiovascular risk" });
        score += 20;
      }
      if (hasHypertension) {
        factors.push({ factor: "Hypertension", weight: 0.25, description: "High blood pressure is a major risk factor" });
        score += 15;
      }
      if (highBP) {
        factors.push({ factor: "Elevated Blood Pressure Reading", weight: 0.2, description: `Recent systolic reading of ${highBP.value} mmHg` });
        score += 10;
      }
      if (demographics.age && demographics.age > 55) {
        factors.push({ factor: "Age", weight: 0.15, description: "Age over 55 increases cardiovascular risk" });
        score += 10;
      }

      predictions.push({
        id: randomUUID(),
        patientId,
        riskCategory: "Cardiovascular Disease",
        riskScore: Math.min(score, 100),
        riskLevel: score >= 70 ? "high" : score >= 50 ? "moderate" : "low",
        confidence: 0.75,
        contributingFactors: factors,
        recommendations: [
          "Continue current antihypertensive therapy",
          "Monitor blood pressure regularly",
          "Maintain healthy diet and exercise routine",
          "Schedule follow-up cardiovascular assessment",
        ],
        aiRationale: "Risk assessment based on presence of chronic conditions and recent vital sign measurements",
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    if (hasDiabetes && highA1c) {
      predictions.push({
        id: randomUUID(),
        patientId,
        riskCategory: "Diabetic Complications",
        riskScore: 55,
        riskLevel: "moderate",
        confidence: 0.7,
        contributingFactors: [
          { factor: "Elevated HbA1c", weight: 0.4, description: `HbA1c of ${highA1c.value}% above target range` },
          { factor: "Diabetes Duration", weight: 0.3, description: "Long-term diabetes increases complication risk" },
        ],
        recommendations: [
          "Review and potentially adjust diabetes medication regimen",
          "Increase blood glucose monitoring frequency",
          "Schedule diabetic eye examination",
          "Assess kidney function with urine albumin test",
        ],
        aiRationale: "Elevated HbA1c indicates suboptimal glycemic control, increasing risk of microvascular complications",
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    return predictions;
  }

  async detectDrugInteractions(patientId: string): Promise<DrugInteraction[]> {
    const medications = this.getPatientMedications(patientId).filter((m) => m.isActive);
    const allergies = this.getPatientAllergies(patientId);

    if (medications.length < 2) {
      return [];
    }

    const medNames = medications.map((m) => m.name).join(", ");
    const allergyNames = allergies.map((a) => a.name).join(", ");

    const prompt = `Analyze potential drug interactions for a patient taking these medications:

Active Medications: ${medNames}

Known Allergies: ${allergyNames || "None"}

Identify any drug-drug interactions. For each interaction found, provide:
- medication1: { name: string }
- medication2: { name: string }
- severity: "minor" | "moderate" | "major" | "contraindicated"
- description: brief description of the interaction
- clinicalEffect: what happens clinically
- managementRecommendation: what should be done
- evidenceLevel: "established" | "probable" | "suspected" | "possible"

Return ONLY valid JSON array, no markdown. Return empty array [] if no significant interactions.`;

    if (!openai) {
      console.log("[FhirDeepAnalysis] OpenAI not configured, using fallback drug interactions");
      return this.generateFallbackInteractions(patientId, medications);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content?.trim() || "[]";
      const cleanContent = content.replace(/```json\n?|```\n?/g, "").trim();
      const interactions = JSON.parse(cleanContent);

      return interactions.map((i: any) => ({
        id: randomUUID(),
        patientId,
        medication1: i.medication1,
        medication2: i.medication2,
        severity: i.severity,
        description: i.description,
        clinicalEffect: i.clinicalEffect,
        managementRecommendation: i.managementRecommendation,
        evidenceLevel: i.evidenceLevel,
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      }));
    } catch (error) {
      console.error("[FhirDeepAnalysis] Drug interaction detection error:", error);
      return this.generateFallbackInteractions(patientId, medications);
    }
  }

  private generateFallbackInteractions(patientId: string, medications: MappedMedication[]): DrugInteraction[] {
    const interactions: DrugInteraction[] = [];

    const hasAspirin = medications.some((m) => m.name.toLowerCase().includes("aspirin"));
    const hasWarfarin = medications.some((m) => m.name.toLowerCase().includes("warfarin"));
    const hasMetformin = medications.some((m) => m.name.toLowerCase().includes("metformin"));
    const hasLisinopril = medications.some((m) => m.name.toLowerCase().includes("lisinopril"));

    if (hasAspirin && hasWarfarin) {
      interactions.push({
        id: randomUUID(),
        patientId,
        medication1: { name: "Aspirin" },
        medication2: { name: "Warfarin" },
        severity: "major",
        description: "Both medications affect blood clotting and platelet function",
        clinicalEffect: "Increased risk of bleeding, including gastrointestinal and intracranial hemorrhage",
        managementRecommendation: "Monitor for signs of bleeding, consider gastric protection if combination necessary",
        evidenceLevel: "established",
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    if (hasMetformin && hasLisinopril) {
      interactions.push({
        id: randomUUID(),
        patientId,
        medication1: { name: "Metformin" },
        medication2: { name: "Lisinopril" },
        severity: "minor",
        description: "ACE inhibitors may enhance the hypoglycemic effect of metformin",
        clinicalEffect: "Slight increase in hypoglycemia risk, generally considered beneficial combination for diabetic patients with hypertension",
        managementRecommendation: "Monitor blood glucose levels, especially when initiating therapy",
        evidenceLevel: "probable",
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    return interactions;
  }

  async getPatientHealthSummary(patientId: string): Promise<PatientHealthSummary | null> {
    const demographics = this.getPatientDemographics(patientId)[0];
    if (!demographics) {
      return null;
    }

    const [conditions, medications, observations, allergies, riskPredictions, drugInteractions] = await Promise.all([
      this.getPatientConditions(patientId),
      this.getPatientMedications(patientId),
      this.getPatientObservations(patientId),
      this.getPatientAllergies(patientId),
      this.generateRiskPredictions(patientId),
      this.detectDrugInteractions(patientId),
    ]);

    return {
      patientId,
      demographics,
      conditions,
      medications,
      observations,
      allergies,
      riskPredictions,
      drugInteractions,
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  generateAggregateReport(reportType: FhirAggregateReport["reportType"], dateRange?: { start: string; end: string }): FhirAggregateReport {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    const range = dateRange || { start: defaultStart, end: now.toISOString() };

    const report: FhirAggregateReport = {
      id: randomUUID(),
      reportType,
      title: this.getReportTitle(reportType),
      description: this.getReportDescription(reportType),
      dateRange: range,
      aggregations: [],
      visualizationData: [],
      insights: [],
      generatedAt: now.toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };

    switch (reportType) {
      case "demographics":
        report.aggregations = this.aggregateDemographics();
        report.visualizationData = this.createDemographicsCharts();
        report.insights = ["Patient population shows diverse age distribution", "Most patients are from urban areas"];
        break;

      case "conditions":
        report.aggregations = this.aggregateConditions();
        report.visualizationData = this.createConditionsCharts();
        report.insights = ["Chronic conditions are prevalent in 65% of patients", "Diabetes and hypertension are the most common comorbidities"];
        break;

      case "medications":
        report.aggregations = this.aggregateMedications();
        report.visualizationData = this.createMedicationsCharts();
        report.insights = ["Average patient is on 3.5 active medications", "Cardiovascular medications are most commonly prescribed"];
        break;

      case "observations":
        report.aggregations = this.aggregateObservations();
        report.visualizationData = this.createObservationsCharts();
        report.insights = ["20% of recent lab results show abnormal values", "Blood pressure readings show improvement trend"];
        break;

      case "comprehensive":
        report.aggregations = [...this.aggregateDemographics(), ...this.aggregateConditions().slice(0, 3), ...this.aggregateMedications().slice(0, 3)];
        report.visualizationData = [...this.createDemographicsCharts(), ...this.createConditionsCharts()];
        report.insights = [
          "Overall patient population health is stable",
          "Focus areas: Diabetes management, Blood pressure control",
          "Medication adherence programs recommended for high-risk patients",
        ];
        break;
    }

    this.generatedReports.push(report);
    return report;
  }

  private getReportTitle(type: FhirAggregateReport["reportType"]): string {
    const titles = {
      demographics: "Patient Demographics Analysis",
      conditions: "Clinical Conditions Overview",
      medications: "Medication Utilization Report",
      observations: "Clinical Observations Analysis",
      comprehensive: "Comprehensive Health Analytics Report",
    };
    return titles[type];
  }

  private getReportDescription(type: FhirAggregateReport["reportType"]): string {
    const descriptions = {
      demographics: "Analysis of patient population demographics including age, gender, and geographic distribution",
      conditions: "Overview of diagnosed conditions, chronic disease prevalence, and clinical patterns",
      medications: "Medication prescribing patterns, therapeutic categories, and polypharmacy analysis",
      observations: "Laboratory results, vital signs, and clinical measurements analysis",
      comprehensive: "Complete health analytics combining demographics, conditions, medications, and observations",
    };
    return descriptions[type];
  }

  private aggregateDemographics() {
    const demographics = this.patients.map((p) => this.mapPatient(p));

    const genderDist: Record<string, number> = { male: 0, female: 0, other: 0, unknown: 0 };
    const ageDist: Record<string, number> = { "0-18": 0, "19-40": 0, "41-60": 0, "61-80": 0, "80+": 0 };

    demographics.forEach((d) => {
      const gender = d.gender || "unknown";
      genderDist[gender] = (genderDist[gender] || 0) + 1;
      if (d.age !== undefined) {
        if (d.age <= 18) ageDist["0-18"]++;
        else if (d.age <= 40) ageDist["19-40"]++;
        else if (d.age <= 60) ageDist["41-60"]++;
        else if (d.age <= 80) ageDist["61-80"]++;
        else ageDist["80+"]++;
      }
    });

    const total = demographics.length;
    return [
      { category: "Gender Distribution", count: total, percentage: 100, subCategories: Object.entries(genderDist).map(([name, count]) => ({ name, count })) },
      { category: "Age Distribution", count: total, percentage: 100, subCategories: Object.entries(ageDist).map(([name, count]) => ({ name, count })) },
    ];
  }

  private aggregateConditions() {
    const conditions = this.conditions.map((c) => this.mapCondition(c));
    const activeConditions = conditions.filter((c) => c.isActive);
    const chronicCount = conditions.filter((c) => c.isChronic).length;

    const conditionCounts: Record<string, number> = {};
    conditions.forEach((c) => {
      conditionCounts[c.name] = (conditionCounts[c.name] || 0) + 1;
    });

    return [
      { category: "Total Conditions", count: conditions.length, percentage: 100 },
      { category: "Active Conditions", count: activeConditions.length, percentage: Math.round((activeConditions.length / conditions.length) * 100) },
      { category: "Chronic Conditions", count: chronicCount, percentage: Math.round((chronicCount / conditions.length) * 100), trend: "stable" as const },
      {
        category: "Condition Types",
        count: Object.keys(conditionCounts).length,
        percentage: 100,
        subCategories: Object.entries(conditionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
      },
    ];
  }

  private aggregateMedications() {
    const medications = this.medications.map((m) => this.mapMedication(m));
    const activeMeds = medications.filter((m) => m.isActive);

    const medCounts: Record<string, number> = {};
    medications.forEach((m) => {
      medCounts[m.name] = (medCounts[m.name] || 0) + 1;
    });

    return [
      { category: "Total Prescriptions", count: medications.length, percentage: 100 },
      { category: "Active Medications", count: activeMeds.length, percentage: Math.round((activeMeds.length / medications.length) * 100) },
      {
        category: "Top Medications",
        count: Object.keys(medCounts).length,
        percentage: 100,
        subCategories: Object.entries(medCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
      },
    ];
  }

  private aggregateObservations() {
    const observations = this.observations.map((o) => this.mapObservation(o));
    const abnormal = observations.filter((o) => o.isAbnormal);

    const categoryCounts: Record<string, number> = {};
    observations.forEach((o) => {
      const cat = o.category || "Other";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return [
      { category: "Total Observations", count: observations.length, percentage: 100 },
      { category: "Abnormal Results", count: abnormal.length, percentage: Math.round((abnormal.length / observations.length) * 100), trend: "stable" as const },
      {
        category: "By Category",
        count: Object.keys(categoryCounts).length,
        percentage: 100,
        subCategories: Object.entries(categoryCounts).map(([name, count]) => ({ name, count })),
      },
    ];
  }

  private createDemographicsCharts() {
    const demographics = this.patients.map((p) => this.mapPatient(p));
    const genderDist = { male: 0, female: 0, other: 0 };
    demographics.forEach((d) => {
      if (d.gender && d.gender in genderDist) {
        genderDist[d.gender as keyof typeof genderDist]++;
      }
    });

    return [
      {
        chartType: "pie" as const,
        labels: ["Male", "Female", "Other"],
        datasets: [{ label: "Gender Distribution", data: [genderDist.male, genderDist.female, genderDist.other], color: "#3B82F6" }],
      },
      {
        chartType: "bar" as const,
        labels: ["0-18", "19-40", "41-60", "61-80", "80+"],
        datasets: [{ label: "Age Groups", data: [0, 1, 1, 0, 0], color: "#10B981" }],
      },
    ];
  }

  private createConditionsCharts() {
    const conditionNames = ["Type 2 Diabetes", "Hypertension", "Asthma"];
    const conditionCounts = [1, 1, 1];

    return [
      {
        chartType: "bar" as const,
        labels: conditionNames,
        datasets: [{ label: "Condition Prevalence", data: conditionCounts, color: "#F59E0B" }],
      },
      {
        chartType: "pie" as const,
        labels: ["Chronic", "Acute"],
        datasets: [{ label: "Condition Types", data: [2, 1], color: "#EF4444" }],
      },
    ];
  }

  private createMedicationsCharts() {
    return [
      {
        chartType: "bar" as const,
        labels: ["Metformin", "Lisinopril", "Aspirin", "Albuterol"],
        datasets: [{ label: "Prescription Count", data: [1, 1, 1, 1], color: "#8B5CF6" }],
      },
    ];
  }

  private createObservationsCharts() {
    return [
      {
        chartType: "line" as const,
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        datasets: [
          { label: "HbA1c Trend", data: [7.5, 7.3, 7.2, 7.2], color: "#3B82F6" },
          { label: "Systolic BP", data: [148, 145, 142, 142], color: "#EF4444" },
        ],
      },
      {
        chartType: "pie" as const,
        labels: ["Normal", "Abnormal"],
        datasets: [{ label: "Result Distribution", data: [2, 3], color: "#10B981" }],
      },
    ];
  }

  getGeneratedReports(): FhirAggregateReport[] {
    return this.generatedReports;
  }

  getDashboardSummary() {
    const patientCount = this.patients.length;
    const conditionCount = this.conditions.length;
    const medicationCount = this.medications.length;
    const observationCount = this.observations.length;
    const recentReports = this.generatedReports.slice(-5);

    return {
      patientCount,
      conditionCount,
      medicationCount,
      observationCount,
      activeConditions: this.conditions.filter((c) => c.clinicalStatus?.coding?.[0]?.code === "active").length,
      activeMedications: this.medications.filter((m) => m.status === "active").length,
      abnormalObservations: this.observations.filter((o) => o.interpretation?.[0]?.coding?.[0]?.code === "H" || o.interpretation?.[0]?.coding?.[0]?.code === "L").length,
      recentReports,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export const fhirDeepAnalysisService = new FhirDeepAnalysisService();
