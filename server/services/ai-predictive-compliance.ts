import OpenAI from "openai";

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]")
    .replace(/\b\d{9}\b/g, "[SSN-REDACTED]")
    .replace(/\b[A-Z]{1,2}\d{6,10}\b/gi, "[MRN-REDACTED]")
    .replace(/\b(patient|pt)\s*#?\s*\d+/gi, "[PATIENT-ID-REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE-REDACTED]")
    .replace(/\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g, "[DATE-REDACTED]");
}

const NO_CDS_PREDICTIVE_PROMPT = `You are a healthcare IT compliance and security analyst specializing in predictive analytics.
Your role is to analyze compliance data patterns and forecast potential issues.

STRICT GUIDELINES:
- NEVER provide clinical advice, diagnoses, or treatment recommendations
- NEVER interpret medical test results or patient health conditions
- Focus ONLY on compliance patterns, security risks, and data governance
- Analyze trends in policy violations, access patterns, and system behaviors
- Predict compliance risks based on historical data and current patterns
- Suggest process improvements for compliance, NOT clinical care

Your output should be:
- Data-driven compliance forecasts
- Risk trend analysis
- Policy adherence predictions
- Remediation workflow recommendations (NOT clinical recommendations)`;

export type DataSourceType = 
  | "cloud_logs" 
  | "apm_metrics" 
  | "security_events" 
  | "audit_logs" 
  | "access_patterns"
  | "policy_violations"
  | "external_integrations";

export interface DataSourceConfig {
  id: string;
  type: DataSourceType;
  name: string;
  enabled: boolean;
  refreshIntervalMs: number;
  lastSync: Date | null;
  connectionStatus: "connected" | "disconnected" | "error";
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface DataPoint {
  timestamp: Date;
  source: DataSourceType;
  category: string;
  value: number;
  metadata: Record<string, unknown>;
}

export interface TimeSeriesData {
  sourceType: DataSourceType;
  category: string;
  dataPoints: DataPoint[];
  aggregation: "hourly" | "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
}

export interface TrendAnalysis {
  id: string;
  category: string;
  sourceType: DataSourceType;
  trendDirection: "increasing" | "decreasing" | "stable" | "volatile";
  changePercent: number;
  significance: "high" | "medium" | "low";
  periodStart: Date;
  periodEnd: Date;
  dataPoints: number;
  forecast: ForecastPoint[];
  aiInsights: string;
  generatedAt: Date;
}

export interface ForecastPoint {
  timestamp: Date;
  predictedValue: number;
  confidenceLower: number;
  confidenceUpper: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface ComplianceDeviation {
  id: string;
  type: "predicted" | "actual";
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  predictedDate: Date;
  confidence: number;
  relatedDataSources: DataSourceType[];
  contributingFactors: ContributingFactor[];
  aiAnalysis: string;
  status: "pending" | "acknowledged" | "mitigated" | "resolved";
  createdAt: Date;
}

export interface ContributingFactor {
  factor: string;
  weight: number;
  trend: "increasing" | "decreasing" | "stable";
  dataSource: DataSourceType;
}

export interface RemediationSuggestion {
  id: string;
  deviationId: string;
  priority: "low" | "medium" | "high" | "critical";
  category: "process" | "technical" | "policy" | "training";
  title: string;
  description: string;
  steps: RemediationStep[];
  estimatedEffort: "minimal" | "moderate" | "significant";
  expectedImpact: string;
  automatable: boolean;
  aiRationale: string;
  status: "suggested" | "approved" | "in_progress" | "completed" | "rejected";
  createdAt: Date;
}

export interface RemediationStep {
  order: number;
  action: string;
  responsible: string;
  automated: boolean;
  estimatedDuration: string;
}

export interface ComplianceForecastReport {
  id: string;
  generatedAt: Date;
  forecastPeriod: {
    start: Date;
    end: Date;
  };
  overallRiskScore: number;
  riskTrend: "improving" | "stable" | "deteriorating";
  deviationPredictions: ComplianceDeviation[];
  trendAnalyses: TrendAnalysis[];
  remediationSuggestions: RemediationSuggestion[];
  executiveSummary: string;
  regulatoryImpact: {
    hipaa: { riskLevel: string; forecast: string };
    gdpr: { riskLevel: string; forecast: string };
    soc2: { riskLevel: string; forecast: string };
    hitech: { riskLevel: string; forecast: string };
  };
  keyMetrics: {
    predictedViolations: number;
    highRiskAreas: string[];
    improvementOpportunities: string[];
  };
}

class AIPredictiveComplianceService {
  private dataSources: Map<string, DataSourceConfig> = new Map();
  private timeSeriesCache: Map<string, TimeSeriesData> = new Map();
  private trendAnalyses: Map<string, TrendAnalysis> = new Map();
  private deviations: Map<string, ComplianceDeviation> = new Map();
  private remediations: Map<string, RemediationSuggestion> = new Map();
  private reports: Map<string, ComplianceForecastReport> = new Map();
  private dataPoints: DataPoint[] = [];

