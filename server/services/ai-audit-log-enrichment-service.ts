import { generatePhiSafeText } from "./ai-gateway";
import {
  AuditEntry,
  AuditActionCategory,
  AuditActionType,
  comprehensiveAuditTrailService
} from "./comprehensive-audit-trail-service";

const NO_CDS_COMPLIANCE = `CRITICAL COMPLIANCE NOTICE: This AI-driven audit log enrichment tool is for SECURITY MONITORING, COMPLIANCE AUDITING, and OPERATIONAL purposes ONLY. It does NOT provide clinical decision support, treatment recommendations, or medical advice. All flagged anomalies and risk assessments must be reviewed by qualified security personnel before action.`;

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type AnomalyType = 
  | "unusual_access_time"
  | "high_volume_access"
  | "sensitive_data_access"
  | "unauthorized_attempt"
  | "privilege_escalation"
  | "data_exfiltration"
  | "geographic_anomaly"
  | "pattern_deviation"
  | "bulk_export"
  | "phi_access_pattern";

export interface SensitiveDataPattern {
  id: string;
  name: string;
  description: string;
  category: "phi" | "pii" | "financial" | "credentials" | "clinical";
  indicators: string[];
  riskWeight: number;
}

export interface AnomalyFlag {
  id: string;
  type: AnomalyType;
  severity: RiskLevel;
  description: string;
  confidence: number;
  indicators: string[];
  recommendation: string;
}

export interface EnrichedAuditLog extends AuditEntry {
  enrichment: {
    enrichedAt: string;
    riskScore: number;
    riskLevel: RiskLevel;
    sensitiveDataPatterns: SensitiveDataPattern[];
    anomalyFlags: AnomalyFlag[];
    aiAnalysis: {
      summary: string;
      patterns: string[];
      recommendations: string[];
      complianceNotes: string[];
    };
    accessContext: {
      isAfterHours: boolean;
      isHighVolumeSession: boolean;
      accessedSensitiveResources: boolean;
      unusualBehavior: boolean;
    };
    noCdsCompliance: string;
  };
}

export interface EnrichmentStatistics {
  totalEnriched: number;
  byRiskLevel: Record<RiskLevel, number>;
  byAnomalyType: Record<AnomalyType, number>;
  averageRiskScore: number;
  sensitiveAccessCount: number;
  flaggedCount: number;
  timeRange: { start: string; end: string };
}

export interface EnrichmentFilter {
  startDate?: string;
  endDate?: string;
  riskLevel?: RiskLevel[];
  anomalyTypes?: AnomalyType[];
  minRiskScore?: number;
  maxRiskScore?: number;
  userId?: string;
  category?: AuditActionCategory;
  onlyFlagged?: boolean;
  limit?: number;
  offset?: number;
}

const SENSITIVE_DATA_PATTERNS: SensitiveDataPattern[] = [
  {
    id: "phi-patient-record",
    name: "Patient Health Information",
    description: "Access to protected health information including diagnoses, treatments, and medical history",
    category: "phi",
    indicators: ["Patient", "Condition", "Observation", "MedicationRequest", "DiagnosticReport", "Procedure"],
    riskWeight: 0.8
  },
  {
    id: "phi-ssn",
    name: "Social Security Number",
    description: "Access to SSN identifiers",
    category: "pii",
    indicators: ["ssn", "social-security", "identifier"],
    riskWeight: 0.9
  },
  {
    id: "phi-demographics",
    name: "Patient Demographics",
    description: "Access to demographic information",
    category: "pii",
    indicators: ["birthDate", "address", "telecom", "contact"],
    riskWeight: 0.5
  },
  {
    id: "clinical-diagnosis",
    name: "Clinical Diagnosis",
    description: "Access to diagnostic codes and conditions",
    category: "clinical",
    indicators: ["ICD-10", "SNOMED", "Condition", "diagnosis"],
    riskWeight: 0.7
  },
  {
    id: "financial-billing",
    name: "Financial/Billing Information",
    description: "Access to insurance and billing data",
    category: "financial",
    indicators: ["Claim", "Coverage", "Account", "ChargeItem", "Invoice"],
    riskWeight: 0.6
  },
  {
    id: "credentials-auth",
    name: "Authentication Credentials",
    description: "Access to authentication or credential data",
    category: "credentials",
    indicators: ["password", "token", "credential", "secret", "key"],
    riskWeight: 1.0
  }
];

