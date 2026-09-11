import crypto from "crypto";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export type AccessLevel = "none" | "read" | "write" | "admin";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PolicyStatus = "active" | "inactive" | "pending_review";

export interface Role {
  id: string;
  name: string;
  description: string;
  baseAccessLevel: AccessLevel;
  permissions: string[];
  resourceRestrictions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  roleId: string;
  resourceType: string;
  accessLevel: AccessLevel;
  conditions: PolicyCondition[];
  dataElements: DataElementAccess[];
  status: PolicyStatus;
  aiSuggested: boolean;
  aiConfidence?: number;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  noCdsCompliance: string;
}

export interface PolicyCondition {
  id: string;
  type: "time_based" | "location_based" | "context_based" | "risk_based" | "consent_based";
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in_range";
  field: string;
  value: string | number | boolean | string[];
  description: string;
}

export interface DataElementAccess {
  element: string;
  accessLevel: AccessLevel;
  sensitivityLevel: "public" | "internal" | "confidential" | "restricted";
  maskingRule?: string;
  auditRequired: boolean;
}

export interface DynamicAccessAdjustment {
  id: string;
  patientId: string;
  userId: string;
  roleId: string;
  originalAccessLevel: AccessLevel;
  adjustedAccessLevel: AccessLevel;
  reason: string;
  riskFactors: RiskFactor[];
  contextFactors: ContextFactor[];
  validUntil: Date;
  autoRevert: boolean;
  createdAt: Date;
  noCdsCompliance: string;
}

export interface RiskFactor {
  type: string;
  severity: RiskLevel;
  description: string;
  weight: number;
}

export interface ContextFactor {
  type: string;
  value: string;
  impact: "increase" | "decrease" | "neutral";
  description: string;
}

export interface AccessAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  action: "view" | "create" | "update" | "delete" | "export" | "print";
  accessLevel: AccessLevel;
  policyId: string;
  dynamicAdjustmentId?: string;
  dataElements: string[];
  outcome: "allowed" | "denied" | "partial";
  denialReason?: string;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  riskScore: number;
  anomalyFlags: string[];
  noCdsCompliance: string;
}

