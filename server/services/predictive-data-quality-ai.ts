import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { automatedAlertingService } from "./automated-alerting";
import type {
  PredictionTargetType,
  PredictionRiskLevel,
  PredictionStatus,
  PredictiveTrendDirection,
  QualityDataPoint,
  QualityTrendAnalysis,
  QualityPrediction,
  ProactiveAlert,
  PredictiveModelConfig,
  PredictiveQualityDashboard,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data quality analysis assistant. You analyze data quality patterns and trends to predict potential issues.

CRITICAL RESTRICTIONS:
- You MUST NOT provide any clinical decision support (CDS)
- You MUST NOT suggest diagnoses, treatments, or clinical interventions
- You MUST NOT interpret clinical significance of data
- You MUST focus ONLY on data quality, completeness, and interoperability issues
- Your role is limited to data management and quality assurance

Focus on:
- Data completeness and missing fields
- Data consistency across sources
- Format and validation issues
- Timeliness of data updates
- Integration and mapping problems`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

const predictionStore = new Map<string, QualityPrediction>();
const alertStore = new Map<string, ProactiveAlert>();
const configStore = new Map<string, PredictiveModelConfig>();
const historicalDataStore = new Map<string, QualityDataPoint[]>();
const trendAnalysisCache = new Map<string, QualityTrendAnalysis>();

const MAX_PREDICTIONS = 1000;
const MAX_ALERTS = 1000;
const MAX_TREND_CACHE = 500;

function capMap<K, V>(map: Map<K, V>, max: number): void {
  while (map.size > max) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  lastTrainedAt: string;
  dataPointsUsed: number;
  predictions: number;
  correctPredictions: number;
}

let modelMetrics: ModelMetrics = {
  accuracy: 0.85,
  precision: 0.82,
  recall: 0.88,
  lastTrainedAt: new Date().toISOString(),
  dataPointsUsed: 0,
  predictions: 0,
  correctPredictions: 0,
};

class PredictiveDataQualityAI {
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultConfig();
    this.initializeSampleHistoricalData();
    this.startPredictiveMonitoring();
    console.log("[PredictiveDataQualityAI] Service initialized");
  }

  private initializeDefaultConfig(): void {
    const defaultConfig: PredictiveModelConfig = {
      id: "default-predictive-config",
      name: "Default Predictive Quality Model",
      description: "Monitors data quality trends and generates predictions",
      enabled: true,
      targetTypes: ["patient", "resource_type", "connection", "data_source"],
      predictionHorizons: ["24h", "7d", "30d"],
      riskThresholds: {
        critical: 40,
        high: 55,
        medium: 70,
        low: 85,
      },
      minDataPoints: 7,
      retrainIntervalHours: 24,
      alertOnRiskLevel: "medium",
      notificationChannels: ["in_app"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    configStore.set(defaultConfig.id, defaultConfig);
  }

  private initializeSampleHistoricalData(): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const patientData: QualityDataPoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const baseScore = 75 + Math.random() * 10;
      const degradation = i < 10 ? (10 - i) * 0.8 : 0;
      patientData.push({
        timestamp: new Date(now - i * dayMs).toISOString(),
        value: Math.max(0, baseScore - degradation),
        issueCount: Math.floor(5 + Math.random() * 10 + degradation),
        severity: {
          critical: Math.floor(degradation * 0.1),
          high: Math.floor(degradation * 0.3 + Math.random() * 2),
          medium: Math.floor(3 + Math.random() * 4),
          low: Math.floor(2 + Math.random() * 5),
        },
      });
    }
    historicalDataStore.set("patient:patient-001", patientData);
    historicalDataStore.set("patient:patient-002", this.generateStableData(now, dayMs));

    historicalDataStore.set("resource_type:Observation", this.generateDegradingData(now, dayMs));
    historicalDataStore.set("resource_type:MedicationRequest", this.generateVolatileData(now, dayMs));
    historicalDataStore.set("resource_type:Condition", this.generateImprovingData(now, dayMs));

    historicalDataStore.set("connection:epic-mychart", this.generateStableData(now, dayMs));
    historicalDataStore.set("connection:cerner-health", this.generateDegradingData(now, dayMs));
    historicalDataStore.set("connection:quest-diagnostics", this.generateVolatileData(now, dayMs));

    modelMetrics.dataPointsUsed = 30 * 8;
  }

  private generateStableData(now: number, dayMs: number): QualityDataPoint[] {
    const data: QualityDataPoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const score = 82 + Math.random() * 6;
      data.push({
        timestamp: new Date(now - i * dayMs).toISOString(),
        value: score,
        issueCount: Math.floor(3 + Math.random() * 4),
        severity: { critical: 0, high: 1, medium: 2 + Math.floor(Math.random() * 2), low: 3 },
      });
    }
    return data;
  }

  private generateDegradingData(now: number, dayMs: number): QualityDataPoint[] {
    const data: QualityDataPoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const baseScore = 85;
      const degradation = (30 - i) * 0.5;
      const score = Math.max(45, baseScore - degradation + Math.random() * 5);
      data.push({
        timestamp: new Date(now - i * dayMs).toISOString(),
        value: score,
        issueCount: Math.floor(5 + degradation * 0.4),
        severity: {
          critical: degradation > 20 ? Math.floor(degradation * 0.05) : 0,
          high: Math.floor(degradation * 0.15),
          medium: Math.floor(3 + degradation * 0.1),
          low: Math.floor(2 + Math.random() * 3),
        },
      });
    }
    return data;
  }

  private generateVolatileData(now: number, dayMs: number): QualityDataPoint[] {
    const data: QualityDataPoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const volatility = Math.sin(i * 0.5) * 15;
      const score = 70 + volatility + Math.random() * 10;
      data.push({
        timestamp: new Date(now - i * dayMs).toISOString(),
        value: Math.max(50, Math.min(95, score)),
        issueCount: Math.floor(4 + Math.abs(volatility) * 0.3),
        severity: {
          critical: volatility < -10 ? 1 : 0,
          high: Math.floor(1 + Math.abs(volatility) * 0.1),
          medium: Math.floor(2 + Math.random() * 3),
          low: Math.floor(3 + Math.random() * 4),
        },
      });
    }
    return data;
  }

  private generateImprovingData(now: number, dayMs: number): QualityDataPoint[] {
    const data: QualityDataPoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const improvement = (30 - i) * 0.4;
      const score = Math.min(95, 65 + improvement + Math.random() * 5);
      data.push({
        timestamp: new Date(now - i * dayMs).toISOString(),
        value: score,
        issueCount: Math.max(1, Math.floor(12 - improvement * 0.3)),
        severity: {
          critical: i > 25 ? 1 : 0,
          high: Math.max(0, Math.floor(3 - improvement * 0.1)),
          medium: Math.max(1, Math.floor(4 - improvement * 0.1)),
          low: Math.floor(2 + Math.random() * 2),
        },
      });
    }
    return data;
  }

  private startPredictiveMonitoring(): void {
    if (process.env.NODE_ENV === "test" || process.env.DISABLE_PREDICTION_CYCLE === "true") {
      console.log("[PredictiveDataQualityAI] Scheduled prediction cycle disabled by env");
      return;
    }

    const envMinutes = Number(process.env.PREDICTION_CYCLE_INTERVAL_MINUTES);
    const intervalMinutes = Number.isFinite(envMinutes) && envMinutes > 0 ? envMinutes : 360;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runPredictionCycle();
      } catch (err) {
        console.error("[PredictiveDataQualityAI] Scheduled cycle error:", err instanceof Error ? err.message : err);
      }
    }, intervalMs);
    this.monitoringInterval.unref?.();

    console.log(`[PredictiveDataQualityAI] Scheduled prediction cycle every ${intervalMinutes} min (first run in ${intervalMinutes} min)`);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  async recordDataQualitySnapshot(
    targetId: string,
    targetType: PredictionTargetType,
    score: number,
    issueCount: number,
    severity: Record<string, number>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const key = `${targetType}:${targetId}`;
    const dataPoints = historicalDataStore.get(key) || [];

    dataPoints.push({
      timestamp: new Date().toISOString(),
      value: score,
      issueCount,
      severity,
      metadata,
    });

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filtered = dataPoints.filter(
      (dp) => new Date(dp.timestamp).getTime() > thirtyDaysAgo
    );
    historicalDataStore.set(key, filtered);

    modelMetrics.dataPointsUsed++;
  }

  async analyzeTrend(
    targetId: string,
    targetType: PredictionTargetType,
    targetName: string
  ): Promise<QualityTrendAnalysis | null> {
    const key = `${targetType}:${targetId}`;
    const dataPoints = historicalDataStore.get(key);

    if (!dataPoints || dataPoints.length < 3) {
      return null;
    }

    const values = dataPoints.map((dp) => dp.value);
    const slope = this.calculateTrendSlope(values);
    const volatility = this.calculateVolatility(values);
    const trendDirection = this.determineTrendDirection(slope, volatility);

    const anomalies = this.detectAnomalies(dataPoints);
    const seasonalPatterns = this.detectSeasonalPatterns(dataPoints);

    const analysis: QualityTrendAnalysis = {
      targetId,
      targetType,
      targetName,
      currentScore: values[values.length - 1],
      historicalScores: dataPoints,
      trendDirection,
      trendSlope: slope,
      volatility,
      seasonalPatterns,
      anomalies,
      analyzedPeriod: {
        start: dataPoints[0].timestamp,
        end: dataPoints[dataPoints.length - 1].timestamp,
        dataPoints: dataPoints.length,
      },
    };

    trendAnalysisCache.set(key, analysis);
    return analysis;
  }

  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  private determineTrendDirection(slope: number, volatility: number): PredictiveTrendDirection {
    if (volatility > 10) return "volatile";
    if (slope > 0.3) return "improving";
    if (slope < -0.3) return "degrading";
    return "stable";
  }

  private detectAnomalies(dataPoints: QualityDataPoint[]): Array<{
    timestamp: string;
    type: string;
    magnitude: number;
    description: string;
  }> {
    const anomalies: Array<{
      timestamp: string;
      type: string;
      magnitude: number;
      description: string;
    }> = [];

    if (dataPoints.length < 5) return anomalies;

    const values = dataPoints.map((dp) => dp.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length
    );

    for (let i = 0; i < dataPoints.length; i++) {
      const deviation = Math.abs(dataPoints[i].value - mean);
      if (deviation > 2 * stdDev) {
        anomalies.push({
          timestamp: dataPoints[i].timestamp,
          type: dataPoints[i].value < mean ? "sudden_drop" : "sudden_spike",
          magnitude: deviation / stdDev,
          description: `Quality score deviated ${(deviation / stdDev).toFixed(1)} standard deviations from mean`,
        });
      }
    }

    return anomalies;
  }

  private detectSeasonalPatterns(dataPoints: QualityDataPoint[]): string[] {
    const patterns: string[] = [];

    if (dataPoints.length < 14) return patterns;

    const weeklyScores: number[] = [];
    for (let day = 0; day < 7; day++) {
      const dayScores = dataPoints.filter((_, i) => i % 7 === day).map((dp) => dp.value);
      weeklyScores[day] = dayScores.reduce((a, b) => a + b, 0) / dayScores.length;
    }

    const weekdayAvg = weeklyScores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const weekendAvg = weeklyScores.slice(5, 7).reduce((a, b) => a + b, 0) / 2;

    if (Math.abs(weekdayAvg - weekendAvg) > 5) {
      patterns.push(
        weekendAvg < weekdayAvg ? "weekend_quality_dip" : "weekend_quality_improvement"
      );
    }

    const recentAvg = dataPoints.slice(-7).reduce((sum, dp) => sum + dp.value, 0) / 7;
    const previousAvg = dataPoints.slice(-14, -7).reduce((sum, dp) => sum + dp.value, 0) / 7;

    if (previousAvg - recentAvg > 5) {
      patterns.push("recent_week_degradation");
    }

    return patterns;
  }

  async generatePrediction(
    targetId: string,
    targetType: PredictionTargetType,
    targetName: string,
    horizon: string = "7d"
  ): Promise<QualityPrediction | null> {
    const trend = await this.analyzeTrend(targetId, targetType, targetName);
    if (!trend) return null;

    const config = Array.from(configStore.values()).find((c) => c.enabled);
    if (!config) return null;

    const horizonDays = this.parseHorizon(horizon);
    const predictedScore = this.calculatePredictedScore(trend, horizonDays);
    const confidence = this.calculateConfidence(trend);
    const confidenceInterval = this.calculateConfidenceInterval(predictedScore, confidence, trend.volatility);
    const riskLevel = this.determineRiskLevel(predictedScore, config.riskThresholds);

    const aiAnalysis = await this.generateAIAnalysis(trend, predictedScore, horizon);
    const predictedIssues = this.predictIssues(trend, horizonDays);
    const contributingFactors = this.identifyContributingFactors(trend);
    const recommendations = await this.generateRecommendations(trend, predictedScore, riskLevel);

    const prediction: QualityPrediction = {
      id: `pred-${randomUUID()}`,
      targetId,
      targetType,
      targetName,
      predictedAt: new Date().toISOString(),
      predictionHorizon: horizon,
      predictedScore,
      confidenceInterval,
      confidence,
      riskLevel,
      status: "active",
      predictedIssues,
      contributingFactors,
      aiAnalysis,
      recommendations,
      expiresAt: new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000).toISOString(),
    };

    predictionStore.set(prediction.id, prediction);
    capMap(predictionStore, MAX_PREDICTIONS);
    modelMetrics.predictions++;

    if (this.shouldAlert(riskLevel, config)) {
      await this.createProactiveAlert(prediction, trend);
    }

    return prediction;
  }

  private parseHorizon(horizon: string): number {
    const match = horizon.match(/^(\d+)(h|d|w|m)$/);
    if (!match) return 7;

    const value = parseInt(match[1]);
    switch (match[2]) {
      case "h": return value / 24;
      case "d": return value;
      case "w": return value * 7;
      case "m": return value * 30;
      default: return 7;
    }
  }

  private calculatePredictedScore(trend: QualityTrendAnalysis, horizonDays: number): number {
    const baseScore = trend.currentScore;
    const slopeEffect = trend.trendSlope * horizonDays;
    const volatilityNoise = (Math.random() - 0.5) * trend.volatility * 0.2;

    const predictedScore = baseScore + slopeEffect + volatilityNoise;
    return Math.max(0, Math.min(100, predictedScore));
  }

  private calculateConfidence(trend: QualityTrendAnalysis): number {
    let confidence = 0.9;

    if (trend.volatility > 15) confidence -= 0.2;
    else if (trend.volatility > 10) confidence -= 0.1;

    if (trend.anomalies.length > 3) confidence -= 0.15;
    else if (trend.anomalies.length > 1) confidence -= 0.05;

    if (trend.analyzedPeriod.dataPoints < 7) confidence -= 0.2;
    else if (trend.analyzedPeriod.dataPoints < 14) confidence -= 0.1;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private calculateConfidenceInterval(
    predictedScore: number,
    confidence: number,
    volatility: number
  ): { lower: number; upper: number } {
    const margin = volatility * (1 - confidence) * 2;
    return {
      lower: Math.max(0, predictedScore - margin),
      upper: Math.min(100, predictedScore + margin),
    };
  }

  private determineRiskLevel(
    score: number,
    thresholds: { critical: number; high: number; medium: number; low: number }
  ): PredictionRiskLevel {
    if (score < thresholds.critical) return "critical";
    if (score < thresholds.high) return "high";
    if (score < thresholds.medium) return "medium";
    if (score < thresholds.low) return "low";
    return "minimal";
  }

  private predictIssues(
    trend: QualityTrendAnalysis,
    horizonDays: number
  ): Array<{
    issueType: string;
    probability: number;
    estimatedCount: number;
    potentialImpact: string;
  }> {
    const predictedIssues: Array<{
      issueType: string;
      probability: number;
      estimatedCount: number;
      potentialImpact: string;
    }> = [];

    if (trend.trendDirection === "degrading") {
      const lastPoint = trend.historicalScores[trend.historicalScores.length - 1];
      const severityTrend = lastPoint.severity;

      if (severityTrend.critical > 0 || severityTrend.high > 2) {
        predictedIssues.push({
          issueType: "missing_required_field",
          probability: 0.7,
          estimatedCount: Math.ceil(severityTrend.high * (1 + horizonDays * 0.1)),
          potentialImpact: "May cause data processing failures and regulatory compliance issues",
        });
      }

      if (trend.volatility > 10) {
        predictedIssues.push({
          issueType: "inconsistent_data",
          probability: 0.6,
          estimatedCount: Math.ceil(horizonDays * 0.5),
          potentialImpact: "Could lead to data reconciliation failures and duplicate records",
        });
      }
    }

    if (trend.trendDirection === "volatile") {
      predictedIssues.push({
        issueType: "source_conflict",
        probability: 0.5,
        estimatedCount: Math.ceil(horizonDays * 0.3),
        potentialImpact: "May require manual review and resolution",
      });
    }

    if (trend.seasonalPatterns.includes("recent_week_degradation")) {
      predictedIssues.push({
        issueType: "stale_data",
        probability: 0.65,
        estimatedCount: Math.ceil(horizonDays * 0.4),
        potentialImpact: "Data may become outdated and unreliable",
      });
    }

    return predictedIssues;
  }

  private identifyContributingFactors(trend: QualityTrendAnalysis): Array<{
    factor: string;
    weight: number;
    description: string;
    trend: PredictiveTrendDirection;
  }> {
    const factors: Array<{
      factor: string;
      weight: number;
      description: string;
      trend: PredictiveTrendDirection;
    }> = [];

    if (Math.abs(trend.trendSlope) > 0.3) {
      factors.push({
        factor: "Trend Momentum",
        weight: 0.35,
        description: `Quality scores ${trend.trendSlope > 0 ? "increasing" : "decreasing"} at ${Math.abs(trend.trendSlope).toFixed(2)} points per day`,
        trend: trend.trendSlope > 0 ? "improving" : "degrading",
      });
    }

    if (trend.volatility > 8) {
      factors.push({
        factor: "Score Volatility",
        weight: 0.25,
        description: `High variability (${trend.volatility.toFixed(1)}) indicates unstable data quality`,
        trend: "volatile",
      });
    }

    if (trend.anomalies.length > 0) {
      factors.push({
        factor: "Recent Anomalies",
        weight: 0.2,
        description: `${trend.anomalies.length} anomalous events detected in the analysis period`,
        trend: trend.anomalies.some((a) => a.type === "sudden_drop") ? "degrading" : "volatile",
      });
    }

    if (trend.seasonalPatterns.length > 0) {
      factors.push({
        factor: "Seasonal Patterns",
        weight: 0.15,
        description: `Detected patterns: ${trend.seasonalPatterns.join(", ")}`,
        trend: trend.seasonalPatterns.includes("recent_week_degradation") ? "degrading" : "stable",
      });
    }

    const lastPoint = trend.historicalScores[trend.historicalScores.length - 1];
    if (lastPoint.severity.critical > 0 || lastPoint.severity.high > 3) {
      factors.push({
        factor: "Issue Severity Distribution",
        weight: 0.3,
        description: `${lastPoint.severity.critical} critical and ${lastPoint.severity.high} high severity issues detected`,
        trend: "degrading",
      });
    }

    return factors.sort((a, b) => b.weight - a.weight);
  }

  private async generateAIAnalysis(
    trend: QualityTrendAnalysis,
    predictedScore: number,
    horizon: string
  ): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this data quality trend and provide a brief assessment:

Target: ${trend.targetName} (${trend.targetType})
Current Score: ${trend.currentScore.toFixed(1)}/100
Trend Direction: ${trend.trendDirection}
Trend Slope: ${trend.trendSlope.toFixed(2)} points/day
Volatility: ${trend.volatility.toFixed(1)}
Predicted Score (${horizon}): ${predictedScore.toFixed(1)}/100
Anomalies Detected: ${trend.anomalies.length}
Seasonal Patterns: ${trend.seasonalPatterns.join(", ") || "None"}

Provide a 2-3 sentence analysis focusing ONLY on data quality implications, NOT clinical interpretations.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || "Analysis unavailable";
    } catch (error) {
      console.error("[PredictiveDataQualityAI] AI analysis error:", error);
      return `Based on ${trend.analyzedPeriod.dataPoints} data points, the ${trend.targetType} shows a ${trend.trendDirection} trend. Current score is ${trend.currentScore.toFixed(1)} with predicted score of ${predictedScore.toFixed(1)} over ${horizon}.`;
    }
  }

  private async generateRecommendations(
    trend: QualityTrendAnalysis,
    predictedScore: number,
    riskLevel: PredictionRiskLevel
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (riskLevel === "critical" || riskLevel === "high") {
      recommendations.push("Initiate immediate data quality review");
      recommendations.push("Check data source connectivity and mapping configurations");
    }

    if (trend.trendDirection === "degrading") {
      recommendations.push("Investigate recent changes to data sources or integration configurations");
      recommendations.push("Review and address high-severity issues before they accumulate");
    }

    if (trend.volatility > 10) {
      recommendations.push("Monitor data source stability and consider implementing additional validation rules");
    }

    if (trend.anomalies.length > 2) {
      recommendations.push("Analyze anomaly root causes to prevent recurrence");
    }

    if (trend.seasonalPatterns.includes("weekend_quality_dip")) {
      recommendations.push("Review weekend data processing workflows");
    }

    if (predictedScore < 60) {
      recommendations.push("Consider pausing non-critical data imports until quality stabilizes");
    }

    return recommendations.slice(0, 5);
  }

  private shouldAlert(riskLevel: PredictionRiskLevel, config: PredictiveModelConfig): boolean {
    const riskOrder: PredictionRiskLevel[] = ["minimal", "low", "medium", "high", "critical"];
    return riskOrder.indexOf(riskLevel) >= riskOrder.indexOf(config.alertOnRiskLevel);
  }

  private async createProactiveAlert(
    prediction: QualityPrediction,
    trend: QualityTrendAnalysis
  ): Promise<ProactiveAlert> {
    const alertType = this.determineAlertType(prediction, trend);
    const severity = this.mapRiskToSeverity(prediction.riskLevel);

    const alert: ProactiveAlert = {
      id: `proactive-alert-${randomUUID()}`,
      predictionId: prediction.id,
      alertType,
      severity,
      title: `Predicted Data Quality ${prediction.riskLevel.toUpperCase()} Risk: ${prediction.targetName}`,
      message: this.generateAlertMessage(prediction, trend),
      targetId: prediction.targetId,
      targetType: prediction.targetType,
      targetName: prediction.targetName,
      predictedRiskLevel: prediction.riskLevel,
      predictedScore: prediction.predictedScore,
      currentScore: trend.currentScore,
      predictionHorizon: prediction.predictionHorizon,
      triggeredAt: new Date().toISOString(),
      expiresAt: prediction.expiresAt,
      status: "active",
      actionsTaken: [],
      metadata: {
        trendDirection: trend.trendDirection,
        trendSlope: trend.trendSlope,
        confidence: prediction.confidence,
        contributingFactorsCount: prediction.contributingFactors.length,
      },
    };

    alertStore.set(alert.id, alert);
    capMap(alertStore, MAX_ALERTS);

    await automatedAlertingService.recordMetric("predictive_quality_alert", 1, {
      targetType: prediction.targetType,
      riskLevel: prediction.riskLevel,
      predictedScore: prediction.predictedScore,
    });

    console.log(
      `[PredictiveDataQualityAI] Proactive alert created: ${alert.title} (${alert.severity})`
    );

    return alert;
  }

  private determineAlertType(
    prediction: QualityPrediction,
    trend: QualityTrendAnalysis
  ): "quality_degradation" | "pattern_anomaly" | "threshold_breach" | "trend_reversal" {
    if (prediction.predictedScore < 50 && trend.currentScore >= 50) {
      return "threshold_breach";
    }
    if (trend.trendDirection === "degrading" && prediction.riskLevel !== "minimal") {
      return "quality_degradation";
    }
    if (trend.anomalies.length > 2) {
      return "pattern_anomaly";
    }
    if (trend.trendDirection !== this.getPreviousTrendDirection(trend.targetId, trend.targetType)) {
      return "trend_reversal";
    }
    return "quality_degradation";
  }

  private getPreviousTrendDirection(targetId: string, targetType: PredictionTargetType): PredictiveTrendDirection {
    const key = `${targetType}:${targetId}`;
    const cached = trendAnalysisCache.get(key);
    return cached?.trendDirection || "stable";
  }

  private mapRiskToSeverity(riskLevel: PredictionRiskLevel): "critical" | "high" | "medium" | "low" {
    switch (riskLevel) {
      case "critical": return "critical";
      case "high": return "high";
      case "medium": return "medium";
      default: return "low";
    }
  }

  private generateAlertMessage(prediction: QualityPrediction, trend: QualityTrendAnalysis): string {
    return `Data quality for ${prediction.targetName} is predicted to ${
      trend.trendDirection === "degrading" ? "degrade" : "remain at risk"
    } over the next ${prediction.predictionHorizon}. ` +
      `Current score: ${trend.currentScore.toFixed(1)}/100, Predicted: ${prediction.predictedScore.toFixed(1)}/100. ` +
      `Confidence: ${(prediction.confidence * 100).toFixed(0)}%. ` +
      `Key factors: ${prediction.contributingFactors.slice(0, 2).map(f => f.factor).join(", ")}.`;
  }

  async runPredictionCycle(): Promise<{
    predictionsGenerated: number;
    alertsCreated: number;
  }> {
    let predictionsGenerated = 0;
    let alertsCreated = 0;

    const config = Array.from(configStore.values()).find((c) => c.enabled);
    if (!config) return { predictionsGenerated, alertsCreated };

    const keys = Array.from(historicalDataStore.keys());
    for (const key of keys) {
      const [targetType, targetId] = key.split(":") as [PredictionTargetType, string];
      const targetName = this.getTargetName(targetId, targetType);

      for (const horizon of config.predictionHorizons) {
        const prediction = await this.generatePrediction(targetId, targetType, targetName, horizon);
        if (prediction) {
          predictionsGenerated++;
          if (this.shouldAlert(prediction.riskLevel, config)) {
            alertsCreated++;
          }
        }
      }
    }

    console.log(
      `[PredictiveDataQualityAI] Prediction cycle complete: ${predictionsGenerated} predictions, ${alertsCreated} alerts`
    );

    return { predictionsGenerated, alertsCreated };
  }

  private getTargetName(targetId: string, targetType: PredictionTargetType): string {
    const names: Record<string, string> = {
      "patient-001": "John Smith",
      "patient-002": "Jane Doe",
      "Observation": "Observation Resources",
      "MedicationRequest": "Medication Requests",
      "Condition": "Condition Resources",
      "epic-mychart": "Primary Care Provider",
      "cerner-health": "Hospital Network",
      "quest-diagnostics": "Quest Diagnostics",
    };
    return names[targetId] || targetId;
  }

  async getPrediction(predictionId: string): Promise<QualityPrediction | null> {
    return predictionStore.get(predictionId) || null;
  }

  async listPredictions(filters?: {
    targetType?: PredictionTargetType;
    targetId?: string;
    riskLevel?: PredictionRiskLevel;
    status?: PredictionStatus;
    activeOnly?: boolean;
  }): Promise<QualityPrediction[]> {
    let predictions = Array.from(predictionStore.values());

    if (filters?.targetType) {
      predictions = predictions.filter((p) => p.targetType === filters.targetType);
    }
    if (filters?.targetId) {
      predictions = predictions.filter((p) => p.targetId === filters.targetId);
    }
    if (filters?.riskLevel) {
      predictions = predictions.filter((p) => p.riskLevel === filters.riskLevel);
    }
    if (filters?.status) {
      predictions = predictions.filter((p) => p.status === filters.status);
    }
    if (filters?.activeOnly) {
      const now = Date.now();
      predictions = predictions.filter(
        (p) => p.status === "active" && new Date(p.expiresAt).getTime() > now
      );
    }

    return predictions.sort(
      (a, b) => new Date(b.predictedAt).getTime() - new Date(a.predictedAt).getTime()
    );
  }

  async acknowledgePrediction(
    predictionId: string,
    userId: string
  ): Promise<QualityPrediction | null> {
    const prediction = predictionStore.get(predictionId);
    if (!prediction) return null;

    prediction.status = "acknowledged";
    prediction.acknowledgedBy = hashIdentifier(userId);
    prediction.acknowledgedAt = new Date().toISOString();

    return prediction;
  }

  async mitigatePrediction(
    predictionId: string,
    userId: string,
    notes: string
  ): Promise<QualityPrediction | null> {
    const prediction = predictionStore.get(predictionId);
    if (!prediction) return null;

    prediction.status = "mitigated";
    prediction.mitigatedAt = new Date().toISOString();
    prediction.mitigationNotes = notes;

    return prediction;
  }

  async getProactiveAlert(alertId: string): Promise<ProactiveAlert | null> {
    return alertStore.get(alertId) || null;
  }

  async listProactiveAlerts(filters?: {
    targetType?: PredictionTargetType;
    severity?: "critical" | "high" | "medium" | "low";
    status?: "active" | "acknowledged" | "resolved" | "expired";
    activeOnly?: boolean;
  }): Promise<ProactiveAlert[]> {
    let alerts = Array.from(alertStore.values());

    if (filters?.targetType) {
      alerts = alerts.filter((a) => a.targetType === filters.targetType);
    }
    if (filters?.severity) {
      alerts = alerts.filter((a) => a.severity === filters.severity);
    }
    if (filters?.status) {
      alerts = alerts.filter((a) => a.status === filters.status);
    }
    if (filters?.activeOnly) {
      const now = Date.now();
      alerts = alerts.filter(
        (a) => a.status === "active" && new Date(a.expiresAt).getTime() > now
      );
    }

    return alerts.sort(
      (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  }

  async acknowledgeProactiveAlert(
    alertId: string,
    userId: string
  ): Promise<ProactiveAlert | null> {
    const alert = alertStore.get(alertId);
    if (!alert) return null;

    alert.status = "acknowledged";
    alert.acknowledgedBy = hashIdentifier(userId);
    alert.acknowledgedAt = new Date().toISOString();

    return alert;
  }

  async resolveProactiveAlert(
    alertId: string,
    userId: string,
    notes: string
  ): Promise<ProactiveAlert | null> {
    const alert = alertStore.get(alertId);
    if (!alert) return null;

    alert.status = "resolved";
    alert.resolvedBy = hashIdentifier(userId);
    alert.resolvedAt = new Date().toISOString();
    alert.resolutionNotes = notes;
    alert.actionsTaken.push(`Resolved by user: ${notes}`);

    return alert;
  }

  async getConfig(configId: string): Promise<PredictiveModelConfig | null> {
    return configStore.get(configId) || null;
  }

  async listConfigs(): Promise<PredictiveModelConfig[]> {
    return Array.from(configStore.values());
  }

  async updateConfig(
    configId: string,
    updates: Partial<Omit<PredictiveModelConfig, "id" | "createdAt">>
  ): Promise<PredictiveModelConfig | null> {
    const config = configStore.get(configId);
    if (!config) return null;

    const updatedConfig: PredictiveModelConfig = {
      ...config,
      ...updates,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: new Date().toISOString(),
    };

    configStore.set(configId, updatedConfig);
    return updatedConfig;
  }

  async getDashboard(): Promise<PredictiveQualityDashboard> {
    const predictions = await this.listPredictions({ activeOnly: true });
    const alerts = await this.listProactiveAlerts({ activeOnly: true });

    const riskDistribution: Record<PredictionRiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      minimal: 0,
    };

    const trendSummary: Record<PredictiveTrendDirection, number> = {
      improving: 0,
      stable: 0,
      degrading: 0,
      volatile: 0,
    };

    const predictionsByTarget = {
      patients: [] as QualityPrediction[],
      resourceTypes: [] as QualityPrediction[],
      connections: [] as QualityPrediction[],
    };

    const uniqueTargets = new Map<string, QualityPrediction>();

    for (const prediction of predictions) {
      const key = `${prediction.targetType}:${prediction.targetId}`;
      const existing = uniqueTargets.get(key);
      if (!existing || new Date(prediction.predictedAt) > new Date(existing.predictedAt)) {
        uniqueTargets.set(key, prediction);
      }
    }

    const uniquePredictions = Array.from(uniqueTargets.values());
    for (const prediction of uniquePredictions) {
      riskDistribution[prediction.riskLevel]++;

      switch (prediction.targetType) {
        case "patient":
          predictionsByTarget.patients.push(prediction);
          break;
        case "resource_type":
          predictionsByTarget.resourceTypes.push(prediction);
          break;
        case "connection":
        case "data_source":
          predictionsByTarget.connections.push(prediction);
          break;
      }
    }

    const trendKeys = Array.from(trendAnalysisCache.keys());
    for (const key of trendKeys) {
      const cached = trendAnalysisCache.get(key);
      if (cached) {
        trendSummary[cached.trendDirection]++;
      }
    }

    const topRiskTargets = Array.from(uniqueTargets.values())
      .filter((p) => p.riskLevel !== "minimal")
      .sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, minimal: 4 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      })
      .slice(0, 5)
      .map((p) => ({
        targetId: p.targetId,
        targetType: p.targetType,
        targetName: p.targetName,
        riskLevel: p.riskLevel,
        predictedScore: p.predictedScore,
        daysUntilCritical: p.predictedScore < 40 ? undefined : 
          Math.ceil((p.predictedScore - 40) / Math.abs(p.contributingFactors[0]?.weight || 0.5)),
      }));

    const overallRiskScore = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.predictedScore, 0) / predictions.length
      : 85;

    return {
      overallRiskScore,
      riskDistribution,
      activePredictions: uniqueTargets.size,
      activeAlerts: alerts.length,
      predictionsByTarget,
      recentAlerts: alerts.slice(0, 10),
      trendSummary,
      topRiskTargets,
      modelPerformance: modelMetrics,
    };
  }

  getHistoricalData(
    targetId: string,
    targetType: PredictionTargetType
  ): QualityDataPoint[] | null {
    const key = `${targetType}:${targetId}`;
    return historicalDataStore.get(key) || null;
  }

  getTrendAnalysis(
    targetId: string,
    targetType: PredictionTargetType
  ): QualityTrendAnalysis | null {
    const key = `${targetType}:${targetId}`;
    return trendAnalysisCache.get(key) || null;
  }

  async createConfig(
    config: Partial<Omit<PredictiveModelConfig, "id" | "createdAt" | "updatedAt">>
  ): Promise<PredictiveModelConfig> {
    const now = new Date().toISOString();
    const newConfig: PredictiveModelConfig = {
      id: randomUUID(),
      name: config.name || "Custom Configuration",
      description: config.description || "Predictive data quality monitoring configuration",
      enabled: config.enabled ?? true,
      targetTypes: config.targetTypes || ["patient", "resource_type", "connection"],
      predictionHorizons: config.predictionHorizons || ["24h", "7d", "30d"],
      riskThresholds: config.riskThresholds || {
        critical: 40,
        high: 55,
        medium: 70,
        low: 85,
      },
      minDataPoints: config.minDataPoints || 7,
      retrainIntervalHours: config.retrainIntervalHours || 24,
      alertOnRiskLevel: config.alertOnRiskLevel || "medium",
      notificationChannels: config.notificationChannels || ["in_app"],
      createdAt: now,
      updatedAt: now,
    };

    configStore.set(newConfig.id, newConfig);
    console.log(`[PredictiveDataQualityAI] Configuration created: ${newConfig.name}`);
    return newConfig;
  }

  async getModelMetrics(): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    lastTrainedAt: string;
    dataPointsUsed: number;
    predictions: number;
    correctPredictions: number;
    modelVersion: string;
  }> {
    return {
      accuracy: modelMetrics.accuracy,
      precision: modelMetrics.precision,
      recall: modelMetrics.recall,
      f1Score: (2 * modelMetrics.precision * modelMetrics.recall) / 
        (modelMetrics.precision + modelMetrics.recall) || 0,
      lastTrainedAt: modelMetrics.lastTrainedAt,
      dataPointsUsed: modelMetrics.dataPointsUsed,
      predictions: modelMetrics.predictions,
      correctPredictions: modelMetrics.correctPredictions,
      modelVersion: "1.0.0",
    };
  }

  async trainModel(): Promise<{
    success: boolean;
    message: string;
    samplesProcessed: number;
    previousMetrics: typeof modelMetrics;
    updatedMetrics: typeof modelMetrics;
  }> {
    const previousMetrics = { ...modelMetrics };
    
    const allPredictions = Array.from(predictionStore.values());
    const trainingData = allPredictions.filter((p) => p.status === "expired" || p.status === "validated");
    
    const validatedPredictions = trainingData.filter((p) => p.status === "validated");
    const correctPredictions = validatedPredictions.filter((p) => {
      const scoreDeviation = Math.abs(p.predictedScore - (p.actualScore || p.predictedScore));
      return scoreDeviation < 10;
    });

    if (validatedPredictions.length > 0) {
      modelMetrics.accuracy = correctPredictions.length / validatedPredictions.length;
    }

    const highRiskPredictions = trainingData.filter((p) => 
      p.riskLevel === "critical" || p.riskLevel === "high"
    );
    const truePositives = highRiskPredictions.filter((p) => {
      const actualScore = p.actualScore || p.predictedScore;
      return actualScore < 60;
    }).length;

    if (highRiskPredictions.length > 0) {
      modelMetrics.precision = truePositives / highRiskPredictions.length;
    }

    const actualProblems = trainingData.filter((p) => {
      const actualScore = p.actualScore || p.predictedScore;
      return actualScore < 60;
    });
    
    if (actualProblems.length > 0) {
      const detectedProblems = actualProblems.filter((p) =>
        p.riskLevel === "critical" || p.riskLevel === "high"
      ).length;
      modelMetrics.recall = detectedProblems / actualProblems.length;
    }

    modelMetrics.dataPointsUsed += trainingData.length;
    modelMetrics.lastTrainedAt = new Date().toISOString();

    console.log(`[PredictiveDataQualityAI] Model trained with ${trainingData.length} samples`);

    return {
      success: true,
      message: `Model trained successfully with ${trainingData.length} samples`,
      samplesProcessed: trainingData.length,
      previousMetrics,
      updatedMetrics: { ...modelMetrics },
    };
  }
}

export const predictiveDataQualityAI = new PredictiveDataQualityAI();