class AIAuditLogEnrichmentService {
  private aiEnabled: boolean = true;
  private enrichedLogs: Map<string, EnrichedAuditLog> = new Map();
  private userAccessPatterns: Map<string, { timestamps: number[]; resources: string[]; actions: string[] }> = new Map();

  constructor() {
    console.log("[AIAuditLogEnrichment] PHI-safe AI gateway available for AI analysis");

    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleLogs: AuditEntry[] = [
      {
        id: "audit-001",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        who: {
          userId: "user-001",
          userRole: "nurse",
          userName: "Sarah Johnson",
          userEmail: "sarah.johnson@hospital.org",
          ipAddress: "192.168.1.100",
          sessionId: "session-abc123"
        },
        what: {
          category: "patient_record",
          action: "read",
          resourceType: "Patient",
          resourceId: "patient-12345",
          description: "Viewed patient demographics and recent conditions"
        },
        when: {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          timezone: "UTC",
          epochMs: Date.now() - 3600000
        },
        why: {
          reason: "Patient care",
          businessJustification: "Scheduled appointment review"
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 45
        },
        context: { environment: "production" },
        severity: "info",
        tags: ["patient-care", "routine"],
        phiAccessed: true
      },
      {
        id: "audit-002",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        who: {
          userId: "user-002",
          userRole: "admin",
          userName: "Mike Chen",
          userEmail: "mike.chen@hospital.org",
          ipAddress: "10.0.0.50",
          sessionId: "session-xyz789"
        },
        what: {
          category: "export",
          action: "export",
          resourceType: "Patient",
          resourceId: "bulk-export-001",
          description: "Bulk export of 500 patient records"
        },
        when: {
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          timezone: "UTC",
          epochMs: Date.now() - 1800000
        },
        why: {
          reason: "Compliance audit",
          businessJustification: "Annual HIPAA compliance review"
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 15000
        },
        context: { environment: "production" },
        severity: "warning",
        tags: ["bulk-export", "compliance"],
        phiAccessed: true
      },
      {
        id: "audit-003",
        timestamp: new Date(Date.now() - 900000).toISOString(),
        who: {
          userId: "user-003",
          userRole: "physician",
          userName: "Dr. Emily Rodriguez",
          userEmail: "emily.rodriguez@hospital.org",
          ipAddress: "172.16.0.25",
          sessionId: "session-def456"
        },
        what: {
          category: "patient_record",
          action: "update",
          resourceType: "MedicationRequest",
          resourceId: "medrx-67890",
          description: "Updated medication dosage for patient",
          changes: [
            { field: "dosage", oldValue: "10mg", newValue: "20mg" }
          ]
        },
        when: {
          timestamp: new Date(Date.now() - 900000).toISOString(),
          timezone: "UTC",
          epochMs: Date.now() - 900000
        },
        why: {
          reason: "Treatment adjustment",
          businessJustification: "Patient response to initial dosage"
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 120
        },
        context: { environment: "production" },
        severity: "info",
        tags: ["medication", "treatment"],
        phiAccessed: true
      },
      {
        id: "audit-004",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        who: {
          userId: "user-unknown",
          userRole: "unknown",
          ipAddress: "203.0.113.50",
          sessionId: "session-unknown"
        },
        what: {
          category: "access_control",
          action: "login",
          resourceType: "Authentication",
          description: "Failed login attempt - invalid credentials"
        },
        when: {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          timezone: "UTC",
          epochMs: Date.now() - 7200000
        },
        why: {},
        result: {
          success: false,
          statusCode: 401,
          errorMessage: "Invalid credentials",
          duration_ms: 50
        },
        context: { environment: "production" },
        severity: "warning",
        tags: ["security", "failed-login"],
        phiAccessed: false
      },
      {
        id: "audit-005",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        who: {
          userId: "user-004",
          userRole: "billing",
          userName: "Tom Wilson",
          userEmail: "tom.wilson@hospital.org",
          ipAddress: "192.168.2.200",
          sessionId: "session-ghi012"
        },
        what: {
          category: "patient_record",
          action: "read",
          resourceType: "DiagnosticReport",
          resourceId: "report-11111",
          description: "Accessed diagnostic reports outside billing scope"
        },
        when: {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          timezone: "UTC",
          epochMs: Date.now() - 300000
        },
        why: {
          reason: "Billing verification"
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 80
        },
        context: { environment: "production" },
        severity: "warning",
        tags: ["billing", "cross-department"],
        phiAccessed: true
      }
    ];

    for (const log of sampleLogs) {
      this.enrichLog(log).then(enriched => {
        this.enrichedLogs.set(enriched.id, enriched);
      });
    }

    console.log("[AIAuditLogEnrichment] Sample data initialized");
    console.log(`[AIAuditLogEnrichment] Enriched logs: ${sampleLogs.length}`);
  }

