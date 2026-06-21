import crypto from "crypto";
import type { SupportedLanguage } from "./unified-ai-onboarding-service";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, integrationId: string, details: string) {
  console.log(`[HIPAA-AUDIT][HealthDataIntegration] ${action} - Integration:${integrationId} - User:${hashIdentifier(userId)} - ${details}`);
}

export type IntegrationType = 
  | "ehr_fastenhealth"
  | "lab_quest" | "lab_labcorp" | "lab_hospital" | "lab_custom"
  | "dicom_pacs" | "dicom_vendor" | "dicom_cloud"
  | "pharmacy_cvs" | "pharmacy_walgreens" | "pharmacy_custom"
  | "surescripts_eligibility" | "surescripts_medication_history" | "surescripts_formulary"
  | "pbm_express_scripts" | "pbm_cvs_caremark" | "pbm_optumrx" | "pbm_custom"
  | "payer_medicare" | "payer_medicaid" | "payer_commercial" | "payer_exchange"
  | "cms_bluebutton" | "commonwell" | "carequality";

export type AuthMethod = "smart_on_fhir" | "oauth2" | "api_key" | "mtls" | "basic" | "saml";
export type ConnectionState = "active" | "inactive" | "error" | "pending_auth" | "expired" | "revoked";
export type DataFormat = "fhir_r4" | "fhir_stu3" | "hl7v2" | "ccd" | "ccda" | "dicom" | "ncpdp" | "x12" | "custom";

export interface HealthDataIntegration {
  id: string;
  userId: string;
  type: IntegrationType;
  displayName: string;
  description: string;
  endpoint: string;
  authMethod: AuthMethod;
  state: ConnectionState;
  dataFormats: DataFormat[];
  supportedResources: string[];
  lastSyncAt?: string;
  nextScheduledSync?: string;
  syncFrequency: "realtime" | "hourly" | "daily" | "weekly" | "manual";
  syncEnabled: boolean;
  errorMessage?: string;
  errorCount: number;
  metadata: IntegrationMetadata;
  permissions: IntegrationPermissions;
  auditLog: IntegrationAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationMetadata {
  providerName?: string;
  facilityName?: string;
  facilityNPI?: string;
  patientMRN?: string;
  insurerId?: string;
  pharmacyNCPDP?: string;
  labCLIA?: string;
  customFields?: Record<string, string>;
}

export interface IntegrationPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  dataCategories: string[];
  consentGrantedAt?: string;
  consentExpiresAt?: string;
  consentDocumentId?: string;
  granularPermissions?: Record<string, boolean>;
}

export interface IntegrationAuditEntry {
  id: string;
  action: "connect" | "disconnect" | "sync" | "error" | "permission_change" | "data_access";
  timestamp: string;
  details: string;
  resourceType?: string;
  resourceCount?: number;
  errorMessage?: string;
  userId: string;
}

export interface SyncResult {
  integrationId: string;
  syncId: string;
  startedAt: string;
  completedAt: string;
  status: "success" | "partial" | "failed";
  resourcesSynced: Record<string, number>;
  errors: SyncError[];
  newRecords: number;
  updatedRecords: number;
  duplicatesFound: number;
  conflictsResolved: number;
}

export interface SyncError {
  resourceType: string;
  resourceId?: string;
  errorCode: string;
  errorMessage: string;
  recoverable: boolean;
}

export interface EHRIntegrationConfig {
  ehrSystem: "fastenhealth";
  patientPortalUrl: string;
  fhirBaseUrl: string;
  smartAuthEndpoint: string;
  smartTokenEndpoint: string;
  supportedScopes: string[];
  clientId?: string;
  launchContext?: string;
}

export interface LabIntegrationConfig {
  labNetwork: "quest" | "labcorp" | "hospital" | "custom";
  orderingEnabled: boolean;
  resultsPushEnabled: boolean;
  resultsPullEnabled: boolean;
  supportedTestCodes: string[];
  specimenTypes: string[];
}

export interface DICOMIntegrationConfig {
  pacsEndpoint: string;
  aetitle: string;
  port: number;
  supportedModalities: string[];
  studyRetrievalMethods: ("WADO" | "DIMSE" | "DICOMweb")[];
  compressionSupported: boolean;
  tlsRequired: boolean;
}

export interface PharmacyIntegrationConfig {
  pharmacyChain: "cvs" | "walgreens" | "independent" | "mail_order" | "custom";
  ncpdpId: string;
  eRxEnabled: boolean;
  refillEnabled: boolean;
  transferEnabled: boolean;
  deliveryTracking: boolean;
  preferredPharmacy: boolean;
}

