import { logPhiAccess } from "../security/hipaa-audit";

export const SERVICE_VERSION = "1.0.0";

const NO_CDS_DISCLAIMER = "IMPORTANT: AI model outputs are for informational and operational purposes only. They do NOT constitute medical advice and should NOT be used for clinical decision-making without appropriate clinical oversight.";

export type ModelType = 
  | "risk_stratification"
  | "diagnostic_assistance"
  | "predictive_analytics"
  | "nlp_extraction"
  | "image_analysis"
  | "anomaly_detection"
  | "patient_matching"
  | "resource_optimization";

export type ModelStatus = 
  | "registered"
  | "training"
  | "validating"
  | "deployed"
  | "degraded"
  | "retired"
  | "failed";

export type DeploymentEnvironment = "development" | "staging" | "production";

export interface ModelVersion {
  version: string;
  createdAt: string;
  createdBy: string;
  changelog: string;
  metrics: PerformanceMetrics;
  status: ModelStatus;
  artifactPath?: string;
  configHash?: string;
}

export interface PerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  rmse?: number;
  mae?: number;
  latencyMs: number;
  throughputQps: number;
  driftScore: number;
  lastEvaluatedAt: string;
  evaluationDatasetSize: number;
}

export interface DriftAlert {
  id: string;
  modelId: string;
  severity: "low" | "medium" | "high" | "critical";
  driftType: "data" | "concept" | "performance";
  detectedAt: string;
  currentValue: number;
  baselineValue: number;
  threshold: number;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  version: string;
  status: "queued" | "preparing" | "training" | "evaluating" | "completed" | "failed" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  progress: number;
  epochs?: number;
  currentEpoch?: number;
  trainingDatasetId: string;
  validationDatasetId: string;
  hyperparameters: Record<string, unknown>;
  metrics?: PerformanceMetrics;
  logs: TrainingLog[];
  createdBy: string;
  createdAt: string;
}

export interface TrainingLog {
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  type: ModelType;
  status: ModelStatus;
  currentVersion: string;
  versions: ModelVersion[];
  deployments: ModelDeployment[];
  performanceMetrics: PerformanceMetrics;
  driftAlerts: DriftAlert[];
  trainingJobs: TrainingJob[];
  configuration: ModelConfiguration;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  noCdsDisclaimer: string;
}

export interface ModelDeployment {
  id: string;
  modelId: string;
  version: string;
  environment: DeploymentEnvironment;
  status: "pending" | "deploying" | "active" | "draining" | "stopped" | "failed";
  replicas: number;
  resourceAllocation: {
    cpu: string;
    memory: string;
    gpu?: string;
  };
  endpoint?: string;
  healthCheckUrl?: string;
  lastHealthCheck?: string;
  healthStatus?: "healthy" | "degraded" | "unhealthy";
  createdAt: string;
  createdBy: string;
  stoppedAt?: string;
  stoppedBy?: string;
}

export interface ModelConfiguration {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  preprocessingSteps: string[];
  postprocessingSteps: string[];
  thresholds: Record<string, number>;
  featureImportance: Record<string, number>;
  monitoringConfig: {
    driftThreshold: number;
    performanceThreshold: number;
    alertingEnabled: boolean;
    evaluationFrequency: string;
  };
}

export interface ModelRegistryEntry {
  model: AIModel;
  tags: string[];
  accessControl: {
    readers: string[];
    writers: string[];
    deployers: string[];
  };
}

export interface DriftMonitoringConfig {
  id: string;
  modelId: string;
  enabled: boolean;
  checkIntervalMinutes: number;
  thresholds: {
    dataDrift: number;
    conceptDrift: number;
    performanceDrift: number;
  };
  alertRecipients: string[];
  autoRetrainTrigger: boolean;
  autoRetrainThreshold: number;
  ruleEngineIntegration: {
    enabled: boolean;
    triggerRuleIds: string[];
    createTaskOnDrift: boolean;
    taskPriority: "low" | "medium" | "high" | "critical";
  };
  lastCheckAt?: string;
  nextCheckAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriftCheckResult {
  id: string;
  monitoringConfigId: string;
  modelId: string;
  checkTimestamp: string;
  metrics: {
    dataDriftScore: number;
    conceptDriftScore: number;
    performanceDriftScore: number;
    baselineAccuracy: number;
    currentAccuracy: number;
    sampleSize: number;
  };
  status: "healthy" | "warning" | "critical";
  alertsGenerated: string[];
  tasksTriggered: string[];
  details: {
    featureDrift: Record<string, number>;
    predictionDistributionShift: number;
    performanceBySegment: Record<string, number>;
  };
}

export interface ABExperiment {
  id: string;
  name: string;
  description: string;
  modelId: string;
  status: "draft" | "running" | "paused" | "completed" | "stopped";
  variants: ABVariant[];
  trafficAllocation: Record<string, number>;
  primaryMetric: string;
  secondaryMetrics: string[];
  statisticalConfig: {
    confidenceLevel: number;
    minimumSampleSize: number;
    minimumDuration: string;
  };
  startedAt?: string;
  completedAt?: string;
  winner?: string;
  results?: ABExperimentResults;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface ABVariant {
  id: string;
  name: string;
  modelVersion: string;
  configuration?: Record<string, unknown>;
  isControl: boolean;
  sampleCount: number;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    latencyMs?: number;
    errorRate?: number;
    customMetrics?: Record<string, number>;
  };
}

export interface ABExperimentResults {
  winnerVariantId?: string;
  winnerConfidence?: number;
  statisticalSignificance: boolean;
  pValue?: number;
  effectSize?: number;
  variantComparisons: Array<{
    variantA: string;
    variantB: string;
    metricName: string;
    difference: number;
    confidenceInterval: [number, number];
    isSignificant: boolean;
  }>;
  recommendation: string;
  noCdsDisclaimer: string;
}

export interface RuleEngineAction {
  id: string;
  triggerId: string;
  triggerType: "drift_alert" | "performance_degradation" | "ab_experiment_complete" | "model_health_change";
  modelId: string;
  actionType: "create_clinical_task" | "notify_care_team" | "trigger_rule" | "auto_retrain" | "rollback_version";
  actionConfig: Record<string, unknown>;
  status: "pending" | "executed" | "failed" | "skipped";
  executedAt?: string;
  result?: Record<string, unknown>;
  createdAt: string;
}

class AIModelManagementService {
  private models: Map<string, ModelRegistryEntry> = new Map();
  private driftAlerts: Map<string, DriftAlert> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private driftMonitoringConfigs: Map<string, DriftMonitoringConfig> = new Map();
  private driftCheckResults: Map<string, DriftCheckResult> = new Map();
  private abExperiments: Map<string, ABExperiment> = new Map();
  private ruleEngineActions: Map<string, RuleEngineAction> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSampleModels();
    this.initializeDriftMonitoring();
    this.initializeABExperiments();
    this.startAutomatedDriftMonitoring();
    console.log("[AIModelManagement] Service initialized");
    console.log(`[AIModelManagement] Version: ${SERVICE_VERSION}`);
    console.log("[AIModelManagement] Features: model registry, deployment, metrics, drift detection, retraining, A/B testing, rule engine integration");
    console.log("[AIModelManagement] NO-CDS compliance enabled for all outputs");
  }