  constructor() {
    this.initializeDefaultDataSources();
    this.generateSampleData();
    console.log("[AIPredictiveCompliance] Service initialized");
  }

  private initializeDefaultDataSources(): void {
    const defaultSources: DataSourceConfig[] = [
      {
        id: "cloud-logs-1",
        type: "cloud_logs",
        name: "Cloud Provider Audit Logs",
        enabled: true,
        refreshIntervalMs: 300000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { provider: "gcp", logTypes: ["admin", "data_access", "system"] }
      },
      {
        id: "apm-1",
        type: "apm_metrics",
        name: "Application Performance Metrics",
        enabled: true,
        refreshIntervalMs: 60000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { metrics: ["latency", "error_rate", "throughput", "availability"] }
      },
      {
        id: "security-events-1",
        type: "security_events",
        name: "Security Event Stream",
        enabled: true,
        refreshIntervalMs: 30000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { sources: ["firewall", "ids", "auth_system"] }
      },
      {
        id: "audit-logs-1",
        type: "audit_logs",
        name: "HIPAA Audit Logs",
        enabled: true,
        refreshIntervalMs: 60000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { retentionDays: 2555 }
      },
      {
        id: "access-patterns-1",
        type: "access_patterns",
        name: "Data Access Pattern Analysis",
        enabled: true,
        refreshIntervalMs: 300000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { analysisWindow: "7d" }
      },
      {
        id: "policy-violations-1",
        type: "policy_violations",
        name: "Policy Violation Tracker",
        enabled: true,
        refreshIntervalMs: 120000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { policies: ["data_retention", "access_control", "encryption"] }
      },
      {
        id: "external-int-1",
        type: "external_integrations",
        name: "External System Health",
        enabled: true,
        refreshIntervalMs: 300000,
        lastSync: new Date(),
        connectionStatus: "connected",
        metadata: { systems: ["ehr", "lab", "pharmacy", "payer"] }
      }
    ];

    defaultSources.forEach(source => {
      this.dataSources.set(source.id, source);
    });

    console.log(`[AIPredictiveCompliance] Initialized ${defaultSources.length} data sources`);
  }

  private generateSampleData(): void {
    const now = new Date();
    const categories = [
      "access_violations", "encryption_compliance", "data_retention", 
      "auth_failures", "api_errors", "policy_adherence", "audit_completeness"
    ];
    
    categories.forEach(category => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        const baseValue = Math.random() * 50 + 10;
        const trend = category === "access_violations" ? i * 0.5 : -i * 0.3;
        const noise = (Math.random() - 0.5) * 10;
        
        this.dataPoints.push({
          timestamp: date,
          source: this.getCategorySource(category),
          category,
          value: Math.max(0, baseValue + trend + noise),
          metadata: { dayOfWeek: date.getDay() }
        });
      }
    });

    console.log(`[AIPredictiveCompliance] Generated ${this.dataPoints.length} sample data points`);
  }

  private getCategorySource(category: string): DataSourceType {
    const mapping: Record<string, DataSourceType> = {
      access_violations: "access_patterns",
      encryption_compliance: "security_events",
      data_retention: "policy_violations",
      auth_failures: "security_events",
      api_errors: "apm_metrics",
      policy_adherence: "audit_logs",
      audit_completeness: "audit_logs"
    };
    return mapping[category] || "audit_logs";
  }

  getDataSources(): DataSourceConfig[] {
    return Array.from(this.dataSources.values());
  }

  async addDataSource(config: Omit<DataSourceConfig, "id" | "lastSync" | "connectionStatus">): Promise<DataSourceConfig> {
    const source: DataSourceConfig = {
      ...config,
      id: `source-${Date.now()}`,
      lastSync: null,
      connectionStatus: "disconnected"
    };
    
    this.dataSources.set(source.id, source);
    
    source.connectionStatus = "connected";
    source.lastSync = new Date();
    
    return source;
  }

