import { storage } from "../storage";
import type { InsertHealthRecord, InsertUser } from "@shared/schema";
import { NMN_MARKER } from "../mpi/patient-matching-service";

export interface SyntheaPatient {
  id: string;
  name: {
    given: string[];
    family: string;
    prefix?: string[];
    suffix?: string[];
  };
  birthDate: string;
  gender: string;
  address: {
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  telecom: {
    system: string;
    value: string;
    use?: string;
  }[];
  identifier: {
    system: string;
    value: string;
  }[];
  maritalStatus?: string;
  race?: string;
  ethnicity?: string;
}

export interface SyntheaCondition {
  id: string;
  code: {
    coding: { system: string; code: string; display: string }[];
  };
  clinicalStatus: string;
  onsetDateTime?: string;
  abatementDateTime?: string;
}

export interface SyntheaMedication {
  id: string;
  medicationCodeableConcept: {
    coding: { system: string; code: string; display: string }[];
  };
  status: string;
  authoredOn?: string;
  dosageInstruction?: { text: string }[];
}

export interface SyntheaObservation {
  id: string;
  code: {
    coding: { system: string; code: string; display: string }[];
  };
  effectiveDateTime: string;
  valueQuantity?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  category?: { coding: { code: string }[] }[];
}

export interface SyntheaBundle {
  resourceType: "Bundle";
  type: "collection";
  entry: Array<{
    resource: any;
  }>;
}

const FIRST_NAMES_MALE = [
  "James", "Michael", "Robert", "David", "William", "Richard", "Joseph", "Thomas", "Christopher", "Charles",
  "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth",
];

const FIRST_NAMES_FEMALE = [
  "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan", "Jessica", "Sarah", "Karen",
  "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
];

const MIDDLE_NAMES = [
  "Lee", "Marie", "Ann", "Lynn", "Rose", "Jean", "Grace", "Mae", "Elizabeth", "James",
  "Michael", "William", "Robert", "Joseph", "David", NMN_MARKER, NMN_MARKER, NMN_MARKER,
];

const STREET_NAMES = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine St", "Elm Rd", "Washington Ave",
  "Park Blvd", "Lake Dr", "Forest Way", "River Rd", "Hill St", "Valley Dr", "Sunset Blvd",
];

const CITIES = [
  "Springfield", "Franklin", "Clinton", "Madison", "Georgetown", "Salem", "Fairview",
  "Bristol", "Oakland", "Arlington", "Burlington", "Manchester", "Milton", "Newport",
];

const STATES = ["MA", "NY", "CA", "TX", "FL", "PA", "IL", "OH", "GA", "NC", "MI", "NJ", "VA", "WA"];

const CONDITIONS = [
  { code: "38341003", display: "Hypertensive disorder", system: "http://snomed.info/sct" },
  { code: "44054006", display: "Diabetes mellitus type 2", system: "http://snomed.info/sct" },
  { code: "195662009", display: "Acute viral pharyngitis", system: "http://snomed.info/sct" },
  { code: "386661006", display: "Fever", system: "http://snomed.info/sct" },
  { code: "40055000", display: "Chronic sinusitis", system: "http://snomed.info/sct" },
  { code: "233604007", display: "Pneumonia", system: "http://snomed.info/sct" },
  { code: "64859006", display: "Osteoporosis", system: "http://snomed.info/sct" },
  { code: "367498001", display: "Seasonal allergic rhinitis", system: "http://snomed.info/sct" },
];

const MEDICATIONS = [
  { code: "314076", display: "Lisinopril 10 MG Oral Tablet", system: "http://www.nlm.nih.gov/research/umls/rxnorm" },
  { code: "860975", display: "Metformin hydrochloride 500 MG Oral Tablet", system: "http://www.nlm.nih.gov/research/umls/rxnorm" },
  { code: "213169", display: "Acetaminophen 325 MG Oral Tablet", system: "http://www.nlm.nih.gov/research/umls/rxnorm" },
  { code: "198240", display: "Ibuprofen 200 MG Oral Tablet", system: "http://www.nlm.nih.gov/research/umls/rxnorm" },
  { code: "308136", display: "Amoxicillin 500 MG Oral Capsule", system: "http://www.nlm.nih.gov/research/umls/rxnorm" },
  { code: "310798", display: "Atorvastatin 20 MG Oral Tablet", system: "http://www.nlm.nih.gov/research/umls/rxnorm" },
];

