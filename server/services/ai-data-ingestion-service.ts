// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { getAuditLogger } from "./integrations/factory";
import { parseHL7Message, FHIRConversionResult } from "./hl7-v2-handler";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export type DataFormat = "dicom" | "hl7_v2" | "fhir_r4" | "ccd" | "ccda" | "pdf" | "csv" | "json" | "unknown";

export type IngestionStatus = 
  | "pending" 
  | "detecting" 
  | "parsing" 
  | "extracting" 
  | "normalizing" 
  | "validating" 
  | "completed" 
  | "error";

export interface IngestionJob {
  id: string;
  userId: string;
  patientId?: string;
  filename: string;
  format: DataFormat;
  status: IngestionStatus;
  rawData: string;
  parsedData?: ParsedHealthData;
  extractedEntities?: ExtractedEntities;
  normalizedResources?: NormalizedFHIRResources;
  validationResults?: ValidationResult[];
  errors: string[];
  warnings: string[];
  metadata: IngestionMetadata;
  createdAt: string;
  completedAt?: string;
  processingTimeMs?: number;
}

export interface IngestionMetadata {
  sourceType: string;
  sourceSystem?: string;
  encoding?: string;
  fileSize?: number;
  mimeType?: string;
  dicomModality?: string;
  hl7MessageType?: string;
  fhirResourceTypes?: string[];
}

export interface ParsedHealthData {
  format: DataFormat;
  patient?: PatientInfo;
  encounters?: EncounterInfo[];
  conditions?: ConditionInfo[];
  medications?: MedicationInfo[];
  observations?: ObservationInfo[];
  procedures?: ProcedureInfo[];
  imagingStudies?: ImagingStudyInfo[];
  documents?: DocumentInfo[];
  rawStructure: Record<string, unknown>;
}

export interface PatientInfo {
  id?: string;
  mrn?: string;
  name?: { given?: string[]; family?: string };
  birthDate?: string;
  gender?: string;
  address?: AddressInfo;
  telecom?: TelecomInfo[];
  identifiers?: IdentifierInfo[];
}

export interface AddressInfo {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface TelecomInfo {
  system: string;
  value: string;
  use?: string;
}

export interface IdentifierInfo {
  system?: string;
  value: string;
  type?: string;
}

export interface EncounterInfo {
  id?: string;
  date?: string;
  type?: string;
  status?: string;
  provider?: string;
  facility?: string;
  reasonCode?: string;
  reasonText?: string;
}

export interface ConditionInfo {
  id?: string;
  code?: string;
  codeSystem?: string;
  displayText: string;
  clinicalStatus?: string;
  onsetDate?: string;
  recordedDate?: string;
  verificationStatus?: string;
}

export interface MedicationInfo {
  id?: string;
  code?: string;
  codeSystem?: string;
  displayText: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  status?: string;
  prescribedDate?: string;
  prescriber?: string;
}

export interface ObservationInfo {
  id?: string;
  code?: string;
  codeSystem?: string;
  displayText: string;
  value?: string;
  unit?: string;
  referenceRange?: { low?: string; high?: string };
  effectiveDate?: string;
  status?: string;
  interpretation?: string;
  category?: string;
}

export interface ProcedureInfo {
  id?: string;
  code?: string;
  codeSystem?: string;
  displayText: string;
  performedDate?: string;
  status?: string;
  performer?: string;
  bodySite?: string;
}

export interface ImagingStudyInfo {
  id?: string;
  studyInstanceUid?: string;
  modality: string;
  bodyPart?: string;
  studyDate?: string;
  description?: string;
  numberOfSeries?: number;
  numberOfInstances?: number;
  accessionNumber?: string;
  referringPhysician?: string;
  findings?: string[];
  impressions?: string[];
}

export interface DocumentInfo {
  id?: string;
  type?: string;
  title?: string;
  date?: string;
  author?: string;
  content?: string;
  sections?: DocumentSection[];
}

export interface DocumentSection {
  title: string;
  code?: string;
  content: string;
}

export interface ExtractedEntities {
  diagnoses: EntityExtraction[];
  medications: EntityExtraction[];
  procedures: EntityExtraction[];
  labResults: EntityExtraction[];
  vitalSigns: EntityExtraction[];
  allergies: EntityExtraction[];
  immunizations: EntityExtraction[];
  socialHistory: EntityExtraction[];
  familyHistory: EntityExtraction[];
}

export interface EntityExtraction {
  text: string;
  type: string;
  code?: string;
  codeSystem?: string;
  confidence: number;
  sourceLocation?: string;
  normalizedValue?: string;
}

export interface NormalizedFHIRResources {
  patient?: Record<string, unknown>;
  encounters: Record<string, unknown>[];
  conditions: Record<string, unknown>[];
  medications: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  procedures: Record<string, unknown>[];
  imagingStudies: Record<string, unknown>[];
  documentReferences: Record<string, unknown>[];
  allergies: Record<string, unknown>[];
  immunizations: Record<string, unknown>[];
}

export interface ValidationResult {
  resourceType: string;
  resourceId?: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: "error";
}

export interface ValidationWarning {
  path: string;
  message: string;
  severity: "warning" | "information";
}

export interface IngestionSummary {
  jobId: string;
  status: IngestionStatus;
  format: DataFormat;
  resourceCounts: {
    patients: number;
    encounters: number;
    conditions: number;
    medications: number;
    observations: number;
    procedures: number;
    imagingStudies: number;
    documents: number;
    allergies: number;
    immunizations: number;
  };
  validationSummary: {
    totalResources: number;
    validResources: number;
    errorCount: number;
    warningCount: number;
  };
  processingTimeMs: number;
  aiConfidenceScore: number;
}

const ingestionJobs: Map<string, IngestionJob> = new Map();

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function logIngestionActivity(
  action: string,
  jobId: string,
  userId: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: hashIdentifier(userId),
      userRole: "system",
      action: "create" as const,
      resourceType: "DataIngestion",
      resourceId: jobId,
      patientId: hashIdentifier("system"),
      ipAddress: "internal",
      userAgent: "ai-data-ingestion",
      requestPath: "/api/ingestion",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        ingestionAction: action,
        jobIdHash: hashIdentifier(jobId),
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[DataIngestion] Audit logging failed:", e);
  }
}

