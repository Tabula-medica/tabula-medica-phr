import { randomUUID } from "crypto";
import { createHash } from "crypto";

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const hashedDetails = { ...details };
  if (hashedDetails.patientId) {
    hashedDetails.patientId = hashIdentifier(hashedDetails.patientId);
  }
  if (hashedDetails.sourceRecordId) {
    hashedDetails.sourceRecordId = hashIdentifier(hashedDetails.sourceRecordId);
  }
  console.log(`[HIPAA_AUDIT][EnhancedFHIR] ${timestamp} | ${action} | ${JSON.stringify(hashedDetails)}`);
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

export type DataSourceType = "wearable" | "pharmacy" | "lab" | "imaging" | "claims" | "patient_reported" | "device" | "external_ehr" | "custom";
export type FhirProfileStatus = "draft" | "active" | "retired" | "deprecated";
export type MappingPresetType = "wearable_observation" | "pharmacy_medication" | "lab_diagnostic" | "vital_signs" | "immunization" | "custom";
export type TransformPipelineStatus = "idle" | "running" | "completed" | "failed" | "paused";

export interface FhirExtensionDefinition {
  url: string;
  name: string;
  description: string;
  valueType: "string" | "integer" | "decimal" | "boolean" | "dateTime" | "CodeableConcept" | "Reference" | "Quantity" | "complex";
  required: boolean;
  cardinality: "0..1" | "0..*" | "1..1" | "1..*";
  defaultValue?: any;
}

