import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { storage } from "../storage";
import { automatedAlertingService } from "./automated-alerting";
import type {
  ComplianceRegulation,
  ComplianceRiskLevel,
  ComplianceRiskCategory,
  ComplianceRiskStatus,
  ComplianceRisk,
  ComplianceMetric,
  ComplianceReport,
  ComplianceRuleConfig,
  SecurityAuditLog,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizeEvidenceDetails(details: string): string {
  let sanitized = details;
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****");
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]");
  sanitized = sanitized.replace(/\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]");
  sanitized = sanitized.replace(/\b(?:user|patient|profile)[-_]?id[=:\s]+[a-zA-Z0-9-]+/gi, "[ID_REDACTED]");
  sanitized = sanitized.replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, "[UUID]");
  return sanitized;
}

const RISK_LEVEL_ORDER: Record<ComplianceRiskLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const riskStore = new Map<string, ComplianceRisk>();
const reportStore = new Map<string, ComplianceReport>();
const ruleConfigStore = new Map<string, ComplianceRuleConfig>();
const metricsHistory: Map<string, { value: number; timestamp: string }[]> = new Map();

function initializeDefaultRules(): void {
  const defaultRules: Omit<ComplianceRuleConfig, "id" | "createdAt" | "updatedAt">[] = [
    {
      name: "After-Hours PHI Access",
      description: "Detects PHI access outside normal business hours (6 AM - 10 PM)",
      enabled: true,
      regulation: "HIPAA",
      category: "access_anomaly",
      severity: "medium",
      conditions: [
        { metric: "after_hours_access_count", operator: ">", threshold: 5, timeWindowMinutes: 60 },
      ],
      remediationSteps: [
        "Review after-hours access patterns",
        "Verify legitimate business need for access",
        "Consider implementing access time restrictions",
        "Document approved after-hours access justifications",
      ],
    },
    {
      name: "Excessive PHI Export",
      description: "Detects unusually high volume of data exports",
      enabled: true,
      regulation: "HIPAA",
      category: "data_export",
      severity: "high",
      conditions: [
        { metric: "export_volume_mb", operator: ">", threshold: 100, timeWindowMinutes: 60 },
        { metric: "export_count", operator: ">", threshold: 20, timeWindowMinutes: 60 },
      ],
      remediationSteps: [
        "Investigate export activity for potential data exfiltration",
        "Verify user authorization for bulk exports",
        "Review export destination and purpose",
        "Consider implementing export rate limits",
      ],
    },
    {
      name: "Failed Authentication Spike",
      description: "Detects unusual number of failed login attempts",
      enabled: true,
      regulation: "HIPAA",
      category: "unauthorized_access",
      severity: "critical",
      conditions: [
        { metric: "failed_auth_attempts", operator: ">", threshold: 10, timeWindowMinutes: 15 },
      ],
      remediationSteps: [
        "Investigate source IP addresses for brute force attempts",
        "Consider temporary account lockout",
        "Verify account credentials haven't been compromised",
        "Enable or strengthen MFA requirements",
      ],
    },
    {
      name: "Missing Consent Records",
      description: "Detects data access without valid consent on record",
      enabled: true,
      regulation: "GDPR",
      category: "consent_violation",
      severity: "high",
      conditions: [
        { metric: "access_without_consent_count", operator: ">", threshold: 0, timeWindowMinutes: 1440 },
      ],
      remediationSteps: [
        "Collect missing consent from affected patients",
        "Review consent collection workflow",
        "Implement consent verification checks before data access",
        "Document legitimate bases for processing where applicable",
      ],
    },
    {
      name: "Data Retention Violation",
      description: "Detects records retained beyond allowed retention period",
      enabled: true,
      regulation: "GDPR",
      category: "data_retention",
      severity: "medium",
      conditions: [
        { metric: "overdue_retention_count", operator: ">", threshold: 0, timeWindowMinutes: 10080 },
      ],
      remediationSteps: [
        "Review and archive overdue records",
        "Implement automated retention policy enforcement",
        "Document retention exceptions with legal basis",
        "Update retention schedules as needed",
      ],
    },
    {
      name: "Audit Log Gap",
      description: "Detects gaps in audit trail coverage",
      enabled: true,
      regulation: "HIPAA",
      category: "audit_gap",
      severity: "high",
      conditions: [
        { metric: "audit_coverage_percent", operator: "<", threshold: 95, timeWindowMinutes: 1440 },
      ],
      remediationSteps: [
        "Investigate cause of audit logging failures",
        "Verify audit middleware is properly configured",
        "Review system logs for errors affecting audit capture",
        "Implement redundant audit logging mechanisms",
      ],
    },
    {
      name: "Cross-Patient Access",
      description: "Detects user accessing multiple patient records in short time",
      enabled: true,
      regulation: "HIPAA",
      category: "access_anomaly",
      severity: "medium",
      conditions: [
        { metric: "unique_patients_accessed", operator: ">", threshold: 20, timeWindowMinutes: 60 },
      ],
      remediationSteps: [
        "Verify user has legitimate need to access multiple records",
        "Review role and permissions for appropriateness",
        "Consider implementing break-the-glass procedures",
        "Document justification for high-volume access",
      ],
    },
    {
      name: "Privilege Escalation Attempt",
      description: "Detects attempts to access resources beyond user permissions",
      enabled: true,
      regulation: "SOC2",
      category: "access_control",
      severity: "critical",
      conditions: [
        { metric: "unauthorized_action_attempts", operator: ">", threshold: 3, timeWindowMinutes: 30 },
      ],
      remediationSteps: [
        "Investigate user activity for malicious intent",
        "Review RBAC configuration for gaps",
        "Consider temporary account suspension pending investigation",
        "Audit all recent actions by affected user",
      ],
    },
  ];

  defaultRules.forEach((rule, index) => {
    const id = `rule-default-${index + 1}`;
    const now = new Date().toISOString();
    ruleConfigStore.set(id, { ...rule, id, createdAt: now, updatedAt: now });
  });
}

