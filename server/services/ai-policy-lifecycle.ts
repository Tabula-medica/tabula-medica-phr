import { createHash, randomUUID } from "crypto";
import { getAuditLogger } from "./integrations/factory";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const NO_CDS_POLICY_LIFECYCLE_PROMPT = `You are a healthcare data governance policy lifecycle analyst specializing in regulatory compliance and policy management.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing policy conflicts and redundancies
- Identifying outdated rules based on audit patterns and violations
- Recommending policy retirement, archiving, or updates
- Managing policy versioning and approval workflows
- Evaluating regulatory compliance gaps
- Suggesting policy consolidation opportunities

Focus ONLY on policy governance, compliance, and lifecycle management. Never interpret clinical data.`;

export type PolicyStatus = "draft" | "pending_approval" | "active" | "deprecated" | "archived" | "retired";
export type ConflictSeverity = "critical" | "high" | "medium" | "low";
export type ConflictType = "rule_contradiction" | "scope_overlap" | "enforcement_inconsistency" | "data_type_conflict" | "role_conflict";
export type LifecycleAction = "create" | "update" | "approve" | "deprecate" | "archive" | "retire" | "restore";

export interface PolicyVersion {
  id: string;
  policyId: string;
  version: number;
  changes: PolicyChange[];
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  status: PolicyStatus;
  previousVersionId?: string;
  changeReason: string;
  regulatoryDriver?: string;
}

export interface PolicyChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: "add" | "modify" | "remove";
}

export interface PolicyConflict {
  id: string;
  policy1Id: string;
  policy1Name: string;
  policy2Id: string;
  policy2Name: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  description: string;
  affectedRules: { policy1Rule: string; policy2Rule: string }[];
  detectedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  aiRecommendation: string;
  impactAssessment: string;
}

export interface PolicyRedundancy {
  id: string;
  primaryPolicyId: string;
  primaryPolicyName: string;
  redundantPolicyId: string;
  redundantPolicyName: string;
  overlapPercentage: number;
  overlappingRules: string[];
  recommendation: "merge" | "archive_redundant" | "differentiate" | "keep_both";
  rationale: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface OutdatedPolicyAnalysis {
  id: string;
  policyId: string;
  policyName: string;
  lastModified: string;
  daysSinceUpdate: number;
  violationsTrend: "increasing" | "stable" | "decreasing";
  violationsLast30Days: number;
  auditLogIndicators: string[];
  regulatoryChanges: RegulatoryChange[];
  recommendation: "update_urgent" | "update_recommended" | "review" | "no_action";
  suggestedUpdates: string[];
  analysisDate: string;
}

export interface RegulatoryChange {
  regulation: string;
  changeDate: string;
  description: string;
  impactLevel: "high" | "medium" | "low";
  affectedPolicies: string[];
}

export interface PolicyRetirementRecommendation {
  id: string;
  policyId: string;
  policyName: string;
  reason: "superseded" | "obsolete" | "unused" | "consolidated" | "regulatory_change";
  replacementPolicyId?: string;
  replacementPolicyName?: string;
  usageStats: {
    lastEnforced?: string;
    enforcementCount30Days: number;
    violationsCount30Days: number;
  };
  recommendation: "retire" | "archive" | "deprecate" | "keep";
  transitionPlan: string[];
  riskAssessment: string;
  recommendedAt: string;
  status: "pending" | "approved" | "rejected" | "implemented";
  approvedBy?: string;
  approvedAt?: string;
}

export interface ApprovalWorkflow {
  id: string;
  policyId: string;
  policyVersionId: string;
  workflowType: "new_policy" | "policy_update" | "retirement" | "archival";
  status: "pending" | "in_review" | "approved" | "rejected" | "cancelled";
  requestedBy: string;
  requestedAt: string;
  reviewers: ApprovalReviewer[];
  requiredApprovals: number;
  currentApprovals: number;
  comments: ApprovalComment[];
  dueDate: string;
  completedAt?: string;
  autoApprovalEligible: boolean;
  aiRiskAssessment?: string;
}

export interface ApprovalReviewer {
  userId: string;
  role: string;
  decision?: "approved" | "rejected" | "abstain";
  decidedAt?: string;
  comments?: string;
}

export interface ApprovalComment {
  id: string;
  userId: string;
  comment: string;
  createdAt: string;
  isSystemGenerated: boolean;
}

export interface PolicyLifecycleDashboard {
  totalPolicies: number;
  byStatus: Record<PolicyStatus, number>;
  pendingApprovals: number;
  conflictsDetected: number;
  redundanciesFound: number;
  outdatedPolicies: number;
  retirementCandidates: number;
  recentChanges: PolicyVersion[];
  upcomingReviews: { policyId: string; policyName: string; reviewDate: string }[];
  complianceScore: number;
  aiInsights: string[];
}

export interface PolicyDraftRequest {
  name: string;
  description: string;
  type: string;
  regulatoryFrameworks: string[];
  dataTypes: string[];
  roles: string[];
  enforcementLevel: string;
  additionalContext?: string;
}

export interface PolicyDraft {
  id: string;
  request: PolicyDraftRequest;
  generatedPolicy: PolicyEntity;
  aiRationale: string;
  suggestedRules: PolicyRule[];
  complianceNotes: string[];
  riskConsiderations: string[];
  createdAt: string;
  status: "draft" | "accepted" | "rejected" | "modified";
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface AmendmentSuggestion {
  id: string;
  policyId: string;
  policyName: string;
  trigger: "regulatory_change" | "risk_detection" | "conflict_resolution" | "periodic_review" | "incident_response";
  triggerDetails: string;
  severity: "critical" | "high" | "medium" | "low";
  suggestedChanges: PolicyChange[];
  rationale: string;
  impactAnalysis: string;
  implementationSteps: string[];
  estimatedEffort: "low" | "medium" | "high";
  regulatoryDeadline?: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected" | "implemented";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface AutoReviewSchedule {
  id: string;
  policyId: string;
  policyName: string;
  reviewFrequency: "monthly" | "quarterly" | "semi_annual" | "annual";
  lastReviewDate?: string;
  nextReviewDate: string;
  autoArchiveIfInactive: boolean;
  inactiveDaysThreshold: number;
  autoRiskScan: boolean;
  autoRegulatoryCheck: boolean;
  status: "active" | "paused" | "completed";
  createdAt: string;
}

export interface AutoReviewResult {
  id: string;
  scheduleId: string;
  policyId: string;
  policyName: string;
  reviewDate: string;
  findings: {
    regulatoryCompliance: { status: "compliant" | "needs_update" | "non_compliant"; details: string }[];
    riskAssessment: { level: string; factors: string[] };
    usageAnalysis: { enforcementCount: number; violationCount: number; trend: string };
    recommendedActions: string[];
  };
  recommendation: "no_action" | "minor_update" | "major_revision" | "deprecate" | "archive";
  autoActionTaken?: string;
  createdAt: string;
}

export interface PolicyEntity {
  id: string;
  name: string;
  description: string;
  type: string;
  status: PolicyStatus;
  version: number;
  rules: PolicyRule[];
  dataTypes: string[];
  roles: string[];
  enforcement: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  nextReviewDate?: string;
  regulatoryMappings: string[];
}

export interface PolicyRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  priority: number;
}

const policyStore = new Map<string, PolicyEntity>();
const versionStore = new Map<string, PolicyVersion>();
const conflictStore = new Map<string, PolicyConflict>();
const redundancyStore = new Map<string, PolicyRedundancy>();
const outdatedAnalysisStore = new Map<string, OutdatedPolicyAnalysis>();
const retirementStore = new Map<string, PolicyRetirementRecommendation>();
const approvalWorkflowStore = new Map<string, ApprovalWorkflow>();
const policyDraftStore = new Map<string, PolicyDraft>();
const amendmentStore = new Map<string, AmendmentSuggestion>();
const autoReviewScheduleStore = new Map<string, AutoReviewSchedule>();
const autoReviewResultStore = new Map<string, AutoReviewResult>();
const auditLogStore: AuditLogEntry[] = [];
const regulatoryChangesStore: RegulatoryChange[] = [];

const AI_POLICY_DRAFT_PROMPT = `You are an expert healthcare data governance policy drafter. You specialize in creating comprehensive, compliant policies for healthcare organizations.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT include any clinical recommendations or treatment guidance
- Focus ONLY on data governance, access control, privacy, and compliance
- All policies must be administrative/operational in nature

When drafting a policy, create:
1. Clear, actionable rules with conditions and actions
2. Appropriate data type classifications
3. Role-based access considerations
4. Enforcement mechanisms
5. Regulatory compliance mappings

Output must be structured JSON with policy rules, compliance notes, and risk considerations.`;

const AI_AMENDMENT_PROMPT = `You are an expert healthcare policy amendment analyst. Analyze existing policies and suggest amendments based on regulatory changes, detected risks, or compliance gaps.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- Amendments must focus on data governance and compliance only
- Never suggest clinical or treatment-related changes

Provide specific, actionable amendment suggestions with:
1. Exact changes to policy rules
2. Clear rationale tied to the trigger (regulatory change, risk, etc.)
3. Impact analysis
4. Implementation steps`;

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  policyId?: string;
  userId: string;
  details: Record<string, unknown>;
}