export interface SurescriptsConfig {
  serviceTypes: ("eligibility" | "medication_history" | "formulary" | "prior_auth" | "specialty")[];
  spiId: string;
  directAddress?: string;
  certificationLevel: "production" | "staging" | "certification";
  messageTypes: string[];
}

export interface PBMIntegrationConfig {
  pbmProvider: "express_scripts" | "cvs_caremark" | "optumrx" | "prime" | "custom";
  memberId: string;
  groupNumber: string;
  binNumber: string;
  pcnNumber: string;
  formularyAccess: boolean;
  priorAuthSupport: boolean;
  mailOrderEnabled: boolean;
  specialtyPharmacyAccess: boolean;
}

const integrations: Map<string, HealthDataIntegration> = new Map();
const syncResults: Map<string, SyncResult[]> = new Map();

const availableIntegrationTypes: Record<IntegrationType, { displayName: string; description: string; category: string }> = {
  ehr_fastenhealth: { displayName: "Fasten Health", description: "Connect to 25,000+ US healthcare providers via Fasten Health", category: "EHR" },
  lab_quest: { displayName: "Quest Diagnostics", description: "Connect to Quest lab results", category: "Labs" },
  lab_labcorp: { displayName: "Labcorp", description: "Connect to Labcorp lab results", category: "Labs" },
  lab_hospital: { displayName: "Hospital Lab", description: "Connect to hospital laboratory", category: "Labs" },
  lab_custom: { displayName: "Custom Lab", description: "Connect to other laboratory", category: "Labs" },
  dicom_pacs: { displayName: "Hospital PACS", description: "Connect to hospital imaging archive", category: "Imaging" },
  dicom_vendor: { displayName: "Imaging Vendor", description: "Connect to imaging vendor cloud", category: "Imaging" },
  dicom_cloud: { displayName: "Cloud Imaging", description: "Connect to cloud-based imaging", category: "Imaging" },
  pharmacy_cvs: { displayName: "CVS Pharmacy", description: "Connect to CVS prescription records", category: "Pharmacy" },
  pharmacy_walgreens: { displayName: "Walgreens", description: "Connect to Walgreens prescription records", category: "Pharmacy" },
  pharmacy_custom: { displayName: "Custom Pharmacy", description: "Connect to other pharmacy", category: "Pharmacy" },
  surescripts_eligibility: { displayName: "Surescripts Eligibility", description: "Prescription eligibility verification", category: "Surescripts" },
  surescripts_medication_history: { displayName: "Surescripts Medication History", description: "Comprehensive medication history", category: "Surescripts" },
  surescripts_formulary: { displayName: "Surescripts Formulary", description: "Formulary and coverage information", category: "Surescripts" },
  pbm_express_scripts: { displayName: "Express Scripts", description: "Connect to Express Scripts PBM", category: "PBM" },
  pbm_cvs_caremark: { displayName: "CVS Caremark", description: "Connect to CVS Caremark PBM", category: "PBM" },
  pbm_optumrx: { displayName: "OptumRx", description: "Connect to OptumRx PBM", category: "PBM" },
  pbm_custom: { displayName: "Custom PBM", description: "Connect to other PBM", category: "PBM" },
  payer_medicare: { displayName: "Medicare", description: "Connect to Medicare claims data", category: "Payer" },
  payer_medicaid: { displayName: "Medicaid", description: "Connect to Medicaid claims data", category: "Payer" },
  payer_commercial: { displayName: "Commercial Insurance", description: "Connect to commercial insurance data", category: "Payer" },
  payer_exchange: { displayName: "Exchange Plan", description: "Connect to exchange marketplace plan", category: "Payer" },
  cms_bluebutton: { displayName: "CMS Blue Button 2.0", description: "Connect to Medicare Blue Button API", category: "Federal" },
  commonwell: { displayName: "CommonWell Health Alliance", description: "Connect to CommonWell network", category: "HIE" },
  carequality: { displayName: "Carequality", description: "Connect to Carequality network", category: "HIE" },
};

export function getAvailableIntegrationTypes(): Record<IntegrationType, { displayName: string; description: string; category: string }> {
  return availableIntegrationTypes;
}

export function getIntegrationsByCategory(): Record<string, IntegrationType[]> {
  const byCategory: Record<string, IntegrationType[]> = {};
  for (const [type, info] of Object.entries(availableIntegrationTypes)) {
    if (!byCategory[info.category]) {
      byCategory[info.category] = [];
    }
    byCategory[info.category].push(type as IntegrationType);
  }
  return byCategory;
}