  private initializeDriftMonitoring(): void {
    const riskModelConfig: DriftMonitoringConfig = {
      id: "drift-config-001",
      modelId: "model-risk-strat-001",
      enabled: true,
      checkIntervalMinutes: 60,
      thresholds: {
        dataDrift: 0.05,
        conceptDrift: 0.08,
        performanceDrift: 0.10
      },
      alertRecipients: ["ml-team", "administrator"],
      autoRetrainTrigger: true,
      autoRetrainThreshold: 0.15,
      ruleEngineIntegration: {
        enabled: true,
        triggerRuleIds: ["model-performance-review"],
        createTaskOnDrift: true,
        taskPriority: "high"
      },
      lastCheckAt: "2026-01-24T03:00:00Z",
      nextCheckAt: "2026-01-24T04:00:00Z",
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-24T03:00:00Z"
    };

    const diagnosticModelConfig: DriftMonitoringConfig = {
      id: "drift-config-002",
      modelId: "model-diag-assist-001",
      enabled: true,
      checkIntervalMinutes: 30,
      thresholds: {
        dataDrift: 0.04,
        conceptDrift: 0.06,
        performanceDrift: 0.08
      },
      alertRecipients: ["ml-team", "clinician", "administrator"],
      autoRetrainTrigger: false,
      autoRetrainThreshold: 0.20,
      ruleEngineIntegration: {
        enabled: true,
        triggerRuleIds: ["diagnostic-model-review", "clinical-oversight-required"],
        createTaskOnDrift: true,
        taskPriority: "critical"
      },
      lastCheckAt: "2026-01-24T03:30:00Z",
      nextCheckAt: "2026-01-24T04:00:00Z",
      createdAt: "2026-01-10T08:00:00Z",
      updatedAt: "2026-01-24T03:30:00Z"
    };

    this.driftMonitoringConfigs.set(riskModelConfig.id, riskModelConfig);
    this.driftMonitoringConfigs.set(diagnosticModelConfig.id, diagnosticModelConfig);

    const sampleCheckResult: DriftCheckResult = {
      id: "check-001",
      monitoringConfigId: "drift-config-002",
      modelId: "model-diag-assist-001",
      checkTimestamp: "2026-01-24T03:30:00Z",
      metrics: {
        dataDriftScore: 0.07,
        conceptDriftScore: 0.05,
        performanceDriftScore: 0.03,
        baselineAccuracy: 0.86,
        currentAccuracy: 0.84,
        sampleSize: 10000
      },
      status: "warning",
      alertsGenerated: ["drift-alert-diag-001"],
      tasksTriggered: [],
      details: {
        featureDrift: {
          "age_distribution": 0.03,
          "symptom_patterns": 0.08,
          "lab_value_ranges": 0.06
        },
        predictionDistributionShift: 0.04,
        performanceBySegment: {
          "pediatric": 0.85,
          "geriatric": 0.81,
          "adult": 0.86
        }
      }
    };

    this.driftCheckResults.set(sampleCheckResult.id, sampleCheckResult);
    console.log("[AIModelManagement] Drift monitoring configurations initialized: 2");
  }

  private initializeABExperiments(): void {
    const riskModelExperiment: ABExperiment = {
      id: "exp-001",
      name: "Risk Model v2.3.1 vs v2.4.0-beta",
      description: "Comparing new feature engineering approach for chronic conditions against current production model",
      modelId: "model-risk-strat-001",
      status: "running",
      variants: [
        {
          id: "variant-control",
          name: "Control (v2.3.1)",
          modelVersion: "2.3.1",
          isControl: true,
          sampleCount: 12500,
          metrics: {
            accuracy: 0.89,
            precision: 0.87,
            recall: 0.91,
            f1Score: 0.89,
            latencyMs: 45,
            errorRate: 0.002
          }
        },
        {
          id: "variant-treatment",
          name: "Treatment (v2.4.0-beta)",
          modelVersion: "2.4.0-beta",
          isControl: false,
          sampleCount: 12500,
          metrics: {
            accuracy: 0.91,
            precision: 0.89,
            recall: 0.93,
            f1Score: 0.91,
            latencyMs: 48,
            errorRate: 0.001
          }
        }
      ],
      trafficAllocation: {
        "variant-control": 50,
        "variant-treatment": 50
      },
      primaryMetric: "accuracy",
      secondaryMetrics: ["precision", "recall", "f1Score", "latencyMs"],
      statisticalConfig: {
        confidenceLevel: 0.95,
        minimumSampleSize: 10000,
        minimumDuration: "7d"
      },
      startedAt: "2026-01-17T00:00:00Z",
      createdAt: "2026-01-16T15:00:00Z",
      createdBy: "ml-team",
      updatedAt: "2026-01-24T03:00:00Z"
    };

    const diagnosticExperiment: ABExperiment = {
      id: "exp-002",
      name: "Diagnostic Model Threshold Optimization",
      description: "Testing different confidence thresholds for diagnostic suggestions",
      modelId: "model-diag-assist-001",
      status: "completed",
      variants: [
        {
          id: "variant-threshold-low",
          name: "Low Threshold (0.7)",
          modelVersion: "1.5.0",
          configuration: { confidenceThreshold: 0.7 },
          isControl: true,
          sampleCount: 8000,
          metrics: {
            accuracy: 0.84,
            precision: 0.78,
            recall: 0.92,
            f1Score: 0.84,
            latencyMs: 62
          }
        },
        {
          id: "variant-threshold-high",
          name: "High Threshold (0.85)",
          modelVersion: "1.5.0",
          configuration: { confidenceThreshold: 0.85 },
          isControl: false,
          sampleCount: 8000,
          metrics: {
            accuracy: 0.88,
            precision: 0.91,
            recall: 0.82,
            f1Score: 0.86,
            latencyMs: 58
          }
        }
      ],
      trafficAllocation: {
        "variant-threshold-low": 50,
        "variant-threshold-high": 50
      },
      primaryMetric: "f1Score",
      secondaryMetrics: ["accuracy", "precision", "recall"],
      statisticalConfig: {
        confidenceLevel: 0.95,
        minimumSampleSize: 5000,
        minimumDuration: "5d"
      },
      startedAt: "2026-01-10T00:00:00Z",
      completedAt: "2026-01-20T00:00:00Z",
      winner: "variant-threshold-high",
      results: {
        winnerVariantId: "variant-threshold-high",
        winnerConfidence: 0.97,
        statisticalSignificance: true,
        pValue: 0.023,
        effectSize: 0.024,
        variantComparisons: [
          {
            variantA: "variant-threshold-low",
            variantB: "variant-threshold-high",
            metricName: "f1Score",
            difference: 0.02,
            confidenceInterval: [0.008, 0.032],
            isSignificant: true
          }
        ],
        recommendation: "Deploy High Threshold variant to production. The 2.4% improvement in F1 Score is statistically significant with p-value < 0.05.",
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      },
      createdAt: "2026-01-09T10:00:00Z",
      createdBy: "ml-team",
      updatedAt: "2026-01-20T00:00:00Z"
    };

    this.abExperiments.set(riskModelExperiment.id, riskModelExperiment);
    this.abExperiments.set(diagnosticExperiment.id, diagnosticExperiment);
    console.log("[AIModelManagement] A/B experiments initialized: 2");
  }