function initializeSampleData(): void {
  const samplePolicies: PolicyEntity[] = [
    {
      id: "policy-hipaa-access-v2",
      name: "HIPAA PHI Access Control",
      description: "Controls access to Protected Health Information per HIPAA requirements",
      type: "access_control",
      status: "active",
      version: 2,
      rules: [
        { id: "rule-1", name: "Minimum Necessary", condition: "access_type=read AND resource=PHI", action: "require_justification", priority: 1 },
        { id: "rule-2", name: "Break Glass", condition: "access_type=emergency", action: "allow_with_audit", priority: 2 },
        { id: "rule-3", name: "Role Restriction", condition: "user_role NOT IN (physician, nurse, admin)", action: "deny", priority: 3 },
      ],
      dataTypes: ["PHI", "demographics", "clinical_notes"],
      roles: ["physician", "nurse", "admin", "billing"],
      enforcement: "strict",
      createdAt: "2024-01-15T00:00:00Z",
      updatedAt: "2025-06-01T00:00:00Z",
      lastReviewedAt: "2025-06-01T00:00:00Z",
      nextReviewDate: "2026-06-01T00:00:00Z",
      regulatoryMappings: ["HIPAA", "HITECH"],
    },
    {
      id: "policy-data-retention",
      name: "Data Retention Policy",
      description: "Defines retention periods for different data classifications",
      type: "retention",
      status: "active",
      version: 1,
      rules: [
        { id: "ret-1", name: "PHI Retention", condition: "data_type=PHI", action: "retain_7_years", priority: 1 },
        { id: "ret-2", name: "Audit Log Retention", condition: "data_type=audit_log", action: "retain_6_years", priority: 2 },
      ],
      dataTypes: ["PHI", "audit_log", "operational"],
      roles: ["admin", "compliance_officer"],
      enforcement: "mandatory",
      createdAt: "2024-03-01T00:00:00Z",
      updatedAt: "2024-03-01T00:00:00Z",
      lastReviewedAt: "2025-01-15T00:00:00Z",
      nextReviewDate: "2026-01-15T00:00:00Z",
      regulatoryMappings: ["HIPAA", "SOC2"],
    },
    {
      id: "policy-encryption-legacy",
      name: "Legacy Encryption Policy",
      description: "Outdated encryption requirements - superseded by new policy",
      type: "encryption",
      status: "deprecated",
      version: 1,
      rules: [
        { id: "enc-1", name: "AES-128", condition: "data_at_rest=true", action: "encrypt_aes128", priority: 1 },
      ],
      dataTypes: ["PHI", "PII"],
      roles: ["all"],
      enforcement: "mandatory",
      createdAt: "2022-01-01T00:00:00Z",
      updatedAt: "2023-06-01T00:00:00Z",
      regulatoryMappings: ["HIPAA"],
    },
    {
      id: "policy-encryption-current",
      name: "Data Encryption Standards",
      description: "Current encryption requirements using AES-256-GCM",
      type: "encryption",
      status: "active",
      version: 3,
      rules: [
        { id: "enc-new-1", name: "AES-256-GCM", condition: "data_at_rest=true", action: "encrypt_aes256gcm", priority: 1 },
        { id: "enc-new-2", name: "TLS 1.3", condition: "data_in_transit=true", action: "require_tls13", priority: 2 },
      ],
      dataTypes: ["PHI", "PII", "PCI"],
      roles: ["all"],
      enforcement: "mandatory",
      createdAt: "2023-06-01T00:00:00Z",
      updatedAt: "2025-09-01T00:00:00Z",
      lastReviewedAt: "2025-09-01T00:00:00Z",
      nextReviewDate: "2026-03-01T00:00:00Z",
      regulatoryMappings: ["HIPAA", "PCI_DSS", "SOC2"],
    },
    {
      id: "policy-consent-gdpr",
      name: "GDPR Consent Management",
      description: "Consent handling for EU data subjects per GDPR requirements",
      type: "consent",
      status: "active",
      version: 2,
      rules: [
        { id: "gdpr-1", name: "Explicit Consent", condition: "data_subject_location=EU", action: "require_explicit_consent", priority: 1 },
        { id: "gdpr-2", name: "Right to Erasure", condition: "request_type=deletion", action: "process_within_30_days", priority: 2 },
      ],
      dataTypes: ["PII", "PHI"],
      roles: ["all"],
      enforcement: "strict",
      createdAt: "2024-05-01T00:00:00Z",
      updatedAt: "2025-05-01T00:00:00Z",
      lastReviewedAt: "2025-05-01T00:00:00Z",
      nextReviewDate: "2025-11-01T00:00:00Z",
      regulatoryMappings: ["GDPR"],
    },
  ];

  samplePolicies.forEach(p => policyStore.set(p.id, p));

  conflictStore.set("conflict-1", {
    id: "conflict-1",
    policy1Id: "policy-hipaa-access-v2",
    policy1Name: "HIPAA PHI Access Control",
    policy2Id: "policy-consent-gdpr",
    policy2Name: "GDPR Consent Management",
    conflictType: "scope_overlap",
    severity: "medium",
    description: "Both policies define access controls for EU patients with PHI data, but enforcement levels differ",
    affectedRules: [{ policy1Rule: "rule-3", policy2Rule: "gdpr-1" }],
    detectedAt: new Date().toISOString(),
    aiRecommendation: "Create a unified cross-regulatory policy for EU patient data that satisfies both HIPAA and GDPR requirements. Consider stricter of both enforcement levels.",
    impactAssessment: "May cause inconsistent access decisions for EU patients. Recommend harmonization within 30 days.",
  });

  redundancyStore.set("redundancy-1", {
    id: "redundancy-1",
    primaryPolicyId: "policy-encryption-current",
    primaryPolicyName: "Data Encryption Standards",
    redundantPolicyId: "policy-encryption-legacy",
    redundantPolicyName: "Legacy Encryption Policy",
    overlapPercentage: 85,
    overlappingRules: ["encryption at rest"],
    recommendation: "archive_redundant",
    rationale: "Legacy policy has been superseded by current encryption standards with stronger algorithms. Legacy policy should be archived to prevent confusion.",
    detectedAt: new Date().toISOString(),
  });

  regulatoryChangesStore.push({
    regulation: "HIPAA",
    changeDate: "2025-12-01",
    description: "Updated guidance on telehealth PHI handling post-pandemic",
    impactLevel: "medium",
    affectedPolicies: ["policy-hipaa-access-v2"],
  });

  regulatoryChangesStore.push({
    regulation: "GDPR",
    changeDate: "2026-01-15",
    description: "New AI Act requirements for automated decision-making transparency",
    impactLevel: "high",
    affectedPolicies: ["policy-consent-gdpr"],
  });

  console.log("[AIPolicyLifecycle] Initialized with", policyStore.size, "policies,", conflictStore.size, "conflicts,", redundancyStore.size, "redundancies");
}