export interface CustomFhirProfile {
  id: string;
  name: string;
  description: string;
  baseResourceType: string;
  profileUrl: string;
  version: string;
  status: FhirProfileStatus;
  extensions: FhirExtensionDefinition[];
  customFields: {
    path: string;
    name: string;
    dataType: string;
    required: boolean;
    description: string;
  }[];
  validationRules: {
    id: string;
    path: string;
    expression: string;
    severity: "error" | "warning" | "information";
    message: string;
  }[];
  mappingHints: {
    sourcePath: string;
    targetPath: string;
    transformationType: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ExternalDataSource {
  id: string;
  name: string;
  description: string;
  type: DataSourceType;
  provider: string;
  connectionConfig: {
    endpoint?: string;
    authType: "oauth2" | "api_key" | "basic" | "certificate" | "none";
    credentials?: string;
    refreshInterval?: number;
  };
  dataFormat: "json" | "xml" | "csv" | "hl7v2" | "fhir" | "custom";
  mappingPresetId?: string;
  customProfileIds: string[];
  isActive: boolean;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncStatus: "idle" | "syncing" | "error" | "disabled";
  statistics: {
    totalRecords: number;
    successfulTransforms: number;
    failedTransforms: number;
    lastSuccessAt?: string;
    lastErrorAt?: string;
    lastError?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MappingPreset {
  id: string;
  name: string;
  description: string;
  type: MappingPresetType;
  sourceType: DataSourceType;
  targetResourceTypes: string[];
  mappingRules: PresetMappingRule[];
  codeSystemMappings: CodeSystemMapping[];
  validationProfile?: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresetMappingRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  targetResourceType: string;
  transformationType: "direct" | "computed" | "lookup" | "conditional" | "template";
  transformationLogic?: string;
  defaultValue?: any;
  required: boolean;
  loinc?: string;
  snomed?: string;
}

export interface CodeSystemMapping {
  id: string;
  sourceSystem: string;
  sourceCode: string;
  targetSystem: string;
  targetCode: string;
  targetDisplay: string;
  equivalence: "equivalent" | "wider" | "narrower" | "inexact";
}

export interface TransformationPipeline {
  id: string;
  name: string;
  dataSourceId: string;
  status: TransformPipelineStatus;
  inputRecords: any[];
  outputResources: FhirOutputResource[];
  errors: TransformError[];
  statistics: {
    inputCount: number;
    outputCount: number;
    errorCount: number;
    processingTimeMs: number;
  };
  createdAt: string;
  completedAt?: string;
}

export interface FhirOutputResource {
  id: string;
  resourceType: string;
  fhirResource: any;
  sourceRecordId: string;
  dataSourceId: string;
  profilesApplied: string[];
  extensionsApplied: string[];
  qualityScore: number;
  validationStatus: "valid" | "warnings" | "errors";
  validationMessages: string[];
  createdAt: string;
}

export interface TransformError {
  id: string;
  recordIndex: number;
  sourceRecordId?: string;
  errorType: "mapping" | "validation" | "transformation" | "code_lookup";
  severity: "error" | "warning";
  message: string;
  path?: string;
  timestamp: string;
}

const profileRegistry = new Map<string, CustomFhirProfile>();
const dataSourceRegistry = new Map<string, ExternalDataSource>();
const mappingPresetRegistry = new Map<string, MappingPreset>();
const pipelineHistory = new Map<string, TransformationPipeline>();

const WEARABLE_OBSERVATION_LOINC: Record<string, { code: string; display: string; unit: string; system: string }> = {
  steps: { code: "55423-8", display: "Number of steps in 24 hour Measured", unit: "steps", system: "http://loinc.org" },
  heart_rate: { code: "8867-4", display: "Heart rate", unit: "beats/min", system: "http://loinc.org" },
  heart_rate_variability: { code: "80404-7", display: "Heart rate variability", unit: "ms", system: "http://loinc.org" },
  blood_oxygen: { code: "59408-5", display: "Oxygen saturation in Arterial blood by Pulse oximetry", unit: "%", system: "http://loinc.org" },
  sleep_duration: { code: "93832-4", display: "Sleep duration", unit: "h", system: "http://loinc.org" },
  respiratory_rate: { code: "9279-1", display: "Respiratory rate", unit: "breaths/min", system: "http://loinc.org" },
  body_temperature: { code: "8310-5", display: "Body temperature", unit: "Cel", system: "http://loinc.org" },
  blood_pressure_systolic: { code: "8480-6", display: "Systolic blood pressure", unit: "mm[Hg]", system: "http://loinc.org" },
  blood_pressure_diastolic: { code: "8462-4", display: "Diastolic blood pressure", unit: "mm[Hg]", system: "http://loinc.org" },
  weight: { code: "29463-7", display: "Body weight", unit: "kg", system: "http://loinc.org" },
  glucose: { code: "2339-0", display: "Glucose [Mass/volume] in Blood", unit: "mg/dL", system: "http://loinc.org" },
  activity_minutes: { code: "55411-3", display: "Exercise Activity", unit: "min", system: "http://loinc.org" },
  calories_burned: { code: "41981-2", display: "Calories burned", unit: "kcal", system: "http://loinc.org" },
};

const MEDICATION_RX_NORM_CATEGORIES: Record<string, string> = {
  diabetes: "http://www.nlm.nih.gov/research/umls/rxnorm",
  cardiovascular: "http://www.nlm.nih.gov/research/umls/rxnorm",
  respiratory: "http://www.nlm.nih.gov/research/umls/rxnorm",
  pain: "http://www.nlm.nih.gov/research/umls/rxnorm",
  antibiotic: "http://www.nlm.nih.gov/research/umls/rxnorm",
};

function initializeBuiltInPresets() {
  const wearableObservationPreset: MappingPreset = {
    id: "preset-wearable-observation",
    name: "Wearable Device to FHIR Observation",
    description: "Maps wearable device data (Fitbit, Apple Health, Garmin, etc.) to FHIR Observation resources",
    type: "wearable_observation",
    sourceType: "wearable",
    targetResourceTypes: ["Observation"],
    mappingRules: [
      { id: "wr-1", sourcePath: "patientId", targetPath: "subject.reference", targetResourceType: "Observation", transformationType: "template", transformationLogic: "Patient/${value}", required: true },
      { id: "wr-2", sourcePath: "timestamp", targetPath: "effectiveDateTime", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "wr-3", sourcePath: "value", targetPath: "valueQuantity.value", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "wr-4", sourcePath: "unit", targetPath: "valueQuantity.unit", targetResourceType: "Observation", transformationType: "direct", required: false },
      { id: "wr-5", sourcePath: "deviceId", targetPath: "device.reference", targetResourceType: "Observation", transformationType: "template", transformationLogic: "Device/${value}", required: false },
      { id: "wr-6", sourcePath: "provider", targetPath: "device.display", targetResourceType: "Observation", transformationType: "direct", required: false },
    ],
    codeSystemMappings: Object.entries(WEARABLE_OBSERVATION_LOINC).map(([key, value]) => ({
      id: `csm-wearable-${key}`,
      sourceSystem: "wearable",
      sourceCode: key,
      targetSystem: value.system,
      targetCode: value.code,
      targetDisplay: value.display,
      equivalence: "equivalent" as const,
    })),
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const pharmacyMedicationPreset: MappingPreset = {
    id: "preset-pharmacy-medication",
    name: "Pharmacy Feed to FHIR MedicationRequest/Dispense",
    description: "Maps pharmacy feed data to FHIR MedicationRequest and MedicationDispense resources",
    type: "pharmacy_medication",
    sourceType: "pharmacy",
    targetResourceTypes: ["MedicationRequest", "MedicationDispense"],
    mappingRules: [
      { id: "pr-1", sourcePath: "patientId", targetPath: "subject.reference", targetResourceType: "MedicationRequest", transformationType: "template", transformationLogic: "Patient/${value}", required: true },
      { id: "pr-2", sourcePath: "prescriberId", targetPath: "requester.reference", targetResourceType: "MedicationRequest", transformationType: "template", transformationLogic: "Practitioner/${value}", required: false },
      { id: "pr-3", sourcePath: "rxNumber", targetPath: "identifier[0].value", targetResourceType: "MedicationRequest", transformationType: "direct", required: true },
      { id: "pr-4", sourcePath: "ndc", targetPath: "medicationCodeableConcept.coding[0].code", targetResourceType: "MedicationRequest", transformationType: "direct", required: true },
      { id: "pr-5", sourcePath: "drugName", targetPath: "medicationCodeableConcept.text", targetResourceType: "MedicationRequest", transformationType: "direct", required: true },
      { id: "pr-6", sourcePath: "dosage", targetPath: "dosageInstruction[0].text", targetResourceType: "MedicationRequest", transformationType: "direct", required: false },
      { id: "pr-7", sourcePath: "quantity", targetPath: "dispenseRequest.quantity.value", targetResourceType: "MedicationRequest", transformationType: "direct", required: false },
      { id: "pr-8", sourcePath: "refillsRemaining", targetPath: "dispenseRequest.numberOfRepeatsAllowed", targetResourceType: "MedicationRequest", transformationType: "direct", required: false },
      { id: "pr-9", sourcePath: "fillDate", targetPath: "authoredOn", targetResourceType: "MedicationRequest", transformationType: "direct", required: true },
      { id: "pr-10", sourcePath: "pharmacyNPI", targetPath: "performer[0].reference", targetResourceType: "MedicationDispense", transformationType: "template", transformationLogic: "Organization/${value}", required: false },
      { id: "pr-11", sourcePath: "dispensedQuantity", targetPath: "quantity.value", targetResourceType: "MedicationDispense", transformationType: "direct", required: false },
      { id: "pr-12", sourcePath: "daysSupply", targetPath: "daysSupply.value", targetResourceType: "MedicationDispense", transformationType: "direct", required: false },
    ],
    codeSystemMappings: [
      { id: "csm-ndc", sourceSystem: "pharmacy", sourceCode: "ndc", targetSystem: "http://hl7.org/fhir/sid/ndc", targetCode: "*", targetDisplay: "NDC Code", equivalence: "equivalent" },
      { id: "csm-rxnorm", sourceSystem: "pharmacy", sourceCode: "rxnorm", targetSystem: "http://www.nlm.nih.gov/research/umls/rxnorm", targetCode: "*", targetDisplay: "RxNorm Code", equivalence: "equivalent" },
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const vitalSignsPreset: MappingPreset = {
    id: "preset-vital-signs",
    name: "Vital Signs to FHIR Observation",
    description: "Maps patient-reported or device vital signs to FHIR Observation resources with vital signs profile",
    type: "vital_signs",
    sourceType: "patient_reported",
    targetResourceTypes: ["Observation"],
    mappingRules: [
      { id: "vs-1", sourcePath: "patientId", targetPath: "subject.reference", targetResourceType: "Observation", transformationType: "template", transformationLogic: "Patient/${value}", required: true },
      { id: "vs-2", sourcePath: "timestamp", targetPath: "effectiveDateTime", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "vs-3", sourcePath: "value", targetPath: "valueQuantity.value", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "vs-4", sourcePath: "unit", targetPath: "valueQuantity.unit", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "vs-5", sourcePath: "vitalType", targetPath: "code.coding[0]", targetResourceType: "Observation", transformationType: "lookup", required: true },
    ],
    codeSystemMappings: [
      { id: "csm-bp-sys", sourceSystem: "vitals", sourceCode: "blood_pressure_systolic", targetSystem: "http://loinc.org", targetCode: "8480-6", targetDisplay: "Systolic blood pressure", equivalence: "equivalent" },
      { id: "csm-bp-dia", sourceSystem: "vitals", sourceCode: "blood_pressure_diastolic", targetSystem: "http://loinc.org", targetCode: "8462-4", targetDisplay: "Diastolic blood pressure", equivalence: "equivalent" },
      { id: "csm-hr", sourceSystem: "vitals", sourceCode: "heart_rate", targetSystem: "http://loinc.org", targetCode: "8867-4", targetDisplay: "Heart rate", equivalence: "equivalent" },
      { id: "csm-temp", sourceSystem: "vitals", sourceCode: "temperature", targetSystem: "http://loinc.org", targetCode: "8310-5", targetDisplay: "Body temperature", equivalence: "equivalent" },
      { id: "csm-rr", sourceSystem: "vitals", sourceCode: "respiratory_rate", targetSystem: "http://loinc.org", targetCode: "9279-1", targetDisplay: "Respiratory rate", equivalence: "equivalent" },
      { id: "csm-spo2", sourceSystem: "vitals", sourceCode: "oxygen_saturation", targetSystem: "http://loinc.org", targetCode: "59408-5", targetDisplay: "Oxygen saturation", equivalence: "equivalent" },
      { id: "csm-weight", sourceSystem: "vitals", sourceCode: "weight", targetSystem: "http://loinc.org", targetCode: "29463-7", targetDisplay: "Body weight", equivalence: "equivalent" },
      { id: "csm-height", sourceSystem: "vitals", sourceCode: "height", targetSystem: "http://loinc.org", targetCode: "8302-2", targetDisplay: "Body height", equivalence: "equivalent" },
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const labDiagnosticPreset: MappingPreset = {
    id: "preset-lab-diagnostic",
    name: "Lab Results to FHIR DiagnosticReport/Observation",
    description: "Maps laboratory results from external feeds to FHIR DiagnosticReport and Observation resources",
    type: "lab_diagnostic",
    sourceType: "lab",
    targetResourceTypes: ["DiagnosticReport", "Observation"],
    mappingRules: [
      { id: "lab-1", sourcePath: "patientId", targetPath: "subject.reference", targetResourceType: "DiagnosticReport", transformationType: "template", transformationLogic: "Patient/${value}", required: true },
      { id: "lab-2", sourcePath: "orderId", targetPath: "identifier[0].value", targetResourceType: "DiagnosticReport", transformationType: "direct", required: true },
      { id: "lab-3", sourcePath: "collectionDate", targetPath: "effectiveDateTime", targetResourceType: "DiagnosticReport", transformationType: "direct", required: true },
      { id: "lab-4", sourcePath: "reportDate", targetPath: "issued", targetResourceType: "DiagnosticReport", transformationType: "direct", required: false },
      { id: "lab-5", sourcePath: "labName", targetPath: "performer[0].display", targetResourceType: "DiagnosticReport", transformationType: "direct", required: false },
      { id: "lab-6", sourcePath: "testCode", targetPath: "code.coding[0].code", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "lab-7", sourcePath: "testName", targetPath: "code.text", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "lab-8", sourcePath: "result", targetPath: "valueQuantity.value", targetResourceType: "Observation", transformationType: "direct", required: true },
      { id: "lab-9", sourcePath: "unit", targetPath: "valueQuantity.unit", targetResourceType: "Observation", transformationType: "direct", required: false },
      { id: "lab-10", sourcePath: "referenceRange", targetPath: "referenceRange[0].text", targetResourceType: "Observation", transformationType: "direct", required: false },
      { id: "lab-11", sourcePath: "interpretation", targetPath: "interpretation[0].coding[0].code", targetResourceType: "Observation", transformationType: "lookup", required: false },
    ],
    codeSystemMappings: [
      { id: "csm-lab-loinc", sourceSystem: "lab", sourceCode: "*", targetSystem: "http://loinc.org", targetCode: "*", targetDisplay: "LOINC", equivalence: "equivalent" },
      { id: "csm-interp-h", sourceSystem: "lab", sourceCode: "H", targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", targetCode: "H", targetDisplay: "High", equivalence: "equivalent" },
      { id: "csm-interp-l", sourceSystem: "lab", sourceCode: "L", targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", targetCode: "L", targetDisplay: "Low", equivalence: "equivalent" },
      { id: "csm-interp-n", sourceSystem: "lab", sourceCode: "N", targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", targetCode: "N", targetDisplay: "Normal", equivalence: "equivalent" },
      { id: "csm-interp-a", sourceSystem: "lab", sourceCode: "A", targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", targetCode: "A", targetDisplay: "Abnormal", equivalence: "equivalent" },
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mappingPresetRegistry.set(wearableObservationPreset.id, wearableObservationPreset);
  mappingPresetRegistry.set(pharmacyMedicationPreset.id, pharmacyMedicationPreset);
  mappingPresetRegistry.set(vitalSignsPreset.id, vitalSignsPreset);
  mappingPresetRegistry.set(labDiagnosticPreset.id, labDiagnosticPreset);
}

function initializeSampleProfiles() {
  const wearableObservationProfile: CustomFhirProfile = {
    id: "profile-wearable-observation",
    name: "Tabula Wearable Observation Profile",
    description: "Extended FHIR Observation profile for wearable device data with device metadata and accuracy tracking",
    baseResourceType: "Observation",
    profileUrl: "http://tabulamedica.com/fhir/StructureDefinition/WearableObservation",
    version: "1.0.0",
    status: "active",
    extensions: [
      { url: "http://tabulamedica.com/fhir/StructureDefinition/device-accuracy", name: "deviceAccuracy", description: "Accuracy rating of the wearable device measurement", valueType: "decimal", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/device-battery", name: "deviceBattery", description: "Device battery level at time of measurement", valueType: "integer", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/sync-timestamp", name: "syncTimestamp", description: "When the data was synced from the device", valueType: "dateTime", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/activity-context", name: "activityContext", description: "Activity context (resting, active, sleeping)", valueType: "CodeableConcept", required: false, cardinality: "0..1" },
    ],
    customFields: [
      { path: "meta.profile", name: "profileUrl", dataType: "canonical", required: true, description: "Reference to this profile" },
      { path: "category", name: "wearableCategory", dataType: "CodeableConcept", required: true, description: "Category including wearable-derived" },
    ],
    validationRules: [
      { id: "vr-1", path: "subject", expression: "exists()", severity: "error", message: "Subject reference is required" },
      { id: "vr-2", path: "effectiveDateTime", expression: "exists()", severity: "error", message: "Effective date/time is required" },
      { id: "vr-3", path: "valueQuantity.value", expression: "exists()", severity: "error", message: "Observation value is required" },
    ],
    mappingHints: [
      { sourcePath: "steps", targetPath: "valueQuantity.value", transformationType: "direct" },
      { sourcePath: "heartRate", targetPath: "valueQuantity.value", transformationType: "direct" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const pharmacyMedicationProfile: CustomFhirProfile = {
    id: "profile-pharmacy-medication",
    name: "Tabula Pharmacy MedicationRequest Profile",
    description: "Extended FHIR MedicationRequest profile for pharmacy feed data with refill tracking and adherence extensions",
    baseResourceType: "MedicationRequest",
    profileUrl: "http://tabulamedica.com/fhir/StructureDefinition/PharmacyMedicationRequest",
    version: "1.0.0",
    status: "active",
    extensions: [
      { url: "http://tabulamedica.com/fhir/StructureDefinition/pharmacy-npi", name: "pharmacyNPI", description: "NPI of the dispensing pharmacy", valueType: "string", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/pharmacy-name", name: "pharmacyName", description: "Name of the dispensing pharmacy", valueType: "string", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/refill-due-date", name: "refillDueDate", description: "Estimated date when refill will be needed", valueType: "dateTime", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/adherence-score", name: "adherenceScore", description: "Calculated medication adherence score", valueType: "decimal", required: false, cardinality: "0..1" },
      { url: "http://tabulamedica.com/fhir/StructureDefinition/last-fill-date", name: "lastFillDate", description: "Date of last prescription fill", valueType: "dateTime", required: false, cardinality: "0..1" },
    ],
    customFields: [
      { path: "meta.profile", name: "profileUrl", dataType: "canonical", required: true, description: "Reference to this profile" },
      { path: "identifier", name: "rxNumber", dataType: "Identifier", required: true, description: "Prescription number from pharmacy" },
    ],
    validationRules: [
      { id: "vr-1", path: "subject", expression: "exists()", severity: "error", message: "Patient reference is required" },
      { id: "vr-2", path: "medicationCodeableConcept", expression: "exists() or medicationReference.exists()", severity: "error", message: "Medication is required" },
      { id: "vr-3", path: "identifier", expression: "exists()", severity: "error", message: "Prescription identifier is required" },
    ],
    mappingHints: [
      { sourcePath: "rxNumber", targetPath: "identifier[0].value", transformationType: "direct" },
      { sourcePath: "ndc", targetPath: "medicationCodeableConcept.coding[0].code", transformationType: "direct" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  profileRegistry.set(wearableObservationProfile.id, wearableObservationProfile);
  profileRegistry.set(pharmacyMedicationProfile.id, pharmacyMedicationProfile);
}

function initializeSampleDataSources() {
  const fitbitSource: ExternalDataSource = {
    id: "ds-fitbit",
    name: "Fitbit Integration",
    description: "Fitbit wearable device data integration for steps, heart rate, sleep, and activity tracking",
    type: "wearable",
    provider: "Fitbit",
    connectionConfig: { authType: "oauth2", refreshInterval: 3600 },
    dataFormat: "json",
    mappingPresetId: "preset-wearable-observation",
    customProfileIds: ["profile-wearable-observation"],
    isActive: true,
    syncStatus: "idle",
    statistics: { totalRecords: 1250, successfulTransforms: 1245, failedTransforms: 5, lastSuccessAt: new Date(Date.now() - 3600000).toISOString() },
    createdAt: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const appleHealthSource: ExternalDataSource = {
    id: "ds-apple-health",
    name: "Apple Health Integration",
    description: "Apple Health data integration for vitals, activity, and health metrics from iOS devices",
    type: "wearable",
    provider: "Apple Health",
    connectionConfig: { authType: "oauth2", refreshInterval: 1800 },
    dataFormat: "json",
    mappingPresetId: "preset-wearable-observation",
    customProfileIds: ["profile-wearable-observation"],
    isActive: true,
    syncStatus: "idle",
    statistics: { totalRecords: 3400, successfulTransforms: 3398, failedTransforms: 2, lastSuccessAt: new Date(Date.now() - 1800000).toISOString() },
    createdAt: new Date(Date.now() - 60 * 24 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cvsPharmacySource: ExternalDataSource = {
    id: "ds-cvs-pharmacy",
    name: "CVS Pharmacy Feed",
    description: "CVS pharmacy prescription and dispense data integration via Surescripts",
    type: "pharmacy",
    provider: "CVS",
    connectionConfig: { authType: "certificate", endpoint: "https://surescripts.cvs.com/fhir/v1", refreshInterval: 86400 },
    dataFormat: "json",
    mappingPresetId: "preset-pharmacy-medication",
    customProfileIds: ["profile-pharmacy-medication"],
    isActive: true,
    syncStatus: "idle",
    statistics: { totalRecords: 85, successfulTransforms: 85, failedTransforms: 0, lastSuccessAt: new Date(Date.now() - 86400000).toISOString() },
    createdAt: new Date(Date.now() - 90 * 24 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const questLabSource: ExternalDataSource = {
    id: "ds-quest-diagnostics",
    name: "Quest Diagnostics Lab Feed",
    description: "Quest Diagnostics laboratory results integration via HL7 interface",
    type: "lab",
    provider: "Quest Diagnostics",
    connectionConfig: { authType: "certificate", endpoint: "https://results.questdiagnostics.com/hl7v2", refreshInterval: 3600 },
    dataFormat: "hl7v2",
    mappingPresetId: "preset-lab-diagnostic",
    customProfileIds: [],
    isActive: true,
    syncStatus: "idle",
    statistics: { totalRecords: 156, successfulTransforms: 154, failedTransforms: 2, lastSuccessAt: new Date(Date.now() - 7200000).toISOString() },
    createdAt: new Date(Date.now() - 120 * 24 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  dataSourceRegistry.set(fitbitSource.id, fitbitSource);
  dataSourceRegistry.set(appleHealthSource.id, appleHealthSource);
  dataSourceRegistry.set(cvsPharmacySource.id, cvsPharmacySource);
  dataSourceRegistry.set(questLabSource.id, questLabSource);
}

initializeBuiltInPresets();
initializeSampleProfiles();
initializeSampleDataSources();

console.log("[EnhancedFHIRIntegration] Initialized with built-in presets, profiles, and sample data sources");

export function createCustomProfile(profile: Omit<CustomFhirProfile, "id" | "createdAt" | "updatedAt">): CustomFhirProfile {
  const id = `profile-${randomUUID().substring(0, 8)}`;
  const newProfile: CustomFhirProfile = {
    ...profile,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  profileRegistry.set(id, newProfile);
  logHipaaAudit("CREATE_CUSTOM_PROFILE", { profileId: id, name: profile.name, baseResourceType: profile.baseResourceType });
  return newProfile;
}

export function getCustomProfile(profileId: string): CustomFhirProfile | undefined {
  return profileRegistry.get(profileId);
}

export function getAllCustomProfiles(): CustomFhirProfile[] {
  return Array.from(profileRegistry.values());
}

export function updateCustomProfile(profileId: string, updates: Partial<CustomFhirProfile>): CustomFhirProfile | undefined {
  const existing = profileRegistry.get(profileId);
  if (!existing) return undefined;
  const updated: CustomFhirProfile = { ...existing, ...updates, id: profileId, updatedAt: new Date().toISOString() };
  profileRegistry.set(profileId, updated);
  logHipaaAudit("UPDATE_CUSTOM_PROFILE", { profileId, updates: Object.keys(updates) });
  return updated;
}

export function deleteCustomProfile(profileId: string): boolean {
  const deleted = profileRegistry.delete(profileId);
  if (deleted) {
    logHipaaAudit("DELETE_CUSTOM_PROFILE", { profileId });
  }
  return deleted;
}

export function createDataSource(source: Omit<ExternalDataSource, "id" | "createdAt" | "updatedAt" | "statistics">): ExternalDataSource {
  const id = `ds-${randomUUID().substring(0, 8)}`;
  const newSource: ExternalDataSource = {
    ...source,
    id,
    statistics: { totalRecords: 0, successfulTransforms: 0, failedTransforms: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  dataSourceRegistry.set(id, newSource);
  logHipaaAudit("CREATE_DATA_SOURCE", { sourceId: id, name: source.name, type: source.type, provider: source.provider });
  return newSource;
}

export function getDataSource(sourceId: string): ExternalDataSource | undefined {
  return dataSourceRegistry.get(sourceId);
}

export function getAllDataSources(): ExternalDataSource[] {
  return Array.from(dataSourceRegistry.values());
}

export function getDataSourcesByType(type: DataSourceType): ExternalDataSource[] {
  return Array.from(dataSourceRegistry.values()).filter((s) => s.type === type);
}

export function updateDataSource(sourceId: string, updates: Partial<ExternalDataSource>): ExternalDataSource | undefined {
  const existing = dataSourceRegistry.get(sourceId);
  if (!existing) return undefined;
  const updated: ExternalDataSource = { ...existing, ...updates, id: sourceId, updatedAt: new Date().toISOString() };
  dataSourceRegistry.set(sourceId, updated);
  logHipaaAudit("UPDATE_DATA_SOURCE", { sourceId, updates: Object.keys(updates) });
  return updated;
}

export function deleteDataSource(sourceId: string): boolean {
  const deleted = dataSourceRegistry.delete(sourceId);
  if (deleted) {
    logHipaaAudit("DELETE_DATA_SOURCE", { sourceId });
  }
  return deleted;
}

export function getMappingPreset(presetId: string): MappingPreset | undefined {
  return mappingPresetRegistry.get(presetId);
}

export function getAllMappingPresets(): MappingPreset[] {
  return Array.from(mappingPresetRegistry.values());
}

export function getMappingPresetsByType(type: MappingPresetType): MappingPreset[] {
  return Array.from(mappingPresetRegistry.values()).filter((p) => p.type === type);
}

export function createMappingPreset(preset: Omit<MappingPreset, "id" | "createdAt" | "updatedAt" | "isBuiltIn">): MappingPreset {
  const id = `preset-${randomUUID().substring(0, 8)}`;
  const newPreset: MappingPreset = {
    ...preset,
    id,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mappingPresetRegistry.set(id, newPreset);
  logHipaaAudit("CREATE_MAPPING_PRESET", { presetId: id, name: preset.name, type: preset.type });
  return newPreset;
}

function applyMappingRule(record: any, rule: PresetMappingRule): { path: string; value: any } | null {
  const sourceValue = getNestedValue(record, rule.sourcePath);
  if (sourceValue === undefined && rule.required) {
    return null;
  }
  if (sourceValue === undefined && !rule.required) {
    return rule.defaultValue !== undefined ? { path: rule.targetPath, value: rule.defaultValue } : null;
  }

  let transformedValue: any;
  switch (rule.transformationType) {
    case "direct":
      transformedValue = sourceValue;
      break;
    case "template":
      if (rule.transformationLogic) {
        transformedValue = rule.transformationLogic.replace("${value}", String(sourceValue));
      } else {
        transformedValue = sourceValue;
      }
      break;
    case "computed":
      transformedValue = sourceValue;
      break;
    case "lookup":
      transformedValue = sourceValue;
      break;
    case "conditional":
      transformedValue = sourceValue;
      break;
    default:
      transformedValue = sourceValue;
  }

  return { path: rule.targetPath, value: transformedValue };
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrayKey = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      if (!current[arrayKey]) current[arrayKey] = [];
      if (!current[arrayKey][index]) current[arrayKey][index] = {};
      current = current[arrayKey][index];
    } else {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
  }
  const lastKey = keys[keys.length - 1];
  const arrayMatch = lastKey.match(/^(.+)\[(\d+)\]$/);
  if (arrayMatch) {
    const arrayKey = arrayMatch[1];
    const index = parseInt(arrayMatch[2], 10);
    if (!current[arrayKey]) current[arrayKey] = [];
    current[arrayKey][index] = value;
  } else {
    current[lastKey] = value;
  }
}

export function transformWearableToFhir(
  patientId: string,
  dataType: string,
  value: number,
  timestamp: string,
  deviceInfo: { deviceId?: string; provider?: string; accuracy?: number }
): FhirOutputResource {
  const loincInfo = WEARABLE_OBSERVATION_LOINC[dataType];
  if (!loincInfo) {
    throw new Error(`Unknown wearable data type: ${dataType}`);
  }

  const resourceId = `obs-wearable-${randomUUID().substring(0, 8)}`;
  const fhirResource = {
    resourceType: "Observation",
    id: resourceId,
    meta: {
      profile: ["http://tabulamedica.com/fhir/StructureDefinition/WearableObservation"],
      lastUpdated: new Date().toISOString(),
    },
    status: "final",
    category: [
      {
        coding: [
          { system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "activity", display: "Activity" },
          { system: "http://tabulamedica.com/fhir/CodeSystem/observation-source", code: "wearable", display: "Wearable Device" },
        ],
      },
    ],
    code: {
      coding: [{ system: loincInfo.system, code: loincInfo.code, display: loincInfo.display }],
      text: loincInfo.display,
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: timestamp,
    valueQuantity: {
      value: value,
      unit: loincInfo.unit,
      system: "http://unitsofmeasure.org",
      code: loincInfo.unit,
    },
    device: deviceInfo.deviceId ? { reference: `Device/${deviceInfo.deviceId}`, display: deviceInfo.provider } : undefined,
    extension: deviceInfo.accuracy
      ? [{ url: "http://tabulamedica.com/fhir/StructureDefinition/device-accuracy", valueDecimal: deviceInfo.accuracy }]
      : undefined,
  };

  logHipaaAudit("TRANSFORM_WEARABLE_TO_FHIR", { patientId, dataType, resourceId });

  return {
    id: resourceId,
    resourceType: "Observation",
    fhirResource,
    sourceRecordId: `wearable-${timestamp}`,
    dataSourceId: deviceInfo.provider || "unknown",
    profilesApplied: ["profile-wearable-observation"],
    extensionsApplied: deviceInfo.accuracy ? ["device-accuracy"] : [],
    qualityScore: 0.95,
    validationStatus: "valid",
    validationMessages: [],
    createdAt: new Date().toISOString(),
  };
}

export function transformPharmacyToFhir(
  patientId: string,
  rxData: {
    rxNumber: string;
    ndc: string;
    drugName: string;
    dosage?: string;
    quantity?: number;
    refillsRemaining?: number;
    fillDate: string;
    pharmacyName?: string;
    pharmacyNPI?: string;
    prescriberId?: string;
    daysSupply?: number;
  }
): { medicationRequest: FhirOutputResource; medicationDispense?: FhirOutputResource } {
  const requestId = `medreq-${randomUUID().substring(0, 8)}`;
  const dispenseId = `meddisp-${randomUUID().substring(0, 8)}`;

  const medicationRequest = {
    resourceType: "MedicationRequest",
    id: requestId,
    meta: {
      profile: ["http://tabulamedica.com/fhir/StructureDefinition/PharmacyMedicationRequest"],
      lastUpdated: new Date().toISOString(),
    },
    identifier: [{ system: "http://tabulamedica.com/fhir/identifier/rx-number", value: rxData.rxNumber }],
    status: "active",
    intent: "order",
    medicationCodeableConcept: {
      coding: [{ system: "http://hl7.org/fhir/sid/ndc", code: rxData.ndc, display: rxData.drugName }],
      text: rxData.drugName,
    },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: rxData.fillDate,
    requester: rxData.prescriberId ? { reference: `Practitioner/${rxData.prescriberId}` } : undefined,
    dosageInstruction: rxData.dosage ? [{ text: rxData.dosage }] : undefined,
    dispenseRequest: {
      numberOfRepeatsAllowed: rxData.refillsRemaining,
      quantity: rxData.quantity ? { value: rxData.quantity, unit: "tablets" } : undefined,
    },
    extension: [
      rxData.pharmacyNPI ? { url: "http://tabulamedica.com/fhir/StructureDefinition/pharmacy-npi", valueString: rxData.pharmacyNPI } : null,
      rxData.pharmacyName ? { url: "http://tabulamedica.com/fhir/StructureDefinition/pharmacy-name", valueString: rxData.pharmacyName } : null,
    ].filter(Boolean),
  };

  const medicationDispense = {
    resourceType: "MedicationDispense",
    id: dispenseId,
    meta: { lastUpdated: new Date().toISOString() },
    identifier: [{ system: "http://tabulamedica.com/fhir/identifier/dispense-id", value: `${rxData.rxNumber}-${rxData.fillDate}` }],
    status: "completed",
    medicationCodeableConcept: {
      coding: [{ system: "http://hl7.org/fhir/sid/ndc", code: rxData.ndc, display: rxData.drugName }],
      text: rxData.drugName,
    },
    subject: { reference: `Patient/${patientId}` },
    performer: rxData.pharmacyNPI ? [{ actor: { reference: `Organization/${rxData.pharmacyNPI}`, display: rxData.pharmacyName } }] : undefined,
    whenHandedOver: rxData.fillDate,
    quantity: rxData.quantity ? { value: rxData.quantity, unit: "tablets" } : undefined,
    daysSupply: rxData.daysSupply ? { value: rxData.daysSupply, unit: "days" } : undefined,
    authorizingPrescription: [{ reference: `MedicationRequest/${requestId}` }],
  };

  logHipaaAudit("TRANSFORM_PHARMACY_TO_FHIR", { patientId, rxNumber: hashIdentifier(rxData.rxNumber), requestId, dispenseId });

  return {
    medicationRequest: {
      id: requestId,
      resourceType: "MedicationRequest",
      fhirResource: medicationRequest,
      sourceRecordId: rxData.rxNumber,
      dataSourceId: rxData.pharmacyName || "pharmacy",
      profilesApplied: ["profile-pharmacy-medication"],
      extensionsApplied: ["pharmacy-npi", "pharmacy-name"].filter((ext) => (ext === "pharmacy-npi" ? rxData.pharmacyNPI : rxData.pharmacyName)),
      qualityScore: 0.92,
      validationStatus: "valid",
      validationMessages: [],
      createdAt: new Date().toISOString(),
    },
    medicationDispense: {
      id: dispenseId,
      resourceType: "MedicationDispense",
      fhirResource: medicationDispense,
      sourceRecordId: `${rxData.rxNumber}-${rxData.fillDate}`,
      dataSourceId: rxData.pharmacyName || "pharmacy",
      profilesApplied: [],
      extensionsApplied: [],
      qualityScore: 0.90,
      validationStatus: "valid",
      validationMessages: [],
      createdAt: new Date().toISOString(),
    },
  };
}

export async function runTransformationPipeline(
  dataSourceId: string,
  inputRecords: any[],
  options?: { profileIds?: string[]; validateOutput?: boolean }
): Promise<TransformationPipeline> {
  const dataSource = dataSourceRegistry.get(dataSourceId);
  if (!dataSource) {
    throw new Error(`Data source not found: ${dataSourceId}`);
  }

  const pipelineId = `pipeline-${randomUUID().substring(0, 8)}`;
  const startTime = Date.now();

  const pipeline: TransformationPipeline = {
    id: pipelineId,
    name: `${dataSource.name} Transform`,
    dataSourceId,
    status: "running",
    inputRecords,
    outputResources: [],
    errors: [],
    statistics: { inputCount: inputRecords.length, outputCount: 0, errorCount: 0, processingTimeMs: 0 },
    createdAt: new Date().toISOString(),
  };

  pipelineHistory.set(pipelineId, pipeline);

  const preset = dataSource.mappingPresetId ? mappingPresetRegistry.get(dataSource.mappingPresetId) : null;

  for (let i = 0; i < inputRecords.length; i++) {
    const record = inputRecords[i];
    try {
      if (dataSource.type === "wearable" && record.dataType && record.value !== undefined) {
        const result = transformWearableToFhir(record.patientId, record.dataType, record.value, record.timestamp || new Date().toISOString(), {
          deviceId: record.deviceId,
          provider: dataSource.provider,
          accuracy: record.accuracy,
        });
        pipeline.outputResources.push(result);
      } else if (dataSource.type === "pharmacy" && record.rxNumber && record.ndc) {
        const result = transformPharmacyToFhir(record.patientId, record);
        pipeline.outputResources.push(result.medicationRequest);
        if (result.medicationDispense) {
          pipeline.outputResources.push(result.medicationDispense);
        }
      } else if (preset) {
        const fhirResource: any = { resourceType: preset.targetResourceTypes[0], id: `res-${randomUUID().substring(0, 8)}` };
        for (const rule of preset.mappingRules) {
          const result = applyMappingRule(record, rule);
          if (result) {
            setNestedValue(fhirResource, result.path, result.value);
          }
        }
        pipeline.outputResources.push({
          id: fhirResource.id,
          resourceType: fhirResource.resourceType,
          fhirResource,
          sourceRecordId: record.id || `record-${i}`,
          dataSourceId,
          profilesApplied: dataSource.customProfileIds,
          extensionsApplied: [],
          qualityScore: 0.85,
          validationStatus: "valid",
          validationMessages: [],
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      pipeline.errors.push({
        id: `err-${randomUUID().substring(0, 8)}`,
        recordIndex: i,
        sourceRecordId: record.id,
        errorType: "transformation",
        severity: "error",
        message: error.message || "Unknown transformation error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  pipeline.status = pipeline.errors.length > 0 && pipeline.outputResources.length === 0 ? "failed" : "completed";
  pipeline.statistics = {
    inputCount: inputRecords.length,
    outputCount: pipeline.outputResources.length,
    errorCount: pipeline.errors.length,
    processingTimeMs: Date.now() - startTime,
  };
  pipeline.completedAt = new Date().toISOString();

  dataSource.statistics.totalRecords += inputRecords.length;
  dataSource.statistics.successfulTransforms += pipeline.outputResources.length;
  dataSource.statistics.failedTransforms += pipeline.errors.length;
  dataSource.statistics.lastSuccessAt = pipeline.outputResources.length > 0 ? new Date().toISOString() : dataSource.statistics.lastSuccessAt;
  if (pipeline.errors.length > 0) {
    dataSource.statistics.lastErrorAt = new Date().toISOString();
    dataSource.statistics.lastError = pipeline.errors[0].message;
  }
  dataSource.lastSyncAt = new Date().toISOString();
  dataSource.updatedAt = new Date().toISOString();

  logHipaaAudit("RUN_TRANSFORMATION_PIPELINE", {
    pipelineId,
    dataSourceId,
    inputCount: inputRecords.length,
    outputCount: pipeline.outputResources.length,
    errorCount: pipeline.errors.length,
  });

  return pipeline;
}

export function getTransformationPipeline(pipelineId: string): TransformationPipeline | undefined {
  return pipelineHistory.get(pipelineId);
}

export function getRecentPipelines(limit: number = 10): TransformationPipeline[] {
  return Array.from(pipelineHistory.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function getIntegrationStats(): {
  totalProfiles: number;
  totalDataSources: number;
  totalPresets: number;
  activeDataSources: number;
  totalRecordsProcessed: number;
  totalTransformSuccess: number;
  totalTransformFailed: number;
} {
  const dataSources = Array.from(dataSourceRegistry.values());
  return {
    totalProfiles: profileRegistry.size,
    totalDataSources: dataSourceRegistry.size,
    totalPresets: mappingPresetRegistry.size,
    activeDataSources: dataSources.filter((s) => s.isActive).length,
    totalRecordsProcessed: dataSources.reduce((sum, s) => sum + s.statistics.totalRecords, 0),
    totalTransformSuccess: dataSources.reduce((sum, s) => sum + s.statistics.successfulTransforms, 0),
    totalTransformFailed: dataSources.reduce((sum, s) => sum + s.statistics.failedTransforms, 0),
  };
}

export function getLOINCCodeForWearableType(dataType: string): { code: string; display: string; unit: string } | undefined {
  const info = WEARABLE_OBSERVATION_LOINC[dataType];
  if (!info) return undefined;
  return { code: info.code, display: info.display, unit: info.unit };
}

export function getSupportedWearableDataTypes(): string[] {
  return Object.keys(WEARABLE_OBSERVATION_LOINC);
}