export function detectDataFormat(rawData: string, filename?: string, mimeType?: string): DataFormat {
  const trimmed = rawData.trim();
  
  if (filename?.toLowerCase().endsWith(".dcm") || mimeType === "application/dicom") {
    return "dicom";
  }
  
  if (trimmed.startsWith("MSH|") || trimmed.includes("\rMSH|") || trimmed.includes("\nMSH|")) {
    return "hl7_v2";
  }
  
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.resourceType) {
      return "fhir_r4";
    }
    return "json";
  } catch {
  }
  
  if (trimmed.includes("<ClinicalDocument") || trimmed.includes("urn:hl7-org:v3")) {
    if (trimmed.includes("CCD") || trimmed.includes("Continuity of Care")) {
      return "ccd";
    }
    return "ccda";
  }
  
  if (trimmed.startsWith("%PDF")) {
    return "pdf";
  }
  
  const lines = trimmed.split("\n").slice(0, 5);
  const hasCommas = lines.every(line => line.includes(","));
  if (hasCommas && lines.length > 1) {
    return "csv";
  }
  
  return "unknown";
}

export async function createIngestionJob(
  userId: string,
  rawData: string,
  filename: string,
  mimeType?: string,
  patientId?: string
): Promise<IngestionJob> {
  const format = detectDataFormat(rawData, filename, mimeType);
  
  const job: IngestionJob = {
    id: randomUUID(),
    userId,
    patientId,
    filename,
    format,
    status: "pending",
    rawData,
    errors: [],
    warnings: [],
    metadata: {
      sourceType: format,
      encoding: "utf-8",
      fileSize: rawData.length,
      mimeType,
    },
    createdAt: new Date().toISOString(),
  };
  
  ingestionJobs.set(job.id, job);
  
  await logIngestionActivity("job_created", job.id, userId, {
    format,
    filename,
    fileSize: rawData.length,
  });
  
  return job;
}

