import { logPhiAccess } from "../security/hipaa-audit";

export interface ConnectionConfig {
  type: "api" | "sftp" | "database" | "hl7_mllp" | "fhir_subscription" | "kafka";
  name: string;
  description?: string;
  endpoint?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  apiKey?: string;
  authType?: "none" | "basic" | "bearer" | "oauth2" | "api_key" | "mtls";
  sslEnabled?: boolean;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  statusCode?: number;
  message: string;
  details?: {
    serverVersion?: string;
    tlsVersion?: string;
    certificateValid?: boolean;
    certificateExpiry?: string;
    supportedFormats?: string[];
    rateLimit?: {
      remaining: number;
      resetAt: string;
    };
  };
  errors?: string[];
  timestamp: string;
}

export interface SampleDataProfile {
  recordCount: number;
  sampleSize: number;
  qualityScore: number;
  qualityGrade: "A" | "B" | "C" | "D" | "F";
  dimensions: {
    completeness: { score: number; details: string };
    validity: { score: number; details: string };
    consistency: { score: number; details: string };
    uniqueness: { score: number; details: string };
    timeliness: { score: number; details: string };
    accuracy: { score: number; details: string };
  };
  fieldAnalysis: Array<{
    fieldName: string;
    dataType: string;
    nullRate: number;
    uniqueValues: number;
    sampleValues: string[];
    issues: string[];
  }>;
  fhirCompliance?: {
    resourceType: string;
    validResources: number;
    invalidResources: number;
    commonErrors: string[];
  };
  recommendations: string[];
  timestamp: string;
}

export interface AnomalyDetectionConfig {
  enabled: boolean;
  thresholds: {
    qualityDropPercent: number;
    volumeChangePercent: number;
    errorRatePercent: number;
    latencySpikeFactor: number;
  };
  alertChannels: ("email" | "sms" | "webhook" | "in_app")[];
  checkIntervalMinutes: number;
}

export interface AnomalyAlert {
  id: string;
  sourceId: string;
  type: "quality_drop" | "volume_change" | "error_spike" | "latency_spike" | "schema_drift" | "missing_data";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

export interface OnboardingSession {
  id: string;
  status: "created" | "testing_connection" | "profiling_data" | "configuring_anomaly_detection" | "completed" | "failed";
  currentStep: number;
  totalSteps: number;
  connectionConfig: ConnectionConfig;
  connectionTestResult?: ConnectionTestResult;
  sampleDataProfile?: SampleDataProfile;
  anomalyConfig?: AnomalyDetectionConfig;
  registeredSourceId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errors: string[];
  progress: {
    step: number;
    name: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    message?: string;
  }[];
}

export interface RegisteredDataSource {
  id: string;
  name: string;
  type: ConnectionConfig["type"];
  connectionConfig: ConnectionConfig;
  qualityScore: number;
  qualityGrade: string;
  anomalyConfig: AnomalyDetectionConfig;
  status: "active" | "inactive" | "error" | "maintenance";
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncIntervalMinutes: number;
  totalRecordsSynced: number;
  registeredAt: string;
  registeredBy: string;
  anomalyAlerts: AnomalyAlert[];
}

class DataSourceOnboardingWizardService {
  private sessions: Map<string, OnboardingSession> = new Map();
  private registeredSources: Map<string, RegisteredDataSource> = new Map();
  private anomalyAlerts: Map<string, AnomalyAlert[]> = new Map();

  constructor() {
    this.initializeSampleSources();
    console.log("[OnboardingWizard] Service initialized");
    console.log("[OnboardingWizard] Features: connection testing, sample profiling, anomaly detection");
    console.log("[OnboardingWizard] Supported types: API, SFTP, Database, HL7, FHIR, Kafka");
  }

