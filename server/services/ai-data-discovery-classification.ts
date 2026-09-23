import { generatePhiSafeText } from "./ai-gateway";
import { createHash, randomUUID } from "crypto";
import { DataClassificationTag, dataClassificationTags } from "@shared/schema";

const aiEnabled = true;

const NO_CDS_DISCOVERY_PROMPT = `You are a healthcare data classification expert specializing in identifying sensitive data types for regulatory compliance.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Identifying and classifying data types (PHI, PII, financial, genetic, etc.)
- Detecting sensitive data patterns in text and structured data
- Suggesting appropriate data classification tags
- Recommending data governance controls based on data sensitivity
- Assessing compliance requirements for discovered data types

All analysis must focus on DATA CLASSIFICATION and REGULATORY COMPLIANCE - never clinical interpretation.`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${hashIdentifier(match)}]`
    );
}

export type SensitiveDataType = 
  | "PHI" 
  | "PII" 
  | "FINANCIAL" 
  | "GENETIC" 
  | "MENTAL_HEALTH" 
  | "SUBSTANCE_ABUSE" 
  | "HIV_AIDS" 
  | "MINORS" 
  | "BIOMETRIC"
  | "LOCATION"
  | "EMPLOYMENT"
  | "INSURANCE"
  | "LEGAL"
  | "RESEARCH";

export type DataSourceType = 
  | "fhir_resource" 
  | "database_table" 
  | "file_storage" 
  | "api_endpoint" 
  | "ehr_integration"
  | "document"
  | "form_submission";

export type ScanStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type ClassificationConfidence = "high" | "medium" | "low";

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  connectionDetails: Record<string, string>;
  lastScanned?: string;
  scanFrequency: "daily" | "weekly" | "monthly" | "on_demand";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SensitiveDataPattern {
  id: string;
  name: string;
  dataType: SensitiveDataType;
  pattern: string;
  isRegex: boolean;
  description: string;
  examples: string[];
  falsePositiveRate: number;
  regulatoryBasis: string[];
  enabled: boolean;
}

export interface DataField {
  fieldName: string;
  fieldPath: string;
  dataType: string;
  sampleValues?: string[];
  nullable: boolean;
  indexed: boolean;
}

export interface DiscoveredData {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: DataSourceType;
  resourceType?: string;
  fieldPath: string;
  fieldName: string;
  detectedDataTypes: SensitiveDataType[];
  matchedPatterns: string[];
  sampleCount: number;
  confidence: ClassificationConfidence;
  confidenceScore: number;
  suggestedClassifications: DataClassificationTag[];
  currentClassifications: DataClassificationTag[];
  needsReview: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  approved: boolean;
  discoveredAt: string;
  lastUpdated: string;
}

export interface DataScanJob {
  id: string;
  name: string;
  sourceIds: string[];
  status: ScanStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  discoveredSensitiveCount: number;
  errors: ScanError[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
  scanConfig: ScanConfiguration;
}

export interface ScanError {
  sourceId: string;
  error: string;
  timestamp: string;
  recoverable: boolean;
}

export interface ScanConfiguration {
  dataTypes: SensitiveDataType[];
  sampleSize: number;
  deepScan: boolean;
  includeMetadata: boolean;
  contextAnalysis: boolean;
  customPatterns: string[];
}

export interface ClassificationSuggestion {
  id: string;
  discoveredDataId: string;
  suggestedTag: DataClassificationTag;
  confidence: number;
  rationale: string;
  regulatoryBasis: string[];
  impactAssessment: string;
  requiredControls: string[];
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ClassificationReport {
  id: string;
  scanJobId: string;
  generatedAt: string;
  summary: ClassificationSummary;
  byDataType: Record<SensitiveDataType, DataTypeBreakdown>;
  bySource: Record<string, SourceBreakdown>;
  recommendations: ClassificationRecommendation[];
  complianceImpact: ComplianceImpact;
  riskAssessment: RiskAssessment;
}

export interface ClassificationSummary {
  totalFieldsScanned: number;
  sensitiveFieldsFound: number;
  classificationCoverage: number;
  pendingReviews: number;
  highConfidenceFindings: number;
  mediumConfidenceFindings: number;
  lowConfidenceFindings: number;
}

export interface DataTypeBreakdown {
  count: number;
  percentage: number;
  sources: string[];
  avgConfidence: number;
  topPatterns: string[];
}

export interface SourceBreakdown {
  sourceName: string;
  sourceType: DataSourceType;
  fieldsScanned: number;
  sensitiveFieldsFound: number;
  dataTypes: SensitiveDataType[];
  classificationStatus: "complete" | "partial" | "pending";
}

export interface ClassificationRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: "tagging" | "access_control" | "encryption" | "retention" | "audit";
  title: string;
  description: string;
  affectedSources: string[];
  estimatedEffort: string;
  regulatoryBasis: string[];
}

export interface ComplianceImpact {
  hipaa: ComplianceStatus;
  gdpr: ComplianceStatus;
  soc2: ComplianceStatus;
  ccpa: ComplianceStatus;
  gina: ComplianceStatus;
}

export interface ComplianceStatus {
  compliant: boolean;
  gaps: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface RiskAssessment {
  overallRiskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  topRisks: RiskItem[];
  mitigationSuggestions: string[];
}

export interface RiskItem {
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  likelihood: number;
  impact: number;
  affectedData: string[];
}

export interface DataClassificationDashboard {
  totalDataSources: number;
  activeScanJobs: number;
  discoveredSensitiveData: number;
  pendingClassifications: number;
  classificationCoverage: number;
  recentScans: DataScanJob[];
  topSensitiveDataTypes: { type: SensitiveDataType; count: number }[];
  complianceScore: number;
  lastUpdated: string;
}

const dataSourceStore = new Map<string, DataSource>();
const patternStore = new Map<string, SensitiveDataPattern>();
const discoveredDataStore = new Map<string, DiscoveredData>();
const scanJobStore = new Map<string, DataScanJob>();
const classificationSuggestionStore = new Map<string, ClassificationSuggestion>();
const classificationReportStore = new Map<string, ClassificationReport>();

class AIDataDiscoveryClassificationService {
  constructor() {
    this.initializePatterns();
    this.initializeSampleDataSources();
    console.log("[AIDataDiscoveryClassification] Service initialized");
  }

  private initializePatterns(): void {
    const defaultPatterns: SensitiveDataPattern[] = [
      {
        id: "pattern-ssn",
        name: "Social Security Number",
        dataType: "PII",
        pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b",
        isRegex: true,
        description: "US Social Security Number in XXX-XX-XXXX format",
        examples: ["123-45-6789"],
        falsePositiveRate: 0.05,
        regulatoryBasis: ["HIPAA", "CCPA", "SOC2"],
        enabled: true,
      },
      {
        id: "pattern-email",
        name: "Email Address",
        dataType: "PII",
        pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}",
        isRegex: true,
        description: "Email address",
        examples: ["john.doe@example.com"],
        falsePositiveRate: 0.02,
        regulatoryBasis: ["GDPR", "CCPA"],
        enabled: true,
      },
      {
        id: "pattern-phone",
        name: "Phone Number",
        dataType: "PII",
        pattern: "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
        isRegex: true,
        description: "US phone number",
        examples: ["555-123-4567", "5551234567"],
        falsePositiveRate: 0.1,
        regulatoryBasis: ["CCPA", "GDPR"],
        enabled: true,
      },
      {
        id: "pattern-mrn",
        name: "Medical Record Number",
        dataType: "PHI",
        pattern: "\\b[A-Z]{2,3}\\d{6,10}\\b",
        isRegex: true,
        description: "Medical Record Number",
        examples: ["MRN12345678", "PT000123456"],
        falsePositiveRate: 0.15,
        regulatoryBasis: ["HIPAA"],
        enabled: true,
      },
      {
        id: "pattern-dob",
        name: "Date of Birth",
        dataType: "PHI",
        pattern: "\\b(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])/(19|20)\\d{2}\\b",
        isRegex: true,
        description: "Date of birth in MM/DD/YYYY format",
        examples: ["01/15/1985"],
        falsePositiveRate: 0.2,
        regulatoryBasis: ["HIPAA", "GDPR"],
        enabled: true,
      },
      {
        id: "pattern-diagnosis",
        name: "ICD Diagnosis Code",
        dataType: "PHI",
        pattern: "\\b[A-Z]\\d{2}(\\.\\d{1,4})?\\b",
        isRegex: true,
        description: "ICD-10 diagnosis code",
        examples: ["E11.9", "J18.1", "F32.1"],
        falsePositiveRate: 0.25,
        regulatoryBasis: ["HIPAA"],
        enabled: true,
      },
      {
        id: "pattern-credit-card",
        name: "Credit Card Number",
        dataType: "FINANCIAL",
        pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\\b",
        isRegex: true,
        description: "Credit card number (Visa, Mastercard, Amex)",
        examples: ["4111111111111111"],
        falsePositiveRate: 0.05,
        regulatoryBasis: ["PCI-DSS", "SOC2"],
        enabled: true,
      },
      {
        id: "pattern-genetic-marker",
        name: "Genetic Marker",
        dataType: "GENETIC",
        pattern: "\\brs\\d{6,10}\\b",
        isRegex: true,
        description: "SNP reference ID (rsID)",
        examples: ["rs1234567"],
        falsePositiveRate: 0.1,
        regulatoryBasis: ["GINA", "HIPAA"],
        enabled: true,
      },
      {
        id: "pattern-biometric",
        name: "Biometric Identifier",
        dataType: "BIOMETRIC",
        pattern: "(fingerprint|retina|iris|face_id|voice_print|palm_print)",
        isRegex: true,
        description: "Biometric data type identifiers",
        examples: ["fingerprint_hash", "face_id_vector"],
        falsePositiveRate: 0.05,
        regulatoryBasis: ["BIPA", "GDPR", "CCPA"],
        enabled: true,
      },
      {
        id: "pattern-substance-abuse",
        name: "Substance Abuse Indicator",
        dataType: "SUBSTANCE_ABUSE",
        pattern: "(42 CFR Part 2|substance_abuse|drug_screen|addiction_treatment)",
        isRegex: true,
        description: "42 CFR Part 2 protected substance abuse records",
        examples: ["42 CFR Part 2 protected"],
        falsePositiveRate: 0.15,
        regulatoryBasis: ["42 CFR Part 2", "HIPAA"],
        enabled: true,
      },
      {
        id: "pattern-mental-health",
        name: "Mental Health Indicator",
        dataType: "MENTAL_HEALTH",
        pattern: "(psychotherapy_notes|mental_health_assessment|psychiatric_evaluation)",
        isRegex: true,
        description: "Mental health related data",
        examples: ["psychotherapy_notes"],
        falsePositiveRate: 0.1,
        regulatoryBasis: ["HIPAA"],
        enabled: true,
      },
      {
        id: "pattern-hiv",
        name: "HIV/AIDS Indicator",
        dataType: "HIV_AIDS",
        pattern: "(HIV_status|AIDS_diagnosis|antiretroviral)",
        isRegex: true,
        description: "HIV/AIDS related protected information",
        examples: ["HIV_status"],
        falsePositiveRate: 0.05,
        regulatoryBasis: ["HIPAA", "State HIV Laws"],
        enabled: true,
      },
    ];

    for (const pattern of defaultPatterns) {
      patternStore.set(pattern.id, pattern);
    }
    console.log(`[AIDataDiscoveryClassification] Initialized ${defaultPatterns.length} detection patterns`);
  }

  private initializeSampleDataSources(): void {
    const sampleSources: DataSource[] = [
      {
        id: "source-fhir-patient",
        name: "FHIR Patient Resources",
        type: "fhir_resource",
        connectionDetails: { resourceType: "Patient", endpoint: "/api/fhir/Patient" },
        scanFrequency: "daily",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "source-fhir-observation",
        name: "FHIR Observation Resources",
        type: "fhir_resource",
        connectionDetails: { resourceType: "Observation", endpoint: "/api/fhir/Observation" },
        scanFrequency: "daily",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "source-documents",
        name: "Clinical Documents",
        type: "document",
        connectionDetails: { path: "/documents/clinical", formats: "pdf,docx,txt" },
        scanFrequency: "weekly",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const source of sampleSources) {
      dataSourceStore.set(source.id, source);
    }
    console.log(`[AIDataDiscoveryClassification] Initialized ${sampleSources.length} sample data sources`);
  }

  async scanDataSource(sourceId: string, config: ScanConfiguration, userId: string): Promise<DataScanJob> {
    const source = dataSourceStore.get(sourceId);
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`);
    }

    const job: DataScanJob = {
      id: randomUUID(),
      name: `Scan: ${source.name}`,
      sourceIds: [sourceId],
      status: "in_progress",
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      discoveredSensitiveCount: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: userId,
      scanConfig: config,
    };

    scanJobStore.set(job.id, job);

    this.executeScan(job, source, config).catch(error => {
      console.error(`[AIDataDiscoveryClassification] Scan error:`, error);
      job.status = "failed";
      job.errors.push({
        sourceId,
        error: error.message,
        timestamp: new Date().toISOString(),
        recoverable: false,
      });
    });

    return job;
  }

  private async executeScan(job: DataScanJob, source: DataSource, config: ScanConfiguration): Promise<void> {
    const simulatedFields = this.generateSimulatedFields(source);
    job.totalItems = simulatedFields.length;

    for (let i = 0; i < simulatedFields.length; i++) {
      const field = simulatedFields[i];
      const discoveries = await this.analyzeField(field, source, config);
      
      for (const discovery of discoveries) {
        discoveredDataStore.set(discovery.id, discovery);
        job.discoveredSensitiveCount++;
        
        const suggestions = this.generateClassificationSuggestions(discovery);
        for (const suggestion of suggestions) {
          classificationSuggestionStore.set(suggestion.id, suggestion);
        }
      }

      job.processedItems = i + 1;
      job.progress = Math.round((job.processedItems / job.totalItems) * 100);
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();

    source.lastScanned = new Date().toISOString();
    dataSourceStore.set(source.id, source);
  }

  private generateSimulatedFields(source: DataSource): DataField[] {
    const fieldsByType: Record<DataSourceType, DataField[]> = {
      fhir_resource: [
        { fieldName: "identifier", fieldPath: "Patient.identifier", dataType: "string", nullable: false, indexed: true },
        { fieldName: "name", fieldPath: "Patient.name.given", dataType: "string", nullable: false, indexed: true },
        { fieldName: "birthDate", fieldPath: "Patient.birthDate", dataType: "date", nullable: true, indexed: false },
        { fieldName: "telecom", fieldPath: "Patient.telecom.value", dataType: "string", nullable: true, indexed: false },
        { fieldName: "address", fieldPath: "Patient.address.line", dataType: "string", nullable: true, indexed: false },
        { fieldName: "ssn", fieldPath: "Patient.identifier.ssn", dataType: "string", nullable: true, indexed: false },
      ],
      database_table: [
        { fieldName: "patient_ssn", fieldPath: "patients.ssn", dataType: "varchar", nullable: true, indexed: false },
        { fieldName: "email", fieldPath: "users.email", dataType: "varchar", nullable: false, indexed: true },
        { fieldName: "phone", fieldPath: "contacts.phone", dataType: "varchar", nullable: true, indexed: false },
      ],
      document: [
        { fieldName: "content", fieldPath: "document.body", dataType: "text", nullable: false, indexed: false },
        { fieldName: "metadata", fieldPath: "document.metadata", dataType: "json", nullable: true, indexed: false },
      ],
      file_storage: [
        { fieldName: "file_content", fieldPath: "files.content", dataType: "blob", nullable: false, indexed: false },
      ],
      api_endpoint: [
        { fieldName: "response_body", fieldPath: "api.response", dataType: "json", nullable: false, indexed: false },
      ],
      ehr_integration: [
        { fieldName: "patient_data", fieldPath: "ehr.patient", dataType: "json", nullable: false, indexed: false },
        { fieldName: "clinical_notes", fieldPath: "ehr.notes", dataType: "text", nullable: true, indexed: false },
      ],
      form_submission: [
        { fieldName: "form_data", fieldPath: "submissions.data", dataType: "json", nullable: false, indexed: false },
      ],
    };

    return fieldsByType[source.type] || [];
  }

  private async analyzeField(field: DataField, source: DataSource, config: ScanConfiguration): Promise<DiscoveredData[]> {
    const discoveries: DiscoveredData[] = [];
    const enabledPatterns = Array.from(patternStore.values()).filter(p => p.enabled);

    const detectedTypes: SensitiveDataType[] = [];
    const matchedPatterns: string[] = [];
    let maxConfidence = 0;

    for (const pattern of enabledPatterns) {
      if (!config.dataTypes.includes(pattern.dataType)) continue;

      let matched = false;

      if (pattern.isRegex && field.sampleValues && field.sampleValues.length > 0) {
        try {
          const regex = new RegExp(pattern.pattern, "gi");
          for (const sample of field.sampleValues) {
            if (regex.test(sample)) {
              matched = true;
              maxConfidence = Math.max(maxConfidence, 1 - pattern.falsePositiveRate);
              break;
            }
          }
        } catch {}
      }

      if (!matched) {
        const fieldIndicators = this.getFieldNameIndicators(field.fieldName);
        const matchesFieldName = fieldIndicators.some(indicator => 
          pattern.name.toLowerCase().includes(indicator) ||
          pattern.dataType.toLowerCase().includes(indicator)
        );

        if (matchesFieldName) {
          matched = true;
          maxConfidence = Math.max(maxConfidence, (1 - pattern.falsePositiveRate) * 0.8);
        }
      }

      if (matched) {
        detectedTypes.push(pattern.dataType);
        matchedPatterns.push(pattern.id);
      }
    }

    if (detectedTypes.length > 0) {
      const confidence: ClassificationConfidence = 
        maxConfidence > 0.85 ? "high" : 
        maxConfidence > 0.7 ? "medium" : "low";

      const suggestedClassifications = this.mapToClassificationTags(detectedTypes);

      const discovery: DiscoveredData = {
        id: randomUUID(),
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        fieldPath: field.fieldPath,
        fieldName: field.fieldName,
        detectedDataTypes: Array.from(new Set(detectedTypes)),
        matchedPatterns,
        sampleCount: Math.floor(Math.random() * 1000) + 100,
        confidence,
        confidenceScore: maxConfidence,
        suggestedClassifications,
        currentClassifications: [],
        needsReview: confidence !== "high",
        approved: false,
        discoveredAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      discoveries.push(discovery);
    }

    return discoveries;
  }

  private getFieldNameIndicators(fieldName: string): string[] {
    const normalized = fieldName.toLowerCase().replace(/[_-]/g, " ");
    const indicators: string[] = [];

    if (/ssn|social.*security/.test(normalized)) indicators.push("ssn", "pii");
    if (/email/.test(normalized)) indicators.push("email", "pii");
    if (/phone|mobile|cell/.test(normalized)) indicators.push("phone", "pii");
    if (/birth.*date|dob/.test(normalized)) indicators.push("dob", "phi");
    if (/address|street|city|zip/.test(normalized)) indicators.push("address", "pii");
    if (/name|first.*name|last.*name/.test(normalized)) indicators.push("name", "pii");
    if (/mrn|medical.*record/.test(normalized)) indicators.push("mrn", "phi");
    if (/diagnosis|icd|condition/.test(normalized)) indicators.push("diagnosis", "phi");
    if (/medication|drug|prescription/.test(normalized)) indicators.push("medication", "phi");
    if (/credit.*card|card.*number|payment/.test(normalized)) indicators.push("credit", "financial");
    if (/bank|account.*number|routing/.test(normalized)) indicators.push("bank", "financial");
    if (/genetic|dna|gene|snp/.test(normalized)) indicators.push("genetic");
    if (/fingerprint|biometric|retina|iris/.test(normalized)) indicators.push("biometric");

    return indicators;
  }

  private mapToClassificationTags(dataTypes: SensitiveDataType[]): DataClassificationTag[] {
    const tagMapping: Record<SensitiveDataType, DataClassificationTag[]> = {
      PHI: ["PHI"],
      PII: ["PII"],
      FINANCIAL: ["FINANCIAL"],
      GENETIC: ["GENETIC"],
      MENTAL_HEALTH: ["SENSITIVE", "PHI"],
      SUBSTANCE_ABUSE: ["SENSITIVE", "RESTRICTED", "PHI"],
      HIV_AIDS: ["SENSITIVE", "RESTRICTED", "PHI"],
      MINORS: ["MINORS"],
      BIOMETRIC: ["PII", "SENSITIVE"],
      LOCATION: ["PII"],
      EMPLOYMENT: ["PII"],
      INSURANCE: ["FINANCIAL", "PHI"],
      LEGAL: ["RESTRICTED"],
      RESEARCH: ["PHI"],
    };

    const tags = new Set<DataClassificationTag>();
    for (const dataType of dataTypes) {
      const mappedTags = tagMapping[dataType] || [];
      for (const tag of mappedTags) {
        tags.add(tag);
      }
    }

    return Array.from(tags);
  }

  private generateClassificationSuggestions(discovery: DiscoveredData): ClassificationSuggestion[] {
    const suggestions: ClassificationSuggestion[] = [];

    for (const tag of discovery.suggestedClassifications) {
      if (!discovery.currentClassifications.includes(tag)) {
        const suggestion: ClassificationSuggestion = {
          id: randomUUID(),
          discoveredDataId: discovery.id,
          suggestedTag: tag,
          confidence: discovery.confidenceScore,
          rationale: this.generateRationale(tag, discovery),
          regulatoryBasis: this.getTagRegulatoryBasis(tag),
          impactAssessment: this.generateImpactAssessment(tag),
          requiredControls: this.getRequiredControls(tag),
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  private generateRationale(tag: DataClassificationTag, discovery: DiscoveredData): string {
    const rationales: Partial<Record<DataClassificationTag, string>> = {
      PHI: `Field "${discovery.fieldName}" contains Protected Health Information based on detected patterns: ${discovery.detectedDataTypes.join(", ")}. HIPAA requires this data to be classified and protected.`,
      PII: `Field "${discovery.fieldName}" contains Personally Identifiable Information. Privacy regulations require appropriate access controls and handling procedures.`,
      SENSITIVE: `Field "${discovery.fieldName}" contains highly sensitive data requiring enhanced protection measures beyond standard PHI/PII controls.`,
      RESTRICTED: `Field "${discovery.fieldName}" contains restricted data with special legal protections. Access should be limited to authorized personnel only.`,
      FINANCIAL: `Field "${discovery.fieldName}" contains financial data subject to PCI-DSS and financial privacy regulations.`,
      GENETIC: `Field "${discovery.fieldName}" contains genetic information protected under GINA and requiring special handling procedures.`,
      MINORS: `Field "${discovery.fieldName}" may contain data related to minor patients requiring additional protections under COPPA and state laws.`,
      STANDARD: `Field "${discovery.fieldName}" contains standard data that should follow baseline data governance policies.`,
      RESEARCH: `Field "${discovery.fieldName}" contains research data requiring IRB approval and research-specific protections.`,
      EMERGENCY: `Field "${discovery.fieldName}" contains emergency access data with break-the-glass requirements.`,
    };

    return rationales[tag] || `Classification recommended based on detected data patterns.`;
  }

  private getTagRegulatoryBasis(tag: DataClassificationTag): string[] {
    const regulations: Partial<Record<DataClassificationTag, string[]>> = {
      PHI: ["HIPAA", "HITECH", "State Health Privacy Laws"],
      PII: ["GDPR", "CCPA", "State Privacy Laws"],
      SENSITIVE: ["HIPAA", "42 CFR Part 2", "State Mental Health Laws"],
      RESTRICTED: ["Court Orders", "Legal Holds", "Specific Consent Requirements"],
      FINANCIAL: ["PCI-DSS", "GLBA", "SOX"],
      GENETIC: ["GINA", "HIPAA", "State Genetic Privacy Laws"],
      MINORS: ["COPPA", "FERPA", "State Minor Privacy Laws"],
      STANDARD: ["General Data Protection Best Practices"],
      RESEARCH: ["Common Rule", "IRB Requirements", "HIPAA Research Provisions"],
      EMERGENCY: ["HIPAA Emergency Access", "Break-the-Glass Policies"],
    };

    return regulations[tag] || [];
  }

  private generateImpactAssessment(tag: DataClassificationTag): string {
    const impacts: Partial<Record<DataClassificationTag, string>> = {
      PHI: "Applying this classification will trigger HIPAA-mandated access controls, audit logging, and encryption requirements.",
      PII: "This classification will enable privacy controls including consent management, access restrictions, and breach notification procedures.",
      SENSITIVE: "Enhanced security controls will be applied including stricter access limitations and additional audit requirements.",
      RESTRICTED: "Maximum security controls will be enforced with explicit authorization requirements for any access.",
      FINANCIAL: "PCI-DSS compliant controls will be applied including encryption, access logging, and data masking.",
      GENETIC: "GINA-specific protections will be applied preventing use in employment or insurance decisions.",
      MINORS: "Additional parental consent mechanisms and access restrictions will be enabled.",
      STANDARD: "Standard data governance controls will be applied based on organizational policies.",
      RESEARCH: "Research-specific controls will be applied including IRB compliance and de-identification requirements.",
      EMERGENCY: "Emergency access controls with break-the-glass audit trails will be enabled.",
    };

    return impacts[tag] || "Standard data protection controls will be applied.";
  }

  private getRequiredControls(tag: DataClassificationTag): string[] {
    const controls: Partial<Record<DataClassificationTag, string[]>> = {
      PHI: ["Encryption at rest", "Encryption in transit", "Access logging", "Minimum necessary access", "Breach notification"],
      PII: ["Access controls", "Data minimization", "Consent tracking", "Right to deletion support"],
      SENSITIVE: ["Enhanced encryption", "Restricted access", "Audit trails", "Data loss prevention"],
      RESTRICTED: ["Explicit authorization", "Two-person rule", "Complete audit trail", "Legal review"],
      FINANCIAL: ["PCI-DSS encryption", "Tokenization", "Access logging", "Secure storage"],
      GENETIC: ["Enhanced consent", "Non-discrimination controls", "Research use limitations"],
      MINORS: ["Parental consent", "Age verification", "Data minimization", "Enhanced deletion"],
      STANDARD: ["Standard access controls", "Basic logging"],
      RESEARCH: ["IRB approval", "De-identification", "Research consent", "Data use agreements"],
      EMERGENCY: ["Break-the-glass logging", "Post-access review", "Emergency justification"],
    };

    return controls[tag] || [];
  }

  async analyzeWithAI(content: string, context: string): Promise<{
    detectedTypes: SensitiveDataType[];
    confidence: number;
    reasoning: string;
    recommendations: string[];
  }> {
    if (!aiEnabled) {
      return this.fallbackAnalysis(content);
    }

    try {
      const sanitizedContent = sanitizePhi(content);
      const sanitizedContext = sanitizePhi(context);

      const responseText = await generatePhiSafeText({
        system: NO_CDS_DISCOVERY_PROMPT,
        user: `Analyze this data field for sensitive data types. Identify PHI, PII, financial, genetic, or other sensitive categories.

Context: ${sanitizedContext}
Data sample (sanitized): ${sanitizedContent}

Respond in JSON format:
{
  "detectedTypes": ["PHI", "PII", etc.],
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "recommendations": ["action1", "action2"]
}`,
        responseMimeType: "application/json",
        temperature: 0.3,
        maxTokens: 500,
      });

      const result = JSON.parse(responseText || "{}");
      return {
        detectedTypes: result.detectedTypes || [],
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || "AI analysis completed",
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      console.error("[AIDataDiscoveryClassification] AI analysis error:", error);
      return this.fallbackAnalysis(content);
    }
  }

  private fallbackAnalysis(content: string): {
    detectedTypes: SensitiveDataType[];
    confidence: number;
    reasoning: string;
    recommendations: string[];
  } {
    const detectedTypes: SensitiveDataType[] = [];
    const patterns = Array.from(patternStore.values());

    for (const pattern of patterns) {
      if (pattern.isRegex) {
        try {
          const regex = new RegExp(pattern.pattern, "gi");
          if (regex.test(content)) {
            detectedTypes.push(pattern.dataType);
          }
        } catch {}
      }
    }

    return {
      detectedTypes: Array.from(new Set(detectedTypes)),
      confidence: 0.6,
      reasoning: "Pattern-based analysis (AI unavailable)",
      recommendations: detectedTypes.length > 0 
        ? ["Apply appropriate classification tags", "Enable access controls", "Configure audit logging"]
        : ["No sensitive data patterns detected"],
    };
  }

  async generateClassificationReport(scanJobId: string): Promise<ClassificationReport> {
    const job = scanJobStore.get(scanJobId);
    if (!job) {
      throw new Error(`Scan job not found: ${scanJobId}`);
    }

    const discoveries = Array.from(discoveredDataStore.values())
      .filter(d => job.sourceIds.includes(d.sourceId));

    const byDataType: Record<SensitiveDataType, DataTypeBreakdown> = {} as any;
    const bySource: Record<string, SourceBreakdown> = {};

    for (const discovery of discoveries) {
      for (const dataType of discovery.detectedDataTypes) {
        if (!byDataType[dataType]) {
          byDataType[dataType] = {
            count: 0,
            percentage: 0,
            sources: [],
            avgConfidence: 0,
            topPatterns: [],
          };
        }
        byDataType[dataType].count++;
        if (!byDataType[dataType].sources.includes(discovery.sourceName)) {
          byDataType[dataType].sources.push(discovery.sourceName);
        }
      }

      if (!bySource[discovery.sourceId]) {
        bySource[discovery.sourceId] = {
          sourceName: discovery.sourceName,
          sourceType: discovery.sourceType,
          fieldsScanned: 0,
          sensitiveFieldsFound: 0,
          dataTypes: [],
          classificationStatus: "pending",
        };
      }
      bySource[discovery.sourceId].sensitiveFieldsFound++;
      for (const dt of discovery.detectedDataTypes) {
        bySource[discovery.sourceId].dataTypes.push(dt);
      }
    }

    const report: ClassificationReport = {
      id: randomUUID(),
      scanJobId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalFieldsScanned: job.totalItems,
        sensitiveFieldsFound: discoveries.length,
        classificationCoverage: discoveries.length > 0 
          ? discoveries.filter(d => d.approved).length / discoveries.length 
          : 0,
        pendingReviews: discoveries.filter(d => d.needsReview && !d.approved).length,
        highConfidenceFindings: discoveries.filter(d => d.confidence === "high").length,
        mediumConfidenceFindings: discoveries.filter(d => d.confidence === "medium").length,
        lowConfidenceFindings: discoveries.filter(d => d.confidence === "low").length,
      },
      byDataType,
      bySource,
      recommendations: this.generateRecommendations(discoveries),
      complianceImpact: this.assessComplianceImpact(discoveries),
      riskAssessment: this.assessRisks(discoveries),
    };

    classificationReportStore.set(report.id, report);
    return report;
  }

  private generateRecommendations(discoveries: DiscoveredData[]): ClassificationRecommendation[] {
    const recommendations: ClassificationRecommendation[] = [];

    const pendingCount = discoveries.filter(d => d.needsReview && !d.approved).length;
    if (pendingCount > 0) {
      recommendations.push({
        priority: pendingCount > 10 ? "high" : "medium",
        category: "tagging",
        title: "Complete pending classification reviews",
        description: `${pendingCount} data fields require manual review to confirm classification.`,
        affectedSources: Array.from(new Set(discoveries.filter(d => d.needsReview).map(d => d.sourceName))),
        estimatedEffort: `${Math.ceil(pendingCount * 2)} minutes`,
        regulatoryBasis: ["HIPAA", "GDPR"],
      });
    }

    const phiFields = discoveries.filter(d => d.detectedDataTypes.includes("PHI"));
    if (phiFields.length > 0) {
      recommendations.push({
        priority: "critical",
        category: "access_control",
        title: "Implement PHI access controls",
        description: `${phiFields.length} fields contain PHI requiring HIPAA-compliant access controls.`,
        affectedSources: Array.from(new Set(phiFields.map(d => d.sourceName))),
        estimatedEffort: "2-4 hours",
        regulatoryBasis: ["HIPAA §164.312(a)(1)", "HIPAA §164.312(d)"],
      });
    }

    const geneticFields = discoveries.filter(d => d.detectedDataTypes.includes("GENETIC"));
    if (geneticFields.length > 0) {
      recommendations.push({
        priority: "high",
        category: "encryption",
        title: "Apply enhanced encryption to genetic data",
        description: `${geneticFields.length} fields contain genetic information requiring GINA protections.`,
        affectedSources: Array.from(new Set(geneticFields.map(d => d.sourceName))),
        estimatedEffort: "1-2 hours",
        regulatoryBasis: ["GINA", "HIPAA"],
      });
    }

    return recommendations;
  }

  private assessComplianceImpact(discoveries: DiscoveredData[]): ComplianceImpact {
    const hasPhi = discoveries.some(d => d.detectedDataTypes.includes("PHI"));
    const hasPii = discoveries.some(d => d.detectedDataTypes.includes("PII"));
    const hasGenetic = discoveries.some(d => d.detectedDataTypes.includes("GENETIC"));
    const hasFinancial = discoveries.some(d => d.detectedDataTypes.includes("FINANCIAL"));
    const unclassifiedCount = discoveries.filter(d => !d.approved).length;

    return {
      hipaa: {
        compliant: hasPhi ? unclassifiedCount === 0 : true,
        gaps: hasPhi && unclassifiedCount > 0 ? ["PHI requires classification and access controls"] : [],
        recommendations: hasPhi ? ["Complete PHI classification", "Implement minimum necessary access"] : [],
        riskLevel: hasPhi && unclassifiedCount > 5 ? "high" : unclassifiedCount > 0 ? "medium" : "low",
      },
      gdpr: {
        compliant: hasPii ? unclassifiedCount === 0 : true,
        gaps: hasPii && unclassifiedCount > 0 ? ["Personal data requires classification"] : [],
        recommendations: hasPii ? ["Complete PII classification", "Document lawful basis"] : [],
        riskLevel: hasPii && unclassifiedCount > 5 ? "high" : unclassifiedCount > 0 ? "medium" : "low",
      },
      soc2: {
        compliant: unclassifiedCount === 0,
        gaps: unclassifiedCount > 0 ? ["All sensitive data must be classified"] : [],
        recommendations: ["Complete data classification", "Enable access logging"],
        riskLevel: unclassifiedCount > 10 ? "high" : unclassifiedCount > 0 ? "medium" : "low",
      },
      ccpa: {
        compliant: hasPii ? unclassifiedCount === 0 : true,
        gaps: hasPii && unclassifiedCount > 0 ? ["Consumer data requires classification"] : [],
        recommendations: hasPii ? ["Classify consumer data", "Enable deletion tracking"] : [],
        riskLevel: hasPii && unclassifiedCount > 5 ? "medium" : "low",
      },
      gina: {
        compliant: hasGenetic ? discoveries.filter(d => d.detectedDataTypes.includes("GENETIC") && d.approved).length === discoveries.filter(d => d.detectedDataTypes.includes("GENETIC")).length : true,
        gaps: hasGenetic ? ["Genetic data requires special protections"] : [],
        recommendations: hasGenetic ? ["Apply GINA protections", "Restrict employment/insurance use"] : [],
        riskLevel: hasGenetic ? "high" : "low",
      },
    };
  }

  private assessRisks(discoveries: DiscoveredData[]): RiskAssessment {
    const unclassified = discoveries.filter(d => !d.approved).length;
    const lowConfidence = discoveries.filter(d => d.confidence === "low").length;
    const sensitiveTypes = discoveries.filter(d => 
      d.detectedDataTypes.some(t => ["GENETIC", "MENTAL_HEALTH", "HIV_AIDS", "SUBSTANCE_ABUSE"].includes(t))
    ).length;

    let riskScore = 0;
    riskScore += Math.min(unclassified * 5, 40);
    riskScore += Math.min(lowConfidence * 3, 20);
    riskScore += Math.min(sensitiveTypes * 10, 40);

    const topRisks: RiskItem[] = [];

    if (unclassified > 0) {
      topRisks.push({
        category: "Data Classification",
        description: `${unclassified} data fields remain unclassified`,
        severity: unclassified > 10 ? "high" : "medium",
        likelihood: 0.8,
        impact: 0.7,
        affectedData: discoveries.filter(d => !d.approved).map(d => d.fieldPath),
      });
    }

    if (sensitiveTypes > 0) {
      topRisks.push({
        category: "Sensitive Data Exposure",
        description: `${sensitiveTypes} highly sensitive data fields detected`,
        severity: "critical",
        likelihood: 0.6,
        impact: 0.9,
        affectedData: discoveries.filter(d => 
          d.detectedDataTypes.some(t => ["GENETIC", "MENTAL_HEALTH", "HIV_AIDS", "SUBSTANCE_ABUSE"].includes(t))
        ).map(d => d.fieldPath),
      });
    }

    return {
      overallRiskScore: Math.min(riskScore, 100),
      riskLevel: riskScore > 70 ? "critical" : riskScore > 50 ? "high" : riskScore > 30 ? "medium" : "low",
      topRisks,
      mitigationSuggestions: [
        "Complete classification review for all pending items",
        "Apply appropriate access controls based on classification",
        "Enable audit logging for sensitive data access",
        "Conduct regular data discovery scans",
      ],
    };
  }

  getDataSources(): DataSource[] {
    return Array.from(dataSourceStore.values());
  }

  getDataSource(id: string): DataSource | undefined {
    return dataSourceStore.get(id);
  }

  createDataSource(source: Omit<DataSource, "id" | "createdAt" | "updatedAt">): DataSource {
    const newSource: DataSource = {
      ...source,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dataSourceStore.set(newSource.id, newSource);
    return newSource;
  }

  getPatterns(): SensitiveDataPattern[] {
    return Array.from(patternStore.values());
  }

  createPattern(pattern: Omit<SensitiveDataPattern, "id">): SensitiveDataPattern {
    const newPattern: SensitiveDataPattern = {
      ...pattern,
      id: randomUUID(),
    };
    patternStore.set(newPattern.id, newPattern);
    return newPattern;
  }

  getDiscoveredData(filters?: { sourceId?: string; dataType?: SensitiveDataType; needsReview?: boolean }): DiscoveredData[] {
    let results = Array.from(discoveredDataStore.values());
    
    if (filters?.sourceId) {
      results = results.filter(d => d.sourceId === filters.sourceId);
    }
    if (filters?.dataType) {
      results = results.filter(d => d.detectedDataTypes.includes(filters.dataType!));
    }
    if (filters?.needsReview !== undefined) {
      results = results.filter(d => d.needsReview === filters.needsReview);
    }

    return results;
  }

  getScanJobs(): DataScanJob[] {
    return Array.from(scanJobStore.values());
  }

  getScanJob(id: string): DataScanJob | undefined {
    return scanJobStore.get(id);
  }

  getClassificationSuggestions(discoveredDataId?: string): ClassificationSuggestion[] {
    let results = Array.from(classificationSuggestionStore.values());
    if (discoveredDataId) {
      results = results.filter(s => s.discoveredDataId === discoveredDataId);
    }
    return results;
  }

  async approveSuggestion(suggestionId: string, userId: string): Promise<ClassificationSuggestion> {
    const suggestion = classificationSuggestionStore.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    suggestion.status = "accepted";
    suggestion.reviewedAt = new Date().toISOString();
    suggestion.reviewedBy = userId;
    classificationSuggestionStore.set(suggestionId, suggestion);

    const discovery = discoveredDataStore.get(suggestion.discoveredDataId);
    if (discovery) {
      if (!discovery.currentClassifications.includes(suggestion.suggestedTag)) {
        discovery.currentClassifications.push(suggestion.suggestedTag);
      }
      discovery.approved = true;
      discovery.reviewedBy = userId;
      discovery.reviewedAt = new Date().toISOString();
      discovery.lastUpdated = new Date().toISOString();
      discoveredDataStore.set(discovery.id, discovery);
    }

    return suggestion;
  }

  async rejectSuggestion(suggestionId: string, userId: string): Promise<ClassificationSuggestion> {
    const suggestion = classificationSuggestionStore.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    suggestion.status = "rejected";
    suggestion.reviewedAt = new Date().toISOString();
    suggestion.reviewedBy = userId;
    classificationSuggestionStore.set(suggestionId, suggestion);

    return suggestion;
  }

  getDashboard(): DataClassificationDashboard {
    const sources = Array.from(dataSourceStore.values());
    const jobs = Array.from(scanJobStore.values());
    const discoveries = Array.from(discoveredDataStore.values());

    const dataTypeCounts = new Map<SensitiveDataType, number>();
    for (const discovery of discoveries) {
      for (const type of discovery.detectedDataTypes) {
        dataTypeCounts.set(type, (dataTypeCounts.get(type) || 0) + 1);
      }
    }

    const topTypes = Array.from(dataTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const classifiedCount = discoveries.filter(d => d.approved).length;
    const coverage = discoveries.length > 0 ? classifiedCount / discoveries.length : 0;

    return {
      totalDataSources: sources.length,
      activeScanJobs: jobs.filter(j => j.status === "in_progress").length,
      discoveredSensitiveData: discoveries.length,
      pendingClassifications: discoveries.filter(d => d.needsReview && !d.approved).length,
      classificationCoverage: Math.round(coverage * 100),
      recentScans: jobs.slice(-5),
      topSensitiveDataTypes: topTypes,
      complianceScore: Math.round(coverage * 100),
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const aiDataDiscoveryClassificationService = new AIDataDiscoveryClassificationService();