export async function processIngestionJob(jobId: string): Promise<IngestionJob> {
  const job = ingestionJobs.get(jobId);
  if (!job) {
    throw new Error(`Ingestion job not found: ${jobId}`);
  }
  
  const startTime = Date.now();
  
  try {
    job.status = "detecting";
    
    job.status = "parsing";
    job.parsedData = await parseRawData(job);
    
    job.status = "extracting";
    job.extractedEntities = await extractEntitiesWithAI(job);
    
    job.status = "normalizing";
    job.normalizedResources = await normalizeToFHIR(job);
    
    job.status = "validating";
    job.validationResults = await validateResources(job);
    
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.processingTimeMs = Date.now() - startTime;
    
    await logIngestionActivity("job_completed", job.id, job.userId, {
      format: job.format,
      resourceCount: countResources(job.normalizedResources),
      processingTimeMs: job.processingTimeMs,
    });
    
  } catch (error) {
    job.status = "error";
    job.errors.push(error instanceof Error ? error.message : "Unknown error");
    job.processingTimeMs = Date.now() - startTime;
    
    await logIngestionActivity("job_failed", job.id, job.userId, {
      error: job.errors[0],
    });
  }
  
  ingestionJobs.set(jobId, job);
  return job;
}

async function parseRawData(job: IngestionJob): Promise<ParsedHealthData> {
  const result: ParsedHealthData = {
    format: job.format,
    rawStructure: {},
  };
  
  switch (job.format) {
    case "hl7_v2":
      return parseHL7Data(job.rawData, result);
    case "fhir_r4":
      return parseFHIRData(job.rawData, result);
    case "ccd":
    case "ccda":
      return parseCCDData(job.rawData, result);
    case "dicom":
      return parseDICOMMetadata(job.rawData, result);
    case "csv":
      return parseCSVData(job.rawData, result);
    case "json":
      return parseGenericJSON(job.rawData, result);
    default:
      return parseWithAI(job.rawData, result);
  }
}

function parseHL7Data(rawData: string, result: ParsedHealthData): ParsedHealthData {
  const parseResult = parseHL7Message(rawData);
  
  if (!parseResult.success || !parseResult.message) {
    result.rawStructure = { error: parseResult.errors };
    return result;
  }
  
  const msg = parseResult.message;
  result.rawStructure = { segments: msg.segments, parsedData: msg.parsedData };
  
  const pidSegment = msg.segments.find(s => s.name === "PID");
  if (pidSegment) {
    result.patient = {
      mrn: pidSegment.fields[3]?.value,
      name: {
        family: pidSegment.fields[5]?.components[0],
        given: pidSegment.fields[5]?.components[1] ? [pidSegment.fields[5].components[1]] : undefined,
      },
      birthDate: pidSegment.fields[7]?.value,
      gender: pidSegment.fields[8]?.value,
    };
  }
  
  const obxSegments = msg.segments.filter(s => s.name === "OBX");
  if (obxSegments.length > 0) {
    result.observations = obxSegments.map(obx => ({
      id: randomUUID(),
      code: obx.fields[3]?.components[0],
      displayText: obx.fields[3]?.components[1] || obx.fields[3]?.value || "Unknown",
      value: obx.fields[5]?.value,
      unit: obx.fields[6]?.value,
      status: obx.fields[11]?.value,
    }));
  }
  
  const rxaSegments = msg.segments.filter(s => s.name === "RXA");
  if (rxaSegments.length > 0) {
    result.medications = rxaSegments.map(rxa => ({
      id: randomUUID(),
      code: rxa.fields[5]?.components[0],
      displayText: rxa.fields[5]?.components[1] || rxa.fields[5]?.value || "Unknown",
      dosage: rxa.fields[6]?.value,
      route: rxa.fields[7]?.value,
    }));
  }
  
  return result;
}

function parseFHIRData(rawData: string, result: ParsedHealthData): ParsedHealthData {
  try {
    const fhir = JSON.parse(rawData);
    result.rawStructure = fhir;
    
    if (fhir.resourceType === "Bundle") {
      const entries = fhir.entry || [];
      
      for (const entry of entries) {
        const resource = entry.resource;
        if (!resource) continue;
        
        switch (resource.resourceType) {
          case "Patient":
            result.patient = extractPatientFromFHIR(resource);
            break;
          case "Condition":
            result.conditions = result.conditions || [];
            result.conditions.push(extractConditionFromFHIR(resource));
            break;
          case "Observation":
            result.observations = result.observations || [];
            result.observations.push(extractObservationFromFHIR(resource));
            break;
          case "MedicationRequest":
          case "MedicationStatement":
            result.medications = result.medications || [];
            result.medications.push(extractMedicationFromFHIR(resource));
            break;
          case "Procedure":
            result.procedures = result.procedures || [];
            result.procedures.push(extractProcedureFromFHIR(resource));
            break;
          case "Encounter":
            result.encounters = result.encounters || [];
            result.encounters.push(extractEncounterFromFHIR(resource));
            break;
          case "ImagingStudy":
            result.imagingStudies = result.imagingStudies || [];
            result.imagingStudies.push(extractImagingFromFHIR(resource));
            break;
          case "DocumentReference":
            result.documents = result.documents || [];
            result.documents.push(extractDocumentFromFHIR(resource));
            break;
        }
      }
    } else if (fhir.resourceType === "Patient") {
      result.patient = extractPatientFromFHIR(fhir);
    }
    
  } catch (e) {
    result.rawStructure = { error: "Failed to parse FHIR JSON" };
  }
  
  return result;
}