const VITAL_SIGNS = [
  { code: "8867-4", display: "Heart rate", unit: "/min", min: 60, max: 100, system: "http://loinc.org" },
  { code: "8310-5", display: "Body temperature", unit: "Cel", min: 36.1, max: 37.8, system: "http://loinc.org" },
  { code: "8480-6", display: "Systolic blood pressure", unit: "mmHg", min: 100, max: 140, system: "http://loinc.org" },
  { code: "8462-4", display: "Diastolic blood pressure", unit: "mmHg", min: 60, max: 90, system: "http://loinc.org" },
  { code: "9279-1", display: "Respiratory rate", unit: "/min", min: 12, max: 20, system: "http://loinc.org" },
  { code: "2708-6", display: "Oxygen saturation", unit: "%", min: 95, max: 100, system: "http://loinc.org" },
  { code: "29463-7", display: "Body weight", unit: "kg", min: 50, max: 100, system: "http://loinc.org" },
  { code: "8302-2", display: "Body height", unit: "cm", min: 150, max: 190, system: "http://loinc.org" },
];

const LAB_RESULTS = [
  { code: "2339-0", display: "Glucose", unit: "mg/dL", min: 70, max: 200, system: "http://loinc.org" },
  { code: "2571-8", display: "Triglycerides", unit: "mg/dL", min: 50, max: 300, system: "http://loinc.org" },
  { code: "2093-3", display: "Total Cholesterol", unit: "mg/dL", min: 150, max: 280, system: "http://loinc.org" },
  { code: "718-7", display: "Hemoglobin", unit: "g/dL", min: 12, max: 17, system: "http://loinc.org" },
  { code: "6299-2", display: "Blood urea nitrogen", unit: "mg/dL", min: 7, max: 25, system: "http://loinc.org" },
  { code: "2160-0", display: "Creatinine", unit: "mg/dL", min: 0.6, max: 1.4, system: "http://loinc.org" },
];

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateSSN(): string {
  const area = randomInt(100, 899);
  const group = randomInt(10, 99);
  const serial = randomInt(1000, 9999);
  return `${area}-${group}-${serial}`;
}

function generatePhoneNumber(): string {
  const area = randomInt(200, 999);
  const exchange = randomInt(200, 999);
  const subscriber = randomInt(1000, 9999);
  return `(${area}) ${exchange}-${subscriber}`;
}

function generateMRN(): string {
  return `MRN${randomInt(100000, 999999)}`;
}

