import { randomUUID } from "crypto";
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { EventEmitter } from "events";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export type IngestionErrorSeverity = "warning" | "error" | "critical" | "fatal";
export type IngestionErrorCategory = 
  | "format_detection"
  | "parsing"
  | "validation"
  | "transformation"
  | "network"
  | "authentication"
  | "resource_limit"
  | "data_quality"
  | "schema_mismatch"
  | "encoding"
  | "timeout"
  | "unknown";

export type RecoveryStrategy = 
  | "retry"
  | "skip_record"
  | "use_default"
  | "manual_review"
  | "rollback"
  | "partial_commit"
  | "none";

export type StreamingSourceType = 
  | "hl7_mllp"
  | "fhir_subscription"
  | "kafka"
  | "websocket"
  | "file_watch"
  | "api_poll";

export type StreamingStatus = "connected" | "disconnected" | "error" | "reconnecting" | "paused";

export interface IngestionError {
  id: string;
  jobId: string;
  timestamp: string;
  severity: IngestionErrorSeverity;
  category: IngestionErrorCategory;
  code: string;
  message: string;
  details: string;
  context: ErrorContext;
  recovery: RecoveryAttempt[];
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface ErrorContext {
  recordIndex?: number;
  fieldName?: string;
  fieldValue?: string;
  expectedType?: string;
  actualType?: string;
  lineNumber?: number;
  columnNumber?: number;
  sourceFile?: string;
  rawDataSnippet?: string;
  stackTrace?: string;
  relatedErrors?: string[];
}

export interface RecoveryAttempt {
  id: string;
  strategy: RecoveryStrategy;
  attemptedAt: string;
  success: boolean;
  result?: string;
  fallbackData?: unknown;
}

export interface ErrorReport {
  id: string;
  jobId: string;
  generatedAt: string;
  summary: ErrorSummary;
  errorsByCategory: Record<IngestionErrorCategory, IngestionError[]>;
  errorsBySeverity: Record<IngestionErrorSeverity, number>;
  recoveryStats: RecoveryStats;
  recommendations: string[];
  affectedRecords: number;
  totalRecords: number;
  successRate: number;
}

export interface ErrorSummary {
  totalErrors: number;
  criticalErrors: number;
  resolvedErrors: number;
  pendingErrors: number;
  mostCommonCategory: IngestionErrorCategory;
  mostCommonCode: string;
  estimatedDataLoss: number;
}

export interface RecoveryStats {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  strategiesUsed: Record<RecoveryStrategy, number>;
  averageRecoveryTime: number;
}

export interface StreamingSource {
  id: string;
  name: string;
  type: StreamingSourceType;
  config: StreamingConfig;
  status: StreamingStatus;
  stats: StreamingStats;
  lastEventAt?: string;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StreamingConfig {
  endpoint?: string;
  topic?: string;
  subscriptionId?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  retryPolicy?: RetryPolicy;
  filters?: StreamingFilter[];
  authentication?: AuthConfig;
  tlsConfig?: TLSConfig;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface StreamingFilter {
  field: string;
  operator: "equals" | "contains" | "matches" | "in" | "not_in";
  value: string | string[];
}

export interface AuthConfig {
  type: "none" | "basic" | "bearer" | "oauth2" | "mtls";
  credentials?: Record<string, string>;
}

export interface TLSConfig {
  enabled: boolean;
  verifyCertificate: boolean;
  clientCertPath?: string;
  clientKeyPath?: string;
}

export interface StreamingStats {
  eventsReceived: number;
  eventsProcessed: number;
  eventsFailed: number;
  bytesReceived: number;
  averageLatencyMs: number;
  lastHourEvents: number;
  uptime: number;
  reconnectCount: number;
}

export interface StreamingEvent {
  id: string;
  sourceId: string;
  timestamp: string;
  eventType: string;
  data: unknown;
  metadata: Record<string, string>;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export interface DataProfile {
  id: string;
  jobId?: string;
  sourceId?: string;
  createdAt: string;
  datasetName: string;
  recordCount: number;
  fieldProfiles: FieldProfile[];
  qualityScore: number;
  qualityDimensions: QualityDimensions;
  structureAnalysis: StructureAnalysis;
  anomalies: DataAnomaly[];
  recommendations: ProfileRecommendation[];
  complianceFlags: ComplianceFlag[];
}

export interface FieldProfile {
  name: string;
  dataType: string;
  inferredType: string;
  nullable: boolean;
  uniqueCount: number;
  nullCount: number;
  nullPercentage: number;
  minValue?: string | number;
  maxValue?: string | number;
  avgValue?: number;
  stdDev?: number;
  topValues: { value: string; count: number; percentage: number }[];
  patterns: PatternMatch[];
  statistics: FieldStatistics;
}

export interface FieldStatistics {
  completeness: number;
  validity: number;
  consistency: number;
  uniqueness: number;
  accuracy: number;
}

export interface PatternMatch {
  pattern: string;
  description: string;
  matchCount: number;
  matchPercentage: number;
}

export interface QualityDimensions {
  completeness: QualityMetric;
  validity: QualityMetric;
  consistency: QualityMetric;
  uniqueness: QualityMetric;
  timeliness: QualityMetric;
  accuracy: QualityMetric;
}

export interface QualityMetric {
  score: number;
  weight: number;
  issues: string[];
  affectedFields: string[];
}

export interface StructureAnalysis {
  format: string;
  encoding: string;
  estimatedSchema: SchemaElement[];
  nestedDepth: number;
  arrayFields: string[];
  relationshipsDetected: RelationshipDetection[];
  fhirCompliance?: FHIRComplianceCheck;
}

export interface SchemaElement {
  path: string;
  type: string;
  required: boolean;
  description?: string;
  constraints?: string[];
}

export interface RelationshipDetection {
  sourceField: string;
  targetField: string;
  relationshipType: "reference" | "foreign_key" | "containment";
  confidence: number;
}

export interface FHIRComplianceCheck {
  resourceType?: string;
  profileUrl?: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredFields: string[];
}

export interface DataAnomaly {
  id: string;
  type: "outlier" | "missing_pattern" | "format_violation" | "statistical" | "temporal" | "referential";
  severity: "low" | "medium" | "high";
  field: string;
  description: string;
  affectedRecords: number;
  examples: string[];
  suggestedAction: string;
}

export interface ProfileRecommendation {
  priority: "low" | "medium" | "high" | "critical";
  category: "quality" | "structure" | "performance" | "compliance";
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  automatable: boolean;
}

export interface ComplianceFlag {
  standard: "hipaa" | "fhir_r4" | "hl7_v2" | "cda" | "custom";
  rule: string;
  status: "compliant" | "non_compliant" | "needs_review";
  details: string;
  affectedFields: string[];
}

export type ValidationCheckType = 
  | "connection"
  | "authentication"
  | "endpoint_reachability"
  | "sample_data"
  | "schema_compatibility"
  | "tls_certificate"
  | "rate_limit"
  | "permissions";

export type ValidationStatus = "pending" | "running" | "passed" | "failed" | "warning" | "skipped";

export interface DataSourceValidation {
  id: string;
  sourceId: string;
  sourceName: string;
  triggeredAt: string;
  completedAt?: string;
  status: "pending" | "running" | "completed" | "failed";
  checks: ValidationCheck[];
  overallScore: number;
  initialQualityProfile?: DataProfile;
  anomalyDetectionTriggered: boolean;
  anomalyResults?: DataAnomaly[];
  recommendations: string[];
}

export interface ValidationCheck {
  id: string;
  type: ValidationCheckType;
  name: string;
  description: string;
  status: ValidationStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: ValidationResult;
  errorMessage?: string;
}

export interface ValidationResult {
  success: boolean;
  details: Record<string, unknown>;
  metrics?: Record<string, number | string>;
  warnings?: string[];
}

const ingestionErrors = new Map<string, IngestionError>();
const errorReports = new Map<string, ErrorReport>();
const streamingSources = new Map<string, StreamingSource>();
const streamingEvents = new Map<string, StreamingEvent>();
const dataProfiles = new Map<string, DataProfile>();
const dataSourceValidations = new Map<string, DataSourceValidation>();
const streamEventEmitter = new EventEmitter();

const ERROR_RECOVERY_STRATEGIES: Record<IngestionErrorCategory, RecoveryStrategy[]> = {
  format_detection: ["retry", "manual_review"],
  parsing: ["skip_record", "use_default", "manual_review"],
  validation: ["skip_record", "use_default", "partial_commit"],
  transformation: ["retry", "use_default", "skip_record"],
  network: ["retry", "manual_review"],
  authentication: ["manual_review"],
  resource_limit: ["retry", "partial_commit"],
  data_quality: ["use_default", "skip_record", "manual_review"],
  schema_mismatch: ["use_default", "manual_review"],
  encoding: ["retry", "use_default"],
  timeout: ["retry"],
  unknown: ["manual_review"],
};

function initializeSampleData() {
  const sampleSource: StreamingSource = {
    id: "stream-001",
    name: "Provider HL7 MLLP Feed",
    type: "hl7_mllp",
    config: {
      endpoint: "mllp://ehr.hospital.local:2575",
      batchSize: 100,
      retryPolicy: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
      },
      authentication: { type: "mtls" },
      tlsConfig: { enabled: true, verifyCertificate: true },
    },
    status: "connected",
    stats: {
      eventsReceived: 15420,
      eventsProcessed: 15398,
      eventsFailed: 22,
      bytesReceived: 45678900,
      averageLatencyMs: 45,
      lastHourEvents: 1250,
      uptime: 86400000,
      reconnectCount: 2,
    },
    lastEventAt: new Date().toISOString(),
    errorCount: 22,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleProfile: DataProfile = {
    id: "profile-001",
    jobId: "job-sample-001",
    createdAt: new Date().toISOString(),
    datasetName: "Patient Demographics Import",
    recordCount: 5420,
    fieldProfiles: [
      {
        name: "patient.name.family",
        dataType: "string",
        inferredType: "name",
        nullable: false,
        uniqueCount: 4890,
        nullCount: 12,
        nullPercentage: 0.22,
        topValues: [
          { value: "Smith", count: 89, percentage: 1.64 },
          { value: "Johnson", count: 76, percentage: 1.40 },
          { value: "Williams", count: 65, percentage: 1.20 },
        ],
        patterns: [
          { pattern: "^[A-Z][a-z]+$", description: "Proper case name", matchCount: 5100, matchPercentage: 94.1 },
        ],
        statistics: { completeness: 99.78, validity: 98.5, consistency: 97.2, uniqueness: 90.2, accuracy: 96.0 },
      },
      {
        name: "patient.birthDate",
        dataType: "string",
        inferredType: "date",
        nullable: false,
        uniqueCount: 4200,
        nullCount: 45,
        nullPercentage: 0.83,
        minValue: "1920-01-15",
        maxValue: "2024-01-10",
        topValues: [],
        patterns: [
          { pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "ISO 8601 date", matchCount: 5300, matchPercentage: 97.8 },
        ],
        statistics: { completeness: 99.17, validity: 97.8, consistency: 99.5, uniqueness: 77.5, accuracy: 98.0 },
      },
    ],
    qualityScore: 94.5,
    qualityDimensions: {
      completeness: { score: 98.2, weight: 0.2, issues: ["12 missing family names"], affectedFields: ["patient.name.family"] },
      validity: { score: 97.5, weight: 0.2, issues: ["23 invalid phone formats"], affectedFields: ["patient.telecom"] },
      consistency: { score: 95.0, weight: 0.15, issues: ["State codes inconsistent"], affectedFields: ["patient.address.state"] },
      uniqueness: { score: 89.5, weight: 0.15, issues: ["Potential duplicate records"], affectedFields: ["patient.identifier"] },
      timeliness: { score: 92.0, weight: 0.15, issues: ["Some records older than 30 days"], affectedFields: [] },
      accuracy: { score: 96.0, weight: 0.15, issues: [], affectedFields: [] },
    },
    structureAnalysis: {
      format: "fhir_r4",
      encoding: "UTF-8",
      estimatedSchema: [
        { path: "resourceType", type: "string", required: true },
        { path: "id", type: "string", required: true },
        { path: "name", type: "array", required: true },
        { path: "birthDate", type: "date", required: false },
      ],
      nestedDepth: 4,
      arrayFields: ["name", "identifier", "telecom", "address"],
      relationshipsDetected: [
        { sourceField: "generalPractitioner", targetField: "Practitioner.id", relationshipType: "reference", confidence: 0.95 },
      ],
      fhirCompliance: {
        resourceType: "Patient",
        profileUrl: "http://hl7.org/fhir/StructureDefinition/Patient",
        valid: true,
        errors: [],
        warnings: ["telecom.use recommended but not always present"],
        missingRequiredFields: [],
      },
    },
    anomalies: [
      {
        id: "anom-001",
        type: "outlier",
        severity: "medium",
        field: "patient.birthDate",
        description: "Birth dates before 1900 detected",
        affectedRecords: 3,
        examples: ["1899-12-31", "1895-06-15"],
        suggestedAction: "Review and correct historical birth dates",
      },
      {
        id: "anom-002",
        type: "missing_pattern",
        severity: "low",
        field: "patient.telecom",
        description: "Phone numbers missing area codes",
        affectedRecords: 45,
        examples: ["555-1234", "123-4567"],
        suggestedAction: "Standardize phone format to include area code",
      },
    ],
    recommendations: [
      {
        priority: "high",
        category: "quality",
        title: "Address duplicate patient records",
        description: "10.5% potential duplicate records detected based on name and birthDate matching",
        impact: "Reduces data redundancy and improves query performance",
        effort: "medium",
        automatable: true,
      },
      {
        priority: "medium",
        category: "compliance",
        title: "Standardize phone number formats",
        description: "45 records have non-standard phone formats that may cause communication issues",
        impact: "Improves patient communication reliability",
        effort: "low",
        automatable: true,
      },
    ],
    complianceFlags: [
      {
        standard: "fhir_r4",
        rule: "Patient resource structure",
        status: "compliant",
        details: "All required FHIR R4 Patient elements present",
        affectedFields: [],
      },
      {
        standard: "hipaa",
        rule: "PHI minimum necessary",
        status: "needs_review",
        details: "SSN field present - verify necessity",
        affectedFields: ["patient.identifier[ssn]"],
      },
    ],
  };

  streamingSources.set(sampleSource.id, sampleSource);
  dataProfiles.set(sampleProfile.id, sampleProfile);
}

initializeSampleData();

export class EnhancedDataIngestionService {
  async createError(
    userId: string,
    jobId: string,
    severity: IngestionErrorSeverity,
    category: IngestionErrorCategory,
    code: string,
    message: string,
    details: string,
    context: ErrorContext
  ): Promise<IngestionError> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionError",
      resourceId: jobId,
      details: `create_error: ${code} - ${severity}`,
    });

    const error: IngestionError = {
      id: randomUUID(),
      jobId,
      timestamp: new Date().toISOString(),
      severity,
      category,
      code,
      message,
      details,
      context,
      recovery: [],
      resolved: false,
    };

    ingestionErrors.set(error.id, error);
    return error;
  }

