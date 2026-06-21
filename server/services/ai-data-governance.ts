import OpenAI from "openai";
import { createHash, randomUUID } from "crypto";
import {
  DataPolicy,
  DataPolicyType,
  DataPolicyRule,
  GovernancePolicyViolation,
  ViolationSeverity,
  PolicyComplianceStatus,
  DataAccessReview,
  PolicyEnforcementAction,
  GovernancePolicyUpdate,
  DataGovernanceDashboard,
} from "@shared/schema";
import { automatedAlertingService } from "./automated-alerting";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data governance analyst specializing in regulatory compliance and data policy management.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing data access patterns and policy compliance
- Identifying potential data governance violations
- Suggesting policy updates for regulatory compliance (HIPAA, GDPR, SOC2)
- Recommending access control improvements
- Evaluating data retention and encryption policies
- Assessing audit trail completeness

All analysis must focus on DATA GOVERNANCE and REGULATORY COMPLIANCE, never clinical interpretation.`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${hashIdentifier(match)}]`
    );
}

const policyStore = new Map<string, DataPolicy>();
const violationStore = new Map<string, GovernancePolicyViolation>();
const accessReviewStore = new Map<string, DataAccessReview>();
const enforcementActionStore = new Map<string, PolicyEnforcementAction>();
const policyUpdateStore = new Map<string, GovernancePolicyUpdate>();
const policySuggestionStore = new Map<string, PolicyUpdateSuggestion>();

export type SuggestionPriority = "critical" | "high" | "medium" | "low";
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "implemented";
export type AmendmentType = "add_rule" | "modify_rule" | "remove_rule" | "change_enforcement" | "expand_data_types" | "update_regulatory_mapping";

export interface RuleAmendment {
  amendmentType: AmendmentType;
  targetRuleId?: string;
  proposedRule?: DataPolicyRule;
  currentValue?: string;
  proposedValue?: string;
  rationale: string;
  impactAssessment: string;
}

export interface EnforcementAmendment {
  currentLevel: string;
  proposedLevel: string;
  rationale: string;
  affectedActions: string[];
}

export interface DataTypeAmendment {
  action: "add" | "remove" | "modify";
  dataType: string;
  currentCoverage?: string;
  proposedCoverage: string;
  rationale: string;
}

export interface RegulatoryMappingAmendment {
  action: "add" | "update" | "remove";
  regulation: string;
  currentMapping?: string;
  proposedMapping: string;
  complianceGap?: string;
  rationale: string;
}

export interface PolicyUpdateSuggestion {
  id: string;
  policyId: string;
  policyName: string;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  analysisSource: "violation_pattern" | "remediation_backlog" | "compliance_gap" | "proactive";
  violationsAnalyzed: number;
  remediationItemsAnalyzed: number;
  ruleAmendments: RuleAmendment[];
  enforcementAmendments: EnforcementAmendment[];
  dataTypeAmendments: DataTypeAmendment[];
  regulatoryMappingAmendments: RegulatoryMappingAmendment[];
  overallRationale: string;
  expectedImpact: {
    violationReduction: string;
    complianceImprovement: string;
    operationalImpact: string;
  };
  aiConfidenceScore: number;
  generatedAt: string;
  generatedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  implementedAt?: string;
}

export interface PolicyGapAnalysis {
  policyId: string;
  policyName: string;
  gapType: "outdated_rule" | "missing_coverage" | "weak_enforcement" | "regulatory_gap" | "pattern_mismatch";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  violationCount: number;
  affectedResourceTypes: string[];
  suggestedAction: string;
}

export type AccessReviewDecision = "auto_approved" | "auto_needs_action" | "flagged_for_review" | "pending";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AccessPatternAnalysis {
  userId: string;
  userRole: string;
  riskLevel: RiskLevel;
  complianceScore: number;
  accessFrequency: "normal" | "elevated" | "excessive";
  accessTimePattern: "business_hours" | "mixed" | "after_hours";
  resourceTypeDistribution: Record<string, number>;
  violationHistory: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recentTrend: "improving" | "stable" | "worsening";
  };
  policyAdherence: number;
}

export interface AutomatedAccessReviewResult {
  id: string;
  reviewId: string;
  decision: AccessReviewDecision;
  confidence: number;
  riskLevel: RiskLevel;
  patternAnalysis: AccessPatternAnalysis;
  reasoning: string;
  aiAnalysis?: string;
  requiresHumanReview: boolean;
  alertTriggered: boolean;
  suggestedActions: string[];
  createdAt: string;
  processedBy: "ai_automation" | "manual";
  humanReviewedAt?: string;
  humanReviewedBy?: string;
  humanDecision?: DataAccessReview["reviewStatus"];
}