function extractPatientFromFHIR(resource: Record<string, unknown>): PatientInfo {
  const name = (resource.name as Array<Record<string, unknown>>)?.[0];
  return {
    id: resource.id as string,
    name: {
      family: name?.family as string,
      given: name?.given as string[],
    },
    birthDate: resource.birthDate as string,
    gender: resource.gender as string,
    identifiers: ((resource.identifier as Array<Record<string, unknown>>) || []).map(id => ({
      system: id.system as string,
      value: id.value as string,
      type: (id.type as Record<string, unknown>)?.text as string,
    })),
  };
}

function extractConditionFromFHIR(resource: Record<string, unknown>): ConditionInfo {
  const coding = ((resource.code as Record<string, unknown>)?.coding as Array<Record<string, unknown>>)?.[0];
  return {
    id: resource.id as string,
    code: coding?.code as string,
    codeSystem: coding?.system as string,
    displayText: coding?.display as string || (resource.code as Record<string, unknown>)?.text as string || "Unknown",
    clinicalStatus: ((resource.clinicalStatus as Record<string, unknown>)?.coding as Array<Record<string, unknown>>)?.[0]?.code as string,
    onsetDate: (resource.onsetDateTime || resource.onsetPeriod) as string,
    recordedDate: resource.recordedDate as string,
  };
}

function extractObservationFromFHIR(resource: Record<string, unknown>): ObservationInfo {
  const coding = ((resource.code as Record<string, unknown>)?.coding as Array<Record<string, unknown>>)?.[0];
  const valueQuantity = resource.valueQuantity as Record<string, unknown>;
  return {
    id: resource.id as string,
    code: coding?.code as string,
    codeSystem: coding?.system as string,
    displayText: coding?.display as string || "Unknown",
    value: valueQuantity?.value?.toString() || resource.valueString as string,
    unit: valueQuantity?.unit as string,
    effectiveDate: resource.effectiveDateTime as string,
    status: resource.status as string,
    category: ((resource.category as Array<Record<string, unknown>>)?.[0]?.coding as Array<Record<string, unknown>>)?.[0]?.code as string,
  };
}

function extractMedicationFromFHIR(resource: Record<string, unknown>): MedicationInfo {
  const medCode = resource.medicationCodeableConcept as Record<string, unknown>;
  const coding = (medCode?.coding as Array<Record<string, unknown>>)?.[0];
  const dosage = (resource.dosageInstruction as Array<Record<string, unknown>>)?.[0];
  return {
    id: resource.id as string,
    code: coding?.code as string,
    codeSystem: coding?.system as string,
    displayText: coding?.display as string || medCode?.text as string || "Unknown",
    dosage: (dosage?.doseAndRate as Array<Record<string, unknown>>)?.[0]?.doseQuantity as string,
    route: (dosage?.route as Record<string, unknown>)?.text as string,
    status: resource.status as string,
    prescribedDate: resource.authoredOn as string,
  };
}

function extractProcedureFromFHIR(resource: Record<string, unknown>): ProcedureInfo {
  const coding = ((resource.code as Record<string, unknown>)?.coding as Array<Record<string, unknown>>)?.[0];
  return {
    id: resource.id as string,
    code: coding?.code as string,
    codeSystem: coding?.system as string,
    displayText: coding?.display as string || "Unknown",
    performedDate: resource.performedDateTime as string,
    status: resource.status as string,
  };
}