initializeDefaultRules();

interface AccessPattern {
  userId: string;
  accessCount: number;
  uniquePatients: Set<string>;
  afterHoursCount: number;
  exportCount: number;
  failedAuthCount: number;
  unauthorizedAttempts: number;
  lastAccess: string;
}

const accessPatterns = new Map<string, AccessPattern>();

function isAfterHours(timestamp: string): boolean {
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  return hour < 6 || hour >= 22;
}

async function analyzeAuditLogs(
  startDate: string,
  endDate: string
): Promise<{
  logs: SecurityAuditLog[];
  patterns: Map<string, AccessPattern>;
  metrics: Record<string, number>;
}> {
  const logs = await storage.getSecurityAuditLogs("", 5000);
  const filteredLogs = logs.filter((log) => log.createdAt >= startDate && log.createdAt <= endDate);

  const patterns = new Map<string, AccessPattern>();
  const metrics: Record<string, number> = {
    total_access_events: 0,
    after_hours_access_count: 0,
    export_count: 0,
    export_volume_mb: 0,
    failed_auth_attempts: 0,
    unauthorized_action_attempts: 0,
    access_without_consent_count: 0,
    unique_patients_accessed: 0,
    audit_coverage_percent: 100,
    overdue_retention_count: 0,
  };

  const uniquePatients = new Set<string>();

  for (const log of filteredLogs) {
    metrics.total_access_events++;

    const userId = log.userId || "anonymous";
    if (!patterns.has(userId)) {
      patterns.set(userId, {
        userId,
        accessCount: 0,
        uniquePatients: new Set(),
        afterHoursCount: 0,
        exportCount: 0,
        failedAuthCount: 0,
        unauthorizedAttempts: 0,
        lastAccess: log.createdAt,
      });
    }

    const pattern = patterns.get(userId)!;
    pattern.accessCount++;
    pattern.lastAccess = log.createdAt;

    if (log.profileId) {
      pattern.uniquePatients.add(log.profileId);
      uniquePatients.add(log.profileId);
    }

    if (isAfterHours(log.createdAt)) {
      pattern.afterHoursCount++;
      metrics.after_hours_access_count++;
    }

    if (log.eventType === "data_export") {
      pattern.exportCount++;
      metrics.export_count++;
      const size = log.metadata?.sizeBytes ? parseInt(log.metadata.sizeBytes, 10) : 0;
      metrics.export_volume_mb += size / (1024 * 1024);
    }

    if (log.eventType === "account_locked" || log.eventType === "security_alert") {
      pattern.failedAuthCount++;
      metrics.failed_auth_attempts++;
    }

    if (log.eventType === "permission_denied") {
      pattern.unauthorizedAttempts++;
      metrics.unauthorized_action_attempts++;
    }
  }

  metrics.unique_patients_accessed = uniquePatients.size;

  return { logs: filteredLogs, patterns, metrics };
}