  getMetadata() {
    return {
      serviceName: "AI Audit Log Enrichment",
      version: "1.0.0",
      description: "AI-powered audit log enrichment with sensitive data pattern detection, anomaly flagging, and risk scoring",
      capabilities: [
        "Automatic sensitive data access pattern identification",
        "Anomalous activity detection and flagging",
        "Risk score calculation for each log entry",
        "AI-powered behavior analysis",
        "HIPAA compliance monitoring",
        "Real-time enrichment of audit logs"
      ],
      riskLevels: ["low", "medium", "high", "critical"],
      anomalyTypes: [
        "unusual_access_time",
        "high_volume_access",
        "sensitive_data_access",
        "unauthorized_attempt",
        "privilege_escalation",
        "data_exfiltration",
        "geographic_anomaly",
        "pattern_deviation",
        "bulk_export",
        "phi_access_pattern"
      ],
      noCdsCompliance: NO_CDS_COMPLIANCE
    };
  }

  private detectSensitiveDataPatterns(log: AuditEntry): SensitiveDataPattern[] {
    const detectedPatterns: SensitiveDataPattern[] = [];
    const logContent = JSON.stringify(log).toLowerCase();

    for (const pattern of SENSITIVE_DATA_PATTERNS) {
      const matchedIndicators = pattern.indicators.filter(indicator => 
        logContent.includes(indicator.toLowerCase())
      );

      if (matchedIndicators.length > 0) {
        detectedPatterns.push({
          ...pattern,
          indicators: matchedIndicators
        });
      }
    }

    return detectedPatterns;
  }

  private detectAnomalies(log: AuditEntry): AnomalyFlag[] {
    const anomalies: AnomalyFlag[] = [];
    const hour = new Date(log.timestamp).getHours();

    if (hour < 6 || hour > 22) {
      anomalies.push({
        id: `anomaly-${log.id}-time`,
        type: "unusual_access_time",
        severity: "medium",
        description: "Access occurred outside normal business hours",
        confidence: 0.85,
        indicators: [`Access at ${hour}:00 hours`],
        recommendation: "Verify if this access was authorized for after-hours work"
      });
    }

    if (log.what.action === "export" && log.what.description?.toLowerCase().includes("bulk")) {
      anomalies.push({
        id: `anomaly-${log.id}-bulk`,
        type: "bulk_export",
        severity: "high",
        description: "Bulk data export detected",
        confidence: 0.95,
        indicators: ["Bulk export operation", log.what.resourceType],
        recommendation: "Review export justification and verify data handling procedures"
      });
    }

    if (!log.result.success && log.what.category === "access_control") {
      anomalies.push({
        id: `anomaly-${log.id}-auth`,
        type: "unauthorized_attempt",
        severity: "high",
        description: "Failed authentication or authorization attempt",
        confidence: 0.9,
        indicators: [log.result.errorMessage || "Access denied"],
        recommendation: "Investigate source of failed attempt and consider security measures"
      });
    }

    if (log.phiAccessed && log.who.userRole === "billing" && 
        ["DiagnosticReport", "Condition", "Procedure"].includes(log.what.resourceType)) {
      anomalies.push({
        id: `anomaly-${log.id}-scope`,
        type: "sensitive_data_access",
        severity: "medium",
        description: "Access to clinical data by non-clinical role",
        confidence: 0.75,
        indicators: [`${log.who.userRole} accessing ${log.what.resourceType}`],
        recommendation: "Verify access is within role scope and has proper authorization"
      });
    }

    const userPattern = this.userAccessPatterns.get(log.who.userId);
    if (userPattern) {
      const recentAccesses = userPattern.timestamps.filter(t => 
        Date.now() - t < 3600000
      ).length;

      if (recentAccesses > 50) {
        anomalies.push({
          id: `anomaly-${log.id}-volume`,
          type: "high_volume_access",
          severity: "high",
          description: "Unusually high volume of access requests",
          confidence: 0.8,
          indicators: [`${recentAccesses} accesses in the last hour`],
          recommendation: "Review if this volume is justified by work requirements"
        });
      }
    }

    return anomalies;
  }