  async syncDataSource(sourceId: string): Promise<{ success: boolean; recordsProcessed: number }> {
    const source = this.dataSources.get(sourceId);
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`);
    }

    const newPoints = Math.floor(Math.random() * 50) + 10;
    const now = new Date();
    
    for (let i = 0; i < newPoints; i++) {
      this.dataPoints.push({
        timestamp: now,
        source: source.type,
        category: this.getRandomCategory(source.type),
        value: Math.random() * 100,
        metadata: { sourceId }
      });
    }

    source.lastSync = now;
    source.connectionStatus = "connected";
    
    return { success: true, recordsProcessed: newPoints };
  }

  private getRandomCategory(sourceType: DataSourceType): string {
    const categories: Record<DataSourceType, string[]> = {
      cloud_logs: ["api_calls", "resource_access", "config_changes"],
      apm_metrics: ["latency", "error_rate", "throughput"],
      security_events: ["auth_failures", "intrusion_attempts", "encryption_compliance"],
      audit_logs: ["phi_access", "data_exports", "consent_changes"],
      access_patterns: ["access_violations", "unusual_access", "bulk_access"],
      policy_violations: ["data_retention", "encryption", "access_control"],
      external_integrations: ["sync_failures", "data_quality", "connection_health"]
    };
    const cats = categories[sourceType] || ["general"];
    return cats[Math.floor(Math.random() * cats.length)];
  }

  getTimeSeriesData(
    sourceType: DataSourceType,
    category: string,
    startDate: Date,
    endDate: Date,
    aggregation: "hourly" | "daily" | "weekly" | "monthly" = "daily"
  ): TimeSeriesData {
    const filteredPoints = this.dataPoints.filter(p => 
      p.source === sourceType &&
      p.category === category &&
      p.timestamp >= startDate &&
      p.timestamp <= endDate
    );

    return {
      sourceType,
      category,
      dataPoints: filteredPoints,
      aggregation,
      startDate,
      endDate
    };
  }

  async analyzeTrends(category: string, lookbackDays: number = 30): Promise<TrendAnalysis> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const relevantPoints = this.dataPoints.filter(p =>
      p.category === category &&
      p.timestamp >= startDate &&
      p.timestamp <= endDate
    );

    if (relevantPoints.length < 2) {
      throw new Error(`Insufficient data points for trend analysis: ${category}`);
    }

    relevantPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const firstHalf = relevantPoints.slice(0, Math.floor(relevantPoints.length / 2));
    const secondHalf = relevantPoints.slice(Math.floor(relevantPoints.length / 2));

    const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    const variance = this.calculateVariance(relevantPoints.map(p => p.value));

    let trendDirection: TrendAnalysis["trendDirection"];
    if (variance > 500) {
      trendDirection = "volatile";
    } else if (changePercent > 10) {
      trendDirection = "increasing";
    } else if (changePercent < -10) {
      trendDirection = "decreasing";
    } else {
      trendDirection = "stable";
    }

    const forecast = this.generateForecast(relevantPoints, 14);

    const aiInsights = await this.generateTrendInsights(category, trendDirection, changePercent, forecast);

    const analysis: TrendAnalysis = {
      id: `trend-${Date.now()}`,
      category,
      sourceType: relevantPoints[0]?.source || "audit_logs",
      trendDirection,
      changePercent: Math.round(changePercent * 100) / 100,
      significance: Math.abs(changePercent) > 25 ? "high" : Math.abs(changePercent) > 10 ? "medium" : "low",
      periodStart: startDate,
      periodEnd: endDate,
      dataPoints: relevantPoints.length,
      forecast,
      aiInsights,
      generatedAt: new Date()
    };

    this.trendAnalyses.set(analysis.id, analysis);
    return analysis;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private generateForecast(dataPoints: DataPoint[], forecastDays: number): ForecastPoint[] {
    const values = dataPoints.map(p => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const trend = (values[values.length - 1] - values[0]) / values.length;
    const stdDev = Math.sqrt(this.calculateVariance(values));

    const forecast: ForecastPoint[] = [];
    const lastDate = dataPoints[dataPoints.length - 1].timestamp;

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      const predictedValue = mean + (trend * i);
      const uncertainty = stdDev * Math.sqrt(i) * 0.5;

      let riskLevel: ForecastPoint["riskLevel"];
      if (predictedValue > mean + 2 * stdDev) {
        riskLevel = "critical";
      } else if (predictedValue > mean + stdDev) {
        riskLevel = "high";
      } else if (predictedValue > mean + 0.5 * stdDev) {
        riskLevel = "medium";
      } else {
        riskLevel = "low";
      }

      forecast.push({
        timestamp: forecastDate,
        predictedValue: Math.max(0, Math.round(predictedValue * 100) / 100),
        confidenceLower: Math.max(0, Math.round((predictedValue - uncertainty) * 100) / 100),
        confidenceUpper: Math.round((predictedValue + uncertainty) * 100) / 100,
        riskLevel
      });
    }

    return forecast;
  }

  private async generateTrendInsights(
    category: string,
    direction: string,
    changePercent: number,
    forecast: ForecastPoint[]
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return this.generateFallbackTrendInsights(category, direction, changePercent, forecast);
    }

    try {
      const highRiskDays = forecast.filter(f => f.riskLevel === "high" || f.riskLevel === "critical").length;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_PREDICTIVE_PROMPT },
          {
            role: "user",
            content: `Analyze this compliance trend data:
Category: ${sanitizePhi(category)}
Trend Direction: ${direction}
Change: ${changePercent.toFixed(1)}%
Forecast Period: ${forecast.length} days
High-Risk Days Predicted: ${highRiskDays}

Provide a brief (2-3 sentences) compliance-focused insight about this trend and its implications for data governance. Focus on policy and process improvements, NOT clinical recommendations.`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || this.generateFallbackTrendInsights(category, direction, changePercent, forecast);
    } catch (error) {
      console.error("[AIPredictiveCompliance] AI trend analysis error:", error);
      return this.generateFallbackTrendInsights(category, direction, changePercent, forecast);
    }
  }

  private generateFallbackTrendInsights(
    category: string,
    direction: string,
    changePercent: number,
    forecast: ForecastPoint[]
  ): string {
    const highRiskDays = forecast.filter(f => f.riskLevel === "high" || f.riskLevel === "critical").length;
    
    if (direction === "increasing" && changePercent > 15) {
      return `The ${category.replace(/_/g, " ")} metric shows a concerning upward trend of ${changePercent.toFixed(1)}%. With ${highRiskDays} high-risk days forecasted, proactive policy review and enhanced monitoring are recommended.`;
    } else if (direction === "decreasing") {
      return `Positive trend observed in ${category.replace(/_/g, " ")} with a ${Math.abs(changePercent).toFixed(1)}% reduction. Continue current compliance measures while monitoring for any reversals.`;
    } else if (direction === "volatile") {
      return `High volatility detected in ${category.replace(/_/g, " ")} metrics. Consider implementing more consistent enforcement policies and investigating root causes of the variability.`;
    }
    return `The ${category.replace(/_/g, " ")} metric remains stable. Maintain current compliance posture and regular monitoring schedules.`;
  }

  async predictDeviations(forecastDays: number = 14): Promise<ComplianceDeviation[]> {
    const categories = ["access_violations", "encryption_compliance", "data_retention", "auth_failures", "policy_adherence"];
    const predictions: ComplianceDeviation[] = [];

    for (const category of categories) {
      try {
        const trend = await this.analyzeTrends(category, 30);
        const highRiskForecasts = trend.forecast.filter(f => 
          f.riskLevel === "high" || f.riskLevel === "critical"
        );

        if (highRiskForecasts.length > 0) {
          const deviation = await this.createDeviationPrediction(category, trend, highRiskForecasts);
          predictions.push(deviation);
          this.deviations.set(deviation.id, deviation);
        }
      } catch (error) {
        console.error(`[AIPredictiveCompliance] Error analyzing ${category}:`, error);
      }
    }

    return predictions;
  }

  private async createDeviationPrediction(
    category: string,
    trend: TrendAnalysis,
    highRiskForecasts: ForecastPoint[]
  ): Promise<ComplianceDeviation> {
    const earliestHighRisk = highRiskForecasts[0];
    const severity = highRiskForecasts.some(f => f.riskLevel === "critical") ? "critical" :
                    highRiskForecasts.length > 3 ? "high" : "medium";

    const factors: ContributingFactor[] = [
      {
        factor: `Historical ${category.replace(/_/g, " ")} trend`,
        weight: 0.4,
        trend: trend.trendDirection === "increasing" ? "increasing" : "stable",
        dataSource: trend.sourceType
      },
      {
        factor: "Forecast model confidence",
        weight: 0.3,
        trend: "stable",
        dataSource: "audit_logs"
      },
      {
        factor: "Recent policy changes",
        weight: 0.2,
        trend: "stable",
        dataSource: "policy_violations"
      },
      {
        factor: "External system health",
        weight: 0.1,
        trend: "stable",
        dataSource: "external_integrations"
      }
    ];

    const aiAnalysis = await this.generateDeviationAnalysis(category, severity, trend, highRiskForecasts.length);

    return {
      id: `deviation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "predicted",
      category,
      severity,
      description: `Predicted compliance deviation in ${category.replace(/_/g, " ")} based on ${trend.trendDirection} trend analysis`,
      predictedDate: earliestHighRisk.timestamp,
      confidence: this.calculateConfidence(trend, highRiskForecasts.length),
      relatedDataSources: [trend.sourceType, "audit_logs"],
      contributingFactors: factors,
      aiAnalysis,
      status: "pending",
      createdAt: new Date()
    };
  }

  private calculateConfidence(trend: TrendAnalysis, highRiskDays: number): number {
    let confidence = 0.5;
    
    if (trend.dataPoints > 20) confidence += 0.1;
    if (trend.dataPoints > 50) confidence += 0.1;
    
    if (trend.significance === "high") confidence += 0.15;
    else if (trend.significance === "medium") confidence += 0.08;
    
    if (highRiskDays > 5) confidence += 0.1;
    
    if (trend.trendDirection === "volatile") confidence -= 0.15;
    
    return Math.min(0.95, Math.max(0.3, confidence));
  }

  private async generateDeviationAnalysis(
    category: string,
    severity: string,
    trend: TrendAnalysis,
    highRiskDays: number
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return this.generateFallbackDeviationAnalysis(category, severity, trend, highRiskDays);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_PREDICTIVE_PROMPT },
          {
            role: "user",
            content: `Analyze this predicted compliance deviation:
Category: ${sanitizePhi(category)}
Severity: ${severity}
Trend: ${trend.trendDirection} (${trend.changePercent.toFixed(1)}% change)
High-Risk Days: ${highRiskDays} in next 14 days

Provide a brief analysis (2-3 sentences) of the compliance risk and recommended preventive measures. Focus on data governance and policy enforcement, NOT clinical aspects.`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || this.generateFallbackDeviationAnalysis(category, severity, trend, highRiskDays);
    } catch (error) {
      console.error("[AIPredictiveCompliance] AI deviation analysis error:", error);
      return this.generateFallbackDeviationAnalysis(category, severity, trend, highRiskDays);
    }
  }

  private generateFallbackDeviationAnalysis(
    category: string,
    severity: string,
    trend: TrendAnalysis,
    highRiskDays: number
  ): string {
    return `Predictive analysis indicates a ${severity} risk of ${category.replace(/_/g, " ")} deviation with ${highRiskDays} high-risk days forecasted. The ${trend.trendDirection} trend (${trend.changePercent.toFixed(1)}% change) suggests proactive policy review and enhanced monitoring are needed to prevent non-compliance.`;
  }

  async generateRemediationSuggestions(deviationId: string): Promise<RemediationSuggestion[]> {
    const deviation = this.deviations.get(deviationId);
    if (!deviation) {
      throw new Error(`Deviation not found: ${deviationId}`);
    }

    if (deviation.severity === "low") {
      return [];
    }

    const suggestions = await this.createRemediationSuggestions(deviation);
    suggestions.forEach(s => this.remediations.set(s.id, s));

    return suggestions;
  }

  private async createRemediationSuggestions(deviation: ComplianceDeviation): Promise<RemediationSuggestion[]> {
    const suggestions: RemediationSuggestion[] = [];
    const basePriority = deviation.severity === "critical" ? "critical" : 
                        deviation.severity === "high" ? "high" : "medium";

    const templates = this.getRemediationTemplates(deviation.category);

    for (const template of templates) {
      const rationale = await this.generateRemediationRationale(deviation, template);
      
      suggestions.push({
        id: `remediation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        deviationId: deviation.id,
        priority: basePriority,
        category: template.category,
        title: template.title,
        description: template.description,
        steps: template.steps,
        estimatedEffort: template.effort,
        expectedImpact: template.impact,
        automatable: template.automatable,
        aiRationale: rationale,
        status: "suggested",
        createdAt: new Date()
      });
    }

    return suggestions;
  }

  private getRemediationTemplates(category: string): Array<{
    category: RemediationSuggestion["category"];
    title: string;
    description: string;
    steps: RemediationStep[];
    effort: RemediationSuggestion["estimatedEffort"];
    impact: string;
    automatable: boolean;
  }> {
    type TemplateType = {
      category: RemediationSuggestion["category"];
      title: string;
      description: string;
      steps: RemediationStep[];
      effort: RemediationSuggestion["estimatedEffort"];
      impact: string;
      automatable: boolean;
    };
    
    const templates: Record<string, TemplateType[]> = {
      access_violations: [
        {
          category: "technical",
          title: "Implement Automated Access Review",
          description: "Deploy automated access pattern analysis to detect and prevent unauthorized data access",
          steps: [
            { order: 1, action: "Enable real-time access monitoring", responsible: "Security Team", automated: true, estimatedDuration: "1 hour" },
            { order: 2, action: "Configure access anomaly detection thresholds", responsible: "Compliance Officer", automated: false, estimatedDuration: "2 hours" },
            { order: 3, action: "Set up automated alerts for violations", responsible: "Security Team", automated: true, estimatedDuration: "30 minutes" }
          ],
          effort: "moderate",
          impact: "Reduce access violations by 60-80% through proactive detection",
          automatable: true
        },
        {
          category: "policy",
          title: "Update Access Control Policy",
          description: "Review and strengthen access control policies based on observed violation patterns",
          steps: [
            { order: 1, action: "Analyze recent access violation patterns", responsible: "Compliance Team", automated: false, estimatedDuration: "4 hours" },
            { order: 2, action: "Draft policy amendments", responsible: "Compliance Officer", automated: false, estimatedDuration: "2 hours" },
            { order: 3, action: "Obtain stakeholder approval", responsible: "Leadership", automated: false, estimatedDuration: "1 week" }
          ],
          effort: "significant",
          impact: "Establish clearer access boundaries and reduce policy gaps",
          automatable: false
        }
      ],
      encryption_compliance: [
        {
          category: "technical",
          title: "Encryption Gap Remediation",
          description: "Identify and remediate data encryption gaps across storage and transit",
          steps: [
            { order: 1, action: "Run encryption audit scan", responsible: "Security Team", automated: true, estimatedDuration: "2 hours" },
            { order: 2, action: "Enable encryption for identified gaps", responsible: "DevOps", automated: true, estimatedDuration: "4 hours" },
            { order: 3, action: "Verify encryption status", responsible: "Security Team", automated: true, estimatedDuration: "1 hour" }
          ],
          effort: "moderate",
          impact: "Achieve 100% encryption compliance for data at rest and in transit",
          automatable: true
        }
      ],
      data_retention: [
        {
          category: "process",
          title: "Automated Data Lifecycle Management",
          description: "Implement automated data retention and purging workflows",
          steps: [
            { order: 1, action: "Classify data by retention requirements", responsible: "Data Governance Team", automated: false, estimatedDuration: "1 week" },
            { order: 2, action: "Configure automated retention policies", responsible: "DevOps", automated: true, estimatedDuration: "4 hours" },
            { order: 3, action: "Schedule regular retention audits", responsible: "Compliance Team", automated: true, estimatedDuration: "1 hour" }
          ],
          effort: "significant",
          impact: "Ensure regulatory compliance with data retention requirements",
          automatable: true
        }
      ],
      auth_failures: [
        {
          category: "technical",
          title: "Enhanced Authentication Monitoring",
          description: "Deploy advanced authentication failure detection and response",
          steps: [
            { order: 1, action: "Enable detailed auth logging", responsible: "Security Team", automated: true, estimatedDuration: "1 hour" },
            { order: 2, action: "Configure failure threshold alerts", responsible: "Security Team", automated: true, estimatedDuration: "30 minutes" },
            { order: 3, action: "Implement progressive lockout policy", responsible: "DevOps", automated: true, estimatedDuration: "2 hours" }
          ],
          effort: "minimal",
          impact: "Reduce successful unauthorized access attempts by 90%",
          automatable: true
        },
        {
          category: "training",
          title: "Security Awareness Training",
          description: "Conduct targeted training on authentication best practices",
          steps: [
            { order: 1, action: "Identify users with high failure rates", responsible: "Security Team", automated: true, estimatedDuration: "1 hour" },
            { order: 2, action: "Develop targeted training content", responsible: "Training Team", automated: false, estimatedDuration: "1 week" },
            { order: 3, action: "Deploy and track training completion", responsible: "HR", automated: true, estimatedDuration: "2 weeks" }
          ],
          effort: "moderate",
          impact: "Improve user security practices and reduce accidental failures",
          automatable: false
        }
      ],
      policy_adherence: [
        {
          category: "process",
          title: "Policy Compliance Dashboard",
          description: "Create real-time visibility into policy adherence metrics",
          steps: [
            { order: 1, action: "Define key policy metrics", responsible: "Compliance Team", automated: false, estimatedDuration: "4 hours" },
            { order: 2, action: "Configure automated metric collection", responsible: "DevOps", automated: true, estimatedDuration: "8 hours" },
            { order: 3, action: "Deploy compliance dashboard", responsible: "DevOps", automated: true, estimatedDuration: "4 hours" }
          ],
          effort: "moderate",
          impact: "Enable proactive policy compliance management",
          automatable: true
        }
      ]
    };

    return templates[category] || [
      {
        category: "process",
        title: "General Compliance Review",
        description: "Conduct comprehensive compliance review for identified risk area",
        steps: [
          { order: 1, action: "Document current state", responsible: "Compliance Team", automated: false, estimatedDuration: "4 hours" },
          { order: 2, action: "Identify gaps and risks", responsible: "Compliance Team", automated: false, estimatedDuration: "4 hours" },
          { order: 3, action: "Develop remediation plan", responsible: "Compliance Team", automated: false, estimatedDuration: "2 hours" }
        ],
        effort: "moderate",
        impact: "Address compliance gaps through structured review process",
        automatable: false
      }
    ];
  }

  private async generateRemediationRationale(
    deviation: ComplianceDeviation,
    template: { title: string; category: string }
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return `This ${template.category} remediation is recommended to address the predicted ${deviation.category.replace(/_/g, " ")} deviation. Implementation will help prevent compliance issues before they occur.`;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_PREDICTIVE_PROMPT },
          {
            role: "user",
            content: `Explain why this remediation is appropriate:
Deviation: ${sanitizePhi(deviation.category)} (${deviation.severity} severity)
Remediation: ${sanitizePhi(template.title)}
Type: ${template.category}

Provide a brief (1-2 sentences) rationale for this specific remediation approach. Focus on compliance and governance benefits.`
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || `This remediation addresses the ${deviation.category} risk through targeted ${template.category} improvements.`;
    } catch (error) {
      return `This remediation addresses the ${deviation.category} risk through targeted ${template.category} improvements.`;
    }
  }

  async generateForecastReport(forecastDays: number = 30): Promise<ComplianceForecastReport> {
    const deviations = await this.predictDeviations(forecastDays);
    
    const allRemediations: RemediationSuggestion[] = [];
    for (const deviation of deviations) {
      if (deviation.severity !== "low") {
        const suggestions = await this.generateRemediationSuggestions(deviation.id);
        allRemediations.push(...suggestions);
      }
    }

    const trendAnalyses: TrendAnalysis[] = [];
    const categories = ["access_violations", "encryption_compliance", "data_retention", "auth_failures", "policy_adherence"];
    
    for (const category of categories) {
      try {
        const trend = await this.analyzeTrends(category, 30);
        trendAnalyses.push(trend);
      } catch (error) {
      }
    }

    const overallRiskScore = this.calculateOverallRiskScore(deviations, trendAnalyses);
    const riskTrend = this.calculateRiskTrend(trendAnalyses);
    const executiveSummary = await this.generateExecutiveSummary(deviations, trendAnalyses, overallRiskScore);

    const report: ComplianceForecastReport = {
      id: `forecast-${Date.now()}`,
      generatedAt: new Date(),
      forecastPeriod: {
        start: new Date(),
        end: new Date(Date.now() + forecastDays * 24 * 60 * 60 * 1000)
      },
      overallRiskScore,
      riskTrend,
      deviationPredictions: deviations,
      trendAnalyses,
      remediationSuggestions: allRemediations,
      executiveSummary,
      regulatoryImpact: {
        hipaa: this.assessRegulatoryImpact("hipaa", deviations),
        gdpr: this.assessRegulatoryImpact("gdpr", deviations),
        soc2: this.assessRegulatoryImpact("soc2", deviations),
        hitech: this.assessRegulatoryImpact("hitech", deviations)
      },
      keyMetrics: {
        predictedViolations: deviations.length,
        highRiskAreas: deviations
          .filter(d => d.severity === "high" || d.severity === "critical")
          .map(d => d.category),
        improvementOpportunities: trendAnalyses
          .filter(t => t.trendDirection === "decreasing")
          .map(t => t.category)
      }
    };

    this.reports.set(report.id, report);
    return report;
  }

  private calculateOverallRiskScore(deviations: ComplianceDeviation[], trends: TrendAnalysis[]): number {
    let score = 20;

    deviations.forEach(d => {
      switch (d.severity) {
        case "critical": score += 25; break;
        case "high": score += 15; break;
        case "medium": score += 8; break;
        case "low": score += 3; break;
      }
    });

    trends.forEach(t => {
      if (t.trendDirection === "increasing" && t.significance === "high") {
        score += 10;
      } else if (t.trendDirection === "volatile") {
        score += 5;
      } else if (t.trendDirection === "decreasing") {
        score -= 5;
      }
    });

    return Math.min(100, Math.max(0, score));
  }

  private calculateRiskTrend(trends: TrendAnalysis[]): "improving" | "stable" | "deteriorating" {
    const improvingCount = trends.filter(t => t.trendDirection === "decreasing").length;
    const deterioratingCount = trends.filter(t => t.trendDirection === "increasing" || t.trendDirection === "volatile").length;

    if (improvingCount > deterioratingCount + 1) return "improving";
    if (deterioratingCount > improvingCount + 1) return "deteriorating";
    return "stable";
  }

  private assessRegulatoryImpact(regulation: string, deviations: ComplianceDeviation[]): { riskLevel: string; forecast: string } {
    const regulationMapping: Record<string, string[]> = {
      hipaa: ["access_violations", "encryption_compliance", "audit_completeness"],
      gdpr: ["data_retention", "access_violations", "consent_changes"],
      soc2: ["access_violations", "auth_failures", "encryption_compliance"],
      hitech: ["encryption_compliance", "access_violations", "data_retention"]
    };

    const relevantCategories = regulationMapping[regulation] || [];
    const relevantDeviations = deviations.filter(d => relevantCategories.includes(d.category));

    let riskLevel = "low";
    if (relevantDeviations.some(d => d.severity === "critical")) {
      riskLevel = "critical";
    } else if (relevantDeviations.some(d => d.severity === "high")) {
      riskLevel = "high";
    } else if (relevantDeviations.length > 0) {
      riskLevel = "medium";
    }

    const forecasts: Record<string, string> = {
      low: "Compliance posture is strong with no significant risks forecasted",
      medium: "Some compliance risks identified; proactive measures recommended",
      high: "Elevated compliance risk; immediate attention required",
      critical: "Critical compliance exposure; urgent remediation needed"
    };

    return { riskLevel, forecast: forecasts[riskLevel] };
  }

  private async generateExecutiveSummary(
    deviations: ComplianceDeviation[],
    trends: TrendAnalysis[],
    riskScore: number
  ): Promise<string> {
    const criticalCount = deviations.filter(d => d.severity === "critical").length;
    const highCount = deviations.filter(d => d.severity === "high").length;
    const improvingTrends = trends.filter(t => t.trendDirection === "decreasing").length;

    if (!process.env.OPENAI_API_KEY || !openai) {
      return this.generateFallbackExecutiveSummary(riskScore, criticalCount, highCount, improvingTrends, deviations.length);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_PREDICTIVE_PROMPT },
          {
            role: "user",
            content: `Generate an executive summary for this compliance forecast:
Overall Risk Score: ${riskScore}/100
Critical Deviations Predicted: ${criticalCount}
High-Risk Deviations: ${highCount}
Total Predictions: ${deviations.length}
Improving Trends: ${improvingTrends} of ${trends.length}

Write a brief (3-4 sentences) executive summary suitable for leadership. Focus on compliance posture, key risks, and recommended actions. Do NOT include any clinical recommendations.`
          }
        ],
        max_tokens: 250,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || this.generateFallbackExecutiveSummary(riskScore, criticalCount, highCount, improvingTrends, deviations.length);
    } catch (error) {
      return this.generateFallbackExecutiveSummary(riskScore, criticalCount, highCount, improvingTrends, deviations.length);
    }
  }

  private generateFallbackExecutiveSummary(
    riskScore: number,
    criticalCount: number,
    highCount: number,
    improvingTrends: number,
    totalDeviations: number
  ): string {
    const riskLevel = riskScore >= 70 ? "elevated" : riskScore >= 40 ? "moderate" : "acceptable";
    
    let summary = `The compliance forecast indicates ${riskLevel} risk with an overall score of ${riskScore}/100. `;
    
    if (criticalCount > 0 || highCount > 0) {
      summary += `${criticalCount + highCount} significant compliance deviations are predicted, requiring immediate attention. `;
    } else if (totalDeviations > 0) {
      summary += `${totalDeviations} minor compliance risks have been identified for proactive monitoring. `;
    }
    
    if (improvingTrends > 0) {
      summary += `Positive trends observed in ${improvingTrends} compliance areas indicate improving governance posture. `;
    }
    
    summary += "Recommended actions include reviewing automated remediation suggestions and prioritizing high-risk areas.";
    
    return summary;
  }

  listDeviations(filters?: { severity?: string; status?: string }): ComplianceDeviation[] {
    let deviations = Array.from(this.deviations.values());
    
    if (filters?.severity) {
      deviations = deviations.filter(d => d.severity === filters.severity);
    }
    if (filters?.status) {
      deviations = deviations.filter(d => d.status === filters.status);
    }
    
    return deviations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateDeviationStatus(deviationId: string, status: ComplianceDeviation["status"]): ComplianceDeviation | null {
    const deviation = this.deviations.get(deviationId);
    if (deviation) {
      deviation.status = status;
    }
    return deviation || null;
  }

  listRemediations(filters?: { deviationId?: string; status?: string; priority?: string }): RemediationSuggestion[] {
    let remediations = Array.from(this.remediations.values());
    
    if (filters?.deviationId) {
      remediations = remediations.filter(r => r.deviationId === filters.deviationId);
    }
    if (filters?.status) {
      remediations = remediations.filter(r => r.status === filters.status);
    }
    if (filters?.priority) {
      remediations = remediations.filter(r => r.priority === filters.priority);
    }
    
    return remediations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateRemediationStatus(remediationId: string, status: RemediationSuggestion["status"]): RemediationSuggestion | null {
    const remediation = this.remediations.get(remediationId);
    if (remediation) {
      remediation.status = status;
    }
    return remediation || null;
  }

  getReport(reportId: string): ComplianceForecastReport | null {
    return this.reports.get(reportId) || null;
  }

  listReports(): ComplianceForecastReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  getDashboardMetrics(): {
    dataSources: { connected: number; total: number };
    riskScore: number;
    predictions: { critical: number; high: number; medium: number; low: number };
    trendSummary: { improving: number; stable: number; deteriorating: number };
    remediations: { suggested: number; inProgress: number; completed: number };
  } {
    const sources = Array.from(this.dataSources.values());
    const deviations = Array.from(this.deviations.values());
    const remediations = Array.from(this.remediations.values());
    const trends = Array.from(this.trendAnalyses.values());

    return {
      dataSources: {
        connected: sources.filter(s => s.connectionStatus === "connected").length,
        total: sources.length
      },
      riskScore: this.calculateOverallRiskScore(deviations, trends),
      predictions: {
        critical: deviations.filter(d => d.severity === "critical").length,
        high: deviations.filter(d => d.severity === "high").length,
        medium: deviations.filter(d => d.severity === "medium").length,
        low: deviations.filter(d => d.severity === "low").length
      },
      trendSummary: {
        improving: trends.filter(t => t.trendDirection === "decreasing").length,
        stable: trends.filter(t => t.trendDirection === "stable").length,
        deteriorating: trends.filter(t => t.trendDirection === "increasing" || t.trendDirection === "volatile").length
      },
      remediations: {
        suggested: remediations.filter(r => r.status === "suggested").length,
        inProgress: remediations.filter(r => r.status === "in_progress" || r.status === "approved").length,
        completed: remediations.filter(r => r.status === "completed").length
      }
    };
  }
}

export const aiPredictiveComplianceService = new AIPredictiveComplianceService();