export interface AccessReviewScheduleConfig {
  id: string;
  name: string;
  enabled: boolean;
  intervalHours: number;
  lastRunAt?: string;
  nextRunAt: string;
  autoApproveThreshold: number;
  flagForReviewThreshold: number;
  alertThreshold: number;
  targetRoles: string[];
  excludedUsers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessReviewBatchResult {
  id: string;
  scheduleId: string;
  startedAt: string;
  completedAt: string;
  totalReviewsProcessed: number;
  autoApproved: number;
  autoNeedsAction: number;
  flaggedForReview: number;
  alertsTriggered: number;
  errors: number;
  summary: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userRole: string;
  resourceType: string;
  resourceId: string;
  accessContext: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ViolationDetection {
  id: string;
  type: "access_anomaly" | "time_pattern" | "bulk_access" | "sensitive_data" | "cross_role" | "geographic" | "frequency";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedResources: string[];
  timestamp: string;
  confidence: number;
  evidence: string[];
}

export interface FullReviewAnalysis {
  reviewId: string;
  userId: string;
  auditLogsAnalyzed: number;
  timeRange: { start: string; end: string };
  accessSummary: {
    totalAccesses: number;
    uniqueResources: number;
    readCount: number;
    writeCount: number;
    deleteCount: number;
    afterHoursAccess: number;
    bulkOperations: number;
  };
  violationsDetected: ViolationDetection[];
  riskFactors: {
    factor: string;
    weight: number;
    description: string;
  }[];
  computedRiskScore: number;
  aiInsights?: string;
  decision: "approved" | "needs_action" | "flagged_for_admin";
  decisionConfidence: number;
  decisionReasoning: string;
  alertsTriggered: string[];
  suggestedActions: string[];
  processedAt: string;
}

const fullReviewAnalysisStore = new Map<string, FullReviewAnalysis>();

const automatedReviewResultStore = new Map<string, AutomatedAccessReviewResult>();
const reviewScheduleStore = new Map<string, AccessReviewScheduleConfig>();
const batchResultStore = new Map<string, AccessReviewBatchResult>();
let schedulerInterval: NodeJS.Timeout | null = null;

const NO_CDS_ACCESS_REVIEW_PROMPT = `You are a healthcare data access review analyst specializing in compliance and security.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing data access patterns for compliance with policies
- Assessing risk levels based on access behavior
- Recommending approval or flagging for human review
- Identifying suspicious access patterns requiring investigation
- Evaluating role-based access appropriateness

Focus ONLY on access control, compliance, and security aspects. Never interpret clinical data.`;

const NO_CDS_POLICY_ANALYSIS_PROMPT = `You are a healthcare data governance policy analyst specializing in regulatory compliance.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing policy violation patterns to identify gaps
- Recommending policy rule amendments for better compliance
- Suggesting enforcement level changes based on violation frequency
- Proposing data type coverage expansions
- Identifying regulatory mapping gaps

RESPONSE FORMAT:
Provide structured JSON with policy amendment recommendations focusing ONLY on governance and compliance improvements.`;

function sanitizeViolationForAI(violation: GovernancePolicyViolation): Record<string, unknown> {
  return {
    policyId: violation.policyId,
    policyName: violation.policyName,
    ruleId: violation.ruleId,
    violationType: violation.violationType,
    severity: violation.severity,
    description: sanitizePhi(violation.description),
    remediationStatus: violation.remediationStatus,
    resourceType: violation.affectedResource?.split("/")[0] || "Unknown",
  };
}

function initializeDefaultPolicies(): void {
  const defaultPolicies: DataPolicy[] = [
    {
      id: "policy-hipaa-access",
      name: "HIPAA Minimum Necessary Access",
      description: "Ensures access to PHI follows minimum necessary standard",
      policyType: "access_control",
      regulation: "HIPAA",
      version: "1.0",
      effectiveDate: "2024-01-01",
      rules: [
        {
          id: "rule-001",
          name: "Role-Based Access Enforcement",
          description: "Users can only access data appropriate to their role",
          condition: "user.role IN allowed_roles_for_resource",
          action: "deny",
          priority: 1,
          isEnabled: true,
          exceptions: ["emergency_access"],
        },
        {
          id: "rule-002",
          name: "Break-Glass Logging",
          description: "Log all emergency access with justification",
          condition: "access_type = 'emergency'",
          action: "log",
          priority: 2,
          isEnabled: true,
          exceptions: [],
        },
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: "system",
      metadata: { lastReviewDate: new Date().toISOString() },
    },
    {
      id: "policy-retention",
      name: "PHI Retention Policy",
      description: "Defines retention periods for different data types",
      policyType: "retention",
      regulation: "HIPAA",
      version: "1.0",
      effectiveDate: "2024-01-01",
      rules: [
        {
          id: "rule-003",
          name: "Medical Records Retention",
          description: "Retain medical records for minimum 7 years",
          condition: "resource_type IN ['Patient', 'Observation', 'Condition']",
          action: "log",
          priority: 1,
          isEnabled: true,
          exceptions: [],
        },
        {
          id: "rule-004",
          name: "Audit Log Retention",
          description: "Retain audit logs for minimum 6 years per HIPAA",
          condition: "resource_type = 'AuditEvent'",
          action: "log",
          priority: 1,
          isEnabled: true,
          exceptions: [],
        },
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: "system",
      metadata: {},
    },
    {
      id: "policy-encryption",
      name: "Data Encryption Standards",
      description: "Encryption requirements for PHI at rest and in transit",
      policyType: "encryption",
      regulation: "HIPAA",
      version: "1.0",
      effectiveDate: "2024-01-01",
      rules: [
        {
          id: "rule-005",
          name: "AES-256 At Rest",
          description: "All PHI must be encrypted with AES-256-GCM at rest",
          condition: "data_state = 'at_rest' AND contains_phi = true",
          action: "encrypt",
          priority: 1,
          isEnabled: true,
          exceptions: [],
        },
        {
          id: "rule-006",
          name: "TLS 1.2+ In Transit",
          description: "All PHI transmission must use TLS 1.2 or higher",
          condition: "data_state = 'in_transit' AND contains_phi = true",
          action: "encrypt",
          priority: 1,
          isEnabled: true,
          exceptions: [],
        },
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: "system",
      metadata: {},
    },
    {
      id: "policy-consent",
      name: "Patient Consent Management",
      description: "Consent requirements for data access and sharing",
      policyType: "consent",
      regulation: "GDPR",
      version: "1.0",
      effectiveDate: "2024-01-01",
      rules: [
        {
          id: "rule-007",
          name: "Explicit Consent Required",
          description: "Require explicit consent before data sharing",
          condition: "action = 'share' AND consent_status != 'granted'",
          action: "deny",
          priority: 1,
          isEnabled: true,
          exceptions: ["treatment", "legal_requirement"],
        },
        {
          id: "rule-008",
          name: "Consent Expiration Check",
          description: "Verify consent is current before access",
          condition: "consent_expiration < current_date",
          action: "require_approval",
          priority: 2,
          isEnabled: true,
          exceptions: [],
        },
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: "system",
      metadata: {},
    },
    {
      id: "policy-audit",
      name: "Comprehensive Audit Logging",
      description: "Audit trail requirements for all PHI access",
      policyType: "audit",
      regulation: "HIPAA",
      version: "1.0",
      effectiveDate: "2024-01-01",
      rules: [
        {
          id: "rule-009",
          name: "Log All PHI Access",
          description: "Create audit entry for every PHI access",
          condition: "resource_contains_phi = true",
          action: "log",
          priority: 1,
          isEnabled: true,
          exceptions: [],
        },
        {
          id: "rule-010",
          name: "Log Failed Access Attempts",
          description: "Log all failed access attempts for security monitoring",
          condition: "access_result = 'denied'",
          action: "log",
          priority: 1,
          isEnabled: true,
          exceptions: [],
        },
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: "system",
      metadata: {},
    },
  ];

  const sampleViolations: GovernancePolicyViolation[] = [
    {
      id: "violation-001",
      policyId: "policy-hipaa-access",
      policyName: "HIPAA Minimum Necessary Access",
      ruleId: "rule-001",
      violationType: "access_control",
      severity: "high",
      description: "User accessed patient records outside their assigned department",
      affectedResource: "Patient/patient-123",
      affectedUser: "user-456",
      detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      remediationStatus: "pending",
      metadata: { accessType: "read", department: "Cardiology" },
    },
    {
      id: "violation-002",
      policyId: "policy-consent",
      policyName: "Patient Consent Management",
      ruleId: "rule-007",
      violationType: "consent",
      severity: "medium",
      description: "Data shared without explicit patient consent on record",
      affectedResource: "Patient/patient-789",
      detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      remediationStatus: "in_progress",
      metadata: { shareDestination: "external_provider" },
    },
  ];

  defaultPolicies.forEach((p) => policyStore.set(p.id, p));
  sampleViolations.forEach((v) => violationStore.set(v.id, v));
}

initializeDefaultPolicies();

class AIDataGovernanceService {
  private auditLog: Array<Record<string, unknown>> = [];
  private accessPatterns: Map<string, Array<{ timestamp: string; resourceType: string; action: string }>> = new Map();

  constructor() {
    console.log("[AIDataGovernance] Service initialized");
    console.log(`[AIDataGovernance] Loaded ${policyStore.size} policies`);
  }

  private logAuditEvent(
    action: string,
    resource: string,
    userId: string,
    details: Record<string, unknown>
  ): void {
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

    const entry = {
      timestamp: new Date().toISOString(),
      action,
      resource,
      userId: hashIdentifier(userId),
      component: "AIDataGovernance",
      details: sanitizedDetails,
    };

    this.auditLog.push(entry);
    console.log(`[HIPAA_AUDIT] ${JSON.stringify(entry)}`);
  }

  async analyzeDataPractices(userId: string): Promise<{
    complianceScore: number;
    violations: GovernancePolicyViolation[];
    recommendations: string[];
  }> {
    this.logAuditEvent("ANALYZE_DATA_PRACTICES", "governance", userId, {});

    const allPolicies = Array.from(policyStore.values()).filter((p) => p.isActive);
    const violations = await this.detectViolations(allPolicies);
    const complianceScore = this.calculateComplianceScore(allPolicies, violations);

    let recommendations: string[] = [];
    if (openai) {
      recommendations = await this.generateAIRecommendations(violations, allPolicies);
    } else {
      recommendations = this.getDefaultRecommendations(violations);
    }

    this.logAuditEvent("DATA_PRACTICES_ANALYZED", "governance", userId, {
      complianceScore,
      violationCount: violations.length,
    });

    return { complianceScore, violations, recommendations };
  }

  private async detectViolations(policies: DataPolicy[]): Promise<GovernancePolicyViolation[]> {
    const detected: GovernancePolicyViolation[] = [];

    for (const policy of policies) {
      for (const rule of policy.rules.filter((r) => r.isEnabled)) {
        const violations = this.checkRuleCompliance(policy, rule);
        detected.push(...violations);
      }
    }

    return detected;
  }

  private checkRuleCompliance(policy: DataPolicy, rule: DataPolicyRule): GovernancePolicyViolation[] {
    const violations: GovernancePolicyViolation[] = [];

    if (policy.policyType === "access_control") {
      if (Math.random() > 0.85) {
        const violation: GovernancePolicyViolation = {
          id: `violation-${randomUUID()}`,
          policyId: policy.id,
          policyName: policy.name,
          ruleId: rule.id,
          violationType: policy.policyType,
          severity: this.determineSeverity(policy.policyType),
          description: `Potential ${rule.name} violation detected`,
          affectedResource: `Resource/${randomUUID().substring(0, 8)}`,
          detectedAt: new Date().toISOString(),
          remediationStatus: "pending",
          metadata: { ruleCondition: rule.condition },
        };
        violations.push(violation);
        violationStore.set(violation.id, violation);
      }
    }

    return violations;
  }

  private determineSeverity(policyType: DataPolicyType): ViolationSeverity {
    const severityMap: Record<DataPolicyType, ViolationSeverity> = {
      access_control: "high",
      encryption: "critical",
      consent: "high",
      breach_notification: "critical",
      audit: "medium",
      retention: "medium",
      data_classification: "low",
      cross_border_transfer: "high",
      anonymization: "medium",
    };
    return severityMap[policyType] || "medium";
  }

  private calculateComplianceScore(policies: DataPolicy[], violations: GovernancePolicyViolation[]): number {
    if (policies.length === 0) return 100;

    const baseScore = 100;
    const violationPenalties: Record<ViolationSeverity, number> = {
      critical: 15,
      high: 10,
      medium: 5,
      low: 2,
    };

    let penalty = 0;
    for (const v of violations) {
      penalty += violationPenalties[v.severity];
    }

    return Math.max(0, Math.min(100, baseScore - penalty));
  }

  private async generateAIRecommendations(
    violations: GovernancePolicyViolation[],
    policies: DataPolicy[]
  ): Promise<string[]> {
    if (!openai) return this.getDefaultRecommendations(violations);

    try {
      const violationSummary = violations
        .slice(0, 10)
        .map((v) => `- ${v.violationType}: ${v.description}`)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze these data governance violations and provide recommendations:

Violations:
${violationSummary || "No violations detected"}

Active policies: ${policies.length}
Policy types: ${Array.from(new Set(policies.map((p) => p.policyType))).join(", ")}

Provide 3-5 specific recommendations focusing ONLY on:
1. Access control improvements
2. Policy rule updates
3. Compliance gap remediation
4. Audit process enhancements

DO NOT provide any clinical or health-related recommendations.
Format as a JSON array of strings.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || "[]";
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as string[];
        }
      } catch {
        return [content.substring(0, 200)];
      }

      return this.getDefaultRecommendations(violations);
    } catch (error) {
      console.error("[AIDataGovernance] AI recommendations error:", error);
      return this.getDefaultRecommendations(violations);
    }
  }

  private getDefaultRecommendations(violations: GovernancePolicyViolation[]): string[] {
    const recommendations: string[] = [];

    const hasAccessViolations = violations.some((v) => v.violationType === "access_control");
    const hasConsentViolations = violations.some((v) => v.violationType === "consent");
    const hasCritical = violations.some((v) => v.severity === "critical");

    if (hasAccessViolations) {
      recommendations.push("Review and strengthen role-based access control policies");
      recommendations.push("Implement periodic access certification reviews");
    }

    if (hasConsentViolations) {
      recommendations.push("Enhance consent tracking and verification processes");
      recommendations.push("Implement automated consent expiration alerts");
    }

    if (hasCritical) {
      recommendations.push("Prioritize remediation of critical severity violations");
      recommendations.push("Conduct root cause analysis for critical policy breaches");
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring for policy compliance");
      recommendations.push("Schedule periodic policy review and updates");
    }

    return recommendations;
  }

  async suggestPolicyUpdates(policyId: string, userId: string): Promise<GovernancePolicyUpdate[]> {
    const policy = policyStore.get(policyId);
    if (!policy) return [];

    this.logAuditEvent("REQUEST_POLICY_UPDATES", "policy", userId, { policyId });

    const updates: GovernancePolicyUpdate[] = [];

    const recentViolations = Array.from(violationStore.values()).filter(
      (v) => v.policyId === policyId && new Date(v.detectedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    if (recentViolations.length > 5) {
      const update: GovernancePolicyUpdate = {
        id: `update-${randomUUID()}`,
        policyId,
        updateType: "change_scope",
        description: "Expand policy scope to address recurring violations",
        suggestedChanges: [
          {
            field: "rules",
            currentValue: policy.rules.length,
            suggestedValue: policy.rules.length + 1,
            rationale: `${recentViolations.length} violations detected in last 30 days suggest need for additional rules`,
          },
        ],
        aiConfidence: 0.75,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      updates.push(update);
      policyUpdateStore.set(update.id, update);
    }

    if (openai) {
      const aiUpdate = await this.generateAIPolicyUpdate(policy, recentViolations);
      if (aiUpdate) {
        updates.push(aiUpdate);
        policyUpdateStore.set(aiUpdate.id, aiUpdate);
      }
    }

    this.logAuditEvent("POLICY_UPDATES_SUGGESTED", "policy", userId, {
      policyId,
      updateCount: updates.length,
    });

    return updates;
  }

  private async generateAIPolicyUpdate(
    policy: DataPolicy,
    violations: GovernancePolicyViolation[]
  ): Promise<GovernancePolicyUpdate | null> {
    if (!openai) return null;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this data governance policy and suggest improvements:

Policy: ${policy.name}
Type: ${policy.policyType}
Regulation: ${policy.regulation}
Current rules: ${policy.rules.length}
Recent violations: ${violations.length}

Suggest ONE specific policy update focusing on:
- Strengthening access controls
- Improving audit coverage
- Enhancing compliance enforcement

Respond with JSON:
{
  "updateType": "add_rule" | "modify_rule" | "change_scope",
  "description": "...",
  "rationale": "...",
  "confidence": 0.0-1.0
}

DO NOT suggest any clinical or health-related changes.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: `update-${randomUUID()}`,
          policyId: policy.id,
          updateType: parsed.updateType || "modify_rule",
          description: parsed.description || "AI-suggested policy improvement",
          suggestedChanges: [
            {
              field: "rules",
              currentValue: policy.rules.length,
              suggestedValue: "See description",
              rationale: parsed.rationale || "Based on violation pattern analysis",
            },
          ],
          aiConfidence: parsed.confidence || 0.7,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error("[AIDataGovernance] AI policy update error:", error);
    }

    return null;
  }

  async conductAccessReview(
    userId: string,
    reviewPeriodDays: number = 30,
    reviewerId: string
  ): Promise<DataAccessReview> {
    this.logAuditEvent("CONDUCT_ACCESS_REVIEW", "access_review", reviewerId, {
      targetUserId: userId,
      reviewPeriodDays,
    });

    const endDate = new Date();
    const startDate = new Date(Date.now() - reviewPeriodDays * 24 * 60 * 60 * 1000);

    const accessedResources = this.generateSampleAccessData();

    const violations = Array.from(violationStore.values()).filter(
      (v) =>
        v.affectedUser === userId &&
        new Date(v.detectedAt) >= startDate &&
        new Date(v.detectedAt) <= endDate
    );

    const riskScore = this.calculateAccessRiskScore(accessedResources, violations);
    const complianceStatus = this.determineComplianceStatus(violations, riskScore);

    const review: DataAccessReview = {
      id: `review-${randomUUID()}`,
      reviewPeriod: { start: startDate.toISOString(), end: endDate.toISOString() },
      userId: hashIdentifier(userId),
      userRole: "provider",
      accessedResources,
      policyCompliance: complianceStatus,
      violations,
      riskScore,
      reviewStatus: "pending",
      recommendations: this.generateAccessRecommendations(violations, riskScore),
      createdAt: new Date().toISOString(),
    };

    accessReviewStore.set(review.id, review);

    if (riskScore > 70) {
      automatedAlertingService.recordMetric("high_risk_access_review", 1, {
        userId: hashIdentifier(userId),
        riskScore,
      });
    }

    this.logAuditEvent("ACCESS_REVIEW_COMPLETED", "access_review", reviewerId, {
      reviewId: review.id,
      riskScore,
      complianceStatus,
    });

    return review;
  }

  private generateSampleAccessData(): DataAccessReview["accessedResources"] {
    return [
      {
        resourceType: "Patient",
        resourceId: hashIdentifier(`patient-${randomUUID()}`),
        accessType: "read",
        accessCount: Math.floor(Math.random() * 50) + 10,
        lastAccessedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        resourceType: "Observation",
        resourceId: hashIdentifier(`obs-${randomUUID()}`),
        accessType: "read",
        accessCount: Math.floor(Math.random() * 100) + 20,
        lastAccessedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        resourceType: "MedicationRequest",
        resourceId: hashIdentifier(`med-${randomUUID()}`),
        accessType: "write",
        accessCount: Math.floor(Math.random() * 20) + 5,
        lastAccessedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  private calculateAccessRiskScore(
    accessedResources: DataAccessReview["accessedResources"],
    violations: GovernancePolicyViolation[]
  ): number {
    let score = 0;

    for (const v of violations) {
      switch (v.severity) {
        case "critical":
          score += 25;
          break;
        case "high":
          score += 15;
          break;
        case "medium":
          score += 8;
          break;
        case "low":
          score += 3;
          break;
      }
    }

    const totalAccess = accessedResources.reduce((sum, r) => sum + r.accessCount, 0);
    if (totalAccess > 500) score += 10;
    if (totalAccess > 1000) score += 15;

    return Math.min(100, score);
  }

  private determineComplianceStatus(
    violations: GovernancePolicyViolation[],
    riskScore: number
  ): PolicyComplianceStatus {
    if (violations.some((v) => v.severity === "critical")) return "non_compliant";
    if (riskScore > 70) return "non_compliant";
    if (riskScore > 40 || violations.length > 3) return "partial";
    if (violations.length === 0 && riskScore < 20) return "compliant";
    return "partial";
  }

  private generateAccessRecommendations(violations: GovernancePolicyViolation[], riskScore: number): string[] {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push("Immediate access review required - elevated risk detected");
      recommendations.push("Consider temporary access restriction pending investigation");
    }

    if (violations.some((v) => v.violationType === "access_control")) {
      recommendations.push("Review role-based permissions for this user");
      recommendations.push("Verify user's current job responsibilities match access levels");
    }

    if (recommendations.length === 0) {
      recommendations.push("Access patterns within normal parameters");
      recommendations.push("Schedule routine follow-up review in 90 days");
    }

    return recommendations;
  }

  async enforcePolicy(
    policyId: string,
    targetUserId: string | undefined,
    targetResource: string | undefined,
    enforcerId: string
  ): Promise<PolicyEnforcementAction> {
    const policy = policyStore.get(policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    this.logAuditEvent("ENFORCE_POLICY", "enforcement", enforcerId, {
      policyId,
      targetUserId,
      targetResource,
    });

    const action: PolicyEnforcementAction = {
      id: `action-${randomUUID()}`,
      policyId,
      actionType: this.determineEnforcementAction(policy),
      targetUser: targetUserId ? hashIdentifier(targetUserId) : undefined,
      targetResource,
      reason: `Enforcement of ${policy.name} policy`,
      executedAt: new Date().toISOString(),
      executedBy: hashIdentifier(enforcerId),
      result: "success",
      rollbackAvailable: true,
      metadata: { policyVersion: policy.version },
    };

    enforcementActionStore.set(action.id, action);

    automatedAlertingService.recordMetric("policy_enforcement_action", 1, {
      policyId,
      actionType: action.actionType,
    });

    this.logAuditEvent("POLICY_ENFORCED", "enforcement", enforcerId, {
      actionId: action.id,
      actionType: action.actionType,
      result: action.result,
    });

    return action;
  }

  private determineEnforcementAction(policy: DataPolicy): PolicyEnforcementAction["actionType"] {
    switch (policy.policyType) {
      case "access_control":
        return "block";
      case "consent":
        return "require_mfa";
      case "audit":
        return "log";
      case "encryption":
        return "notify";
      default:
        return "warn";
    }
  }

  async approveAccessReview(
    reviewId: string,
    decision: "approved" | "revoked" | "modified",
    notes: string,
    reviewerId: string
  ): Promise<DataAccessReview | null> {
    const review = accessReviewStore.get(reviewId);
    if (!review) return null;

    review.reviewStatus = decision;
    review.reviewedBy = hashIdentifier(reviewerId);
    review.reviewedAt = new Date().toISOString();
    review.reviewNotes = notes;

    this.logAuditEvent("ACCESS_REVIEW_DECISION", "access_review", reviewerId, {
      reviewId,
      decision,
      notes: notes.substring(0, 100),
    });

    return review;
  }

  async approvePolicyUpdate(
    updateId: string,
    approved: boolean,
    reviewerId: string
  ): Promise<GovernancePolicyUpdate | null> {
    const update = policyUpdateStore.get(updateId);
    if (!update) return null;

    update.status = approved ? "approved" : "rejected";
    update.reviewedBy = hashIdentifier(reviewerId);
    update.reviewedAt = new Date().toISOString();

    if (approved) {
      update.appliedAt = new Date().toISOString();
    }

    this.logAuditEvent("POLICY_UPDATE_DECISION", "policy", reviewerId, {
      updateId,
      approved,
      policyId: update.policyId,
    });

    return update;
  }

  async getDashboard(): Promise<DataGovernanceDashboard> {
    const allPolicies = Array.from(policyStore.values());
    const allViolations = Array.from(violationStore.values());
    const allReviews = Array.from(accessReviewStore.values());
    const allUpdates = Array.from(policyUpdateStore.values());
    const allActions = Array.from(enforcementActionStore.values());

    const openViolations = allViolations.filter((v) => v.remediationStatus === "pending");
    const pendingReviews = allReviews.filter((r) => r.reviewStatus === "pending");
    const pendingUpdates = allUpdates.filter((u) => u.status === "pending");

    const policyComplianceByType: Record<DataPolicyType, PolicyComplianceStatus> = {
      access_control: "compliant",
      retention: "compliant",
      encryption: "compliant",
      consent: "partial",
      audit: "compliant",
      data_classification: "compliant",
      cross_border_transfer: "unknown",
      anonymization: "compliant",
      breach_notification: "compliant",
    };

    for (const v of openViolations) {
      if (v.severity === "critical" || v.severity === "high") {
        policyComplianceByType[v.violationType] = "non_compliant";
      } else if (policyComplianceByType[v.violationType] === "compliant") {
        policyComplianceByType[v.violationType] = "partial";
      }
    }

    const violationTrend: DataGovernanceDashboard["violationTrend"] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      violationTrend.push({
        date: date.toISOString().split("T")[0],
        count: Math.floor(Math.random() * 5),
        severity: (["low", "medium", "high", "critical"] as ViolationSeverity[])[
          Math.floor(Math.random() * 4)
        ],
      });
    }

    const complianceScore = this.calculateComplianceScore(allPolicies, openViolations);

    return {
      totalPolicies: allPolicies.length,
      activePolicies: allPolicies.filter((p) => p.isActive).length,
      complianceScore,
      openViolations: openViolations.length,
      pendingReviews: pendingReviews.length,
      recentViolations: allViolations.slice(0, 10),
      policyComplianceByType,
      violationTrend,
      pendingPolicyUpdates: pendingUpdates,
      recentEnforcementActions: allActions.slice(0, 10),
    };
  }

  listPolicies(filters?: { type?: DataPolicyType; isActive?: boolean }): DataPolicy[] {
    let results = Array.from(policyStore.values());

    if (filters?.type) {
      results = results.filter((p) => p.policyType === filters.type);
    }
    if (filters?.isActive !== undefined) {
      results = results.filter((p) => p.isActive === filters.isActive);
    }

    return results;
  }

  getPolicy(policyId: string): DataPolicy | undefined {
    return policyStore.get(policyId);
  }

  listViolations(filters?: {
    policyId?: string;
    severity?: ViolationSeverity;
    status?: GovernancePolicyViolation["remediationStatus"];
    limit?: number;
  }): GovernancePolicyViolation[] {
    let results = Array.from(violationStore.values());

    if (filters?.policyId) {
      results = results.filter((v) => v.policyId === filters.policyId);
    }
    if (filters?.severity) {
      results = results.filter((v) => v.severity === filters.severity);
    }
    if (filters?.status) {
      results = results.filter((v) => v.remediationStatus === filters.status);
    }

    results.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async acknowledgeViolation(
    violationId: string,
    userId: string
  ): Promise<GovernancePolicyViolation | null> {
    const violation = violationStore.get(violationId);
    if (!violation) return null;

    violation.acknowledgedAt = new Date().toISOString();
    violation.acknowledgedBy = hashIdentifier(userId);
    violation.remediationStatus = "in_progress";

    this.logAuditEvent("VIOLATION_ACKNOWLEDGED", "violation", userId, { violationId });
    return violation;
  }

  async resolveViolation(
    violationId: string,
    userId: string,
    notes: string
  ): Promise<GovernancePolicyViolation | null> {
    const violation = violationStore.get(violationId);
    if (!violation) return null;

    violation.resolvedAt = new Date().toISOString();
    violation.resolutionNotes = notes;
    violation.remediationStatus = "resolved";

    this.logAuditEvent("VIOLATION_RESOLVED", "violation", userId, {
      violationId,
      notes: notes.substring(0, 100),
    });
    return violation;
  }

  getAccessReview(reviewId: string): DataAccessReview | undefined {
    return accessReviewStore.get(reviewId);
  }

  listAccessReviews(filters?: {
    status?: DataAccessReview["reviewStatus"];
    limit?: number;
  }): DataAccessReview[] {
    let results = Array.from(accessReviewStore.values());

    if (filters?.status) {
      results = results.filter((r) => r.reviewStatus === filters.status);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async analyzePolicyGaps(userId: string): Promise<PolicyGapAnalysis[]> {
    this.logAuditEvent("ANALYZE_POLICY_GAPS", "governance", userId, {});

    const violations = Array.from(violationStore.values());
    const policies = Array.from(policyStore.values());
    const gaps: PolicyGapAnalysis[] = [];

    const violationsByPolicy = new Map<string, GovernancePolicyViolation[]>();
    for (const v of violations) {
      const existing = violationsByPolicy.get(v.policyId) || [];
      existing.push(v);
      violationsByPolicy.set(v.policyId, existing);
    }

    for (const policy of policies) {
      const policyViolations = violationsByPolicy.get(policy.id) || [];

      if (policyViolations.length >= 3) {
        const resourceTypes = new Set(policyViolations.map(v => v.affectedResource?.split("/")[0] || "Unknown"));
        const highSeverityCount = policyViolations.filter(v => v.severity === "critical" || v.severity === "high").length;

        gaps.push({
          policyId: policy.id,
          policyName: policy.name,
          gapType: highSeverityCount > 2 ? "weak_enforcement" : "pattern_mismatch",
          severity: highSeverityCount > 2 ? "high" : "medium",
          description: `Policy has ${policyViolations.length} violations indicating potential gaps in rules or enforcement`,
          violationCount: policyViolations.length,
          affectedResourceTypes: Array.from(resourceTypes),
          suggestedAction: highSeverityCount > 2 ? "Strengthen enforcement level" : "Review and update rules",
        });
      }

      const policyAge = Date.now() - new Date(policy.updatedAt || policy.createdAt).getTime();
      const daysOld = Math.floor(policyAge / (24 * 60 * 60 * 1000));
      if (daysOld > 180) {
        gaps.push({
          policyId: policy.id,
          policyName: policy.name,
          gapType: "outdated_rule",
          severity: daysOld > 365 ? "high" : "medium",
          description: `Policy has not been updated in ${daysOld} days`,
          violationCount: policyViolations.length,
          affectedResourceTypes: [],
          suggestedAction: "Review policy for regulatory updates and best practices",
        });
      }
    }

    this.logAuditEvent("POLICY_GAPS_ANALYZED", "governance", userId, { gapsFound: gaps.length });
    return gaps;
  }

  async suggestPolicyAmendments(
    policyId: string,
    userId: string,
    includeRemediationData: boolean = true
  ): Promise<PolicyUpdateSuggestion> {
    this.logAuditEvent("SUGGEST_POLICY_AMENDMENTS", "governance", userId, { policyId });

    const policy = policyStore.get(policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    const violations = Array.from(violationStore.values()).filter(v => v.policyId === policyId);
    const remediationItems = includeRemediationData ? await this.getRelatedRemediationItems(policyId) : [];

    const ruleAmendments: RuleAmendment[] = [];
    const enforcementAmendments: EnforcementAmendment[] = [];
    const dataTypeAmendments: DataTypeAmendment[] = [];
    const regulatoryMappingAmendments: RegulatoryMappingAmendment[] = [];

    const violationsByRule = new Map<string, GovernancePolicyViolation[]>();
    for (const v of violations) {
      const existing = violationsByRule.get(v.ruleId) || [];
      existing.push(v);
      violationsByRule.set(v.ruleId, existing);
    }

    for (const rule of policy.rules) {
      const ruleViolations = violationsByRule.get(rule.id) || [];
      if (ruleViolations.length >= 2) {
        const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const v of ruleViolations) {
          severityCounts[v.severity]++;
        }

        if (severityCounts.critical > 0 || severityCounts.high >= 2) {
          ruleAmendments.push({
            amendmentType: "modify_rule",
            targetRuleId: rule.id,
            currentValue: rule.condition,
            proposedValue: `${rule.condition} AND enhanced_validation = true`,
            rationale: `Rule has ${ruleViolations.length} violations (${severityCounts.critical} critical, ${severityCounts.high} high). Condition should be strengthened.`,
            impactAssessment: "May increase access denials but will reduce compliance violations",
          });
        }
      }
    }

    const uniqueResourceTypes = new Set<string>();
    for (const v of violations) {
      const resourceType = v.affectedResource?.split("/")[0];
      if (resourceType) uniqueResourceTypes.add(resourceType);
    }

    const coveredTypes = new Set<string>();
    for (const rule of policy.rules) {
      const matches = rule.condition.match(/resource_type\s*(=|IN)\s*\[?'?([^'\]]+)/gi);
      if (matches) {
        for (const m of matches) {
          const types = m.replace(/resource_type\s*(=|IN)\s*\[?'?/gi, "").split(",");
          types.forEach(t => coveredTypes.add(t.trim().replace(/['\]]/g, "")));
        }
      }
    }

    for (const resourceType of Array.from(uniqueResourceTypes)) {
      if (!coveredTypes.has(resourceType) && resourceType !== "Unknown") {
        dataTypeAmendments.push({
          action: "add",
          dataType: resourceType,
          proposedCoverage: "full",
          rationale: `Resource type '${resourceType}' has violations but is not explicitly covered in policy rules`,
        });
      }
    }

    const highSeverityRatio = violations.filter(v => v.severity === "critical" || v.severity === "high").length / Math.max(violations.length, 1);
    if (highSeverityRatio > 0.5) {
      enforcementAmendments.push({
        currentLevel: "moderate",
        proposedLevel: "strict",
        rationale: `${Math.round(highSeverityRatio * 100)}% of violations are high/critical severity. Stricter enforcement recommended.`,
        affectedActions: ["block", "require_mfa", "notify"],
      });
    }

    const regulatoryGaps = this.identifyRegulatoryGaps(policy, violations);
    regulatoryMappingAmendments.push(...regulatoryGaps);

    let aiAnalysis: string | undefined;
    let aiConfidenceScore = 0.7;

    if (openai && violations.length > 0) {
      try {
        const analysisResult = await this.generateAIPolicyAnalysis(policy, violations, remediationItems);
        aiAnalysis = analysisResult.analysis;
        aiConfidenceScore = analysisResult.confidence;

        if (analysisResult.additionalAmendments) {
          ruleAmendments.push(...analysisResult.additionalAmendments.rules || []);
          enforcementAmendments.push(...analysisResult.additionalAmendments.enforcement || []);
          dataTypeAmendments.push(...analysisResult.additionalAmendments.dataTypes || []);
          regulatoryMappingAmendments.push(...analysisResult.additionalAmendments.regulatory || []);
        }
      } catch (error) {
        console.error("[AIDataGovernance] AI analysis failed:", error);
      }
    }

    const priority = this.calculateSuggestionPriority(violations, ruleAmendments, enforcementAmendments);

    const suggestion: PolicyUpdateSuggestion = {
      id: `suggestion-${randomUUID()}`,
      policyId: policy.id,
      policyName: policy.name,
      priority,
      status: "pending",
      analysisSource: remediationItems.length > 0 ? "remediation_backlog" : "violation_pattern",
      violationsAnalyzed: violations.length,
      remediationItemsAnalyzed: remediationItems.length,
      ruleAmendments,
      enforcementAmendments,
      dataTypeAmendments,
      regulatoryMappingAmendments,
      overallRationale: aiAnalysis || this.generateDefaultRationale(violations, ruleAmendments),
      expectedImpact: {
        violationReduction: `${Math.min(Math.round(ruleAmendments.length * 15 + enforcementAmendments.length * 20), 80)}%`,
        complianceImprovement: `${Math.min(Math.round((ruleAmendments.length + regulatoryMappingAmendments.length) * 10), 50)}%`,
        operationalImpact: enforcementAmendments.length > 0 ? "Moderate - stricter controls may require workflow adjustments" : "Low - minimal operational changes expected",
      },
      aiConfidenceScore,
      generatedAt: new Date().toISOString(),
      generatedBy: hashIdentifier(userId),
    };

    policySuggestionStore.set(suggestion.id, suggestion);

    this.logAuditEvent("POLICY_AMENDMENTS_SUGGESTED", "governance", userId, {
      suggestionId: suggestion.id,
      policyId,
      ruleAmendments: ruleAmendments.length,
      enforcementAmendments: enforcementAmendments.length,
      dataTypeAmendments: dataTypeAmendments.length,
      regulatoryAmendments: regulatoryMappingAmendments.length,
    });

    return suggestion;
  }

  private async getRelatedRemediationItems(policyId: string): Promise<Array<{ id: string; category: string; severity: string }>> {
    try {
      const { aiBacklogAnalysisService } = await import("./ai-backlog-analysis");
      const backlog = aiBacklogAnalysisService.getBacklog();
      return backlog
        .filter(item => item.category.includes(policyId.replace("policy-", "")))
        .map(item => ({ id: item.id, category: item.category, severity: item.severity }));
    } catch {
      return [];
    }
  }

  private identifyRegulatoryGaps(policy: DataPolicy, violations: GovernancePolicyViolation[]): RegulatoryMappingAmendment[] {
    const amendments: RegulatoryMappingAmendment[] = [];

    const regulations = ["HIPAA", "GDPR", "SOC2", "HITECH", "CCPA"];
    const coveredRegulations = new Set([policy.regulation]);

    for (const v of violations) {
      if (v.violationType === "consent" && !coveredRegulations.has("GDPR")) {
        amendments.push({
          action: "add",
          regulation: "GDPR",
          proposedMapping: "Article 6 - Lawfulness of Processing",
          complianceGap: "Consent violations suggest GDPR compliance mapping needed",
          rationale: `${violations.filter(vio => vio.violationType === "consent").length} consent-related violations detected`,
        });
        coveredRegulations.add("GDPR");
      }

      if (v.violationType === "access_control" && !coveredRegulations.has("HIPAA")) {
        amendments.push({
          action: "add",
          regulation: "HIPAA",
          proposedMapping: "§164.312 - Technical Safeguards",
          complianceGap: "Access control violations require HIPAA technical safeguard mapping",
          rationale: `${violations.filter(vio => vio.violationType === "access_control").length} access control violations detected`,
        });
        coveredRegulations.add("HIPAA");
      }
    }

    return amendments;
  }

  private async generateAIPolicyAnalysis(
    policy: DataPolicy,
    violations: GovernancePolicyViolation[],
    remediationItems: Array<{ id: string; category: string; severity: string }>
  ): Promise<{
    analysis: string;
    confidence: number;
    additionalAmendments?: {
      rules?: RuleAmendment[];
      enforcement?: EnforcementAmendment[];
      dataTypes?: DataTypeAmendment[];
      regulatory?: RegulatoryMappingAmendment[];
    };
  }> {
    if (!openai) {
      return { analysis: "", confidence: 0.5 };
    }

    const sanitizedViolations = violations.slice(0, 20).map(sanitizeViolationForAI);
    const sanitizedPolicy = {
      id: policy.id,
      name: policy.name,
      policyType: policy.policyType,
      regulation: policy.regulation,
      rulesCount: policy.rules.length,
      rulesSummary: policy.rules.map(r => ({ id: r.id, name: r.name, action: r.action })),
    };

    const prompt = `Analyze the following data governance policy and its violation patterns to recommend amendments:

POLICY:
${JSON.stringify(sanitizedPolicy, null, 2)}

VIOLATIONS (${violations.length} total, showing first 20):
${JSON.stringify(sanitizedViolations, null, 2)}

REMEDIATION BACKLOG ITEMS: ${remediationItems.length}

Based on this data, provide:
1. A brief analysis of policy gaps (2-3 sentences)
2. Specific recommendations for rule amendments
3. Whether enforcement level should change
4. Any additional data types that should be covered
5. Regulatory mapping improvements needed

Focus ONLY on governance and compliance improvements. DO NOT provide any clinical recommendations.

Respond in JSON format:
{
  "analysis": "brief analysis text",
  "confidence": 0.0-1.0,
  "suggestedRules": [{"name": "rule name", "condition": "condition", "action": "action", "rationale": "why"}],
  "enforcementChange": {"needed": boolean, "from": "current", "to": "proposed", "rationale": "why"},
  "dataTypeCoverage": [{"type": "FHIR resource type", "rationale": "why"}],
  "regulatoryMappings": [{"regulation": "name", "section": "section", "rationale": "why"}]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_POLICY_ANALYSIS_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { analysis: "", confidence: 0.5 };
      }

      const parsed = JSON.parse(content);
      const additionalAmendments: {
        rules?: RuleAmendment[];
        enforcement?: EnforcementAmendment[];
        dataTypes?: DataTypeAmendment[];
        regulatory?: RegulatoryMappingAmendment[];
      } = {};

      if (parsed.suggestedRules?.length > 0) {
        additionalAmendments.rules = parsed.suggestedRules.map((r: { name: string; condition: string; action: string; rationale: string }) => ({
          amendmentType: "add_rule" as AmendmentType,
          proposedRule: {
            id: `rule-ai-${randomUUID().substring(0, 8)}`,
            name: r.name,
            description: r.rationale,
            condition: r.condition,
            action: r.action,
            priority: 10,
            isEnabled: true,
            exceptions: [],
          },
          rationale: r.rationale,
          impactAssessment: "AI-recommended rule to address identified gaps",
        }));
      }

      if (parsed.enforcementChange?.needed) {
        additionalAmendments.enforcement = [{
          currentLevel: parsed.enforcementChange.from || "moderate",
          proposedLevel: parsed.enforcementChange.to || "strict",
          rationale: parsed.enforcementChange.rationale || "AI analysis suggests stricter enforcement",
          affectedActions: ["block", "require_mfa"],
        }];
      }

      if (parsed.dataTypeCoverage?.length > 0) {
        additionalAmendments.dataTypes = parsed.dataTypeCoverage.map((d: { type: string; rationale: string }) => ({
          action: "add" as const,
          dataType: d.type,
          proposedCoverage: "full",
          rationale: d.rationale,
        }));
      }

      if (parsed.regulatoryMappings?.length > 0) {
        additionalAmendments.regulatory = parsed.regulatoryMappings.map((r: { regulation: string; section: string; rationale: string }) => ({
          action: "add" as const,
          regulation: r.regulation,
          proposedMapping: r.section,
          rationale: r.rationale,
        }));
      }

      return {
        analysis: parsed.analysis || "",
        confidence: parsed.confidence || 0.7,
        additionalAmendments,
      };
    } catch (error) {
      console.error("[AIDataGovernance] AI policy analysis error:", error);
      return { analysis: "", confidence: 0.5 };
    }
  }

  private calculateSuggestionPriority(
    violations: GovernancePolicyViolation[],
    ruleAmendments: RuleAmendment[],
    enforcementAmendments: EnforcementAmendment[]
  ): SuggestionPriority {
    const criticalViolations = violations.filter(v => v.severity === "critical").length;
    const highViolations = violations.filter(v => v.severity === "high").length;

    if (criticalViolations > 0 || (highViolations >= 3 && enforcementAmendments.length > 0)) {
      return "critical";
    }
    if (highViolations >= 2 || ruleAmendments.length >= 3) {
      return "high";
    }
    if (violations.length >= 5 || ruleAmendments.length >= 2) {
      return "medium";
    }
    return "low";
  }

  private generateDefaultRationale(violations: GovernancePolicyViolation[], ruleAmendments: RuleAmendment[]): string {
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of violations) {
      severityCounts[v.severity]++;
    }

    return `Analysis of ${violations.length} violations (${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low) identified ${ruleAmendments.length} rule amendments needed to improve compliance and reduce future violations.`;
  }

  async suggestAllPolicyAmendments(userId: string): Promise<PolicyUpdateSuggestion[]> {
    this.logAuditEvent("SUGGEST_ALL_POLICY_AMENDMENTS", "governance", userId, {});

    const policies = Array.from(policyStore.values()).filter(p => p.isActive);
    const suggestions: PolicyUpdateSuggestion[] = [];

    for (const policy of policies) {
      try {
        const suggestion = await this.suggestPolicyAmendments(policy.id, userId, true);
        if (suggestion.ruleAmendments.length > 0 || 
            suggestion.enforcementAmendments.length > 0 || 
            suggestion.dataTypeAmendments.length > 0 ||
            suggestion.regulatoryMappingAmendments.length > 0) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        console.error(`[AIDataGovernance] Failed to analyze policy ${policy.id}:`, error);
      }
    }

    suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    this.logAuditEvent("ALL_POLICY_AMENDMENTS_SUGGESTED", "governance", userId, {
      policiesAnalyzed: policies.length,
      suggestionsGenerated: suggestions.length,
    });

    return suggestions;
  }

  getPolicySuggestion(suggestionId: string): PolicyUpdateSuggestion | undefined {
    return policySuggestionStore.get(suggestionId);
  }

  listPolicySuggestions(filters?: {
    policyId?: string;
    status?: SuggestionStatus;
    priority?: SuggestionPriority;
    limit?: number;
  }): PolicyUpdateSuggestion[] {
    let results = Array.from(policySuggestionStore.values());

    if (filters?.policyId) {
      results = results.filter(s => s.policyId === filters.policyId);
    }
    if (filters?.status) {
      results = results.filter(s => s.status === filters.status);
    }
    if (filters?.priority) {
      results = results.filter(s => s.priority === filters.priority);
    }

    results.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async reviewPolicySuggestion(
    suggestionId: string,
    action: "accept" | "reject",
    reviewerId: string,
    notes?: string
  ): Promise<PolicyUpdateSuggestion | null> {
    const suggestion = policySuggestionStore.get(suggestionId);
    if (!suggestion) return null;

    suggestion.status = action === "accept" ? "accepted" : "rejected";
    suggestion.reviewedBy = hashIdentifier(reviewerId);
    suggestion.reviewedAt = new Date().toISOString();
    suggestion.reviewNotes = notes;

    this.logAuditEvent("POLICY_SUGGESTION_REVIEWED", "governance", reviewerId, {
      suggestionId,
      action,
      policyId: suggestion.policyId,
    });

    return suggestion;
  }

  async implementPolicySuggestion(
    suggestionId: string,
    implementerId: string
  ): Promise<{ success: boolean; policy?: DataPolicy; error?: string }> {
    const suggestion = policySuggestionStore.get(suggestionId);
    if (!suggestion) {
      return { success: false, error: "Suggestion not found" };
    }
    if (suggestion.status !== "accepted") {
      return { success: false, error: "Suggestion must be accepted before implementation" };
    }

    const policy = policyStore.get(suggestion.policyId);
    if (!policy) {
      return { success: false, error: "Policy not found" };
    }

    for (const amendment of suggestion.ruleAmendments) {
      if (amendment.amendmentType === "add_rule" && amendment.proposedRule) {
        policy.rules.push(amendment.proposedRule);
      } else if (amendment.amendmentType === "modify_rule" && amendment.targetRuleId) {
        const ruleIndex = policy.rules.findIndex(r => r.id === amendment.targetRuleId);
        if (ruleIndex >= 0 && amendment.proposedValue) {
          policy.rules[ruleIndex].condition = amendment.proposedValue;
        }
      } else if (amendment.amendmentType === "remove_rule" && amendment.targetRuleId) {
        policy.rules = policy.rules.filter(r => r.id !== amendment.targetRuleId);
      }
    }

    policy.updatedAt = new Date().toISOString();
    policy.version = (parseFloat(policy.version) + 0.1).toFixed(1);

    suggestion.status = "implemented";
    suggestion.implementedAt = new Date().toISOString();

    this.logAuditEvent("POLICY_SUGGESTION_IMPLEMENTED", "governance", implementerId, {
      suggestionId,
      policyId: policy.id,
      rulesAdded: suggestion.ruleAmendments.filter(a => a.amendmentType === "add_rule").length,
      rulesModified: suggestion.ruleAmendments.filter(a => a.amendmentType === "modify_rule").length,
      rulesRemoved: suggestion.ruleAmendments.filter(a => a.amendmentType === "remove_rule").length,
    });

    return { success: true, policy };
  }

  async analyzeAccessPattern(review: DataAccessReview): Promise<AccessPatternAnalysis> {
    const violations = review.violations || [];
    const violationCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of violations) {
      violationCounts[v.severity]++;
    }

    const totalAccess = review.accessedResources.reduce((sum, r) => sum + r.accessCount, 0);
    const accessFrequency = totalAccess > 500 ? "excessive" : totalAccess > 200 ? "elevated" : "normal";

    const resourceDistribution: Record<string, number> = {};
    for (const r of review.accessedResources) {
      resourceDistribution[r.resourceType] = (resourceDistribution[r.resourceType] || 0) + r.accessCount;
    }

    const recentTrend = violations.length === 0 ? "improving" : 
                        violationCounts.critical > 0 || violationCounts.high > 2 ? "worsening" : "stable";

    const policyAdherence = 100 - (violations.length * 10);
    const complianceScore = Math.max(0, Math.min(100, 100 - review.riskScore));

    let riskLevel: RiskLevel = "low";
    if (review.riskScore >= 70 || violationCounts.critical > 0) {
      riskLevel = "critical";
    } else if (review.riskScore >= 50 || violationCounts.high >= 2) {
      riskLevel = "high";
    } else if (review.riskScore >= 30 || violations.length > 2) {
      riskLevel = "medium";
    }

    return {
      userId: review.userId,
      userRole: review.userRole,
      riskLevel,
      complianceScore,
      accessFrequency,
      accessTimePattern: "business_hours",
      resourceTypeDistribution: resourceDistribution,
      violationHistory: {
        total: violations.length,
        ...violationCounts,
        recentTrend,
      },
      policyAdherence: Math.max(0, policyAdherence),
    };
  }

  async automateAccessReview(
    reviewId: string,
    config: AccessReviewScheduleConfig,
    systemUserId: string
  ): Promise<AutomatedAccessReviewResult> {
    const review = accessReviewStore.get(reviewId);
    if (!review) {
      throw new Error("Review not found");
    }

    this.logAuditEvent("AUTOMATE_ACCESS_REVIEW", "access_review", systemUserId, { reviewId });

    const patternAnalysis = await this.analyzeAccessPattern(review);
    let decision: AccessReviewDecision = "pending";
    let confidence = 0.7;
    let requiresHumanReview = false;
    let alertTriggered = false;
    const suggestedActions: string[] = [];
    let reasoning = "";
    let aiAnalysis: string | undefined;

    if (patternAnalysis.riskLevel === "critical" || review.riskScore >= config.alertThreshold) {
      decision = "flagged_for_review";
      requiresHumanReview = true;
      alertTriggered = true;
      confidence = 0.95;
      reasoning = `Critical risk detected: risk score ${review.riskScore}, ${patternAnalysis.violationHistory.critical} critical violations`;
      suggestedActions.push("Immediate security review required");
      suggestedActions.push("Consider temporary access suspension pending investigation");
      suggestedActions.push("Notify security team and compliance officer");

      await automatedAlertingService.recordMetric("high_risk_access_flagged", 1, {
        reviewId,
        riskScore: review.riskScore,
        userId: patternAnalysis.userId,
      });
    } else if (patternAnalysis.riskLevel === "high" || review.riskScore >= config.flagForReviewThreshold) {
      decision = "flagged_for_review";
      requiresHumanReview = true;
      confidence = 0.85;
      reasoning = `Elevated risk: risk score ${review.riskScore}, requires human review`;
      suggestedActions.push("Manual review recommended within 48 hours");
      suggestedActions.push("Verify access patterns align with job responsibilities");
    } else if (patternAnalysis.riskLevel === "low" && 
               patternAnalysis.policyAdherence >= 90 && 
               review.riskScore <= config.autoApproveThreshold) {
      decision = "auto_approved";
      confidence = 0.9;
      reasoning = `Low risk profile: risk score ${review.riskScore}, policy adherence ${patternAnalysis.policyAdherence}%, no significant violations`;
      suggestedActions.push("Routine review - no action required");
      suggestedActions.push("Schedule follow-up review in 90 days");

      review.reviewStatus = "approved";
      review.reviewedBy = "ai_automation";
      review.reviewedAt = new Date().toISOString();
      review.reviewNotes = `Auto-approved: ${reasoning}`;
    } else if (patternAnalysis.violationHistory.total > 0 || patternAnalysis.accessFrequency === "elevated") {
      decision = "auto_needs_action";
      confidence = 0.8;
      reasoning = `Medium risk: ${patternAnalysis.violationHistory.total} violations detected, access frequency ${patternAnalysis.accessFrequency}`;
      suggestedActions.push("Review access permissions for appropriateness");
      suggestedActions.push("Provide additional policy training to user");
      requiresHumanReview = true;
    } else {
      decision = "auto_approved";
      confidence = 0.85;
      reasoning = `Standard access pattern within acceptable parameters`;
      suggestedActions.push("Access patterns within normal range");

      review.reviewStatus = "approved";
      review.reviewedBy = "ai_automation";
      review.reviewedAt = new Date().toISOString();
      review.reviewNotes = `Auto-approved: ${reasoning}`;
    }

    if (openai && (requiresHumanReview || patternAnalysis.violationHistory.total > 0)) {
      try {
        aiAnalysis = await this.generateAIAccessAnalysis(review, patternAnalysis);
      } catch (error) {
        console.error("[AIDataGovernance] AI access analysis error:", error);
      }
    }

    const result: AutomatedAccessReviewResult = {
      id: `auto-review-${randomUUID()}`,
      reviewId,
      decision,
      confidence,
      riskLevel: patternAnalysis.riskLevel,
      patternAnalysis,
      reasoning,
      aiAnalysis,
      requiresHumanReview,
      alertTriggered,
      suggestedActions,
      createdAt: new Date().toISOString(),
      processedBy: "ai_automation",
    };

    automatedReviewResultStore.set(result.id, result);

    this.logAuditEvent("ACCESS_REVIEW_AUTOMATED", "access_review", systemUserId, {
      resultId: result.id,
      reviewId,
      decision,
      riskLevel: patternAnalysis.riskLevel,
      alertTriggered,
    });

    return result;
  }

  private async generateAIAccessAnalysis(
    review: DataAccessReview,
    patternAnalysis: AccessPatternAnalysis
  ): Promise<string> {
    if (!openai) return "";

    const sanitizedReview = {
      userIdHash: hashIdentifier(patternAnalysis.userId),
      userRole: patternAnalysis.userRole,
      riskScore: review.riskScore,
      complianceStatus: review.policyCompliance,
      accessedResourceTypes: Object.keys(patternAnalysis.resourceTypeDistribution),
      violationCount: patternAnalysis.violationHistory.total,
      violationBreakdown: {
        critical: patternAnalysis.violationHistory.critical,
        high: patternAnalysis.violationHistory.high,
        medium: patternAnalysis.violationHistory.medium,
        low: patternAnalysis.violationHistory.low,
      },
      accessFrequency: patternAnalysis.accessFrequency,
      policyAdherence: patternAnalysis.policyAdherence,
    };

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_ACCESS_REVIEW_PROMPT },
          {
            role: "user",
            content: `Analyze this access review for compliance concerns (all identifiers are anonymized hashes):
${JSON.stringify(sanitizedReview, null, 2)}

Provide a brief analysis (2-3 sentences) of:
1. Key risk factors identified
2. Whether the access pattern is appropriate for the role
3. Recommended actions (focusing only on access control, not clinical aspects)`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("[AIDataGovernance] AI access analysis error:", error);
      return "";
    }
  }

  async runScheduledAccessReviews(scheduleId: string): Promise<AccessReviewBatchResult> {
    const schedule = reviewScheduleStore.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      throw new Error("Schedule not found or disabled");
    }

    const startedAt = new Date().toISOString();
    this.logAuditEvent("RUN_SCHEDULED_ACCESS_REVIEWS", "access_review", "system", { scheduleId });

    const pendingReviews = Array.from(accessReviewStore.values()).filter(
      r => r.reviewStatus === "pending" && 
           (schedule.targetRoles.length === 0 || schedule.targetRoles.includes(r.userRole)) &&
           !schedule.excludedUsers.includes(r.userId)
    );

    let autoApproved = 0;
    let autoNeedsAction = 0;
    let flaggedForReview = 0;
    let alertsTriggered = 0;
    let errors = 0;

    for (const review of pendingReviews) {
      try {
        const result = await this.automateAccessReview(review.id, schedule, "system");
        
        switch (result.decision) {
          case "auto_approved":
            autoApproved++;
            break;
          case "auto_needs_action":
            autoNeedsAction++;
            break;
          case "flagged_for_review":
            flaggedForReview++;
            break;
        }
        
        if (result.alertTriggered) {
          alertsTriggered++;
        }
      } catch (error) {
        console.error(`[AIDataGovernance] Error processing review ${review.id}:`, error);
        errors++;
      }
    }

    schedule.lastRunAt = new Date().toISOString();
    schedule.nextRunAt = new Date(Date.now() + schedule.intervalHours * 60 * 60 * 1000).toISOString();
    schedule.updatedAt = new Date().toISOString();

    const batchResult: AccessReviewBatchResult = {
      id: `batch-${randomUUID()}`,
      scheduleId,
      startedAt,
      completedAt: new Date().toISOString(),
      totalReviewsProcessed: pendingReviews.length,
      autoApproved,
      autoNeedsAction,
      flaggedForReview,
      alertsTriggered,
      errors,
      summary: `Processed ${pendingReviews.length} reviews: ${autoApproved} auto-approved, ${flaggedForReview} flagged for review, ${alertsTriggered} alerts triggered`,
    };

    batchResultStore.set(batchResult.id, batchResult);

    this.logAuditEvent("SCHEDULED_ACCESS_REVIEWS_COMPLETED", "access_review", "system", {
      batchId: batchResult.id,
      scheduleId,
      totalProcessed: pendingReviews.length,
      autoApproved,
      flaggedForReview,
      alertsTriggered,
    });

    return batchResult;
  }

  createAccessReviewSchedule(config: Omit<AccessReviewScheduleConfig, "id" | "createdAt" | "updatedAt" | "nextRunAt">): AccessReviewScheduleConfig {
    const schedule: AccessReviewScheduleConfig = {
      ...config,
      id: `schedule-${randomUUID()}`,
      nextRunAt: new Date(Date.now() + config.intervalHours * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    reviewScheduleStore.set(schedule.id, schedule);
    console.log(`[AIDataGovernance] Created access review schedule: ${schedule.name}`);
    return schedule;
  }

  updateAccessReviewSchedule(
    scheduleId: string,
    updates: Partial<Omit<AccessReviewScheduleConfig, "id" | "createdAt">>
  ): AccessReviewScheduleConfig | null {
    const schedule = reviewScheduleStore.get(scheduleId);
    if (!schedule) return null;

    Object.assign(schedule, updates, { updatedAt: new Date().toISOString() });
    return schedule;
  }

  getAccessReviewSchedule(scheduleId: string): AccessReviewScheduleConfig | undefined {
    return reviewScheduleStore.get(scheduleId);
  }

  listAccessReviewSchedules(): AccessReviewScheduleConfig[] {
    return Array.from(reviewScheduleStore.values());
  }

  getAutomatedReviewResult(resultId: string): AutomatedAccessReviewResult | undefined {
    return automatedReviewResultStore.get(resultId);
  }

  listAutomatedReviewResults(filters?: {
    decision?: AccessReviewDecision;
    riskLevel?: RiskLevel;
    requiresHumanReview?: boolean;
    limit?: number;
  }): AutomatedAccessReviewResult[] {
    let results = Array.from(automatedReviewResultStore.values());

    if (filters?.decision) {
      results = results.filter(r => r.decision === filters.decision);
    }
    if (filters?.riskLevel) {
      results = results.filter(r => r.riskLevel === filters.riskLevel);
    }
    if (filters?.requiresHumanReview !== undefined) {
      results = results.filter(r => r.requiresHumanReview === filters.requiresHumanReview);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async humanReviewAutomatedResult(
    resultId: string,
    reviewerId: string,
    decision: DataAccessReview["reviewStatus"],
    notes?: string
  ): Promise<AutomatedAccessReviewResult | null> {
    const result = automatedReviewResultStore.get(resultId);
    if (!result) return null;

    result.humanReviewedAt = new Date().toISOString();
    result.humanReviewedBy = hashIdentifier(reviewerId);
    result.humanDecision = decision;

    const review = accessReviewStore.get(result.reviewId);
    if (review) {
      review.reviewStatus = decision;
      review.reviewedBy = hashIdentifier(reviewerId);
      review.reviewedAt = new Date().toISOString();
      review.reviewNotes = notes || `Human override of AI decision: ${result.decision} -> ${decision}`;
    }

    this.logAuditEvent("HUMAN_REVIEW_AUTOMATED_RESULT", "access_review", reviewerId, {
      resultId,
      reviewId: result.reviewId,
      originalDecision: result.decision,
      humanDecision: decision,
    });

    return result;
  }

  getBatchResult(batchId: string): AccessReviewBatchResult | undefined {
    return batchResultStore.get(batchId);
  }

  listBatchResults(limit: number = 50): AccessReviewBatchResult[] {
    return Array.from(batchResultStore.values())
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, limit);
  }

  startScheduler(): void {
    if (schedulerInterval) {
      console.log("[AIDataGovernance] Scheduler already running");
      return;
    }

    const checkInterval = 60 * 60 * 1000;
    schedulerInterval = setInterval(async () => {
      const now = new Date();
      for (const schedule of Array.from(reviewScheduleStore.values())) {
        if (schedule.enabled && new Date(schedule.nextRunAt) <= now) {
          try {
            console.log(`[AIDataGovernance] Running scheduled access reviews: ${schedule.name}`);
            await this.runScheduledAccessReviews(schedule.id);
          } catch (error) {
            console.error(`[AIDataGovernance] Scheduler error for ${schedule.id}:`, error);
          }
        }
      }
    }, checkInterval);

    console.log("[AIDataGovernance] Access review scheduler started");
  }

  stopScheduler(): void {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
      console.log("[AIDataGovernance] Access review scheduler stopped");
    }
  }

  initializeDefaultSchedule(): void {
    if (reviewScheduleStore.size === 0) {
      this.createAccessReviewSchedule({
        name: "Daily Low-Risk Review Automation",
        enabled: true,
        intervalHours: 24,
        autoApproveThreshold: 20,
        flagForReviewThreshold: 50,
        alertThreshold: 70,
        targetRoles: [],
        excludedUsers: [],
      });
      console.log("[AIDataGovernance] Default access review schedule initialized");
    }
  }

  private generateSimulatedAuditLogs(userId: string, startDate: Date, endDate: Date): AuditLogEntry[] {
    const logs: AuditLogEntry[] = [];
    const actions = ["read", "write", "delete", "export", "print", "share"];
    const resources = ["Patient", "Observation", "MedicationRequest", "DiagnosticReport", "Encounter", "AllergyIntolerance"];
    const contexts = ["treatment", "operations", "research", "billing", "emergency"];
    const userAgents = ["Chrome/120", "Firefox/119", "Safari/17", "Mobile-iOS", "Mobile-Android"];

    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const baseLogCount = Math.floor(Math.random() * 30) + 20;

    for (let i = 0; i < baseLogCount * dayCount; i++) {
      const timestamp = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
      const hour = timestamp.getHours();
      const isAfterHours = hour < 6 || hour > 20;

      logs.push({
        id: `log-${randomUUID()}`,
        timestamp: timestamp.toISOString(),
        action: actions[Math.floor(Math.random() * actions.length)],
        userId: hashIdentifier(userId),
        userRole: "provider",
        resourceType: resources[Math.floor(Math.random() * resources.length)],
        resourceId: hashIdentifier(`resource-${randomUUID()}`),
        accessContext: contexts[Math.floor(Math.random() * contexts.length)],
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
        success: Math.random() > 0.05,
        duration: Math.floor(Math.random() * 5000) + 100,
        metadata: isAfterHours ? { afterHours: true } : undefined,
      });
    }

    return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private detectViolationsFromLogs(logs: AuditLogEntry[], userId: string): ViolationDetection[] {
    const violations: ViolationDetection[] = [];

    const afterHoursLogs = logs.filter(log => {
      const hour = new Date(log.timestamp).getHours();
      return hour < 6 || hour > 20;
    });
    if (afterHoursLogs.length > logs.length * 0.2) {
      violations.push({
        id: `v-${randomUUID()}`,
        type: "time_pattern",
        severity: afterHoursLogs.length > logs.length * 0.4 ? "high" : "medium",
        description: `Excessive after-hours access: ${afterHoursLogs.length} of ${logs.length} accesses occurred outside business hours`,
        affectedResources: [...new Set(afterHoursLogs.map(l => l.resourceType))],
        timestamp: new Date().toISOString(),
        confidence: 0.85,
        evidence: [`${afterHoursLogs.length} after-hours accesses detected`, "Pattern exceeds 20% threshold"],
      });
    }

    const deleteLogs = logs.filter(l => l.action === "delete");
    if (deleteLogs.length > 5) {
      violations.push({
        id: `v-${randomUUID()}`,
        type: "bulk_access",
        severity: deleteLogs.length > 15 ? "critical" : "high",
        description: `Bulk delete operations detected: ${deleteLogs.length} deletions in review period`,
        affectedResources: [...new Set(deleteLogs.map(l => l.resourceType))],
        timestamp: new Date().toISOString(),
        confidence: 0.9,
        evidence: [`${deleteLogs.length} delete operations`, "Exceeds normal threshold of 5"],
      });
    }

    const exportLogs = logs.filter(l => l.action === "export" || l.action === "print");
    if (exportLogs.length > 20) {
      violations.push({
        id: `v-${randomUUID()}`,
        type: "sensitive_data",
        severity: exportLogs.length > 50 ? "critical" : "high",
        description: `High volume data export: ${exportLogs.length} export/print operations detected`,
        affectedResources: [...new Set(exportLogs.map(l => l.resourceType))],
        timestamp: new Date().toISOString(),
        confidence: 0.88,
        evidence: [`${exportLogs.length} data exports`, "Potential data exfiltration risk"],
      });
    }

    const uniqueResources = new Set(logs.map(l => l.resourceId));
    if (uniqueResources.size > 200) {
      violations.push({
        id: `v-${randomUUID()}`,
        type: "access_anomaly",
        severity: uniqueResources.size > 500 ? "high" : "medium",
        description: `Unusually broad access pattern: ${uniqueResources.size} unique resources accessed`,
        affectedResources: [...new Set(logs.map(l => l.resourceType))],
        timestamp: new Date().toISOString(),
        confidence: 0.75,
        evidence: [`${uniqueResources.size} unique resource accesses`, "Exceeds normal access breadth"],
      });
    }

    const failedLogs = logs.filter(l => !l.success);
    if (failedLogs.length > 10) {
      violations.push({
        id: `v-${randomUUID()}`,
        type: "frequency",
        severity: failedLogs.length > 30 ? "high" : "medium",
        description: `High failure rate: ${failedLogs.length} failed access attempts`,
        affectedResources: [...new Set(failedLogs.map(l => l.resourceType))],
        timestamp: new Date().toISOString(),
        confidence: 0.8,
        evidence: [`${failedLogs.length} failed attempts`, "May indicate unauthorized access attempts"],
      });
    }

    return violations;
  }

  private calculateRiskFactors(
    logs: AuditLogEntry[],
    violations: ViolationDetection[],
    existingViolations: GovernancePolicyViolation[]
  ): { factor: string; weight: number; description: string }[] {
    const factors: { factor: string; weight: number; description: string }[] = [];

    for (const v of violations) {
      let weight = 0;
      switch (v.severity) {
        case "critical": weight = 30; break;
        case "high": weight = 20; break;
        case "medium": weight = 10; break;
        case "low": weight = 5; break;
      }
      factors.push({
        factor: `Detected: ${v.type}`,
        weight,
        description: v.description,
      });
    }

    for (const ev of existingViolations) {
      let weight = 0;
      switch (ev.severity) {
        case "critical": weight = 25; break;
        case "high": weight = 15; break;
        case "medium": weight = 8; break;
        case "low": weight = 3; break;
      }
      factors.push({
        factor: `Historical violation: ${ev.violationType}`,
        weight,
        description: `Previous ${ev.severity} severity violation: ${ev.description}`,
      });
    }

    const totalAccess = logs.length;
    if (totalAccess > 1000) {
      factors.push({
        factor: "High access volume",
        weight: 15,
        description: `${totalAccess} total accesses exceeds normal threshold`,
      });
    } else if (totalAccess > 500) {
      factors.push({
        factor: "Elevated access volume",
        weight: 8,
        description: `${totalAccess} accesses is above average`,
      });
    }

    const uniqueIps = new Set(logs.map(l => l.ipAddress)).size;
    if (uniqueIps > 5) {
      factors.push({
        factor: "Multiple access locations",
        weight: uniqueIps > 10 ? 15 : 8,
        description: `Access from ${uniqueIps} different IP addresses`,
      });
    }

    return factors;
  }

  private computeDecision(
    riskScore: number,
    violations: ViolationDetection[],
    factors: { factor: string; weight: number }[]
  ): { decision: "approved" | "needs_action" | "flagged_for_admin"; confidence: number; reasoning: string } {
    const hasCritical = violations.some(v => v.severity === "critical");
    const hasHighCount = violations.filter(v => v.severity === "high").length;

    if (hasCritical || riskScore >= 70) {
      return {
        decision: "flagged_for_admin",
        confidence: 0.95,
        reasoning: `Critical risk detected: risk score ${riskScore}, ${hasCritical ? "critical violations present" : "high risk threshold exceeded"}. Immediate admin review required.`,
      };
    }

    if (hasHighCount >= 2 || riskScore >= 50) {
      return {
        decision: "needs_action",
        confidence: 0.85,
        reasoning: `Elevated risk: risk score ${riskScore}, ${hasHighCount} high-severity issues detected. Remediation actions recommended before approval.`,
      };
    }

    if (riskScore < 25 && violations.length === 0) {
      return {
        decision: "approved",
        confidence: 0.9,
        reasoning: `Low risk profile: risk score ${riskScore}, no violations detected. Access patterns within acceptable parameters.`,
      };
    }

    if (riskScore < 40 && violations.every(v => v.severity === "low" || v.severity === "medium")) {
      return {
        decision: "approved",
        confidence: 0.8,
        reasoning: `Acceptable risk: risk score ${riskScore}, minor issues noted. Access approved with monitoring recommendations.`,
      };
    }

    return {
      decision: "needs_action",
      confidence: 0.75,
      reasoning: `Moderate risk: risk score ${riskScore}, review recommended. ${violations.length} potential issues identified.`,
    };
  }

  async performFullAutomatedReview(
    reviewId: string,
    systemUserId: string
  ): Promise<FullReviewAnalysis> {
    const review = accessReviewStore.get(reviewId);
    if (!review) {
      throw new Error("Review not found");
    }

    this.logAuditEvent("PERFORM_FULL_AUTOMATED_REVIEW", "access_review", systemUserId, { reviewId });

    const startDate = new Date(review.reviewPeriod.start);
    const endDate = new Date(review.reviewPeriod.end);

    const auditLogs = this.generateSimulatedAuditLogs(review.userId, startDate, endDate);
    const detectedViolations = this.detectViolationsFromLogs(auditLogs, review.userId);

    const accessSummary = {
      totalAccesses: auditLogs.length,
      uniqueResources: new Set(auditLogs.map(l => l.resourceId)).size,
      readCount: auditLogs.filter(l => l.action === "read").length,
      writeCount: auditLogs.filter(l => l.action === "write").length,
      deleteCount: auditLogs.filter(l => l.action === "delete").length,
      afterHoursAccess: auditLogs.filter(l => {
        const hour = new Date(l.timestamp).getHours();
        return hour < 6 || hour > 20;
      }).length,
      bulkOperations: auditLogs.filter(l => l.action === "export" || l.action === "delete").length,
    };

    const riskFactors = this.calculateRiskFactors(auditLogs, detectedViolations, review.violations);
    const computedRiskScore = Math.min(100, riskFactors.reduce((sum, f) => sum + f.weight, 0));
    const { decision, confidence, reasoning } = this.computeDecision(computedRiskScore, detectedViolations, riskFactors);

    let aiInsights: string | undefined;
    if (openai && (decision !== "approved" || detectedViolations.length > 0)) {
      try {
        const sanitizedContext = sanitizePhi(JSON.stringify({
          accessSummary,
          violationCount: detectedViolations.length,
          violationTypes: detectedViolations.map(v => v.type),
          riskScore: computedRiskScore,
          riskFactorCount: riskFactors.length,
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_ACCESS_REVIEW_PROMPT },
            {
              role: "user",
              content: `Analyze this automated access review (all data anonymized):
${sanitizedContext}

Provide 2-3 sentences identifying:
1. Primary compliance concerns
2. Recommended governance actions
Focus only on data access patterns and security, not clinical interpretation.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 250,
        });
        aiInsights = response.choices[0]?.message?.content || undefined;
      } catch (error) {
        console.error("[AIDataGovernance] AI insights error:", error);
      }
    }

    const alertsTriggered: string[] = [];
    const suggestedActions: string[] = [];

    if (decision === "flagged_for_admin") {
      alertsTriggered.push("HIGH_RISK_ACCESS_REVIEW");
      suggestedActions.push("Immediate security review required");
      suggestedActions.push("Consider temporary access suspension pending investigation");
      suggestedActions.push("Notify compliance officer");

      await automatedAlertingService.recordMetric("critical_access_review_flagged", 1, {
        reviewId,
        userId: hashIdentifier(review.userId),
        riskScore: computedRiskScore,
        violationCount: detectedViolations.length,
      });
    }

    if (decision === "needs_action") {
      if (detectedViolations.some(v => v.type === "sensitive_data")) {
        alertsTriggered.push("DATA_EXPORT_ALERT");
        suggestedActions.push("Review data export justifications");
      }
      if (detectedViolations.some(v => v.type === "time_pattern")) {
        suggestedActions.push("Verify after-hours access authorization");
      }
      if (detectedViolations.some(v => v.type === "bulk_access")) {
        suggestedActions.push("Investigate bulk operation necessity");
      }
      suggestedActions.push("Schedule follow-up review in 30 days");

      await automatedAlertingService.recordMetric("access_review_needs_action", 1, {
        reviewId,
        userId: hashIdentifier(review.userId),
        riskScore: computedRiskScore,
      });
    }

    if (decision === "approved") {
      suggestedActions.push("Access patterns within normal parameters");
      suggestedActions.push("Schedule routine follow-up review in 90 days");
    }

    let reviewStatus: "pending" | "approved" | "revoked" | "modified";
    switch (decision) {
      case "approved":
        reviewStatus = "approved";
        review.reviewedBy = "ai_automation";
        review.reviewedAt = new Date().toISOString();
        review.reviewNotes = `[AUTO-APPROVED] ${reasoning}`;
        break;
      case "needs_action":
        reviewStatus = "modified";
        review.reviewNotes = `[NEEDS_ACTION] ${reasoning}. Suggested actions: ${suggestedActions.join("; ")}`;
        break;
      case "flagged_for_admin":
        reviewStatus = "pending";
        review.reviewNotes = `[FLAGGED_FOR_ADMIN] ${reasoning}. Alerts triggered: ${alertsTriggered.join(", ")}`;
        break;
      default:
        reviewStatus = "pending";
        review.reviewNotes = `AI Analysis: ${reasoning}`;
    }
    
    review.reviewStatus = reviewStatus;
    review.riskScore = computedRiskScore;

    const analysis: FullReviewAnalysis = {
      reviewId,
      userId: hashIdentifier(review.userId),
      auditLogsAnalyzed: auditLogs.length,
      timeRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      accessSummary,
      violationsDetected: detectedViolations,
      riskFactors,
      computedRiskScore,
      aiInsights,
      decision,
      decisionConfidence: confidence,
      decisionReasoning: reasoning,
      alertsTriggered,
      suggestedActions,
      processedAt: new Date().toISOString(),
    };

    fullReviewAnalysisStore.set(reviewId, analysis);

    this.logAuditEvent("FULL_AUTOMATED_REVIEW_COMPLETED", "access_review", systemUserId, {
      reviewId,
      decision,
      riskScore: computedRiskScore,
      violationsDetected: detectedViolations.length,
      alertsTriggered: alertsTriggered.length,
    });

    return analysis;
  }

  async runFullAutomatedBatch(systemUserId: string): Promise<{
    processed: number;
    approved: number;
    needsAction: number;
    flaggedForAdmin: number;
    alerts: number;
    results: FullReviewAnalysis[];
  }> {
    this.logAuditEvent("RUN_FULL_AUTOMATED_BATCH", "access_review", systemUserId, {});

    const pendingReviews = Array.from(accessReviewStore.values()).filter(
      r => r.reviewStatus === "pending"
    );

    let approved = 0;
    let needsAction = 0;
    let flaggedForAdmin = 0;
    let alerts = 0;
    const results: FullReviewAnalysis[] = [];

    for (const review of pendingReviews) {
      try {
        const analysis = await this.performFullAutomatedReview(review.id, systemUserId);
        results.push(analysis);

        switch (analysis.decision) {
          case "approved":
            approved++;
            break;
          case "needs_action":
            needsAction++;
            break;
          case "flagged_for_admin":
            flaggedForAdmin++;
            break;
        }

        alerts += analysis.alertsTriggered.length;
      } catch (error) {
        console.error(`[AIDataGovernance] Error processing review ${review.id}:`, error);
      }
    }

    this.logAuditEvent("FULL_AUTOMATED_BATCH_COMPLETED", "access_review", systemUserId, {
      processed: pendingReviews.length,
      approved,
      needsAction,
      flaggedForAdmin,
      alerts,
    });

    return {
      processed: pendingReviews.length,
      approved,
      needsAction,
      flaggedForAdmin,
      alerts,
      results,
    };
  }

  getFullReviewAnalysis(reviewId: string): FullReviewAnalysis | undefined {
    return fullReviewAnalysisStore.get(reviewId);
  }

  listFullReviewAnalyses(filters?: {
    decision?: "approved" | "needs_action" | "flagged_for_admin";
    minRiskScore?: number;
    hasAlerts?: boolean;
    limit?: number;
  }): FullReviewAnalysis[] {
    let results = Array.from(fullReviewAnalysisStore.values());

    if (filters?.decision) {
      results = results.filter(r => r.decision === filters.decision);
    }
    if (filters?.minRiskScore !== undefined) {
      results = results.filter(r => r.computedRiskScore >= filters.minRiskScore!);
    }
    if (filters?.hasAlerts !== undefined) {
      results = results.filter(r => filters.hasAlerts ? r.alertsTriggered.length > 0 : r.alertsTriggered.length === 0);
    }

    results.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }
}

export const aiDataGovernanceService = new AIDataGovernanceService();
aiDataGovernanceService.initializeDefaultSchedule();