  private initializeSampleSources(): void {
    const sampleSource: RegisteredDataSource = {
      id: "src-sample-001",
      name: "Fasten Health FHIR Endpoint",
      type: "api",
      connectionConfig: {
        type: "api",
        name: "Fasten Health FHIR Endpoint",
        endpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
        authType: "oauth2",
        sslEnabled: true,
        timeout: 30000,
      },
      qualityScore: 94.5,
      qualityGrade: "A",
      anomalyConfig: {
        enabled: true,
        thresholds: {
          qualityDropPercent: 10,
          volumeChangePercent: 50,
          errorRatePercent: 5,
          latencySpikeFactor: 3,
        },
        alertChannels: ["in_app", "email"],
        checkIntervalMinutes: 60,
      },
      status: "active",
      lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
      nextSyncAt: new Date(Date.now() + 3600000).toISOString(),
      syncIntervalMinutes: 60,
      totalRecordsSynced: 15420,
      registeredAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      registeredBy: "system",
      anomalyAlerts: [],
    };
    this.registeredSources.set(sampleSource.id, sampleSource);
  }

  async createOnboardingSession(config: ConnectionConfig, userId: string): Promise<OnboardingSession> {
    logPhiAccess({
      action: "write",
      userId,
      resourceType: "DataSource",
      details: `CREATE_ONBOARDING_SESSION: Creating onboarding session for ${config.type} source: ${config.name}`,
    });

    const sessionId = `onboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: OnboardingSession = {
      id: sessionId,
      status: "created",
      currentStep: 0,
      totalSteps: 5,
      connectionConfig: config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errors: [],
      progress: [
        { step: 1, name: "Connection Configuration", status: "completed", message: "Configuration provided" },
        { step: 2, name: "Connection Testing", status: "pending" },
        { step: 3, name: "Sample Data Profiling", status: "pending" },
        { step: 4, name: "Anomaly Detection Setup", status: "pending" },
        { step: 5, name: "Registration Complete", status: "pending" },
      ],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async testConnection(sessionId: string, userId: string): Promise<ConnectionTestResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    logPhiAccess({
      action: "read",
      userId,
      resourceType: "DataSource",
      details: `TEST_DATA_SOURCE_CONNECTION: Testing connection for ${session.connectionConfig.type}: ${session.connectionConfig.name}`,
    });

    session.status = "testing_connection";
    session.currentStep = 2;
    session.progress[1].status = "in_progress";
    session.progress[1].message = "Testing connection...";
    session.updatedAt = new Date().toISOString();

    const startTime = Date.now();
    await this.simulateDelay(500 + Math.random() * 1000);

    const config = session.connectionConfig;
    let result: ConnectionTestResult;

    switch (config.type) {
      case "api":
        result = this.testApiConnection(config, startTime);
        break;
      case "sftp":
        result = this.testSftpConnection(config, startTime);
        break;
      case "database":
        result = this.testDatabaseConnection(config, startTime);
        break;
      case "hl7_mllp":
        result = this.testHl7Connection(config, startTime);
        break;
      case "fhir_subscription":
        result = this.testFhirSubscription(config, startTime);
        break;
      case "kafka":
        result = this.testKafkaConnection(config, startTime);
        break;
      default:
        result = {
          success: false,
          latencyMs: Date.now() - startTime,
          message: `Unsupported connection type: ${config.type}`,
          errors: [`Connection type ${config.type} is not supported`],
          timestamp: new Date().toISOString(),
        };
    }

    session.connectionTestResult = result;
    session.progress[1].status = result.success ? "completed" : "failed";
    session.progress[1].message = result.message;
    session.updatedAt = new Date().toISOString();

    if (!result.success) {
      session.status = "failed";
      session.errors.push(...(result.errors || []));
    }

    this.sessions.set(sessionId, session);
    return result;
  }

  private testApiConnection(config: ConnectionConfig, startTime: number): ConnectionTestResult {
    const hasEndpoint = !!config.endpoint;
    const hasAuth = config.authType !== "none" || !config.authType;

    if (!hasEndpoint) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: "API endpoint URL is required",
        errors: ["Missing endpoint URL"],
        timestamp: new Date().toISOString(),
      };
    }

    const mockSuccess = Math.random() > 0.1;
    return {
      success: mockSuccess,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 200),
      statusCode: mockSuccess ? 200 : 503,
      message: mockSuccess
        ? "Successfully connected to API endpoint"
        : "Failed to connect: Service temporarily unavailable",
      details: mockSuccess
        ? {
            serverVersion: "FHIR R4 v4.0.1",
            tlsVersion: "TLSv1.3",
            certificateValid: true,
            certificateExpiry: new Date(Date.now() + 86400000 * 365).toISOString(),
            supportedFormats: ["application/fhir+json", "application/json"],
            rateLimit: {
              remaining: 4850,
              resetAt: new Date(Date.now() + 3600000).toISOString(),
            },
          }
        : undefined,
      errors: mockSuccess ? undefined : ["Connection timeout after 30s"],
      timestamp: new Date().toISOString(),
    };
  }

  private testSftpConnection(config: ConnectionConfig, startTime: number): ConnectionTestResult {
    const hasHost = !!config.host;
    const hasCredentials = !!config.username && !!config.password;

    if (!hasHost || !hasCredentials) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: "SFTP host and credentials are required",
        errors: [
          !hasHost ? "Missing SFTP host" : "",
          !hasCredentials ? "Missing username or password" : "",
        ].filter(Boolean),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 150),
      message: "Successfully connected to SFTP server",
      details: {
        serverVersion: "OpenSSH_8.9",
        tlsVersion: "SSH-2.0",
        certificateValid: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private testDatabaseConnection(config: ConnectionConfig, startTime: number): ConnectionTestResult {
    const hasHost = !!config.host;
    const hasCredentials = !!config.username && !!config.password;

    if (!hasHost || !hasCredentials) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: "Database host and credentials are required",
        errors: [!hasHost ? "Missing database host" : "", !hasCredentials ? "Missing credentials" : ""].filter(Boolean),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 100),
      message: "Successfully connected to database",
      details: {
        serverVersion: "PostgreSQL 15.2",
        tlsVersion: "TLSv1.3",
        certificateValid: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private testHl7Connection(config: ConnectionConfig, startTime: number): ConnectionTestResult {
    const hasHost = !!config.host && !!config.port;

    if (!hasHost) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: "HL7 MLLP host and port are required",
        errors: ["Missing host or port configuration"],
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 80),
      message: "Successfully connected to HL7 MLLP interface",
      details: {
        serverVersion: "HL7 v2.5.1",
        supportedFormats: ["ADT", "ORU", "ORM", "MDM"],
      },
      timestamp: new Date().toISOString(),
    };
  }

  private testFhirSubscription(config: ConnectionConfig, startTime: number): ConnectionTestResult {
    const hasEndpoint = !!config.endpoint;

    if (!hasEndpoint) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: "FHIR server endpoint is required",
        errors: ["Missing FHIR server URL"],
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 120),
      message: "Successfully connected to FHIR Subscription service",
      details: {
        serverVersion: "FHIR R4 v4.0.1",
        tlsVersion: "TLSv1.3",
        certificateValid: true,
        supportedFormats: ["rest-hook", "websocket", "email"],
      },
      timestamp: new Date().toISOString(),
    };
  }

  private testKafkaConnection(config: ConnectionConfig, startTime: number): ConnectionTestResult {
    const hasHost = !!config.host;

    if (!hasHost) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: "Kafka broker host is required",
        errors: ["Missing Kafka broker configuration"],
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 90),
      message: "Successfully connected to Kafka cluster",
      details: {
        serverVersion: "Apache Kafka 3.6.0",
        tlsVersion: "TLSv1.3",
        certificateValid: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async profileSampleData(sessionId: string, userId: string): Promise<SampleDataProfile> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.connectionTestResult?.success) {
      throw new Error("Connection test must pass before profiling");
    }

    logPhiAccess({
      action: "read",
      userId,
      resourceType: "DataSource",
      details: `PROFILE_SAMPLE_DATA: Profiling sample data for ${session.connectionConfig.name}`,
    });

    session.status = "profiling_data";
    session.currentStep = 3;
    session.progress[2].status = "in_progress";
    session.progress[2].message = "Fetching and analyzing sample data...";
    session.updatedAt = new Date().toISOString();

    await this.simulateDelay(1000 + Math.random() * 1500);

    const completeness = 85 + Math.random() * 15;
    const validity = 80 + Math.random() * 20;
    const consistency = 82 + Math.random() * 18;
    const uniqueness = 90 + Math.random() * 10;
    const timeliness = 75 + Math.random() * 25;
    const accuracy = 88 + Math.random() * 12;

    const qualityScore = (completeness + validity + consistency + uniqueness + timeliness + accuracy) / 6;
    const qualityGrade = this.getQualityGrade(qualityScore);

    const profile: SampleDataProfile = {
      recordCount: Math.floor(1000 + Math.random() * 9000),
      sampleSize: Math.floor(100 + Math.random() * 400),
      qualityScore: Math.round(qualityScore * 10) / 10,
      qualityGrade,
      dimensions: {
        completeness: {
          score: Math.round(completeness * 10) / 10,
          details: `${Math.round(completeness)}% of required fields are populated`,
        },
        validity: {
          score: Math.round(validity * 10) / 10,
          details: `${Math.round(validity)}% of values pass validation rules`,
        },
        consistency: {
          score: Math.round(consistency * 10) / 10,
          details: `${Math.round(consistency)}% consistency across related fields`,
        },
        uniqueness: {
          score: Math.round(uniqueness * 10) / 10,
          details: `${Math.round(uniqueness)}% of identifiers are unique`,
        },
        timeliness: {
          score: Math.round(timeliness * 10) / 10,
          details: `${Math.round(timeliness)}% of records updated within expected timeframe`,
        },
        accuracy: {
          score: Math.round(accuracy * 10) / 10,
          details: `${Math.round(accuracy)}% accuracy based on reference data comparison`,
        },
      },
      fieldAnalysis: this.generateFieldAnalysis(session.connectionConfig.type),
      fhirCompliance:
        session.connectionConfig.type === "api" || session.connectionConfig.type === "fhir_subscription"
          ? {
              resourceType: "Patient",
              validResources: Math.floor(450 + Math.random() * 50),
              invalidResources: Math.floor(Math.random() * 15),
              commonErrors: [
                "Missing required identifier system",
                "Invalid date format in birthDate",
                "Empty telecom.value field",
              ].slice(0, Math.floor(Math.random() * 3) + 1),
            }
          : undefined,
      recommendations: this.generateRecommendations(qualityScore, {
        completeness,
        validity,
        consistency,
        uniqueness,
        timeliness,
        accuracy,
      }),
      timestamp: new Date().toISOString(),
    };

    session.sampleDataProfile = profile;
    session.progress[2].status = "completed";
    session.progress[2].message = `Quality score: ${profile.qualityScore}% (Grade ${profile.qualityGrade})`;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);

    return profile;
  }

  private getQualityGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  private generateFieldAnalysis(sourceType: string): SampleDataProfile["fieldAnalysis"] {
    const commonFields = [
      {
        fieldName: "patient_id",
        dataType: "string",
        nullRate: 0,
        uniqueValues: 500,
        sampleValues: ["PAT-001", "PAT-002", "PAT-003"],
        issues: [],
      },
      {
        fieldName: "name",
        dataType: "string",
        nullRate: 2.5,
        uniqueValues: 485,
        sampleValues: ["John Smith", "Jane Doe", "Robert Johnson"],
        issues: ["2.5% null values detected"],
      },
      {
        fieldName: "birth_date",
        dataType: "date",
        nullRate: 1.2,
        uniqueValues: 320,
        sampleValues: ["1985-03-15", "1992-07-22", "1978-11-08"],
        issues: [],
      },
      {
        fieldName: "gender",
        dataType: "string",
        nullRate: 0.5,
        uniqueValues: 4,
        sampleValues: ["male", "female", "other"],
        issues: [],
      },
      {
        fieldName: "phone",
        dataType: "string",
        nullRate: 15.3,
        uniqueValues: 425,
        sampleValues: ["+1-555-0123", "555-0124", "(555) 0125"],
        issues: ["15.3% null values", "Inconsistent phone format"],
      },
      {
        fieldName: "email",
        dataType: "string",
        nullRate: 22.1,
        uniqueValues: 390,
        sampleValues: ["john@example.com", "jane.doe@test.org"],
        issues: ["22.1% null values"],
      },
    ];

    if (sourceType === "api" || sourceType === "fhir_subscription") {
      commonFields.push({
        fieldName: "resource_type",
        dataType: "string",
        nullRate: 0,
        uniqueValues: 8,
        sampleValues: ["Patient", "Observation", "Condition"],
        issues: [],
      });
    }

    return commonFields;
  }

  private generateRecommendations(
    score: number,
    dimensions: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (dimensions.completeness < 90) {
      recommendations.push("Improve data completeness by implementing required field validation at source");
    }
    if (dimensions.validity < 85) {
      recommendations.push("Add data validation rules to catch invalid values before ingestion");
    }
    if (dimensions.consistency < 85) {
      recommendations.push("Implement data standardization transforms for consistent formatting");
    }
    if (dimensions.timeliness < 80) {
      recommendations.push("Consider increasing sync frequency to improve data timeliness");
    }
    if (dimensions.uniqueness < 95) {
      recommendations.push("Review duplicate detection logic to ensure unique record identification");
    }
    if (score < 80) {
      recommendations.push("Enable automated anomaly detection to catch quality degradation early");
    }

    if (recommendations.length === 0) {
      recommendations.push("Data quality meets standards. Continue monitoring for any changes.");
    }

    return recommendations;
  }

  async configureAnomalyDetection(
    sessionId: string,
    config: AnomalyDetectionConfig,
    userId: string
  ): Promise<OnboardingSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.sampleDataProfile) {
      throw new Error("Sample data profiling must complete before anomaly detection setup");
    }

    logPhiAccess({
      action: "write",
      userId,
      resourceType: "DataSource",
      details: `CONFIGURE_ANOMALY_DETECTION: Configuring anomaly detection for ${session.connectionConfig.name}`,
    });

    session.status = "configuring_anomaly_detection";
    session.currentStep = 4;
    session.progress[3].status = "in_progress";
    session.progress[3].message = "Setting up anomaly detection...";
    session.updatedAt = new Date().toISOString();

    await this.simulateDelay(300 + Math.random() * 500);

    session.anomalyConfig = config;
    session.progress[3].status = "completed";
    session.progress[3].message = config.enabled
      ? `Enabled with ${config.checkIntervalMinutes}min checks`
      : "Anomaly detection disabled";
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);

    return session;
  }

  async completeOnboarding(sessionId: string, userId: string): Promise<RegisteredDataSource> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.connectionTestResult?.success) {
      throw new Error("Connection test must pass before completing onboarding");
    }

    if (!session.sampleDataProfile) {
      throw new Error("Sample data profiling required before completing onboarding");
    }

    if (!session.anomalyConfig) {
      throw new Error("Anomaly detection configuration required before completing onboarding");
    }

    logPhiAccess({
      action: "write",
      userId,
      resourceType: "DataSource",
      details: `COMPLETE_ONBOARDING: Completing onboarding for ${session.connectionConfig.name}`,
    });

    const sourceId = `src-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const registeredSource: RegisteredDataSource = {
      id: sourceId,
      name: session.connectionConfig.name,
      type: session.connectionConfig.type,
      connectionConfig: session.connectionConfig,
      qualityScore: session.sampleDataProfile.qualityScore,
      qualityGrade: session.sampleDataProfile.qualityGrade,
      anomalyConfig: session.anomalyConfig,
      status: "active",
      syncIntervalMinutes: 60,
      totalRecordsSynced: 0,
      registeredAt: new Date().toISOString(),
      registeredBy: userId,
      anomalyAlerts: [],
    };

    this.registeredSources.set(sourceId, registeredSource);

    session.status = "completed";
    session.currentStep = 5;
    session.progress[4].status = "completed";
    session.progress[4].message = "Data source registered successfully";
    session.registeredSourceId = sourceId;
    session.completedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);