function extractEncounterFromFHIR(resource: Record<string, unknown>): EncounterInfo {
  const type = (resource.type as Array<Record<string, unknown>>)?.[0];
  const coding = (type?.coding as Array<Record<string, unknown>>)?.[0];
  return {
    id: resource.id as string,
    date: (resource.period as Record<string, unknown>)?.start as string,
    type: coding?.display as string || type?.text as string,
    status: resource.status as string,
  };
}

function extractImagingFromFHIR(resource: Record<string, unknown>): ImagingStudyInfo {
  const modality = (resource.modality as Array<Record<string, unknown>>)?.[0];
  const identifiers = resource.identifier as Array<Record<string, unknown>> | undefined;
  return {
    id: resource.id as string,
    studyInstanceUid: identifiers?.[0]?.value as string,
    modality: modality?.code as string || "Unknown",
    studyDate: resource.started as string,
    description: resource.description as string,
    numberOfSeries: resource.numberOfSeries as number,
    numberOfInstances: resource.numberOfInstances as number,
  };
}

function extractDocumentFromFHIR(resource: Record<string, unknown>): DocumentInfo {
  const typeObj = resource.type as Record<string, unknown> | undefined;
  const coding = (typeObj?.coding as Array<Record<string, unknown>>)?.[0];
  return {
    id: resource.id as string,
    type: coding?.display as string,
    title: resource.description as string,
    date: resource.date as string,
  };
}

function parseCCDData(rawData: string, result: ParsedHealthData): ParsedHealthData {
  result.rawStructure = { xmlContent: rawData.substring(0, 1000) + "..." };
  
  result.conditions = [];
  result.medications = [];
  result.observations = [];
  result.procedures = [];
  
  const problemPattern = /<code[^>]*displayName="([^"]+)"[^>]*\/>/g;
  let match;
  while ((match = problemPattern.exec(rawData)) !== null) {
    result.conditions.push({
      id: randomUUID(),
      displayText: match[1],
    });
  }
  
  const medPattern = /<manufacturedMaterial>[\s\S]*?<name>([^<]+)<\/name>/g;
  while ((match = medPattern.exec(rawData)) !== null) {
    result.medications.push({
      id: randomUUID(),
      displayText: match[1],
    });
  }
  
  return result;
}

function parseDICOMMetadata(rawData: string, result: ParsedHealthData): ParsedHealthData {
  result.rawStructure = { dicomBinaryLength: rawData.length };
  
  result.imagingStudies = [{
    id: randomUUID(),
    modality: "Unknown",
    description: "DICOM Study (metadata extraction pending)",
  }];
  
  return result;
}

function parseCSVData(rawData: string, result: ParsedHealthData): ParsedHealthData {
  const lines = rawData.split("\n");
  const headers = lines[0]?.split(",").map(h => h.trim().toLowerCase());
  
  result.rawStructure = { headers, rowCount: lines.length - 1 };
  result.observations = [];
  
  for (let i = 1; i < lines.length && i <= 100; i++) {
    const values = lines[i].split(",");
    if (values.length >= 2) {
      result.observations.push({
        id: randomUUID(),
        displayText: headers?.[0] || "Unknown",
        value: values[1]?.trim(),
        effectiveDate: values[0]?.trim(),
      });
    }
  }
  
  return result;
}

function parseGenericJSON(rawData: string, result: ParsedHealthData): ParsedHealthData {
  try {
    result.rawStructure = JSON.parse(rawData);
  } catch {
    result.rawStructure = { error: "Invalid JSON" };
  }
  return result;
}