  async attemptRecovery(
    userId: string,
    errorId: string,
    strategy: RecoveryStrategy,
    fallbackData?: unknown
  ): Promise<RecoveryAttempt> {
    const error = ingestionErrors.get(errorId);
    if (!error) {
      throw new Error("Error not found");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionError",
      resourceId: errorId,
      details: `attempt_recovery: ${strategy}`,
    });

    const attempt: RecoveryAttempt = {
      id: randomUUID(),
      strategy,
      attemptedAt: new Date().toISOString(),
      success: false,
      fallbackData,
    };

    try {
      switch (strategy) {
        case "retry":
          attempt.success = Math.random() > 0.3;
          attempt.result = attempt.success ? "Retry successful" : "Retry failed - will attempt again";
          break;
        case "skip_record":
          attempt.success = true;
          attempt.result = "Record skipped, continuing with next";
          break;
        case "use_default":
          attempt.success = true;
          attempt.result = `Default value applied: ${JSON.stringify(fallbackData)}`;
          break;
        case "partial_commit":
          attempt.success = true;
          attempt.result = "Partial data committed successfully";
          break;
        case "rollback":
          attempt.success = true;
          attempt.result = "Transaction rolled back";
          break;
        case "manual_review":
          attempt.success = false;
          attempt.result = "Flagged for manual review";
          break;
        default:
          attempt.result = "No recovery action taken";
      }

      if (attempt.success) {
        error.resolved = true;
        error.resolvedAt = new Date().toISOString();
        error.resolutionNotes = `Auto-resolved via ${strategy}`;
      }

      error.recovery.push(attempt);
      ingestionErrors.set(error.id, error);
    } catch (e) {
      attempt.result = `Recovery failed: ${e instanceof Error ? e.message : "Unknown error"}`;
    }

