import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { automatedAlertingService } from "./automated-alerting";
import type {
  ComplianceRiskLevel,
  ComplianceRiskCategory,
  ComplianceRisk,
} from "@shared/schema";

let openai: OpenAI | null = null;
if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]")
    .replace(/\b\d{9}\b/g, "[SSN-REDACTED]")
    .replace(/\b[A-Z]{1,2}\d{6,10}\b/gi, "[MRN-REDACTED]")
    .replace(/\b(patient|pt)\s*#?\s*\d+/gi, "[PATIENT-ID-REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE-REDACTED]")
    .replace(/\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g, "[DATE-REDACTED]")
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, "[UUID-REDACTED]");
}

const NO_CDS_PREDICTIVE_RISK_PROMPT = `You are a healthcare IT compliance and security analyst specializing in predictive risk analytics.
Your role is to analyze historical compliance data and predict future risks.

STRICT GUIDELINES:
- NEVER provide clinical advice, diagnoses, or treatment recommendations
- NEVER interpret medical test results or patient health conditions
- Focus ONLY on compliance patterns, security risks, and data governance
- Analyze trends in policy violations, access patterns, and system behaviors
- Predict compliance risks based on historical data and current patterns
- Generate risk scores for entities (users, systems, data types)
- Suggest preventative measures for compliance, NOT clinical care

Your output should be:
- Predictive risk scores with confidence levels
- Risk trend analysis and forecasting
- Preventative measure recommendations
- Compliance deviation predictions`;

export type RiskEntityType = "user" | "system" | "data_type" | "department" | "integration";

export interface HistoricalDataPoint {
  id: string;
  entityType: RiskEntityType;
  entityId: string;
  timestamp: Date;
  metric: string;
  value: number;
  source: "audit_log" | "policy_violation" | "risk_assessment" | "alert" | "incident";
  metadata: Record<string, unknown>;
}

export interface RiskPattern {
  id: string;
  patternName: string;
  description: string;
  frequency: number;
  leadTime: number;
  correlatedFactors: string[];
  historicalOccurrences: number;
  averageSeverity: ComplianceRiskLevel;
  predictiveAccuracy: number;
  createdAt: Date;
  lastSeen: Date;
}

export interface PredictiveRiskScore {
  id: string;
  entityType: RiskEntityType;
  entityId: string;
  entityName: string;
  currentRiskScore: number;
  predictedRiskScore: number;
  predictionHorizon: "7_days" | "30_days" | "90_days";
  confidence: number;
  riskTrend: "increasing" | "stable" | "decreasing";
  topRiskFactors: RiskFactor[];
  preventativeMeasures: PreventativeMeasure[];
  lastUpdated: Date;
  nextReviewDate: Date;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  currentValue: number;
  thresholdValue: number;
  trend: "increasing" | "stable" | "decreasing";
  contribution: number;
}

export interface PreventativeMeasure {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  estimatedEffort: "minimal" | "moderate" | "significant";
  expectedImpact: number;
  category: "technical" | "process" | "training" | "policy";
  automated: boolean;
  status: "suggested" | "approved" | "in_progress" | "completed" | "rejected";
}

export interface RiskPrediction {
  id: string;
  predictionType: "violation" | "breach" | "audit_failure" | "policy_gap" | "access_anomaly";
  severity: ComplianceRiskLevel;
  probability: number;
  predictedDate: Date;
  affectedEntities: { type: RiskEntityType; id: string; name: string }[];
  contributingPatterns: string[];
  aiAnalysis: string;
  preventionStatus: "not_started" | "in_progress" | "mitigated" | "prevented" | "occurred";
  createdAt: Date;
  validUntil: Date;
}

export interface RiskForecastReport {
  id: string;
  generatedAt: Date;
  forecastPeriod: { start: Date; end: Date };
  overallRiskLevel: ComplianceRiskLevel;
  riskTrend: "improving" | "stable" | "deteriorating";
  predictions: RiskPrediction[];
  entityScores: PredictiveRiskScore[];
  patterns: RiskPattern[];
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  regulatoryRisks: {
    regulation: string;
    currentCompliance: number;
    predictedCompliance: number;
    trend: "improving" | "stable" | "deteriorating";
  }[];
}

