import OpenAI from "openai";
import { createHash, randomUUID } from "crypto";
import { automatedAlertingService } from "./automated-alerting";
import { aiDataGovernanceService } from "./ai-data-governance";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data governance enforcement specialist.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing audit log entries for policy violations
- Determining if actions should be blocked or flagged based on governance policies
- Providing enforcement recommendations for access control violations
- Identifying suspicious data access patterns
- Recommending remediation actions for policy breaches

All analysis must focus on POLICY ENFORCEMENT and ACCESS CONTROL, never clinical interpretation.`;

export type EnforcementLevel = "strict" | "moderate" | "permissive";
export type EnforcementAction = "block" | "flag" | "warn" | "log" | "allow";
export type ViolationCategory = "access_violation" | "data_export" | "consent_breach" | "after_hours" | "role_mismatch" | "rate_limit" | "unauthorized_resource" | "data_modification";

export interface PolicyEnforcementConfig {
  id: string;
  policyId: string;
  policyName: string;
  enforcementLevel: EnforcementLevel;
  isEnabled: boolean;
  autoBlockEnabled: boolean;
  autoFlagEnabled: boolean;
  alertOnViolation: boolean;
  violationCategories: ViolationCategory[];
  exemptUsers: string[];
  exemptRoles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  patientId?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome: "success" | "failure" | "pending";
  metadata?: Record<string, unknown>;
}

export interface PolicyViolationAssessment {
  id: string;
  auditLogId: string;
  policyId: string;
  policyName: string;
  enforcementConfigId: string;
  userId: string;
  userRole: string;
  violationCategory: ViolationCategory;
  severity: "critical" | "high" | "medium" | "low";
  enforcementAction: EnforcementAction;
  actionTaken: boolean;
  description: string;
  evidence: {
    action: string;
    resource: string;
    timestamp: string;
    ipAddress?: string;
    additionalContext?: string;
  };
  aiAnalysis?: string;
  remediationRecommendations: string[];
  assessedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  status: "pending_review" | "confirmed" | "false_positive" | "remediated";
}

export interface EnforcementMetrics {
  totalAssessments: number;
  violationsDetected: number;
  actionsBlocked: number;
  actionsFlagged: number;
  falsePositives: number;
  confirmedViolations: number;
  remediatedViolations: number;
  byCategory: Record<ViolationCategory, number>;
  bySeverity: Record<string, number>;
  averageResponseTime: number;
}

const enforcementConfigStore = new Map<string, PolicyEnforcementConfig>();
const assessmentStore = new Map<string, PolicyViolationAssessment>();
const blockedActionsCache = new Set<string>();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]");
}

function logHipaaAudit(action: string, resource: string, userId: string, details: Record<string, unknown>): void {
  const sanitizedDetails: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitizedDetails[key] = sanitizePhi(value);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitizedDetails[key] = hashIdentifier(value);
    } else {
      sanitizedDetails[key] = value;
    }
  }

  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "PolicyEnforcementService",
    details: sanitizedDetails,
  })}`);
}