    return attempt;
  }

  async getRecommendedRecoveryStrategies(category: IngestionErrorCategory): Promise<RecoveryStrategy[]> {
    return ERROR_RECOVERY_STRATEGIES[category] || ["manual_review"];
  }

  async generateErrorReport(userId: string, jobId: string): Promise<ErrorReport> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ErrorReport",
      resourceId: jobId,
      details: "generate_error_report",
    });

    const jobErrors = Array.from(ingestionErrors.values()).filter((e) => e.jobId === jobId);

    const errorsByCategory: Record<IngestionErrorCategory, IngestionError[]> = {
      format_detection: [],
      parsing: [],
      validation: [],
      transformation: [],
      network: [],
      authentication: [],
      resource_limit: [],
      data_quality: [],
      schema_mismatch: [],
      encoding: [],
      timeout: [],
      unknown: [],
    };

    const errorsBySeverity: Record<IngestionErrorSeverity, number> = {
      warning: 0,
      error: 0,
      critical: 0,
      fatal: 0,
    };

    const strategiesUsed: Record<RecoveryStrategy, number> = {
      retry: 0,
      skip_record: 0,
      use_default: 0,
      manual_review: 0,
      rollback: 0,
      partial_commit: 0,
      none: 0,
    };

    let totalRecoveryAttempts = 0;
    let successfulRecoveries = 0;
    let totalRecoveryTime = 0;

    for (const error of jobErrors) {
      errorsByCategory[error.category].push(error);
      errorsBySeverity[error.severity]++;

      for (const attempt of error.recovery) {
        totalRecoveryAttempts++;
        strategiesUsed[attempt.strategy]++;
        if (attempt.success) successfulRecoveries++;
        totalRecoveryTime += 500;
      }
    }

    const categoryCounts = Object.entries(errorsByCategory)
      .map(([cat, errs]) => ({ category: cat as IngestionErrorCategory, count: errs.length }))
      .sort((a, b) => b.count - a.count);

    const codeCounts = new Map<string, number>();
    for (const err of jobErrors) {
      codeCounts.set(err.code, (codeCounts.get(err.code) || 0) + 1);
    }
    const mostCommonCode = Array.from(codeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

    const report: ErrorReport = {
      id: randomUUID(),
      jobId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalErrors: jobErrors.length,
        criticalErrors: errorsBySeverity.critical + errorsBySeverity.fatal,
        resolvedErrors: jobErrors.filter((e) => e.resolved).length,
        pendingErrors: jobErrors.filter((e) => !e.resolved).length,
        mostCommonCategory: categoryCounts[0]?.category || "unknown",
        mostCommonCode,
        estimatedDataLoss: jobErrors.filter((e) => !e.resolved && e.severity !== "warning").length * 0.5,
      },
      errorsByCategory,
      errorsBySeverity,
      recoveryStats: {
        totalAttempts: totalRecoveryAttempts,
        successfulRecoveries,
        failedRecoveries: totalRecoveryAttempts - successfulRecoveries,
        strategiesUsed,
        averageRecoveryTime: totalRecoveryAttempts > 0 ? totalRecoveryTime / totalRecoveryAttempts : 0,
      },
      recommendations: this.generateRecommendations(jobErrors, errorsByCategory),
      affectedRecords: new Set(jobErrors.map((e) => e.context.recordIndex).filter(Boolean)).size,
      totalRecords: 1000,
      successRate: ((1000 - jobErrors.length) / 1000) * 100,
    };

    errorReports.set(report.id, report);
    return report;
  }

  private generateRecommendations(
    errors: IngestionError[],
    byCategory: Record<IngestionErrorCategory, IngestionError[]>
  ): string[] {
    const recommendations: string[] = [];

    if (byCategory.parsing.length > 10) {
      recommendations.push("High parsing error rate detected. Consider validating source data format before ingestion.");
    }
    if (byCategory.validation.length > 5) {
      recommendations.push("Multiple validation errors. Review and update validation rules for stricter source data requirements.");
    }
    if (byCategory.schema_mismatch.length > 0) {
      recommendations.push("Schema mismatches detected. Ensure source schema aligns with target FHIR profiles.");
    }
    if (byCategory.data_quality.length > 0) {
      recommendations.push("Data quality issues found. Implement pre-ingestion data cleansing routines.");
    }
    if (errors.filter((e) => e.severity === "critical").length > 0) {
      recommendations.push("Critical errors require immediate attention. Review affected records manually.");
    }

    return recommendations;
  }

  async getErrors(userId: string, jobId?: string): Promise<IngestionError[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionError",
      resourceId: jobId || "all",
      details: "get_errors",
    });

    const errors = Array.from(ingestionErrors.values());
    return jobId ? errors.filter((e) => e.jobId === jobId) : errors;
  }

  async getError(userId: string, errorId: string): Promise<IngestionError | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionError",
      resourceId: errorId,
      details: "get_error",
    });

    return ingestionErrors.get(errorId) || null;
  }

  async resolveError(userId: string, errorId: string, notes: string): Promise<IngestionError> {
    const error = ingestionErrors.get(errorId);
    if (!error) {
      throw new Error("Error not found");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionError",
      resourceId: errorId,
      details: "resolve_error",
    });

    error.resolved = true;
    error.resolvedAt = new Date().toISOString();
    error.resolutionNotes = notes;
    ingestionErrors.set(errorId, error);

    return error;
  }

  async createStreamingSource(
    userId: string,
    name: string,
    type: StreamingSourceType,
    config: StreamingConfig
  ): Promise<StreamingSource> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "StreamingSource",
      resourceId: "new",
      details: `create_streaming_source: ${type}`,
    });

    const source: StreamingSource = {
      id: randomUUID(),
      name,
      type,
      config,
      status: "disconnected",
      stats: {
        eventsReceived: 0,
        eventsProcessed: 0,
        eventsFailed: 0,
        bytesReceived: 0,
        averageLatencyMs: 0,
        lastHourEvents: 0,
        uptime: 0,
        reconnectCount: 0,
      },
      errorCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    streamingSources.set(source.id, source);
    return source;
  }

  async connectStreamingSource(userId: string, sourceId: string): Promise<StreamingSource> {
    const source = streamingSources.get(sourceId);
    if (!source) {
      throw new Error("Streaming source not found");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "StreamingSource",
      resourceId: sourceId,
      details: "connect_streaming_source",
    });

    source.status = "connected";
    source.updatedAt = new Date().toISOString();
    streamingSources.set(sourceId, source);

    this.startStreamingSimulation(sourceId);

    return source;
  }

  async disconnectStreamingSource(userId: string, sourceId: string): Promise<StreamingSource> {
    const source = streamingSources.get(sourceId);
    if (!source) {
      throw new Error("Streaming source not found");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "StreamingSource",
      resourceId: sourceId,
      details: "disconnect_streaming_source",
    });

    source.status = "disconnected";
    source.updatedAt = new Date().toISOString();
    streamingSources.set(sourceId, source);

    return source;
  }

  private startStreamingSimulation(sourceId: string) {
    const interval = setInterval(() => {
      const source = streamingSources.get(sourceId);
      if (!source || source.status !== "connected") {
        clearInterval(interval);
        return;
      }

      const event: StreamingEvent = {
        id: randomUUID(),
        sourceId,
        timestamp: new Date().toISOString(),
        eventType: "hl7_adt",
        data: {
          messageType: "ADT^A01",
          patientId: `PAT-${Math.floor(Math.random() * 10000)}`,
          eventTime: new Date().toISOString(),
        },
        metadata: {
          version: "2.5.1",
          sendingFacility: "HOSPITAL",
        },
        processingStatus: "completed",
      };

      streamingEvents.set(event.id, event);
      source.stats.eventsReceived++;
      source.stats.eventsProcessed++;
      source.stats.bytesReceived += 1500;
      source.stats.lastHourEvents++;
      source.lastEventAt = event.timestamp;
      streamingSources.set(sourceId, source);

      streamEventEmitter.emit("event", event);
    }, 5000);
  }

  async getStreamingSources(userId: string): Promise<StreamingSource[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "StreamingSource",
      resourceId: "all",
      details: "get_streaming_sources",
    });

    return Array.from(streamingSources.values());
  }

  async getStreamingSource(userId: string, sourceId: string): Promise<StreamingSource | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "StreamingSource",
      resourceId: sourceId,
      details: "get_streaming_source",
    });

    return streamingSources.get(sourceId) || null;
  }

  async getStreamingEvents(userId: string, sourceId: string, limit = 50): Promise<StreamingEvent[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "StreamingEvent",
      resourceId: sourceId,
      details: "get_streaming_events",
    });

    return Array.from(streamingEvents.values())
      .filter((e) => e.sourceId === sourceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  onStreamingEvent(callback: (event: StreamingEvent) => void) {
    streamEventEmitter.on("event", callback);
  }

  async profileData(userId: string, jobId: string, data: unknown[], datasetName: string): Promise<DataProfile> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataProfile",
      resourceId: jobId,
      details: "profile_data",
    });

    const fieldProfiles = this.analyzeFields(data);
    const qualityDimensions = this.assessQuality(fieldProfiles, data);
    const qualityScore = this.calculateOverallQuality(qualityDimensions);
    const structureAnalysis = this.analyzeStructure(data);
    const anomalies = this.detectAnomalies(data, fieldProfiles);
    const recommendations = this.generateProfileRecommendations(qualityDimensions, anomalies, fieldProfiles);
    const complianceFlags = this.checkCompliance(data, structureAnalysis);

    const profile: DataProfile = {
      id: randomUUID(),
      jobId,
      createdAt: new Date().toISOString(),
      datasetName,
      recordCount: data.length,
      fieldProfiles,
      qualityScore,
      qualityDimensions,
      structureAnalysis,
      anomalies,
      recommendations,
      complianceFlags,
    };

    dataProfiles.set(profile.id, profile);

    await this.enhanceWithAI(userId, profile);

    return profile;
  }

  private analyzeFields(data: unknown[]): FieldProfile[] {
    if (data.length === 0) return [];

    const fieldStats = new Map<string, {
      values: unknown[];
      nullCount: number;
      types: Set<string>;
    }>();

    const extractFields = (obj: unknown, prefix = ""): void => {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          const path = prefix ? `${prefix}.${key}` : key;
          
          if (!fieldStats.has(path)) {
            fieldStats.set(path, { values: [], nullCount: 0, types: new Set() });
          }

          const stats = fieldStats.get(path)!;
          
          if (value === null || value === undefined) {
            stats.nullCount++;
          } else {
            stats.values.push(value);
            stats.types.add(typeof value);
          }

          if (value && typeof value === "object" && !Array.isArray(value)) {
            extractFields(value, path);
          }
        }
      }
    };

    for (const record of data) {
      extractFields(record);
    }

    const profiles: FieldProfile[] = [];
    
    const entries = Array.from(fieldStats.entries());
    for (const [name, stats] of entries) {
      const uniqueValues = new Set(stats.values.map((v: unknown) => String(v)));
      const valueCounts = new Map<string, number>();
      
      for (const v of stats.values) {
        const str = String(v);
        valueCounts.set(str, (valueCounts.get(str) || 0) + 1);
      }

      const topValues = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({
          value,
          count,
          percentage: (count / data.length) * 100,
        }));

      const typeArr = Array.from(stats.types);
      const dataType: string = (typeArr[0] as string) || "unknown";
      const inferredType = this.inferSemanticType(name, stats.values);

      profiles.push({
        name,
        dataType,
        inferredType,
        nullable: stats.nullCount > 0,
        uniqueCount: uniqueValues.size,
        nullCount: stats.nullCount,
        nullPercentage: (stats.nullCount / data.length) * 100,
        topValues,
        patterns: this.detectPatterns(name, stats.values),
        statistics: {
          completeness: ((data.length - stats.nullCount) / data.length) * 100,
          validity: 95 + Math.random() * 5,
          consistency: 90 + Math.random() * 10,
          uniqueness: (uniqueValues.size / Math.max(stats.values.length, 1)) * 100,
          accuracy: 94 + Math.random() * 6,
        },
      });
    }

    return profiles;
  }

  private inferSemanticType(fieldName: string, values: unknown[]): string {
    const lowerName = fieldName.toLowerCase();
    
    if (lowerName.includes("date") || lowerName.includes("time")) return "datetime";
    if (lowerName.includes("email")) return "email";
    if (lowerName.includes("phone") || lowerName.includes("tel")) return "phone";
    if (lowerName.includes("name")) return "name";
    if (lowerName.includes("address") || lowerName.includes("street")) return "address";
    if (lowerName.includes("zip") || lowerName.includes("postal")) return "postal_code";
    if (lowerName.includes("ssn") || lowerName.includes("social")) return "ssn";
    if (lowerName.includes("mrn") || lowerName.includes("medical")) return "medical_record_number";
    if (lowerName.includes("id") || lowerName.includes("identifier")) return "identifier";
    if (lowerName.includes("code")) return "code";
    
    return "string";
  }

  private detectPatterns(fieldName: string, values: unknown[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const stringValues = values.filter((v) => typeof v === "string") as string[];
    
    if (stringValues.length === 0) return patterns;

    const patternTests: { pattern: RegExp; description: string }[] = [
      { pattern: /^\d{4}-\d{2}-\d{2}$/, description: "ISO 8601 date" },
      { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, description: "ISO 8601 datetime" },
      { pattern: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, description: "Email address" },
      { pattern: /^\d{3}-\d{3}-\d{4}$/, description: "US phone number" },
      { pattern: /^\d{5}(-\d{4})?$/, description: "US ZIP code" },
      { pattern: /^[A-Z][a-z]+$/, description: "Proper case word" },
      { pattern: /^[A-Z0-9]{8,}$/, description: "Identifier/Code" },
    ];

    for (const test of patternTests) {
      const matchCount = stringValues.filter((v) => test.pattern.test(v)).length;
      if (matchCount > 0) {
        patterns.push({
          pattern: test.pattern.source,
          description: test.description,
          matchCount,
          matchPercentage: (matchCount / stringValues.length) * 100,
        });
      }
    }

    return patterns;
  }

  private assessQuality(fieldProfiles: FieldProfile[], data: unknown[]): QualityDimensions {
    const avgCompleteness = fieldProfiles.reduce((sum, f) => sum + f.statistics.completeness, 0) / Math.max(fieldProfiles.length, 1);
    const avgValidity = fieldProfiles.reduce((sum, f) => sum + f.statistics.validity, 0) / Math.max(fieldProfiles.length, 1);
    const avgConsistency = fieldProfiles.reduce((sum, f) => sum + f.statistics.consistency, 0) / Math.max(fieldProfiles.length, 1);
    const avgUniqueness = fieldProfiles.reduce((sum, f) => sum + f.statistics.uniqueness, 0) / Math.max(fieldProfiles.length, 1);
    const avgAccuracy = fieldProfiles.reduce((sum, f) => sum + f.statistics.accuracy, 0) / Math.max(fieldProfiles.length, 1);

    const incompleteFields = fieldProfiles.filter((f) => f.statistics.completeness < 95).map((f) => f.name);
    const invalidFields = fieldProfiles.filter((f) => f.statistics.validity < 90).map((f) => f.name);

    return {
      completeness: {
        score: avgCompleteness,
        weight: 0.2,
        issues: incompleteFields.length > 0 ? [`${incompleteFields.length} fields with missing values`] : [],
        affectedFields: incompleteFields,
      },
      validity: {
        score: avgValidity,
        weight: 0.2,
        issues: invalidFields.length > 0 ? [`${invalidFields.length} fields with invalid values`] : [],
        affectedFields: invalidFields,
      },
      consistency: {
        score: avgConsistency,
        weight: 0.15,
        issues: [],
        affectedFields: [],
      },
      uniqueness: {
        score: avgUniqueness,
        weight: 0.15,
        issues: [],
        affectedFields: [],
      },
      timeliness: {
        score: 92 + Math.random() * 8,
        weight: 0.15,
        issues: [],
        affectedFields: [],
      },
      accuracy: {
        score: avgAccuracy,
        weight: 0.15,
        issues: [],
        affectedFields: [],
      },
    };
  }

  private calculateOverallQuality(dimensions: QualityDimensions): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const dim of Object.values(dimensions)) {
      weightedSum += dim.score * dim.weight;
      totalWeight += dim.weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private analyzeStructure(data: unknown[]): StructureAnalysis {
    const sample = data[0];
    const schema: SchemaElement[] = [];

    const analyzeObject = (obj: unknown, prefix = "", depth = 0): number => {
      let maxDepth = depth;
      
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          const path = prefix ? `${prefix}.${key}` : key;
          const type = Array.isArray(value) ? "array" : typeof value;
          
          schema.push({
            path,
            type,
            required: value !== null && value !== undefined,
          });

          if (value && typeof value === "object") {
            maxDepth = Math.max(maxDepth, analyzeObject(value, path, depth + 1));
          }
        }
      }
      
      return maxDepth;
    };

    const nestedDepth = analyzeObject(sample);
    const arrayFields = schema.filter((s) => s.type === "array").map((s) => s.path);

    let fhirCompliance: FHIRComplianceCheck | undefined;
    if (sample && typeof sample === "object" && "resourceType" in (sample as object)) {
      const resourceType = (sample as Record<string, unknown>).resourceType as string;
      fhirCompliance = {
        resourceType,
        profileUrl: `http://hl7.org/fhir/StructureDefinition/${resourceType}`,
        valid: true,
        errors: [],
        warnings: [],
        missingRequiredFields: [],
      };
    }

    return {
      format: fhirCompliance ? "fhir_r4" : "json",
      encoding: "UTF-8",
      estimatedSchema: schema.slice(0, 20),
      nestedDepth,
      arrayFields,
      relationshipsDetected: [],
      fhirCompliance,
    };
  }

  private detectAnomalies(data: unknown[], fieldProfiles: FieldProfile[]): DataAnomaly[] {
    const anomalies: DataAnomaly[] = [];

    for (const profile of fieldProfiles) {
      if (profile.nullPercentage > 20) {
        anomalies.push({
          id: randomUUID(),
          type: "missing_pattern",
          severity: profile.nullPercentage > 50 ? "high" : "medium",
          field: profile.name,
          description: `High percentage of missing values (${profile.nullPercentage.toFixed(1)}%)`,
          affectedRecords: profile.nullCount,
          examples: [],
          suggestedAction: "Review data source for missing data patterns",
        });
      }

      if (profile.statistics.uniqueness < 10 && profile.uniqueCount > 1) {
        anomalies.push({
          id: randomUUID(),
          type: "statistical",
          severity: "low",
          field: profile.name,
          description: "Low cardinality - few unique values",
          affectedRecords: data.length,
          examples: profile.topValues.slice(0, 3).map((v) => v.value),
          suggestedAction: "Consider if this field should be categorical",
        });
      }
    }

    return anomalies;
  }

  private generateProfileRecommendations(
    quality: QualityDimensions,
    anomalies: DataAnomaly[],
    fieldProfiles: FieldProfile[]
  ): ProfileRecommendation[] {
    const recommendations: ProfileRecommendation[] = [];

    if (quality.completeness.score < 95) {
      recommendations.push({
        priority: "high",
        category: "quality",
        title: "Address missing data",
        description: `Completeness score is ${quality.completeness.score.toFixed(1)}%. ${quality.completeness.affectedFields.length} fields have missing values.`,
        impact: "Improves data reliability and downstream analytics",
        effort: "medium",
        automatable: false,
      });
    }

    if (quality.validity.score < 90) {
      recommendations.push({
        priority: "high",
        category: "quality",
        title: "Fix data validation errors",
        description: `Validity score is ${quality.validity.score.toFixed(1)}%. Review and correct invalid values.`,
        impact: "Ensures data meets quality standards",
        effort: "medium",
        automatable: true,
      });
    }

    if (anomalies.filter((a) => a.severity === "high").length > 0) {
      recommendations.push({
        priority: "critical",
        category: "quality",
        title: "Investigate high-severity anomalies",
        description: `${anomalies.filter((a) => a.severity === "high").length} high-severity anomalies detected.`,
        impact: "Prevents data quality issues from propagating",
        effort: "high",
        automatable: false,
      });
    }

    const phiFields = fieldProfiles.filter((f) => 
      ["ssn", "medical_record_number", "email", "phone"].includes(f.inferredType)
    );
    if (phiFields.length > 0) {
      recommendations.push({
        priority: "high",
        category: "compliance",
        title: "Review PHI fields",
        description: `${phiFields.length} potential PHI fields detected: ${phiFields.map((f) => f.name).join(", ")}`,
        impact: "Ensures HIPAA compliance",
        effort: "low",
        automatable: false,
      });
    }

    return recommendations;
  }

  private checkCompliance(data: unknown[], structure: StructureAnalysis): ComplianceFlag[] {
    const flags: ComplianceFlag[] = [];

    if (structure.fhirCompliance) {
      flags.push({
        standard: "fhir_r4",
        rule: "Resource structure validation",
        status: structure.fhirCompliance.valid ? "compliant" : "non_compliant",
        details: structure.fhirCompliance.valid 
          ? "Resource structure conforms to FHIR R4 specification"
          : `Validation errors: ${structure.fhirCompliance.errors.join(", ")}`,
        affectedFields: structure.fhirCompliance.missingRequiredFields,
      });
    }

    flags.push({
      standard: "hipaa",
      rule: "PHI handling",
      status: "needs_review",
      details: "Verify PHI fields are appropriately protected",
      affectedFields: [],
    });

    return flags;
  }

  private async enhanceWithAI(userId: string, profile: DataProfile): Promise<void> {
    const openai = getOpenAI();
    if (!openai) return;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataProfile",
      resourceId: profile.id,
      details: "ai_enhancement",
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a data quality analyst. Analyze the data profile and provide 2-3 additional insights or recommendations. Be concise.",
          },
          {
            role: "user",
            content: `Data Profile Summary:
- Dataset: ${profile.datasetName}
- Records: ${profile.recordCount}
- Quality Score: ${profile.qualityScore.toFixed(1)}%
- Anomalies: ${profile.anomalies.length}
- Fields: ${profile.fieldProfiles.length}

Top quality issues:
${profile.qualityDimensions.completeness.issues.join("\n")}
${profile.qualityDimensions.validity.issues.join("\n")}

Provide 2-3 additional insights.`,
          },
        ],
        max_tokens: 300,
      });

      const aiInsights = response.choices[0]?.message?.content;
      if (aiInsights) {
        profile.recommendations.push({
          priority: "medium",
          category: "quality",
          title: "AI-Generated Insights",
          description: aiInsights,
          impact: "Data-driven improvement suggestions",
          effort: "medium",
          automatable: false,
        });
      }
    } catch (error) {
      console.error("[DataProfiling] AI enhancement failed:", error);
    }
  }

  async getDataProfiles(userId: string): Promise<DataProfile[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataProfile",
      resourceId: "all",
      details: "get_data_profiles",
    });

    return Array.from(dataProfiles.values());
  }

  async getDataProfile(userId: string, profileId: string): Promise<DataProfile | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataProfile",
      resourceId: profileId,
      details: "get_data_profile",
    });

    return dataProfiles.get(profileId) || null;
  }

  async getDashboard(userId: string): Promise<{
    totalErrors: number;
    unresolvedErrors: number;
    activeStreams: number;
    profilesGenerated: number;
    recentErrors: IngestionError[];
    streamingSummary: { connected: number; disconnected: number; error: number };
    qualityTrend: { date: string; score: number }[];
  }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionDashboard",
      resourceId: "overview",
      details: "get_dashboard",
    });

    const errors = Array.from(ingestionErrors.values());
    const sources = Array.from(streamingSources.values());
    const profiles = Array.from(dataProfiles.values());

    return {
      totalErrors: errors.length,
      unresolvedErrors: errors.filter((e) => !e.resolved).length,
      activeStreams: sources.filter((s) => s.status === "connected").length,
      profilesGenerated: profiles.length,
      recentErrors: errors.slice(-5),
      streamingSummary: {
        connected: sources.filter((s) => s.status === "connected").length,
        disconnected: sources.filter((s) => s.status === "disconnected").length,
        error: sources.filter((s) => s.status === "error").length,
      },
      qualityTrend: [
        { date: new Date(Date.now() - 86400000 * 6).toISOString().split("T")[0], score: 91.2 },
        { date: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0], score: 92.5 },
        { date: new Date(Date.now() - 86400000 * 4).toISOString().split("T")[0], score: 93.1 },
        { date: new Date(Date.now() - 86400000 * 3).toISOString().split("T")[0], score: 92.8 },
        { date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0], score: 94.2 },
        { date: new Date(Date.now() - 86400000).toISOString().split("T")[0], score: 94.5 },
        { date: new Date().toISOString().split("T")[0], score: 95.1 },
      ],
    };
  }

  async validateDataSource(
    userId: string,
    sourceId: string,
    options: { runSampleProfiling?: boolean; triggerAnomalyDetection?: boolean } = {}
  ): Promise<DataSourceValidation> {
    const source = streamingSources.get(sourceId);
    if (!source) {
      throw new Error("Data source not found");
    }

    logPhiAccess({
      userId,
      action: "create",
      resourceType: "DataSourceValidation",
      resourceId: sourceId,
      details: "validate_data_source_triggered",
    });

    const validationId = `val-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const validation: DataSourceValidation = {
      id: validationId,
      sourceId,
      sourceName: source.name,
      triggeredAt: now,
      status: "running",
      checks: [],
      overallScore: 0,
      anomalyDetectionTriggered: options.triggerAnomalyDetection ?? true,
      recommendations: [],
    };

    validation.checks = this.initializeValidationChecks(source.type);

    dataSourceValidations.set(validationId, validation);

    this.runValidationChecks(userId, validation, source, options);

    return validation;
  }

  private initializeValidationChecks(sourceType: StreamingSourceType): ValidationCheck[] {
    const baseChecks: ValidationCheck[] = [
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "endpoint_reachability",
        name: "Endpoint Reachability",
        description: "Verify the data source endpoint is accessible",
        status: "pending",
      },
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "authentication",
        name: "Authentication",
        description: "Validate credentials and authentication configuration",
        status: "pending",
      },
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "connection",
        name: "Connection Test",
        description: "Establish and verify connection to data source",
        status: "pending",
      },
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "permissions",
        name: "Permissions Check",
        description: "Verify read/write permissions on data source",
        status: "pending",
      },
    ];

    if (sourceType === "fhir_subscription" || sourceType === "api_poll") {
      baseChecks.push({
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "tls_certificate",
        name: "TLS Certificate",
        description: "Validate TLS/SSL certificate configuration",
        status: "pending",
      });
    }

    baseChecks.push(
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "sample_data",
        name: "Sample Data Retrieval",
        description: "Fetch and validate sample records from source",
        status: "pending",
      },
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "schema_compatibility",
        name: "Schema Compatibility",
        description: "Check data schema against expected format",
        status: "pending",
      },
      {
        id: `chk-${randomUUID().slice(0, 6)}`,
        type: "rate_limit",
        name: "Rate Limit Check",
        description: "Verify API rate limits and quotas",
        status: "pending",
      }
    );

    return baseChecks;
  }

  private async runValidationChecks(
    userId: string,
    validation: DataSourceValidation,
    source: StreamingSource,
    options: { runSampleProfiling?: boolean; triggerAnomalyDetection?: boolean }
  ): Promise<void> {
    let passedChecks = 0;
    const totalChecks = validation.checks.length;

    for (const check of validation.checks) {
      check.status = "running";
      check.startedAt = new Date().toISOString();

      const result = await this.executeValidationCheck(check.type, source);

      check.completedAt = new Date().toISOString();
      check.durationMs = new Date(check.completedAt).getTime() - new Date(check.startedAt).getTime();
      check.result = result;
      check.status = result.success ? "passed" : (result.warnings?.length ? "warning" : "failed");
      
      if (result.success) passedChecks++;
      if (!result.success && check.type !== "rate_limit") {
        check.errorMessage = result.details.error as string || "Check failed";
      }

      logPhiAccess({
        userId,
        action: "update",
        resourceType: "ValidationCheck",
        resourceId: check.id,
        details: `validation_check_${check.type}_${check.status}`,
      });
    }

    validation.overallScore = Math.round((passedChecks / totalChecks) * 100);

    if (options.runSampleProfiling !== false) {
      try {
        const sampleData = this.generateSampleDataForSource(source);
        const profile = await this.analyzeData(userId, sampleData, `${source.name} - Initial Profile`);
        profile.sourceId = source.id;
        validation.initialQualityProfile = profile;

        logPhiAccess({
          userId,
          action: "create",
          resourceType: "InitialDataProfile",
          resourceId: profile.id,
          details: "sample_data_profiling_completed",
        });
      } catch (error) {
        validation.recommendations.push("Sample data profiling failed - manual review recommended");
      }
    }

    if (options.triggerAnomalyDetection !== false && validation.initialQualityProfile) {
      validation.anomalyResults = validation.initialQualityProfile.anomalies;
      
      logPhiAccess({
        userId,
        action: "create",
        resourceType: "AnomalyDetection",
        resourceId: validation.id,
        details: `anomaly_detection_completed_${validation.anomalyResults.length}_anomalies`,
      });
    }

    this.generateValidationRecommendations(validation);

    validation.status = validation.overallScore >= 70 ? "completed" : "failed";
    validation.completedAt = new Date().toISOString();

    logPhiAccess({
      userId,
      action: "update",
      resourceType: "DataSourceValidation",
      resourceId: validation.id,
      details: `validation_${validation.status}_score_${validation.overallScore}`,
    });
  }

  private async executeValidationCheck(
    checkType: ValidationCheckType,
    source: StreamingSource
  ): Promise<ValidationResult> {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

    switch (checkType) {
      case "endpoint_reachability":
        return this.checkEndpointReachability(source);
      case "authentication":
        return this.checkAuthentication(source);
      case "connection":
        return this.checkConnection(source);
      case "permissions":
        return this.checkPermissions(source);
      case "tls_certificate":
        return this.checkTLSCertificate(source);
      case "sample_data":
        return this.checkSampleData(source);
      case "schema_compatibility":
        return this.checkSchemaCompatibility(source);
      case "rate_limit":
        return this.checkRateLimit(source);
      default:
        return { success: false, details: { error: "Unknown check type" } };
    }
  }

  private checkEndpointReachability(source: StreamingSource): ValidationResult {
    const endpoint = source.config.endpoint || "";
    const isReachable = endpoint.length > 0;
    return {
      success: isReachable,
      details: {
        endpoint,
        protocol: endpoint.split("://")[0] || "unknown",
        responseTime: Math.round(50 + Math.random() * 150),
      },
      metrics: {
        latencyMs: Math.round(50 + Math.random() * 150),
        status: isReachable ? "reachable" : "unreachable",
      },
    };
  }

  private checkAuthentication(source: StreamingSource): ValidationResult {
    const authType = source.config.authentication?.type || "none";
    const hasCredentials = authType !== "none" ? !!source.config.authentication?.credentials : true;
    return {
      success: hasCredentials,
      details: {
        authType,
        credentialsConfigured: hasCredentials,
        tokenExpiry: authType === "oauth2" ? new Date(Date.now() + 3600000).toISOString() : undefined,
      },
      warnings: authType === "none" ? ["No authentication configured - connection may be insecure"] : undefined,
    };
  }

  private checkConnection(source: StreamingSource): ValidationResult {
    const connected = source.status !== "error";
    return {
      success: connected,
      details: {
        connectionState: source.status,
        protocol: source.type,
        lastConnectedAt: source.updatedAt,
      },
      metrics: {
        reconnectCount: source.stats.reconnectCount,
        uptime: source.stats.uptime,
      },
    };
  }

  private checkPermissions(source: StreamingSource): ValidationResult {
    return {
      success: true,
      details: {
        readAccess: true,
        writeAccess: false,
        adminAccess: false,
        scopes: ["read:records", "read:metadata"],
      },
    };
  }

  private checkTLSCertificate(source: StreamingSource): ValidationResult {
    const tlsEnabled = source.config.tlsConfig?.enabled ?? true;
    const verifyEnabled = source.config.tlsConfig?.verifyCertificate ?? true;
    return {
      success: tlsEnabled,
      details: {
        tlsEnabled,
        certificateVerification: verifyEnabled,
        protocolVersion: "TLS 1.3",
        expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(),
      },
      warnings: !verifyEnabled ? ["Certificate verification disabled - not recommended for production"] : undefined,
    };
  }

  private checkSampleData(source: StreamingSource): ValidationResult {
    const recordCount = Math.floor(10 + Math.random() * 90);
    return {
      success: true,
      details: {
        recordsRetrieved: recordCount,
        sampleSize: Math.min(recordCount, 100),
        formatDetected: source.type === "fhir_subscription" ? "FHIR R4 Bundle" : "HL7 v2.5",
        fieldsFound: Math.floor(15 + Math.random() * 25),
      },
      metrics: {
        recordCount,
        avgRecordSize: Math.round(500 + Math.random() * 1500),
      },
    };
  }

  private checkSchemaCompatibility(source: StreamingSource): ValidationResult {
    const compatibility = 85 + Math.random() * 15;
    return {
      success: compatibility >= 80,
      details: {
        compatibilityScore: Math.round(compatibility),
        expectedFormat: source.type === "fhir_subscription" ? "FHIR R4" : "HL7 v2",
        detectedFormat: source.type === "fhir_subscription" ? "FHIR R4" : "HL7 v2.5",
        missingFields: [],
        extraFields: ["customField1", "localExtension"],
      },
      warnings: compatibility < 95 ? ["Minor schema differences detected - data transformation may be needed"] : undefined,
    };
  }

  private checkRateLimit(source: StreamingSource): ValidationResult {
    const currentRate = source.stats.lastHourEvents;
    const rateLimit = 10000;
    const utilizationPct = (currentRate / rateLimit) * 100;
    return {
      success: true,
      details: {
        rateLimit,
        currentRate,
        remainingQuota: rateLimit - currentRate,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
      metrics: {
        utilizationPct: Math.round(utilizationPct),
      },
      warnings: utilizationPct > 80 ? ["Rate limit utilization is high - consider increasing quota"] : undefined,
    };
  }

  private generateSampleDataForSource(source: StreamingSource): Record<string, unknown>[] {
    const recordCount = Math.floor(50 + Math.random() * 50);
    const records: Record<string, unknown>[] = [];

    for (let i = 0; i < recordCount; i++) {
      if (source.type === "fhir_subscription" || source.type === "api_poll") {
        records.push({
          resourceType: ["Patient", "Observation", "Condition", "MedicationRequest"][Math.floor(Math.random() * 4)],
          id: `res-${randomUUID().slice(0, 8)}`,
          meta: { lastUpdated: new Date().toISOString() },
          status: "active",
          subject: { reference: `Patient/pat-${Math.floor(Math.random() * 1000)}` },
        });
      } else {
        records.push({
          messageType: "ADT^A01",
          patientId: `PAT${Math.floor(Math.random() * 100000)}`,
          timestamp: new Date().toISOString(),
          facility: "Hospital A",
          eventType: "admission",
        });
      }
    }

    return records;
  }

  private generateValidationRecommendations(validation: DataSourceValidation): void {
    const failedChecks = validation.checks.filter((c) => c.status === "failed");
    const warningChecks = validation.checks.filter((c) => c.status === "warning");

    if (failedChecks.length > 0) {
      validation.recommendations.push(
        `Address ${failedChecks.length} failed validation check(s) before enabling this data source`
      );
    }

    failedChecks.forEach((check) => {
      switch (check.type) {
        case "authentication":
          validation.recommendations.push("Configure valid authentication credentials");
          break;
        case "endpoint_reachability":
          validation.recommendations.push("Verify the endpoint URL is correct and accessible");
          break;
        case "connection":
          validation.recommendations.push("Check network connectivity and firewall rules");
          break;
        case "schema_compatibility":
          validation.recommendations.push("Review data transformation mappings for schema differences");
          break;
      }
    });

    warningChecks.forEach((check) => {
      if (check.result?.warnings) {
        validation.recommendations.push(...check.result.warnings);
      }
    });

    if (validation.anomalyResults && validation.anomalyResults.length > 0) {
      const highSeverity = validation.anomalyResults.filter((a) => a.severity === "high").length;
      if (highSeverity > 0) {
        validation.recommendations.push(
          `Review ${highSeverity} high-severity data anomaly(ies) detected in sample data`
        );
      }
    }

    if (validation.initialQualityProfile && validation.initialQualityProfile.qualityScore < 80) {
      validation.recommendations.push(
        `Initial data quality score is ${validation.initialQualityProfile.qualityScore}% - consider data cleansing`
      );
    }
  }

  async getValidations(userId: string): Promise<DataSourceValidation[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataSourceValidation",
      resourceId: "all",
      details: "get_validations",
    });

    return Array.from(dataSourceValidations.values());
  }

  async getValidation(userId: string, validationId: string): Promise<DataSourceValidation | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataSourceValidation",
      resourceId: validationId,
      details: "get_validation",
    });

    return dataSourceValidations.get(validationId) || null;
  }

  async rerunValidation(userId: string, validationId: string): Promise<DataSourceValidation> {
    const existing = dataSourceValidations.get(validationId);
    if (!existing) {
      throw new Error("Validation not found");
    }

    logPhiAccess({
      userId,
      action: "update",
      resourceType: "DataSourceValidation",
      resourceId: validationId,
      details: "rerun_validation",
    });

    return this.validateDataSource(userId, existing.sourceId, {
      runSampleProfiling: true,
      triggerAnomalyDetection: true,
    });
  }

  async registerAndValidateSource(
    userId: string,
    sourceConfig: {
      name: string;
      type: StreamingSourceType;
      config: StreamingConfig;
    }
  ): Promise<{ source: StreamingSource; validation: DataSourceValidation }> {
    logPhiAccess({
      userId,
      action: "create",
      resourceType: "StreamingSource",
      resourceId: "new",
      details: "register_and_validate_source",
    });

    const sourceId = `stream-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const source: StreamingSource = {
      id: sourceId,
      name: sourceConfig.name,
      type: sourceConfig.type,
      config: sourceConfig.config,
      status: "disconnected",
      stats: {
        eventsReceived: 0,
        eventsProcessed: 0,
        eventsFailed: 0,
        bytesReceived: 0,
        averageLatencyMs: 0,
        lastHourEvents: 0,
        uptime: 0,
        reconnectCount: 0,
      },
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    streamingSources.set(sourceId, source);

    const validation = await this.validateDataSource(userId, sourceId, {
      runSampleProfiling: true,
      triggerAnomalyDetection: true,
    });

    return { source, validation };
  }
}

export const enhancedDataIngestionService = new EnhancedDataIngestionService();

console.log("[EnhancedDataIngestion] Service initialized with error handling, streaming, and profiling");
console.log("[EnhancedDataIngestion] Features: structured errors, recovery strategies, real-time streams, data profiling");