async function parseWithAI(rawData: string, result: ParsedHealthData): Promise<ParsedHealthData> {
  const openai = getOpenAI();
  if (!openai) {
    console.warn("[DataIngestion] OpenAI not available, skipping AI parsing");
    return result;
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a healthcare data parsing assistant. Extract structured health information from unstructured data.
          
STRICT RULES:
- Extract only factual data present in the input
- Do not interpret, diagnose, or make clinical recommendations
- Return valid JSON matching the expected schema
- Include confidence scores for each extraction

Output JSON schema:
{
  "patient": { "name": string, "birthDate": string, "gender": string },
  "conditions": [{ "displayText": string, "confidence": number }],
  "medications": [{ "displayText": string, "dosage": string, "confidence": number }],
  "observations": [{ "displayText": string, "value": string, "unit": string, "confidence": number }],
  "procedures": [{ "displayText": string, "date": string, "confidence": number }]
}`
        },
        {
          role: "user",
          content: `Parse this health data and extract structured information:\n\n${rawData.substring(0, 4000)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    if (parsed.patient) result.patient = parsed.patient;
    if (parsed.conditions) result.conditions = parsed.conditions;
    if (parsed.medications) result.medications = parsed.medications;
    if (parsed.observations) result.observations = parsed.observations;
    if (parsed.procedures) result.procedures = parsed.procedures;
    
  } catch (e) {
    console.error("[DataIngestion] AI parsing failed:", e);
  }
  
  return result;
}

async function extractEntitiesWithAI(job: IngestionJob): Promise<ExtractedEntities> {
  const entities: ExtractedEntities = {
    diagnoses: [],
    medications: [],
    procedures: [],
    labResults: [],
    vitalSigns: [],
    allergies: [],
    immunizations: [],
    socialHistory: [],
    familyHistory: [],
  };
  
  if (!job.parsedData) return entities;
  
  if (job.parsedData.conditions) {
    entities.diagnoses = job.parsedData.conditions.map(c => ({
      text: c.displayText,
      type: "diagnosis",
      code: c.code,
      codeSystem: c.codeSystem,
      confidence: 0.9,
    }));
  }
  
  if (job.parsedData.medications) {
    entities.medications = job.parsedData.medications.map(m => ({
      text: m.displayText,
      type: "medication",
      code: m.code,
      codeSystem: m.codeSystem,
      confidence: 0.9,
    }));
  }
  
  if (job.parsedData.procedures) {
    entities.procedures = job.parsedData.procedures.map(p => ({
      text: p.displayText,
      type: "procedure",
      code: p.code,
      codeSystem: p.codeSystem,
      confidence: 0.9,
    }));
  }
  
  if (job.parsedData.observations) {
    for (const obs of job.parsedData.observations) {
      const isVital = ["blood pressure", "heart rate", "temperature", "weight", "height", "bmi", "respiratory rate", "oxygen saturation"]
        .some(v => obs.displayText?.toLowerCase().includes(v));
      
      if (isVital) {
        entities.vitalSigns.push({
          text: obs.displayText,
          type: "vital_sign",
          code: obs.code,
          confidence: 0.85,
          normalizedValue: obs.value ? `${obs.value} ${obs.unit || ""}`.trim() : undefined,
        });
      } else {
        entities.labResults.push({
          text: obs.displayText,
          type: "lab_result",
          code: obs.code,
          confidence: 0.85,
          normalizedValue: obs.value ? `${obs.value} ${obs.unit || ""}`.trim() : undefined,
        });
      }
    }
  }
  
  const openai = getOpenAI();
  if (openai) {
    try {
      const dataPreview = JSON.stringify(job.parsedData).substring(0, 3000);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical entity extraction assistant. Extract additional entities not already captured.
            
STRICT RULES:
- Extract only factual data present in the input
- Do not interpret, diagnose, or make clinical recommendations
- Focus on: allergies, immunizations, social history, family history
- Return valid JSON with confidence scores (0-1)

Output JSON:
{
  "allergies": [{ "text": string, "type": "allergy", "confidence": number }],
  "immunizations": [{ "text": string, "type": "immunization", "confidence": number }],
  "socialHistory": [{ "text": string, "type": "social_history", "confidence": number }],
  "familyHistory": [{ "text": string, "type": "family_history", "confidence": number }]
}`
          },
          {
            role: "user",
            content: `Extract additional medical entities from this parsed health data:\n\n${dataPreview}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      
      const extracted = JSON.parse(response.choices[0]?.message?.content || "{}");
      
      if (extracted.allergies) entities.allergies = extracted.allergies;
      if (extracted.immunizations) entities.immunizations = extracted.immunizations;
      if (extracted.socialHistory) entities.socialHistory = extracted.socialHistory;
      if (extracted.familyHistory) entities.familyHistory = extracted.familyHistory;
      
    } catch (e) {
      console.error("[DataIngestion] AI entity extraction failed:", e);
    }
  }
  
  return entities;
}

async function normalizeToFHIR(job: IngestionJob): Promise<NormalizedFHIRResources> {
  const resources: NormalizedFHIRResources = {
    encounters: [],
    conditions: [],
    medications: [],
    observations: [],
    procedures: [],
    imagingStudies: [],
    documentReferences: [],
    allergies: [],
    immunizations: [],
  };
  
  if (!job.parsedData) return resources;
  
  if (job.parsedData.patient) {
    resources.patient = {
      resourceType: "Patient",
      id: job.parsedData.patient.id || randomUUID(),
      identifier: job.parsedData.patient.identifiers?.map(id => ({
        system: id.system,
        value: id.value,
      })),
      name: job.parsedData.patient.name ? [{
        family: job.parsedData.patient.name.family,
        given: job.parsedData.patient.name.given,
      }] : undefined,
      birthDate: job.parsedData.patient.birthDate,
      gender: job.parsedData.patient.gender,
    };
  }
  
  if (job.parsedData.conditions) {
    resources.conditions = job.parsedData.conditions.map(c => ({
      resourceType: "Condition",
      id: c.id || randomUUID(),
      code: {
        coding: c.code ? [{
          system: c.codeSystem || "http://snomed.info/sct",
          code: c.code,
          display: c.displayText,
        }] : undefined,
        text: c.displayText,
      },
      clinicalStatus: c.clinicalStatus ? {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: c.clinicalStatus,
        }],
      } : undefined,
      onsetDateTime: c.onsetDate,
      recordedDate: c.recordedDate,
    }));
  }
  
  if (job.parsedData.observations) {
    resources.observations = job.parsedData.observations.map(o => ({
      resourceType: "Observation",
      id: o.id || randomUUID(),
      status: o.status || "final",
      code: {
        coding: o.code ? [{
          system: o.codeSystem || "http://loinc.org",
          code: o.code,
          display: o.displayText,
        }] : undefined,
        text: o.displayText,
      },
      valueQuantity: o.value && o.unit ? {
        value: parseFloat(o.value) || undefined,
        unit: o.unit,
      } : undefined,
      valueString: o.value && !o.unit ? o.value : undefined,
      effectiveDateTime: o.effectiveDate,
    }));
  }
  
  if (job.parsedData.medications) {
    resources.medications = job.parsedData.medications.map(m => ({
      resourceType: "MedicationStatement",
      id: m.id || randomUUID(),
      status: m.status || "active",
      medicationCodeableConcept: {
        coding: m.code ? [{
          system: m.codeSystem || "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: m.code,
          display: m.displayText,
        }] : undefined,
        text: m.displayText,
      },
      dosage: m.dosage ? [{
        text: m.dosage,
        route: m.route ? { text: m.route } : undefined,
      }] : undefined,
    }));
  }
  
  if (job.parsedData.procedures) {
    resources.procedures = job.parsedData.procedures.map(p => ({
      resourceType: "Procedure",
      id: p.id || randomUUID(),
      status: p.status || "completed",
      code: {
        coding: p.code ? [{
          system: p.codeSystem || "http://snomed.info/sct",
          code: p.code,
          display: p.displayText,
        }] : undefined,
        text: p.displayText,
      },
      performedDateTime: p.performedDate,
    }));
  }
  
  if (job.parsedData.imagingStudies) {
    resources.imagingStudies = job.parsedData.imagingStudies.map(i => ({
      resourceType: "ImagingStudy",
      id: i.id || randomUUID(),
      status: "available",
      modality: [{ code: i.modality }],
      started: i.studyDate,
      description: i.description,
      numberOfSeries: i.numberOfSeries,
      numberOfInstances: i.numberOfInstances,
    }));
  }
  
  if (job.extractedEntities?.allergies) {
    resources.allergies = job.extractedEntities.allergies.map(a => ({
      resourceType: "AllergyIntolerance",
      id: randomUUID(),
      clinicalStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }],
      },
      code: { text: a.text },
    }));
  }
  
  if (job.extractedEntities?.immunizations) {
    resources.immunizations = job.extractedEntities.immunizations.map(i => ({
      resourceType: "Immunization",
      id: randomUUID(),
      status: "completed",
      vaccineCode: { text: i.text },
    }));
  }
  
  return resources;
}

