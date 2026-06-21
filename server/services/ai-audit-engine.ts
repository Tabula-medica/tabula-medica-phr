import OpenAI from "openai";
import { storage } from "../storage";
import * as integrationHub from "./external-integration-hub";
import { createHash } from "crypto";
import type { SecurityAuditLog } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function hashIdentifier(id: string): string {
  return "H" + createHash("sha256").update(id).digest("hex").substring(0, 8);
}

function sanitizeDescription(text: string): string {
  let sanitized = text
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, "[NAME]")
    .replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, "[SSN]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, "[DATE]")
    .replace(/\bMRN[:\s]*\d+\b/gi, "[MRN]")
    .replace(/\bpatient[:\s]*\d+\b/gi, "[PATIENT_ID]")
    .replace(/\b(?:pt|patient)\s+id[:\s]*[a-z0-9-]+\b/gi, "[PATIENT_ID]");
  return sanitized.substring(0, 100);
}

export type AnomalyType = 
  | "unusual_access_time"
  | "high_failure_rate"
  | "large_data_transfer"
  | "unauthorized_access_attempt"
  | "repeated_auth_failures"
  | "rate_limit_exceeded"
  | "unusual_access_pattern"
  | "compliance_deviation"
  | "data_exfiltration_risk"
  | "hipaa_minimum_necessary_violation"
  | "gdpr_data_minimization_violation"
  | "phi_excessive_access"
  | "pii_excessive_access"
  | "sensitive_data_correlation_alert";

export type SensitiveDataCategory = "PHI" | "PII" | "clinical" | "demographic" | "financial" | "genetic";

export interface ForensicAnalysisResult {
  id: string;
  analysisType: "exfiltration" | "minimum_necessary" | "data_minimization" | "sensitive_access";
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  findings: ForensicFinding[];
  patterns: DataAccessPattern[];
  timeline: TimelineEvent[];
  aiAnalysis?: string;
  recommendedActions: string[];
  generatedAt: string;
}

export interface ForensicFinding {
  id: string;
  category: string;
  description: string;
  severity: SeverityLevel;
  evidence: string[];
  affectedDataCategories: SensitiveDataCategory[];
  regulatoryImplications: string[];
}

export interface DataAccessPattern {
  userId: string;
  patternType: "volume_spike" | "unusual_resource_mix" | "time_anomaly" | "frequency_anomaly" | "scope_creep";
  confidence: number;
  dataPoints: number;
  description: string;
  timeRange: { start: string; end: string };
}

export interface TimelineEvent {
  timestamp: string;
  eventType: string;
  userId: string;
  resourceType: string;
  dataCategory?: SensitiveDataCategory;
  riskIndicator: "normal" | "elevated" | "suspicious" | "critical";
  details: string;
}

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface AuditAnomaly {
  id: string;
  type: AnomalyType;
  severity: SeverityLevel;
  title: string;
  description: string;
  affectedResources: string[];
  detectedAt: string;
  metadata: Record<string, unknown>;
  aiAnalysis?: string;
  recommendedActions: string[];
  status: "new" | "acknowledged" | "investigating" | "resolved" | "false_positive";
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface AuditReport {
  id: string;
  type: "daily" | "weekly" | "monthly" | "on_demand";
  generatedAt: string;
  generatedBy: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    anomaliesDetected: number;
    criticalAnomalies: number;
    highRiskEvents: number;
    complianceScore: number;
  };
  syncAnalysis: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    avgSyncDuration: number;
    connectionHealth: Record<string, { healthy: boolean; failureRate: number }>;
  };
  securityAnalysis: {
    unusualAccessPatterns: number;
    afterHoursAccess: number;
    largeDataTransfers: number;
    authFailures: number;
    suspiciousActivities: number;
  };
  topIssues: AuditAnomaly[];
  aiInsights: string;
  recommendations: string[];
}

export interface AlertConfig {
  id: string;
  name: string;
  enabled: boolean;
  anomalyTypes: AnomalyType[];
  severityThreshold: SeverityLevel;
  notificationChannels: ("email" | "webhook" | "in_app")[];
  recipients: string[];
  webhookUrl?: string;
  cooldownMinutes: number;
  lastTriggered?: string;
  createdAt: string;
  createdBy: string;
}

const anomalyStore = new Map<string, AuditAnomaly>();
const reportStore = new Map<string, AuditReport>();
const forensicStore = new Map<string, ForensicAnalysisResult>();
const alertConfigStore = new Map<string, AlertConfig>();
const alertHistoryStore: Array<{
  id: string;
  alertConfigId: string;
  anomalyId: string;
  sentAt: string;
  channel: string;
  recipient: string;
  status: "sent" | "failed" | "acknowledged";
}> = [];

alertConfigStore.set("default-critical", {
  id: "default-critical",
  name: "Critical Security Alerts",
  enabled: true,
  anomalyTypes: ["unauthorized_access_attempt", "data_exfiltration_risk", "repeated_auth_failures"],
  severityThreshold: "critical",
  notificationChannels: ["in_app", "email"],
  recipients: ["admin"],
  cooldownMinutes: 15,
  createdAt: new Date().toISOString(),
  createdBy: "system",
});

alertConfigStore.set("sync-failures", {
  id: "sync-failures",
  name: "Sync Failure Alerts",
  enabled: true,
  anomalyTypes: ["high_failure_rate"],
  severityThreshold: "high",
  notificationChannels: ["in_app"],
  recipients: ["admin"],
  cooldownMinutes: 60,
  createdAt: new Date().toISOString(),
  createdBy: "system",
});

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

async function getAuditLogs(startDate: string, endDate: string, limit: number = 1000): Promise<SecurityAuditLog[]> {
  try {
    const allLogs = await storage.getSecurityAuditLogs("", limit);
    return allLogs.filter((log) => {
      const ts = log.createdAt;
      return ts >= startDate && ts <= endDate;
    });
  } catch (error) {
    console.error("[AIAuditEngine] Error fetching audit logs:", error);
    return [];
  }
}

function getSyncEvents(startDate: string, endDate: string): integrationHub.SyncEvent[] {
  const allEvents = integrationHub.getSyncEvents(undefined, 1000);
  return allEvents.filter((event) => {
    return event.timestamp >= startDate && event.timestamp <= endDate;
  });
}

function isAfterHours(timestamp: string): boolean {
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  return hour < 6 || hour >= 22;
}

