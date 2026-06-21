export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ family?: string; given?: string[]; use?: string }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{ system?: string; value?: string }>;
  address?: Array<{ line?: string[]; city?: string; state?: string; postalCode?: string }>;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  [key: string]: unknown;
}

export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: string;
  code: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  subject?: { reference?: string };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string };
  valueCodeableConcept?: { coding?: Array<{ code?: string; display?: string }> };
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  [key: string]: unknown;
}

export interface FhirCondition {
  resourceType: "Condition";
  id: string;
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  subject?: { reference?: string };
  onsetDateTime?: string;
  recordedDate?: string;
  [key: string]: unknown;
}

export interface FhirMedication {
  resourceType: "Medication";
  id: string;
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  status?: string;
  form?: { coding?: Array<{ code?: string; display?: string }> };
  [key: string]: unknown;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  medicationReference?: { reference?: string };
  subject?: { reference?: string };
  authoredOn?: string;
  dosageInstruction?: Array<{ text?: string; timing?: { repeat?: { frequency?: number; period?: number } } }>;
  [key: string]: unknown;
}

export interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id: string;
  status: string;
  code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  subject?: { reference?: string };
  effectiveDateTime?: string;
  issued?: string;
  result?: Array<{ reference?: string }>;
  conclusion?: string;
  [key: string]: unknown;
}

export interface FhirImmunization {
  resourceType: "Immunization";
  id: string;
  status: string;
  vaccineCode: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  patient?: { reference?: string };
  occurrenceDateTime?: string;
  lotNumber?: string;
  [key: string]: unknown;
}

export interface FhirProcedure {
  resourceType: "Procedure";
  id: string;
  status: string;
  code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  subject?: { reference?: string };
  performedDateTime?: string;
  performedPeriod?: { start?: string; end?: string };
  [key: string]: unknown;
}

export interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status: string;
  class: { system?: string; code?: string; display?: string };
  type?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  subject?: { reference?: string };
  participant?: Array<{ individual?: { reference?: string; display?: string }; type?: Array<{ coding?: Array<{ code?: string; display?: string }> }> }>;
  period?: { start?: string; end?: string };
  reasonCode?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  location?: Array<{ location?: { reference?: string; display?: string } }>;
  serviceProvider?: { reference?: string; display?: string };
  hospitalization?: { dischargeDisposition?: { coding?: Array<{ code?: string; display?: string }> } };
  [key: string]: unknown;
}

export interface FhirMedicationStatement {
  resourceType: "MedicationStatement";
  id: string;
  status: string;
  medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  medicationReference?: { reference?: string };
  subject?: { reference?: string };
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
  dateAsserted?: string;
  informationSource?: { reference?: string };
  reasonCode?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  dosage?: Array<{ text?: string; timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } } }>;
  [key: string]: unknown;
}

export interface FhirCarePlan {
  resourceType: "CarePlan";
  id: string;
  status: string;
  intent: string;
  title?: string;
  description?: string;
  subject?: { reference?: string };
  period?: { start?: string; end?: string };
  activity?: Array<{ detail?: { description?: string; status?: string } }>;
  [key: string]: unknown;
}

export interface FhirAllergyIntolerance {
  resourceType: "AllergyIntolerance";
  id: string;
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  patient?: { reference?: string };
  onsetDateTime?: string;
  reaction?: Array<{ manifestation?: Array<{ coding?: Array<{ display?: string }> }>; severity?: string }>;
  [key: string]: unknown;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
  };
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: "Bundle";
  type: "searchset" | "transaction" | "batch" | "history" | "collection";
  total?: number;
  entry?: Array<{
    resource: FhirResource;
    fullUrl?: string;
    search?: { mode?: string; score?: number };
  }>;
}

export interface FhirSearchParams {
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
  patient?: string;
  subject?: string;
  date?: string;
  code?: string;
  status?: string;
  category?: string;
  [key: string]: unknown;
}