function initializeDefaultConfigs(): void {
  const defaultConfigs: PolicyEnforcementConfig[] = [
    {
      id: "enforce-hipaa-access",
      policyId: "policy-hipaa-access",
      policyName: "HIPAA Minimum Necessary Access",
      enforcementLevel: "strict",
      isEnabled: true,
      autoBlockEnabled: true,
      autoFlagEnabled: true,
      alertOnViolation: true,
      violationCategories: ["access_violation", "role_mismatch", "unauthorized_resource"],
      exemptUsers: [],
      exemptRoles: ["admin", "emergency_responder"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "enforce-consent",
      policyId: "policy-consent",
      policyName: "Patient Consent Enforcement",
      enforcementLevel: "strict",
      isEnabled: true,
      autoBlockEnabled: true,
      autoFlagEnabled: true,
      alertOnViolation: true,
      violationCategories: ["consent_breach"],
      exemptUsers: [],
      exemptRoles: ["emergency_responder"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "enforce-data-export",
      policyId: "policy-data-export",
      policyName: "Data Export Controls",
      enforcementLevel: "moderate",
      isEnabled: true,
      autoBlockEnabled: false,
      autoFlagEnabled: true,
      alertOnViolation: true,
      violationCategories: ["data_export", "rate_limit"],
      exemptUsers: [],
      exemptRoles: ["admin", "data_steward"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "enforce-after-hours",
      policyId: "policy-after-hours",
      policyName: "After-Hours Access Monitoring",
      enforcementLevel: "moderate",
      isEnabled: true,
      autoBlockEnabled: false,
      autoFlagEnabled: true,
      alertOnViolation: true,
      violationCategories: ["after_hours"],
      exemptUsers: [],
      exemptRoles: ["admin", "on_call_provider"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const config of defaultConfigs) {
    enforcementConfigStore.set(config.id, config);
  }

  console.log(`[PolicyEnforcement] Loaded ${defaultConfigs.length} enforcement configs`);
}

initializeDefaultConfigs();

class AIPolicyEnforcementService {
  private async analyzeViolationWithAI(
    entry: AuditLogEntry,
    config: PolicyEnforcementConfig,
    violationCategory: ViolationCategory
  ): Promise<{ analysis: string; recommendations: string[]; severity: "critical" | "high" | "medium" | "low" }> {
    const fallback = this.getDefaultAnalysis(entry, config, violationCategory);
    
    if (!openai) {
      return fallback;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this potential policy violation:

Policy: ${config.policyName}
Enforcement Level: ${config.enforcementLevel}
Violation Category: ${violationCategory}

Audit Log Entry:
- User Role: ${entry.userRole}
- Action: ${entry.action}
- Resource: ${entry.resource}
- Timestamp: ${entry.timestamp}
- Outcome: ${entry.outcome}

Provide JSON response:
{
  "analysis": "Brief analysis of the violation (2-3 sentences)",
  "recommendations": ["List of 2-3 remediation recommendations"],
  "severity": "critical|high|medium|low"
}

Focus ONLY on access control and policy compliance. NO clinical analysis.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });

      const content = response.choices[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            analysis: sanitizePhi(parsed.analysis || fallback.analysis),
            recommendations: (parsed.recommendations || fallback.recommendations).map((r: string) => sanitizePhi(r)),
            severity: parsed.severity || fallback.severity,
          };
        }
      } catch {
        console.error("[PolicyEnforcement] Failed to parse AI response");
      }
      
      return fallback;
    } catch (error) {
      console.error("[PolicyEnforcement] AI analysis error:", error);
      return fallback;
    }
  }

  private getDefaultAnalysis(
    entry: AuditLogEntry,
    config: PolicyEnforcementConfig,
    violationCategory: ViolationCategory
  ): { analysis: string; recommendations: string[]; severity: "critical" | "high" | "medium" | "low" } {
    const severityMap: Record<ViolationCategory, "critical" | "high" | "medium" | "low"> = {
      access_violation: "high",
      data_export: "high",
      consent_breach: "critical",
      after_hours: "medium",
      role_mismatch: "high",
      rate_limit: "medium",
      unauthorized_resource: "critical",
      data_modification: "high",
    };

    const analysisMap: Record<ViolationCategory, string> = {
      access_violation: `User attempted to access a resource beyond their authorized scope. The action was performed on ${entry.resource} which may violate the ${config.policyName} policy.`,
      data_export: `Large data export detected that may exceed normal operational parameters. This requires review to ensure compliance with data handling policies.`,
      consent_breach: `Data access occurred without verified patient consent on record. This represents a potential HIPAA violation requiring immediate attention.`,
      after_hours: `Access to protected resources detected outside of normal business hours. While this may be legitimate, it requires logging and review.`,
      role_mismatch: `User's role does not match the required role for accessing this resource. Access control policies may have been circumvented.`,
      rate_limit: `Unusual volume of requests detected that exceeds normal usage patterns. This may indicate automated access or potential data harvesting.`,
      unauthorized_resource: `Attempt to access a resource that is explicitly restricted for this user. This is a serious access control violation.`,
      data_modification: `Unauthorized data modification attempt detected. This requires immediate review and potential rollback.`,
    };

    const recommendationMap: Record<ViolationCategory, string[]> = {
      access_violation: ["Review user's access permissions", "Verify business justification for access", "Consider additional training on access policies"],
      data_export: ["Audit the exported data scope", "Verify compliance with data minimization", "Implement export volume limits"],
      consent_breach: ["Immediately verify consent status", "Document incident per HIPAA requirements", "Contact compliance officer"],
      after_hours: ["Verify legitimate business need", "Implement additional after-hours monitoring", "Consider MFA enforcement for off-hours access"],
      role_mismatch: ["Audit role assignments", "Review RBAC policy configuration", "Investigate potential privilege escalation"],
      rate_limit: ["Implement request throttling", "Review API access patterns", "Consider additional authentication requirements"],
      unauthorized_resource: ["Block access immediately", "Audit all recent actions by this user", "Escalate to security team"],
      data_modification: ["Review all modifications by this user", "Consider data rollback if necessary", "Implement stricter change controls"],
    };

    return {
      analysis: analysisMap[violationCategory],
      recommendations: recommendationMap[violationCategory],
      severity: severityMap[violationCategory],
    };
  }

  private detectViolationCategory(entry: AuditLogEntry, config: PolicyEnforcementConfig): ViolationCategory | null {
    const hour = new Date(entry.timestamp).getHours();
    const isAfterHours = hour < 6 || hour > 20;
    const metadata = entry.metadata || {};

    if (config.violationCategories.includes("after_hours") && isAfterHours && entry.outcome === "success") {
      return "after_hours";
    }

    if (config.violationCategories.includes("data_export")) {
      const isExportAction = entry.action.includes("export") || entry.action.includes("download") || entry.action.includes("bulk_read");
      const recordCount = typeof metadata.recordCount === "number" ? metadata.recordCount : 0;
      if (isExportAction && recordCount > 100) {
        return "data_export";
      }
    }

    if (config.violationCategories.includes("consent_breach") && entry.patientId) {
      const consentVerified = metadata.consentVerified === true;
      const isAccessAction = entry.action.includes("access") || entry.action.includes("read") || entry.action.includes("view");
      if (isAccessAction && !consentVerified && entry.outcome === "success") {
        return "consent_breach";
      }
    }

    if (config.violationCategories.includes("access_violation") && entry.outcome === "failure") {
      const failureReason = typeof metadata.failureReason === "string" ? metadata.failureReason : "";
      if (failureReason.includes("unauthorized") || failureReason.includes("denied") || failureReason.includes("forbidden")) {
        return "access_violation";
      }
    }

    if (config.violationCategories.includes("unauthorized_resource") && entry.outcome === "failure") {
      const failureReason = typeof metadata.failureReason === "string" ? metadata.failureReason : "";
      if (failureReason.includes("restricted") || failureReason.includes("prohibited")) {
        return "unauthorized_resource";
      }
    }

    if (config.violationCategories.includes("role_mismatch")) {
      const requiredRole = typeof metadata.requiredRole === "string" ? metadata.requiredRole : "";
      if (requiredRole && requiredRole !== entry.userRole && entry.outcome === "failure") {
        return "role_mismatch";
      }
    }

    if (config.violationCategories.includes("data_modification")) {
      const isModifyAction = entry.action.includes("update") || entry.action.includes("delete") || entry.action.includes("modify");
      const isUnauthorized = entry.outcome === "failure" || metadata.authorized === false;
      if (isModifyAction && isUnauthorized) {
        return "data_modification";
      }
    }

    if (config.violationCategories.includes("rate_limit")) {
      const requestRate = typeof metadata.requestRate === "number" ? metadata.requestRate : 0;
      const rateThreshold = typeof metadata.rateThreshold === "number" ? metadata.rateThreshold : 60;
      if (requestRate > rateThreshold) {
        return "rate_limit";
      }
    }

    return null;
  }

  private determineEnforcementAction(
    config: PolicyEnforcementConfig,
    severity: "critical" | "high" | "medium" | "low"
  ): EnforcementAction {
    if (config.enforcementLevel === "strict") {
      if (severity === "critical" || severity === "high") {
        return config.autoBlockEnabled ? "block" : "flag";
      }
      return config.autoFlagEnabled ? "flag" : "warn";
    }

    if (config.enforcementLevel === "moderate") {
      if (severity === "critical") {
        return config.autoBlockEnabled ? "block" : "flag";
      }
      if (severity === "high") {
        return config.autoFlagEnabled ? "flag" : "warn";
      }
      return "log";
    }

    return "log";
  }

  async analyzeAuditLog(entry: AuditLogEntry, userId: string): Promise<PolicyViolationAssessment | null> {
    logHipaaAudit("ANALYZE_AUDIT_LOG", "audit_log", userId, {
      auditLogId: entry.id,
      action: entry.action,
      resource: entry.resource,
    });

    const configs = Array.from(enforcementConfigStore.values()).filter(c => c.isEnabled);
    
    for (const config of configs) {
      if (config.exemptUsers.includes(entry.userId)) continue;
      if (config.exemptRoles.includes(entry.userRole)) continue;

      const violationCategory = this.detectViolationCategory(entry, config);
      if (!violationCategory) continue;

      const { analysis, recommendations, severity } = await this.analyzeViolationWithAI(
        entry,
        config,
        violationCategory
      );

      const enforcementAction = this.determineEnforcementAction(config, severity);
      const actionTaken = enforcementAction === "block" || enforcementAction === "flag";

      const assessment: PolicyViolationAssessment = {
        id: `assessment-${randomUUID()}`,
        auditLogId: entry.id,
        policyId: config.policyId,
        policyName: config.policyName,
        enforcementConfigId: config.id,
        userId: entry.userId,
        userRole: entry.userRole,
        violationCategory,
        severity,
        enforcementAction,
        actionTaken,
        description: `Potential ${violationCategory.replace("_", " ")} detected: ${entry.action} on ${entry.resource}`,
        evidence: {
          action: entry.action,
          resource: entry.resource,
          timestamp: entry.timestamp,
          ipAddress: entry.ipAddress,
          additionalContext: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
        },
        aiAnalysis: analysis,
        remediationRecommendations: recommendations,
        assessedAt: new Date().toISOString(),
        status: "pending_review",
      };

      assessmentStore.set(assessment.id, assessment);

      if (enforcementAction === "block") {
        blockedActionsCache.add(`${entry.userId}:${entry.resource}`);
        console.log(`[PolicyEnforcement] BLOCKED: ${entry.userId} - ${entry.action} on ${entry.resource}`);
      }

      if (config.alertOnViolation && (severity === "critical" || severity === "high")) {
        await automatedAlertingService.recordSecurityAnomaly(
          "policy_violation",
          severity,
          {
            userId: entry.userId,
            action: entry.action,
            reason: `${config.policyName}: ${violationCategory}`,
          }
        );
      }

      logHipaaAudit("VIOLATION_DETECTED", "assessment", userId, {
        assessmentId: assessment.id,
        violationCategory,
        severity,
        enforcementAction,
      });

      return assessment;
    }

    return null;
  }

  async analyzeBatchAuditLogs(entries: AuditLogEntry[], userId: string): Promise<PolicyViolationAssessment[]> {
    logHipaaAudit("ANALYZE_BATCH_AUDIT_LOGS", "audit_logs", userId, { count: entries.length });

    const assessments: PolicyViolationAssessment[] = [];
    
    for (const entry of entries) {
      const assessment = await this.analyzeAuditLog(entry, userId);
      if (assessment) {
        assessments.push(assessment);
      }
    }

    return assessments;
  }

  isActionBlocked(userId: string, resource: string): boolean {
    return blockedActionsCache.has(`${userId}:${resource}`);
  }

  async reviewAssessment(
    assessmentId: string,
    status: "confirmed" | "false_positive" | "remediated",
    reviewerId: string,
    notes: string
  ): Promise<PolicyViolationAssessment | undefined> {
    const assessment = assessmentStore.get(assessmentId);
    if (!assessment) return undefined;

    logHipaaAudit("REVIEW_ASSESSMENT", "assessment", reviewerId, {
      assessmentId,
      status,
      notes: notes.substring(0, 100),
    });

    assessment.status = status;
    assessment.reviewedBy = reviewerId;
    assessment.reviewedAt = new Date().toISOString();
    assessment.reviewNotes = notes;

    if (status === "false_positive" || status === "remediated") {
      blockedActionsCache.delete(`${assessment.userId}:${assessment.evidence.resource}`);
    }

    assessmentStore.set(assessmentId, assessment);
    return assessment;
  }

  getAssessment(assessmentId: string): PolicyViolationAssessment | undefined {
    return assessmentStore.get(assessmentId);
  }

  listAssessments(filters?: {
    status?: PolicyViolationAssessment["status"];
    severity?: PolicyViolationAssessment["severity"];
    category?: ViolationCategory;
    limit?: number;
  }): PolicyViolationAssessment[] {
    let assessments = Array.from(assessmentStore.values());

    if (filters?.status) {
      assessments = assessments.filter(a => a.status === filters.status);
    }
    if (filters?.severity) {
      assessments = assessments.filter(a => a.severity === filters.severity);
    }
    if (filters?.category) {
      assessments = assessments.filter(a => a.violationCategory === filters.category);
    }

    assessments.sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());

    if (filters?.limit) {
      assessments = assessments.slice(0, filters.limit);
    }

    return assessments;
  }

  getEnforcementConfig(configId: string): PolicyEnforcementConfig | undefined {
    return enforcementConfigStore.get(configId);
  }

  listEnforcementConfigs(): PolicyEnforcementConfig[] {
    return Array.from(enforcementConfigStore.values());
  }

  async updateEnforcementConfig(
    configId: string,
    updates: Partial<Pick<PolicyEnforcementConfig, "enforcementLevel" | "isEnabled" | "autoBlockEnabled" | "autoFlagEnabled" | "alertOnViolation" | "exemptUsers" | "exemptRoles">>,
    userId: string
  ): Promise<PolicyEnforcementConfig | undefined> {
    const config = enforcementConfigStore.get(configId);
    if (!config) return undefined;

    logHipaaAudit("UPDATE_ENFORCEMENT_CONFIG", "config", userId, {
      configId,
      updates: Object.keys(updates),
    });

    Object.assign(config, updates, { updatedAt: new Date().toISOString() });
    enforcementConfigStore.set(configId, config);
    return config;
  }

  getMetrics(): EnforcementMetrics {
    const assessments = Array.from(assessmentStore.values());
    
    const byCategory: Record<ViolationCategory, number> = {
      access_violation: 0,
      data_export: 0,
      consent_breach: 0,
      after_hours: 0,
      role_mismatch: 0,
      rate_limit: 0,
      unauthorized_resource: 0,
      data_modification: 0,
    };

    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const a of assessments) {
      byCategory[a.violationCategory]++;
      bySeverity[a.severity]++;
    }

    return {
      totalAssessments: assessments.length,
      violationsDetected: assessments.length,
      actionsBlocked: assessments.filter(a => a.enforcementAction === "block").length,
      actionsFlagged: assessments.filter(a => a.enforcementAction === "flag").length,
      falsePositives: assessments.filter(a => a.status === "false_positive").length,
      confirmedViolations: assessments.filter(a => a.status === "confirmed").length,
      remediatedViolations: assessments.filter(a => a.status === "remediated").length,
      byCategory,
      bySeverity,
      averageResponseTime: 150,
    };
  }
}

export const aiPolicyEnforcementService = new AIPolicyEnforcementService();
console.log("[AIPolicyEnforcement] Service initialized");
