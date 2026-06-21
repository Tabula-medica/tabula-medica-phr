/**
 * Synthea™ Synthetic Patient Data Generator Service
 * 
 * Generates high-quality, synthetic, realistic (but fake) patient records
 * for compliance testing, including:
 * - Medical history
 * - Medications
 * - Social determinants of health
 * - Lab results
 * - Conditions and procedures
 * 
 * Uses FHIR R4 format for compatibility with healthcare systems.
 * NO-CDS compliant - all data is clearly marked as synthetic.
 */

import { v4 as uuidv4 } from "uuid";

interface SyntheticPatient {
  id: string;
  resourceType: "Patient";
  meta: {
    profile: string[];
    tag: { system: string; code: string; display: string }[];
  };
  identifier: { system: string; value: string; type: { text: string } }[];
  name: { use: string; family: string; given: string[]; prefix?: string[] }[];
  gender: "male" | "female" | "other";
  birthDate: string;
  address: {
    use: string;
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }[];
  telecom: { system: string; value: string; use: string }[];
  maritalStatus?: { coding: { system: string; code: string; display: string }[] };
  communication?: { language: { coding: { system: string; code: string; display: string }[] } }[];
  extension?: { url: string; valueCodeableConcept?: { coding: { system: string; code: string; display: string }[] }; valueString?: string }[];
}

interface SyntheticCondition {
  id: string;
  resourceType: "Condition";
  meta: { tag: { system: string; code: string; display: string }[] };
  clinicalStatus: { coding: { system: string; code: string }[] };
  verificationStatus: { coding: { system: string; code: string }[] };
  category: { coding: { system: string; code: string; display: string }[] }[];
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  subject: { reference: string };
  onsetDateTime: string;
  recordedDate: string;
}

interface SyntheticMedication {
  id: string;
  resourceType: "MedicationRequest";
  meta: { tag: { system: string; code: string; display: string }[] };
  status: string;
  intent: string;
  medicationCodeableConcept: { coding: { system: string; code: string; display: string }[]; text: string };
  subject: { reference: string };
  authoredOn: string;
  dosageInstruction: { text: string; timing?: { repeat: { frequency: number; period: number; periodUnit: string } }; doseAndRate?: { doseQuantity: { value: number; unit: string } }[] }[];
}

interface SyntheticObservation {
  id: string;
  resourceType: "Observation";
  meta: { tag: { system: string; code: string; display: string }[] };
  status: string;
  category: { coding: { system: string; code: string; display: string }[] }[];
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  subject: { reference: string };
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  valueCodeableConcept?: { coding: { system: string; code: string; display: string }[] };
}

interface SyntheticBundle {
  id: string;
  resourceType: "Bundle";
  type: "collection";
  meta: { 
    tag: { system: string; code: string; display: string }[];
    lastUpdated: string;
  };
  entry: { fullUrl: string; resource: any }[];
  total: number;
}

interface GenerationConfig {
  count: number;
  ageRange?: { min: number; max: number };
  genderDistribution?: { male: number; female: number; other: number };
  includeConditions?: boolean;
  includeMedications?: boolean;
  includeObservations?: boolean;
  includeSocialDeterminants?: boolean;
  state?: string;
  seed?: number;
}

// Sample data pools for synthetic generation
const FIRST_NAMES_MALE = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua"];
const FIRST_NAMES_FEMALE = ["Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];
const STREET_NAMES = ["Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd", "Elm Blvd", "Washington St", "Park Ave", "Lake View Dr", "Highland Rd"];
const CITIES_BY_STATE: Record<string, string[]> = {
  "CA": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "Oakland"],
  "NY": ["New York", "Buffalo", "Rochester", "Syracuse", "Albany"],
  "TX": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
  "FL": ["Miami", "Orlando", "Tampa", "Jacksonville", "St. Petersburg"],
  "MA": ["Boston", "Cambridge", "Worcester", "Springfield", "Lowell"],
};
const STATES = ["CA", "NY", "TX", "FL", "MA", "IL", "PA", "OH", "GA", "NC"];