export interface IFhirStore {
  readonly providerName: string;
  readonly isConnected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }>;

  createResource<T extends FhirResource>(resourceType: string, resource: T): Promise<T>;
  readResource<T extends FhirResource>(resourceType: string, id: string): Promise<T | null>;
  updateResource<T extends FhirResource>(resourceType: string, id: string, resource: T): Promise<T>;
  deleteResource(resourceType: string, id: string): Promise<boolean>;
  searchResources<T extends FhirResource>(resourceType: string, params: FhirSearchParams): Promise<FhirBundle>;

  getPatient(patientId: string): Promise<FhirPatient | null>;
  getPatientObservations(patientId: string, category?: string): Promise<FhirObservation[]>;
  getPatientConditions(patientId: string): Promise<FhirCondition[]>;
  getPatientMedications(patientId: string): Promise<FhirMedication[]>;
  getPatientMedicationRequests(patientId: string): Promise<FhirMedicationRequest[]>;
  getPatientDiagnosticReports(patientId: string): Promise<FhirDiagnosticReport[]>;
  getPatientImmunizations(patientId: string): Promise<FhirImmunization[]>;
  getPatientProcedures(patientId: string): Promise<FhirProcedure[]>;
  getPatientCarePlans(patientId: string): Promise<FhirCarePlan[]>;
  getPatientAllergies(patientId: string): Promise<FhirAllergyIntolerance[]>;
  getPatientEncounters(patientId: string): Promise<FhirEncounter[]>;
  getPatientMedicationStatements(patientId: string): Promise<FhirMedicationStatement[]>;
  getPatientTimeline(patientId: string): Promise<Array<{
    id: string;
    type: "encounter" | "observation" | "medication" | "procedure" | "condition" | "immunization" | "diagnostic_report";
    date: string;
    title: string;
    description?: string;
    category?: string;
    status?: string;
    provider?: string;
    resource: FhirResource;
  }>>;

  exportToBigQuery?(datasetId: string, tablePrefix: string): Promise<{ jobId: string; status: string }>;
}

export interface AnalyticsQuery {
  sql?: string;
  table?: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface AnalyticsResult {
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
  bytesProcessed?: number;
  cacheHit?: boolean;
}

export interface PopulationHealthMetrics {
  totalPatients: number;
  avgAge: number;
  genderDistribution: Record<string, number>;
  topConditions: Array<{ code: string; display: string; count: number }>;
  topMedications: Array<{ code: string; display: string; count: number }>;
  riskDistribution: Record<string, number>;
  adherenceRate: number;
  readmissionRate: number;
}

export interface CohortDefinition {
  id: string;
  name: string;
  description?: string;
  criteria: {
    ageRange?: { min?: number; max?: number };
    gender?: string[];
    conditions?: string[];
    medications?: string[];
    riskLevel?: string[];
    dateRange?: { start?: string; end?: string };
  };
}

export interface BatchExportJob {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  resourceTypes: string[];
  patientIds?: string[];
  deIdentify: boolean;
  format: "fhir_ndjson" | "csv" | "parquet";
  destination: {
    type: "bigquery" | "gcs" | "s3";
    path: string;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  recordsExported?: number;
  error?: string;
}

export interface SyncHookConfig {
  enabled: boolean;
  resourceTypes: string[];
  destination: "bigquery" | "analytics_store";
  deIdentify: boolean;
  batchSize: number;
  flushIntervalMs: number;
}

export interface IAnalyticsStore {
  readonly providerName: string;
  readonly isConnected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }>;

  query(query: AnalyticsQuery): Promise<AnalyticsResult>;
  getPopulationHealthMetrics(cohortId?: string): Promise<PopulationHealthMetrics>;
  getCohort(definition: CohortDefinition): Promise<string[]>;

  insertData(table: string, rows: Record<string, unknown>[]): Promise<{ insertedCount: number }>;
  createTable(table: string, schema: Array<{ name: string; type: string; mode?: string }>): Promise<boolean>;

  getLabTrends(patientId: string, labCodes: string[], months: number): Promise<AnalyticsResult>;
  getVitalTrends(patientId: string, vitalTypes: string[], months: number): Promise<AnalyticsResult>;
  getAdherenceTrends(patientId: string, months: number): Promise<AnalyticsResult>;
  getMedicationSafetyMetrics(): Promise<AnalyticsResult>;