function detectRisks(
  metrics: Record<string, number>,
  patterns: Map<string, AccessPattern>
): ComplianceRisk[] {
  const risks: ComplianceRisk[] = [];
  const now = new Date().toISOString();

  for (const rule of Array.from(ruleConfigStore.values())) {
    if (!rule.enabled) continue;

    let triggered = false;
    const evidenceDetails: string[] = [];

    for (const condition of rule.conditions) {
      const metricValue = metrics[condition.metric] ?? 0;
      let conditionMet = false;

      switch (condition.operator) {
        case ">":
          conditionMet = metricValue > condition.threshold;
          break;
        case ">=":
          conditionMet = metricValue >= condition.threshold;
          break;
        case "<":
          conditionMet = metricValue < condition.threshold;
          break;
        case "<=":
          conditionMet = metricValue <= condition.threshold;
          break;
        case "==":
          conditionMet = metricValue === condition.threshold;
          break;
        case "!=":
          conditionMet = metricValue !== condition.threshold;
          break;
      }

      if (conditionMet) {
        triggered = true;
        evidenceDetails.push(`${condition.metric}: ${metricValue} (threshold: ${condition.operator} ${condition.threshold})`);
      }
    }

    if (triggered) {
      const affectedUsers: string[] = [];
      for (const [userId, pattern] of Array.from(patterns.entries())) {
        if (
          (rule.category === "access_anomaly" && (pattern.afterHoursCount > 0 || pattern.uniquePatients.size > 10)) ||
          (rule.category === "data_export" && pattern.exportCount > 5) ||
          (rule.category === "unauthorized_access" && pattern.failedAuthCount > 3) ||
          (rule.category === "access_control" && pattern.unauthorizedAttempts > 0)
        ) {
          affectedUsers.push(hashIdentifier(userId));
        }
      }

      const risk: ComplianceRisk = {
        id: randomUUID(),
        category: rule.category,
        level: rule.severity,
        regulations: [rule.regulation],
        title: rule.name,
        description: rule.description,
        evidence: [
          {
            type: "metric_violation",
            count: evidenceDetails.length,
            sampleDetails: sanitizeEvidenceDetails(evidenceDetails.join("; ")),
          },
        ],
        affectedSystems: affectedUsers.length > 0 ? [`${affectedUsers.length} users affected`] : ["System-wide"],
        detectedAt: now,
        status: "open",
        remediationSuggestions: [...rule.remediationSteps],
      };

      risks.push(risk);
      riskStore.set(risk.id, risk);
    }
  }

  return risks;
}

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare compliance analyst AI specializing in HIPAA, GDPR, and SOC2 regulations.