function detectUnusualAccessTime(logs: SecurityAuditLog[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];
  const afterHoursAccess = logs.filter((log) => isAfterHours(log.createdAt));

  const userAfterHours = new Map<string, SecurityAuditLog[]>();
  for (const log of afterHoursAccess) {
    const existing = userAfterHours.get(log.userId) || [];
    existing.push(log);
    userAfterHours.set(log.userId, existing);
  }

  for (const [userId, userLogs] of Array.from(userAfterHours.entries())) {
    if (userLogs.length >= 3) {
      anomalies.push({
        id: `unusual-time-${hashIdentifier(userId)}-${Date.now()}`,
        type: "unusual_access_time",
        severity: userLogs.length >= 10 ? "high" : "medium",
        title: "Unusual After-Hours Access Pattern",
        description: `User ${hashIdentifier(userId)} accessed the system ${userLogs.length} times outside normal hours (10PM-6AM UTC)`,
        affectedResources: Array.from(new Set(userLogs.map((l: SecurityAuditLog) => l.metadata?.resourceType || "Unknown"))),
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          accessCount: userLogs.length,
          timestamps: userLogs.slice(0, 5).map((l: SecurityAuditLog) => l.createdAt),
        },
        recommendedActions: [
          "Review user access permissions",
          "Verify if after-hours access is authorized",
          "Contact user to confirm legitimate activity",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

function detectHighFailureRate(syncEvents: integrationHub.SyncEvent[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const connectionEvents = new Map<string, integrationHub.SyncEvent[]>();
  for (const event of syncEvents) {
    const existing = connectionEvents.get(event.connectionId) || [];
    existing.push(event);
    connectionEvents.set(event.connectionId, existing);
  }

  for (const [connectionId, events] of Array.from(connectionEvents.entries())) {
    const failedCount = events.filter((e: integrationHub.SyncEvent) => e.status === "failed").length;
    const failureRate = failedCount / events.length;

    if (failureRate > 0.3 && failedCount >= 3) {
      const severity: SeverityLevel = failureRate > 0.7 ? "critical" : failureRate > 0.5 ? "high" : "medium";

      anomalies.push({
        id: `high-failure-${hashIdentifier(connectionId)}-${Date.now()}`,
        type: "high_failure_rate",
        severity,
        title: "High Sync Failure Rate Detected",
        description: `Connection ${hashIdentifier(connectionId)} has a ${(failureRate * 100).toFixed(1)}% failure rate (${failedCount}/${events.length} syncs failed)`,
        affectedResources: [hashIdentifier(connectionId)],
        detectedAt: new Date().toISOString(),
        metadata: {
          connectionIdHash: hashIdentifier(connectionId),
          totalEvents: events.length,
          failedEvents: failedCount,
          failureRate: failureRate,
          recentErrors: events
            .filter((e: integrationHub.SyncEvent) => e.status === "failed")
            .slice(-3)
            .map((e: integrationHub.SyncEvent) => e.errorMessage || "Unknown error"),
        },
        recommendedActions: [
          "Check external system availability",
          "Verify credentials and connection settings",
          "Review error logs for specific failure reasons",
          "Consider pausing sync until issue is resolved",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

function detectLargeDataTransfers(syncEvents: integrationHub.SyncEvent[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const largeTransfers = syncEvents.filter((event) => {
    const processingTime = event.processingTimeMs || 0;
    return processingTime > 30000;
  });

  for (const event of largeTransfers) {
    const severity: SeverityLevel = (event.processingTimeMs || 0) > 60000 ? "high" : "medium";

    anomalies.push({
      id: `large-transfer-${hashIdentifier(event.id)}-${Date.now()}`,
      type: "large_data_transfer",
      severity,
      title: "Large Data Transfer Detected",
      description: `Sync event took ${Math.round((event.processingTimeMs || 0) / 1000)}s, which exceeds normal thresholds`,
      affectedResources: [hashIdentifier(event.connectionId)],
      detectedAt: new Date().toISOString(),
      metadata: {
        eventIdHash: hashIdentifier(event.id),
        connectionIdHash: hashIdentifier(event.connectionId),
        processingTimeMs: event.processingTimeMs,
        direction: event.direction,
        timestamp: event.timestamp,
      },
      recommendedActions: [
        "Verify this data transfer was authorized",
        "Review what data was transferred",
        "Check if this matches expected bulk operations",
      ],
      status: "new",
    });
  }

  return anomalies;
}

function detectAuthFailures(logs: SecurityAuditLog[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const authFailures = logs.filter(
    (log) =>
      log.eventType === "permission_denied" ||
      log.eventType === "account_locked" ||
      log.description.toLowerCase().includes("authentication failed") ||
      log.description.toLowerCase().includes("unauthorized")
  );

  const ipFailures = new Map<string, SecurityAuditLog[]>();
  for (const log of authFailures) {
    const existing = ipFailures.get(log.ipAddress) || [];
    existing.push(log);
    ipFailures.set(log.ipAddress, existing);
  }

  for (const [ip, failures] of Array.from(ipFailures.entries())) {
    if (failures.length >= 5) {
      const severity: SeverityLevel = failures.length >= 20 ? "critical" : failures.length >= 10 ? "high" : "medium";

      anomalies.push({
        id: `auth-failures-${hashIdentifier(ip)}-${Date.now()}`,
        type: "repeated_auth_failures",
        severity,
        title: "Repeated Authentication Failures",
        description: `${failures.length} failed authentication attempts from IP ${hashIdentifier(ip)}`,
        affectedResources: Array.from(new Set(failures.map((f: SecurityAuditLog) => hashIdentifier(f.userId)))),
        detectedAt: new Date().toISOString(),
        metadata: {
          ipHash: hashIdentifier(ip),
          failureCount: failures.length,
          targetedUsers: Array.from(new Set(failures.map((f: SecurityAuditLog) => hashIdentifier(f.userId)))),
          firstAttempt: failures[0].createdAt,
          lastAttempt: failures[failures.length - 1].createdAt,
        },
        recommendedActions: [
          "Consider temporary IP block",
          "Review if this is a brute force attack",
          "Notify affected users to verify account security",
          "Enable additional authentication factors",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

function detectComplianceDeviations(logs: SecurityAuditLog[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const exportEvents = logs.filter(
    (log) =>
      log.eventType === "data_export" ||
      log.description.toLowerCase().includes("export") ||
      log.description.toLowerCase().includes("download")
  );

  const userExports = new Map<string, SecurityAuditLog[]>();
  for (const log of exportEvents) {
    const existing = userExports.get(log.userId) || [];
    existing.push(log);
    userExports.set(log.userId, existing);
  }

  for (const [userId, exports] of Array.from(userExports.entries())) {
    if (exports.length >= 10) {
      anomalies.push({
        id: `excessive-exports-${hashIdentifier(userId)}-${Date.now()}`,
        type: "compliance_deviation",
        severity: exports.length >= 25 ? "high" : "medium",
        title: "Excessive Data Export Activity",
        description: `User ${hashIdentifier(userId)} performed ${exports.length} data exports, potentially violating minimum necessary principle`,
        affectedResources: Array.from(new Set(exports.map((e: SecurityAuditLog) => e.metadata?.resourceType || "Unknown"))),
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          exportCount: exports.length,
          resourceTypes: Array.from(new Set(exports.map((e: SecurityAuditLog) => e.metadata?.resourceType))),
        },
        recommendedActions: [
          "Review if exports are justified by user role",
          "Verify compliance with minimum necessary access principle",
          "Consider implementing export quotas",
          "Document business justification for exports",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

const RESOURCE_DATA_CATEGORY_MAP: Record<string, SensitiveDataCategory[]> = {
  Patient: ["PHI", "PII", "demographic"],
  Observation: ["PHI", "clinical"],
  Condition: ["PHI", "clinical"],
  Procedure: ["PHI", "clinical"],
  MedicationRequest: ["PHI", "clinical"],
  MedicationStatement: ["PHI", "clinical"],
  DiagnosticReport: ["PHI", "clinical"],
  Immunization: ["PHI", "clinical"],
  AllergyIntolerance: ["PHI", "clinical"],
  CarePlan: ["PHI", "clinical"],
  Encounter: ["PHI", "clinical"],
  DocumentReference: ["PHI", "clinical"],
  Consent: ["PHI", "PII"],
  Person: ["PII", "demographic"],
  RelatedPerson: ["PII"],
  Coverage: ["PII", "financial"],
  Claim: ["PII", "financial"],
  ExplanationOfBenefit: ["PII", "financial"],
  FamilyMemberHistory: ["PHI", "genetic"],
  MolecularSequence: ["PHI", "genetic"],
};

function getDataCategories(resourceType: string | undefined): SensitiveDataCategory[] {
  if (!resourceType) return [];
  return RESOURCE_DATA_CATEGORY_MAP[resourceType] || [];
}

function classifyResourceSensitivity(resourceType: string | undefined): "critical" | "high" | "medium" | "low" {
  const categories = getDataCategories(resourceType);
  if (categories.includes("genetic")) return "critical";
  if (categories.includes("PHI") && categories.includes("clinical")) return "high";
  if (categories.includes("PHI") || categories.includes("PII")) return "medium";
  return "low";
}

function detectDataExfiltrationPatterns(
  logs: SecurityAuditLog[],
  syncEvents: integrationHub.SyncEvent[]
): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];
  const userAccessProfile = new Map<string, {
    totalAccess: number;
    sensitiveAccess: number;
    exportCount: number;
    largeTransfers: number;
    afterHoursActivity: number;
    uniqueResources: Set<string>;
    accessTimes: string[];
  }>();

  for (const log of logs) {
    const profile = userAccessProfile.get(log.userId) || {
      totalAccess: 0,
      sensitiveAccess: 0,
      exportCount: 0,
      largeTransfers: 0,
      afterHoursActivity: 0,
      uniqueResources: new Set<string>(),
      accessTimes: [],
    };

    profile.totalAccess++;
    profile.accessTimes.push(log.createdAt);
    const resourceType = (log.metadata?.resourceType as string) || "";
    if (resourceType) profile.uniqueResources.add(resourceType);

    const sensitivity = classifyResourceSensitivity(resourceType);
    if (sensitivity === "critical" || sensitivity === "high") {
      profile.sensitiveAccess++;
    }

    if (log.eventType === "data_export" || log.description.toLowerCase().includes("export") || log.description.toLowerCase().includes("download")) {
      profile.exportCount++;
    }

    if (isAfterHours(log.createdAt)) {
      profile.afterHoursActivity++;
    }

    userAccessProfile.set(log.userId, profile);
  }

  for (const event of syncEvents) {
    if (event.direction === "outbound" && (event.processingTimeMs || 0) > 30000) {
      const profile = userAccessProfile.get("system") || {
        totalAccess: 0,
        sensitiveAccess: 0,
        exportCount: 0,
        largeTransfers: 0,
        afterHoursActivity: 0,
        uniqueResources: new Set<string>(),
        accessTimes: [],
      };
      profile.largeTransfers++;
      userAccessProfile.set("system", profile);
    }
  }

  for (const [userId, profile] of Array.from(userAccessProfile.entries())) {
    const exfiltrationScore = calculateExfiltrationScore(profile);

    if (exfiltrationScore >= 70) {
      const severity: SeverityLevel = exfiltrationScore >= 90 ? "critical" : exfiltrationScore >= 80 ? "high" : "medium";

      anomalies.push({
        id: `exfil-pattern-${hashIdentifier(userId)}-${Date.now()}`,
        type: "data_exfiltration_risk",
        severity,
        title: "Data Exfiltration Pattern Detected",
        description: `User ${hashIdentifier(userId)} exhibits data exfiltration indicators: ${profile.exportCount} exports, ${profile.sensitiveAccess} sensitive accesses, ${profile.afterHoursActivity} after-hours activities`,
        affectedResources: Array.from(profile.uniqueResources).slice(0, 10),
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          exfiltrationScore,
          totalAccess: profile.totalAccess,
          sensitiveAccess: profile.sensitiveAccess,
          exportCount: profile.exportCount,
          largeTransfers: profile.largeTransfers,
          afterHoursActivity: profile.afterHoursActivity,
          uniqueResourceCount: profile.uniqueResources.size,
          riskFactors: identifyRiskFactors(profile),
        },
        recommendedActions: [
          "Immediately review user access logs in detail",
          "Verify all recent exports were authorized",
          "Consider temporary access suspension pending investigation",
          "Document findings for potential breach notification",
          "Notify security team and compliance officer",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

function calculateExfiltrationScore(profile: {
  totalAccess: number;
  sensitiveAccess: number;
  exportCount: number;
  largeTransfers: number;
  afterHoursActivity: number;
  uniqueResources: Set<string>;
}): number {
  let score = 0;

  const sensitiveRatio = profile.totalAccess > 0 ? profile.sensitiveAccess / profile.totalAccess : 0;
  score += sensitiveRatio * 25;

  score += Math.min(profile.exportCount * 5, 25);

  score += Math.min(profile.largeTransfers * 10, 20);

  const afterHoursRatio = profile.totalAccess > 0 ? profile.afterHoursActivity / profile.totalAccess : 0;
  score += afterHoursRatio * 15;

  if (profile.uniqueResources.size > 10) {
    score += Math.min((profile.uniqueResources.size - 10) * 2, 15);
  }

  return Math.min(score, 100);
}

function identifyRiskFactors(profile: {
  totalAccess: number;
  sensitiveAccess: number;
  exportCount: number;
  largeTransfers: number;
  afterHoursActivity: number;
  uniqueResources: Set<string>;
}): string[] {
  const factors: string[] = [];

  if (profile.sensitiveAccess > 10) factors.push("High volume of sensitive data access");
  if (profile.exportCount > 5) factors.push("Multiple data export operations");
  if (profile.largeTransfers > 0) factors.push("Large data transfers detected");
  if (profile.afterHoursActivity > 3) factors.push("Significant after-hours activity");
  if (profile.uniqueResources.size > 15) factors.push("Broad access across many resource types");

  return factors;
}

function detectHIPAAMinimumNecessaryViolations(logs: SecurityAuditLog[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const userRoleAccess = new Map<string, {
    role: string;
    resourcesAccessed: Map<string, number>;
    patientsAccessed: Set<string>;
    totalAccess: number;
  }>();

  for (const log of logs) {
    const role = (log.metadata?.userRole as string) || "unknown";
    const resourceType = (log.metadata?.resourceType as string) || "unknown";
    const patientId = (log.metadata?.patientId as string) || "";

    const profile = userRoleAccess.get(log.userId) || {
      role,
      resourcesAccessed: new Map<string, number>(),
      patientsAccessed: new Set<string>(),
      totalAccess: 0,
    };

    profile.totalAccess++;
    profile.resourcesAccessed.set(resourceType, (profile.resourcesAccessed.get(resourceType) || 0) + 1);
    if (patientId) profile.patientsAccessed.add(patientId);

    userRoleAccess.set(log.userId, profile);
  }

  const roleBaselines: Record<string, { maxPatients: number; allowedResources: string[] }> = {
    physician: { maxPatients: 100, allowedResources: ["Patient", "Observation", "Condition", "MedicationRequest", "Procedure", "DiagnosticReport", "Encounter", "CarePlan"] },
    nurse: { maxPatients: 50, allowedResources: ["Patient", "Observation", "MedicationStatement", "Immunization", "AllergyIntolerance", "Encounter"] },
    admin: { maxPatients: 200, allowedResources: ["Patient", "Coverage", "Claim", "ExplanationOfBenefit", "Consent"] },
    billing: { maxPatients: 500, allowedResources: ["Coverage", "Claim", "ExplanationOfBenefit"] },
    researcher: { maxPatients: 0, allowedResources: ["Observation", "Condition", "Procedure"] },
  };

  for (const [userId, profile] of Array.from(userRoleAccess.entries())) {
    const baseline = roleBaselines[profile.role.toLowerCase()] || { maxPatients: 20, allowedResources: [] };

    if (profile.patientsAccessed.size > baseline.maxPatients * 1.5) {
      const severity: SeverityLevel = profile.patientsAccessed.size > baseline.maxPatients * 3 ? "critical" : profile.patientsAccessed.size > baseline.maxPatients * 2 ? "high" : "medium";

      anomalies.push({
        id: `hipaa-min-necessary-${hashIdentifier(userId)}-${Date.now()}`,
        type: "hipaa_minimum_necessary_violation",
        severity,
        title: "HIPAA Minimum Necessary Principle Violation",
        description: `User ${hashIdentifier(userId)} (role: ${profile.role}) accessed ${profile.patientsAccessed.size} patient records, exceeding role baseline of ${baseline.maxPatients}`,
        affectedResources: Array.from(profile.resourcesAccessed.keys()),
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          userRole: profile.role,
          patientCount: profile.patientsAccessed.size,
          expectedMaxPatients: baseline.maxPatients,
          excessPercentage: ((profile.patientsAccessed.size - baseline.maxPatients) / baseline.maxPatients * 100).toFixed(1),
          resourceBreakdown: Object.fromEntries(profile.resourcesAccessed),
        },
        recommendedActions: [
          "Review user's job duties and access requirements",
          "Verify if patient access was clinically justified",
          "Consider implementing stricter role-based access controls",
          "Document business justification for expanded access",
          "Report to HIPAA compliance officer for review",
        ],
        status: "new",
      });
    }

    const unauthorizedResources: string[] = [];
    for (const resource of Array.from(profile.resourcesAccessed.keys())) {
      if (baseline.allowedResources.length > 0 && !baseline.allowedResources.includes(resource)) {
        unauthorizedResources.push(resource);
      }
    }

    if (unauthorizedResources.length > 2) {
      anomalies.push({
        id: `hipaa-scope-${hashIdentifier(userId)}-${Date.now()}`,
        type: "hipaa_minimum_necessary_violation",
        severity: "high",
        title: "Access Scope Exceeds Role Requirements",
        description: `User ${hashIdentifier(userId)} (role: ${profile.role}) accessed ${unauthorizedResources.length} resource types outside typical role scope`,
        affectedResources: unauthorizedResources,
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          userRole: profile.role,
          unauthorizedResources,
          allowedResources: baseline.allowedResources,
          totalResourceTypesAccessed: profile.resourcesAccessed.size,
        },
        recommendedActions: [
          "Review access control configuration for this role",
          "Verify if access permissions are correctly assigned",
          "Consider restricting access to role-appropriate resources",
          "Train user on minimum necessary access requirements",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

function detectGDPRDataMinimizationViolations(logs: SecurityAuditLog[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const accessPurposes = new Map<string, {
    userId: string;
    purpose: string;
    dataCategories: Set<SensitiveDataCategory>;
    accessCount: number;
    resourceTypes: Set<string>;
  }>();

  for (const log of logs) {
    const purpose = (log.metadata?.accessPurpose as string) || "unspecified";
    const resourceType = (log.metadata?.resourceType as string) || "";
    const key = `${log.userId}:${purpose}`;

    const profile = accessPurposes.get(key) || {
      userId: log.userId,
      purpose,
      dataCategories: new Set<SensitiveDataCategory>(),
      accessCount: 0,
      resourceTypes: new Set<string>(),
    };

    profile.accessCount++;
    if (resourceType) {
      profile.resourceTypes.add(resourceType);
      for (const cat of getDataCategories(resourceType)) {
        profile.dataCategories.add(cat);
      }
    }

    accessPurposes.set(key, profile);
  }

  const purposeMinimalData: Record<string, SensitiveDataCategory[]> = {
    treatment: ["PHI", "clinical"],
    billing: ["PII", "financial"],
    research: ["clinical"],
    administrative: ["PII", "demographic"],
    audit: ["PHI", "PII"],
  };

  for (const [_key, profile] of Array.from(accessPurposes.entries())) {
    const minimalCategories = purposeMinimalData[profile.purpose.toLowerCase()] || ["PII"];
    const excessCategories: SensitiveDataCategory[] = [];

    for (const cat of Array.from(profile.dataCategories)) {
      if (!minimalCategories.includes(cat)) {
        excessCategories.push(cat);
      }
    }

    if (excessCategories.length > 0 && profile.accessCount > 5) {
      const hasGeneticData = excessCategories.includes("genetic");
      const severity: SeverityLevel = hasGeneticData ? "critical" : excessCategories.length > 2 ? "high" : "medium";

      anomalies.push({
        id: `gdpr-minimization-${hashIdentifier(profile.userId)}-${Date.now()}`,
        type: "gdpr_data_minimization_violation",
        severity,
        title: "GDPR Data Minimization Principle Violation",
        description: `Access for purpose "${profile.purpose}" includes data categories (${excessCategories.join(", ")}) beyond minimum necessary`,
        affectedResources: Array.from(profile.resourceTypes),
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(profile.userId),
          declaredPurpose: profile.purpose,
          accessedCategories: Array.from(profile.dataCategories),
          excessCategories,
          minimumRequiredCategories: minimalCategories,
          accessCount: profile.accessCount,
          resourceTypes: Array.from(profile.resourceTypes),
        },
        recommendedActions: [
          "Review data access scope for stated purpose",
          "Implement purpose limitation controls",
          "Restrict access to only required data categories",
          "Update privacy impact assessment",
          "Document lawful basis for data processing",
        ],
        status: "new",
      });
    }
  }

  const unspecifiedPurposeAccess = Array.from(accessPurposes.values()).filter(p => p.purpose === "unspecified");
  for (const profile of unspecifiedPurposeAccess) {
    if (profile.accessCount > 10 && profile.dataCategories.has("PHI")) {
      anomalies.push({
        id: `gdpr-no-purpose-${hashIdentifier(profile.userId)}-${Date.now()}`,
        type: "gdpr_data_minimization_violation",
        severity: "high",
        title: "PHI Access Without Declared Purpose",
        description: `User ${hashIdentifier(profile.userId)} accessed PHI ${profile.accessCount} times without declared purpose`,
        affectedResources: Array.from(profile.resourceTypes),
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(profile.userId),
          accessCount: profile.accessCount,
          dataCategories: Array.from(profile.dataCategories),
          resourceTypes: Array.from(profile.resourceTypes),
        },
        recommendedActions: [
          "Require purpose declaration for all PHI access",
          "Implement access purpose tracking",
          "Review system configuration for purpose enforcement",
          "Train users on GDPR purpose limitation requirements",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

function detectSensitiveDataCorrelation(logs: SecurityAuditLog[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  const userSensitiveAccess = new Map<string, {
    phiAccess: number;
    piiAccess: number;
    clinicalAccess: number;
    geneticAccess: number;
    financialAccess: number;
    correlatedPatients: Map<string, Set<SensitiveDataCategory>>;
    timeDistribution: Map<number, number>;
  }>();

  for (const log of logs) {
    const resourceType = (log.metadata?.resourceType as string) || "";
    const patientId = (log.metadata?.patientId as string) || "";
    const categories = getDataCategories(resourceType);
    const hour = new Date(log.createdAt).getUTCHours();

    const profile = userSensitiveAccess.get(log.userId) || {
      phiAccess: 0,
      piiAccess: 0,
      clinicalAccess: 0,
      geneticAccess: 0,
      financialAccess: 0,
      correlatedPatients: new Map<string, Set<SensitiveDataCategory>>(),
      timeDistribution: new Map<number, number>(),
    };

    for (const cat of categories) {
      if (cat === "PHI") profile.phiAccess++;
      if (cat === "PII") profile.piiAccess++;
      if (cat === "clinical") profile.clinicalAccess++;
      if (cat === "genetic") profile.geneticAccess++;
      if (cat === "financial") profile.financialAccess++;
    }

    if (patientId) {
      const patientCategories = profile.correlatedPatients.get(patientId) || new Set<SensitiveDataCategory>();
      for (const cat of categories) {
        patientCategories.add(cat);
      }
      profile.correlatedPatients.set(patientId, patientCategories);
    }

    profile.timeDistribution.set(hour, (profile.timeDistribution.get(hour) || 0) + 1);

    userSensitiveAccess.set(log.userId, profile);
  }

  for (const [userId, profile] of Array.from(userSensitiveAccess.entries())) {
    if (profile.phiAccess > 50 || profile.piiAccess > 50) {
      const severity: SeverityLevel = profile.phiAccess > 100 || profile.piiAccess > 100 ? "high" : "medium";
      const primaryCategory = profile.phiAccess > profile.piiAccess ? "PHI" : "PII";

      anomalies.push({
        id: `sensitive-excess-${hashIdentifier(userId)}-${Date.now()}`,
        type: primaryCategory === "PHI" ? "phi_excessive_access" : "pii_excessive_access",
        severity,
        title: `Excessive ${primaryCategory} Access Detected`,
        description: `User ${hashIdentifier(userId)} accessed ${primaryCategory === "PHI" ? profile.phiAccess : profile.piiAccess} ${primaryCategory} records`,
        affectedResources: [`${primaryCategory} resources`],
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          phiAccess: profile.phiAccess,
          piiAccess: profile.piiAccess,
          clinicalAccess: profile.clinicalAccess,
          geneticAccess: profile.geneticAccess,
          financialAccess: profile.financialAccess,
          uniquePatientsAccessed: profile.correlatedPatients.size,
        },
        recommendedActions: [
          `Review ${primaryCategory} access patterns`,
          "Verify access is within scope of job duties",
          "Consider implementing access quotas",
          "Enhance audit logging for this user",
        ],
        status: "new",
      });
    }

    let correlatedPatientCount = 0;
    for (const [_patientId, categories] of Array.from(profile.correlatedPatients.entries())) {
      if (categories.size >= 3) {
        correlatedPatientCount++;
      }
    }

    if (correlatedPatientCount > 10) {
      anomalies.push({
        id: `sensitive-correlation-${hashIdentifier(userId)}-${Date.now()}`,
        type: "sensitive_data_correlation_alert",
        severity: "high",
        title: "Cross-Category Sensitive Data Correlation",
        description: `User ${hashIdentifier(userId)} accessed multiple sensitive data categories for ${correlatedPatientCount} patients`,
        affectedResources: ["Multiple sensitive categories"],
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          correlatedPatientCount,
          totalPatientsAccessed: profile.correlatedPatients.size,
          categoryBreakdown: {
            phi: profile.phiAccess,
            pii: profile.piiAccess,
            clinical: profile.clinicalAccess,
            genetic: profile.geneticAccess,
            financial: profile.financialAccess,
          },
        },
        recommendedActions: [
          "Investigate reason for cross-category access",
          "Verify correlation is justified by treatment relationship",
          "Review for potential profiling or surveillance",
          "Document compliance justification",
        ],
        status: "new",
      });
    }

    if (profile.geneticAccess > 5) {
      anomalies.push({
        id: `genetic-access-${hashIdentifier(userId)}-${Date.now()}`,
        type: "sensitive_data_correlation_alert",
        severity: "critical",
        title: "Genetic Data Access Alert",
        description: `User ${hashIdentifier(userId)} accessed genetic data ${profile.geneticAccess} times - special category requiring enhanced protection`,
        affectedResources: ["FamilyMemberHistory", "MolecularSequence"],
        detectedAt: new Date().toISOString(),
        metadata: {
          userIdHash: hashIdentifier(userId),
          geneticAccessCount: profile.geneticAccess,
          otherAccessCounts: {
            phi: profile.phiAccess,
            clinical: profile.clinicalAccess,
          },
        },
        recommendedActions: [
          "Verify genetic data access authorization",
          "Confirm research protocol approval if applicable",
          "Ensure GINA compliance",
          "Review consent for genetic data processing",
          "Document special category data access justification",
        ],
        status: "new",
      });
    }
  }

  return anomalies;
}

async function generateAIInsights(
  anomalies: AuditAnomaly[],
  syncEvents: integrationHub.SyncEvent[],
  logs: SecurityAuditLog[]
): Promise<string> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return generateFallbackInsights(anomalies, syncEvents, logs);
  }

  try {
    const summaryData = {
      totalAnomalies: anomalies.length,
      criticalCount: anomalies.filter((a) => a.severity === "critical").length,
      highCount: anomalies.filter((a) => a.severity === "high").length,
      anomalyTypes: Array.from(new Set(anomalies.map((a) => a.type))),
      syncStats: {
        total: syncEvents.length,
        failed: syncEvents.filter((e) => e.status === "failed").length,
        avgDuration:
          syncEvents.length > 0
            ? syncEvents.reduce((sum, e) => sum + (e.processingTimeMs || 0), 0) / syncEvents.length
            : 0,
      },
      accessStats: {
        total: logs.length,
        afterHours: logs.filter((l) => isAfterHours(l.createdAt)).length,
        uniqueUsers: new Set(logs.map((l) => l.userId)).size,
      },
    };

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a healthcare security analyst reviewing audit data for a HIPAA-compliant health records system. 
Provide concise, actionable insights about the security posture. Focus on:
1. Key risk areas that need immediate attention
2. Patterns that indicate potential security issues
3. Compliance concerns based on the data
4. Prioritized recommendations

IMPORTANT: Do NOT provide clinical advice or medical recommendations. Focus only on security, compliance, and operational insights.
Keep your response under 300 words. Use professional, clear language.`,
        },
        {
          role: "user",
          content: `Analyze this audit summary and provide security insights:

${JSON.stringify(summaryData, null, 2)}

Top anomalies detected:
${anomalies
  .slice(0, 5)
  .map((a) => `- ${a.severity.toUpperCase()}: ${a.title} - ${a.description}`)
  .join("\n")}`,
        },
      ],
    });

    return response.choices[0]?.message?.content || generateFallbackInsights(anomalies, syncEvents, logs);
  } catch (error) {
    console.error("[AIAuditEngine] Error generating AI insights:", error);
    return generateFallbackInsights(anomalies, syncEvents, logs);
  }
}

function generateFallbackInsights(
  anomalies: AuditAnomaly[],
  syncEvents: integrationHub.SyncEvent[],
  logs: SecurityAuditLog[]
): string {
  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const highCount = anomalies.filter((a) => a.severity === "high").length;
  const failedSyncs = syncEvents.filter((e) => e.status === "failed").length;
  const syncFailureRate = syncEvents.length > 0 ? (failedSyncs / syncEvents.length) * 100 : 0;

  let insights = `Security Analysis Summary:\n\n`;

  if (criticalCount > 0) {
    insights += `CRITICAL: ${criticalCount} critical security anomalies require immediate attention.\n\n`;
  }

  if (highCount > 0) {
    insights += `HIGH PRIORITY: ${highCount} high-severity issues detected that should be addressed promptly.\n\n`;
  }

  if (syncFailureRate > 30) {
    insights += `SYNC HEALTH: External system synchronization failure rate is ${syncFailureRate.toFixed(1)}%, indicating connectivity or configuration issues.\n\n`;
  }

  const afterHoursCount = logs.filter((l) => isAfterHours(l.createdAt)).length;
  if (logs.length > 0 && afterHoursCount > logs.length * 0.2) {
    insights += `ACCESS PATTERN: ${((afterHoursCount / logs.length) * 100).toFixed(1)}% of access occurred outside normal business hours.\n\n`;
  }

  insights += `Recommendations:\n`;
  insights += `1. Review and address all critical anomalies immediately\n`;
  insights += `2. Investigate high-failure-rate connections\n`;
  insights += `3. Verify after-hours access is authorized\n`;
  insights += `4. Ensure compliance with minimum necessary access principles\n`;

  return insights;
}

export async function runAuditAnalysis(
  startDate: string,
  endDate: string,
  userId: string,
  ipAddress: string
): Promise<{
  anomalies: AuditAnomaly[];
  summary: {
    totalEventsAnalyzed: number;
    syncEventsAnalyzed: number;
    anomaliesDetected: number;
    criticalCount: number;
    highCount: number;
  };
}> {
  const logs = await getAuditLogs(startDate, endDate);
  const syncEvents = getSyncEvents(startDate, endDate);

  const allAnomalies: AuditAnomaly[] = [
    ...detectUnusualAccessTime(logs),
    ...detectHighFailureRate(syncEvents),
    ...detectLargeDataTransfers(syncEvents),
    ...detectAuthFailures(logs),
    ...detectComplianceDeviations(logs),
    ...detectDataExfiltrationPatterns(logs, syncEvents),
    ...detectHIPAAMinimumNecessaryViolations(logs),
    ...detectGDPRDataMinimizationViolations(logs),
    ...detectSensitiveDataCorrelation(logs),
  ];

  for (const anomaly of allAnomalies) {
    anomalyStore.set(anomaly.id, anomaly);
  }

  await triggerAlerts(allAnomalies, userId);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "security_alert",
    description: `Audit analysis completed: ${allAnomalies.length} anomalies detected`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      startDate,
      endDate,
      logsAnalyzed: String(logs.length),
      syncEventsAnalyzed: String(syncEvents.length),
      anomaliesDetected: String(allAnomalies.length),
    },
  });

  return {
    anomalies: allAnomalies,
    summary: {
      totalEventsAnalyzed: logs.length,
      syncEventsAnalyzed: syncEvents.length,
      anomaliesDetected: allAnomalies.length,
      criticalCount: allAnomalies.filter((a) => a.severity === "critical").length,
      highCount: allAnomalies.filter((a) => a.severity === "high").length,
    },
  };
}

export async function generateAuditReport(
  type: "daily" | "weekly" | "monthly" | "on_demand",
  userId: string,
  ipAddress: string,
  customPeriod?: { start: string; end: string }
): Promise<AuditReport> {
  const now = new Date();
  let startDate: string;
  let endDate = now.toISOString();

  if (customPeriod) {
    startDate = customPeriod.start;
    endDate = customPeriod.end;
  } else {
    switch (type) {
      case "daily":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "monthly":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const logs = await getAuditLogs(startDate, endDate);
  const syncEvents = getSyncEvents(startDate, endDate);

  const analysisResult = await runAuditAnalysis(startDate, endDate, userId, ipAddress);

  const connectionHealth: Record<string, { healthy: boolean; failureRate: number }> = {};
  const connectionEvents = new Map<string, integrationHub.SyncEvent[]>();
  for (const event of syncEvents) {
    const existing = connectionEvents.get(event.connectionId) || [];
    existing.push(event);
    connectionEvents.set(event.connectionId, existing);
  }
  for (const [connId, events] of Array.from(connectionEvents.entries())) {
    const failedCount = events.filter((e: integrationHub.SyncEvent) => e.status === "failed").length;
    const failureRate = failedCount / events.length;
    connectionHealth[hashIdentifier(connId)] = {
      healthy: failureRate < 0.3,
      failureRate,
    };
  }

  const aiInsights = await generateAIInsights(analysisResult.anomalies, syncEvents, logs);

  const successfulSyncs = syncEvents.filter((e) => e.status === "success").length;
  const failedSyncs = syncEvents.filter((e) => e.status === "failed").length;

  const report: AuditReport = {
    id: `report-${type}-${Date.now()}`,
    type,
    generatedAt: now.toISOString(),
    generatedBy: hashIdentifier(userId),
    period: {
      start: startDate,
      end: endDate,
    },
    summary: {
      totalEvents: logs.length,
      successfulEvents: logs.filter((l) => !l.description.toLowerCase().includes("failed")).length,
      failedEvents: logs.filter((l) => l.description.toLowerCase().includes("failed")).length,
      anomaliesDetected: analysisResult.anomalies.length,
      criticalAnomalies: analysisResult.summary.criticalCount,
      highRiskEvents: analysisResult.summary.highCount,
      complianceScore: calculateComplianceScore(analysisResult.anomalies, logs),
    },
    syncAnalysis: {
      totalSyncs: syncEvents.length,
      successfulSyncs,
      failedSyncs,
      avgSyncDuration:
        syncEvents.length > 0
          ? syncEvents.reduce((sum, e) => sum + (e.processingTimeMs || 0), 0) / syncEvents.length
          : 0,
      connectionHealth,
    },
    securityAnalysis: {
      unusualAccessPatterns: analysisResult.anomalies.filter((a) => a.type === "unusual_access_pattern").length,
      afterHoursAccess: logs.filter((l) => isAfterHours(l.createdAt)).length,
      largeDataTransfers: analysisResult.anomalies.filter((a) => a.type === "large_data_transfer").length,
      authFailures: analysisResult.anomalies.filter((a) => a.type === "repeated_auth_failures").length,
      suspiciousActivities: analysisResult.anomalies.filter(
        (a) => a.type === "unauthorized_access_attempt" || a.type === "data_exfiltration_risk"
      ).length,
    },
    topIssues: analysisResult.anomalies
      .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
      .slice(0, 10),
    aiInsights,
    recommendations: generateRecommendations(analysisResult.anomalies),
  };

  reportStore.set(report.id, report);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `${type} audit report generated`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      reportId: report.id,
      reportType: type,
      periodStart: startDate,
      periodEnd: endDate,
      anomaliesFound: String(analysisResult.anomalies.length),
    },
  });

  return report;
}

function calculateComplianceScore(anomalies: AuditAnomaly[], _logs: SecurityAuditLog[]): number {
  let score = 100;

  for (const anomaly of anomalies) {
    switch (anomaly.severity) {
      case "critical":
        score -= 15;
        break;
      case "high":
        score -= 10;
        break;
      case "medium":
        score -= 5;
        break;
      case "low":
        score -= 2;
        break;
    }
  }

  const complianceAnomalies = anomalies.filter((a) => a.type === "compliance_deviation").length;
  score -= complianceAnomalies * 5;

  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(anomalies: AuditAnomaly[]): string[] {
  const recommendations: string[] = [];
  const types = new Set(anomalies.map((a) => a.type));

  if (types.has("repeated_auth_failures")) {
    recommendations.push("Implement IP-based rate limiting for authentication attempts");
    recommendations.push("Consider enabling CAPTCHA after multiple failed login attempts");
  }

  if (types.has("unusual_access_time")) {
    recommendations.push("Review and update after-hours access policies");
    recommendations.push("Implement time-based access controls for sensitive operations");
  }

  if (types.has("high_failure_rate")) {
    recommendations.push("Review external system connection configurations");
    recommendations.push("Implement automated connection health monitoring");
  }

  if (types.has("large_data_transfer")) {
    recommendations.push("Implement data transfer thresholds with approval workflows");
    recommendations.push("Add alerts for bulk data operations");
  }

  if (types.has("compliance_deviation")) {
    recommendations.push("Review data export policies and access controls");
    recommendations.push("Implement minimum necessary access principle enforcement");
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue monitoring for anomalies");
    recommendations.push("Schedule regular security reviews");
  }

  return recommendations;
}

async function triggerAlerts(anomalies: AuditAnomaly[], _triggeredBy: string): Promise<void> {
  for (const config of Array.from(alertConfigStore.values())) {
    if (!config.enabled) continue;

    if (config.lastTriggered) {
      const lastTriggered = new Date(config.lastTriggered).getTime();
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastTriggered < cooldownMs) continue;
    }

    const matchingAnomalies = anomalies.filter(
      (a) =>
        config.anomalyTypes.includes(a.type) &&
        SEVERITY_ORDER[a.severity] >= SEVERITY_ORDER[config.severityThreshold]
    );

    if (matchingAnomalies.length > 0) {
      for (const channel of config.notificationChannels) {
        for (const recipient of config.recipients) {
          alertHistoryStore.push({
            id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            alertConfigId: config.id,
            anomalyId: matchingAnomalies[0].id,
            sentAt: new Date().toISOString(),
            channel,
            recipient: hashIdentifier(recipient),
            status: "sent",
          });
        }
      }

      config.lastTriggered = new Date().toISOString();
      alertConfigStore.set(config.id, config);
    }
  }
}

export function getAnomalies(
  filters?: {
    type?: AnomalyType;
    severity?: SeverityLevel;
    status?: string;
    startDate?: string;
    endDate?: string;
  },
  limit: number = 100
): AuditAnomaly[] {
  let anomalies = Array.from(anomalyStore.values());

  if (filters?.type) {
    anomalies = anomalies.filter((a) => a.type === filters.type);
  }
  if (filters?.severity) {
    anomalies = anomalies.filter((a) => a.severity === filters.severity);
  }
  if (filters?.status) {
    anomalies = anomalies.filter((a) => a.status === filters.status);
  }
  if (filters?.startDate) {
    anomalies = anomalies.filter((a) => a.detectedAt >= filters.startDate!);
  }
  if (filters?.endDate) {
    anomalies = anomalies.filter((a) => a.detectedAt <= filters.endDate!);
  }

  return anomalies
    .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
    .slice(0, limit);
}

export function getAnomaly(id: string): AuditAnomaly | undefined {
  return anomalyStore.get(id);
}

export async function updateAnomalyStatus(
  id: string,
  status: AuditAnomaly["status"],
  userId: string,
  ipAddress: string,
  notes?: string
): Promise<AuditAnomaly | null> {
  const anomaly = anomalyStore.get(id);
  if (!anomaly) return null;

  anomaly.status = status;

  if (status === "acknowledged") {
    anomaly.acknowledgedBy = hashIdentifier(userId);
    anomaly.acknowledgedAt = new Date().toISOString();
  } else if (status === "resolved") {
    anomaly.resolvedAt = new Date().toISOString();
    anomaly.resolutionNotes = notes;
  }

  anomalyStore.set(id, anomaly);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `Anomaly ${id} status updated to ${status}`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      anomalyId: id,
      anomalyType: anomaly.type,
      newStatus: status,
      notes: notes || "",
    },
  });

  return anomaly;
}

export function getReports(type?: string, limit: number = 50): AuditReport[] {
  let reports = Array.from(reportStore.values());

  if (type) {
    reports = reports.filter((r) => r.type === type);
  }

  return reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()).slice(0, limit);
}

export function getReport(id: string): AuditReport | undefined {
  return reportStore.get(id);
}

export function getAlertConfigs(): AlertConfig[] {
  return Array.from(alertConfigStore.values());
}

export function getAlertConfig(id: string): AlertConfig | undefined {
  return alertConfigStore.get(id);
}

export async function createAlertConfig(
  config: Omit<AlertConfig, "id" | "createdAt" | "createdBy">,
  userId: string,
  ipAddress: string
): Promise<AlertConfig> {
  const newConfig: AlertConfig = {
    ...config,
    id: `alert-config-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: hashIdentifier(userId),
  };

  alertConfigStore.set(newConfig.id, newConfig);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `Alert configuration "${newConfig.name}" created`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      configId: newConfig.id,
      configName: newConfig.name,
      anomalyTypes: newConfig.anomalyTypes.join(","),
    },
  });

  return newConfig;
}

export async function updateAlertConfig(
  id: string,
  updates: Partial<AlertConfig>,
  userId: string,
  ipAddress: string
): Promise<AlertConfig | null> {
  const config = alertConfigStore.get(id);
  if (!config) return null;

  const updated = { ...config, ...updates, id: config.id, createdAt: config.createdAt, createdBy: config.createdBy };
  alertConfigStore.set(id, updated);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `Alert configuration "${updated.name}" updated`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      configId: id,
      updatedFields: Object.keys(updates).join(","),
    },
  });

  return updated;
}

export async function deleteAlertConfig(id: string, userId: string, ipAddress: string): Promise<boolean> {
  const config = alertConfigStore.get(id);
  if (!config) return false;

  alertConfigStore.delete(id);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `Alert configuration "${config.name}" deleted`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      configId: id,
      configName: config.name,
    },
  });

  return true;
}

export function getAlertHistory(configId?: string, limit: number = 100): typeof alertHistoryStore {
  let history = [...alertHistoryStore];

  if (configId) {
    history = history.filter((h) => h.alertConfigId === configId);
  }

  return history.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()).slice(0, limit);
}

export function getAuditEngineStats(): {
  totalAnomalies: number;
  unresolvedAnomalies: number;
  criticalAnomalies: number;
  reportsGenerated: number;
  alertConfigs: number;
  alertsSent: number;
  forensicAnalyses: number;
} {
  const anomalies = Array.from(anomalyStore.values());

  return {
    totalAnomalies: anomalies.length,
    unresolvedAnomalies: anomalies.filter((a) => a.status === "new" || a.status === "investigating").length,
    criticalAnomalies: anomalies.filter((a) => a.severity === "critical" && a.status !== "resolved").length,
    reportsGenerated: reportStore.size,
    alertConfigs: alertConfigStore.size,
    alertsSent: alertHistoryStore.length,
    forensicAnalyses: forensicStore.size,
  };
}

export async function runForensicAnalysis(
  analysisType: "exfiltration" | "minimum_necessary" | "data_minimization" | "sensitive_access",
  startDate: string,
  endDate: string,
  userId: string,
  ipAddress: string
): Promise<ForensicAnalysisResult> {
  const logs = await getAuditLogs(startDate, endDate);
  const syncEvents = getSyncEvents(startDate, endDate);

  const findings: ForensicFinding[] = [];
  const patterns: DataAccessPattern[] = [];
  const timeline: TimelineEvent[] = [];

  let anomalies: AuditAnomaly[] = [];

  switch (analysisType) {
    case "exfiltration":
      anomalies = detectDataExfiltrationPatterns(logs, syncEvents);
      break;
    case "minimum_necessary":
      anomalies = detectHIPAAMinimumNecessaryViolations(logs);
      break;
    case "data_minimization":
      anomalies = detectGDPRDataMinimizationViolations(logs);
      break;
    case "sensitive_access":
      anomalies = detectSensitiveDataCorrelation(logs);
      break;
  }

  for (const anomaly of anomalies) {
    findings.push({
      id: `finding-${anomaly.id}`,
      category: anomaly.type,
      description: anomaly.description,
      severity: anomaly.severity,
      evidence: anomaly.recommendedActions,
      affectedDataCategories: extractDataCategories(anomaly),
      regulatoryImplications: getRegulatoryConcerns(anomaly.type),
    });
  }

  const userPatterns = analyzeUserPatterns(logs);
  patterns.push(...userPatterns);

  const recentLogs = logs.slice(-50);
  for (const log of recentLogs) {
    const resourceType = (log.metadata?.resourceType as string) || "Unknown";
    const dataCategory = getDataCategories(resourceType)[0];

    timeline.push({
      timestamp: log.createdAt,
      eventType: log.eventType,
      userId: hashIdentifier(log.userId),
      resourceType,
      dataCategory,
      riskIndicator: determineRiskIndicator(log),
      details: sanitizeDescription(log.description),
    });
  }

  const riskScore = calculateForensicRiskScore(findings, patterns);
  const riskLevel = riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : "low";

  let aiAnalysis: string | undefined;
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && findings.length > 0) {
    aiAnalysis = await generateForensicAIAnalysis(analysisType, findings, patterns);
  }

  const result: ForensicAnalysisResult = {
    id: `forensic-${analysisType}-${Date.now()}`,
    analysisType,
    riskScore,
    riskLevel,
    findings,
    patterns,
    timeline,
    aiAnalysis,
    recommendedActions: generateForensicRecommendations(analysisType, findings),
    generatedAt: new Date().toISOString(),
  };

  forensicStore.set(result.id, result);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `Forensic analysis (${analysisType}) completed: ${findings.length} findings, risk score ${riskScore}`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-audit-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      analysisId: result.id,
      analysisType,
      findingsCount: String(findings.length),
      riskScore: String(riskScore),
      riskLevel,
    },
  });

  return result;
}

function extractDataCategories(anomaly: AuditAnomaly): SensitiveDataCategory[] {
  const categories = new Set<SensitiveDataCategory>();

  for (const resource of anomaly.affectedResources) {
    for (const cat of getDataCategories(resource)) {
      categories.add(cat);
    }
  }

  if (anomaly.type === "phi_excessive_access") categories.add("PHI");
  if (anomaly.type === "pii_excessive_access") categories.add("PII");
  if (anomaly.type === "sensitive_data_correlation_alert") {
    categories.add("PHI");
    categories.add("clinical");
  }

  return Array.from(categories);
}

function getRegulatoryConcerns(anomalyType: AnomalyType): string[] {
  const concerns: Record<AnomalyType, string[]> = {
    data_exfiltration_risk: ["HIPAA §164.308 - Security Management", "HIPAA §164.312 - Technical Safeguards", "SOC2 CC6.1 - Data Protection"],
    hipaa_minimum_necessary_violation: ["HIPAA §164.502(b) - Minimum Necessary Standard", "HIPAA §164.514 - Workforce Access"],
    gdpr_data_minimization_violation: ["GDPR Article 5(1)(c) - Data Minimisation", "GDPR Article 25 - Data Protection by Design"],
    phi_excessive_access: ["HIPAA §164.308(a)(4) - Information Access Management", "HIPAA §164.312(d) - Person or Entity Authentication"],
    pii_excessive_access: ["GDPR Article 5(1)(f) - Integrity and Confidentiality", "CCPA §1798.100 - Right to Know"],
    sensitive_data_correlation_alert: ["HIPAA §164.308(a)(1) - Security Management", "GDPR Article 9 - Special Categories of Data"],
    unusual_access_time: ["SOC2 CC6.1 - Logical Access Controls"],
    high_failure_rate: ["SOC2 CC7.2 - System Monitoring"],
    large_data_transfer: ["HIPAA §164.312(e) - Transmission Security"],
    unauthorized_access_attempt: ["HIPAA §164.312(d) - Authentication"],
    repeated_auth_failures: ["SOC2 CC6.1 - Access Controls"],
    rate_limit_exceeded: ["SOC2 CC7.1 - Change Detection"],
    unusual_access_pattern: ["HIPAA §164.308(a)(1) - Risk Analysis"],
    compliance_deviation: ["HIPAA §164.308(a)(8) - Evaluation"],
  };

  return concerns[anomalyType] || ["General Compliance Concern"];
}

function analyzeUserPatterns(logs: SecurityAuditLog[]): DataAccessPattern[] {
  const patterns: DataAccessPattern[] = [];
  const userLogs = new Map<string, SecurityAuditLog[]>();

  for (const log of logs) {
    const existing = userLogs.get(log.userId) || [];
    existing.push(log);
    userLogs.set(log.userId, existing);
  }

  for (const [userId, userLogList] of Array.from(userLogs.entries())) {
    if (userLogList.length < 5) continue;

    const resourceTypes = new Set(userLogList.map(l => (l.metadata?.resourceType as string) || ""));
    const afterHoursCount = userLogList.filter(l => isAfterHours(l.createdAt)).length;
    const afterHoursRatio = afterHoursCount / userLogList.length;

    if (afterHoursRatio > 0.4) {
      patterns.push({
        userId: hashIdentifier(userId),
        patternType: "time_anomaly",
        confidence: afterHoursRatio,
        dataPoints: userLogList.length,
        description: `${(afterHoursRatio * 100).toFixed(0)}% of access occurs outside business hours`,
        timeRange: {
          start: userLogList[0].createdAt,
          end: userLogList[userLogList.length - 1].createdAt,
        },
      });
    }

    if (resourceTypes.size > 10) {
      patterns.push({
        userId: hashIdentifier(userId),
        patternType: "scope_creep",
        confidence: Math.min(resourceTypes.size / 20, 1),
        dataPoints: userLogList.length,
        description: `Access spans ${resourceTypes.size} different resource types - unusually broad`,
        timeRange: {
          start: userLogList[0].createdAt,
          end: userLogList[userLogList.length - 1].createdAt,
        },
      });
    }

    const hourlyDistribution = new Map<number, number>();
    for (const log of userLogList) {
      const hour = new Date(log.createdAt).getUTCHours();
      hourlyDistribution.set(hour, (hourlyDistribution.get(hour) || 0) + 1);
    }

    const maxHourlyAccess = Math.max(...Array.from(hourlyDistribution.values()));
    const avgHourlyAccess = userLogList.length / 24;
    if (maxHourlyAccess > avgHourlyAccess * 5) {
      patterns.push({
        userId: hashIdentifier(userId),
        patternType: "volume_spike",
        confidence: Math.min(maxHourlyAccess / (avgHourlyAccess * 10), 1),
        dataPoints: maxHourlyAccess,
        description: `Access volume spike detected: ${maxHourlyAccess} accesses in a single hour vs ${avgHourlyAccess.toFixed(1)} average`,
        timeRange: {
          start: userLogList[0].createdAt,
          end: userLogList[userLogList.length - 1].createdAt,
        },
      });
    }
  }

  return patterns;
}

function determineRiskIndicator(log: SecurityAuditLog): "normal" | "elevated" | "suspicious" | "critical" {
  const resourceType = (log.metadata?.resourceType as string) || "";
  const sensitivity = classifyResourceSensitivity(resourceType);

  if (log.eventType === "permission_denied" || log.eventType === "account_locked") {
    return "critical";
  }

  if (log.eventType === "data_export" && sensitivity === "critical") {
    return "critical";
  }

  if (isAfterHours(log.createdAt) && (sensitivity === "critical" || sensitivity === "high")) {
    return "suspicious";
  }

  if (log.eventType === "data_export" || sensitivity === "high") {
    return "elevated";
  }

  return "normal";
}

function calculateForensicRiskScore(findings: ForensicFinding[], patterns: DataAccessPattern[]): number {
  let score = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case "critical": score += 25; break;
      case "high": score += 15; break;
      case "medium": score += 8; break;
      case "low": score += 3; break;
    }

    if (finding.affectedDataCategories.includes("genetic")) score += 10;
    if (finding.affectedDataCategories.includes("PHI")) score += 5;
  }

  for (const pattern of patterns) {
    score += pattern.confidence * 10;
  }

  return Math.min(score, 100);
}

async function generateForensicAIAnalysis(
  analysisType: string,
  findings: ForensicFinding[],
  patterns: DataAccessPattern[]
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a healthcare security forensic analyst reviewing data access patterns for a HIPAA-compliant system.
Provide a detailed forensic analysis summary focusing on:
1. Key security concerns and their severity
2. Evidence patterns that support or refute malicious intent
3. Regulatory compliance implications
4. Prioritized remediation recommendations

CRITICAL: Do NOT provide any clinical advice, medical recommendations, or interpret clinical data.
Focus ONLY on security, access patterns, and compliance analysis.
Keep response under 500 words. Be specific and actionable.`,
        },
        {
          role: "user",
          content: `Analyze this ${analysisType} forensic investigation:

Findings (${findings.length}):
${findings.slice(0, 5).map(f => `- ${f.severity.toUpperCase()}: ${f.description} [Categories: ${f.affectedDataCategories.join(", ")}]`).join("\n")}

Patterns (${patterns.length}):
${patterns.slice(0, 5).map(p => `- ${p.patternType}: ${p.description} (Confidence: ${(p.confidence * 100).toFixed(0)}%)`).join("\n")}

Provide forensic analysis and recommendations.`,
        },
      ],
    });

    return response.choices[0]?.message?.content || "AI analysis unavailable";
  } catch (error) {
    console.error("[AIAuditEngine] Forensic AI analysis error:", error);
    return "AI forensic analysis could not be generated";
  }
}

function generateForensicRecommendations(analysisType: string, findings: ForensicFinding[]): string[] {
  const recommendations: string[] = [];

  const hasCritical = findings.some(f => f.severity === "critical");
  const hasHigh = findings.some(f => f.severity === "high");
  const hasGenetic = findings.some(f => f.affectedDataCategories.includes("genetic"));

  if (hasCritical) {
    recommendations.push("IMMEDIATE: Escalate to security incident response team");
    recommendations.push("Consider temporary access suspension for affected users");
  }

  switch (analysisType) {
    case "exfiltration":
      recommendations.push("Preserve all logs for potential breach investigation");
      recommendations.push("Review all data exports from flagged users in last 30 days");
      recommendations.push("Evaluate need for breach notification under HIPAA");
      break;
    case "minimum_necessary":
      recommendations.push("Review role-based access control configurations");
      recommendations.push("Implement access request workflow for expanded permissions");
      recommendations.push("Schedule HIPAA minimum necessary training for affected users");
      break;
    case "data_minimization":
      recommendations.push("Audit purpose limitation controls in application");
      recommendations.push("Update Data Protection Impact Assessment");
      recommendations.push("Review consent records for affected data categories");
      break;
    case "sensitive_access":
      recommendations.push("Implement enhanced monitoring for special category data");
      recommendations.push("Review and document lawful basis for sensitive data access");
      if (hasGenetic) {
        recommendations.push("Verify GINA compliance for genetic data access");
        recommendations.push("Confirm research protocol approval if applicable");
      }
      break;
  }

  if (hasHigh && !hasCritical) {
    recommendations.push("Schedule review meeting within 48 hours");
    recommendations.push("Document findings in compliance tracking system");
  }

  return recommendations;
}

export function getForensicAnalyses(
  analysisType?: string,
  limit: number = 50
): ForensicAnalysisResult[] {
  let analyses = Array.from(forensicStore.values());

  if (analysisType) {
    analyses = analyses.filter(a => a.analysisType === analysisType);
  }

  return analyses
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, limit);
}

export function getForensicAnalysis(id: string): ForensicAnalysisResult | undefined {
  return forensicStore.get(id);
}

console.log("[AIAuditEngine] Enhanced forensic analysis capabilities initialized");
console.log("[AIAuditEngine] Service initialized");
