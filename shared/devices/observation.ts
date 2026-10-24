export type ReadingKind =
  | "heart-rate"
  | "steps"
  | "weight"
  | "spo2"
  | "systolic-bp"
  | "diastolic-bp"
  | "glucose"
  | "cgm-glucose"
  | "body-temperature"
  | "respiratory-rate";

export interface NormalizedReading {
  patientId: string;
  kind: ReadingKind;
  value: number;
  /** UCUM code, e.g. "/min", "kg", "%", "mm[Hg]", "mg/dL", "Cel". */
  ucum: string;
  unitLabel: string;
  effectiveAt: string;
  integrationId: string;
  deviceLabel?: string;
}

export interface FhirCoding {
  system: string;
  code: string;
  display: string;
}

export interface FhirObservationDraft {
  resourceType: "Observation";
  status: "final";
  category: { coding: FhirCoding[] }[];
  code: { coding: FhirCoding[] };
  subject: { reference: string };
  effectiveDateTime: string;
  valueQuantity: { value: number; unit: string; system: "http://unitsofmeasure.org"; code: string };
  device?: { display: string };
  identifier: { system: string; value: string }[];
  meta: { tag: FhirCoding[] };
}

const LOINC = "http://loinc.org";
const OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";
const SOURCE_SYSTEM = "urn:tabula-medica:ingest-source";
const READING_ID_SYSTEM = "urn:tabula-medica:device-reading";

const KIND_CODE: Record<ReadingKind, FhirCoding> = {
  "heart-rate": { system: LOINC, code: "8867-4", display: "Heart rate" },
  steps: { system: LOINC, code: "55423-8", display: "Number of steps" },
  weight: { system: LOINC, code: "29463-7", display: "Body weight" },
  spo2: { system: LOINC, code: "59408-5", display: "Oxygen saturation in Arterial blood by Pulse oximetry" },
  "systolic-bp": { system: LOINC, code: "8480-6", display: "Systolic blood pressure" },
  "diastolic-bp": { system: LOINC, code: "8462-4", display: "Diastolic blood pressure" },
  glucose: { system: LOINC, code: "41653-7", display: "Glucose [Mass/volume] in Capillary blood by Glucometer" },
  "cgm-glucose": { system: LOINC, code: "99504-3", display: "Glucose [Mass/volume] in Interstitial fluid by Continuous glucose monitoring" },
  "body-temperature": { system: LOINC, code: "8310-5", display: "Body temperature" },
  "respiratory-rate": { system: LOINC, code: "9279-1", display: "Respiratory rate" },
};

function categoryFor(kind: ReadingKind): string {
  if (kind === "steps") return "activity";
  return "vital-signs";
}

export function toFhirObservation(reading: NormalizedReading): FhirObservationDraft {
  if (!reading.patientId.trim()) throw new Error("A device reading needs a patient id.");
  if (!Number.isFinite(reading.value)) throw new Error("A device reading needs a finite value.");
  const code = KIND_CODE[reading.kind];
  const identity = [reading.integrationId, reading.kind, reading.effectiveAt, String(reading.value), reading.ucum].join("|");
  return {
    resourceType: "Observation",
    status: "final",
    category: [{ coding: [{ system: OBS_CATEGORY, code: categoryFor(reading.kind), display: categoryFor(reading.kind) }] }],
    code: { coding: [code] },
    subject: { reference: `Patient/${reading.patientId}` },
    effectiveDateTime: reading.effectiveAt,
    valueQuantity: {
      value: reading.value,
      unit: reading.unitLabel,
      system: "http://unitsofmeasure.org",
      code: reading.ucum,
    },
    ...(reading.deviceLabel ? { device: { display: reading.deviceLabel } } : {}),
    identifier: [{ system: READING_ID_SYSTEM, value: identity }],
    meta: {
      tag: [{ system: SOURCE_SYSTEM, code: "device", display: reading.integrationId }],
    },
  };
}