=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER UNDER ANY CIRCUMSTANCES:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice of any kind
- Discuss drug interactions or medication guidance
- Make patient care decisions or suggestions
- Recommend any clinical interventions
- Provide symptom interpretation or health assessments

If asked about any clinical matter, you MUST refuse and state: "I cannot provide clinical advice. Please consult a healthcare professional."

YOUR ROLE IS STRICTLY LIMITED TO:
- Compliance and regulatory risk analysis
- Data security recommendations
- Access control and audit guidance
- Privacy policy enforcement
- Technical remediation steps for security issues
=== END NO-CDS POLICY ===

Provide ONLY compliance, security, and data protection guidance. Never mention patient health status, diagnoses, or clinical recommendations.`;

async function getAIRemediationAnalysis(risks: ComplianceRisk[]): Promise<string> {
  if (risks.length === 0) {
    return "No compliance risks detected. Continue monitoring and maintain current security posture.";
  }

  const prompt = `Analyze the following healthcare compliance risks and provide actionable remediation guidance:

${risks.map((r, i) => `
Risk ${i + 1}: ${r.title}
- Category: ${r.category}
- Severity: ${r.level}
- Regulations: ${r.regulations.join(", ")}
- Description: ${r.description}
- Evidence: ${r.evidence.map((e) => e.sampleDetails).join("; ")}
`).join("\n")}

Provide:
1. Priority order for addressing these risks
2. Immediate actions needed for critical/high severity items
3. Long-term improvements to prevent recurrence
4. Compliance score impact assessment

Focus ONLY on compliance, security, and data protection. Do NOT provide any clinical or medical advice.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: NO_CDS_SYSTEM_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || "Unable to generate AI analysis.";
  } catch (error) {
    console.error("[ComplianceMonitoring] AI analysis error:", error);
    return "AI analysis unavailable. Please review risks manually using standard compliance procedures.";
  }
}