export function generateSyntheaPatient(): SyntheaPatient {
  const gender = Math.random() > 0.5 ? "male" : "female";
  const firstName = randomFromArray(gender === "male" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
  const lastName = randomFromArray(LAST_NAMES);
  const middleName = randomFromArray(MIDDLE_NAMES);
  const birthDate = randomDate(1940, 2010);
  const state = randomFromArray(STATES);

  const givenNames = middleName === NMN_MARKER ? [firstName] : [firstName, middleName];

  return {
    id: crypto.randomUUID(),
    name: {
      given: givenNames,
      family: lastName,
    },
    birthDate: birthDate.toISOString().split("T")[0],
    gender,
    address: {
      line: [`${randomInt(100, 9999)} ${randomFromArray(STREET_NAMES)}`],
      city: randomFromArray(CITIES),
      state,
      postalCode: `${randomInt(10000, 99999)}`,
      country: "US",
    },
    telecom: [
      { system: "phone", value: generatePhoneNumber(), use: "home" },
      { system: "email", value: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` },
    ],
    identifier: [
      { system: "http://hospital.org/mrn", value: generateMRN() },
      { system: "http://hl7.org/fhir/sid/us-ssn", value: generateSSN() },
    ],
    maritalStatus: randomFromArray(["S", "M", "D", "W"]),
    race: randomFromArray(["white", "black", "asian", "native", "other"]),
    ethnicity: randomFromArray(["hispanic", "non-hispanic"]),
  };
}

export function generateConditions(patientId: string, count: number = 3): SyntheaCondition[] {
  const conditions: SyntheaCondition[] = [];
  const usedCodes = new Set<string>();

  for (let i = 0; i < count; i++) {
    let condition = randomFromArray(CONDITIONS);
    while (usedCodes.has(condition.code)) {
      condition = randomFromArray(CONDITIONS);
    }
    usedCodes.add(condition.code);

    const onsetDate = randomDate(2015, 2024);
    const isResolved = Math.random() > 0.6;

    conditions.push({
      id: crypto.randomUUID(),
      code: {
        coding: [{ system: condition.system, code: condition.code, display: condition.display }],
      },
      clinicalStatus: isResolved ? "resolved" : "active",
      onsetDateTime: onsetDate.toISOString(),
      abatementDateTime: isResolved
        ? new Date(onsetDate.getTime() + randomInt(30, 365) * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    });
  }

  return conditions;
}

export function generateMedications(patientId: string, count: number = 2): SyntheaMedication[] {
  const medications: SyntheaMedication[] = [];
  const usedCodes = new Set<string>();

  for (let i = 0; i < count; i++) {
    let med = randomFromArray(MEDICATIONS);
    while (usedCodes.has(med.code)) {
      med = randomFromArray(MEDICATIONS);
    }
    usedCodes.add(med.code);

    medications.push({
      id: crypto.randomUUID(),
      medicationCodeableConcept: {
        coding: [{ system: med.system, code: med.code, display: med.display }],
      },
      status: randomFromArray(["active", "completed", "stopped"]),
      authoredOn: randomDate(2020, 2024).toISOString(),
      dosageInstruction: [{ text: `Take ${randomInt(1, 2)} tablet(s) ${randomFromArray(["daily", "twice daily", "as needed"])}` }],
    });
  }

  return medications;
}

export function generateVitalSigns(patientId: string, count: number = 10): SyntheaObservation[] {
  const observations: SyntheaObservation[] = [];

  for (let i = 0; i < count; i++) {
    const vital = randomFromArray(VITAL_SIGNS);
    const effectiveDate = randomDate(2023, 2024);

    observations.push({
      id: crypto.randomUUID(),
      code: {
        coding: [{ system: vital.system, code: vital.code, display: vital.display }],
      },
      effectiveDateTime: effectiveDate.toISOString(),
      valueQuantity: {
        value: randomFloat(vital.min, vital.max),
        unit: vital.unit,
        system: "http://unitsofmeasure.org",
        code: vital.unit,
      },
      category: [{ coding: [{ code: "vital-signs" }] }],
    });
  }

  return observations;
}

export function generateLabResults(patientId: string, count: number = 5): SyntheaObservation[] {
  const observations: SyntheaObservation[] = [];

  for (let i = 0; i < count; i++) {
    const lab = randomFromArray(LAB_RESULTS);
    const effectiveDate = randomDate(2023, 2024);

    observations.push({
      id: crypto.randomUUID(),
      code: {
        coding: [{ system: lab.system, code: lab.code, display: lab.display }],
      },
      effectiveDateTime: effectiveDate.toISOString(),
      valueQuantity: {
        value: randomFloat(lab.min, lab.max),
        unit: lab.unit,
        system: "http://unitsofmeasure.org",
        code: lab.unit,
      },
      category: [{ coding: [{ code: "laboratory" }] }],
    });
  }

  return observations;
}

export function generateSyntheaBundle(patientCount: number = 1): SyntheaBundle {
  const entries: Array<{ resource: any }> = [];

  for (let i = 0; i < patientCount; i++) {
    const patient = generateSyntheaPatient();
    entries.push({ resource: { resourceType: "Patient", ...patient } });

    const conditions = generateConditions(patient.id, randomInt(1, 4));
    conditions.forEach((c) =>
      entries.push({
        resource: {
          resourceType: "Condition",
          subject: { reference: `Patient/${patient.id}` },
          ...c,
        },
      })
    );

    const medications = generateMedications(patient.id, randomInt(1, 3));
    medications.forEach((m) =>
      entries.push({
        resource: {
          resourceType: "MedicationRequest",
          subject: { reference: `Patient/${patient.id}` },
          ...m,
        },
      })
    );

    const vitals = generateVitalSigns(patient.id, randomInt(5, 15));
    vitals.forEach((v) =>
      entries.push({
        resource: {
          resourceType: "Observation",
          subject: { reference: `Patient/${patient.id}` },
          ...v,
        },
      })
    );

    const labs = generateLabResults(patient.id, randomInt(3, 8));
    labs.forEach((l) =>
      entries.push({
        resource: {
          resourceType: "Observation",
          subject: { reference: `Patient/${patient.id}` },
          ...l,
        },
      })
    );
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entries,
  };
}

export async function importSyntheaPatientToDatabase(
  userId: string,
  bundle: SyntheaBundle
): Promise<{ imported: number; errors: number }> {
  let imported = 0;
  let errors = 0;

  const syntheaSourceId = "synthea-synthetic-data";

  for (const entry of bundle.entry) {
    const resource = entry.resource;

    try {
      let healthRecord: InsertHealthRecord | null = null;

      switch (resource.resourceType) {
        case "Condition":
          healthRecord = {
            userId,
            sourceId: syntheaSourceId,
            type: "condition",
            title: resource.code?.coding?.[0]?.display || "Unknown Condition",
            summary: `Status: ${resource.clinicalStatus}`,
            date: resource.onsetDateTime ? new Date(resource.onsetDateTime) : new Date(),
            provider: "Synthea Synthetic Data",
            details: resource,
            isManual: false,
          };
          break;

        case "MedicationRequest":
          healthRecord = {
            userId,
            sourceId: syntheaSourceId,
            type: "medication",
            title: resource.medicationCodeableConcept?.coding?.[0]?.display || "Unknown Medication",
            summary: `Status: ${resource.status}. ${resource.dosageInstruction?.[0]?.text || ""}`,
            date: resource.authoredOn ? new Date(resource.authoredOn) : new Date(),
            provider: "Synthea Synthetic Data",
            details: resource,
            isManual: false,
          };
          break;

        case "Observation":
          const category = resource.category?.[0]?.coding?.[0]?.code;
          healthRecord = {
            userId,
            sourceId: syntheaSourceId,
            type: category === "vital-signs" ? "vital" : "lab",
            title: resource.code?.coding?.[0]?.display || "Unknown Observation",
            summary: resource.valueQuantity
              ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit}`
              : resource.valueString || "",
            date: resource.effectiveDateTime ? new Date(resource.effectiveDateTime) : new Date(),
            provider: "Synthea Synthetic Data",
            details: resource,
            isManual: false,
          };
          break;
      }

      if (healthRecord) {
        await storage.createHealthRecord(healthRecord);
        imported++;
      }
    } catch (e) {
      errors++;
    }
  }

  return { imported, errors };
}

export class SyntheaGenerator {
  generatePatient(): SyntheaPatient {
    return generateSyntheaPatient();
  }

  generateBundle(patientCount: number): SyntheaBundle {
    return generateSyntheaBundle(patientCount);
  }

  async importToDatabase(userId: string, patientCount: number = 1): Promise<{
    imported: number;
    errors: number;
  }> {
    const bundle = generateSyntheaBundle(patientCount);
    return importSyntheaPatientToDatabase(userId, bundle);
  }
}

export const syntheaGenerator = new SyntheaGenerator();