  private calculateRiskScore(
    log: AuditEntry, 
    patterns: SensitiveDataPattern[], 
    anomalies: AnomalyFlag[]
  ): { score: number; level: RiskLevel } {
    let score = 0;

    for (const pattern of patterns) {
      score += pattern.riskWeight * 20;
    }

    for (const anomaly of anomalies) {
      const severityMultiplier = {
        low: 5,
        medium: 15,
        high: 25,
        critical: 40
      };
      score += severityMultiplier[anomaly.severity] * anomaly.confidence;
    }

    if (!log.result.success) {
      score += 10;
    }

    if (log.phiAccessed) {
      score += 15;
    }

    if (log.severity === "warning") score += 5;
    if (log.severity === "error") score += 15;
    if (log.severity === "critical") score += 30;

    score = Math.min(100, Math.max(0, score));

    let level: RiskLevel;
    if (score >= 75) level = "critical";
    else if (score >= 50) level = "high";
    else if (score >= 25) level = "medium";
    else level = "low";

    return { score: Math.round(score * 10) / 10, level };
  }

  private updateUserPattern(log: AuditEntry): void {
    const userId = log.who.userId;
    if (!userId) return;

    const pattern = this.userAccessPatterns.get(userId) || {
      timestamps: [],
      resources: [],
      actions: []
    };

    pattern.timestamps.push(new Date(log.timestamp).getTime());
    pattern.resources.push(log.what.resourceType);
    pattern.actions.push(log.what.action);

    pattern.timestamps = pattern.timestamps.filter(t => Date.now() - t < 86400000);
    if (pattern.resources.length > 1000) pattern.resources = pattern.resources.slice(-1000);
    if (pattern.actions.length > 1000) pattern.actions = pattern.actions.slice(-1000);

    this.userAccessPatterns.set(userId, pattern);
  }

  async enrichLog(log: AuditEntry): Promise<EnrichedAuditLog> {
    this.updateUserPattern(log);

    const sensitivePatterns = this.detectSensitiveDataPatterns(log);
    const anomalies = this.detectAnomalies(log);
    const { score, level } = this.calculateRiskScore(log, sensitivePatterns, anomalies);

    const hour = new Date(log.timestamp).getHours();
    const userPattern = this.userAccessPatterns.get(log.who.userId);

    let aiAnalysis = {
      summary: this.generateRuleSummary(log, sensitivePatterns, anomalies),
      patterns: sensitivePatterns.map(p => p.name),
      recommendations: anomalies.map(a => a.recommendation),
      complianceNotes: this.generateComplianceNotes(log, sensitivePatterns)
    };

    if (this.aiEnabled && (level === "high" || level === "critical")) {
      try {
        aiAnalysis = await this.generateAIAnalysis(log, sensitivePatterns, anomalies);
      } catch (error) {
        console.error("[AIAuditLogEnrichment] AI analysis failed, using rule-based:", error);
      }
    }

    return {
      ...log,
      enrichment: {
        enrichedAt: new Date().toISOString(),
        riskScore: score,
        riskLevel: level,
        sensitiveDataPatterns: sensitivePatterns,
        anomalyFlags: anomalies,
        aiAnalysis,
        accessContext: {
          isAfterHours: hour < 6 || hour > 22,
          isHighVolumeSession: (userPattern?.timestamps.filter(t => Date.now() - t < 3600000).length || 0) > 50,
          accessedSensitiveResources: sensitivePatterns.length > 0,
          unusualBehavior: anomalies.length > 0
        },
        noCdsCompliance: NO_CDS_COMPLIANCE
      }
    };
  }

  private generateRuleSummary(
    log: AuditEntry, 
    patterns: SensitiveDataPattern[], 
    anomalies: AnomalyFlag[]
  ): string {
    const parts: string[] = [];

    parts.push(`${log.who.userName || log.who.userId} (${log.who.userRole}) performed ${log.what.action} on ${log.what.resourceType}`);

    if (patterns.length > 0) {
      parts.push(`Accessed sensitive data: ${patterns.map(p => p.name).join(", ")}`);
    }

    if (anomalies.length > 0) {
      parts.push(`Flagged anomalies: ${anomalies.map(a => a.type.replace(/_/g, " ")).join(", ")}`);
    }

    if (!log.result.success) {
      parts.push(`Operation failed: ${log.result.errorMessage || "Unknown error"}`);
    }

    return parts.join(". ");
  }