function calculateComplianceScore(
  metrics: Record<string, number>,
  risks: ComplianceRisk[]
): number {
  let score = 100;

  const criticalCount = risks.filter((r) => r.level === "critical").length;
  const highCount = risks.filter((r) => r.level === "high").length;
  const mediumCount = risks.filter((r) => r.level === "medium").length;
  const lowCount = risks.filter((r) => r.level === "low").length;

  score -= criticalCount * 15;
  score -= highCount * 8;
  score -= mediumCount * 3;
  score -= lowCount * 1;

  if (metrics.failed_auth_attempts > 20) score -= 5;
  if (metrics.after_hours_access_count > 50) score -= 3;
  if (metrics.export_volume_mb > 500) score -= 5;
  if (metrics.audit_coverage_percent < 95) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function recordComplianceMetrics(metrics: Record<string, number>): void {
  const now = new Date().toISOString();

  for (const [name, value] of Object.entries(metrics)) {
    if (!metricsHistory.has(name)) {
      metricsHistory.set(name, []);
    }
    metricsHistory.get(name)!.push({ value, timestamp: now });

    if (metricsHistory.get(name)!.length > 1000) {
      metricsHistory.get(name)!.shift();
    }
  }

  automatedAlertingService.recordMetric("compliance_risk_score", calculateComplianceScore(metrics, Array.from(riskStore.values())));
  automatedAlertingService.recordMetric("compliance_critical_risks", Array.from(riskStore.values()).filter((r) => r.level === "critical" && r.status === "open").length);
  automatedAlertingService.recordMetric("compliance_high_risks", Array.from(riskStore.values()).filter((r) => r.level === "high" && r.status === "open").length);
}

async function triggerComplianceAlerts(risks: ComplianceRisk[]): Promise<void> {
  const criticalRisks = risks.filter((r) => r.level === "critical");
  const highRisks = risks.filter((r) => r.level === "high");

  if (criticalRisks.length > 0) {
    automatedAlertingService.recordMetric("compliance_critical_event", criticalRisks.length, {
      risks: criticalRisks.map((r) => ({ id: r.id, title: r.title, category: r.category })),
    });
  }

  if (highRisks.length > 0) {
    automatedAlertingService.recordMetric("compliance_high_event", highRisks.length, {
      risks: highRisks.map((r) => ({ id: r.id, title: r.title, category: r.category })),
    });
  }
}

class AIComplianceMonitoringService {
  async runComplianceCheck(
    options: {
      startDate?: string;
      endDate?: string;
      regulations?: ComplianceRegulation[];
      generateReport?: boolean;
      userId?: string;
    } = {}
  ): Promise<{
    risks: ComplianceRisk[];
    metrics: Record<string, number>;
    score: number;
    aiAnalysis?: string;
    report?: ComplianceReport;
  }> {
    const endDate = options.endDate || new Date().toISOString();
    const startDate = options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    console.log(`[ComplianceMonitoring] Running compliance check from ${startDate} to ${endDate}`);

    const { logs, patterns, metrics } = await analyzeAuditLogs(startDate, endDate);
    console.log(`[ComplianceMonitoring] Analyzed ${logs.length} audit logs, ${patterns.size} user patterns`);

    const risks = detectRisks(metrics, patterns);
    console.log(`[ComplianceMonitoring] Detected ${risks.length} compliance risks`);

    recordComplianceMetrics(metrics);
    await triggerComplianceAlerts(risks);

    const score = calculateComplianceScore(metrics, risks);

    let aiAnalysis: string | undefined;
    if (risks.length > 0) {
      aiAnalysis = await getAIRemediationAnalysis(risks);
      for (const risk of risks) {
        risk.aiAnalysis = aiAnalysis;
      }
    }

    let report: ComplianceReport | undefined;
    if (options.generateReport) {
      report = await this.generateReport({
        type: "on_demand",
        startDate,
        endDate,
        regulations: options.regulations || ["HIPAA", "GDPR", "SOC2"],
        risks,
        metrics,
        score,
        aiAnalysis,
        userId: options.userId,
      });
    }

    return { risks, metrics, score, aiAnalysis, report };
  }

  async generateReport(options: {
    type: "daily" | "weekly" | "monthly" | "on_demand" | "incident";
    startDate: string;
    endDate: string;
    regulations: ComplianceRegulation[];
    risks: ComplianceRisk[];
    metrics: Record<string, number>;
    score: number;
    aiAnalysis?: string;
    userId?: string;
  }): Promise<ComplianceReport> {
    const now = new Date().toISOString();
    const reportId = randomUUID();

    const riskCounts: Record<ComplianceRiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    const risksByCategory: Record<ComplianceRiskCategory, number> = {
      access_anomaly: 0,
      policy_violation: 0,
      consent_violation: 0,
      data_retention: 0,
      unauthorized_access: 0,
      data_export: 0,
      audit_gap: 0,
      encryption_weakness: 0,
      access_control: 0,
      data_breach_indicator: 0,
      training_gap: 0,
      documentation_gap: 0,
    };

    const risksByRegulation: Record<ComplianceRegulation, number> = {
      HIPAA: 0,
      GDPR: 0,
      HITECH: 0,
      SOC2: 0,
      CCPA: 0,
    };

    for (const risk of options.risks) {
      riskCounts[risk.level]++;
      risksByCategory[risk.category]++;
      for (const reg of risk.regulations) {
        risksByRegulation[reg]++;
      }
    }

    const resolvedRisks = options.risks.filter((r) => r.status === "remediated");

    const complianceMetrics: ComplianceMetric[] = [
      {
        name: "Overall Compliance Score",
        value: options.score,
        threshold: 80,
        trend: options.score >= 80 ? "stable" : "degrading",
        lastUpdated: now,
      },
      {
        name: "Total Access Events",
        value: options.metrics.total_access_events || 0,
        lastUpdated: now,
      },
      {
        name: "After-Hours Access",
        value: options.metrics.after_hours_access_count || 0,
        threshold: 10,
        lastUpdated: now,
      },
      {
        name: "Failed Authentication Attempts",
        value: options.metrics.failed_auth_attempts || 0,
        threshold: 5,
        lastUpdated: now,
      },
      {
        name: "Data Export Volume (MB)",
        value: Math.round((options.metrics.export_volume_mb || 0) * 100) / 100,
        threshold: 100,
        lastUpdated: now,
      },
      {
        name: "Audit Coverage (%)",
        value: options.metrics.audit_coverage_percent || 100,
        threshold: 95,
        lastUpdated: now,
      },
    ];

    const recommendations: string[] = [];
    if (riskCounts.critical > 0) {
      recommendations.push("URGENT: Address all critical-severity risks immediately");
    }
    if (options.metrics.failed_auth_attempts > 10) {
      recommendations.push("Review authentication security controls and consider strengthening MFA");
    }
    if (options.metrics.after_hours_access_count > 20) {
      recommendations.push("Implement or review after-hours access policies and monitoring");
    }
    if (options.metrics.export_volume_mb > 100) {
      recommendations.push("Review data export policies and implement rate limiting");
    }
    if (options.metrics.audit_coverage_percent < 95) {
      recommendations.push("Investigate and resolve gaps in audit logging coverage");
    }

    const report: ComplianceReport = {
      id: reportId,
      type: options.type,
      regulations: options.regulations,
      period: { start: options.startDate, end: options.endDate },
      generatedAt: now,
      generatedBy: options.userId ? hashIdentifier(options.userId) : "system",
      summary: {
        overallScore: options.score,
        riskCounts,
        totalFindings: options.risks.length,
        resolvedFindings: resolvedRisks.length,
        newFindings: options.risks.filter((r) => r.status === "open").length,
      },
      risksByCategory,
      risksByRegulation,
      topRisks: options.risks
        .sort((a, b) => RISK_LEVEL_ORDER[b.level] - RISK_LEVEL_ORDER[a.level])
        .slice(0, 10)
        .map((r) => ({
          ...r,
          evidence: r.evidence.map((e) => ({ ...e, sampleDetails: e.sampleDetails ? "[REDACTED]" : undefined })),
        })),
      metrics: complianceMetrics,
      aiInsights: options.aiAnalysis || "No AI analysis available for this report.",
      recommendations,
      auditTrail: [
        {
          action: "report_generated",
          timestamp: now,
          userId: options.userId ? hashIdentifier(options.userId) : undefined,
        },
      ],
    };

    reportStore.set(reportId, report);
    console.log(`[ComplianceMonitoring] Generated report ${reportId}`);

    return report;
  }

  getRisks(filters?: {
    status?: ComplianceRiskStatus;
    level?: ComplianceRiskLevel;
    category?: ComplianceRiskCategory;
    regulation?: ComplianceRegulation;
  }): ComplianceRisk[] {
    let risks = Array.from(riskStore.values());

    if (filters?.status) {
      risks = risks.filter((r) => r.status === filters.status);
    }
    if (filters?.level) {
      risks = risks.filter((r) => r.level === filters.level);
    }
    if (filters?.category) {
      risks = risks.filter((r) => r.category === filters.category);
    }
    if (filters?.regulation) {
      risks = risks.filter((r) => r.regulations.includes(filters.regulation!));
    }

    return risks.sort((a, b) => RISK_LEVEL_ORDER[b.level] - RISK_LEVEL_ORDER[a.level]);
  }

  getRisk(id: string): ComplianceRisk | undefined {
    return riskStore.get(id);
  }

  updateRiskStatus(
    id: string,
    status: ComplianceRiskStatus,
    userId?: string,
    notes?: string
  ): ComplianceRisk | undefined {
    const risk = riskStore.get(id);
    if (!risk) return undefined;

    const now = new Date().toISOString();
    risk.status = status;

    if (status === "acknowledged") {
      risk.acknowledgedBy = userId ? hashIdentifier(userId) : undefined;
      risk.acknowledgedAt = now;
    } else if (status === "remediated") {
      risk.remediatedAt = now;
      risk.remediationNotes = notes;
    }

    return risk;
  }

  getReports(filters?: {
    type?: ComplianceReport["type"];
    regulation?: ComplianceRegulation;
  }): ComplianceReport[] {
    let reports = Array.from(reportStore.values());

    if (filters?.type) {
      reports = reports.filter((r) => r.type === filters.type);
    }
    if (filters?.regulation) {
      reports = reports.filter((r) => r.regulations.includes(filters.regulation!));
    }

    return reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  getReport(id: string): ComplianceReport | undefined {
    return reportStore.get(id);
  }

  getRuleConfigs(): ComplianceRuleConfig[] {
    return Array.from(ruleConfigStore.values());
  }

  getRuleConfig(id: string): ComplianceRuleConfig | undefined {
    return ruleConfigStore.get(id);
  }

  addRuleConfig(rule: Omit<ComplianceRuleConfig, "id" | "createdAt" | "updatedAt">): ComplianceRuleConfig {
    const id = randomUUID();
    const now = new Date().toISOString();
    const config: ComplianceRuleConfig = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now,
    };
    ruleConfigStore.set(id, config);
    return config;
  }

  updateRuleConfig(
    id: string,
    updates: Partial<Omit<ComplianceRuleConfig, "id" | "createdAt">>
  ): ComplianceRuleConfig | undefined {
    const config = ruleConfigStore.get(id);
    if (!config) return undefined;

    const updated: ComplianceRuleConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    ruleConfigStore.set(id, updated);
    return updated;
  }

  deleteRuleConfig(id: string): boolean {
    return ruleConfigStore.delete(id);
  }

  getMetrics(): ComplianceMetric[] {
    const now = new Date().toISOString();
    const metrics: ComplianceMetric[] = [];

    for (const [name, history] of Array.from(metricsHistory.entries())) {
      if (history.length === 0) continue;

      const latestValue = history[history.length - 1].value;
      let trend: "improving" | "stable" | "degrading" = "stable";

      if (history.length >= 2) {
        const previousValue = history[history.length - 2].value;
        const diff = latestValue - previousValue;
        if (Math.abs(diff) > latestValue * 0.1) {
          if (name.includes("risk") || name.includes("failure") || name.includes("violation")) {
            trend = diff > 0 ? "degrading" : "improving";
          } else if (name.includes("score") || name.includes("coverage")) {
            trend = diff > 0 ? "improving" : "degrading";
          }
        }
      }

      metrics.push({
        name,
        value: latestValue,
        trend,
        lastUpdated: now,
      });
    }

    return metrics;
  }

  getRiskSummary(): {
    total: number;
    byLevel: Record<ComplianceRiskLevel, number>;
    byStatus: Record<ComplianceRiskStatus, number>;
    byRegulation: Record<ComplianceRegulation, number>;
  } {
    const risks = Array.from(riskStore.values());

    const byLevel: Record<ComplianceRiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byStatus: Record<ComplianceRiskStatus, number> = {
      open: 0,
      acknowledged: 0,
      investigating: 0,
      remediated: 0,
      accepted: 0,
      false_positive: 0,
    };
    const byRegulation: Record<ComplianceRegulation, number> = { HIPAA: 0, GDPR: 0, HITECH: 0, SOC2: 0, CCPA: 0 };

    for (const risk of risks) {
      byLevel[risk.level]++;
      byStatus[risk.status]++;
      for (const reg of risk.regulations) {
        byRegulation[reg]++;
      }
    }

    return {
      total: risks.length,
      byLevel,
      byStatus,
      byRegulation,
    };
  }
}

export const aiComplianceMonitoringService = new AIComplianceMonitoringService();