async function validateResources(job: IngestionJob): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  if (!job.normalizedResources) return results;
  
  if (job.normalizedResources.patient) {
    results.push(validateFHIRResource(job.normalizedResources.patient, "Patient"));
  }
  
  for (const condition of job.normalizedResources.conditions) {
    results.push(validateFHIRResource(condition, "Condition"));
  }
  
  for (const obs of job.normalizedResources.observations) {
    results.push(validateFHIRResource(obs, "Observation"));
  }
  
  for (const med of job.normalizedResources.medications) {
    results.push(validateFHIRResource(med, "MedicationStatement"));
  }
  
  return results;
}

function validateFHIRResource(resource: Record<string, unknown>, resourceType: string): ValidationResult {
  const result: ValidationResult = {
    resourceType,
    resourceId: resource.id as string,
    valid: true,
    errors: [],
    warnings: [],
  };
  
  if (!resource.id) {
    result.warnings.push({
      path: "id",
      message: "Resource is missing an id",
      severity: "warning",
    });
  }
  
  if (resourceType === "Observation") {
    if (!resource.status) {
      result.errors.push({
        path: "status",
        message: "Observation.status is required",
        severity: "error",
      });
      result.valid = false;
    }
    if (!resource.code) {
      result.errors.push({
        path: "code",
        message: "Observation.code is required",
        severity: "error",
      });
      result.valid = false;
    }
  }
  
  if (resourceType === "Condition") {
    if (!resource.code) {
      result.warnings.push({
        path: "code",
        message: "Condition should have a code",
        severity: "warning",
      });
    }
  }
  
  return result;
}