export async function createIntegration(
  userId: string,
  type: IntegrationType,
  config: {
    endpoint: string;
    authMethod: AuthMethod;
    syncFrequency: HealthDataIntegration["syncFrequency"];
    metadata?: IntegrationMetadata;
    permissions?: Partial<IntegrationPermissions>;
  }
): Promise<HealthDataIntegration> {
  const id = generateId("int");
  const typeInfo = availableIntegrationTypes[type];

  const integration: HealthDataIntegration = {
    id,
    userId,
    type,
    displayName: typeInfo.displayName,
    description: typeInfo.description,
    endpoint: config.endpoint,
    authMethod: config.authMethod,
    state: "pending_auth",
    dataFormats: getDefaultFormats(type),
    supportedResources: getDefaultResources(type),
    syncFrequency: config.syncFrequency,
    syncEnabled: false,
    errorCount: 0,
    metadata: config.metadata || {},
    permissions: {
      canRead: true,
      canWrite: false,
      canDelete: false,
      dataCategories: getDefaultDataCategories(type),
      ...config.permissions,
    },
    auditLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  integration.auditLog.push({
    id: generateId("audit"),
    action: "connect",
    timestamp: new Date().toISOString(),
    details: `Integration created for ${typeInfo.displayName}`,
    userId,
  });

  integrations.set(id, integration);
  logHipaaAudit("CREATE_INTEGRATION", userId, id, `Created ${type} integration`);

  return integration;
}

function getDefaultFormats(type: IntegrationType): DataFormat[] {
  if (type.startsWith("ehr_")) return ["fhir_r4", "ccda"];
  if (type.startsWith("lab_")) return ["fhir_r4", "hl7v2"];
  if (type.startsWith("dicom_")) return ["dicom"];
  if (type.startsWith("pharmacy_") || type.startsWith("pbm_")) return ["ncpdp", "fhir_r4"];
  if (type.startsWith("surescripts_")) return ["ncpdp", "x12"];
  if (type.startsWith("payer_") || type === "cms_bluebutton") return ["fhir_r4", "x12"];
  return ["fhir_r4"];
}

function getDefaultResources(type: IntegrationType): string[] {
  if (type.startsWith("ehr_")) {
    return ["Patient", "Condition", "MedicationRequest", "Observation", "Encounter", "AllergyIntolerance", "Immunization", "Procedure", "DiagnosticReport", "DocumentReference"];
  }
  if (type.startsWith("lab_")) {
    return ["DiagnosticReport", "Observation", "Specimen", "ServiceRequest"];
  }
  if (type.startsWith("dicom_")) {
    return ["ImagingStudy", "DiagnosticReport", "DocumentReference"];
  }
  if (type.startsWith("pharmacy_") || type.startsWith("pbm_") || type.startsWith("surescripts_")) {
    return ["MedicationRequest", "MedicationDispense", "Medication", "Coverage"];
  }
  if (type.startsWith("payer_") || type === "cms_bluebutton") {
    return ["ExplanationOfBenefit", "Coverage", "Patient", "Claim"];
  }
  return ["Patient"];
}

function getDefaultDataCategories(type: IntegrationType): string[] {
  if (type.startsWith("ehr_")) {
    return ["demographics", "conditions", "medications", "allergies", "labs", "vitals", "immunizations", "procedures", "encounters"];
  }
  if (type.startsWith("lab_")) {
    return ["labs", "diagnostic_reports"];
  }
  if (type.startsWith("dicom_")) {
    return ["imaging", "radiology"];
  }
  if (type.startsWith("pharmacy_") || type.startsWith("pbm_") || type.startsWith("surescripts_")) {
    return ["medications", "prescriptions", "coverage"];
  }
  if (type.startsWith("payer_") || type === "cms_bluebutton") {
    return ["claims", "coverage", "benefits"];
  }
  return ["general"];
}

export function getIntegration(integrationId: string): HealthDataIntegration | undefined {
  return integrations.get(integrationId);
}

export function getUserIntegrations(userId: string): HealthDataIntegration[] {
  const allIntegrations = Array.from(integrations.values());
  const userIntegrations = allIntegrations.filter(i => i.userId === userId);
  return userIntegrations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function updateIntegrationState(
  integrationId: string,
  userId: string,
  state: ConnectionState,
  errorMessage?: string
): Promise<HealthDataIntegration | undefined> {
  const integration = integrations.get(integrationId);
  if (!integration) return undefined;

  integration.state = state;
  integration.updatedAt = new Date().toISOString();
  
  if (state === "error") {
    integration.errorMessage = errorMessage;
    integration.errorCount++;
  } else if (state === "active") {
    integration.errorMessage = undefined;
    integration.syncEnabled = true;
  }

  integration.auditLog.push({
    id: generateId("audit"),
    action: state === "active" ? "connect" : state === "error" ? "error" : "disconnect",
    timestamp: new Date().toISOString(),
    details: `State changed to ${state}${errorMessage ? `: ${errorMessage}` : ""}`,
    errorMessage,
    userId,
  });

  logHipaaAudit("UPDATE_STATE", userId, integrationId, `State changed to ${state}`);
  return integration;
}

export async function syncIntegration(
  integrationId: string,
  userId: string
): Promise<SyncResult> {
  const integration = integrations.get(integrationId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const syncId = generateId("sync");
  const startedAt = new Date().toISOString();

  logHipaaAudit("START_SYNC", userId, integrationId, `Starting sync for ${integration.displayName}`);

  const resourcesSynced: Record<string, number> = {};
  const errors: SyncError[] = [];

  for (const resource of integration.supportedResources.slice(0, 5)) {
    const count = Math.floor(Math.random() * 20) + 1;
    resourcesSynced[resource] = count;
  }

  const result: SyncResult = {
    integrationId,
    syncId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: errors.length > 0 ? "partial" : "success",
    resourcesSynced,
    errors,
    newRecords: Object.values(resourcesSynced).reduce((a, b) => a + Math.floor(b * 0.3), 0),
    updatedRecords: Object.values(resourcesSynced).reduce((a, b) => a + Math.floor(b * 0.5), 0),
    duplicatesFound: Math.floor(Math.random() * 5),
    conflictsResolved: Math.floor(Math.random() * 2),
  };

  integration.lastSyncAt = result.completedAt;
  integration.updatedAt = result.completedAt;

  integration.auditLog.push({
    id: generateId("audit"),
    action: "sync",
    timestamp: result.completedAt,
    details: `Sync completed with status: ${result.status}`,
    resourceCount: Object.values(resourcesSynced).reduce((a, b) => a + b, 0),
    userId,
  });

  const userSyncResults = syncResults.get(userId) || [];
  userSyncResults.push(result);
  if (userSyncResults.length > 100) userSyncResults.shift();
  syncResults.set(userId, userSyncResults);

  logHipaaAudit("COMPLETE_SYNC", userId, integrationId, `Sync completed: ${result.newRecords} new, ${result.updatedRecords} updated`);

  return result;
}

export function getSyncHistory(userId: string, integrationId?: string): SyncResult[] {
  const results = syncResults.get(userId) || [];
  if (integrationId) {
    return results.filter(r => r.integrationId === integrationId);
  }
  return results;
}

export async function disconnectIntegration(
  integrationId: string,
  userId: string,
  reason?: string
): Promise<boolean> {
  const integration = integrations.get(integrationId);
  if (!integration) return false;

  integration.state = "inactive";
  integration.syncEnabled = false;
  integration.updatedAt = new Date().toISOString();

  integration.auditLog.push({
    id: generateId("audit"),
    action: "disconnect",
    timestamp: new Date().toISOString(),
    details: `Disconnected${reason ? `: ${reason}` : ""}`,
    userId,
  });

  logHipaaAudit("DISCONNECT", userId, integrationId, `Disconnected: ${reason || "No reason provided"}`);
  return true;
}

export function getIntegrationAuditLog(integrationId: string): IntegrationAuditEntry[] {
  const integration = integrations.get(integrationId);
  return integration?.auditLog || [];
}

console.log("[ComprehensiveHealthDataIntegrations] Service initialized with EHR, Labs, DICOM, Pharmacy, Surescripts, PBM support");
console.log("[ComprehensiveHealthDataIntegrations] NOTE: This is a DEVELOPMENT/MOCK implementation. Production deployments require:");
console.log("[ComprehensiveHealthDataIntegrations]   - Secure credential management (OAuth tokens, mTLS certificates)");
console.log("[ComprehensiveHealthDataIntegrations]   - Real-time token refresh and rotation");
console.log("[ComprehensiveHealthDataIntegrations]   - Encrypted credential storage with HSM/KMS");
console.log("[ComprehensiveHealthDataIntegrations]   - Production SMART on FHIR app registration with each EHR vendor");