// Common conditions with SNOMED codes
const CONDITIONS = [
  { code: "44054006", display: "Type 2 Diabetes Mellitus", text: "Diabetes Type 2" },
  { code: "38341003", display: "Hypertensive disorder", text: "Hypertension" },
  { code: "13645005", display: "Chronic obstructive pulmonary disease", text: "COPD" },
  { code: "195967001", display: "Asthma", text: "Asthma" },
  { code: "53741008", display: "Coronary arteriosclerosis", text: "Coronary Artery Disease" },
  { code: "73211009", display: "Diabetes mellitus", text: "Diabetes" },
  { code: "35489007", display: "Depressive disorder", text: "Depression" },
  { code: "197480006", display: "Anxiety disorder", text: "Anxiety" },
  { code: "267432004", display: "Pure hypercholesterolemia", text: "High Cholesterol" },
  { code: "414545008", display: "Ischemic heart disease", text: "Heart Disease" },
];

// Common medications with RxNorm codes
const MEDICATIONS = [
  { code: "860975", display: "Metformin 500 MG", dose: 500, unit: "mg", frequency: 2 },
  { code: "197884", display: "Lisinopril 10 MG", dose: 10, unit: "mg", frequency: 1 },
  { code: "310965", display: "Atorvastatin 20 MG", dose: 20, unit: "mg", frequency: 1 },
  { code: "313782", display: "Amlodipine 5 MG", dose: 5, unit: "mg", frequency: 1 },
  { code: "308136", display: "Omeprazole 20 MG", dose: 20, unit: "mg", frequency: 1 },
  { code: "312961", display: "Sertraline 50 MG", dose: 50, unit: "mg", frequency: 1 },
  { code: "197361", display: "Aspirin 81 MG", dose: 81, unit: "mg", frequency: 1 },
  { code: "314076", display: "Losartan 50 MG", dose: 50, unit: "mg", frequency: 1 },
  { code: "311026", display: "Levothyroxine 50 MCG", dose: 50, unit: "mcg", frequency: 1 },
  { code: "197319", display: "Hydrochlorothiazide 25 MG", dose: 25, unit: "mg", frequency: 1 },
];

// Vital signs with LOINC codes
const VITAL_SIGNS = [
  { code: "8867-4", display: "Heart rate", unit: "beats/min", min: 60, max: 100 },
  { code: "8310-5", display: "Body temperature", unit: "Cel", min: 36.1, max: 37.2 },
  { code: "8480-6", display: "Systolic blood pressure", unit: "mm[Hg]", min: 90, max: 140 },
  { code: "8462-4", display: "Diastolic blood pressure", unit: "mm[Hg]", min: 60, max: 90 },
  { code: "9279-1", display: "Respiratory rate", unit: "breaths/min", min: 12, max: 20 },
  { code: "29463-7", display: "Body Weight", unit: "kg", min: 50, max: 120 },
  { code: "8302-2", display: "Body Height", unit: "cm", min: 150, max: 190 },
  { code: "39156-5", display: "BMI", unit: "kg/m2", min: 18.5, max: 35 },
];

// Lab results with LOINC codes
const LAB_RESULTS = [
  { code: "2339-0", display: "Glucose", unit: "mg/dL", min: 70, max: 200 },
  { code: "2093-3", display: "Total Cholesterol", unit: "mg/dL", min: 150, max: 280 },
  { code: "2571-8", display: "Triglycerides", unit: "mg/dL", min: 50, max: 300 },
  { code: "2085-9", display: "HDL Cholesterol", unit: "mg/dL", min: 30, max: 80 },
  { code: "18262-6", display: "LDL Cholesterol", unit: "mg/dL", min: 70, max: 200 },
  { code: "4548-4", display: "Hemoglobin A1c", unit: "%", min: 4.5, max: 10.5 },
  { code: "2160-0", display: "Creatinine", unit: "mg/dL", min: 0.6, max: 1.5 },
  { code: "3094-0", display: "BUN", unit: "mg/dL", min: 7, max: 25 },
];