export interface AccessPatternAnalysis {
  id: string;
  analysisType: "user" | "role" | "resource" | "temporal" | "anomaly";
  periodStart: Date;
  periodEnd: Date;
  findings: PatternFinding[];
  recommendations: string[];
  complianceScore: number;
  riskIndicators: string[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface PatternFinding {
  id: string;
  type: string;
  severity: RiskLevel;
  description: string;
  affectedEntities: string[];
  occurrenceCount: number;
  firstSeen: Date;
  lastSeen: Date;
  suggestedAction: string;
}

export interface AIPolicySuggestion {
  id: string;
  forRoleId: string;
  forResourceType: string;
  suggestedPolicy: Partial<AccessPolicy>;
  reasoning: string;
  confidence: number;
  basedOn: string[];
  status: "pending" | "accepted" | "rejected" | "modified";
  createdAt: Date;
  noCdsCompliance: string;
}

class AIAccessControlService {
  private roles: Map<string, Role> = new Map();
  private policies: Map<string, AccessPolicy> = new Map();
  private adjustments: Map<string, DynamicAccessAdjustment> = new Map();
  private auditLog: AccessAuditEntry[] = [];
  private patternAnalyses: Map<string, AccessPatternAnalysis> = new Map();
  private suggestions: Map<string, AIPolicySuggestion> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const roles: Role[] = [
      {
        id: "role-physician",
        name: "Physician",
        description: "Licensed healthcare provider with full clinical access",
        baseAccessLevel: "write",
        permissions: ["view_patient_records", "update_clinical_notes", "order_labs", "prescribe_medications"],
        resourceRestrictions: ["billing_data", "administrative_settings"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "role-nurse",
        name: "Nurse",
        description: "Clinical staff with care coordination access",
        baseAccessLevel: "read",
        permissions: ["view_patient_records", "update_vitals", "view_medications", "document_care"],
        resourceRestrictions: ["prescribing", "diagnosis_codes", "billing_data"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "role-admin",
        name: "Administrative Staff",
        description: "Non-clinical staff with administrative access",
        baseAccessLevel: "read",
        permissions: ["view_demographics", "schedule_appointments", "manage_billing"],
        resourceRestrictions: ["clinical_notes", "lab_results", "medications", "diagnoses"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "role-researcher",
        name: "Researcher",
        description: "Research staff with de-identified data access",
        baseAccessLevel: "read",
        permissions: ["view_deidentified_data", "export_aggregated_stats"],
        resourceRestrictions: ["phi", "direct_identifiers", "clinical_modifications"],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    roles.forEach(r => this.roles.set(r.id, r));

    const policies: AccessPolicy[] = [
      {
        id: "policy-001",
        name: "Physician Full Clinical Access",
        description: "Allows physicians to access and modify clinical records for assigned patients",
        roleId: "role-physician",
        resourceType: "Patient",
        accessLevel: "write",
        conditions: [
          {
            id: "cond-001",
            type: "context_based",
            operator: "equals",
            field: "careTeamMember",
            value: true,
            description: "User must be on patient's care team"
          }
        ],
        dataElements: [
          { element: "demographics", accessLevel: "read", sensitivityLevel: "internal", auditRequired: true },
          { element: "diagnoses", accessLevel: "write", sensitivityLevel: "confidential", auditRequired: true },
          { element: "medications", accessLevel: "write", sensitivityLevel: "confidential", auditRequired: true },
          { element: "lab_results", accessLevel: "read", sensitivityLevel: "confidential", auditRequired: true }
        ],
        status: "active",
        aiSuggested: false,
        effectiveFrom: new Date(),
        createdBy: "system",
        createdAt: new Date(),
        updatedAt: new Date(),
        noCdsCompliance: "Access control policy for data governance. Not for clinical decision-making."
      },
      {
        id: "policy-002",
        name: "Emergency Override Access",
        description: "Temporary elevated access during documented emergencies",
        roleId: "role-nurse",
        resourceType: "Patient",
        accessLevel: "write",
        conditions: [
          {
            id: "cond-002",
            type: "context_based",
            operator: "equals",
            field: "emergencyDeclared",
            value: true,
            description: "Emergency must be declared in system"
          },
          {
            id: "cond-003",
            type: "time_based",
            operator: "less_than",
            field: "accessDuration",
            value: 4,
            description: "Access limited to 4 hours"
          }
        ],
        dataElements: [
          { element: "all_clinical", accessLevel: "write", sensitivityLevel: "confidential", auditRequired: true }
        ],
        status: "active",
        aiSuggested: true,
        aiConfidence: 0.89,
        effectiveFrom: new Date(),
        createdBy: "ai-suggestion",
        createdAt: new Date(),
        updatedAt: new Date(),
        noCdsCompliance: "Emergency access policy for operational continuity. Not for clinical decision-making."
      }
    ];

    policies.forEach(p => this.policies.set(p.id, p));

    const auditEntries: AccessAuditEntry[] = [
      {
        id: "audit-001",
        timestamp: new Date(Date.now() - 3600000),
        userId: "user-dr-smith",
        userRole: "role-physician",
        patientId: "patient-123",
        resourceType: "Observation",
        resourceId: "obs-456",
        action: "view",
        accessLevel: "read",
        policyId: "policy-001",
        dataElements: ["lab_results", "vital_signs"],
        outcome: "allowed",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        sessionId: "sess-abc123",
        riskScore: 12,
        anomalyFlags: [],
        noCdsCompliance: "Access audit for compliance monitoring. Not clinical data."
      },
      {
        id: "audit-002",
        timestamp: new Date(Date.now() - 7200000),
        userId: "user-nurse-jones",
        userRole: "role-nurse",
        patientId: "patient-789",
        resourceType: "MedicationRequest",
        resourceId: "med-012",
        action: "update",
        accessLevel: "write",
        policyId: "policy-002",
        dynamicAdjustmentId: "adj-001",
        dataElements: ["medication_administration"],
        outcome: "allowed",
        ipAddress: "192.168.1.105",
        userAgent: "Mozilla/5.0",
        sessionId: "sess-def456",
        riskScore: 35,
        anomalyFlags: ["after_hours_access"],
        noCdsCompliance: "Access audit for compliance monitoring. Not clinical data."
      },
      {
        id: "audit-003",
        timestamp: new Date(Date.now() - 1800000),
        userId: "user-admin-brown",
        userRole: "role-admin",
        patientId: "patient-456",
        resourceType: "Patient",
        resourceId: "patient-456",
        action: "view",
        accessLevel: "read",
        policyId: "policy-003",
        dataElements: ["clinical_notes"],
        outcome: "denied",
        denialReason: "Insufficient permissions for clinical data",
        ipAddress: "192.168.1.110",
        userAgent: "Mozilla/5.0",
        sessionId: "sess-ghi789",
        riskScore: 78,
        anomalyFlags: ["unauthorized_access_attempt", "outside_normal_scope"],
        noCdsCompliance: "Access audit for compliance monitoring. Not clinical data."
      }
    ];

    auditEntries.forEach(e => this.auditLog.push(e));

    const suggestion: AIPolicySuggestion = {
      id: "suggestion-001",
      forRoleId: "role-researcher",
      forResourceType: "Observation",
      suggestedPolicy: {
        name: "Researcher Aggregate Lab Access",
        description: "Allow researchers to view aggregated, de-identified lab trends",
        accessLevel: "read",
        conditions: [
          {
            id: "cond-new-001",
            type: "consent_based",
            operator: "equals",
            field: "researchConsent",
            value: true,
            description: "Patient must have research consent on file"
          }
        ],
        dataElements: [
          { element: "lab_trends_aggregated", accessLevel: "read", sensitivityLevel: "internal", auditRequired: true }
        ]
      },
      reasoning: "Based on analysis of research workflows and compliance requirements, this policy enables efficient research while maintaining patient privacy through aggregation and consent verification.",
      confidence: 0.85,
      basedOn: ["similar_organization_policies", "hipaa_minimum_necessary", "research_workflow_patterns"],
      status: "pending",
      createdAt: new Date(),
      noCdsCompliance: "AI policy suggestion for access governance. Not for clinical decision-making."
    };
    this.suggestions.set(suggestion.id, suggestion);
  }

  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  getPolicies(): AccessPolicy[] {
    return Array.from(this.policies.values());
  }

  getPolicy(id: string): AccessPolicy | undefined {
    return this.policies.get(id);
  }

  getPoliciesForRole(roleId: string): AccessPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.roleId === roleId);
  }

  async createPolicy(policy: Omit<AccessPolicy, "id" | "createdAt" | "updatedAt" | "noCdsCompliance">): Promise<AccessPolicy> {
    const newPolicy: AccessPolicy = {
      ...policy,
      id: `policy-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      noCdsCompliance: "Access control policy for data governance. Not for clinical decision-making."
    };
    this.policies.set(newPolicy.id, newPolicy);
    return newPolicy;
  }

  async updatePolicy(id: string, updates: Partial<AccessPolicy>): Promise<AccessPolicy | null> {
    const policy = this.policies.get(id);
    if (!policy) return null;

    const updated = { ...policy, ...updates, id, updatedAt: new Date() };
    this.policies.set(id, updated);
    return updated;
  }

  async deletePolicy(id: string): Promise<boolean> {
    return this.policies.delete(id);
  }

  getAdjustments(): DynamicAccessAdjustment[] {
    return Array.from(this.adjustments.values());
  }

  getAdjustmentsForPatient(patientId: string): DynamicAccessAdjustment[] {
    return Array.from(this.adjustments.values()).filter(a => a.patientId === patientId);
  }

  async createDynamicAdjustment(
    patientId: string,
    userId: string,
    roleId: string,
    originalLevel: AccessLevel,
    adjustedLevel: AccessLevel,
    reason: string,
    riskFactors: RiskFactor[],
    contextFactors: ContextFactor[],
    validHours: number = 24
  ): Promise<DynamicAccessAdjustment> {
    const adjustment: DynamicAccessAdjustment = {
      id: `adj-${crypto.randomUUID().slice(0, 8)}`,
      patientId,
      userId,
      roleId,
      originalAccessLevel: originalLevel,
      adjustedAccessLevel: adjustedLevel,
      reason,
      riskFactors,
      contextFactors,
      validUntil: new Date(Date.now() + validHours * 3600000),
      autoRevert: true,
      createdAt: new Date(),
      noCdsCompliance: "Dynamic access adjustment for operational security. Not for clinical decision-making."
    };
    this.adjustments.set(adjustment.id, adjustment);
    return adjustment;
  }

  async evaluateAccessRisk(
    userId: string,
    patientId: string,
    resourceType: string,
    action: string
  ): Promise<{ riskScore: number; riskFactors: RiskFactor[]; recommendation: string; noCdsCompliance: string }> {
    const recentAudit = this.auditLog.filter(
      a => a.userId === userId && Date.now() - a.timestamp.getTime() < 24 * 3600000
    );

    const riskFactors: RiskFactor[] = [];
    let baseRisk = 10;

    if (recentAudit.some(a => a.anomalyFlags.length > 0)) {
      riskFactors.push({
        type: "recent_anomaly",
        severity: "medium",
        description: "User has recent anomalous access patterns",
        weight: 20
      });
      baseRisk += 20;
    }

    const accessCount = recentAudit.length;
    if (accessCount > 50) {
      riskFactors.push({
        type: "high_volume",
        severity: "low",
        description: `High access volume (${accessCount} accesses in 24h)`,
        weight: 10
      });
      baseRisk += 10;
    }

    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskFactors.push({
        type: "off_hours",
        severity: "low",
        description: "Access outside normal business hours",
        weight: 15
      });
      baseRisk += 15;
    }

    const deniedRecent = recentAudit.filter(a => a.outcome === "denied").length;
    if (deniedRecent > 3) {
      riskFactors.push({
        type: "repeated_denials",
        severity: "high",
        description: `Multiple access denials (${deniedRecent}) in 24h`,
        weight: 30
      });
      baseRisk += 30;
    }

    const riskScore = Math.min(100, baseRisk);
    let recommendation = "Access permitted with standard monitoring";

    if (riskScore > 70) {
      recommendation = "Consider requiring additional authentication or supervisor approval";
    } else if (riskScore > 50) {
      recommendation = "Enable enhanced audit logging for this session";
    }

    return {
      riskScore,
      riskFactors,
      recommendation,
      noCdsCompliance: "Risk assessment for access security only. Not for clinical decision-making."
    };
  }

  getAuditLog(filters?: { userId?: string; patientId?: string; outcome?: string; startDate?: Date; endDate?: Date }): AccessAuditEntry[] {
    let entries = [...this.auditLog];

    if (filters?.userId) {
      entries = entries.filter(e => e.userId === filters.userId);
    }
    if (filters?.patientId) {
      entries = entries.filter(e => e.patientId === filters.patientId);
    }
    if (filters?.outcome) {
      entries = entries.filter(e => e.outcome === filters.outcome);
    }
    if (filters?.startDate) {
      entries = entries.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      entries = entries.filter(e => e.timestamp <= filters.endDate!);
    }

    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async logAccess(entry: Omit<AccessAuditEntry, "id" | "noCdsCompliance">): Promise<AccessAuditEntry> {
    const auditEntry: AccessAuditEntry = {
      ...entry,
      id: `audit-${crypto.randomUUID().slice(0, 8)}`,
      noCdsCompliance: "Access audit for compliance monitoring. Not clinical data."
    };
    this.auditLog.push(auditEntry);
    return auditEntry;
  }

  getPatternAnalyses(): AccessPatternAnalysis[] {
    return Array.from(this.patternAnalyses.values());
  }

  async analyzeAccessPatterns(analysisType: string = "anomaly"): Promise<AccessPatternAnalysis> {
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 7 * 24 * 3600000);

    const recentLogs = this.auditLog.filter(
      e => e.timestamp >= periodStart && e.timestamp <= periodEnd
    );

    const findings: PatternFinding[] = [];

    const deniedCount = recentLogs.filter(e => e.outcome === "denied").length;
    if (deniedCount > 0) {
      findings.push({
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        type: "access_denials",
        severity: deniedCount > 10 ? "high" : deniedCount > 5 ? "medium" : "low",
        description: `${deniedCount} access denials detected in the analysis period`,
        affectedEntities: Array.from(new Set(recentLogs.filter(e => e.outcome === "denied").map(e => e.userId))),
        occurrenceCount: deniedCount,
        firstSeen: periodStart,
        lastSeen: periodEnd,
        suggestedAction: "Review denied access attempts and update policies if legitimate access is being blocked"
      });
    }

    const anomalyLogs = recentLogs.filter(e => e.anomalyFlags.length > 0);
    if (anomalyLogs.length > 0) {
      findings.push({
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        type: "anomalous_behavior",
        severity: anomalyLogs.length > 20 ? "critical" : anomalyLogs.length > 10 ? "high" : "medium",
        description: `${anomalyLogs.length} access events with anomaly flags detected`,
        affectedEntities: Array.from(new Set(anomalyLogs.map(e => e.userId))),
        occurrenceCount: anomalyLogs.length,
        firstSeen: periodStart,
        lastSeen: periodEnd,
        suggestedAction: "Investigate flagged access patterns for potential security concerns"
      });
    }

    const highRiskLogs = recentLogs.filter(e => e.riskScore > 50);
    if (highRiskLogs.length > 0) {
      findings.push({
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        type: "elevated_risk_access",
        severity: highRiskLogs.some(e => e.riskScore > 80) ? "high" : "medium",
        description: `${highRiskLogs.length} high-risk access events detected`,
        affectedEntities: Array.from(new Set(highRiskLogs.map(e => e.userId))),
        occurrenceCount: highRiskLogs.length,
        firstSeen: periodStart,
        lastSeen: periodEnd,
        suggestedAction: "Review high-risk access patterns and consider additional controls"
      });
    }

    const recommendations = [
      "Regularly review access policies for alignment with current workflows",
      "Monitor anomaly patterns for emerging security threats",
      "Ensure all high-risk access is properly documented and justified"
    ];

    const complianceScore = Math.max(0, 100 - (deniedCount * 2) - (anomalyLogs.length * 3) - (highRiskLogs.length));

    const analysis: AccessPatternAnalysis = {
      id: `analysis-${crypto.randomUUID().slice(0, 8)}`,
      analysisType: analysisType as AccessPatternAnalysis["analysisType"],
      periodStart,
      periodEnd,
      findings,
      recommendations,
      complianceScore,
      riskIndicators: findings.filter(f => f.severity === "high" || f.severity === "critical").map(f => f.type),
      generatedAt: new Date(),
      noCdsCompliance: "Access pattern analysis for security compliance. Not for clinical decision-making."
    };

    this.patternAnalyses.set(analysis.id, analysis);
    return analysis;
  }

  getSuggestions(): AIPolicySuggestion[] {
    return Array.from(this.suggestions.values());
  }

  getSuggestion(id: string): AIPolicySuggestion | undefined {
    return this.suggestions.get(id);
  }

  async generatePolicySuggestion(roleId: string, resourceType: string): Promise<AIPolicySuggestion> {
    const role = this.roles.get(roleId);
    const existingPolicies = this.getPoliciesForRole(roleId);

    let suggestedPolicy: Partial<AccessPolicy>;
    let reasoning: string;
    let confidence: number;

    if (aiEnabled) {
      try {
        const response = await generatePhiSafeText({
          system: `You are an AI assistant specializing in healthcare data access governance. Generate access policy suggestions based on HIPAA minimum necessary principle and role-based access control best practices.

CRITICAL: This is for DATA ACCESS GOVERNANCE only. Do NOT provide any clinical recommendations, treatment suggestions, or diagnostic guidance. Focus only on who should access what data and under what conditions.

Return JSON with: name, description, accessLevel (none/read/write), conditions (array of {type, field, operator, value, description}), dataElements (array of {element, accessLevel, sensitivityLevel, auditRequired}).`,
          user: `Generate an access policy for:
Role: ${role?.name || roleId} (${role?.description || "Unknown role"})
Resource Type: ${resourceType}
Existing policies for this role: ${existingPolicies.length}
Role permissions: ${role?.permissions?.join(", ") || "None defined"}
Role restrictions: ${role?.resourceRestrictions?.join(", ") || "None defined"}`,
          responseMimeType: "application/json",
          maxTokens: 1000
        });

        const parsed = JSON.parse(response || "{}");
        suggestedPolicy = {
          name: parsed.name || `${role?.name || roleId} ${resourceType} Access`,
          description: parsed.description || `AI-suggested policy for ${role?.name || roleId} accessing ${resourceType}`,
          accessLevel: parsed.accessLevel || "read",
          conditions: parsed.conditions || [],
          dataElements: parsed.dataElements || []
        };
        reasoning = parsed.reasoning || "Generated based on role permissions and HIPAA minimum necessary principle";
        confidence = 0.85;
      } catch (error) {
        console.error("AI gateway error, using rule-based suggestion:", error);
        ({ suggestedPolicy, reasoning, confidence } = this.generateRuleBasedSuggestion(role, resourceType));
      }
    } else {
      ({ suggestedPolicy, reasoning, confidence } = this.generateRuleBasedSuggestion(role, resourceType));
    }

    const suggestion: AIPolicySuggestion = {
      id: `suggestion-${crypto.randomUUID().slice(0, 8)}`,
      forRoleId: roleId,
      forResourceType: resourceType,
      suggestedPolicy,
      reasoning,
      confidence,
      basedOn: ["hipaa_minimum_necessary", "role_permissions", "existing_policy_patterns"],
      status: "pending",
      createdAt: new Date(),
      noCdsCompliance: "AI policy suggestion for access governance. Not for clinical decision-making."
    };

    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  private generateRuleBasedSuggestion(role: Role | undefined, resourceType: string): {
    suggestedPolicy: Partial<AccessPolicy>;
    reasoning: string;
    confidence: number;
  } {
    const baseLevel = role?.baseAccessLevel || "read";
    const isRestricted = role?.resourceRestrictions?.some(r => 
      resourceType.toLowerCase().includes(r.toLowerCase())
    );

    const accessLevel: AccessLevel = isRestricted ? "none" : baseLevel;

    const conditions: PolicyCondition[] = [];
    if (accessLevel !== "none") {
      conditions.push({
        id: `cond-${crypto.randomUUID().slice(0, 8)}`,
        type: "context_based",
        operator: "equals",
        field: "activeSession",
        value: true,
        description: "User must have an active authenticated session"
      });
    }

    const dataElements: DataElementAccess[] = [];
    if (accessLevel !== "none") {
      dataElements.push({
        element: "basic_info",
        accessLevel: "read",
        sensitivityLevel: "internal",
        auditRequired: true
      });

      if (accessLevel === "write" || accessLevel === "admin") {
        dataElements.push({
          element: "editable_fields",
          accessLevel: "write",
          sensitivityLevel: "confidential",
          auditRequired: true
        });
      }
    }

    return {
      suggestedPolicy: {
        name: `${role?.name || "Unknown"} ${resourceType} Access`,
        description: `Rule-based policy for ${role?.name || "unknown role"} accessing ${resourceType} resources`,
        accessLevel,
        conditions,
        dataElements
      },
      reasoning: `Generated based on role base access level (${baseLevel}) and resource restrictions. ${isRestricted ? "Access restricted due to role limitations." : "Standard access granted per role permissions."}`,
      confidence: 0.65
    };
  }

  async acceptSuggestion(suggestionId: string): Promise<AccessPolicy | null> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== "pending") return null;

    const policy = await this.createPolicy({
      name: suggestion.suggestedPolicy.name || "AI Suggested Policy",
      description: suggestion.suggestedPolicy.description || "",
      roleId: suggestion.forRoleId,
      resourceType: suggestion.forResourceType,
      accessLevel: suggestion.suggestedPolicy.accessLevel || "read",
      conditions: suggestion.suggestedPolicy.conditions || [],
      dataElements: suggestion.suggestedPolicy.dataElements || [],
      status: "active",
      aiSuggested: true,
      aiConfidence: suggestion.confidence,
      effectiveFrom: new Date(),
      createdBy: "ai-suggestion"
    });

    suggestion.status = "accepted";
    this.suggestions.set(suggestionId, suggestion);

    return policy;
  }

  async rejectSuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== "pending") return false;

    suggestion.status = "rejected";
    this.suggestions.set(suggestionId, suggestion);
    return true;
  }

  getStats(): {
    totalRoles: number;
    totalPolicies: number;
    activePolicies: number;
    aiSuggestedPolicies: number;
    activeAdjustments: number;
    auditEntriesLast24h: number;
    accessDenials24h: number;
    pendingSuggestions: number;
    complianceScore: number;
  } {
    const now = Date.now();
    const last24h = now - 24 * 3600000;

    const recentAudit = this.auditLog.filter(e => e.timestamp.getTime() > last24h);
    const denials = recentAudit.filter(e => e.outcome === "denied").length;
    const anomalies = recentAudit.filter(e => e.anomalyFlags.length > 0).length;

    return {
      totalRoles: this.roles.size,
      totalPolicies: this.policies.size,
      activePolicies: Array.from(this.policies.values()).filter(p => p.status === "active").length,
      aiSuggestedPolicies: Array.from(this.policies.values()).filter(p => p.aiSuggested).length,
      activeAdjustments: Array.from(this.adjustments.values()).filter(a => a.validUntil.getTime() > now).length,
      auditEntriesLast24h: recentAudit.length,
      accessDenials24h: denials,
      pendingSuggestions: Array.from(this.suggestions.values()).filter(s => s.status === "pending").length,
      complianceScore: Math.max(0, 100 - (denials * 2) - (anomalies * 3))
    };
  }
}

export const accessControlService = new AIAccessControlService();
