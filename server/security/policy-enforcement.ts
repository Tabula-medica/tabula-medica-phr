import { storage } from "../storage";
import type { 
  DataAccessPolicy, PolicyViolation, BreakTheGlassRecord,
  DataClassificationTag, AccessContext, FhirResourceType, AccessAction, UserRole 
} from "@shared/schema";
import { logPhiAccess } from "./hipaa-audit";

export interface AccessRequest {
  userId: string;
  userRole: UserRole;
  patientId: string;
  resourceType: FhirResourceType;
  resourceId?: string;
  action: AccessAction;
  accessContext: AccessContext;
  dataClassification?: DataClassificationTag;
  justification?: string;
  clientIp?: string;
  userAgent?: string;
  sessionId?: string;
  mfaVerified?: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  policyId?: string;
  policyName?: string;
  requiresBreakTheGlass?: boolean;
  requiresMfa?: boolean;
  requiresJustification?: boolean;
  expiresAt?: string;
  violations?: PolicyViolation[];
}

export async function enforcePolicyCompliance(request: AccessRequest): Promise<PolicyDecision> {
  const applicablePolicies = await storage.getApplicablePolicies({
    userRole: request.userRole,
    userId: request.userId,
    resourceType: request.resourceType,
    action: request.action,
    dataClassification: request.dataClassification,
  });

  if (applicablePolicies.length === 0) {
    return {
      allowed: true,
      reason: "No restricting policies found - access allowed by default",
    };
  }

  let currentDecision: PolicyDecision = {
    allowed: true,
    reason: "Access allowed",
  };

  for (const policy of applicablePolicies) {
    const policyDecision = evaluatePolicy(policy, request);
    
    if (policyDecision.allowed === false) {
      currentDecision = policyDecision;
      break;
    }

    if (policyDecision.requiresMfa || policyDecision.requiresJustification || policyDecision.requiresBreakTheGlass) {
      currentDecision = {
        ...currentDecision,
        ...policyDecision,
        allowed: true,
      };
    }
  }

  if (currentDecision.requiresMfa && !request.mfaVerified) {
    const activeBreakGlass = await storage.getActiveBreakTheGlass(request.userId, request.patientId);
    if (!activeBreakGlass) {
      currentDecision = {
        allowed: false,
        reason: "Multi-factor authentication required for this access",
        requiresMfa: true,
        policyId: currentDecision.policyId,
        policyName: currentDecision.policyName,
      };
    }
  }

  if (currentDecision.requiresJustification && !request.justification) {
    currentDecision = {
      allowed: false,
      reason: "Justification required for this access",
      requiresJustification: true,
      policyId: currentDecision.policyId,
      policyName: currentDecision.policyName,
    };
  }

  if (currentDecision.requiresBreakTheGlass) {
    const activeBreakGlass = await storage.getActiveBreakTheGlass(request.userId, request.patientId);
    if (!activeBreakGlass) {
      currentDecision = {
        allowed: false,
        reason: "Break-the-glass authorization required for emergency access",
        requiresBreakTheGlass: true,
        policyId: currentDecision.policyId,
        policyName: currentDecision.policyName,
      };
    }
  }

  await logAccessDecision(request, currentDecision);

  return currentDecision;
}

function evaluatePolicy(policy: DataAccessPolicy, request: AccessRequest): PolicyDecision {
  const decision: PolicyDecision = {
    allowed: true,
    reason: "Access allowed",
    policyId: policy.id,
    policyName: policy.name,
  };

  if (policy.requiredContexts && policy.requiredContexts.length > 0) {
    if (!policy.requiredContexts.includes(request.accessContext)) {
      return {
        allowed: false,
        reason: `Access context '${request.accessContext}' not allowed. Required: ${policy.requiredContexts.join(", ")}`,
        policyId: policy.id,
        policyName: policy.name,
      };
    }
  }

  if (policy.accessWindowStart && policy.accessWindowEnd) {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (currentTime < policy.accessWindowStart || currentTime >= policy.accessWindowEnd) {
      return {
        allowed: false,
        reason: `Access not allowed outside of hours ${policy.accessWindowStart}-${policy.accessWindowEnd}`,
        policyId: policy.id,
        policyName: policy.name,
      };
    }
  }

  if (policy.effect === "deny") {
    return {
      allowed: false,
      reason: policy.description || "Access denied by policy",
      policyId: policy.id,
      policyName: policy.name,
    };
  }

  if (policy.requiresMfa) {
    decision.requiresMfa = true;
  }

  if (policy.requiresJustification) {
    decision.requiresJustification = true;
  }

  if (policy.requiresBreakTheGlass) {
    decision.requiresBreakTheGlass = true;
  }

  return decision;
}