class AIPolicyLifecycleService {
  constructor() {
    initializeSampleData();
  }

  private async logAuditEvent(action: string, policyId: string | undefined, userId: string, details: Record<string, unknown>): Promise<void> {
    try {
      const auditLogger = getAuditLogger();
      await auditLogger.log({
        action: `POLICY_LIFECYCLE_${action}`,
        resourceType: "PolicyLifecycle",
        // eslint-disable-next-line tabulaAuth/no-fallback-identity -- not an identity fallback: this is resourceId (the policy being acted on), userId is a separate required param; "system" here means a policy-less lifecycle event
        resourceId: policyId || "system",
        userId,
        outcome: "success",
        details,
      });
    } catch (error) {
      console.error("[AIPolicyLifecycle] Audit logging error:", error);
    }

    auditLogStore.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      policyId,
      userId,
      details,
    });
  }

  async getDashboard(): Promise<PolicyLifecycleDashboard> {
    const policies = Array.from(policyStore.values());
    const conflicts = Array.from(conflictStore.values()).filter(c => !c.resolvedAt);
    const redundancies = Array.from(redundancyStore.values()).filter(r => !r.resolvedAt);
    const outdated = Array.from(outdatedAnalysisStore.values()).filter(o => o.recommendation !== "no_action");
    const retirementCandidates = Array.from(retirementStore.values()).filter(r => r.status === "pending");
    const pendingApprovals = Array.from(approvalWorkflowStore.values()).filter(w => w.status === "pending" || w.status === "in_review");

    const byStatus: Record<PolicyStatus, number> = {
      draft: 0,
      pending_approval: 0,
      active: 0,
      deprecated: 0,
      archived: 0,
      retired: 0,
    };
    policies.forEach(p => byStatus[p.status]++);

    const recentVersions = Array.from(versionStore.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const upcomingReviews = policies
      .filter(p => p.nextReviewDate && p.status === "active")
      .map(p => ({ policyId: p.id, policyName: p.name, reviewDate: p.nextReviewDate! }))
      .sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime())
      .slice(0, 5);

    const activePolicies = policies.filter(p => p.status === "active").length;
    const conflictPenalty = conflicts.reduce((sum, c) => sum + (c.severity === "critical" ? 15 : c.severity === "high" ? 10 : 5), 0);
    const complianceScore = Math.max(0, Math.min(100, 100 - conflictPenalty - (outdated.length * 3)));

    const aiInsights = await this.generateDashboardInsights(policies, conflicts, redundancies, outdated);

    return {
      totalPolicies: policies.length,
      byStatus,
      pendingApprovals: pendingApprovals.length,
      conflictsDetected: conflicts.length,
      redundanciesFound: redundancies.length,
      outdatedPolicies: outdated.length,
      retirementCandidates: retirementCandidates.length,
      recentChanges: recentVersions,
      upcomingReviews,
      complianceScore,
      aiInsights,
    };
  }

  private async generateDashboardInsights(
    policies: PolicyEntity[],
    conflicts: PolicyConflict[],
    redundancies: PolicyRedundancy[],
    outdated: OutdatedPolicyAnalysis[]
  ): Promise<string[]> {
    const insights: string[] = [];

    if (conflicts.length > 0) {
      const criticalConflicts = conflicts.filter(c => c.severity === "critical" || c.severity === "high");
      if (criticalConflicts.length > 0) {
        insights.push(`${criticalConflicts.length} high-priority policy conflicts require immediate attention to prevent compliance gaps`);
      }
    }

    if (redundancies.length > 0) {
      insights.push(`${redundancies.length} redundant policies detected - consolidation could simplify governance and reduce maintenance overhead`);
    }

    const policiesNeedingReview = policies.filter(p => {
      if (!p.nextReviewDate || p.status !== "active") return false;
      const daysUntilReview = (new Date(p.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilReview < 30;
    });

    if (policiesNeedingReview.length > 0) {
      insights.push(`${policiesNeedingReview.length} policies are due for review within 30 days`);
    }

    if (regulatoryChangesStore.length > 0) {
      const upcomingChanges = regulatoryChangesStore.filter(r => new Date(r.changeDate) > new Date());
      if (upcomingChanges.length > 0) {
        insights.push(`${upcomingChanges.length} regulatory changes upcoming that may require policy updates`);
      }
    }

    const deprecatedCount = policies.filter(p => p.status === "deprecated").length;
    if (deprecatedCount > 0) {
      insights.push(`${deprecatedCount} deprecated policies should be reviewed for archival or retirement`);
    }

    return insights;
  }

  async detectConflicts(userId: string): Promise<PolicyConflict[]> {
    await this.logAuditEvent("DETECT_CONFLICTS", undefined, userId, {});

    const activePolicies = Array.from(policyStore.values()).filter(p => p.status === "active" || p.status === "deprecated");
    const newConflicts: PolicyConflict[] = [];

    for (let i = 0; i < activePolicies.length; i++) {
      for (let j = i + 1; j < activePolicies.length; j++) {
        const policy1 = activePolicies[i];
        const policy2 = activePolicies[j];

        const conflicts = this.analyzePoliyPairForConflicts(policy1, policy2);
        conflicts.forEach(conflict => {
          conflictStore.set(conflict.id, conflict);
          newConflicts.push(conflict);
        });
      }
    }

    if (aiEnabled && newConflicts.length > 0) {
      for (const conflict of newConflicts) {
        try {
          const aiAnalysis = await this.getAIConflictRecommendation(conflict);
          conflict.aiRecommendation = aiAnalysis.recommendation;
          conflict.impactAssessment = aiAnalysis.impact;
          conflictStore.set(conflict.id, conflict);
        } catch (error) {
          console.error("[AIPolicyLifecycle] AI conflict analysis error:", error);
        }
      }
    }

    await this.logAuditEvent("CONFLICTS_DETECTED", undefined, userId, { count: newConflicts.length });
    return newConflicts;
  }

  private analyzePoliyPairForConflicts(policy1: PolicyEntity, policy2: PolicyEntity): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];

    const dataTypeOverlap = policy1.dataTypes.filter(d => policy2.dataTypes.includes(d));
    const roleOverlap = policy1.roles.filter(r => policy2.roles.includes(r));

    if (dataTypeOverlap.length > 0 && roleOverlap.length > 0 && policy1.type === policy2.type) {
      if (policy1.enforcement !== policy2.enforcement) {
        conflicts.push({
          id: randomUUID(),
          policy1Id: policy1.id,
          policy1Name: policy1.name,
          policy2Id: policy2.id,
          policy2Name: policy2.name,
          conflictType: "enforcement_inconsistency",
          severity: "high",
          description: `Policies covering same data types (${dataTypeOverlap.join(", ")}) have different enforcement levels: ${policy1.enforcement} vs ${policy2.enforcement}`,
          affectedRules: [],
          detectedAt: new Date().toISOString(),
          aiRecommendation: "Harmonize enforcement levels to prevent inconsistent access decisions",
          impactAssessment: "May result in unpredictable access control behavior",
        });
      }
    }

    if (policy1.type === policy2.type && dataTypeOverlap.length > 0) {
      const ruleConflicts = this.detectRuleConflicts(policy1.rules, policy2.rules);
      if (ruleConflicts.length > 0) {
        conflicts.push({
          id: randomUUID(),
          policy1Id: policy1.id,
          policy1Name: policy1.name,
          policy2Id: policy2.id,
          policy2Name: policy2.name,
          conflictType: "rule_contradiction",
          severity: "critical",
          description: `Contradictory rules detected between policies`,
          affectedRules: ruleConflicts,
          detectedAt: new Date().toISOString(),
          aiRecommendation: "Review conflicting rules and establish clear precedence or merge policies",
          impactAssessment: "Critical: May cause access denials or inappropriate access grants",
        });
      }
    }

    return conflicts;
  }

  private detectRuleConflicts(rules1: PolicyRule[], rules2: PolicyRule[]): { policy1Rule: string; policy2Rule: string }[] {
    const conflicts: { policy1Rule: string; policy2Rule: string }[] = [];

    for (const r1 of rules1) {
      for (const r2 of rules2) {
        if (r1.condition === r2.condition && r1.action !== r2.action) {
          conflicts.push({ policy1Rule: r1.id, policy2Rule: r2.id });
        }
      }
    }

    return conflicts;
  }

  private async getAIConflictRecommendation(conflict: PolicyConflict): Promise<{ recommendation: string; impact: string }> {
    if (!aiEnabled) {
      return {
        recommendation: conflict.aiRecommendation,
        impact: conflict.impactAssessment,
      };
    }

    try {
      const content = await generatePhiSafeText({
        system: NO_CDS_POLICY_LIFECYCLE_PROMPT,
        user: `Analyze this policy conflict and provide recommendations:

Conflict Type: ${conflict.conflictType}
Severity: ${conflict.severity}
Policy 1: ${conflict.policy1Name}
Policy 2: ${conflict.policy2Name}
Description: ${conflict.description}

Provide:
1. A specific recommendation to resolve this conflict (2-3 sentences)
2. An impact assessment if left unresolved (1-2 sentences)

Format as JSON: {"recommendation": "...", "impact": "..."}`,
        temperature: 0.3,
        maxTokens: 500,
      });

      const parsed = JSON.parse(content || "{}");
      return {
        recommendation: parsed.recommendation || conflict.aiRecommendation,
        impact: parsed.impact || conflict.impactAssessment,
      };
    } catch (error) {
      console.error("[AIPolicyLifecycle] AI recommendation error:", error);
      return {
        recommendation: conflict.aiRecommendation,
        impact: conflict.impactAssessment,
      };
    }
  }

  async detectRedundancies(userId: string): Promise<PolicyRedundancy[]> {
    await this.logAuditEvent("DETECT_REDUNDANCIES", undefined, userId, {});

    const policies = Array.from(policyStore.values()).filter(p => p.status === "active" || p.status === "deprecated");
    const newRedundancies: PolicyRedundancy[] = [];

    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const p1 = policies[i];
        const p2 = policies[j];

        if (p1.type !== p2.type) continue;

        const dataOverlap = p1.dataTypes.filter(d => p2.dataTypes.includes(d));
        const ruleOverlap = this.calculateRuleOverlap(p1.rules, p2.rules);
        const overlapPercentage = Math.round((dataOverlap.length / Math.max(p1.dataTypes.length, p2.dataTypes.length)) * 50 + ruleOverlap * 50);

        if (overlapPercentage >= 70) {
          const primary = p1.version >= p2.version ? p1 : p2;
          const redundant = p1.version >= p2.version ? p2 : p1;

          const redundancy: PolicyRedundancy = {
            id: randomUUID(),
            primaryPolicyId: primary.id,
            primaryPolicyName: primary.name,
            redundantPolicyId: redundant.id,
            redundantPolicyName: redundant.name,
            overlapPercentage,
            overlappingRules: dataOverlap,
            recommendation: redundant.status === "deprecated" ? "archive_redundant" : overlapPercentage > 90 ? "merge" : "differentiate",
            rationale: this.generateRedundancyRationale(primary, redundant, overlapPercentage),
            detectedAt: new Date().toISOString(),
          };

          redundancyStore.set(redundancy.id, redundancy);
          newRedundancies.push(redundancy);
        }
      }
    }

    await this.logAuditEvent("REDUNDANCIES_DETECTED", undefined, userId, { count: newRedundancies.length });
    return newRedundancies;
  }

  private calculateRuleOverlap(rules1: PolicyRule[], rules2: PolicyRule[]): number {
    if (rules1.length === 0 || rules2.length === 0) return 0;

    let matchCount = 0;
    for (const r1 of rules1) {
      for (const r2 of rules2) {
        if (r1.condition === r2.condition || r1.action === r2.action) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / Math.max(rules1.length, rules2.length);
  }

  private generateRedundancyRationale(primary: PolicyEntity, redundant: PolicyEntity, overlapPercentage: number): string {
    if (redundant.status === "deprecated") {
      return `${redundant.name} is deprecated and has ${overlapPercentage}% overlap with the active ${primary.name}. The deprecated policy should be archived to prevent confusion.`;
    }

    if (overlapPercentage > 90) {
      return `These policies have ${overlapPercentage}% overlap in scope and rules. Consider merging into a single comprehensive policy to reduce maintenance overhead.`;
    }

    return `${overlapPercentage}% overlap detected. Consider differentiating the policies more clearly or documenting specific use cases for each.`;
  }

  async analyzeOutdatedPolicies(userId: string): Promise<OutdatedPolicyAnalysis[]> {
    await this.logAuditEvent("ANALYZE_OUTDATED", undefined, userId, {});

    const policies = Array.from(policyStore.values()).filter(p => p.status === "active");
    const analyses: OutdatedPolicyAnalysis[] = [];

    for (const policy of policies) {
      const daysSinceUpdate = Math.floor((Date.now() - new Date(policy.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      const relevantRegChanges = regulatoryChangesStore.filter(r => policy.regulatoryMappings.includes(r.regulation));

      const auditIndicators = this.analyzeAuditIndicators(policy.id);
      const violationsTrend = this.analyzeViolationTrend(policy.id);

      let recommendation: OutdatedPolicyAnalysis["recommendation"] = "no_action";
      const suggestedUpdates: string[] = [];

      if (daysSinceUpdate > 365) {
        recommendation = "update_recommended";
        suggestedUpdates.push("Policy has not been updated in over a year - schedule comprehensive review");
      }

      if (relevantRegChanges.some(r => r.impactLevel === "high")) {
        recommendation = "update_urgent";
        suggestedUpdates.push(...relevantRegChanges.filter(r => r.impactLevel === "high").map(r => `Address ${r.regulation} change: ${r.description}`));
      }

      if (violationsTrend === "increasing") {
        recommendation = recommendation === "no_action" ? "review" : recommendation;
        suggestedUpdates.push("Violation trend is increasing - review rule effectiveness");
      }

      if (auditIndicators.length > 0) {
        suggestedUpdates.push(...auditIndicators);
      }

      if (recommendation !== "no_action" || suggestedUpdates.length > 0) {
        const analysis: OutdatedPolicyAnalysis = {
          id: randomUUID(),
          policyId: policy.id,
          policyName: policy.name,
          lastModified: policy.updatedAt,
          daysSinceUpdate,
          violationsTrend,
          violationsLast30Days: Math.floor(Math.random() * 20),
          auditLogIndicators: auditIndicators,
          regulatoryChanges: relevantRegChanges,
          recommendation,
          suggestedUpdates,
          analysisDate: new Date().toISOString(),
        };

        outdatedAnalysisStore.set(analysis.id, analysis);
        analyses.push(analysis);
      }
    }

    await this.logAuditEvent("OUTDATED_ANALYSIS_COMPLETE", undefined, userId, { analyzed: policies.length, outdated: analyses.length });
    return analyses;
  }

  private analyzeAuditIndicators(policyId: string): string[] {
    const indicators: string[] = [];
    const relevantLogs = auditLogStore.filter(l => l.policyId === policyId);

    if (relevantLogs.filter(l => l.action.includes("DENIED")).length > 10) {
      indicators.push("High denial rate detected - rules may be overly restrictive");
    }

    return indicators;
  }

  private analyzeViolationTrend(policyId: string): "increasing" | "stable" | "decreasing" {
    const random = Math.random();
    return random < 0.3 ? "increasing" : random < 0.7 ? "stable" : "decreasing";
  }

  async suggestRetirement(policyId: string, userId: string): Promise<PolicyRetirementRecommendation | null> {
    const policy = policyStore.get(policyId);
    if (!policy) return null;

    await this.logAuditEvent("SUGGEST_RETIREMENT", policyId, userId, {});

    let reason: PolicyRetirementRecommendation["reason"] = "obsolete";
    let replacementPolicyId: string | undefined;
    let replacementPolicyName: string | undefined;

    const similarActive = Array.from(policyStore.values()).find(
      p => p.id !== policyId && p.type === policy.type && p.status === "active" && p.version > policy.version
    );

    if (similarActive) {
      reason = "superseded";
      replacementPolicyId = similarActive.id;
      replacementPolicyName = similarActive.name;
    }

    const recommendation: PolicyRetirementRecommendation = {
      id: randomUUID(),
      policyId: policy.id,
      policyName: policy.name,
      reason,
      replacementPolicyId,
      replacementPolicyName,
      usageStats: {
        enforcementCount30Days: Math.floor(Math.random() * 100),
        violationsCount30Days: Math.floor(Math.random() * 10),
      },
      recommendation: policy.status === "deprecated" ? "archive" : "deprecate",
      transitionPlan: [
        "Notify all policy stakeholders of planned retirement",
        "Migrate any dependent workflows to replacement policy",
        "Update documentation and training materials",
        "Archive policy after 30-day transition period",
      ],
      riskAssessment: reason === "superseded"
        ? `Low risk - replacement policy (${replacementPolicyName}) provides equivalent or better coverage`
        : "Medium risk - ensure no critical workflows depend on this policy before retirement",
      recommendedAt: new Date().toISOString(),
      status: "pending",
    };

    retirementStore.set(recommendation.id, recommendation);
    await this.logAuditEvent("RETIREMENT_RECOMMENDED", policyId, userId, { reason, recommendation: recommendation.recommendation });

    return recommendation;
  }

  async createPolicyVersion(policyId: string, changes: PolicyChange[], userId: string, changeReason: string, regulatoryDriver?: string): Promise<PolicyVersion | null> {
    const policy = policyStore.get(policyId);
    if (!policy) return null;

    const newVersion = policy.version + 1;

    const version: PolicyVersion = {
      id: randomUUID(),
      policyId,
      version: newVersion,
      changes,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      status: "pending_approval",
      previousVersionId: Array.from(versionStore.values()).find(v => v.policyId === policyId && v.version === policy.version)?.id,
      changeReason,
      regulatoryDriver,
    };

    versionStore.set(version.id, version);

    const workflow = await this.createApprovalWorkflow(policyId, version.id, "policy_update", userId);

    await this.logAuditEvent("VERSION_CREATED", policyId, userId, {
      version: newVersion,
      changesCount: changes.length,
      workflowId: workflow.id,
    });

    return version;
  }

  async createApprovalWorkflow(policyId: string, versionId: string, workflowType: ApprovalWorkflow["workflowType"], requestedBy: string): Promise<ApprovalWorkflow> {
    const workflow: ApprovalWorkflow = {
      id: randomUUID(),
      policyId,
      policyVersionId: versionId,
      workflowType,
      status: "pending",
      requestedBy,
      requestedAt: new Date().toISOString(),
      reviewers: [
        { userId: "compliance_officer", role: "Compliance Officer" },
        { userId: "security_admin", role: "Security Administrator" },
      ],
      requiredApprovals: 2,
      currentApprovals: 0,
      comments: [{
        id: randomUUID(),
        userId: "system",
        comment: `Approval workflow created for ${workflowType.replace("_", " ")}`,
        createdAt: new Date().toISOString(),
        isSystemGenerated: true,
      }],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      autoApprovalEligible: false,
    };

    approvalWorkflowStore.set(workflow.id, workflow);
    await this.logAuditEvent("WORKFLOW_CREATED", policyId, requestedBy, { workflowId: workflow.id, type: workflowType });

    return workflow;
  }

  async submitApprovalDecision(workflowId: string, reviewerId: string, decision: "approved" | "rejected", comments?: string): Promise<ApprovalWorkflow | null> {
    const workflow = approvalWorkflowStore.get(workflowId);
    if (!workflow) return null;

    const reviewer = workflow.reviewers.find(r => r.userId === reviewerId);
    if (!reviewer) return null;

    reviewer.decision = decision;
    reviewer.decidedAt = new Date().toISOString();
    reviewer.comments = comments;

    if (decision === "approved") {
      workflow.currentApprovals++;
    }

    if (comments) {
      workflow.comments.push({
        id: randomUUID(),
        userId: reviewerId,
        comment: comments,
        createdAt: new Date().toISOString(),
        isSystemGenerated: false,
      });
    }

    if (workflow.currentApprovals >= workflow.requiredApprovals) {
      workflow.status = "approved";
      workflow.completedAt = new Date().toISOString();

      const version = versionStore.get(workflow.policyVersionId);
      if (version) {
        version.status = "active";
        version.approvedAt = new Date().toISOString();
        version.approvedBy = reviewerId;
        versionStore.set(version.id, version);

        const policy = policyStore.get(workflow.policyId);
        if (policy) {
          policy.version = version.version;
          policy.updatedAt = new Date().toISOString();
          policyStore.set(policy.id, policy);
        }
      }
    } else if (workflow.reviewers.every(r => r.decision === "rejected")) {
      workflow.status = "rejected";
      workflow.completedAt = new Date().toISOString();

      const version = versionStore.get(workflow.policyVersionId);
      if (version) {
        version.status = "draft";
        versionStore.set(version.id, version);
      }
    } else {
      workflow.status = "in_review";
    }

    approvalWorkflowStore.set(workflowId, workflow);
    await this.logAuditEvent("APPROVAL_SUBMITTED", workflow.policyId, reviewerId, {
      workflowId,
      decision,
      newStatus: workflow.status,
    });

    return workflow;
  }

  async resolveConflict(conflictId: string, userId: string, resolutionNotes: string): Promise<PolicyConflict | null> {
    const conflict = conflictStore.get(conflictId);
    if (!conflict) return null;

    conflict.resolvedAt = new Date().toISOString();
    conflict.resolutionNotes = resolutionNotes;
    conflictStore.set(conflictId, conflict);

    await this.logAuditEvent("CONFLICT_RESOLVED", conflict.policy1Id, userId, {
      conflictId,
      policy1: conflict.policy1Id,
      policy2: conflict.policy2Id,
    });

    return conflict;
  }

  async resolveRedundancy(redundancyId: string, userId: string): Promise<PolicyRedundancy | null> {
    const redundancy = redundancyStore.get(redundancyId);
    if (!redundancy) return null;

    redundancy.resolvedAt = new Date().toISOString();
    redundancyStore.set(redundancyId, redundancy);

    if (redundancy.recommendation === "archive_redundant") {
      const policy = policyStore.get(redundancy.redundantPolicyId);
      if (policy) {
        policy.status = "archived";
        policy.updatedAt = new Date().toISOString();
        policyStore.set(policy.id, policy);
      }
    }

    await this.logAuditEvent("REDUNDANCY_RESOLVED", redundancy.primaryPolicyId, userId, {
      redundancyId,
      action: redundancy.recommendation,
    });

    return redundancy;
  }

  async approveRetirement(recommendationId: string, userId: string): Promise<PolicyRetirementRecommendation | null> {
    const recommendation = retirementStore.get(recommendationId);
    if (!recommendation) return null;

    recommendation.status = "approved";
    recommendation.approvedBy = userId;
    recommendation.approvedAt = new Date().toISOString();
    retirementStore.set(recommendationId, recommendation);

    const policy = policyStore.get(recommendation.policyId);
    if (policy) {
      policy.status = recommendation.recommendation === "retire" ? "retired" : recommendation.recommendation === "archive" ? "archived" : "deprecated";
      policy.updatedAt = new Date().toISOString();
      policyStore.set(policy.id, policy);
    }

    await this.logAuditEvent("RETIREMENT_APPROVED", recommendation.policyId, userId, {
      recommendationId,
      action: recommendation.recommendation,
    });

    return recommendation;
  }

  listPolicies(filters?: { status?: PolicyStatus; type?: string }): PolicyEntity[] {
    let policies = Array.from(policyStore.values());

    if (filters?.status) {
      policies = policies.filter(p => p.status === filters.status);
    }
    if (filters?.type) {
      policies = policies.filter(p => p.type === filters.type);
    }

    return policies.sort((a, b) => a.name.localeCompare(b.name));
  }

  getPolicy(policyId: string): PolicyEntity | undefined {
    return policyStore.get(policyId);
  }

  listConflicts(includeResolved: boolean = false): PolicyConflict[] {
    let conflicts = Array.from(conflictStore.values());
    if (!includeResolved) {
      conflicts = conflicts.filter(c => !c.resolvedAt);
    }
    return conflicts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  listRedundancies(includeResolved: boolean = false): PolicyRedundancy[] {
    let redundancies = Array.from(redundancyStore.values());
    if (!includeResolved) {
      redundancies = redundancies.filter(r => !r.resolvedAt);
    }
    return redundancies.sort((a, b) => b.overlapPercentage - a.overlapPercentage);
  }

  listRetirementRecommendations(filters?: { status?: PolicyRetirementRecommendation["status"] }): PolicyRetirementRecommendation[] {
    let recommendations = Array.from(retirementStore.values());
    if (filters?.status) {
      recommendations = recommendations.filter(r => r.status === filters.status);
    }
    return recommendations;
  }

  listApprovalWorkflows(filters?: { status?: ApprovalWorkflow["status"] }): ApprovalWorkflow[] {
    let workflows = Array.from(approvalWorkflowStore.values());
    if (filters?.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }
    return workflows.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  listVersions(policyId: string): PolicyVersion[] {
    return Array.from(versionStore.values())
      .filter(v => v.policyId === policyId)
      .sort((a, b) => b.version - a.version);
  }

  getRegulatoryChanges(): RegulatoryChange[] {
    return regulatoryChangesStore.sort((a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime());
  }

  async draftPolicy(request: PolicyDraftRequest, userId: string): Promise<PolicyDraft> {
    await this.logAuditEvent("DRAFT_POLICY_REQUESTED", undefined, userId, { request });

    let generatedRules: PolicyRule[];
    let complianceNotes: string[];
    let riskConsiderations: string[];
    let aiRationale: string;

    if (aiEnabled) {
      try {
        const content = await generatePhiSafeText({
          system: AI_POLICY_DRAFT_PROMPT,
          user: `Draft a ${request.type} policy with the following requirements:
Name: ${request.name}
Description: ${request.description}
Regulatory Frameworks: ${request.regulatoryFrameworks.join(", ")}
Data Types: ${request.dataTypes.join(", ")}
Roles: ${request.roles.join(", ")}
Enforcement Level: ${request.enforcementLevel}
${request.additionalContext ? `Additional Context: ${request.additionalContext}` : ""}

Provide response as JSON with structure:
{
  "rules": [{"id": "rule-1", "name": "...", "condition": "...", "action": "...", "priority": 1}],
  "complianceNotes": ["..."],
  "riskConsiderations": ["..."],
  "rationale": "..."
}`,
          temperature: 0.7,
          maxTokens: 1500,
        });

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          generatedRules = parsed.rules || [];
          complianceNotes = parsed.complianceNotes || [];
          riskConsiderations = parsed.riskConsiderations || [];
          aiRationale = parsed.rationale || "AI-generated policy draft";
        } else {
          throw new Error("Failed to parse AI response");
        }
      } catch (error) {
        console.error("[AIPolicyLifecycle] OpenAI draft error:", error);
        ({ generatedRules, complianceNotes, riskConsiderations, aiRationale } = this.generateFallbackDraft(request));
      }
    } else {
      ({ generatedRules, complianceNotes, riskConsiderations, aiRationale } = this.generateFallbackDraft(request));
    }

    const policyId = `policy-${request.type}-${Date.now()}`;
    const generatedPolicy: PolicyEntity = {
      id: policyId,
      name: request.name,
      description: request.description,
      type: request.type,
      status: "draft",
      version: 1,
      rules: generatedRules,
      dataTypes: request.dataTypes,
      roles: request.roles,
      enforcement: request.enforcementLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      regulatoryMappings: request.regulatoryFrameworks,
    };

    const draft: PolicyDraft = {
      id: randomUUID(),
      request,
      generatedPolicy,
      aiRationale,
      suggestedRules: generatedRules,
      complianceNotes,
      riskConsiderations,
      createdAt: new Date().toISOString(),
      status: "draft",
    };

    policyDraftStore.set(draft.id, draft);
    await this.logAuditEvent("DRAFT_POLICY_GENERATED", policyId, userId, { draftId: draft.id });

    return draft;
  }

  private generateFallbackDraft(request: PolicyDraftRequest): {
    generatedRules: PolicyRule[];
    complianceNotes: string[];
    riskConsiderations: string[];
    aiRationale: string;
  } {
    const generatedRules: PolicyRule[] = [];
    let priority = 1;

    if (request.type === "access_control") {
      generatedRules.push(
        { id: `rule-${priority}`, name: "Role-Based Access", condition: `user_role IN (${request.roles.join(", ")})`, action: "allow_access", priority: priority++ },
        { id: `rule-${priority}`, name: "Data Classification Check", condition: `data_type IN (${request.dataTypes.join(", ")})`, action: "require_authorization", priority: priority++ },
        { id: `rule-${priority}`, name: "Audit Trail", condition: "access_granted=true", action: "log_access_event", priority: priority++ }
      );
    } else if (request.type === "retention") {
      generatedRules.push(
        { id: `rule-${priority}`, name: "PHI Retention", condition: "data_type=PHI", action: "retain_7_years", priority: priority++ },
        { id: `rule-${priority}`, name: "Audit Log Retention", condition: "data_type=audit_log", action: "retain_6_years", priority: priority++ }
      );
    } else if (request.type === "encryption") {
      generatedRules.push(
        { id: `rule-${priority}`, name: "Data at Rest", condition: "data_at_rest=true", action: "encrypt_aes256gcm", priority: priority++ },
        { id: `rule-${priority}`, name: "Data in Transit", condition: "data_in_transit=true", action: "require_tls13", priority: priority++ }
      );
    } else if (request.type === "consent") {
      generatedRules.push(
        { id: `rule-${priority}`, name: "Explicit Consent Required", condition: "data_processing=true", action: "require_consent", priority: priority++ },
        { id: `rule-${priority}`, name: "Consent Withdrawal", condition: "request_type=withdrawal", action: "process_immediately", priority: priority++ }
      );
    } else {
      generatedRules.push(
        { id: `rule-${priority}`, name: "Default Rule", condition: "always", action: "apply_policy", priority: priority++ }
      );
    }

    const complianceNotes = request.regulatoryFrameworks.map(reg => 
      `Policy aligns with ${reg} requirements for ${request.dataTypes.join(", ")} data handling`
    );

    const riskConsiderations = [
      `Enforcement level set to ${request.enforcementLevel} - ensure monitoring is in place`,
      `${request.roles.length} roles have access - review periodically for least privilege compliance`,
      `Data types ${request.dataTypes.join(", ")} require ${request.enforcementLevel} protection`
    ];

    return {
      generatedRules,
      complianceNotes,
      riskConsiderations,
      aiRationale: `Generated ${request.type} policy based on ${request.regulatoryFrameworks.join(", ")} requirements with ${request.enforcementLevel} enforcement for ${request.dataTypes.join(", ")} data types.`
    };
  }

  async acceptDraft(draftId: string, userId: string, modifications?: Partial<PolicyEntity>): Promise<PolicyEntity | null> {
    const draft = policyDraftStore.get(draftId);
    if (!draft) return null;

    const policy = { ...draft.generatedPolicy, ...modifications };
    policyStore.set(policy.id, policy);

    draft.status = "accepted";
    draft.acceptedAt = new Date().toISOString();
    draft.acceptedBy = userId;
    policyDraftStore.set(draftId, draft);

    await this.createApprovalWorkflow(policy.id, randomUUID(), "new_policy", userId);
    await this.logAuditEvent("DRAFT_ACCEPTED", policy.id, userId, { draftId });

    return policy;
  }

  listDrafts(status?: PolicyDraft["status"]): PolicyDraft[] {
    let drafts = Array.from(policyDraftStore.values());
    if (status) {
      drafts = drafts.filter(d => d.status === status);
    }
    return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getDraft(draftId: string): PolicyDraft | undefined {
    return policyDraftStore.get(draftId);
  }

  async suggestAmendments(policyId: string, userId: string, trigger?: AmendmentSuggestion["trigger"]): Promise<AmendmentSuggestion[]> {
    const policy = policyStore.get(policyId);
    if (!policy) return [];

    await this.logAuditEvent("AMENDMENTS_REQUESTED", policyId, userId, { trigger });

    const suggestions: AmendmentSuggestion[] = [];

    const relevantRegChanges = regulatoryChangesStore.filter(
      rc => policy.regulatoryMappings.includes(rc.regulation) && (!trigger || trigger === "regulatory_change")
    );

    for (const regChange of relevantRegChanges) {
      let suggestedChanges: PolicyChange[];
      let rationale: string;
      let impactAnalysis: string;
      let implementationSteps: string[];

      if (aiEnabled) {
        try {
          const content = await generatePhiSafeText({
            system: AI_AMENDMENT_PROMPT,
            user: `Suggest amendments for policy "${policy.name}" based on this regulatory change:
Regulation: ${regChange.regulation}
Change: ${regChange.description}
Impact Level: ${regChange.impactLevel}
Current Policy Rules: ${JSON.stringify(policy.rules)}

Provide response as JSON:
{
  "changes": [{"field": "...", "oldValue": ..., "newValue": ..., "changeType": "modify"}],
  "rationale": "...",
  "impactAnalysis": "...",
  "implementationSteps": ["..."]
}`,
            temperature: 0.7,
            maxTokens: 1000,
          });

          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            suggestedChanges = parsed.changes || [];
            rationale = parsed.rationale || "";
            impactAnalysis = parsed.impactAnalysis || "";
            implementationSteps = parsed.implementationSteps || [];
          } else {
            throw new Error("Failed to parse AI response");
          }
        } catch (error) {
          console.error("[AIPolicyLifecycle] OpenAI amendment error:", error);
          ({ suggestedChanges, rationale, impactAnalysis, implementationSteps } = this.generateFallbackAmendment(policy, regChange));
        }
      } else {
        ({ suggestedChanges, rationale, impactAnalysis, implementationSteps } = this.generateFallbackAmendment(policy, regChange));
      }

      const suggestion: AmendmentSuggestion = {
        id: randomUUID(),
        policyId: policy.id,
        policyName: policy.name,
        trigger: "regulatory_change",
        triggerDetails: `${regChange.regulation}: ${regChange.description}`,
        severity: regChange.impactLevel as "high" | "medium" | "low",
        suggestedChanges,
        rationale,
        impactAnalysis,
        implementationSteps,
        estimatedEffort: regChange.impactLevel === "high" ? "high" : regChange.impactLevel === "medium" ? "medium" : "low",
        regulatoryDeadline: regChange.changeDate,
        createdAt: new Date().toISOString(),
        status: "pending",
      };

      amendmentStore.set(suggestion.id, suggestion);
      suggestions.push(suggestion);
    }

    if (!trigger || trigger === "periodic_review") {
      const daysSinceUpdate = Math.floor((Date.now() - new Date(policy.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate > 180) {
        const periodicSuggestion: AmendmentSuggestion = {
          id: randomUUID(),
          policyId: policy.id,
          policyName: policy.name,
          trigger: "periodic_review",
          triggerDetails: `Policy has not been updated in ${daysSinceUpdate} days`,
          severity: daysSinceUpdate > 365 ? "high" : "medium",
          suggestedChanges: [{
            field: "lastReviewedAt",
            oldValue: policy.lastReviewedAt,
            newValue: new Date().toISOString(),
            changeType: "modify"
          }],
          rationale: `Regular policy review is required to ensure continued compliance and relevance. This policy was last modified ${daysSinceUpdate} days ago.`,
          impactAnalysis: "Policy may contain outdated requirements or miss recent regulatory updates.",
          implementationSteps: [
            "Review all policy rules for current relevance",
            "Check against latest regulatory requirements",
            "Update any outdated references or procedures",
            "Document changes and rationale",
            "Submit for approval workflow"
          ],
          estimatedEffort: "medium",
          createdAt: new Date().toISOString(),
          status: "pending",
        };

        amendmentStore.set(periodicSuggestion.id, periodicSuggestion);
        suggestions.push(periodicSuggestion);
      }
    }

    await this.logAuditEvent("AMENDMENTS_GENERATED", policyId, userId, { count: suggestions.length });
    return suggestions;
  }

  private generateFallbackAmendment(policy: PolicyEntity, regChange: RegulatoryChange): {
    suggestedChanges: PolicyChange[];
    rationale: string;
    impactAnalysis: string;
    implementationSteps: string[];
  } {
    return {
      suggestedChanges: [{
        field: "rules",
        oldValue: policy.rules,
        newValue: [...policy.rules, {
          id: `rule-${policy.rules.length + 1}`,
          name: `${regChange.regulation} Update`,
          condition: `regulatory_requirement=${regChange.regulation.toLowerCase()}`,
          action: "apply_updated_requirement",
          priority: policy.rules.length + 1
        }],
        changeType: "modify"
      }],
      rationale: `Amendment required due to ${regChange.regulation} regulatory change: ${regChange.description}`,
      impactAnalysis: `This change affects ${policy.dataTypes.join(", ")} data handling under ${regChange.regulation} requirements. Impact level: ${regChange.impactLevel}.`,
      implementationSteps: [
        `Review ${regChange.regulation} change details`,
        "Update policy rules to align with new requirements",
        "Test enforcement mechanisms",
        "Train affected staff on changes",
        "Document compliance evidence"
      ]
    };
  }

  async acceptAmendment(amendmentId: string, userId: string): Promise<PolicyVersion | null> {
    const amendment = amendmentStore.get(amendmentId);
    if (!amendment) return null;

    const version = await this.createPolicyVersion(
      amendment.policyId,
      amendment.suggestedChanges,
      userId,
      amendment.rationale,
      amendment.trigger === "regulatory_change" ? amendment.triggerDetails : undefined
    );

    if (version) {
      amendment.status = "implemented";
      amendment.reviewedBy = userId;
      amendment.reviewedAt = new Date().toISOString();
      amendmentStore.set(amendmentId, amendment);
    }

    return version;
  }

  listAmendments(policyId?: string, status?: AmendmentSuggestion["status"]): AmendmentSuggestion[] {
    let amendments = Array.from(amendmentStore.values());
    if (policyId) {
      amendments = amendments.filter(a => a.policyId === policyId);
    }
    if (status) {
      amendments = amendments.filter(a => a.status === status);
    }
    return amendments.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  async createAutoReviewSchedule(
    policyId: string,
    userId: string,
    options: {
      frequency: AutoReviewSchedule["reviewFrequency"];
      autoArchiveIfInactive?: boolean;
      inactiveDaysThreshold?: number;
      autoRiskScan?: boolean;
      autoRegulatoryCheck?: boolean;
    }
  ): Promise<AutoReviewSchedule | null> {
    const policy = policyStore.get(policyId);
    if (!policy) return null;

    const frequencyDays = {
      monthly: 30,
      quarterly: 90,
      semi_annual: 180,
      annual: 365
    };

    const schedule: AutoReviewSchedule = {
      id: randomUUID(),
      policyId,
      policyName: policy.name,
      reviewFrequency: options.frequency,
      lastReviewDate: policy.lastReviewedAt,
      nextReviewDate: new Date(Date.now() + frequencyDays[options.frequency] * 24 * 60 * 60 * 1000).toISOString(),
      autoArchiveIfInactive: options.autoArchiveIfInactive ?? false,
      inactiveDaysThreshold: options.inactiveDaysThreshold ?? 365,
      autoRiskScan: options.autoRiskScan ?? true,
      autoRegulatoryCheck: options.autoRegulatoryCheck ?? true,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    autoReviewScheduleStore.set(schedule.id, schedule);
    await this.logAuditEvent("AUTO_REVIEW_SCHEDULED", policyId, userId, { scheduleId: schedule.id });

    return schedule;
  }

  async runAutoReview(scheduleId: string, userId: string): Promise<AutoReviewResult | null> {
    const schedule = autoReviewScheduleStore.get(scheduleId);
    if (!schedule) return null;

    const policy = policyStore.get(schedule.policyId);
    if (!policy) return null;

    await this.logAuditEvent("AUTO_REVIEW_STARTED", policy.id, userId, { scheduleId });

    const regulatoryCompliance: { status: "compliant" | "needs_update" | "non_compliant"; details: string }[] = [];
    if (schedule.autoRegulatoryCheck) {
      for (const reg of policy.regulatoryMappings) {
        const relatedChanges = regulatoryChangesStore.filter(rc => rc.regulation === reg && rc.affectedPolicies.includes(policy.id));
        if (relatedChanges.length > 0) {
          regulatoryCompliance.push({
            status: "needs_update",
            details: `${reg}: ${relatedChanges.length} regulatory change(s) require policy updates`
          });
        } else {
          regulatoryCompliance.push({
            status: "compliant",
            details: `${reg}: No outstanding regulatory changes`
          });
        }
      }
    }

    const daysSinceUpdate = Math.floor((Date.now() - new Date(policy.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    const riskLevel = daysSinceUpdate > 365 ? "high" : daysSinceUpdate > 180 ? "medium" : "low";
    const riskFactors: string[] = [];
    if (daysSinceUpdate > 180) riskFactors.push(`Policy not updated in ${daysSinceUpdate} days`);
    if (policy.status === "deprecated") riskFactors.push("Policy is deprecated");

    const enforcementCount = Math.floor(Math.random() * 100) + 10;
    const violationCount = Math.floor(Math.random() * 10);
    const trend = violationCount > 5 ? "increasing" : violationCount > 2 ? "stable" : "decreasing";

    const recommendedActions: string[] = [];
    let recommendation: AutoReviewResult["recommendation"] = "no_action";
    let autoActionTaken: string | undefined;

    if (regulatoryCompliance.some(rc => rc.status === "needs_update")) {
      recommendedActions.push("Update policy to address regulatory changes");
      recommendation = "minor_update";
    }

    if (riskLevel === "high") {
      recommendedActions.push("Comprehensive policy review required");
      recommendation = "major_revision";
    }

    if (schedule.autoArchiveIfInactive && daysSinceUpdate > schedule.inactiveDaysThreshold && enforcementCount < 5) {
      recommendation = "archive";
      policy.status = "archived";
      policy.updatedAt = new Date().toISOString();
      policyStore.set(policy.id, policy);
      autoActionTaken = `Policy automatically archived due to ${daysSinceUpdate} days of inactivity`;
    }

    const result: AutoReviewResult = {
      id: randomUUID(),
      scheduleId,
      policyId: policy.id,
      policyName: policy.name,
      reviewDate: new Date().toISOString(),
      findings: {
        regulatoryCompliance,
        riskAssessment: { level: riskLevel, factors: riskFactors },
        usageAnalysis: { enforcementCount, violationCount, trend },
        recommendedActions,
      },
      recommendation,
      autoActionTaken,
      createdAt: new Date().toISOString(),
    };

    autoReviewResultStore.set(result.id, result);

    schedule.lastReviewDate = new Date().toISOString();
    const frequencyDays = { monthly: 30, quarterly: 90, semi_annual: 180, annual: 365 };
    schedule.nextReviewDate = new Date(Date.now() + frequencyDays[schedule.reviewFrequency] * 24 * 60 * 60 * 1000).toISOString();
    autoReviewScheduleStore.set(scheduleId, schedule);

    await this.logAuditEvent("AUTO_REVIEW_COMPLETED", policy.id, userId, {
      scheduleId,
      resultId: result.id,
      recommendation,
      autoActionTaken,
    });

    return result;
  }

  listAutoReviewSchedules(status?: AutoReviewSchedule["status"]): AutoReviewSchedule[] {
    let schedules = Array.from(autoReviewScheduleStore.values());
    if (status) {
      schedules = schedules.filter(s => s.status === status);
    }
    return schedules.sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
  }

  listAutoReviewResults(policyId?: string): AutoReviewResult[] {
    let results = Array.from(autoReviewResultStore.values());
    if (policyId) {
      results = results.filter(r => r.policyId === policyId);
    }
    return results.sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime());
  }

  async runBulkAmendmentScan(userId: string): Promise<{ policiesScanned: number; amendmentsSuggested: number; amendments: AmendmentSuggestion[] }> {
    await this.logAuditEvent("BULK_AMENDMENT_SCAN_STARTED", undefined, userId, {});

    const allPolicies = Array.from(policyStore.values()).filter(p => p.status === "active");
    const allAmendments: AmendmentSuggestion[] = [];

    for (const policy of allPolicies) {
      const amendments = await this.suggestAmendments(policy.id, userId);
      allAmendments.push(...amendments);
    }

    await this.logAuditEvent("BULK_AMENDMENT_SCAN_COMPLETED", undefined, userId, {
      policiesScanned: allPolicies.length,
      amendmentsSuggested: allAmendments.length,
    });

    return {
      policiesScanned: allPolicies.length,
      amendmentsSuggested: allAmendments.length,
      amendments: allAmendments,
    };
  }

  async runDueReviews(userId: string): Promise<AutoReviewResult[]> {
    const now = new Date();
    const dueSchedules = Array.from(autoReviewScheduleStore.values()).filter(
      s => s.status === "active" && new Date(s.nextReviewDate) <= now
    );

    const results: AutoReviewResult[] = [];
    for (const schedule of dueSchedules) {
      const result = await this.runAutoReview(schedule.id, userId);
      if (result) results.push(result);
    }

    return results;
  }
}

export const aiPolicyLifecycleService = new AIPolicyLifecycleService();
