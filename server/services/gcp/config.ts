import type { IntegrationConfig } from "../integrations/interfaces";

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return "";
  }
  return value;
}

function getEnvVarRequired(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function getBoolEnv(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name]?.toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return defaultValue;
}

function getIntEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function isGcpConfigured(): boolean {
  return !!(
    process.env.GCP_PROJECT_ID &&
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  );
}

export function isAidboxConfigured(): boolean {
  return !!(
    process.env.AIDBOX_URL &&
    process.env.AIDBOX_CLIENT_ID &&
    process.env.AIDBOX_CLIENT_SECRET
  );
}

export function getIntegrationConfig(): IntegrationConfig {
  const gcpConfigured = isGcpConfigured();
  const aidboxConfigured = isAidboxConfigured();

  const fhirProviderEnv = getEnvVar("FHIR_PROVIDER", "mock");
  let fhirProvider: IntegrationConfig["fhirProvider"] = "mock";
  if (fhirProviderEnv === "cloud_healthcare_api" && gcpConfigured) {
    fhirProvider = "cloud_healthcare_api";
  } else if (fhirProviderEnv === "aidbox" && aidboxConfigured) {
    fhirProvider = "aidbox";
  }

  const analyticsProviderEnv = getEnvVar("ANALYTICS_PROVIDER", "mock");
  let analyticsProvider: IntegrationConfig["analyticsProvider"] = "mock";
  if (analyticsProviderEnv === "bigquery" && gcpConfigured) {
    analyticsProvider = "bigquery";
  }

  const riskModelProviderEnv = getEnvVar("RISK_MODEL_PROVIDER", "mock");
  let riskModelProvider: IntegrationConfig["riskModelProvider"] = "mock";
  if (riskModelProviderEnv === "vertex_ai" && gcpConfigured) {
    riskModelProvider = "vertex_ai";
  }

  const auditProviderEnv = getEnvVar("AUDIT_PROVIDER", "mock");
  let auditProvider: IntegrationConfig["auditProvider"] = "mock";
  if (auditProviderEnv === "cloud_logging" && gcpConfigured) {
    auditProvider = "cloud_logging";
  } else if (auditProviderEnv === "database") {
    auditProvider = "database";
  }

  const config: IntegrationConfig = {
    fhirProvider,
    analyticsProvider,
    riskModelProvider,
    auditProvider,

    hipaaCompliance: {
      enableAuditLogging: getBoolEnv("HIPAA_AUDIT_LOGGING", true),
      enablePhiTracking: getBoolEnv("HIPAA_PHI_TRACKING", true),
      enableEncryption: getBoolEnv("HIPAA_ENCRYPTION", true),
      dataRetentionDays: getIntEnv("HIPAA_DATA_RETENTION_DAYS", 2555),
    },
  };

  if (gcpConfigured) {
    config.gcp = {
      projectId: getEnvVar("GCP_PROJECT_ID", ""),
      location: getEnvVar("GCP_LOCATION", "us-central1"),
      datasetId: getEnvVar("GCP_HEALTHCARE_DATASET_ID"),
      fhirStoreId: getEnvVar("GCP_FHIR_STORE_ID"),
      bigQueryDataset: getEnvVar("GCP_BIGQUERY_DATASET", "healthcare_analytics"),
      vertexAiEndpoint: getEnvVar("GCP_VERTEX_AI_ENDPOINT"),
      credentialsPath: getEnvVar("GOOGLE_APPLICATION_CREDENTIALS"),
    };
  }

  if (aidboxConfigured) {
    config.aidbox = {
      url: getEnvVar("AIDBOX_URL", ""),
      clientId: getEnvVar("AIDBOX_CLIENT_ID", ""),
      clientSecret: getEnvVar("AIDBOX_CLIENT_SECRET", ""),
    };
  }

  return config;
}

export function logConfigurationStatus(): void {
  const config = getIntegrationConfig();

  console.log("=== GCP Healthcare Integration Configuration ===");
  console.log(`FHIR Provider: ${config.fhirProvider}`);
  console.log(`Analytics Provider: ${config.analyticsProvider}`);
  console.log(`Risk Model Provider: ${config.riskModelProvider}`);
  console.log(`Audit Provider: ${config.auditProvider}`);

  if (config.gcp) {
    console.log(`GCP Project: ${config.gcp.projectId}`);
    console.log(`GCP Location: ${config.gcp.location}`);
    console.log(`Healthcare Dataset: ${config.gcp.datasetId || "not configured"}`);
    console.log(`FHIR Store: ${config.gcp.fhirStoreId || "not configured"}`);
    console.log(`BigQuery Dataset: ${config.gcp.bigQueryDataset || "not configured"}`);
  } else {
    console.log("GCP: Not configured (using mock providers)");
  }

  if (config.aidbox) {
    console.log(`Aidbox URL: ${config.aidbox.url}`);
  }

  console.log("HIPAA Compliance:");
  console.log(`  Audit Logging: ${config.hipaaCompliance.enableAuditLogging}`);
  console.log(`  PHI Tracking: ${config.hipaaCompliance.enablePhiTracking}`);
  console.log(`  Encryption: ${config.hipaaCompliance.enableEncryption}`);
  console.log(`  Data Retention: ${config.hipaaCompliance.dataRetentionDays} days`);
  console.log("=================================================");
}

export const GCP_FHIR_RESOURCE_TYPES = [
  "Patient",
  "Observation",
  "Condition",
  "Medication",
  "MedicationRequest",
  "DiagnosticReport",
  "Immunization",
  "Procedure",
  "CarePlan",
  "AllergyIntolerance",
  "Encounter",
  "Practitioner",
  "Organization",
  "DocumentReference",
  "Consent",
] as const;

export type GcpFhirResourceType = (typeof GCP_FHIR_RESOURCE_TYPES)[number];

export const BIGQUERY_HEALTHCARE_TABLES = {
  patients: "patients",
  observations: "observations",
  conditions: "conditions",
  medications: "medications",
  medicationRequests: "medication_requests",
  diagnosticReports: "diagnostic_reports",
  immunizations: "immunizations",
  procedures: "procedures",
  carePlans: "care_plans",
  allergies: "allergy_intolerances",
  encounters: "encounters",
  auditLogs: "audit_logs",
  riskPredictions: "risk_predictions",
  analyticsSnapshots: "analytics_snapshots",
} as const;

export const VERTEX_AI_MODELS = {
  cardiovascular: "cardiovascular-risk-v1",
  diabetes: "diabetes-risk-v1",
  readmission: "readmission-risk-v1",
  falls: "falls-risk-v1",
  medication_adherence: "med-adherence-v1",
  hospitalization: "hospitalization-risk-v1",
  sepsis: "sepsis-risk-v1",
  deterioration: "deterioration-risk-v1",
} as const;