async function logAccessDecision(request: AccessRequest, decision: PolicyDecision): Promise<void> {
  await logPhiAccess({
    userId: request.userId,
    patientId: request.patientId,
    resourceType: request.resourceType,
    action: request.action as "read" | "write" | "delete" | "export",
    details: JSON.stringify({
      accessContext: request.accessContext,
      dataClassification: request.dataClassification,
      policyId: decision.policyId,
      policyName: decision.policyName,
      reason: decision.reason,
      allowed: decision.allowed,
      requiresMfa: decision.requiresMfa,
      requiresJustification: decision.requiresJustification,
      requiresBreakTheGlass: decision.requiresBreakTheGlass,
      justification: request.justification,
    }),
  });

  if (!decision.allowed && decision.policyId && decision.policyName) {
    await storage.createPolicyViolation({
      userId: request.userId,
      policyId: decision.policyId,
      policyName: decision.policyName,
      userRole: request.userRole,
      patientId: request.patientId,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      action: request.action,
      context: request.accessContext,
      justification: request.justification,
      violationType: determineViolationType(decision),
      violationDetails: decision.reason,
      ipAddress: request.clientIp || "unknown",
      userAgent: request.userAgent || "unknown",
      wasOverridden: false,
    });
  }
}

function determineViolationType(decision: PolicyDecision): "denied" | "override" | "time_restricted" | "mfa_required" | "context_mismatch" {
  if (decision.requiresMfa) return "mfa_required";
  if (decision.reason.includes("context")) return "context_mismatch";
  if (decision.reason.includes("hours") || decision.reason.includes("time")) return "time_restricted";
  return "denied";
}

function determineSeverity(request: AccessRequest, decision: PolicyDecision): "low" | "medium" | "high" | "critical" {
  if (request.dataClassification === "GENETIC" || request.dataClassification === "MINORS") {
    return "critical";
  }
  
  if (request.dataClassification === "SENSITIVE" || request.dataClassification === "RESTRICTED") {
    return "high";
  }
  
  if (decision.requiresBreakTheGlass) {
    return "high";
  }
  
  if (request.action === "delete" || request.action === "export") {
    return "medium";
  }
  
  return "low";
}

export async function activateBreakTheGlass(params: {
  userId: string;
  userRole: UserRole;
  patientId: string;
  reason: string;
  resourceTypes?: FhirResourceType[];
  durationMinutes?: number;
}): Promise<BreakTheGlassRecord> {
  const durationMinutes = params.durationMinutes || 60;
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  
  const record = await storage.createBreakTheGlassRecord({
    userId: params.userId,
    userRole: params.userRole,
    patientId: params.patientId,
    reason: params.reason,
    resourceTypes: params.resourceTypes || ["All"],
    expiresAt,
    reviewStatus: "pending",
  });

  await logPhiAccess({
    userId: params.userId,
    patientId: params.patientId,
    resourceType: "Patient",
    action: "read",
    details: JSON.stringify({
      eventType: "break_the_glass_activated",
      breakTheGlassId: record.id,
      reason: params.reason,
      expiresAt,
    }),
  });

  return record;
}

export async function getDefaultSystemPolicies(): Promise<DataAccessPolicy[]> {
  const policies = await storage.getDataAccessPolicies({ isActive: true });
  return policies.filter(p => p.isSystemPolicy);
}