// Social determinants of health
const SDOH_SYSTEM = "http://loinc.org";
const SOCIAL_DETERMINANTS = {
  education: [
    { system: SDOH_SYSTEM, code: "LA19751-5", display: "Less than high school" },
    { system: SDOH_SYSTEM, code: "LA19752-3", display: "High school diploma or GED" },
    { system: SDOH_SYSTEM, code: "LA19753-1", display: "Some college" },
    { system: SDOH_SYSTEM, code: "LA19754-9", display: "College degree" },
    { system: SDOH_SYSTEM, code: "LA19755-6", display: "Graduate degree" },
  ],
  employment: [
    { system: SDOH_SYSTEM, code: "LA17956-6", display: "Employed full-time" },
    { system: SDOH_SYSTEM, code: "LA17957-4", display: "Employed part-time" },
    { system: SDOH_SYSTEM, code: "LA17958-2", display: "Unemployed" },
    { system: SDOH_SYSTEM, code: "LA17959-0", display: "Retired" },
    { system: SDOH_SYSTEM, code: "LA17960-8", display: "Disabled" },
  ],
  housing: [
    { system: SDOH_SYSTEM, code: "LA31995-4", display: "Has housing" },
    { system: SDOH_SYSTEM, code: "LA31994-7", display: "Housing unstable" },
    { system: SDOH_SYSTEM, code: "LA31996-2", display: "Homeless" },
  ],
  food: [
    { system: SDOH_SYSTEM, code: "LA28397-0", display: "Food secure" },
    { system: SDOH_SYSTEM, code: "LA28398-8", display: "Food insecure" },
  ],
  transportation: [
    { system: SDOH_SYSTEM, code: "LA30123-4", display: "Has reliable transportation" },
    { system: SDOH_SYSTEM, code: "LA30124-2", display: "Transportation problems" },
  ],
};

class SyntheaPatientGeneratorService {
  private static instance: SyntheaPatientGeneratorService;
  private rng: () => number;

  private constructor() {
    this.rng = Math.random;
    console.log("[SyntheaGenerator] Synthetic Patient Data Generator initialized");
    console.log("[SyntheaGenerator] FHIR R4 format, NO-CDS compliant");
  }

