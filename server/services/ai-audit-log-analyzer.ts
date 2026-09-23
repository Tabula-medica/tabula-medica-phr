import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { automatedAlertingService } from "./automated-alerting";
import { generatePhiSafeText } from "./ai-gateway";
import type {
  SecurityAuditLog,
  ComplianceRisk,
  ComplianceRiskLevel,
  ComplianceRiskCategory,
} from "@shared/schema";

const aiEnabled = true;

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

const NO_CDS_AUDIT_ANALYZER_PROMPT = `You are a healthcare IT security analyst specializing in audit log analysis and threat detection.
Your role is to analyze security audit logs and identify suspicious patterns, anomalies, and potential threats.

STRICT GUIDELINES:
- NEVER provide clinical advice, diagnoses, or treatment recommendations
- NEVER interpret medical test results or patient health conditions
- Focus ONLY on security patterns, access anomalies, and potential threats
- Analyze user behavior patterns for security concerns
- Identify data access patterns that may indicate insider threats or breaches
- Suggest security improvements for access controls, NOT clinical care

Your output should be:
- Threat assessments with confidence levels
- Anomaly classifications with severity ratings
- Behavioral pattern analysis for security purposes
- Remediation recommendations for security controls`;

export type ThreatType = 
  | "data_exfiltration"
  | "unauthorized_access"
  | "privilege_escalation"
  | "insider_threat"
  | "brute_force"
  | "session_hijacking"
  | "reconnaissance"
  | "lateral_movement"
  | "credential_abuse"
  | "anomalous_behavior";

export type AnomalyType =
  | "time_based"
  | "volume_based"
  | "location_based"
  | "resource_based"
  | "behavioral"
  | "sequence_based";

export interface AccessPattern {
  id: string;
  userId: string;
  userRole?: string;
  patternType: "normal" | "suspicious" | "malicious";
  description: string;
  frequency: number;
  timeWindow: { start: Date; end: Date };
  resources: string[];
  eventTypes: string[];
  riskScore: number;
  indicators: PatternIndicator[];
  createdAt: Date;
}

export interface PatternIndicator {
  type: string;
  value: string | number;
  baseline: string | number;
  deviation: number;
  significance: "low" | "medium" | "high" | "critical";
}

export interface SecurityAnomaly {
  id: string;
  anomalyType: AnomalyType;
  severity: ComplianceRiskLevel;
  description: string;
  affectedUsers: string[];
  affectedResources: string[];
  detectedAt: Date;
  evidenceCount: number;
  baselineComparison: {
    metric: string;
    expected: number;
    actual: number;
    deviationPercent: number;
  }[];
  aiAnalysis: string;
  status: "new" | "investigating" | "confirmed" | "false_positive" | "resolved";
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface ThreatAssessment {
  id: string;
  threatType: ThreatType;
  severity: ComplianceRiskLevel;
  confidence: number;
  description: string;
  indicators: ThreatIndicator[];
  affectedUsers: string[];
  affectedSystems: string[];
  mitreTactics: string[];
  recommendedActions: string[];
  aiInsights: string;
  status: "active" | "contained" | "remediated" | "false_positive";
  detectedAt: Date;
  escalatedAt?: Date;
  containedAt?: Date;
  remediatedAt?: Date;
}

export interface ThreatIndicator {
  id: string;
  indicatorType: string;
  value: string;
  context: string;
  weight: number;
  source: string;
}

export interface UserBehaviorProfile {
  userId: string;
  baselineEstablished: boolean;
  normalAccessHours: { start: number; end: number };
  typicalResources: string[];
  averageSessionDuration: number;
  typicalIpRanges: string[];
  accessFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  riskScore: number;
  lastUpdated: Date;
  anomalyHistory: { date: Date; type: string; severity: string }[];
}

export interface AuditAnalysisResult {
  id: string;
  analysisType: "real_time" | "batch" | "historical";
  period: { start: Date; end: Date };
  logsAnalyzed: number;
  patternsDetected: AccessPattern[];
  anomaliesFound: SecurityAnomaly[];
  threatsIdentified: ThreatAssessment[];
  riskScoreSummary: {
    overall: number;
    byCategory: Record<string, number>;
    trend: "improving" | "stable" | "deteriorating";
  };
  aiSummary: string;
  recommendations: string[];
  alertsGenerated: number;
  createdAt: Date;
}

class AIAuditLogAnalyzerService {
  private auditLogs: Map<string, SecurityAuditLog> = new Map();
  private patterns: Map<string, AccessPattern> = new Map();
  private anomalies: Map<string, SecurityAnomaly> = new Map();
  private threats: Map<string, ThreatAssessment> = new Map();
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private analysisResults: Map<string, AuditAnalysisResult> = new Map();
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSampleData();
    this.startContinuousAnalysis();
    console.log("[AIAuditLogAnalyzer] Service initialized");
  }