  createBatchExportJob?(job: Omit<BatchExportJob, "jobId" | "status" | "createdAt">): Promise<BatchExportJob>;
  getBatchExportJob?(jobId: string): Promise<BatchExportJob | null>;
  listBatchExportJobs?(status?: BatchExportJob["status"]): Promise<BatchExportJob[]>;
}

export interface RiskPrediction {
  patientId: string;
  riskType: string;
  score: number;
  confidence: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  factors: Array<{ name: string; contribution: number; description: string }>;
  recommendations: string[];
  predictedAt: string;
  modelVersion: string;
}

export interface RiskModelInput {
  patientId: string;
  demographics: {
    age: number;
    gender: string;
    race?: string;
    ethnicity?: string;
  };
  conditions: Array<{ code: string; display: string; onsetDate?: string }>;
  medications: Array<{ code: string; display: string; status: string }>;
  vitals: Array<{ code: string; value: number; unit: string; date: string }>;
  labs: Array<{ code: string; value: number; unit: string; date: string }>;
  socialHistory?: {
    smokingStatus?: string;
    alcoholUse?: string;
    exerciseFrequency?: string;
  };
}

export type RiskType =
  | "cardiovascular"
  | "diabetes"
  | "readmission"
  | "falls"
  | "medication_adherence"
  | "hospitalization"
  | "sepsis"
  | "deterioration";

export interface IRiskModel {
  readonly providerName: string;
  readonly isConnected: boolean;
  readonly supportedRiskTypes: RiskType[];

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }>;

  predictRisk(input: RiskModelInput, riskType: RiskType): Promise<RiskPrediction>;
  predictAllRisks(input: RiskModelInput): Promise<RiskPrediction[]>;
  batchPredict(inputs: RiskModelInput[], riskType: RiskType): Promise<RiskPrediction[]>;

  getModelInfo(riskType: RiskType): Promise<{
    modelId: string;
    version: string;
    accuracy: number;
    lastTrained: string;
    features: string[];
  }>;

  explainPrediction(prediction: RiskPrediction): Promise<{
    reasoning: string;
    evidenceCitations: Array<{ source: string; relevance: number }>;
    alternativeOutcomes: Array<{ outcome: string; probability: number }>;
  }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  action: "create" | "read" | "update" | "delete" | "search" | "export" | "access";
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  responseStatus: number;
  responseTimeMs: number;
  phiAccessed: boolean;
  accessReason?: string;
  details?: Record<string, unknown>;
}

export interface IAuditLogger {
  readonly providerName: string;

  log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void>;
  logPhiAccess(userId: string, userRole: string, patientId: string, resourceType: string, reason?: string): Promise<void>;

  query(filters: {
    userId?: string;
    patientId?: string;
    resourceType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    phiAccessedOnly?: boolean;
  }): Promise<AuditLogEntry[]>;

  getAccessReport(patientId: string, dateRange: { start: string; end: string }): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    entries: AuditLogEntry[];
  }>;
}

export interface IntegrationConfig {
  fhirProvider: "cloud_healthcare_api" | "aidbox" | "mock";
  analyticsProvider: "bigquery" | "mock";
  riskModelProvider: "vertex_ai" | "mock";
  auditProvider: "cloud_logging" | "database" | "mock";

  gcp?: {
    projectId: string;
    location: string;
    datasetId?: string;
    fhirStoreId?: string;
    bigQueryDataset?: string;
    vertexAiEndpoint?: string;
    credentialsPath?: string;
  };

  aidbox?: {
    url: string;
    clientId: string;
    clientSecret: string;
  };

  hipaaCompliance: {
    enableAuditLogging: boolean;
    enablePhiTracking: boolean;
    enableEncryption: boolean;
    dataRetentionDays: number;
  };
}

export interface IntegrationHealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  fhirStore: { status: "healthy" | "unhealthy"; latencyMs: number; provider: string };
  analytics: { status: "healthy" | "unhealthy"; latencyMs: number; provider: string };
  riskModel: { status: "healthy" | "unhealthy"; latencyMs: number; provider: string };
  audit: { status: "healthy" | "unhealthy"; provider: string };
  lastChecked: string;
}