  static getInstance(): SyntheaPatientGeneratorService {
    if (!SyntheaPatientGeneratorService.instance) {
      SyntheaPatientGeneratorService.instance = new SyntheaPatientGeneratorService();
    }
    return SyntheaPatientGeneratorService.instance;
  }

  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  private randomElement<T>(array: T[]): T {
    return array[Math.floor(this.rng() * array.length)];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomFloat(min: number, max: number, decimals: number = 1): number {
    const value = this.rng() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  private generateBirthDate(minAge: number, maxAge: number): string {
    const today = new Date();
    const age = this.randomInt(minAge, maxAge);
    const birthYear = today.getFullYear() - age;
    const birthMonth = this.randomInt(1, 12);
    const birthDay = this.randomInt(1, 28);
    return `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
  }

  private generatePhone(): string {
    return `(${this.randomInt(200, 999)}) ${this.randomInt(200, 999)}-${this.randomInt(1000, 9999)}`;
  }

  private generateSSN(): string {
    return `${this.randomInt(100, 999)}-${this.randomInt(10, 99)}-${this.randomInt(1000, 9999)}`;
  }

  private generateMRN(): string {
    return `MRN${this.randomInt(100000, 999999)}`;
  }

  private generateAddress(stateCode?: string): SyntheticPatient["address"][0] {
    const state = stateCode || this.randomElement(STATES);
    const cities = CITIES_BY_STATE[state] || ["Springfield"];
    
    return {
      use: "home",
      line: [`${this.randomInt(100, 9999)} ${this.randomElement(STREET_NAMES)}`],
      city: this.randomElement(cities),
      state,
      postalCode: String(this.randomInt(10000, 99999)),
      country: "US",
    };
  }

  private getSyntheticTag(): { system: string; code: string; display: string } {
    return {
      system: "http://terminology.hl7.org/CodeSystem/v3-ObservationValue",
      code: "SYNTHDATA",
      display: "SYNTHETIC TEST DATA - NOT FOR CLINICAL USE",
    };
  }

  generatePatient(config?: Partial<GenerationConfig>): SyntheticPatient {
    const ageRange = config?.ageRange || { min: 18, max: 85 };
    const state = config?.state;
    
    // Determine gender
    let gender: "male" | "female" | "other";
    if (config?.genderDistribution) {
      const roll = this.rng();
      if (roll < config.genderDistribution.male) {
        gender = "male";
      } else if (roll < config.genderDistribution.male + config.genderDistribution.female) {
        gender = "female";
      } else {
        gender = "other";
      }
    } else {
      gender = this.rng() < 0.5 ? "male" : "female";
    }

    const firstName = gender === "male" 
      ? this.randomElement(FIRST_NAMES_MALE)
      : this.randomElement(FIRST_NAMES_FEMALE);
    const lastName = this.randomElement(LAST_NAMES);
    const middleInitial = String.fromCharCode(65 + this.randomInt(0, 25));
    const birthDate = this.generateBirthDate(ageRange.min, ageRange.max);
    const address = this.generateAddress(state);
    const id = uuidv4();

    const patient: SyntheticPatient = {
      id,
      resourceType: "Patient",
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        tag: [this.getSyntheticTag()],
      },
      identifier: [
        {
          system: "http://hospital.synthea.org",
          value: this.generateMRN(),
          type: { text: "MRN" },
        },
        {
          system: "http://hl7.org/fhir/sid/us-ssn",
          value: this.generateSSN(),
          type: { text: "SSN" },
        },
      ],
      name: [
        {
          use: "official",
          family: lastName,
          given: [firstName, middleInitial],
          prefix: this.rng() > 0.7 ? [gender === "male" ? "Mr." : "Ms."] : undefined,
        },
      ],
      gender,
      birthDate,
      address: [address],
      telecom: [
        { system: "phone", value: this.generatePhone(), use: "home" },
        { system: "email", value: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`, use: "home" },
      ],
      maritalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
          code: this.randomElement(["M", "S", "D", "W"]),
          display: this.randomElement(["Married", "Single", "Divorced", "Widowed"]),
        }],
      },
      communication: [{
        language: {
          coding: [{
            system: "urn:ietf:bcp:47",
            code: "en-US",
            display: "English (United States)",
          }],
        },
      }],
    };

    // Add social determinants if requested
    if (config?.includeSocialDeterminants) {
      patient.extension = [
        {
          url: "http://hl7.org/fhir/us/sdoh-clinicalcare/StructureDefinition/SDOHCC-Extension-EducationLevel",
          valueCodeableConcept: {
            coding: [this.randomElement(SOCIAL_DETERMINANTS.education)],
          },
        },
        {
          url: "http://hl7.org/fhir/us/sdoh-clinicalcare/StructureDefinition/SDOHCC-Extension-EmploymentStatus",
          valueCodeableConcept: {
            coding: [this.randomElement(SOCIAL_DETERMINANTS.employment)],
          },
        },
        {
          url: "http://hl7.org/fhir/us/sdoh-clinicalcare/StructureDefinition/SDOHCC-Extension-HousingStatus",
          valueCodeableConcept: {
            coding: [this.randomElement(SOCIAL_DETERMINANTS.housing)],
          },
        },
      ];
    }

    return patient;
  }

  generateCondition(patientId: string): SyntheticCondition {
    const condition = this.randomElement(CONDITIONS);
    const yearsAgo = this.randomInt(1, 10);
    const onsetDate = new Date();
    onsetDate.setFullYear(onsetDate.getFullYear() - yearsAgo);

    return {
      id: uuidv4(),
      resourceType: "Condition",
      meta: { tag: [this.getSyntheticTag()] },
      clinicalStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }],
      },
      verificationStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }],
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis",
        }],
      }],
      code: {
        coding: [{
          system: "http://snomed.info/sct",
          code: condition.code,
          display: condition.display,
        }],
        text: condition.text,
      },
      subject: { reference: `Patient/${patientId}` },
      onsetDateTime: onsetDate.toISOString().split("T")[0],
      recordedDate: new Date().toISOString().split("T")[0],
    };
  }

  generateMedication(patientId: string): SyntheticMedication {
    const med = this.randomElement(MEDICATIONS);

    return {
      id: uuidv4(),
      resourceType: "MedicationRequest",
      meta: { tag: [this.getSyntheticTag()] },
      status: "active",
      intent: "order",
      medicationCodeableConcept: {
        coding: [{
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: med.code,
          display: med.display,
        }],
        text: med.display,
      },
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString().split("T")[0],
      dosageInstruction: [{
        text: `Take ${med.dose} ${med.unit} ${med.frequency === 1 ? "once daily" : `${med.frequency} times daily`}`,
        timing: {
          repeat: {
            frequency: med.frequency,
            period: 1,
            periodUnit: "d",
          },
        },
        doseAndRate: [{
          doseQuantity: {
            value: med.dose,
            unit: med.unit,
          },
        }],
      }],
    };
  }

  generateObservation(patientId: string, type: "vital" | "lab"): SyntheticObservation {
    const data = type === "vital" 
      ? this.randomElement(VITAL_SIGNS)
      : this.randomElement(LAB_RESULTS);

    return {
      id: uuidv4(),
      resourceType: "Observation",
      meta: { tag: [this.getSyntheticTag()] },
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: type === "vital" ? "vital-signs" : "laboratory",
          display: type === "vital" ? "Vital Signs" : "Laboratory",
        }],
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: data.code,
          display: data.display,
        }],
        text: data.display,
      },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: this.randomFloat(data.min, data.max),
        unit: data.unit,
        system: "http://unitsofmeasure.org",
        code: data.unit,
      },
    };
  }

  generatePatientBundle(config: GenerationConfig): SyntheticBundle {
    if (config.seed) {
      this.rng = this.seededRandom(config.seed);
    }

    const entries: { fullUrl: string; resource: any }[] = [];

    for (let i = 0; i < config.count; i++) {
      const patient = this.generatePatient(config);
      entries.push({
        fullUrl: `urn:uuid:${patient.id}`,
        resource: patient,
      });

      // Generate conditions
      if (config.includeConditions !== false) {
        const conditionCount = this.randomInt(1, 4);
        for (let j = 0; j < conditionCount; j++) {
          const condition = this.generateCondition(patient.id);
          entries.push({
            fullUrl: `urn:uuid:${condition.id}`,
            resource: condition,
          });
        }
      }

      // Generate medications
      if (config.includeMedications !== false) {
        const medCount = this.randomInt(1, 5);
        for (let j = 0; j < medCount; j++) {
          const medication = this.generateMedication(patient.id);
          entries.push({
            fullUrl: `urn:uuid:${medication.id}`,
            resource: medication,
          });
        }
      }

      // Generate observations
      if (config.includeObservations !== false) {
        // Vital signs
        for (let j = 0; j < this.randomInt(3, 6); j++) {
          const vital = this.generateObservation(patient.id, "vital");
          entries.push({
            fullUrl: `urn:uuid:${vital.id}`,
            resource: vital,
          });
        }

        // Lab results
        for (let j = 0; j < this.randomInt(2, 4); j++) {
          const lab = this.generateObservation(patient.id, "lab");
          entries.push({
            fullUrl: `urn:uuid:${lab.id}`,
            resource: lab,
          });
        }
      }
    }

    // Reset RNG
    this.rng = Math.random;

    return {
      id: uuidv4(),
      resourceType: "Bundle",
      type: "collection",
      meta: {
        tag: [this.getSyntheticTag()],
        lastUpdated: new Date().toISOString(),
      },
      entry: entries,
      total: entries.length,
    };
  }

  getDatasetPresets(): { name: string; description: string; config: GenerationConfig }[] {
    return [
      {
        name: "small_test",
        description: "10 patients with full records for quick testing",
        config: { count: 10, includeConditions: true, includeMedications: true, includeObservations: true },
      },
      {
        name: "medium_test",
        description: "100 patients for integration testing",
        config: { count: 100, includeConditions: true, includeMedications: true, includeObservations: true },
      },
      {
        name: "large_test",
        description: "1000 patients for load testing",
        config: { count: 1000, includeConditions: true, includeMedications: true, includeObservations: false },
      },
      {
        name: "elderly_population",
        description: "50 elderly patients (65+) for geriatric testing",
        config: { count: 50, ageRange: { min: 65, max: 95 }, includeConditions: true, includeMedications: true },
      },
      {
        name: "pediatric_population",
        description: "50 pediatric patients (0-17) for child health testing",
        config: { count: 50, ageRange: { min: 0, max: 17 }, includeConditions: true, includeMedications: true },
      },
      {
        name: "sdoh_focus",
        description: "50 patients with social determinants data",
        config: { count: 50, includeSocialDeterminants: true, includeConditions: true },
      },
    ];
  }

  getDatabaseStats(): { description: string; note: string } {
    return {
      description: "Synthea™ compatible synthetic patient data generator",
      note: "All generated data is clearly tagged as SYNTHDATA and is NOT for clinical use",
    };
  }
}

export const syntheaPatientGeneratorService = SyntheaPatientGeneratorService.getInstance();