  private initializeSampleData(): void {
    const now = new Date();
    const sampleLogs: SecurityAuditLog[] = [
      {
        id: randomUUID(),
        userId: hashIdentifier("user-001"),
        profileId: null,
        eventType: "data_access",
        description: "Accessed patient records",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        platform: "web",
        appVersion: "1.0.0",
        source: "web_app",
        connectionId: null,
        syncId: null,
        metadata: { resourceType: "Patient", resourceId: "patient-123" },
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      {
        id: randomUUID(),
        userId: hashIdentifier("user-002"),
        profileId: null,
        eventType: "data_export",
        description: "Exported bulk patient data",
        ipAddress: "192.168.1.105",
        userAgent: "Mozilla/5.0",
        platform: "web",
        appVersion: "1.0.0",
        source: "web_app",
        connectionId: null,
        syncId: null,
        metadata: { recordCount: "500", exportFormat: "csv" },
        createdAt: new Date(now.getTime() - 1800000).toISOString(),
      },
      {
        id: randomUUID(),
        userId: hashIdentifier("user-003"),
        profileId: null,
        eventType: "account_locked",
        description: "Failed authentication attempt",
        ipAddress: "10.0.0.50",
        userAgent: "curl/7.68.0",
        platform: "web",
        appVersion: "1.0.0",
        source: "api",
        connectionId: null,
        syncId: null,
        metadata: { reason: "invalid_credentials", attemptCount: "5" },
        createdAt: new Date(now.getTime() - 900000).toISOString(),
      },
    ];

    sampleLogs.forEach(log => this.auditLogs.set(log.id, log));

    const sampleProfile: UserBehaviorProfile = {
      userId: hashIdentifier("user-001"),
      baselineEstablished: true,
      normalAccessHours: { start: 8, end: 18 },
      typicalResources: ["Patient", "Observation", "MedicationRequest"],
      averageSessionDuration: 45,
      typicalIpRanges: ["192.168.1.0/24"],
      accessFrequency: { daily: 25, weekly: 120, monthly: 480 },
      riskScore: 15,
      lastUpdated: now,
      anomalyHistory: [],
    };
    this.userProfiles.set(sampleProfile.userId, sampleProfile);
  }

  private startContinuousAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.runPeriodicAnalysis();
    }, 300000);
  }

  private async runPeriodicAnalysis(): Promise<void> {
    const recentLogs = Array.from(this.auditLogs.values()).filter(log => {
      const logTime = new Date(log.createdAt).getTime();
      return Date.now() - logTime < 300000;
    });

    if (recentLogs.length > 0) {
      await this.analyzeLogBatch(recentLogs);
    }
  }

  async ingestAuditLog(log: SecurityAuditLog): Promise<void> {
    this.auditLogs.set(log.id, log);
    await this.analyzeLogRealTime(log);
  }

  private async analyzeLogRealTime(log: SecurityAuditLog): Promise<SecurityAnomaly | null> {
    const userProfile = this.userProfiles.get(log.userId);
    const anomalies: PatternIndicator[] = [];

    if (userProfile?.baselineEstablished) {
      const logHour = new Date(log.createdAt).getHours();
      if (logHour < userProfile.normalAccessHours.start || logHour > userProfile.normalAccessHours.end) {
        anomalies.push({
          type: "time_based",
          value: logHour,
          baseline: `${userProfile.normalAccessHours.start}-${userProfile.normalAccessHours.end}`,
          deviation: Math.abs(logHour - (userProfile.normalAccessHours.start + userProfile.normalAccessHours.end) / 2),
          significance: logHour < 6 || logHour > 22 ? "high" : "medium",
        });
      }

      if (!this.isIpInRange(log.ipAddress, userProfile.typicalIpRanges)) {
        anomalies.push({
          type: "location_based",
          value: log.ipAddress,
          baseline: userProfile.typicalIpRanges.join(", "),
          deviation: 100,
          significance: "high",
        });
      }
    }

    if (log.eventType === "data_export") {
      const metadata = log.metadata as Record<string, unknown>;
      const recordCount = Number(metadata?.recordCount) || 0;
      if (recordCount > 100) {
        anomalies.push({
          type: "volume_based",
          value: recordCount,
          baseline: 50,
          deviation: ((recordCount - 50) / 50) * 100,
          significance: recordCount > 500 ? "critical" : recordCount > 200 ? "high" : "medium",
        });
      }
    }

    if (log.eventType === "account_locked") {
      const metadata = log.metadata as Record<string, unknown>;
      const attemptCount = Number(metadata?.attemptCount) || 0;
      if (attemptCount >= 3) {
        anomalies.push({
          type: "behavioral",
          value: attemptCount,
          baseline: 1,
          deviation: attemptCount * 100,
          significance: attemptCount >= 10 ? "critical" : attemptCount >= 5 ? "high" : "medium",
        });
      }
    }

    if (anomalies.length > 0) {
      const highestSeverity = this.getHighestSeverity(anomalies);
      const anomaly = await this.createAnomaly(log, anomalies, highestSeverity);
      
      if (highestSeverity === "critical" || highestSeverity === "high") {
        await this.triggerAlert(anomaly);
      }

      return anomaly;
    }

    return null;
  }

  private isIpInRange(ip: string, ranges: string[]): boolean {
    for (const range of ranges) {
      if (range.includes("/")) {
        const [network, bits] = range.split("/");
        const networkParts = network.split(".").map(Number);
        const ipParts = ip.split(".").map(Number);
        const mask = parseInt(bits, 10);
        
        if (mask >= 24) {
          if (networkParts.slice(0, 3).join(".") === ipParts.slice(0, 3).join(".")) {
            return true;
          }
        }
      } else if (range === ip) {
        return true;
      }
    }
    return false;
  }

  private getHighestSeverity(indicators: PatternIndicator[]): ComplianceRiskLevel {
    const severityOrder: ComplianceRiskLevel[] = ["info", "low", "medium", "high", "critical"];
    let highest: ComplianceRiskLevel = "info";
    
    for (const indicator of indicators) {
      const currentIndex = severityOrder.indexOf(indicator.significance as ComplianceRiskLevel);
      const highestIndex = severityOrder.indexOf(highest);
      if (currentIndex > highestIndex) {
        highest = indicator.significance as ComplianceRiskLevel;
      }
    }
    
    return highest;
  }

  private async createAnomaly(
    log: SecurityAuditLog,
    indicators: PatternIndicator[],
    severity: ComplianceRiskLevel
  ): Promise<SecurityAnomaly> {
    const anomalyTypes = indicators.map(i => i.type);
    const primaryType = this.determinePrimaryAnomalyType(anomalyTypes);

    let aiAnalysis = "AI analysis unavailable - using rule-based detection";
    
    if (aiEnabled) {
      try {
        const sanitizedContext = sanitizePhi(JSON.stringify({
          eventType: log.eventType,
          indicators: indicators.map(i => ({ type: i.type, deviation: i.deviation, significance: i.significance })),
        }));

        const text = await generatePhiSafeText({
          system: NO_CDS_AUDIT_ANALYZER_PROMPT,
          user: `Analyze this security anomaly and provide insights:\n${sanitizedContext}\n\nProvide a brief security assessment focusing on potential risks and recommended actions.`,
          maxTokens: 300,
          temperature: 0.3,
        });

        aiAnalysis = text || aiAnalysis;
      } catch (error) {
        console.error("[AIAuditLogAnalyzer] AI analysis failed:", error);
      }
    }

    const anomaly: SecurityAnomaly = {
      id: randomUUID(),
      anomalyType: primaryType,
      severity,
      description: this.generateAnomalyDescription(log, indicators),
      affectedUsers: [log.userId],
      affectedResources: this.extractResources(log),
      detectedAt: new Date(),
      evidenceCount: indicators.length,
      baselineComparison: indicators.map(i => ({
        metric: i.type,
        expected: typeof i.baseline === "number" ? i.baseline : 0,
        actual: typeof i.value === "number" ? i.value : 0,
        deviationPercent: i.deviation,
      })),
      aiAnalysis,
      status: "new",
    };

    this.anomalies.set(anomaly.id, anomaly);
    return anomaly;
  }

  private determinePrimaryAnomalyType(types: string[]): AnomalyType {
    const typeMap: Record<string, AnomalyType> = {
      "time_based": "time_based",
      "volume_based": "volume_based",
      "location_based": "location_based",
      "resource_based": "resource_based",
      "behavioral": "behavioral",
      "sequence_based": "sequence_based",
    };

    for (const t of types) {
      if (typeMap[t]) return typeMap[t];
    }
    return "behavioral";
  }

  private generateAnomalyDescription(log: SecurityAuditLog, indicators: PatternIndicator[]): string {
    const parts: string[] = [];
    
    for (const indicator of indicators) {
      switch (indicator.type) {
        case "time_based":
          parts.push(`Access at unusual hour (${indicator.value})`);
          break;
        case "volume_based":
          parts.push(`High volume activity (${indicator.value} records)`);
          break;
        case "location_based":
          parts.push(`Access from unexpected location`);
          break;
        case "behavioral":
          parts.push(`Abnormal behavior pattern detected`);
          break;
        default:
          parts.push(`Anomaly in ${indicator.type}`);
      }
    }

    return `${log.eventType}: ${parts.join("; ")}`;
  }

  private extractResources(log: SecurityAuditLog): string[] {
    const resources: string[] = [];
    const metadata = log.metadata as Record<string, unknown>;
    
    if (metadata?.resourceType) {
      resources.push(String(metadata.resourceType));
    }
    if (metadata?.resourceId) {
      resources.push(String(metadata.resourceId));
    }
    
    return resources;
  }

  private async triggerAlert(anomaly: SecurityAnomaly): Promise<void> {
    try {
      await automatedAlertingService.recordSecurityAnomaly(
        anomaly.anomalyType,
        anomaly.severity as "critical" | "high" | "medium" | "low",
        {
          userId: anomaly.affectedUsers[0],
          action: anomaly.description,
          reason: `Anomaly ID: ${anomaly.id}`,
        }
      );
    } catch (error) {
      console.error("[AIAuditLogAnalyzer] Failed to trigger alert:", error);
    }
  }

  async analyzeLogBatch(logs: SecurityAuditLog[]): Promise<AuditAnalysisResult> {
    const analysisId = randomUUID();
    const detectedPatterns: AccessPattern[] = [];
    const foundAnomalies: SecurityAnomaly[] = [];
    const identifiedThreats: ThreatAssessment[] = [];

    const userGroups = this.groupLogsByUser(logs);
    
    for (const [userId, userLogs] of Array.from(userGroups.entries())) {
      const pattern = await this.analyzeUserPattern(userId, userLogs);
      if (pattern.patternType !== "normal") {
        detectedPatterns.push(pattern);
      }

      for (const log of userLogs) {
        const anomaly = await this.analyzeLogRealTime(log);
        if (anomaly) {
          foundAnomalies.push(anomaly);
        }
      }
    }

    const threats = await this.detectThreats(logs, detectedPatterns, foundAnomalies);
    identifiedThreats.push(...threats);

    const riskScoreSummary = this.calculateRiskScoreSummary(detectedPatterns, foundAnomalies, identifiedThreats);

    let aiSummary = "Batch analysis completed with rule-based detection";
    const recommendations: string[] = [];

    if (aiEnabled && (foundAnomalies.length > 0 || identifiedThreats.length > 0)) {
      try {
        const sanitizedSummary = sanitizePhi(JSON.stringify({
          logsAnalyzed: logs.length,
          anomaliesFound: foundAnomalies.length,
          threatsIdentified: identifiedThreats.length,
          riskScore: riskScoreSummary.overall,
        }));

        const text = await generatePhiSafeText({
          system: NO_CDS_AUDIT_ANALYZER_PROMPT,
          user: `Provide an executive summary and recommendations for this audit analysis:\n${sanitizedSummary}`,
          maxTokens: 500,
          temperature: 0.3,
        });

        aiSummary = text || aiSummary;
      } catch (error) {
        console.error("[AIAuditLogAnalyzer] AI summary generation failed:", error);
      }
    }

    if (foundAnomalies.some(a => a.anomalyType === "time_based")) {
      recommendations.push("Review and tighten after-hours access policies");
    }
    if (foundAnomalies.some(a => a.anomalyType === "volume_based")) {
      recommendations.push("Implement data export rate limiting");
    }
    if (identifiedThreats.some(t => t.threatType === "brute_force")) {
      recommendations.push("Enable account lockout policies and strengthen MFA");
    }
    if (identifiedThreats.some(t => t.threatType === "data_exfiltration")) {
      recommendations.push("Review DLP policies and enhance data loss prevention controls");
    }

    const result: AuditAnalysisResult = {
      id: analysisId,
      analysisType: "batch",
      period: {
        start: new Date(Math.min(...logs.map(l => new Date(l.createdAt).getTime()))),
        end: new Date(Math.max(...logs.map(l => new Date(l.createdAt).getTime()))),
      },
      logsAnalyzed: logs.length,
      patternsDetected: detectedPatterns,
      anomaliesFound: foundAnomalies,
      threatsIdentified: identifiedThreats,
      riskScoreSummary,
      aiSummary,
      recommendations,
      alertsGenerated: foundAnomalies.filter(a => a.severity === "high" || a.severity === "critical").length,
      createdAt: new Date(),
    };

    this.analysisResults.set(result.id, result);
    return result;
  }

  private groupLogsByUser(logs: SecurityAuditLog[]): Map<string, SecurityAuditLog[]> {
    const groups = new Map<string, SecurityAuditLog[]>();
    
    for (const log of logs) {
      const existing = groups.get(log.userId) || [];
      existing.push(log);
      groups.set(log.userId, existing);
    }
    
    return groups;
  }

  private async analyzeUserPattern(userId: string, logs: SecurityAuditLog[]): Promise<AccessPattern> {
    const eventTypes = Array.from(new Set(logs.map(l => l.eventType)));
    const resources = Array.from(new Set(logs.flatMap(l => this.extractResources(l))));
    
    let patternType: "normal" | "suspicious" | "malicious" = "normal";
    let riskScore = 0;
    const indicators: PatternIndicator[] = [];

    const failedLogins = logs.filter(l => l.eventType === "account_locked").length;
    if (failedLogins > 5) {
      patternType = failedLogins > 10 ? "malicious" : "suspicious";
      riskScore += failedLogins * 10;
      indicators.push({
        type: "failed_auth",
        value: failedLogins,
        baseline: 1,
        deviation: failedLogins * 100,
        significance: failedLogins > 10 ? "critical" : "high",
      });
    }

    const exports = logs.filter(l => l.eventType === "data_export");
    const totalExported = exports.reduce((sum, l) => {
      const meta = l.metadata as Record<string, unknown>;
      return sum + (Number(meta?.recordCount) || 0);
    }, 0);
    
    if (totalExported > 500) {
      patternType = totalExported > 1000 ? "malicious" : "suspicious";
      riskScore += Math.min(totalExported / 10, 100);
      indicators.push({
        type: "bulk_export",
        value: totalExported,
        baseline: 100,
        deviation: ((totalExported - 100) / 100) * 100,
        significance: totalExported > 1000 ? "critical" : "high",
      });
    }

    const timestamps = logs.map(l => new Date(l.createdAt).getTime()).sort((a, b) => a - b);

    return {
      id: randomUUID(),
      userId,
      patternType,
      description: `User activity pattern: ${eventTypes.join(", ")}`,
      frequency: logs.length,
      timeWindow: {
        start: new Date(timestamps[0] || Date.now()),
        end: new Date(timestamps[timestamps.length - 1] || Date.now()),
      },
      resources,
      eventTypes,
      riskScore: Math.min(riskScore, 100),
      indicators,
      createdAt: new Date(),
    };
  }

  private async detectThreats(
    logs: SecurityAuditLog[],
    patterns: AccessPattern[],
    anomalies: SecurityAnomaly[]
  ): Promise<ThreatAssessment[]> {
    const threats: ThreatAssessment[] = [];

    const failedLogins = logs.filter(l => l.eventType === "account_locked");
    const failedByIp = new Map<string, number>();
    failedLogins.forEach(l => {
      failedByIp.set(l.ipAddress, (failedByIp.get(l.ipAddress) || 0) + 1);
    });

    for (const [ip, count] of Array.from(failedByIp.entries())) {
      if (count >= 5) {
        threats.push({
          id: randomUUID(),
          threatType: "brute_force",
          severity: count >= 15 ? "critical" : count >= 10 ? "high" : "medium",
          confidence: Math.min(0.5 + count * 0.05, 0.95),
          description: `Potential brute force attack from IP ${ip} with ${count} failed attempts`,
          indicators: [{
            id: randomUUID(),
            indicatorType: "failed_auth_count",
            value: String(count),
            context: `From IP: ${ip}`,
            weight: count >= 10 ? 1.0 : 0.7,
            source: "audit_logs",
          }],
          affectedUsers: Array.from(new Set(failedLogins.filter(l => l.ipAddress === ip).map(l => l.userId))),
          affectedSystems: ["authentication_service"],
          mitreTactics: ["TA0006 - Credential Access", "T1110 - Brute Force"],
          recommendedActions: [
            "Block or rate-limit the offending IP address",
            "Enable account lockout after failed attempts",
            "Review affected accounts for compromise",
            "Strengthen password policies and enable MFA",
          ],
          aiInsights: "Multiple failed authentication attempts detected indicating potential credential guessing or brute force attack",
          status: "active",
          detectedAt: new Date(),
        });
      }
    }

    const exportPatterns = patterns.filter(p => 
      p.indicators.some(i => i.type === "bulk_export" && (i.significance === "high" || i.significance === "critical"))
    );

    for (const pattern of exportPatterns) {
      threats.push({
        id: randomUUID(),
        threatType: "data_exfiltration",
        severity: pattern.patternType === "malicious" ? "critical" : "high",
        confidence: 0.7 + (pattern.riskScore / 100) * 0.25,
        description: `Potential data exfiltration detected for user ${pattern.userId}`,
        indicators: pattern.indicators.map(i => ({
          id: randomUUID(),
          indicatorType: i.type,
          value: String(i.value),
          context: `Baseline: ${i.baseline}`,
          weight: i.significance === "critical" ? 1.0 : 0.7,
          source: "access_patterns",
        })),
        affectedUsers: [pattern.userId],
        affectedSystems: ["data_export_service"],
        mitreTactics: ["TA0010 - Exfiltration", "T1567 - Exfiltration Over Web Service"],
        recommendedActions: [
          "Immediately suspend data export privileges for the user",
          "Review all recently exported data",
          "Conduct forensic analysis of user activity",
          "Notify security team and consider incident response",
        ],
        aiInsights: "Large volume data export pattern detected that exceeds normal baseline by significant margin",
        status: "active",
        detectedAt: new Date(),
      });
    }

    const locationAnomalies = anomalies.filter(a => a.anomalyType === "location_based" && a.severity !== "low");
    if (locationAnomalies.length > 0) {
      const affectedUsers = Array.from(new Set(locationAnomalies.flatMap(a => a.affectedUsers)));
      
      threats.push({
        id: randomUUID(),
        threatType: "session_hijacking",
        severity: locationAnomalies.some(a => a.severity === "critical") ? "critical" : "high",
        confidence: 0.6,
        description: `Suspicious access from unexpected locations for ${affectedUsers.length} user(s)`,
        indicators: locationAnomalies.map(a => ({
          id: randomUUID(),
          indicatorType: "location_anomaly",
          value: a.description,
          context: `Detected at: ${a.detectedAt.toISOString()}`,
          weight: a.severity === "critical" ? 1.0 : 0.7,
          source: "anomaly_detection",
        })),
        affectedUsers,
        affectedSystems: ["session_management"],
        mitreTactics: ["TA0001 - Initial Access", "T1078 - Valid Accounts"],
        recommendedActions: [
          "Force re-authentication for affected sessions",
          "Enable location-based access controls",
          "Verify with users about legitimate access",
          "Review session tokens for potential theft",
        ],
        aiInsights: "Access from unusual geographic locations may indicate compromised credentials or session tokens",
        status: "active",
        detectedAt: new Date(),
      });
    }

    for (const threat of threats) {
      this.threats.set(threat.id, threat);
      
      if (threat.severity === "critical" || threat.severity === "high") {
        await this.triggerThreatAlert(threat);
      }
    }

    return threats;
  }

  private async triggerThreatAlert(threat: ThreatAssessment): Promise<void> {
    try {
      await automatedAlertingService.recordSecurityAnomaly(
        threat.threatType,
        threat.severity as "critical" | "high" | "medium" | "low",
        {
          userId: threat.affectedUsers[0],
          action: `Threat: ${threat.description}`,
          reason: `Confidence: ${threat.confidence}, MITRE: ${threat.mitreTactics.join(", ")}`,
        }
      );
    } catch (error) {
      console.error("[AIAuditLogAnalyzer] Failed to trigger threat alert:", error);
    }
  }

  private calculateRiskScoreSummary(
    patterns: AccessPattern[],
    anomalies: SecurityAnomaly[],
    threats: ThreatAssessment[]
  ): { overall: number; byCategory: Record<string, number>; trend: "improving" | "stable" | "deteriorating" } {
    let overall = 0;
    const byCategory: Record<string, number> = {};

    for (const pattern of patterns) {
      overall += pattern.riskScore * 0.2;
      byCategory["access_patterns"] = (byCategory["access_patterns"] || 0) + pattern.riskScore;
    }

    const severityScores: Record<ComplianceRiskLevel, number> = {
      info: 5,
      low: 15,
      medium: 35,
      high: 60,
      critical: 100,
    };

    for (const anomaly of anomalies) {
      const score = severityScores[anomaly.severity] || 20;
      overall += score * 0.3;
      byCategory[anomaly.anomalyType] = (byCategory[anomaly.anomalyType] || 0) + score;
    }

    for (const threat of threats) {
      const score = severityScores[threat.severity] || 50;
      overall += score * 0.5;
      byCategory[threat.threatType] = (byCategory[threat.threatType] || 0) + score;
    }

    overall = Math.min(overall, 100);

    const trend = overall > 70 ? "deteriorating" : overall > 40 ? "stable" : "improving";

    return { overall: Math.round(overall), byCategory, trend };
  }

  async generatePolicyViolationAssessment(threat: ThreatAssessment): Promise<ComplianceRisk> {
    const categoryMap: Record<ThreatType, ComplianceRiskCategory> = {
      data_exfiltration: "data_export",
      unauthorized_access: "unauthorized_access",
      privilege_escalation: "unauthorized_access",
      insider_threat: "access_anomaly",
      brute_force: "unauthorized_access",
      session_hijacking: "unauthorized_access",
      reconnaissance: "access_anomaly",
      lateral_movement: "unauthorized_access",
      credential_abuse: "unauthorized_access",
      anomalous_behavior: "access_anomaly",
    };

    const risk: ComplianceRisk = {
      id: randomUUID(),
      category: categoryMap[threat.threatType] || "access_anomaly",
      level: threat.severity,
      regulations: ["HIPAA", "SOC2"],
      title: `Threat Detected: ${threat.threatType.replace(/_/g, " ").toUpperCase()}`,
      description: threat.description,
      evidence: [{
        type: "threat_indicators",
        count: threat.indicators.length,
        sampleDetails: threat.indicators.slice(0, 3).map(i => `${i.indicatorType}: ${i.value}`).join("; "),
        timeRange: {
          start: threat.detectedAt.toISOString(),
          end: new Date().toISOString(),
        },
      }],
      affectedSystems: threat.affectedSystems,
      detectedAt: threat.detectedAt.toISOString(),
      status: "open",
      remediationSuggestions: threat.recommendedActions,
      aiAnalysis: threat.aiInsights,
    };

    return risk;
  }

  getAnomalies(filters?: { status?: string; severity?: string; type?: string }): SecurityAnomaly[] {
    let results = Array.from(this.anomalies.values());
    
    if (filters?.status) {
      results = results.filter(a => a.status === filters.status);
    }
    if (filters?.severity) {
      results = results.filter(a => a.severity === filters.severity);
    }
    if (filters?.type) {
      results = results.filter(a => a.anomalyType === filters.type);
    }
    
    return results.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  getThreats(filters?: { status?: string; severity?: string; type?: string }): ThreatAssessment[] {
    let results = Array.from(this.threats.values());
    
    if (filters?.status) {
      results = results.filter(t => t.status === filters.status);
    }
    if (filters?.severity) {
      results = results.filter(t => t.severity === filters.severity);
    }
    if (filters?.type) {
      results = results.filter(t => t.threatType === filters.type);
    }
    
    return results.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  getAnalysisResults(): AuditAnalysisResult[] {
    return Array.from(this.analysisResults.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getUserProfile(userId: string): UserBehaviorProfile | undefined {
    return this.userProfiles.get(userId);
  }

  async updateAnomalyStatus(
    anomalyId: string,
    status: SecurityAnomaly["status"],
    notes?: string
  ): Promise<SecurityAnomaly | null> {
    const anomaly = this.anomalies.get(anomalyId);
    if (!anomaly) return null;

    anomaly.status = status;
    if (status === "resolved" || status === "false_positive") {
      anomaly.resolvedAt = new Date();
      anomaly.resolutionNotes = notes;
    }

    this.anomalies.set(anomalyId, anomaly);
    return anomaly;
  }

  async updateThreatStatus(
    threatId: string,
    status: ThreatAssessment["status"]
  ): Promise<ThreatAssessment | null> {
    const threat = this.threats.get(threatId);
    if (!threat) return null;

    threat.status = status;
    const now = new Date();
    
    if (status === "contained") {
      threat.containedAt = now;
    } else if (status === "remediated" || status === "false_positive") {
      threat.remediatedAt = now;
    }

    this.threats.set(threatId, threat);
    return threat;
  }

  async runHistoricalAnalysis(
    startDate: Date,
    endDate: Date
  ): Promise<AuditAnalysisResult> {
    const logs = Array.from(this.auditLogs.values()).filter(log => {
      const logTime = new Date(log.createdAt).getTime();
      return logTime >= startDate.getTime() && logTime <= endDate.getTime();
    });

    const result = await this.analyzeLogBatch(logs);
    result.analysisType = "historical";
    
    return result;
  }

  getDashboardMetrics(): {
    totalAnomalies: number;
    activeThreats: number;
    riskScore: number;
    recentAlerts: number;
    byCategory: Record<string, number>;
  } {
    const anomalies = Array.from(this.anomalies.values());
    const threats = Array.from(this.threats.values());
    
    const activeThreats = threats.filter(t => t.status === "active").length;
    const recentAnomalies = anomalies.filter(a => {
      const hourAgo = Date.now() - 3600000;
      return a.detectedAt.getTime() > hourAgo;
    }).length;

    const byCategory: Record<string, number> = {};
    anomalies.forEach(a => {
      byCategory[a.anomalyType] = (byCategory[a.anomalyType] || 0) + 1;
    });
    threats.forEach(t => {
      byCategory[t.threatType] = (byCategory[t.threatType] || 0) + 1;
    });

    let riskScore = 0;
    if (anomalies.length > 0 || threats.length > 0) {
      const summary = this.calculateRiskScoreSummary([], anomalies, threats);
      riskScore = summary.overall;
    }

    return {
      totalAnomalies: anomalies.length,
      activeThreats,
      riskScore,
      recentAlerts: recentAnomalies,
      byCategory,
    };
  }
}

export const aiAuditLogAnalyzerService = new AIAuditLogAnalyzerService();