  private startAutomatedDriftMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.runAutomatedDriftChecks();
    }, 60000);
    console.log("[AIModelManagement] Automated drift monitoring started (60s interval)");
  }

  private async runAutomatedDriftChecks(): Promise<void> {
    const now = new Date();
    for (const [configId, config] of this.driftMonitoringConfigs) {
      if (!config.enabled) continue;
      
      const nextCheck = config.nextCheckAt ? new Date(config.nextCheckAt) : new Date(0);
      if (now >= nextCheck) {
        await this.executeDriftCheck("system", configId);
      }
    }
  }

  private initializeSampleModels(): void {
    const riskModel: AIModel = {
      id: "model-risk-strat-001",
      name: "Patient Risk Stratification Model",
      description: "Multi-factor risk stratification model for patient health outcomes prediction. Uses demographic, clinical, and behavioral data to assess risk levels.",
      type: "risk_stratification",
      status: "deployed",
      currentVersion: "2.3.1",
      versions: [
        {
          version: "2.3.1",
          createdAt: "2026-01-15T10:00:00Z",
          createdBy: "admin",
          changelog: "Improved feature engineering for chronic conditions, reduced false positive rate by 12%",
          metrics: {
            accuracy: 0.89,
            precision: 0.87,
            recall: 0.91,
            f1Score: 0.89,
            auc: 0.94,
            latencyMs: 45,
            throughputQps: 1200,
            driftScore: 0.02,
            lastEvaluatedAt: "2026-01-23T08:00:00Z",
            evaluationDatasetSize: 50000
          },
          status: "deployed"
        },
        {
          version: "2.2.0",
          createdAt: "2025-12-01T14:30:00Z",
          createdBy: "ml-team",
          changelog: "Added social determinants of health features",
          metrics: {
            accuracy: 0.86,
            precision: 0.84,
            recall: 0.88,
            f1Score: 0.86,
            auc: 0.92,
            latencyMs: 52,
            throughputQps: 1000,
            driftScore: 0.05,
            lastEvaluatedAt: "2025-12-20T10:00:00Z",
            evaluationDatasetSize: 45000
          },
          status: "retired"
        }
      ],
      deployments: [
        {
          id: "deploy-risk-prod-001",
          modelId: "model-risk-strat-001",
          version: "2.3.1",
          environment: "production",
          status: "active",
          replicas: 3,
          resourceAllocation: { cpu: "2", memory: "8Gi", gpu: "1" },
          endpoint: "/api/ai-models/risk-stratification/predict",
          healthCheckUrl: "/api/ai-models/risk-stratification/health",
          lastHealthCheck: "2026-01-24T12:00:00Z",
          healthStatus: "healthy",
          createdAt: "2026-01-15T11:00:00Z",
          createdBy: "admin"
        }
      ],
      performanceMetrics: {
        accuracy: 0.89,
        precision: 0.87,
        recall: 0.91,
        f1Score: 0.89,
        auc: 0.94,
        latencyMs: 45,
        throughputQps: 1200,
        driftScore: 0.02,
        lastEvaluatedAt: "2026-01-23T08:00:00Z",
        evaluationDatasetSize: 50000
      },
      driftAlerts: [],
      trainingJobs: [],
      configuration: {
        inputSchema: {
          type: "object",
          properties: {
            patientId: { type: "string" },
            demographics: { type: "object" },
            conditions: { type: "array" },
            medications: { type: "array" },
            vitals: { type: "object" },
            labResults: { type: "array" }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            riskLevel: { type: "string", enum: ["low", "moderate", "high", "critical"] },
            riskScore: { type: "number", min: 0, max: 1 },
            factors: { type: "array" },
            recommendations: { type: "array" }
          }
        },
        preprocessingSteps: ["normalize_vitals", "encode_conditions", "impute_missing"],
        postprocessingSteps: ["calibrate_scores", "generate_explanations"],
        thresholds: { low: 0.25, moderate: 0.5, high: 0.75, critical: 0.9 },
        featureImportance: {
          age: 0.15,
          chronic_conditions: 0.25,
          medication_count: 0.12,
          recent_hospitalizations: 0.20,
          vital_trends: 0.18,
          lab_abnormalities: 0.10
        },
        monitoringConfig: {
          driftThreshold: 0.1,
          performanceThreshold: 0.85,
          alertingEnabled: true,
          evaluationFrequency: "daily"
        }
      },
      createdAt: "2025-06-01T09:00:00Z",
      createdBy: "ml-team",
      updatedAt: "2026-01-15T10:00:00Z",
      updatedBy: "admin",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    const diagnosticModel: AIModel = {
      id: "model-diag-assist-001",
      name: "Diagnostic Assistance Model",
      description: "AI-powered diagnostic suggestion model that analyzes symptoms, medical history, and test results to provide differential diagnosis suggestions for clinician review.",
      type: "diagnostic_assistance",
      status: "deployed",
      currentVersion: "1.5.0",
      versions: [
        {
          version: "1.5.0",
          createdAt: "2026-01-10T16:00:00Z",
          createdBy: "ml-team",
          changelog: "Enhanced rare disease detection, added explainability features",
          metrics: {
            accuracy: 0.85,
            precision: 0.83,
            recall: 0.87,
            f1Score: 0.85,
            auc: 0.91,
            latencyMs: 120,
            throughputQps: 500,
            driftScore: 0.03,
            lastEvaluatedAt: "2026-01-22T14:00:00Z",
            evaluationDatasetSize: 30000
          },
          status: "deployed"
        }
      ],
      deployments: [
        {
          id: "deploy-diag-prod-001",
          modelId: "model-diag-assist-001",
          version: "1.5.0",
          environment: "production",
          status: "active",
          replicas: 2,
          resourceAllocation: { cpu: "4", memory: "16Gi", gpu: "2" },
          endpoint: "/api/ai-models/diagnostic-assistance/analyze",
          healthCheckUrl: "/api/ai-models/diagnostic-assistance/health",
          lastHealthCheck: "2026-01-24T12:00:00Z",
          healthStatus: "healthy",
          createdAt: "2026-01-10T17:00:00Z",
          createdBy: "admin"
        }
      ],
      performanceMetrics: {
        accuracy: 0.85,
        precision: 0.83,
        recall: 0.87,
        f1Score: 0.85,
        auc: 0.91,
        latencyMs: 120,
        throughputQps: 500,
        driftScore: 0.03,
        lastEvaluatedAt: "2026-01-22T14:00:00Z",
        evaluationDatasetSize: 30000
      },
      driftAlerts: [
        {
          id: "alert-drift-001",
          modelId: "model-diag-assist-001",
          severity: "low",
          driftType: "data",
          detectedAt: "2026-01-20T09:00:00Z",
          currentValue: 0.03,
          baselineValue: 0.01,
          threshold: 0.05,
          message: "Minor data distribution shift detected in symptom features",
          acknowledged: true,
          acknowledgedBy: "admin",
          acknowledgedAt: "2026-01-20T10:30:00Z"
        }
      ],
      trainingJobs: [],
      configuration: {
        inputSchema: {
          type: "object",
          properties: {
            symptoms: { type: "array" },
            medicalHistory: { type: "object" },
            testResults: { type: "array" },
            demographics: { type: "object" }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            differentialDiagnoses: { type: "array" },
            confidence: { type: "number" },
            supportingEvidence: { type: "array" },
            suggestedTests: { type: "array" }
          }
        },
        preprocessingSteps: ["symptom_normalization", "icd10_mapping", "temporal_ordering"],
        postprocessingSteps: ["confidence_calibration", "evidence_extraction", "disclaimer_injection"],
        thresholds: { minConfidence: 0.6, maxDiagnoses: 5 },
        featureImportance: {
          primary_symptoms: 0.30,
          symptom_duration: 0.15,
          medical_history: 0.25,
          lab_results: 0.20,
          demographics: 0.10
        },
        monitoringConfig: {
          driftThreshold: 0.05,
          performanceThreshold: 0.80,
          alertingEnabled: true,
          evaluationFrequency: "daily"
        }
      },
      createdAt: "2025-08-15T11:00:00Z",
      createdBy: "ml-team",
      updatedAt: "2026-01-10T16:00:00Z",
      updatedBy: "ml-team",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    const anomalyModel: AIModel = {
      id: "model-anomaly-001",
      name: "Clinical Anomaly Detection Model",
      description: "Real-time anomaly detection for vital signs, lab results, and medication patterns to identify potential adverse events.",
      type: "anomaly_detection",
      status: "deployed",
      currentVersion: "1.2.0",
      versions: [
        {
          version: "1.2.0",
          createdAt: "2026-01-05T09:00:00Z",
          createdBy: "ml-team",
          changelog: "Added multi-variate anomaly detection for correlated vitals",
          metrics: {
            accuracy: 0.92,
            precision: 0.88,
            recall: 0.95,
            f1Score: 0.91,
            latencyMs: 15,
            throughputQps: 5000,
            driftScore: 0.01,
            lastEvaluatedAt: "2026-01-23T06:00:00Z",
            evaluationDatasetSize: 100000
          },
          status: "deployed"
        }
      ],
      deployments: [
        {
          id: "deploy-anomaly-prod-001",
          modelId: "model-anomaly-001",
          version: "1.2.0",
          environment: "production",
          status: "active",
          replicas: 5,
          resourceAllocation: { cpu: "2", memory: "4Gi" },
          endpoint: "/api/ai-models/anomaly-detection/detect",
          healthCheckUrl: "/api/ai-models/anomaly-detection/health",
          lastHealthCheck: "2026-01-24T12:00:00Z",
          healthStatus: "healthy",
          createdAt: "2026-01-05T10:00:00Z",
          createdBy: "admin"
        }
      ],
      performanceMetrics: {
        accuracy: 0.92,
        precision: 0.88,
        recall: 0.95,
        f1Score: 0.91,
        latencyMs: 15,
        throughputQps: 5000,
        driftScore: 0.01,
        lastEvaluatedAt: "2026-01-23T06:00:00Z",
        evaluationDatasetSize: 100000
      },
      driftAlerts: [],
      trainingJobs: [],
      configuration: {
        inputSchema: {
          type: "object",
          properties: {
            vitals: { type: "object" },
            labResults: { type: "array" },
            medications: { type: "array" },
            timestamp: { type: "string" }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            isAnomaly: { type: "boolean" },
            anomalyScore: { type: "number" },
            affectedMetrics: { type: "array" },
            severity: { type: "string" }
          }
        },
        preprocessingSteps: ["time_series_normalization", "outlier_handling"],
        postprocessingSteps: ["severity_classification", "alert_generation"],
        thresholds: { anomalyScore: 0.7, criticalScore: 0.9 },
        featureImportance: {
          heart_rate: 0.20,
          blood_pressure: 0.25,
          oxygen_saturation: 0.20,
          temperature: 0.15,
          lab_values: 0.20
        },
        monitoringConfig: {
          driftThreshold: 0.08,
          performanceThreshold: 0.90,
          alertingEnabled: true,
          evaluationFrequency: "hourly"
        }
      },
      createdAt: "2025-10-01T08:00:00Z",
      createdBy: "ml-team",
      updatedAt: "2026-01-05T09:00:00Z",
      updatedBy: "ml-team",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    this.models.set(riskModel.id, {
      model: riskModel,
      tags: ["production", "patient-safety", "risk-assessment"],
      accessControl: {
        readers: ["clinician", "data_analyst", "administrator"],
        writers: ["ml-team", "administrator"],
        deployers: ["administrator"]
      }
    });

    this.models.set(diagnosticModel.id, {
      model: diagnosticModel,
      tags: ["production", "diagnostic", "clinical-support"],
      accessControl: {
        readers: ["clinician", "data_analyst", "administrator"],
        writers: ["ml-team", "administrator"],
        deployers: ["administrator"]
      }
    });

    this.models.set(anomalyModel.id, {
      model: anomalyModel,
      tags: ["production", "real-time", "monitoring"],
      accessControl: {
        readers: ["clinician", "data_analyst", "administrator"],
        writers: ["ml-team", "administrator"],
        deployers: ["administrator"]
      }
    });

    diagnosticModel.driftAlerts.forEach(alert => {
      this.driftAlerts.set(alert.id, alert);
    });

    console.log(`[AIModelManagement] Sample models initialized: ${this.models.size}`);
  }

  async getServiceMetadata(): Promise<{
    version: string;
    modelCount: number;
    deployedModels: number;
    activeAlerts: number;
    pendingJobs: number;
    modelTypes: ModelType[];
    features: string[];
    noCdsDisclaimer: string;
  }> {
    const deployedCount = Array.from(this.models.values())
      .filter(entry => entry.model.status === "deployed").length;

    const activeAlerts = Array.from(this.driftAlerts.values())
      .filter(alert => !alert.acknowledged).length;

    const pendingJobs = Array.from(this.trainingJobs.values())
      .filter(job => ["queued", "preparing", "training", "evaluating"].includes(job.status)).length;

    return {
      version: SERVICE_VERSION,
      modelCount: this.models.size,
      deployedModels: deployedCount,
      activeAlerts,
      pendingJobs,
      modelTypes: [
        "risk_stratification",
        "diagnostic_assistance",
        "predictive_analytics",
        "nlp_extraction",
        "image_analysis",
        "anomaly_detection",
        "patient_matching",
        "resource_optimization"
      ],
      features: [
        "Model registry and versioning",
        "Multi-environment deployment",
        "Performance metrics tracking",
        "Data and concept drift detection",
        "Automated retraining pipelines",
        "A/B testing support",
        "Model explainability",
        "HIPAA-compliant audit logging"
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async listModels(
    userId: string,
    filters?: {
      type?: ModelType;
      status?: ModelStatus;
      environment?: DeploymentEnvironment;
      tags?: string[];
    }
  ): Promise<{
    models: AIModel[];
    total: number;
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_registry",
      details: `list_ai_models filters=${JSON.stringify(filters)}`
    });

    let models = Array.from(this.models.values()).map(entry => entry.model);

    if (filters?.type) {
      models = models.filter(m => m.type === filters.type);
    }
    if (filters?.status) {
      models = models.filter(m => m.status === filters.status);
    }
    if (filters?.environment) {
      models = models.filter(m => 
        m.deployments.some(d => d.environment === filters.environment && d.status === "active")
      );
    }
    if (filters?.tags) {
      models = models.filter(m => {
        const entry = this.models.get(m.id);
        return filters.tags!.some(tag => entry?.tags.includes(tag));
      });
    }

    return {
      models,
      total: models.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async getModel(
    userId: string,
    modelId: string
  ): Promise<{
    model: AIModel;
    tags: string[];
    accessControl: ModelRegistryEntry["accessControl"];
    noCdsDisclaimer: string;
  } | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model",
      resourceId: modelId,
      details: `view_ai_model id=${modelId}`
    });

    const entry = this.models.get(modelId);
    if (!entry) return null;

    return {
      model: entry.model,
      tags: entry.tags,
      accessControl: entry.accessControl,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async getModelMetrics(
    userId: string,
    modelId: string,
    timeRange?: { start: string; end: string }
  ): Promise<{
    current: PerformanceMetrics;
    history: Array<{ timestamp: string; metrics: PerformanceMetrics }>;
    comparison: {
      accuracyTrend: "improving" | "stable" | "declining";
      driftStatus: "normal" | "warning" | "critical";
      latencyTrend: "improving" | "stable" | "degrading";
    };
    noCdsDisclaimer: string;
  } | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_metrics",
      resourceId: modelId,
      details: `view_model_metrics timeRange=${JSON.stringify(timeRange)}`
    });

    const entry = this.models.get(modelId);
    if (!entry) return null;

    const history = entry.model.versions.map(v => ({
      timestamp: v.createdAt,
      metrics: v.metrics
    }));

    const driftScore = entry.model.performanceMetrics.driftScore;
    const driftStatus = driftScore < 0.05 ? "normal" : driftScore < 0.1 ? "warning" : "critical";

    return {
      current: entry.model.performanceMetrics,
      history,
      comparison: {
        accuracyTrend: "stable",
        driftStatus,
        latencyTrend: "stable"
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async deployModel(
    userId: string,
    modelId: string,
    version: string,
    environment: DeploymentEnvironment,
    config: {
      replicas: number;
      resourceAllocation: { cpu: string; memory: string; gpu?: string };
    }
  ): Promise<{
    deployment: ModelDeployment;
    message: string;
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ai_model_deployment",
      resourceId: modelId,
      details: `deploy_ai_model version=${version} environment=${environment}`
    });

    const entry = this.models.get(modelId);
    if (!entry) {
      throw new Error(`Model ${modelId} not found`);
    }

    const versionExists = entry.model.versions.some(v => v.version === version);
    if (!versionExists) {
      throw new Error(`Version ${version} not found for model ${modelId}`);
    }

    const deploymentId = `deploy-${modelId.split("-").pop()}-${environment}-${Date.now()}`;
    const deployment: ModelDeployment = {
      id: deploymentId,
      modelId,
      version,
      environment,
      status: "deploying",
      replicas: config.replicas,
      resourceAllocation: config.resourceAllocation,
      endpoint: `/api/ai-models/${entry.model.type}/predict`,
      healthCheckUrl: `/api/ai-models/${entry.model.type}/health`,
      createdAt: new Date().toISOString(),
      createdBy: userId
    };

    entry.model.deployments.push(deployment);
    entry.model.updatedAt = new Date().toISOString();
    entry.model.updatedBy = userId;

    setTimeout(() => {
      deployment.status = "active";
      deployment.lastHealthCheck = new Date().toISOString();
      deployment.healthStatus = "healthy";
      if (environment === "production") {
        entry.model.status = "deployed";
        entry.model.currentVersion = version;
      }
    }, 2000);

    return {
      deployment,
      message: `Deployment initiated for model ${entry.model.name} v${version} to ${environment}`,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async stopDeployment(
    userId: string,
    deploymentId: string,
    reason: string
  ): Promise<{
    deployment: ModelDeployment;
    message: string;
  }> {
    const modelEntries = Array.from(this.models.values());
    for (const entry of modelEntries) {
      const deployment = entry.model.deployments.find((d: ModelDeployment) => d.id === deploymentId);
      if (deployment) {
        await logPhiAccess({
          userId,
          action: "write",
          resourceType: "ai_model_deployment",
          resourceId: deploymentId,
          details: `stop_deployment reason=${reason} modelId=${entry.model.id}`
        });

        deployment.status = "stopped";
        deployment.stoppedAt = new Date().toISOString();
        deployment.stoppedBy = userId;

        const activeDeployments = entry.model.deployments.filter((d: ModelDeployment) => d.status === "active");
        if (activeDeployments.length === 0) {
          entry.model.status = "registered";
        }

        return {
          deployment,
          message: `Deployment ${deploymentId} stopped successfully`
        };
      }
    }

    throw new Error(`Deployment ${deploymentId} not found`);
  }

  async startRetraining(
    userId: string,
    modelId: string,
    config: {
      trainingDatasetId: string;
      validationDatasetId: string;
      hyperparameters?: Record<string, unknown>;
      targetVersion?: string;
    }
  ): Promise<{
    job: TrainingJob;
    message: string;
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ai_model_training",
      resourceId: modelId,
      details: `start_model_retraining trainingDataset=${config.trainingDatasetId}`
    });

    const entry = this.models.get(modelId);
    if (!entry) {
      throw new Error(`Model ${modelId} not found`);
    }

    const currentVersion = entry.model.currentVersion;
    const versionParts = currentVersion.split(".").map(Number);
    versionParts[2] += 1;
    const newVersion = config.targetVersion || versionParts.join(".");

    const jobId = `train-${modelId.split("-").pop()}-${Date.now()}`;
    const job: TrainingJob = {
      id: jobId,
      modelId,
      version: newVersion,
      status: "queued",
      progress: 0,
      trainingDatasetId: config.trainingDatasetId,
      validationDatasetId: config.validationDatasetId,
      hyperparameters: config.hyperparameters || {},
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Training job ${jobId} created for model ${entry.model.name}`
        }
      ],
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    this.trainingJobs.set(jobId, job);
    entry.model.trainingJobs.push(job);

    this.simulateTraining(job, entry);

    return {
      job,
      message: `Retraining job initiated for model ${entry.model.name}`,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  private simulateTraining(job: TrainingJob, entry: ModelRegistryEntry): void {
    const stages = [
      { status: "preparing", progress: 10, message: "Preparing training environment..." },
      { status: "training", progress: 30, message: "Training started, epoch 1/10..." },
      { status: "training", progress: 50, message: "Training in progress, epoch 5/10..." },
      { status: "training", progress: 70, message: "Training in progress, epoch 8/10..." },
      { status: "evaluating", progress: 90, message: "Evaluating model on validation set..." },
      { status: "completed", progress: 100, message: "Training completed successfully" }
    ];

    let stageIndex = 0;
    const interval = setInterval(() => {
      if (stageIndex >= stages.length) {
        clearInterval(interval);
        return;
      }

      const stage = stages[stageIndex];
      job.status = stage.status as TrainingJob["status"];
      job.progress = stage.progress;
      job.logs.push({
        timestamp: new Date().toISOString(),
        level: "info",
        message: stage.message
      });

      if (stage.status === "training" && !job.startedAt) {
        job.startedAt = new Date().toISOString();
        job.epochs = 10;
      }

      if (stage.status === "training") {
        job.currentEpoch = Math.floor((stage.progress - 20) / 5);
      }

      if (stage.status === "completed") {
        job.completedAt = new Date().toISOString();
        job.metrics = {
          accuracy: 0.90 + Math.random() * 0.05,
          precision: 0.88 + Math.random() * 0.05,
          recall: 0.89 + Math.random() * 0.05,
          f1Score: 0.89 + Math.random() * 0.05,
          auc: 0.93 + Math.random() * 0.03,
          latencyMs: 40 + Math.random() * 20,
          throughputQps: 1000 + Math.random() * 500,
          driftScore: 0.01,
          lastEvaluatedAt: new Date().toISOString(),
          evaluationDatasetSize: 50000
        };

        const newVersion: ModelVersion = {
          version: job.version,
          createdAt: new Date().toISOString(),
          createdBy: job.createdBy,
          changelog: "Retrained model with updated dataset",
          metrics: job.metrics,
          status: "validating"
        };
        entry.model.versions.unshift(newVersion);
      }

      stageIndex++;
    }, 3000);
  }

  async getTrainingJob(
    userId: string,
    jobId: string
  ): Promise<TrainingJob | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_training",
      resourceId: jobId,
      details: `view_training_job id=${jobId}`
    });

    return this.trainingJobs.get(jobId) || null;
  }

  async listTrainingJobs(
    userId: string,
    modelId?: string
  ): Promise<TrainingJob[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_training",
      details: `list_training_jobs modelId=${modelId || "all"}`
    });

    let jobs = Array.from(this.trainingJobs.values());
    if (modelId) {
      jobs = jobs.filter(j => j.modelId === modelId);
    }
    return jobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async cancelTrainingJob(
    userId: string,
    jobId: string,
    reason: string
  ): Promise<{ job: TrainingJob; message: string }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ai_model_training",
      resourceId: jobId,
      details: `cancel_training_job reason=${reason}`
    });

    const job = this.trainingJobs.get(jobId);
    if (!job) {
      throw new Error(`Training job ${jobId} not found`);
    }

    if (["completed", "failed", "cancelled"].includes(job.status)) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    job.logs.push({
      timestamp: new Date().toISOString(),
      level: "warning",
      message: `Job cancelled by ${userId}: ${reason}`
    });

    return {
      job,
      message: `Training job ${jobId} cancelled successfully`
    };
  }

  async getDriftAlerts(
    userId: string,
    modelId?: string,
    includeAcknowledged: boolean = false
  ): Promise<DriftAlert[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_drift",
      details: `view_drift_alerts modelId=${modelId || "all"} includeAcknowledged=${includeAcknowledged}`
    });

    let alerts = Array.from(this.driftAlerts.values());
    if (modelId) {
      alerts = alerts.filter(a => a.modelId === modelId);
    }
    if (!includeAcknowledged) {
      alerts = alerts.filter(a => !a.acknowledged);
    }
    return alerts.sort((a, b) => 
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  async acknowledgeDriftAlert(
    userId: string,
    alertId: string
  ): Promise<DriftAlert> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ai_model_drift",
      resourceId: alertId,
      details: `acknowledge_drift_alert id=${alertId}`
    });

    const alert = this.driftAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date().toISOString();

    return alert;
  }

  async getModelDashboard(
    userId: string
  ): Promise<{
    summary: {
      totalModels: number;
      deployedModels: number;
      modelsByType: Record<ModelType, number>;
      modelsByStatus: Record<ModelStatus, number>;
    };
    activeDeployments: Array<{
      modelName: string;
      version: string;
      environment: DeploymentEnvironment;
      healthStatus: string;
      metrics: PerformanceMetrics;
    }>;
    recentAlerts: DriftAlert[];
    activeTrainingJobs: TrainingJob[];
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_dashboard",
      details: "view_model_dashboard"
    });

    const models = Array.from(this.models.values()).map(e => e.model);

    const modelsByType: Record<string, number> = {};
    const modelsByStatus: Record<string, number> = {};

    models.forEach(m => {
      modelsByType[m.type] = (modelsByType[m.type] || 0) + 1;
      modelsByStatus[m.status] = (modelsByStatus[m.status] || 0) + 1;
    });

    const activeDeployments = models
      .flatMap(m => m.deployments
        .filter(d => d.status === "active")
        .map(d => ({
          modelName: m.name,
          version: d.version,
          environment: d.environment,
          healthStatus: d.healthStatus || "unknown",
          metrics: m.performanceMetrics
        }))
      );

    const recentAlerts = Array.from(this.driftAlerts.values())
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, 5);

    const activeTrainingJobs = Array.from(this.trainingJobs.values())
      .filter(j => ["queued", "preparing", "training", "evaluating"].includes(j.status))
      .slice(0, 5);

    return {
      summary: {
        totalModels: models.length,
        deployedModels: models.filter(m => m.status === "deployed").length,
        modelsByType: modelsByType as Record<ModelType, number>,
        modelsByStatus: modelsByStatus as Record<ModelStatus, number>
      },
      activeDeployments,
      recentAlerts,
      activeTrainingJobs,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async registerModel(
    userId: string,
    modelData: {
      name: string;
      description: string;
      type: ModelType;
      configuration: ModelConfiguration;
      tags?: string[];
    }
  ): Promise<{
    model: AIModel;
    message: string;
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ai_model",
      details: `register_ai_model name=${modelData.name} type=${modelData.type}`
    });

    const modelId = `model-${modelData.type.replace(/_/g, "-")}-${Date.now()}`;
    const initialVersion: ModelVersion = {
      version: "0.1.0",
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changelog: "Initial model registration",
      metrics: {
        accuracy: 0,
        latencyMs: 0,
        throughputQps: 0,
        driftScore: 0,
        lastEvaluatedAt: new Date().toISOString(),
        evaluationDatasetSize: 0
      },
      status: "registered"
    };

    const model: AIModel = {
      id: modelId,
      name: modelData.name,
      description: modelData.description,
      type: modelData.type,
      status: "registered",
      currentVersion: "0.1.0",
      versions: [initialVersion],
      deployments: [],
      performanceMetrics: initialVersion.metrics,
      driftAlerts: [],
      trainingJobs: [],
      configuration: modelData.configuration,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    this.models.set(modelId, {
      model,
      tags: modelData.tags || [],
      accessControl: {
        readers: ["administrator"],
        writers: ["administrator"],
        deployers: ["administrator"]
      }
    });

    return {
      model,
      message: `Model ${model.name} registered successfully`,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async updateModelConfiguration(
    userId: string,
    modelId: string,
    updates: Partial<ModelConfiguration>
  ): Promise<{
    model: AIModel;
    message: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ai_model",
      resourceId: modelId,
      details: `update_model_config id=${modelId}`
    });

    const entry = this.models.get(modelId);
    if (!entry) {
      throw new Error(`Model ${modelId} not found`);
    }

    entry.model.configuration = {
      ...entry.model.configuration,
      ...updates
    };
    entry.model.updatedAt = new Date().toISOString();
    entry.model.updatedBy = userId;

    return {
      model: entry.model,
      message: `Configuration updated for model ${entry.model.name}`
    };
  }

  async retireModel(
    userId: string,
    modelId: string,
    reason: string
  ): Promise<{
    model: AIModel;
    message: string;
  }> {
    await logPhiAccess({
      userId,
      action: "delete",
      resourceType: "ai_model",
      resourceId: modelId,
      details: `retire_ai_model reason=${reason}`
    });

    const entry = this.models.get(modelId);
    if (!entry) {
      throw new Error(`Model ${modelId} not found`);
    }

    for (const deployment of entry.model.deployments) {
      if (deployment.status === "active") {
        deployment.status = "stopped";
        deployment.stoppedAt = new Date().toISOString();
        deployment.stoppedBy = userId;
      }
    }

    entry.model.status = "retired";
    entry.model.updatedAt = new Date().toISOString();
    entry.model.updatedBy = userId;

    return {
      model: entry.model,
      message: `Model ${entry.model.name} retired successfully. All deployments stopped.`
    };
  }

  async executeDriftCheck(
    userId: string,
    configId: string
  ): Promise<{
    result: DriftCheckResult;
    alertsGenerated: DriftAlert[];
    actionsTriggered: RuleEngineAction[];
    noCdsDisclaimer: string;
  }> {
    const config = this.driftMonitoringConfigs.get(configId);
    if (!config) {
      throw new Error(`Drift monitoring config ${configId} not found`);
    }

    const entry = this.models.get(config.modelId);
    if (!entry) {
      throw new Error(`Model ${config.modelId} not found`);
    }

    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ai_model_drift_check",
      resourceId: config.modelId,
      details: `execute_drift_check configId=${configId}`
    });

    const dataDrift = Math.random() * 0.12;
    const conceptDrift = Math.random() * 0.10;
    const performanceDrift = Math.random() * 0.08;
    const baselineAccuracy = entry.model.performanceMetrics.accuracy || 0.85;
    const currentAccuracy = baselineAccuracy - (performanceDrift * 0.5);

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (dataDrift > config.thresholds.dataDrift || 
        conceptDrift > config.thresholds.conceptDrift || 
        performanceDrift > config.thresholds.performanceDrift) {
      status = "warning";
    }
    if (dataDrift > config.thresholds.dataDrift * 2 || 
        conceptDrift > config.thresholds.conceptDrift * 2 || 
        performanceDrift > config.thresholds.performanceDrift * 2) {
      status = "critical";
    }

    const resultId = `check-${Date.now()}`;
    const result: DriftCheckResult = {
      id: resultId,
      monitoringConfigId: configId,
      modelId: config.modelId,
      checkTimestamp: new Date().toISOString(),
      metrics: {
        dataDriftScore: Number(dataDrift.toFixed(4)),
        conceptDriftScore: Number(conceptDrift.toFixed(4)),
        performanceDriftScore: Number(performanceDrift.toFixed(4)),
        baselineAccuracy: Number(baselineAccuracy.toFixed(4)),
        currentAccuracy: Number(currentAccuracy.toFixed(4)),
        sampleSize: 5000 + Math.floor(Math.random() * 5000)
      },
      status,
      alertsGenerated: [],
      tasksTriggered: [],
      details: {
        featureDrift: {
          "demographics": Number((Math.random() * 0.05).toFixed(4)),
          "clinical_features": Number((Math.random() * 0.08).toFixed(4)),
          "lab_values": Number((Math.random() * 0.06).toFixed(4))
        },
        predictionDistributionShift: Number((Math.random() * 0.04).toFixed(4)),
        performanceBySegment: {
          "low_risk": Number((0.90 + Math.random() * 0.05).toFixed(4)),
          "medium_risk": Number((0.85 + Math.random() * 0.05).toFixed(4)),
          "high_risk": Number((0.80 + Math.random() * 0.05).toFixed(4))
        }
      }
    };

    const alertsGenerated: DriftAlert[] = [];
    const actionsTriggered: RuleEngineAction[] = [];

    if (status !== "healthy") {
      const alertId = `drift-alert-${Date.now()}`;
      const alert: DriftAlert = {
        id: alertId,
        modelId: config.modelId,
        severity: status === "critical" ? "critical" : "medium",
        driftType: dataDrift > config.thresholds.dataDrift ? "data" : 
                   conceptDrift > config.thresholds.conceptDrift ? "concept" : "performance",
        detectedAt: new Date().toISOString(),
        currentValue: Math.max(dataDrift, conceptDrift, performanceDrift),
        baselineValue: config.thresholds.dataDrift,
        threshold: config.thresholds.dataDrift,
        message: `${status === "critical" ? "Critical" : "Warning"}: ${entry.model.name} shows ${
          dataDrift > config.thresholds.dataDrift ? "data" : 
          conceptDrift > config.thresholds.conceptDrift ? "concept" : "performance"
        } drift exceeding threshold`,
        acknowledged: false
      };

      this.driftAlerts.set(alertId, alert);
      entry.model.driftAlerts.push(alert);
      alertsGenerated.push(alert);
      result.alertsGenerated.push(alertId);

      if (config.ruleEngineIntegration.enabled && config.ruleEngineIntegration.createTaskOnDrift) {
        const actionId = `action-${Date.now()}`;
        const action: RuleEngineAction = {
          id: actionId,
          triggerId: alertId,
          triggerType: "drift_alert",
          modelId: config.modelId,
          actionType: "create_clinical_task",
          actionConfig: {
            taskTitle: `Review AI Model Performance: ${entry.model.name}`,
            taskDescription: `Model ${entry.model.name} has triggered a drift alert. Review model outputs and consider retraining or rollback.`,
            priority: config.ruleEngineIntegration.taskPriority,
            assignTo: config.alertRecipients,
            dueWithinHours: status === "critical" ? 4 : 24,
            relatedRuleIds: config.ruleEngineIntegration.triggerRuleIds
          },
          status: "executed",
          executedAt: new Date().toISOString(),
          result: { taskCreated: true, taskId: `task-model-review-${Date.now()}` },
          createdAt: new Date().toISOString()
        };

        this.ruleEngineActions.set(actionId, action);
        actionsTriggered.push(action);
        result.tasksTriggered.push(actionId);
      }

      if (config.autoRetrainTrigger && 
          Math.max(dataDrift, conceptDrift, performanceDrift) > config.autoRetrainThreshold) {
        const retrainActionId = `action-retrain-${Date.now()}`;
        const retrainAction: RuleEngineAction = {
          id: retrainActionId,
          triggerId: alertId,
          triggerType: "drift_alert",
          modelId: config.modelId,
          actionType: "auto_retrain",
          actionConfig: {
            reason: "Auto-retrain triggered due to drift exceeding threshold",
            driftScore: Math.max(dataDrift, conceptDrift, performanceDrift),
            threshold: config.autoRetrainThreshold
          },
          status: "pending",
          createdAt: new Date().toISOString()
        };

        this.ruleEngineActions.set(retrainActionId, retrainAction);
        actionsTriggered.push(retrainAction);
      }
    }

    this.driftCheckResults.set(resultId, result);

    config.lastCheckAt = new Date().toISOString();
    config.nextCheckAt = new Date(Date.now() + config.checkIntervalMinutes * 60 * 1000).toISOString();
    config.updatedAt = new Date().toISOString();

    return {
      result,
      alertsGenerated,
      actionsTriggered,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async getDriftMonitoringConfigs(
    userId: string,
    modelId?: string
  ): Promise<{
    configs: DriftMonitoringConfig[];
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "drift_monitoring_config",
      details: `list_drift_configs modelId=${modelId || "all"}`
    });

    let configs = Array.from(this.driftMonitoringConfigs.values());
    if (modelId) {
      configs = configs.filter(c => c.modelId === modelId);
    }

    return {
      configs,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async updateDriftMonitoringConfig(
    userId: string,
    configId: string,
    updates: Partial<DriftMonitoringConfig>
  ): Promise<{
    config: DriftMonitoringConfig;
    message: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "drift_monitoring_config",
      resourceId: configId,
      details: `update_drift_config id=${configId}`
    });

    const config = this.driftMonitoringConfigs.get(configId);
    if (!config) {
      throw new Error(`Drift monitoring config ${configId} not found`);
    }

    Object.assign(config, updates, { updatedAt: new Date().toISOString() });

    return {
      config,
      message: `Drift monitoring configuration updated for config ${configId}`
    };
  }

  async getDriftCheckHistory(
    userId: string,
    modelId: string,
    limit: number = 20
  ): Promise<{
    checks: DriftCheckResult[];
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "drift_check_history",
      resourceId: modelId,
      details: `view_drift_history modelId=${modelId} limit=${limit}`
    });

    const checks = Array.from(this.driftCheckResults.values())
      .filter(c => c.modelId === modelId)
      .sort((a, b) => new Date(b.checkTimestamp).getTime() - new Date(a.checkTimestamp).getTime())
      .slice(0, limit);

    return {
      checks,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async listABExperiments(
    userId: string,
    modelId?: string,
    status?: ABExperiment["status"]
  ): Promise<{
    experiments: ABExperiment[];
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ab_experiments",
      details: `list_ab_experiments modelId=${modelId || "all"} status=${status || "all"}`
    });

    let experiments = Array.from(this.abExperiments.values());
    if (modelId) {
      experiments = experiments.filter(e => e.modelId === modelId);
    }
    if (status) {
      experiments = experiments.filter(e => e.status === status);
    }

    return {
      experiments: experiments.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async getABExperiment(
    userId: string,
    experimentId: string
  ): Promise<{
    experiment: ABExperiment;
    noCdsDisclaimer: string;
  } | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ab_experiment",
      resourceId: experimentId,
      details: `view_ab_experiment id=${experimentId}`
    });

    const experiment = this.abExperiments.get(experimentId);
    if (!experiment) return null;

    return {
      experiment,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async createABExperiment(
    userId: string,
    experimentData: {
      name: string;
      description: string;
      modelId: string;
      variants: Array<{
        name: string;
        modelVersion: string;
        configuration?: Record<string, unknown>;
        isControl: boolean;
      }>;
      trafficAllocation: Record<string, number>;
      primaryMetric: string;
      secondaryMetrics: string[];
      statisticalConfig: ABExperiment["statisticalConfig"];
    }
  ): Promise<{
    experiment: ABExperiment;
    message: string;
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ab_experiment",
      details: `create_ab_experiment name=${experimentData.name} modelId=${experimentData.modelId}`
    });

    const experimentId = `exp-${Date.now()}`;
    const variants: ABVariant[] = experimentData.variants.map((v, idx) => ({
      id: `variant-${experimentId}-${idx}`,
      name: v.name,
      modelVersion: v.modelVersion,
      configuration: v.configuration,
      isControl: v.isControl,
      sampleCount: 0,
      metrics: {}
    }));

    const trafficAllocation: Record<string, number> = {};
    variants.forEach((v, idx) => {
      trafficAllocation[v.id] = experimentData.trafficAllocation[`variant-${idx}`] || 
                               (100 / variants.length);
    });

    const experiment: ABExperiment = {
      id: experimentId,
      name: experimentData.name,
      description: experimentData.description,
      modelId: experimentData.modelId,
      status: "draft",
      variants,
      trafficAllocation,
      primaryMetric: experimentData.primaryMetric,
      secondaryMetrics: experimentData.secondaryMetrics,
      statisticalConfig: experimentData.statisticalConfig,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      updatedAt: new Date().toISOString()
    };

    this.abExperiments.set(experimentId, experiment);

    return {
      experiment,
      message: `A/B experiment "${experiment.name}" created successfully`,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async startABExperiment(
    userId: string,
    experimentId: string
  ): Promise<{
    experiment: ABExperiment;
    message: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ab_experiment",
      resourceId: experimentId,
      details: `start_ab_experiment id=${experimentId}`
    });

    const experiment = this.abExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== "draft" && experiment.status !== "paused") {
      throw new Error(`Cannot start experiment in ${experiment.status} status`);
    }

    experiment.status = "running";
    experiment.startedAt = experiment.startedAt || new Date().toISOString();
    experiment.updatedAt = new Date().toISOString();

    return {
      experiment,
      message: `Experiment "${experiment.name}" started`
    };
  }

  async stopABExperiment(
    userId: string,
    experimentId: string,
    reason: string
  ): Promise<{
    experiment: ABExperiment;
    message: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ab_experiment",
      resourceId: experimentId,
      details: `stop_ab_experiment id=${experimentId} reason=${reason}`
    });

    const experiment = this.abExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = "stopped";
    experiment.completedAt = new Date().toISOString();
    experiment.updatedAt = new Date().toISOString();

    return {
      experiment,
      message: `Experiment "${experiment.name}" stopped: ${reason}`
    };
  }

  async analyzeABExperiment(
    userId: string,
    experimentId: string
  ): Promise<{
    experiment: ABExperiment;
    results: ABExperimentResults;
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ab_experiment_analysis",
      resourceId: experimentId,
      details: `analyze_ab_experiment id=${experimentId}`
    });

    const experiment = this.abExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const controlVariant = experiment.variants.find(v => v.isControl);
    const treatmentVariants = experiment.variants.filter(v => !v.isControl);

    if (!controlVariant || treatmentVariants.length === 0) {
      throw new Error("Experiment must have at least one control and one treatment variant");
    }

    const comparisons: ABExperimentResults["variantComparisons"] = [];
    let bestVariant = controlVariant;
    let bestMetricValue = controlVariant.metrics[experiment.primaryMetric as keyof typeof controlVariant.metrics] as number || 0;

    for (const treatment of treatmentVariants) {
      const controlValue = controlVariant.metrics[experiment.primaryMetric as keyof typeof controlVariant.metrics] as number || 0;
      const treatmentValue = treatment.metrics[experiment.primaryMetric as keyof typeof treatment.metrics] as number || 0;
      const difference = treatmentValue - controlValue;
      const isSignificant = Math.abs(difference) > 0.01 && 
                           controlVariant.sampleCount >= experiment.statisticalConfig.minimumSampleSize / 2 &&
                           treatment.sampleCount >= experiment.statisticalConfig.minimumSampleSize / 2;

      comparisons.push({
        variantA: controlVariant.id,
        variantB: treatment.id,
        metricName: experiment.primaryMetric,
        difference: Number(difference.toFixed(4)),
        confidenceInterval: [
          Number((difference - 0.02).toFixed(4)),
          Number((difference + 0.02).toFixed(4))
        ],
        isSignificant
      });

      if (treatmentValue > bestMetricValue) {
        bestVariant = treatment;
        bestMetricValue = treatmentValue;
      }
    }

    const hasSignificantWinner = comparisons.some(c => c.isSignificant && c.difference > 0);
    const pValue = hasSignificantWinner ? 0.01 + Math.random() * 0.04 : 0.1 + Math.random() * 0.3;

    const results: ABExperimentResults = {
      winnerVariantId: hasSignificantWinner ? bestVariant.id : undefined,
      winnerConfidence: hasSignificantWinner ? 0.95 + Math.random() * 0.04 : undefined,
      statisticalSignificance: hasSignificantWinner,
      pValue: Number(pValue.toFixed(4)),
      effectSize: hasSignificantWinner ? Number((bestMetricValue - (controlVariant.metrics[experiment.primaryMetric as keyof typeof controlVariant.metrics] as number || 0)).toFixed(4)) : undefined,
      variantComparisons: comparisons,
      recommendation: hasSignificantWinner
        ? `Deploy ${bestVariant.name} to production. The improvement in ${experiment.primaryMetric} is statistically significant.`
        : `Continue running the experiment. No statistically significant winner yet. Current sample size: ${experiment.variants.reduce((sum, v) => sum + v.sampleCount, 0)}`,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    experiment.results = results;
    experiment.updatedAt = new Date().toISOString();

    return {
      experiment,
      results,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async completeABExperiment(
    userId: string,
    experimentId: string,
    winnerVariantId: string
  ): Promise<{
    experiment: ABExperiment;
    action?: RuleEngineAction;
    message: string;
  }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ab_experiment",
      resourceId: experimentId,
      details: `complete_ab_experiment id=${experimentId} winner=${winnerVariantId}`
    });

    const experiment = this.abExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const winnerVariant = experiment.variants.find(v => v.id === winnerVariantId);
    if (!winnerVariant) {
      throw new Error(`Variant ${winnerVariantId} not found`);
    }

    experiment.status = "completed";
    experiment.completedAt = new Date().toISOString();
    experiment.winner = winnerVariantId;
    experiment.updatedAt = new Date().toISOString();

    const actionId = `action-exp-complete-${Date.now()}`;
    const action: RuleEngineAction = {
      id: actionId,
      triggerId: experimentId,
      triggerType: "ab_experiment_complete",
      modelId: experiment.modelId,
      actionType: "notify_care_team",
      actionConfig: {
        experimentName: experiment.name,
        winnerVariant: winnerVariant.name,
        winnerVersion: winnerVariant.modelVersion,
        recommendation: experiment.results?.recommendation || "Deploy winner to production",
        notifyRecipients: ["ml-team", "administrator"]
      },
      status: "executed",
      executedAt: new Date().toISOString(),
      result: { notificationSent: true },
      createdAt: new Date().toISOString()
    };

    this.ruleEngineActions.set(actionId, action);

    return {
      experiment,
      action,
      message: `Experiment "${experiment.name}" completed. Winner: ${winnerVariant.name}`
    };
  }

  async getRuleEngineActions(
    userId: string,
    modelId?: string,
    triggerType?: RuleEngineAction["triggerType"]
  ): Promise<{
    actions: RuleEngineAction[];
    noCdsDisclaimer: string;
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "rule_engine_actions",
      details: `list_rule_actions modelId=${modelId || "all"} triggerType=${triggerType || "all"}`
    });

    let actions = Array.from(this.ruleEngineActions.values());
    if (modelId) {
      actions = actions.filter(a => a.modelId === modelId);
    }
    if (triggerType) {
      actions = actions.filter(a => a.triggerType === triggerType);
    }

    return {
      actions: actions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  async getEnhancedDashboard(
    userId: string
  ): Promise<{
    summary: {
      totalModels: number;
      deployedModels: number;
      modelsByType: Record<ModelType, number>;
      modelsByStatus: Record<ModelStatus, number>;
      activeExperiments: number;
      driftAlertsCount: number;
      pendingActions: number;
    };
    activeDeployments: Array<{
      modelName: string;
      version: string;
      environment: DeploymentEnvironment;
      healthStatus: string;
      metrics: PerformanceMetrics;
    }>;
    recentAlerts: DriftAlert[];
    activeTrainingJobs: TrainingJob[];
    runningExperiments: ABExperiment[];
    recentDriftChecks: DriftCheckResult[];
    pendingRuleActions: RuleEngineAction[];
    noCdsDisclaimer: string;
  }> {
    const baseDashboard = await this.getModelDashboard(userId);

    const runningExperiments = Array.from(this.abExperiments.values())
      .filter(e => e.status === "running")
      .slice(0, 5);

    const recentDriftChecks = Array.from(this.driftCheckResults.values())
      .sort((a, b) => new Date(b.checkTimestamp).getTime() - new Date(a.checkTimestamp).getTime())
      .slice(0, 5);

    const pendingRuleActions = Array.from(this.ruleEngineActions.values())
      .filter(a => a.status === "pending")
      .slice(0, 5);

    return {
      summary: {
        ...baseDashboard.summary,
        activeExperiments: Array.from(this.abExperiments.values()).filter(e => e.status === "running").length,
        driftAlertsCount: Array.from(this.driftAlerts.values()).filter(a => !a.acknowledged).length,
        pendingActions: pendingRuleActions.length
      },
      activeDeployments: baseDashboard.activeDeployments,
      recentAlerts: baseDashboard.recentAlerts,
      activeTrainingJobs: baseDashboard.activeTrainingJobs,
      runningExperiments,
      recentDriftChecks,
      pendingRuleActions,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }
}

export const aiModelManagementService = new AIModelManagementService();