    if (session.anomalyConfig.enabled) {
      this.scheduleAnomalyDetection(sourceId);
    }

    return registeredSource;
  }

  private scheduleAnomalyDetection(sourceId: string): void {
    console.log(`[OnboardingWizard] Scheduled anomaly detection for source ${sourceId}`);
  }

  async triggerAnomalyCheck(sourceId: string, userId: string): Promise<AnomalyAlert[]> {
    const source = this.registeredSources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    logPhiAccess({
      action: "read",
      userId,
      resourceType: "DataSource",
      details: `TRIGGER_ANOMALY_CHECK: Manual anomaly check triggered for ${source.name}`,
    });

    await this.simulateDelay(500 + Math.random() * 1000);

    const alerts: AnomalyAlert[] = [];
    const shouldGenerateAlert = Math.random() > 0.7;

    if (shouldGenerateAlert) {
      const alertTypes: AnomalyAlert["type"][] = [
        "quality_drop",
        "volume_change",
        "error_spike",
        "latency_spike",
        "schema_drift",
        "missing_data",
      ];
      const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];

      const alert: AnomalyAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceId,
        type: randomType,
        severity: Math.random() > 0.5 ? "medium" : "low",
        message: this.getAlertMessage(randomType),
        currentValue: 75 + Math.random() * 25,
        expectedValue: 90 + Math.random() * 10,
        deviationPercent: 10 + Math.random() * 15,
        detectedAt: new Date().toISOString(),
      };