export async function seedDefaultPolicies(): Promise<void> {
  const existingPolicies = await storage.getDataAccessPolicies();
  if (existingPolicies.some(p => p.isSystemPolicy)) {
    return;
  }

  const defaultPolicies: Omit<DataAccessPolicy, "id" | "createdAt" | "updatedAt">[] = [
    {
      name: "Sensitive Data Protection",
      description: "Requires MFA and justification for accessing sensitive data classifications",
      isActive: true,
      isSystemPolicy: true,
      priority: 100,
      effect: "allow",
      targetRoles: ["patient", "caregiver", "provider", "admin"],
      resourceTypes: ["Patient", "Observation", "DiagnosticReport", "DocumentReference"],
      dataClassifications: ["SENSITIVE", "RESTRICTED"],
      actions: ["read", "write", "export"],
      requiredContexts: ["treatment", "emergency", "patient_request", "legal"],
      minimumNecessary: true,
      requiresBreakTheGlass: false,
      requiresMfa: true,
      requiresJustification: true,
      auditLevel: "all",
      alertOnViolation: true,
      createdBy: "system",
    },
    {
      name: "Genetic Data Controls",
      description: "Strict controls for genetic information access per GINA regulations",
      isActive: true,
      isSystemPolicy: true,
      priority: 200,
      effect: "allow",
      targetRoles: ["patient", "provider", "admin"],
      resourceTypes: ["Observation", "DiagnosticReport", "DocumentReference"],
      dataClassifications: ["GENETIC"],
      actions: ["read", "write", "export", "delete"],
      requiredContexts: ["treatment", "research", "patient_request"],
      minimumNecessary: true,
      requiresBreakTheGlass: false,
      requiresMfa: true,
      requiresJustification: true,
      auditLevel: "all",
      alertOnViolation: true,
      createdBy: "system",
    },
    {
      name: "Minor Patient Protections",
      description: "Enhanced protections for minors' health records",
      isActive: true,
      isSystemPolicy: true,
      priority: 250,
      effect: "allow",
      targetRoles: ["caregiver", "provider", "admin"],
      resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "DiagnosticReport"],
      dataClassifications: ["MINORS"],
      actions: ["read", "write", "export"],
      requiredContexts: ["treatment", "emergency", "caregiver_access", "legal"],
      minimumNecessary: true,
      requiresBreakTheGlass: false,
      requiresMfa: true,
      requiresJustification: true,
      auditLevel: "all",
      alertOnViolation: true,
      createdBy: "system",
    },
    {
      name: "Emergency Access Override",
      description: "Allows break-the-glass access for emergency situations",
      isActive: true,
      isSystemPolicy: true,
      priority: 300,
      effect: "allow",
      targetRoles: ["provider", "admin"],
      resourceTypes: ["All"],
      dataClassifications: ["PHI", "PII", "SENSITIVE", "RESTRICTED", "GENETIC", "MINORS", "STANDARD"],
      actions: ["read"],
      requiredContexts: ["emergency"],
      minimumNecessary: false,
      requiresBreakTheGlass: true,
      requiresMfa: false,
      requiresJustification: true,
      auditLevel: "all",
      alertOnViolation: true,
      createdBy: "system",
    },
    {
      name: "Bulk Export Restrictions",
      description: "Limits and audits bulk data exports",
      isActive: true,
      isSystemPolicy: true,
      priority: 150,
      effect: "allow",
      targetRoles: ["provider", "admin"],
      resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "DiagnosticReport", "DocumentReference"],
      dataClassifications: ["PHI", "PII"],
      actions: ["export"],
      requiredContexts: ["patient_request", "legal", "audit", "research"],
      minimumNecessary: true,
      requiresBreakTheGlass: false,
      requiresMfa: true,
      requiresJustification: true,
      auditLevel: "all",
      alertOnViolation: true,
      createdBy: "system",
    },
  ];

  for (const policy of defaultPolicies) {
    await storage.createDataAccessPolicy(policy);
  }
}
