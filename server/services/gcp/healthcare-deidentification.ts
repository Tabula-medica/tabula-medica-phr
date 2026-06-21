import { healthcare } from "@googleapis/healthcare";
import { GoogleAuth } from "google-auth-library";

export interface DeidentifyTextRequest {
  text: string;
  infoTypes?: string[];
  maskingCharacter?: string;
}

export interface DeidentifyTextResponse {
  deidentifiedText: string;
  findings: DeidentifyFinding[];
  transformedBytes: number;
}

export interface DeidentifyFinding {
  infoType: string;
  likelihood: string;
  location: { startIndex: number; endIndex: number };
  replacedWith: string;
}

export interface DeidentifyFhirRequest {
  sourceDatasetId: string;
  sourceFhirStoreId: string;
  destinationDatasetId: string;
  destinationFhirStoreId: string;
  config: DeidentifyConfig;
}

export interface DeidentifyConfig {
  textRedactionMode: "redact_all_text" | "transform_text_entry" | "inspect_and_transform";
  infoTypesToRedact: string[];
  dateShiftDays?: number;
  cryptoHashKey?: string;
  preserveExtensions?: boolean;
}

export interface DeidentifyOperationStatus {
  operationId: string;
  status: "running" | "completed" | "failed";
  progress?: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

const HIPAA_INFO_TYPES = [
  "PERSON_NAME",
  "DATE_OF_BIRTH",
  "PHONE_NUMBER",
  "EMAIL_ADDRESS",
  "US_SOCIAL_SECURITY_NUMBER",
  "STREET_ADDRESS",
  "LOCATION",
  "AGE",
  "MEDICAL_RECORD_NUMBER",
  "HEALTH_PLAN_BENEFICIARY_NUMBER",
  "US_DRIVERS_LICENSE_NUMBER",
  "IP_ADDRESS",
  "URL",
  "DEVICE_ID",
  "VEHICLE_IDENTIFICATION_NUMBER",
  "ACCOUNT_NUMBER",
  "CERTIFICATE_NUMBER",
  "BIOMETRIC_IDENTIFIER",
  "FULL_FACE_PHOTO",
];

const PHI_PATTERNS: { pattern: RegExp; type: string; replacement: string }[] = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: "US_SOCIAL_SECURITY_NUMBER", replacement: "[SSN-REDACTED]" },
  { pattern: /\b\d{9}\b/g, type: "US_SOCIAL_SECURITY_NUMBER", replacement: "[SSN-REDACTED]" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: "EMAIL_ADDRESS", replacement: "[EMAIL-REDACTED]" },
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, type: "PHONE_NUMBER", replacement: "[PHONE-REDACTED]" },
  { pattern: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g, type: "DATE_OF_BIRTH", replacement: "[DATE-REDACTED]" },
  { pattern: /\b\d{1,5}\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi, type: "STREET_ADDRESS", replacement: "[ADDRESS-REDACTED]" },
  { pattern: /\bMRN[:\s#]*\d{4,12}\b/gi, type: "MEDICAL_RECORD_NUMBER", replacement: "[MRN-REDACTED]" },
  { pattern: /\b\d{1,3}\s*(?:year|yr|y\.?o\.?)[\s-]*old\b/gi, type: "AGE", replacement: "[AGE-REDACTED]" },
  { pattern: /\b(?:Mr|Mrs|Ms|Dr|Miss)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, type: "PERSON_NAME", replacement: "[NAME-REDACTED]" },
];

export class HealthcareDeidentificationService {
  private auth: GoogleAuth | null = null;
  private healthcareClient: any = null;
  private projectId: string;
  private location: string;
  private operations: Map<string, DeidentifyOperationStatus> = new Map();

  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "united-planet-485003-n7";
    this.location = process.env.GCP_LOCATION || "us-central1";
  }

  async initialize(): Promise<boolean> {
    try {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        console.log("[HealthcareDeidentification] No GCP credentials — using local PHI scrubbing mode");
        return false;
      }
      this.auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      this.healthcareClient = healthcare({ version: "v1", auth: this.auth });
      console.log("[HealthcareDeidentification] Initialized with GCP Healthcare API");
      return true;
    } catch (err: any) {
      console.warn("[HealthcareDeidentification] GCP init failed, falling back to local:", err.message);
      return false;
    }
  }

  deidentifyText(request: DeidentifyTextRequest): DeidentifyTextResponse {
    let text = request.text;
    const findings: DeidentifyFinding[] = [];
    const originalLength = Buffer.byteLength(text, "utf8");

    for (const { pattern, type, replacement } of PHI_PATTERNS) {
      const infoTypes = request.infoTypes || HIPAA_INFO_TYPES;
      if (infoTypes.length > 0 && !infoTypes.includes(type)) continue;

      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(request.text)) !== null) {
        findings.push({
          infoType: type,
          likelihood: "LIKELY",
          location: { startIndex: match.index, endIndex: match.index + match[0].length },
          replacedWith: replacement,
        });
      }

      text = text.replace(pattern, request.maskingCharacter ? request.maskingCharacter.repeat(8) : replacement);
    }

    const deidentifiedLength = Buffer.byteLength(text, "utf8");

    return {
      deidentifiedText: text,
      findings,
      transformedBytes: Math.abs(originalLength - deidentifiedLength),
    };
  }

  async deidentifyFhirStore(request: DeidentifyFhirRequest): Promise<DeidentifyOperationStatus> {
    const operationId = `deid-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    if (!this.healthcareClient) {
      const status: DeidentifyOperationStatus = {
        operationId,
        status: "failed",
        error: "GCP Healthcare API not initialized. Set GOOGLE_APPLICATION_CREDENTIALS and GCP_PROJECT_ID.",
        startedAt: new Date().toISOString(),
      };
      this.operations.set(operationId, status);
      return status;
    }

    const status: DeidentifyOperationStatus = {
      operationId,
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    this.operations.set(operationId, status);

    try {
      const sourceStore = `projects/${this.projectId}/locations/${this.location}/datasets/${request.sourceDatasetId}/fhirStores/${request.sourceFhirStoreId}`;
      const destinationStore = `projects/${this.projectId}/locations/${this.location}/datasets/${request.destinationDatasetId}/fhirStores/${request.destinationFhirStoreId}`;

      const deidentifyConfig: any = {
        fhir: {},
        text: {},
      };

      if (request.config.textRedactionMode === "redact_all_text") {
        deidentifyConfig.text = { additionalTransformations: [{ redactConfig: {} }] };
      } else if (request.config.textRedactionMode === "inspect_and_transform") {
        deidentifyConfig.text = {
          additionalTransformations: request.config.infoTypesToRedact.map((infoType) => ({
            infoTypeTransformations: {
              transformations: [{ infoTypes: [{ name: infoType }], replaceWithInfoTypeConfig: {} }],
            },
          })),
        };
      }

      if (request.config.dateShiftDays) {
        deidentifyConfig.fhir.fieldMetadataList = [
          { paths: ["Resource.meta.lastUpdated"], action: "DATE_SHIFT" },
        ];
      }

      const response = await this.healthcareClient.projects.locations.datasets.fhirStores.deidentify({
        sourceStore,
        requestBody: { destinationStore, config: deidentifyConfig },
      });

      status.status = "running";
      status.progress = 50;

      if (response.data?.name) {
        this.pollOperation(response.data.name, operationId);
      }

      return status;
    } catch (err: any) {
      status.status = "failed";
      status.error = err.message;
      console.error("[HealthcareDeidentification] FHIR de-identification failed:", err.message);
      return status;
    }
  }

  private async pollOperation(operationName: string, operationId: string): Promise<void> {
    if (!this.healthcareClient) return;
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.healthcareClient.projects.locations.datasets.operations.get({ name: operationName });
        const status = this.operations.get(operationId);
        if (!status) return;

        if (response.data?.done) {
          status.status = response.data.error ? "failed" : "completed";
          status.error = response.data.error?.message;
          status.completedAt = new Date().toISOString();
          status.progress = 100;
          return;
        }
        status.progress = Math.min(90, (i + 1) * (90 / maxAttempts));
      } catch {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  getOperationStatus(operationId: string): DeidentifyOperationStatus | null {
    return this.operations.get(operationId) || null;
  }

  getHipaaInfoTypes(): string[] {
    return [...HIPAA_INFO_TYPES];
  }

  getStatus(): { initialized: boolean; projectId: string; location: string; mode: "gcp" | "local" } {
    return {
      initialized: !!this.healthcareClient,
      projectId: this.projectId,
      location: this.location,
      mode: this.healthcareClient ? "gcp" : "local",
    };
  }
}

export const healthcareDeidentificationService = new HealthcareDeidentificationService();