      alerts.push(alert);
      source.anomalyAlerts.push(alert);
      this.registeredSources.set(sourceId, source);
    }

    return alerts;
  }

  private getAlertMessage(type: AnomalyAlert["type"]): string {
    const messages: Record<AnomalyAlert["type"], string> = {
      quality_drop: "Data quality score dropped below expected threshold",
      volume_change: "Unusual change in data volume detected",
      error_spike: "Increased error rate in data ingestion",
      latency_spike: "Data sync latency significantly increased",
      schema_drift: "Schema changes detected in source data",
      missing_data: "Expected data fields are missing from recent records",
    };
    return messages[type];
  }

  getSession(sessionId: string, userId: string): OnboardingSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      logPhiAccess({
        action: "read",
        userId,
        resourceType: "DataSource",
        details: `VIEW_ONBOARDING_SESSION: Viewing onboarding session status`,
      });
    }
    return session;
  }

  getRegisteredSources(userId: string): RegisteredDataSource[] {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "DataSource",
      details: "LIST_REGISTERED_SOURCES: Listing all registered data sources",
    });
    return Array.from(this.registeredSources.values());
  }

  getRegisteredSource(sourceId: string, userId: string): RegisteredDataSource | undefined {
    const source = this.registeredSources.get(sourceId);
    if (source) {
      logPhiAccess({
        action: "read",
        userId,
        resourceType: "DataSource",
        details: `VIEW_REGISTERED_SOURCE: Viewing registered source: ${source.name}`,
      });
    }
    return source;
  }

  getAnomalyAlerts(sourceId: string, userId: string): AnomalyAlert[] {
    const source = this.registeredSources.get(sourceId);
    if (!source) {
      return [];
    }

    logPhiAccess({
      action: "read",
      userId,
      resourceType: "DataSource",
      details: `VIEW_ANOMALY_ALERTS: Viewing anomaly alerts for ${source.name}`,
    });

    return source.anomalyAlerts;
  }

  async acknowledgeAlert(alertId: string, sourceId: string, userId: string): Promise<AnomalyAlert | undefined> {
    const source = this.registeredSources.get(sourceId);
    if (!source) {
      return undefined;
    }

    const alert = source.anomalyAlerts.find((a) => a.id === alertId);
    if (alert) {
      logPhiAccess({
        action: "write",
        userId,
        resourceType: "DataSource",
        details: `ACKNOWLEDGE_ALERT: Acknowledged alert: ${alert.type}`,
      });

      alert.acknowledgedAt = new Date().toISOString();
      this.registeredSources.set(sourceId, source);
    }

    return alert;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const dataSourceOnboardingWizard = new DataSourceOnboardingWizardService();