  private generateComplianceNotes(log: AuditEntry, patterns: SensitiveDataPattern[]): string[] {
    const notes: string[] = [];

    if (log.phiAccessed) {
      notes.push("HIPAA: PHI access logged and requires retention per 45 CFR 164.530(j)");
    }

    if (patterns.some(p => p.category === "phi")) {
      notes.push("HIPAA: Access to protected health information - verify minimum necessary standard");
    }

    if (log.what.action === "export") {
      notes.push("HIPAA: Data export requires BAA compliance verification for recipients");
    }

    if (!log.result.success && log.what.category === "access_control") {
      notes.push("Security: Failed access attempts must be monitored per HIPAA Security Rule");
    }

    return notes;
  }

  private async generateAIAnalysis(
    log: AuditEntry,
    patterns: SensitiveDataPattern[],
    anomalies: AnomalyFlag[]
  ): Promise<{
    summary: string;
    patterns: string[];
    recommendations: string[];
    complianceNotes: string[];
  }> {
    if (!this.aiEnabled) {
      return {
        summary: this.generateRuleSummary(log, patterns, anomalies),
        patterns: patterns.map(p => p.name),
        recommendations: anomalies.map(a => a.recommendation),
        complianceNotes: this.generateComplianceNotes(log, patterns)
      };
    }

    const prompt = `Analyze this healthcare audit log entry for security and compliance concerns.

AUDIT LOG:
- User: ${log.who.userName || log.who.userId} (Role: ${log.who.userRole})
- Action: ${log.what.action} on ${log.what.resourceType}
- Description: ${log.what.description}
- Success: ${log.result.success}
- PHI Accessed: ${log.phiAccessed}
- Timestamp: ${log.timestamp}

DETECTED PATTERNS:
${patterns.map(p => `- ${p.name}: ${p.description}`).join("\n")}

DETECTED ANOMALIES:
${anomalies.map(a => `- ${a.type}: ${a.description} (Severity: ${a.severity})`).join("\n")}

Provide a JSON response with:
1. summary: Brief 1-2 sentence analysis of the security/compliance implications
2. patterns: Array of identified data access patterns
3. recommendations: Array of actionable security recommendations
4. complianceNotes: Array of relevant HIPAA/SOC2 compliance considerations

IMPORTANT: This is for SECURITY MONITORING and COMPLIANCE AUDITING only, NOT for clinical decision-making.`;

    try {
      const content = await generatePhiSafeText({
        system: "You are a healthcare security and compliance analyst specializing in HIPAA and SOC2 auditing. Provide concise, actionable analysis for security teams. Never provide clinical or medical advice.",
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 1000
      });

      if (content) {
        const parsed = JSON.parse(content);
        return {
          summary: parsed.summary || this.generateRuleSummary(log, patterns, anomalies),
          patterns: parsed.patterns || patterns.map(p => p.name),
          recommendations: parsed.recommendations || anomalies.map(a => a.recommendation),
          complianceNotes: parsed.complianceNotes || this.generateComplianceNotes(log, patterns)
        };
      }
    } catch (error) {
      console.error("[AIAuditLogEnrichment] AI analysis error:", error);
    }

    return {
      summary: this.generateRuleSummary(log, patterns, anomalies),
      patterns: patterns.map(p => p.name),
      recommendations: anomalies.map(a => a.recommendation),
      complianceNotes: this.generateComplianceNotes(log, patterns)
    };
  }