function countResources(resources?: NormalizedFHIRResources): number {
  if (!resources) return 0;
  return (
    (resources.patient ? 1 : 0) +
    resources.encounters.length +
    resources.conditions.length +
    resources.medications.length +
    resources.observations.length +
    resources.procedures.length +
    resources.imagingStudies.length +
    resources.documentReferences.length +
    resources.allergies.length +
    resources.immunizations.length
  );
}

export function getIngestionJob(jobId: string): IngestionJob | undefined {
  return ingestionJobs.get(jobId);
}

export function getIngestionJobsByUser(userId: string): IngestionJob[] {
  return Array.from(ingestionJobs.values())
    .filter(j => j.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getIngestionSummary(jobId: string): IngestionSummary | null {
  const job = ingestionJobs.get(jobId);
  if (!job) return null;
  
  const resources = job.normalizedResources;
  const validations = job.validationResults || [];
  
  const totalResources = countResources(resources);
  const validResources = validations.filter(v => v.valid).length;
  const errorCount = validations.reduce((sum, v) => sum + v.errors.length, 0);
  const warningCount = validations.reduce((sum, v) => sum + v.warnings.length, 0);
  
  const avgConfidence = job.extractedEntities
    ? Object.values(job.extractedEntities)
        .flat()
        .reduce((sum, e) => sum + (e.confidence || 0), 0) /
      Math.max(1, Object.values(job.extractedEntities).flat().length)
    : 0;
  
  return {
    jobId: job.id,
    status: job.status,
    format: job.format,
    resourceCounts: {
      patients: resources?.patient ? 1 : 0,
      encounters: resources?.encounters.length || 0,
      conditions: resources?.conditions.length || 0,
      medications: resources?.medications.length || 0,
      observations: resources?.observations.length || 0,
      procedures: resources?.procedures.length || 0,
      imagingStudies: resources?.imagingStudies.length || 0,
      documents: resources?.documentReferences.length || 0,
      allergies: resources?.allergies.length || 0,
      immunizations: resources?.immunizations.length || 0,
    },
    validationSummary: {
      totalResources,
      validResources,
      errorCount,
      warningCount,
    },
    processingTimeMs: job.processingTimeMs || 0,
    aiConfidenceScore: avgConfidence,
  };
}

export async function getSupportedFormats(): Promise<{ format: DataFormat; description: string; extensions: string[] }[]> {
  return [
    { format: "fhir_r4", description: "FHIR R4 Bundle or Resource", extensions: [".json"] },
    { format: "hl7_v2", description: "HL7 v2.x Messages (ADT, ORU, ORM, etc.)", extensions: [".hl7", ".txt"] },
    { format: "ccd", description: "Continuity of Care Document", extensions: [".xml"] },
    { format: "ccda", description: "Consolidated Clinical Document Architecture", extensions: [".xml"] },
    { format: "dicom", description: "DICOM Imaging Metadata", extensions: [".dcm"] },
    { format: "csv", description: "CSV Health Data (labs, vitals)", extensions: [".csv"] },
    { format: "pdf", description: "PDF Clinical Documents (OCR required)", extensions: [".pdf"] },
    { format: "json", description: "Generic JSON Health Data", extensions: [".json"] },
  ];
}