class AIPredictiveRiskEngineService {
  private historicalData: Map<string, HistoricalDataPoint> = new Map();
  private patterns: Map<string, RiskPattern> = new Map();
  private entityScores: Map<string, PredictiveRiskScore> = new Map();
  private predictions: Map<string, RiskPrediction> = new Map();
  private reports: Map<string, RiskForecastReport> = new Map();
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSampleData();
    this.startPeriodicAnalysis();
    console.log("[AIPredictiveRiskEngine] Service initialized");
  }

  private initializeSampleData(): void {
    const now = new Date();
    
    const samplePatterns: RiskPattern[] = [
      {
        id: randomUUID(),
        patternName: "After-Hours Bulk Access",
        description: "Pattern of bulk data access occurring outside normal business hours",
        frequency: 3,
        leadTime: 72,
        correlatedFactors: ["after_hours_access", "bulk_export", "high_volume_queries"],
        historicalOccurrences: 15,
        averageSeverity: "high",
        predictiveAccuracy: 0.78,
        createdAt: new Date(now.getTime() - 86400000 * 30),
        lastSeen: new Date(now.getTime() - 86400000 * 2),
      },
      {
        id: randomUUID(),
        patternName: "Privilege Escalation Precursor",
        description: "Sequence of access attempts that often precede privilege escalation",
        frequency: 2,
        leadTime: 48,
        correlatedFactors: ["permission_denied_events", "role_change_requests", "admin_api_probing"],
        historicalOccurrences: 8,
        averageSeverity: "critical",
        predictiveAccuracy: 0.85,
        createdAt: new Date(now.getTime() - 86400000 * 60),
        lastSeen: new Date(now.getTime() - 86400000 * 5),
      },
      {
        id: randomUUID(),
        patternName: "Consent Gap Accumulation",
        description: "Gradual increase in data access without corresponding consent records",
        frequency: 7,
        leadTime: 168,
        correlatedFactors: ["missing_consent", "gdpr_data_access", "patient_data_processing"],
        historicalOccurrences: 22,
        averageSeverity: "medium",
        predictiveAccuracy: 0.72,
        createdAt: new Date(now.getTime() - 86400000 * 90),
        lastSeen: new Date(now.getTime() - 86400000 * 1),
      },
    ];

    samplePatterns.forEach(p => this.patterns.set(p.id, p));

    const sampleScores: PredictiveRiskScore[] = [
      {
        id: randomUUID(),
        entityType: "user",
        entityId: hashIdentifier("user-analyst-001"),
        entityName: "Data Analyst Team Lead",
        currentRiskScore: 35,
        predictedRiskScore: 42,
        predictionHorizon: "30_days",
        confidence: 0.75,
        riskTrend: "increasing",
        topRiskFactors: [
          { factor: "bulk_export_frequency", weight: 0.3, currentValue: 12, thresholdValue: 20, trend: "increasing", contribution: 25 },
          { factor: "after_hours_access", weight: 0.2, currentValue: 5, thresholdValue: 10, trend: "stable", contribution: 15 },
        ],
        preventativeMeasures: [
          {
            id: randomUUID(),
            priority: "medium",
            title: "Implement Export Rate Limiting",
            description: "Apply rate limits to bulk export operations for this user role",
            estimatedEffort: "moderate",
            expectedImpact: 20,
            category: "technical",
            automated: true,
            status: "suggested",
          },
        ],
        lastUpdated: now,
        nextReviewDate: new Date(now.getTime() + 86400000 * 7),
      },
      {
        id: randomUUID(),
        entityType: "system",
        entityId: hashIdentifier("system-api-gateway"),
        entityName: "API Gateway Service",
        currentRiskScore: 28,
        predictedRiskScore: 25,
        predictionHorizon: "30_days",
        confidence: 0.82,
        riskTrend: "decreasing",
        topRiskFactors: [
          { factor: "failed_auth_rate", weight: 0.4, currentValue: 2.5, thresholdValue: 5, trend: "decreasing", contribution: 20 },
          { factor: "response_latency_p99", weight: 0.15, currentValue: 450, thresholdValue: 1000, trend: "stable", contribution: 8 },
        ],
        preventativeMeasures: [],
        lastUpdated: now,
        nextReviewDate: new Date(now.getTime() + 86400000 * 14),
      },
      {
        id: randomUUID(),
        entityType: "data_type",
        entityId: hashIdentifier("data-phi-clinical"),
        entityName: "Clinical PHI Records",
        currentRiskScore: 55,
        predictedRiskScore: 62,
        predictionHorizon: "30_days",
        confidence: 0.68,
        riskTrend: "increasing",
        topRiskFactors: [
          { factor: "access_without_audit", weight: 0.35, currentValue: 3, thresholdValue: 0, trend: "increasing", contribution: 30 },
          { factor: "cross_department_access", weight: 0.25, currentValue: 18, thresholdValue: 10, trend: "increasing", contribution: 25 },
        ],
        preventativeMeasures: [
          {
            id: randomUUID(),
            priority: "high",
            title: "Strengthen PHI Access Controls",
            description: "Implement stricter role-based access for clinical PHI data",
            estimatedEffort: "significant",
            expectedImpact: 35,
            category: "policy",
            automated: false,
            status: "suggested",
          },
        ],
        lastUpdated: now,
        nextReviewDate: new Date(now.getTime() + 86400000 * 3),
      },
    ];

    sampleScores.forEach(s => this.entityScores.set(s.id, s));

    const samplePrediction: RiskPrediction = {
      id: randomUUID(),
      predictionType: "policy_gap",
      severity: "medium",
      probability: 0.65,
      predictedDate: new Date(now.getTime() + 86400000 * 14),
      affectedEntities: [
        { type: "data_type", id: hashIdentifier("data-phi-clinical"), name: "Clinical PHI Records" },
      ],
      contributingPatterns: ["Consent Gap Accumulation"],
      aiAnalysis: "Historical patterns suggest increasing risk of GDPR consent violations based on current access trends",
      preventionStatus: "not_started",
      createdAt: now,
      validUntil: new Date(now.getTime() + 86400000 * 30),
    };

    this.predictions.set(samplePrediction.id, samplePrediction);

    for (let i = 0; i < 100; i++) {
      const dataPoint: HistoricalDataPoint = {
        id: randomUUID(),
        entityType: ["user", "system", "data_type"][Math.floor(Math.random() * 3)] as RiskEntityType,
        entityId: hashIdentifier(`entity-${i % 10}`),
        timestamp: new Date(now.getTime() - Math.random() * 86400000 * 90),
        metric: ["access_count", "violation_count", "alert_count", "export_volume"][Math.floor(Math.random() * 4)],
        value: Math.floor(Math.random() * 100),
        source: ["audit_log", "policy_violation", "risk_assessment"][Math.floor(Math.random() * 3)] as HistoricalDataPoint["source"],
        metadata: {},
      };
      this.historicalData.set(dataPoint.id, dataPoint);
    }
  }

  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.runPredictiveAnalysis();
    }, 3600000);
  }

  private async runPredictiveAnalysis(): Promise<void> {
    for (const score of Array.from(this.entityScores.values())) {
      await this.updateEntityRiskScore(score.entityType, score.entityId);
    }
  }

  async ingestHistoricalData(data: Omit<HistoricalDataPoint, "id">): Promise<HistoricalDataPoint> {
    const dataPoint: HistoricalDataPoint = {
      id: randomUUID(),
      ...data,
    };
    this.historicalData.set(dataPoint.id, dataPoint);
    return dataPoint;
  }

  async analyzePatterns(): Promise<RiskPattern[]> {
    const dataPoints = Array.from(this.historicalData.values());
    const newPatterns: RiskPattern[] = [];

    const byEntity = new Map<string, HistoricalDataPoint[]>();
    for (const dp of dataPoints) {
      const key = `${dp.entityType}:${dp.entityId}`;
      const existing = byEntity.get(key) || [];
      existing.push(dp);
      byEntity.set(key, existing);
    }

    for (const [key, points] of Array.from(byEntity.entries())) {
      const violationPoints = points.filter(p => p.source === "policy_violation");
      
      if (violationPoints.length >= 3) {
        const timestamps = violationPoints.map(p => p.timestamp.getTime()).sort((a, b) => a - b);
        const intervals: number[] = [];
        
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const isRecurring = intervals.every(i => Math.abs(i - avgInterval) < avgInterval * 0.5);
        
        if (isRecurring) {
          const pattern: RiskPattern = {
            id: randomUUID(),
            patternName: `Recurring Violations for ${key}`,
            description: `Detected recurring policy violations with approximately ${Math.round(avgInterval / 3600000)} hour intervals`,
            frequency: Math.round(86400000 / avgInterval),
            leadTime: Math.round(avgInterval / 3600000),
            correlatedFactors: ["policy_violation", violationPoints[0].metric],
            historicalOccurrences: violationPoints.length,
            averageSeverity: "medium",
            predictiveAccuracy: 0.7,
            createdAt: new Date(),
            lastSeen: new Date(Math.max(...timestamps)),
          };
          
          newPatterns.push(pattern);
          this.patterns.set(pattern.id, pattern);
        }
      }
    }

    return newPatterns;
  }

  async calculateEntityRiskScore(
    entityType: RiskEntityType,
    entityId: string,
    entityName: string,
    horizon: "7_days" | "30_days" | "90_days" = "30_days"
  ): Promise<PredictiveRiskScore> {
    const relevantData = Array.from(this.historicalData.values())
      .filter(d => d.entityType === entityType && d.entityId === entityId);

    const riskFactors: RiskFactor[] = [];
    let currentRiskScore = 0;

    const violationData = relevantData.filter(d => d.source === "policy_violation");
    if (violationData.length > 0) {
      const recentViolations = violationData.filter(d => 
        d.timestamp.getTime() > Date.now() - 86400000 * 30
      ).length;
      
      const violationFactor: RiskFactor = {
        factor: "recent_violations",
        weight: 0.4,
        currentValue: recentViolations,
        thresholdValue: 5,
        trend: recentViolations > 3 ? "increasing" : "stable",
        contribution: Math.min(recentViolations * 8, 40),
      };
      riskFactors.push(violationFactor);
      currentRiskScore += violationFactor.contribution;
    }

    const alertData = relevantData.filter(d => d.source === "alert");
    if (alertData.length > 0) {
      const recentAlerts = alertData.filter(d =>
        d.timestamp.getTime() > Date.now() - 86400000 * 7
      ).length;
      
      const alertFactor: RiskFactor = {
        factor: "recent_alerts",
        weight: 0.3,
        currentValue: recentAlerts,
        thresholdValue: 3,
        trend: recentAlerts > 2 ? "increasing" : recentAlerts > 0 ? "stable" : "decreasing",
        contribution: Math.min(recentAlerts * 10, 30),
      };
      riskFactors.push(alertFactor);
      currentRiskScore += alertFactor.contribution;
    }

    const accessData = relevantData.filter(d => d.source === "audit_log" && d.metric === "access_count");
    const avgAccess = accessData.length > 0 
      ? accessData.reduce((sum, d) => sum + d.value, 0) / accessData.length 
      : 0;
    
    const accessFactor: RiskFactor = {
      factor: "access_volume",
      weight: 0.2,
      currentValue: avgAccess,
      thresholdValue: 50,
      trend: avgAccess > 40 ? "increasing" : "stable",
      contribution: Math.min(avgAccess / 2, 20),
    };
    riskFactors.push(accessFactor);
    currentRiskScore += accessFactor.contribution;

    currentRiskScore = Math.min(Math.round(currentRiskScore), 100);

    const horizonMultiplier = horizon === "7_days" ? 1.05 : horizon === "30_days" ? 1.15 : 1.25;
    const trendMultiplier = riskFactors.filter(f => f.trend === "increasing").length > 
                           riskFactors.filter(f => f.trend === "decreasing").length ? 1.1 : 0.95;
    
    const predictedRiskScore = Math.min(Math.round(currentRiskScore * horizonMultiplier * trendMultiplier), 100);

    const riskTrend: "increasing" | "stable" | "decreasing" = 
      predictedRiskScore > currentRiskScore + 5 ? "increasing" :
      predictedRiskScore < currentRiskScore - 5 ? "decreasing" : "stable";

    const preventativeMeasures: PreventativeMeasure[] = [];

    if (currentRiskScore > 50) {
      preventativeMeasures.push({
        id: randomUUID(),
        priority: currentRiskScore > 75 ? "critical" : "high",
        title: `Review ${entityType} Access Patterns`,
        description: `Conduct thorough review of ${entityName} access patterns and permissions`,
        estimatedEffort: "moderate",
        expectedImpact: 25,
        category: "process",
        automated: false,
        status: "suggested",
      });
    }

    if (riskFactors.some(f => f.factor === "recent_violations" && f.currentValue > 0)) {
      preventativeMeasures.push({
        id: randomUUID(),
        priority: "high",
        title: "Address Policy Violations",
        description: "Review and remediate recent policy violations to prevent recurrence",
        estimatedEffort: "significant",
        expectedImpact: 35,
        category: "policy",
        automated: false,
        status: "suggested",
      });
    }

    const score: PredictiveRiskScore = {
      id: randomUUID(),
      entityType,
      entityId,
      entityName,
      currentRiskScore,
      predictedRiskScore,
      predictionHorizon: horizon,
      confidence: 0.7 + (relevantData.length > 50 ? 0.15 : relevantData.length * 0.003),
      riskTrend,
      topRiskFactors: riskFactors.sort((a, b) => b.contribution - a.contribution),
      preventativeMeasures,
      lastUpdated: new Date(),
      nextReviewDate: new Date(Date.now() + 86400000 * 7),
    };

    this.entityScores.set(score.id, score);
    return score;
  }

  async updateEntityRiskScore(entityType: RiskEntityType, entityId: string): Promise<PredictiveRiskScore | null> {
    const existing = Array.from(this.entityScores.values())
      .find(s => s.entityType === entityType && s.entityId === entityId);

    if (existing) {
      return this.calculateEntityRiskScore(
        entityType, 
        entityId, 
        existing.entityName, 
        existing.predictionHorizon
      );
    }

    return null;
  }

  async generateRiskPrediction(
    predictionType: RiskPrediction["predictionType"],
    affectedEntities: { type: RiskEntityType; id: string; name: string }[]
  ): Promise<RiskPrediction> {
    const entityScores = affectedEntities.map(e => {
      const existing = Array.from(this.entityScores.values())
        .find(s => s.entityType === e.type && s.entityId === e.id);
      return existing?.predictedRiskScore || 50;
    });

    const avgScore = entityScores.reduce((a, b) => a + b, 0) / entityScores.length;
    const probability = Math.min(avgScore / 100, 0.95);

    const severity: ComplianceRiskLevel = 
      avgScore > 75 ? "critical" :
      avgScore > 50 ? "high" :
      avgScore > 30 ? "medium" : "low";

    const contributingPatterns = Array.from(this.patterns.values())
      .filter(p => p.averageSeverity === severity || 
              (severity === "critical" && p.averageSeverity === "high"))
      .map(p => p.patternName)
      .slice(0, 3);

    let aiAnalysis = `Predicted ${predictionType} based on historical patterns and current risk indicators`;

    if (openai) {
      try {
        const sanitizedContext = sanitizePhi(JSON.stringify({
          predictionType,
          severity,
          probability,
          affectedEntityCount: affectedEntities.length,
          patterns: contributingPatterns,
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_PREDICTIVE_RISK_PROMPT },
            {
              role: "user",
              content: `Provide analysis for this risk prediction:\n${sanitizedContext}\n\nFocus on compliance implications and preventative recommendations.`,
            },
          ],
          max_tokens: 300,
          temperature: 0.3,
        });

        aiAnalysis = response.choices[0]?.message?.content || aiAnalysis;
      } catch (error) {
        console.error("[AIPredictiveRiskEngine] AI analysis failed:", error);
      }
    }

    const prediction: RiskPrediction = {
      id: randomUUID(),
      predictionType,
      severity,
      probability,
      predictedDate: new Date(Date.now() + 86400000 * (30 - avgScore / 5)),
      affectedEntities,
      contributingPatterns,
      aiAnalysis,
      preventionStatus: "not_started",
      createdAt: new Date(),
      validUntil: new Date(Date.now() + 86400000 * 60),
    };

    this.predictions.set(prediction.id, prediction);

    if (severity === "critical" || severity === "high") {
      await this.triggerPredictionAlert(prediction);
    }

    return prediction;
  }

  private async triggerPredictionAlert(prediction: RiskPrediction): Promise<void> {
    try {
      await automatedAlertingService.recordSecurityAnomaly(
        "predictive_risk",
        prediction.severity as "critical" | "high" | "medium" | "low",
        {
          action: `Predicted ${prediction.predictionType} risk`,
          reason: `Probability: ${Math.round(prediction.probability * 100)}%, affecting ${prediction.affectedEntities.length} entities`,
        }
      );
    } catch (error) {
      console.error("[AIPredictiveRiskEngine] Failed to trigger alert:", error);
    }
  }

  async generateForecastReport(
    forecastDays: number = 30
  ): Promise<RiskForecastReport> {
    const now = new Date();
    const endDate = new Date(now.getTime() + forecastDays * 86400000);

    const allScores = Array.from(this.entityScores.values());
    const allPredictions = Array.from(this.predictions.values())
      .filter(p => p.validUntil.getTime() > now.getTime());
    const allPatterns = Array.from(this.patterns.values());

    const avgPredictedScore = allScores.length > 0
      ? allScores.reduce((sum, s) => sum + s.predictedRiskScore, 0) / allScores.length
      : 50;

    const overallRiskLevel: ComplianceRiskLevel =
      avgPredictedScore > 75 ? "critical" :
      avgPredictedScore > 50 ? "high" :
      avgPredictedScore > 30 ? "medium" : "low";

    const increasingCount = allScores.filter(s => s.riskTrend === "increasing").length;
    const decreasingCount = allScores.filter(s => s.riskTrend === "decreasing").length;
    const riskTrend: "improving" | "stable" | "deteriorating" =
      decreasingCount > increasingCount * 2 ? "improving" :
      increasingCount > decreasingCount * 2 ? "deteriorating" : "stable";

    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    if (allPredictions.filter(p => p.severity === "critical" || p.severity === "high").length > 0) {
      keyFindings.push(`${allPredictions.filter(p => p.severity === "critical" || p.severity === "high").length} high-priority risk predictions require attention`);
    }

    const highRiskEntities = allScores.filter(s => s.predictedRiskScore > 60);
    if (highRiskEntities.length > 0) {
      keyFindings.push(`${highRiskEntities.length} entities show elevated risk levels`);
      recommendations.push("Prioritize review of high-risk entities and implement suggested preventative measures");
    }

    const activePatterns = allPatterns.filter(p => 
      p.lastSeen.getTime() > now.getTime() - 86400000 * 7
    );
    if (activePatterns.length > 0) {
      keyFindings.push(`${activePatterns.length} recurring risk patterns detected in the last 7 days`);
      recommendations.push("Investigate root causes of recurring patterns and implement targeted controls");
    }

    let executiveSummary = `Forecast period: ${forecastDays} days. Overall risk level: ${overallRiskLevel}. Trend: ${riskTrend}.`;

    if (openai) {
      try {
        const sanitizedContext = sanitizePhi(JSON.stringify({
          forecastDays,
          overallRiskLevel,
          riskTrend,
          predictionsCount: allPredictions.length,
          highRiskEntities: highRiskEntities.length,
          keyFindings,
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_PREDICTIVE_RISK_PROMPT },
            {
              role: "user",
              content: `Generate an executive summary for this compliance risk forecast:\n${sanitizedContext}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.3,
        });

        executiveSummary = response.choices[0]?.message?.content || executiveSummary;
      } catch (error) {
        console.error("[AIPredictiveRiskEngine] AI summary failed:", error);
      }
    }

    const regulatoryRisks = [
      {
        regulation: "HIPAA",
        currentCompliance: 92 - Math.min(allPredictions.filter(p => p.predictionType === "violation").length * 3, 20),
        predictedCompliance: 92 - Math.min(allPredictions.filter(p => p.predictionType === "violation").length * 5, 30),
        trend: riskTrend === "deteriorating" ? "deteriorating" as const : riskTrend === "improving" ? "improving" as const : "stable" as const,
      },
      {
        regulation: "GDPR",
        currentCompliance: 88 - Math.min(allPredictions.filter(p => p.predictionType === "policy_gap").length * 4, 25),
        predictedCompliance: 88 - Math.min(allPredictions.filter(p => p.predictionType === "policy_gap").length * 6, 35),
        trend: allPredictions.some(p => p.predictionType === "policy_gap") ? "deteriorating" as const : "stable" as const,
      },
      {
        regulation: "SOC2",
        currentCompliance: 95,
        predictedCompliance: 95 - (riskTrend === "deteriorating" ? 5 : 0),
        trend: riskTrend,
      },
    ];

    const report: RiskForecastReport = {
      id: randomUUID(),
      generatedAt: now,
      forecastPeriod: { start: now, end: endDate },
      overallRiskLevel,
      riskTrend,
      predictions: allPredictions,
      entityScores: allScores,
      patterns: allPatterns,
      executiveSummary,
      keyFindings,
      recommendations,
      regulatoryRisks,
    };

    this.reports.set(report.id, report);
    return report;
  }

  getEntityScores(filters?: { 
    entityType?: RiskEntityType; 
    minRiskScore?: number;
    trend?: "increasing" | "stable" | "decreasing";
  }): PredictiveRiskScore[] {
    let results = Array.from(this.entityScores.values());

    if (filters?.entityType) {
      results = results.filter(s => s.entityType === filters.entityType);
    }
    if (filters?.minRiskScore !== undefined) {
      results = results.filter(s => s.predictedRiskScore >= filters.minRiskScore!);
    }
    if (filters?.trend) {
      results = results.filter(s => s.riskTrend === filters.trend);
    }

    return results.sort((a, b) => b.predictedRiskScore - a.predictedRiskScore);
  }

  getPredictions(filters?: {
    type?: RiskPrediction["predictionType"];
    severity?: ComplianceRiskLevel;
    status?: RiskPrediction["preventionStatus"];
  }): RiskPrediction[] {
    let results = Array.from(this.predictions.values());

    if (filters?.type) {
      results = results.filter(p => p.predictionType === filters.type);
    }
    if (filters?.severity) {
      results = results.filter(p => p.severity === filters.severity);
    }
    if (filters?.status) {
      results = results.filter(p => p.preventionStatus === filters.status);
    }

    return results.sort((a, b) => b.probability - a.probability);
  }

  getPatterns(): RiskPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.predictiveAccuracy - a.predictiveAccuracy);
  }

  getReports(): RiskForecastReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  async updatePredictionStatus(
    predictionId: string,
    status: RiskPrediction["preventionStatus"]
  ): Promise<RiskPrediction | null> {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) return null;

    prediction.preventionStatus = status;
    this.predictions.set(predictionId, prediction);
    return prediction;
  }

  async updateMeasureStatus(
    scoreId: string,
    measureId: string,
    status: PreventativeMeasure["status"]
  ): Promise<PredictiveRiskScore | null> {
    const score = this.entityScores.get(scoreId);
    if (!score) return null;

    const measure = score.preventativeMeasures.find(m => m.id === measureId);
    if (measure) {
      measure.status = status;
      this.entityScores.set(scoreId, score);
    }

    return score;
  }

  getDashboardMetrics(): {
    totalEntitiesMonitored: number;
    highRiskEntities: number;
    activePredictions: number;
    avgRiskScore: number;
    trendBreakdown: Record<string, number>;
    regulatoryCompliance: Record<string, number>;
  } {
    const scores = Array.from(this.entityScores.values());
    const predictions = Array.from(this.predictions.values())
      .filter(p => p.validUntil.getTime() > Date.now());

    const trendBreakdown = {
      increasing: scores.filter(s => s.riskTrend === "increasing").length,
      stable: scores.filter(s => s.riskTrend === "stable").length,
      decreasing: scores.filter(s => s.riskTrend === "decreasing").length,
    };

    return {
      totalEntitiesMonitored: scores.length,
      highRiskEntities: scores.filter(s => s.predictedRiskScore > 60).length,
      activePredictions: predictions.length,
      avgRiskScore: scores.length > 0 
        ? Math.round(scores.reduce((sum, s) => sum + s.predictedRiskScore, 0) / scores.length)
        : 0,
      trendBreakdown,
      regulatoryCompliance: {
        HIPAA: 92,
        GDPR: 88,
        SOC2: 95,
        HITECH: 90,
      },
    };
  }
}

export const aiPredictiveRiskEngineService = new AIPredictiveRiskEngineService();