  async getEnrichedLogs(filter: EnrichmentFilter = {}): Promise<EnrichedAuditLog[]> {
    let logs = Array.from(this.enrichedLogs.values());

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= end);
    }

    if (filter.riskLevel && filter.riskLevel.length > 0) {
      logs = logs.filter(l => filter.riskLevel!.includes(l.enrichment.riskLevel));
    }

    if (filter.anomalyTypes && filter.anomalyTypes.length > 0) {
      logs = logs.filter(l => 
        l.enrichment.anomalyFlags.some(a => filter.anomalyTypes!.includes(a.type))
      );
    }

    if (filter.minRiskScore !== undefined) {
      logs = logs.filter(l => l.enrichment.riskScore >= filter.minRiskScore!);
    }

    if (filter.maxRiskScore !== undefined) {
      logs = logs.filter(l => l.enrichment.riskScore <= filter.maxRiskScore!);
    }

    if (filter.userId) {
      logs = logs.filter(l => l.who.userId === filter.userId);
    }

    if (filter.category) {
      logs = logs.filter(l => l.what.category === filter.category);
    }

    if (filter.onlyFlagged) {
      logs = logs.filter(l => l.enrichment.anomalyFlags.length > 0);
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    return logs.slice(offset, offset + limit);
  }

  async getEnrichedLog(id: string): Promise<EnrichedAuditLog | null> {
    return this.enrichedLogs.get(id) || null;
  }

  async enrichAndStore(log: AuditEntry): Promise<EnrichedAuditLog> {
    const enriched = await this.enrichLog(log);
    this.enrichedLogs.set(enriched.id, enriched);
    return enriched;
  }

  async getStatistics(filter: EnrichmentFilter = {}): Promise<EnrichmentStatistics> {
    const logs = await this.getEnrichedLogs({ ...filter, limit: 10000 });

    const byRiskLevel: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byAnomalyType: Record<AnomalyType, number> = {
      unusual_access_time: 0,
      high_volume_access: 0,
      sensitive_data_access: 0,
      unauthorized_attempt: 0,
      privilege_escalation: 0,
      data_exfiltration: 0,
      geographic_anomaly: 0,
      pattern_deviation: 0,
      bulk_export: 0,
      phi_access_pattern: 0
    };

    let totalRiskScore = 0;
    let sensitiveAccessCount = 0;
    let flaggedCount = 0;

    for (const log of logs) {
      byRiskLevel[log.enrichment.riskLevel]++;
      totalRiskScore += log.enrichment.riskScore;

      if (log.enrichment.sensitiveDataPatterns.length > 0) {
        sensitiveAccessCount++;
      }

      if (log.enrichment.anomalyFlags.length > 0) {
        flaggedCount++;
        for (const anomaly of log.enrichment.anomalyFlags) {
          byAnomalyType[anomaly.type]++;
        }
      }
    }

    const timestamps = logs.map(l => new Date(l.timestamp).getTime());

    return {
      totalEnriched: logs.length,
      byRiskLevel,
      byAnomalyType,
      averageRiskScore: logs.length > 0 ? Math.round((totalRiskScore / logs.length) * 10) / 10 : 0,
      sensitiveAccessCount,
      flaggedCount,
      timeRange: {
        start: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString(),
        end: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString()
      }
    };
  }

  async analyzeUserBehavior(userId: string): Promise<{
    userId: string;
    accessCount: number;
    riskProfile: {
      averageRiskScore: number;
      highRiskCount: number;
      anomalyTypes: AnomalyType[];
    };
    accessPatterns: {
      commonResources: string[];
      commonActions: string[];
      peakHours: number[];
    };
    recommendations: string[];
    noCdsCompliance: string;
  }> {
    const userLogs = await this.getEnrichedLogs({ userId, limit: 1000 });
    const pattern = this.userAccessPatterns.get(userId);

    const riskScores = userLogs.map(l => l.enrichment.riskScore);
    const anomalyTypes = new Set<AnomalyType>();
    userLogs.forEach(l => l.enrichment.anomalyFlags.forEach(a => anomalyTypes.add(a.type)));

    const resourceCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};

    userLogs.forEach(l => {
      resourceCounts[l.what.resourceType] = (resourceCounts[l.what.resourceType] || 0) + 1;
      actionCounts[l.what.action] = (actionCounts[l.what.action] || 0) + 1;
      const hour = new Date(l.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const recommendations: string[] = [];
    const avgRisk = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;

    if (avgRisk > 50) {
      recommendations.push("User shows elevated risk profile - consider additional monitoring");
    }

    if (anomalyTypes.has("unusual_access_time")) {
      recommendations.push("Frequent after-hours access detected - verify work schedule alignment");
    }

    if (anomalyTypes.has("high_volume_access")) {
      recommendations.push("High volume access patterns - review access justification");
    }

    return {
      userId,
      accessCount: userLogs.length,
      riskProfile: {
        averageRiskScore: Math.round(avgRisk * 10) / 10,
        highRiskCount: userLogs.filter(l => l.enrichment.riskLevel === "high" || l.enrichment.riskLevel === "critical").length,
        anomalyTypes: Array.from(anomalyTypes)
      },
      accessPatterns: {
        commonResources: Object.entries(resourceCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([r]) => r),
        commonActions: Object.entries(actionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([a]) => a),
        peakHours: Object.entries(hourCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([h]) => parseInt(h))
      },
      recommendations,
      noCdsCompliance: NO_CDS_COMPLIANCE
    };
  }

  async getHighRiskAlerts(limit: number = 10): Promise<EnrichedAuditLog[]> {
    return this.getEnrichedLogs({
      riskLevel: ["high", "critical"],
      limit
    });
  }
}

export const aiAuditLogEnrichmentService = new AIAuditLogEnrichmentService();
