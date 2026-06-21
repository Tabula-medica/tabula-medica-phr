import { randomUUID } from "crypto";

export type FHIRResourceType =
  | "Patient"
  | "Observation"
  | "Condition"
  | "Medication"
  | "MedicationRequest"
  | "Procedure"
  | "Immunization"
  | "AllergyIntolerance"
  | "DiagnosticReport"
  | "Encounter"
  | "DocumentReference"
  | "CarePlan"
  | "CareTeam"
  | "Goal"
  | "Practitioner"
  | "Organization"
  | "Location"
  | "Device"
  | "Coverage"
  | "Claim"
  | "ExplanationOfBenefit"
  | "*";

export type AccessAction = "read" | "write" | "search" | "create" | "update" | "delete" | "*";

export type UserRole =
  | "admin"
  | "clinician"
  | "nurse"
  | "patient"
  | "caregiver"
  | "researcher"
  | "billing"
  | "auditor"
  | "app_developer";

export type SensitivityLevel = "normal" | "restricted" | "very_restricted" | "ultra_sensitive";

export interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  policyType: "role_based" | "scope_based" | "resource_based" | "consent_based";
  priority: number;
  enabled: boolean;
  conditions: PolicyCondition[];
  permissions: PolicyPermission[];
  restrictions: PolicyRestriction[];
  metadata: {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    version: number;
  };
}

export interface PolicyCondition {
  type: "role" | "scope" | "patient_context" | "time_range" | "ip_range" | "resource_attribute";
  operator: "equals" | "in" | "not_in" | "matches" | "greater_than" | "less_than";
  field: string;
  value: string | string[] | number;
}

export interface PolicyPermission {
  resourceTypes: FHIRResourceType[];
  actions: AccessAction[];
  scope: "own" | "department" | "organization" | "all";
  fields?: string[];
  excludedFields?: string[];
}

export interface PolicyRestriction {
  type: "field_masking" | "record_filtering" | "audit_required" | "mfa_required" | "consent_required";
  config: Record<string, unknown>;
}

export interface RoleDefinition {
  id: string;
  role: UserRole;
  displayName: string;
  description: string;
  inheritFrom?: UserRole[];
  defaultPolicies: string[];
  sensitivityAccess: SensitivityLevel[];
  maxSessionDuration: number;
  requireMFA: boolean;
  auditLevel: "minimal" | "standard" | "detailed";
}

export interface SMARTScope {
  id: string;
  scope: string;
  category: "patient" | "user" | "system" | "launch" | "openid";
  resourceType: FHIRResourceType;
  actions: AccessAction[];
  description: string;
  requiresConsent: boolean;
  sensitivityLevel: SensitivityLevel;
}

export interface AccessEvaluationRequest {
  userId: string;
  userRole: UserRole;
  appId?: string;
  appScopes?: string[];
  resourceType: FHIRResourceType;
  resourceId?: string;
  action: AccessAction;
  patientContext?: string;
  requestContext: {
    ipAddress?: string;
    timestamp: string;
    sessionId?: string;
  };
}

export interface AccessEvaluationResult {
  allowed: boolean;
  decision: "allow" | "deny" | "conditional";
  reason: string;
  applicablePolicies: string[];
  requiredConditions?: string[];
  fieldRestrictions?: {
    allowedFields?: string[];
    maskedFields?: string[];
    excludedFields?: string[];
  };
  auditRequired: boolean;
  consentRequired: boolean;
  consentStatus?: "granted" | "denied" | "pending" | "expired";
}

export interface PatientConsent {
  id: string;
  patientId: string;
  appId: string;
  appName: string;
  status: "active" | "revoked" | "expired" | "pending";
  grantedScopes: string[];
  deniedScopes: string[];
  resourcePermissions: ResourcePermission[];
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  lastAccessedAt?: string;
  accessCount: number;
  metadata: {
    purpose: string;
    termsAcceptedAt: string;
    privacyPolicyVersion: string;
    consentMethod: "explicit" | "implied" | "opt_out";
  };
}

export interface ResourcePermission {
  resourceType: FHIRResourceType;
  allowed: boolean;
  actions: AccessAction[];
  dateRange?: { start: string; end?: string };
  fieldRestrictions?: string[];
}

export interface ConsentRequest {
  patientId: string;
  appId: string;
  appName: string;
  requestedScopes: string[];
  purpose: string;
  duration?: string;
  resourceTypes?: FHIRResourceType[];
}

export interface ConsentDecision {
  consentId: string;
  approved: boolean;
  grantedScopes: string[];
  deniedScopes: string[];
  resourcePermissions: ResourcePermission[];
  expiresAt?: string;
}

class FHIRAccessControlService {
  private policies: Map<string, AccessPolicy> = new Map();
  private roleDefinitions: Map<UserRole, RoleDefinition> = new Map();
  private smartScopes: Map<string, SMARTScope> = new Map();
  private consents: Map<string, PatientConsent> = new Map();
  private accessLog: Array<{
    timestamp: string;
    request: AccessEvaluationRequest;
    result: AccessEvaluationResult;
  }> = [];

  constructor() {
    this.initializeDefaultRoles();
    this.initializeDefaultPolicies();
    this.initializeSMARTScopes();
    this.initializeSampleConsents();
  }

  private initializeDefaultRoles(): void {
    const roles: RoleDefinition[] = [
      {
        id: "role-admin",
        role: "admin",
        displayName: "System Administrator",
        description: "Full system access for administration and configuration",
        defaultPolicies: ["policy-admin-full"],
        sensitivityAccess: ["normal", "restricted", "very_restricted", "ultra_sensitive"],
        maxSessionDuration: 28800,
        requireMFA: true,
        auditLevel: "detailed",
      },
      {
        id: "role-clinician",
        role: "clinician",
        displayName: "Clinician",
        description: "Healthcare provider with patient care responsibilities",
        defaultPolicies: ["policy-clinician-care", "policy-clinical-notes"],
        sensitivityAccess: ["normal", "restricted", "very_restricted"],
        maxSessionDuration: 43200,
        requireMFA: true,
        auditLevel: "detailed",
      },
      {
        id: "role-nurse",
        role: "nurse",
        displayName: "Nurse",
        description: "Nursing staff with clinical documentation access",
        inheritFrom: ["clinician"],
        defaultPolicies: ["policy-nurse-care"],
        sensitivityAccess: ["normal", "restricted"],
        maxSessionDuration: 43200,
        requireMFA: false,
        auditLevel: "standard",
      },
      {
        id: "role-patient",
        role: "patient",
        displayName: "Patient",
        description: "Patient accessing their own health records",
        defaultPolicies: ["policy-patient-own"],
        sensitivityAccess: ["normal"],
        maxSessionDuration: 3600,
        requireMFA: false,
        auditLevel: "standard",
      },
      {
        id: "role-caregiver",
        role: "caregiver",
        displayName: "Caregiver / Proxy",
        description: "Authorized caregiver with delegated access",
        defaultPolicies: ["policy-caregiver-delegated"],
        sensitivityAccess: ["normal"],
        maxSessionDuration: 3600,
        requireMFA: false,
        auditLevel: "detailed",
      },
      {
        id: "role-researcher",
        role: "researcher",
        displayName: "Researcher",
        description: "Research access with de-identification requirements",
        defaultPolicies: ["policy-research-deidentified"],
        sensitivityAccess: ["normal"],
        maxSessionDuration: 14400,
        requireMFA: true,
        auditLevel: "detailed",
      },
      {
        id: "role-billing",
        role: "billing",
        displayName: "Billing Staff",
        description: "Access to billing and financial information",
        defaultPolicies: ["policy-billing-access"],
        sensitivityAccess: ["normal"],
        maxSessionDuration: 28800,
        requireMFA: false,
        auditLevel: "standard",
      },
      {
        id: "role-auditor",
        role: "auditor",
        displayName: "Compliance Auditor",
        description: "Read-only access for compliance auditing",
        defaultPolicies: ["policy-auditor-readonly"],
        sensitivityAccess: ["normal", "restricted", "very_restricted"],
        maxSessionDuration: 14400,
        requireMFA: true,
        auditLevel: "detailed",
      },
      {
        id: "role-app-developer",
        role: "app_developer",
        displayName: "App Developer",
        description: "SMART app developer with sandbox access",
        defaultPolicies: ["policy-developer-sandbox"],
        sensitivityAccess: ["normal"],
        maxSessionDuration: 7200,
        requireMFA: false,
        auditLevel: "minimal",
      },
    ];

    roles.forEach((role) => this.roleDefinitions.set(role.role, role));
  }

  private initializeDefaultPolicies(): void {
    const policies: AccessPolicy[] = [
      {
        id: "policy-admin-full",
        name: "Administrator Full Access",
        description: "Complete system access for administrators",
        policyType: "role_based",
        priority: 100,
        enabled: true,
        conditions: [{ type: "role", operator: "equals", field: "userRole", value: "admin" }],
        permissions: [{ resourceTypes: ["*"], actions: ["*"], scope: "all" }],
        restrictions: [{ type: "audit_required", config: { level: "detailed" } }],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
      {
        id: "policy-clinician-care",
        name: "Clinician Patient Care",
        description: "Clinical access for patient care activities",
        policyType: "role_based",
        priority: 80,
        enabled: true,
        conditions: [{ type: "role", operator: "in", field: "userRole", value: ["clinician", "nurse"] }],
        permissions: [
          { resourceTypes: ["Patient", "Observation", "Condition", "Medication", "MedicationRequest", "Procedure", "Immunization", "AllergyIntolerance", "DiagnosticReport", "Encounter", "CarePlan", "CareTeam", "Goal"], actions: ["read", "write", "search", "create", "update"], scope: "department" },
          { resourceTypes: ["DocumentReference"], actions: ["read", "create"], scope: "department" },
        ],
        restrictions: [
          { type: "audit_required", config: { level: "standard" } },
          { type: "consent_required", config: { checkBreakGlass: true } },
        ],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
      {
        id: "policy-patient-own",
        name: "Patient Own Records",
        description: "Patient access to their own health records",
        policyType: "role_based",
        priority: 70,
        enabled: true,
        conditions: [
          { type: "role", operator: "equals", field: "userRole", value: "patient" },
          { type: "patient_context", operator: "equals", field: "patientId", value: "self" },
        ],
        permissions: [
          { resourceTypes: ["Patient", "Observation", "Condition", "Medication", "MedicationRequest", "Procedure", "Immunization", "AllergyIntolerance", "DiagnosticReport", "Encounter", "CarePlan", "Goal"], actions: ["read", "search"], scope: "own" },
          { resourceTypes: ["DocumentReference"], actions: ["read"], scope: "own", excludedFields: ["provider_notes", "internal_comments"] },
        ],
        restrictions: [
          { type: "field_masking", config: { maskFields: ["provider_internal_notes"] } },
        ],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
      {
        id: "policy-caregiver-delegated",
        name: "Caregiver Delegated Access",
        description: "Caregiver access based on patient delegation",
        policyType: "consent_based",
        priority: 60,
        enabled: true,
        conditions: [
          { type: "role", operator: "equals", field: "userRole", value: "caregiver" },
        ],
        permissions: [
          { resourceTypes: ["Patient", "Observation", "Condition", "Medication"], actions: ["read", "search"], scope: "own" },
        ],
        restrictions: [
          { type: "consent_required", config: { consentType: "caregiver_delegation" } },
          { type: "audit_required", config: { level: "detailed" } },
        ],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
      {
        id: "policy-research-deidentified",
        name: "Research De-identified Access",
        description: "Research access to de-identified patient data",
        policyType: "role_based",
        priority: 50,
        enabled: true,
        conditions: [{ type: "role", operator: "equals", field: "userRole", value: "researcher" }],
        permissions: [
          { resourceTypes: ["Observation", "Condition", "Procedure", "DiagnosticReport"], actions: ["read", "search"], scope: "all", excludedFields: ["identifier", "name", "address", "telecom", "birthDate", "ssn"] },
        ],
        restrictions: [
          { type: "field_masking", config: { deidentify: true, shiftDates: 30 } },
          { type: "audit_required", config: { level: "detailed" } },
        ],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
      {
        id: "policy-billing-access",
        name: "Billing Staff Access",
        description: "Access to billing and financial resources",
        policyType: "role_based",
        priority: 50,
        enabled: true,
        conditions: [{ type: "role", operator: "equals", field: "userRole", value: "billing" }],
        permissions: [
          { resourceTypes: ["Patient"], actions: ["read", "search"], scope: "all", fields: ["identifier", "name", "address", "telecom", "birthDate"] },
          { resourceTypes: ["Coverage", "Claim", "ExplanationOfBenefit", "Encounter"], actions: ["read", "write", "search", "create", "update"], scope: "all" },
        ],
        restrictions: [],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
      {
        id: "policy-smart-app-patient",
        name: "SMART App Patient Scope",
        description: "Access for SMART apps with patient-level scopes",
        policyType: "scope_based",
        priority: 40,
        enabled: true,
        conditions: [{ type: "scope", operator: "matches", field: "scopes", value: "patient/*" }],
        permissions: [],
        restrictions: [
          { type: "consent_required", config: { appConsent: true } },
          { type: "audit_required", config: { level: "detailed" } },
        ],
        metadata: { createdAt: new Date().toISOString(), createdBy: "system", updatedAt: new Date().toISOString(), version: 1 },
      },
    ];

    policies.forEach((policy) => this.policies.set(policy.id, policy));
  }

  private initializeSMARTScopes(): void {
    const scopes: SMARTScope[] = [
      { id: "scope-patient-read", scope: "patient/*.read", category: "patient", resourceType: "*", actions: ["read", "search"], description: "Read all patient data", requiresConsent: true, sensitivityLevel: "normal" },
      { id: "scope-patient-write", scope: "patient/*.write", category: "patient", resourceType: "*", actions: ["write", "create", "update"], description: "Write all patient data", requiresConsent: true, sensitivityLevel: "restricted" },
      { id: "scope-patient-observation-read", scope: "patient/Observation.read", category: "patient", resourceType: "Observation", actions: ["read", "search"], description: "Read patient observations", requiresConsent: true, sensitivityLevel: "normal" },
      { id: "scope-patient-condition-read", scope: "patient/Condition.read", category: "patient", resourceType: "Condition", actions: ["read", "search"], description: "Read patient conditions", requiresConsent: true, sensitivityLevel: "normal" },
      { id: "scope-patient-medication-read", scope: "patient/MedicationRequest.read", category: "patient", resourceType: "MedicationRequest", actions: ["read", "search"], description: "Read patient medications", requiresConsent: true, sensitivityLevel: "normal" },
      { id: "scope-user-read", scope: "user/*.read", category: "user", resourceType: "*", actions: ["read", "search"], description: "Read data user has access to", requiresConsent: false, sensitivityLevel: "normal" },
      { id: "scope-launch-patient", scope: "launch/patient", category: "launch", resourceType: "Patient", actions: ["read"], description: "Receive patient context at launch", requiresConsent: false, sensitivityLevel: "normal" },
      { id: "scope-openid", scope: "openid", category: "openid", resourceType: "Patient", actions: ["read"], description: "OpenID Connect identity", requiresConsent: false, sensitivityLevel: "normal" },
      { id: "scope-fhiruser", scope: "fhirUser", category: "openid", resourceType: "Patient", actions: ["read"], description: "FHIR user identity", requiresConsent: false, sensitivityLevel: "normal" },
      { id: "scope-offline", scope: "offline_access", category: "openid", resourceType: "*", actions: ["read"], description: "Offline/refresh token access", requiresConsent: true, sensitivityLevel: "restricted" },
    ];

    scopes.forEach((scope) => this.smartScopes.set(scope.scope, scope));
  }

  private initializeSampleConsents(): void {
    const consents: PatientConsent[] = [
      {
        id: "consent-1",
        patientId: "patient-001",
        appId: "app-epic-mychart",
        appName: "Primary Care Provider",
        status: "active",
        grantedScopes: ["patient/*.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read", "openid", "fhirUser"],
        deniedScopes: ["patient/*.write"],
        resourcePermissions: [
          { resourceType: "Observation", allowed: true, actions: ["read", "search"] },
          { resourceType: "Condition", allowed: true, actions: ["read", "search"] },
          { resourceType: "MedicationRequest", allowed: true, actions: ["read", "search"] },
          { resourceType: "Patient", allowed: true, actions: ["read"] },
        ],
        grantedAt: "2025-06-15T10:00:00Z",
        expiresAt: "2026-06-15T10:00:00Z",
        lastAccessedAt: "2026-01-28T14:30:00Z",
        accessCount: 47,
        metadata: {
          purpose: "Personal health record access and management",
          termsAcceptedAt: "2025-06-15T09:58:00Z",
          privacyPolicyVersion: "2.1",
          consentMethod: "explicit",
        },
      },
      {
        id: "consent-2",
        patientId: "patient-001",
        appId: "app-fasten-health",
        appName: "Fasten Health",
        status: "active",
        grantedScopes: ["patient/Observation.read", "patient/DiagnosticReport.read", "openid"],
        deniedScopes: ["patient/Condition.read", "patient/*.write"],
        resourcePermissions: [
          { resourceType: "Observation", allowed: true, actions: ["read", "search"] },
          { resourceType: "DiagnosticReport", allowed: true, actions: ["read", "search"] },
        ],
        grantedAt: "2025-09-01T08:00:00Z",
        lastAccessedAt: "2026-01-15T11:20:00Z",
        accessCount: 12,
        metadata: {
          purpose: "Lab results aggregation and tracking",
          termsAcceptedAt: "2025-09-01T07:55:00Z",
          privacyPolicyVersion: "1.3",
          consentMethod: "explicit",
        },
      },
      {
        id: "consent-3",
        patientId: "patient-002",
        appId: "app-apple-health",
        appName: "Apple Health Records",
        status: "revoked",
        grantedScopes: ["patient/*.read"],
        deniedScopes: [],
        resourcePermissions: [],
        grantedAt: "2025-03-10T16:00:00Z",
        revokedAt: "2025-11-20T09:15:00Z",
        lastAccessedAt: "2025-11-18T20:00:00Z",
        accessCount: 156,
        metadata: {
          purpose: "Health data sync with Apple Health",
          termsAcceptedAt: "2025-03-10T15:58:00Z",
          privacyPolicyVersion: "3.0",
          consentMethod: "explicit",
        },
      },
    ];

    consents.forEach((consent) => this.consents.set(consent.id, consent));
  }

  async evaluateAccess(request: AccessEvaluationRequest): Promise<AccessEvaluationResult> {
    const startTime = Date.now();
    console.log(`[HIPAA-AUDIT][AccessControl] Evaluating access: user=${request.userId}, role=${request.userRole}, resource=${request.resourceType}, action=${request.action}`);

    const roleDefinition = this.roleDefinitions.get(request.userRole);
    if (!roleDefinition) {
      return this.logAndReturnResult(request, {
        allowed: false,
        decision: "deny",
        reason: `Unknown role: ${request.userRole}`,
        applicablePolicies: [],
        auditRequired: true,
        consentRequired: false,
      });
    }

    const applicablePolicies: AccessPolicy[] = [];
    const allPolicies = Array.from(this.policies.values());
    for (const policy of allPolicies) {
      if (!policy.enabled) continue;
      if (this.policyApplies(policy, request)) {
        applicablePolicies.push(policy);
      }
    }

    applicablePolicies.sort((a, b) => b.priority - a.priority);

    let allowed = false;
    let reason = "No applicable policy found";
    let fieldRestrictions: AccessEvaluationResult["fieldRestrictions"];
    let consentRequired = false;
    let consentStatus: AccessEvaluationResult["consentStatus"];

    for (const policy of applicablePolicies) {
      const policyResult = this.evaluatePolicy(policy, request);
      if (policyResult.allowed) {
        allowed = true;
        reason = `Allowed by policy: ${policy.name}`;
        fieldRestrictions = policyResult.fieldRestrictions;
        break;
      }

      for (const restriction of policy.restrictions) {
        if (restriction.type === "consent_required") {
          consentRequired = true;
          if (request.appId && request.patientContext) {
            const consent = this.getPatientConsentForApp(request.patientContext, request.appId);
            if (consent) {
              consentStatus = consent.status === "active" ? "granted" : consent.status === "revoked" ? "denied" : "pending";
              if (consent.status === "active") {
                const scopeAllowed = this.checkConsentScopes(consent, request);
                if (scopeAllowed) {
                  allowed = true;
                  reason = `Allowed by patient consent: ${consent.id}`;
                }
              }
            } else {
              consentStatus = "pending";
              reason = "Patient consent required but not found";
            }
          }
        }
      }
    }

    if (request.appScopes && request.appScopes.length > 0) {
      const scopeAllowed = this.evaluateSMARTScopes(request.appScopes, request);
      if (!scopeAllowed.allowed) {
        allowed = false;
        reason = scopeAllowed.reason;
      }
    }

    const result: AccessEvaluationResult = {
      allowed,
      decision: allowed ? "allow" : "deny",
      reason,
      applicablePolicies: applicablePolicies.map((p) => p.id),
      fieldRestrictions,
      auditRequired: roleDefinition.auditLevel !== "minimal",
      consentRequired,
      consentStatus,
    };

    console.log(`[HIPAA-AUDIT][AccessControl] Decision: ${result.decision} for user=${request.userId}, resource=${request.resourceType}/${request.resourceId || "*"}, action=${request.action} in ${Date.now() - startTime}ms`);

    return this.logAndReturnResult(request, result);
  }

  private policyApplies(policy: AccessPolicy, request: AccessEvaluationRequest): boolean {
    for (const condition of policy.conditions) {
      switch (condition.type) {
        case "role":
          if (condition.operator === "equals" && request.userRole !== condition.value) return false;
          if (condition.operator === "in" && !Array.isArray(condition.value)) return false;
          if (condition.operator === "in" && !(condition.value as string[]).includes(request.userRole)) return false;
          break;
        case "scope":
          if (!request.appScopes) return false;
          break;
        case "patient_context":
          if (condition.value === "self" && request.patientContext !== request.userId) return false;
          break;
      }
    }
    return true;
  }

  private evaluatePolicy(policy: AccessPolicy, request: AccessEvaluationRequest): { allowed: boolean; fieldRestrictions?: AccessEvaluationResult["fieldRestrictions"] } {
    for (const permission of policy.permissions) {
      const resourceMatch = permission.resourceTypes.includes("*") || permission.resourceTypes.includes(request.resourceType);
      const actionMatch = permission.actions.includes("*") || permission.actions.includes(request.action);

      if (resourceMatch && actionMatch) {
        return {
          allowed: true,
          fieldRestrictions: {
            allowedFields: permission.fields,
            excludedFields: permission.excludedFields,
          },
        };
      }
    }
    return { allowed: false };
  }

  private evaluateSMARTScopes(scopes: string[], request: AccessEvaluationRequest): { allowed: boolean; reason: string } {
    for (const scopeStr of scopes) {
      const scope = this.smartScopes.get(scopeStr);
      if (!scope) continue;

      const resourceMatch = scope.resourceType === "*" || scope.resourceType === request.resourceType;
      const actionMatch = scope.actions.includes(request.action);

      if (resourceMatch && actionMatch) {
        return { allowed: true, reason: `Allowed by scope: ${scopeStr}` };
      }

      if (scopeStr.startsWith("patient/") || scopeStr.startsWith("user/")) {
        const parts = scopeStr.split(/[/.]/);
        const scopeResource = parts[1];
        const scopeAction = parts[2];

        if ((scopeResource === "*" || scopeResource === request.resourceType) &&
            (scopeAction === "read" && ["read", "search"].includes(request.action)) ||
            (scopeAction === "write" && ["write", "create", "update", "delete"].includes(request.action)) ||
            scopeAction === "*") {
          return { allowed: true, reason: `Allowed by parsed scope: ${scopeStr}` };
        }
      }
    }
    return { allowed: false, reason: "No matching SMART scope found" };
  }

  private checkConsentScopes(consent: PatientConsent, request: AccessEvaluationRequest): boolean {
    if (consent.deniedScopes.some((s) => s.includes(request.resourceType) || s.includes("*"))) {
      return false;
    }

    for (const permission of consent.resourcePermissions) {
      if (permission.resourceType === request.resourceType && permission.allowed && permission.actions.includes(request.action)) {
        return true;
      }
    }

    return false;
  }

  private getPatientConsentForApp(patientId: string, appId: string): PatientConsent | undefined {
    const allConsents = Array.from(this.consents.values());
    for (const consent of allConsents) {
      if (consent.patientId === patientId && consent.appId === appId) {
        return consent;
      }
    }
    return undefined;
  }

  private logAndReturnResult(request: AccessEvaluationRequest, result: AccessEvaluationResult): AccessEvaluationResult {
    this.accessLog.push({ timestamp: new Date().toISOString(), request, result });
    if (this.accessLog.length > 10000) {
      this.accessLog = this.accessLog.slice(-5000);
    }
    return result;
  }

  async getPolicies(): Promise<AccessPolicy[]> {
    return Array.from(this.policies.values());
  }

  async getPolicy(policyId: string): Promise<AccessPolicy | undefined> {
    return this.policies.get(policyId);
  }

  async createPolicy(policy: Omit<AccessPolicy, "id" | "metadata">): Promise<AccessPolicy> {
    const id = `policy-${randomUUID().slice(0, 8)}`;
    const newPolicy: AccessPolicy = {
      ...policy,
      id,
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: "system",
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    };
    this.policies.set(id, newPolicy);
    console.log(`[HIPAA-AUDIT][AccessControl] Policy created: id=${id}, name=${policy.name}`);
    return newPolicy;
  }

  async updatePolicy(policyId: string, updates: Partial<AccessPolicy>): Promise<AccessPolicy | undefined> {
    const existing = this.policies.get(policyId);
    if (!existing) return undefined;

    const updated: AccessPolicy = {
      ...existing,
      ...updates,
      id: policyId,
      metadata: {
        ...existing.metadata,
        updatedAt: new Date().toISOString(),
        version: existing.metadata.version + 1,
      },
    };
    this.policies.set(policyId, updated);
    console.log(`[HIPAA-AUDIT][AccessControl] Policy updated: id=${policyId}`);
    return updated;
  }

  async deletePolicy(policyId: string): Promise<boolean> {
    const deleted = this.policies.delete(policyId);
    if (deleted) {
      console.log(`[HIPAA-AUDIT][AccessControl] Policy deleted: id=${policyId}`);
    }
    return deleted;
  }

  async getRoles(): Promise<RoleDefinition[]> {
    return Array.from(this.roleDefinitions.values());
  }

  async getRole(role: UserRole): Promise<RoleDefinition | undefined> {
    return this.roleDefinitions.get(role);
  }

  async getSMARTScopes(): Promise<SMARTScope[]> {
    return Array.from(this.smartScopes.values());
  }

  async getPatientConsents(patientId: string): Promise<PatientConsent[]> {
    return Array.from(this.consents.values()).filter((c) => c.patientId === patientId);
  }

  async getConsent(consentId: string): Promise<PatientConsent | undefined> {
    return this.consents.get(consentId);
  }

  async createConsent(request: ConsentRequest, decision: ConsentDecision): Promise<PatientConsent> {
    const consent: PatientConsent = {
      id: decision.consentId || `consent-${randomUUID().slice(0, 8)}`,
      patientId: request.patientId,
      appId: request.appId,
      appName: request.appName,
      status: decision.approved ? "active" : "pending",
      grantedScopes: decision.grantedScopes,
      deniedScopes: decision.deniedScopes,
      resourcePermissions: decision.resourcePermissions,
      grantedAt: new Date().toISOString(),
      expiresAt: decision.expiresAt,
      accessCount: 0,
      metadata: {
        purpose: request.purpose,
        termsAcceptedAt: new Date().toISOString(),
        privacyPolicyVersion: "1.0",
        consentMethod: "explicit",
      },
    };
    this.consents.set(consent.id, consent);
    console.log(`[HIPAA-AUDIT][AccessControl] Consent created: id=${consent.id}, patient=${request.patientId}, app=${request.appId}, approved=${decision.approved}`);
    return consent;
  }

  async revokeConsent(consentId: string, userId: string): Promise<PatientConsent | undefined> {
    const consent = this.consents.get(consentId);
    if (!consent) return undefined;

    consent.status = "revoked";
    consent.revokedAt = new Date().toISOString();
    this.consents.set(consentId, consent);
    console.log(`[HIPAA-AUDIT][AccessControl] Consent revoked: id=${consentId}, by=${userId}`);
    return consent;
  }

  async updateConsentPermissions(consentId: string, resourcePermissions: ResourcePermission[]): Promise<PatientConsent | undefined> {
    const consent = this.consents.get(consentId);
    if (!consent) return undefined;

    consent.resourcePermissions = resourcePermissions;
    this.consents.set(consentId, consent);
    console.log(`[HIPAA-AUDIT][AccessControl] Consent permissions updated: id=${consentId}`);
    return consent;
  }

  async getAccessLog(limit: number = 100): Promise<typeof this.accessLog> {
    return this.accessLog.slice(-limit);
  }

  async getAccessStats(): Promise<{
    totalEvaluations: number;
    allowedCount: number;
    deniedCount: number;
    byRole: Record<string, { allowed: number; denied: number }>;
    byResource: Record<string, { allowed: number; denied: number }>;
  }> {
    const stats = {
      totalEvaluations: this.accessLog.length,
      allowedCount: 0,
      deniedCount: 0,
      byRole: {} as Record<string, { allowed: number; denied: number }>,
      byResource: {} as Record<string, { allowed: number; denied: number }>,
    };

    for (const entry of this.accessLog) {
      if (entry.result.allowed) {
        stats.allowedCount++;
      } else {
        stats.deniedCount++;
      }

      const role = entry.request.userRole;
      if (!stats.byRole[role]) stats.byRole[role] = { allowed: 0, denied: 0 };
      if (entry.result.allowed) {
        stats.byRole[role].allowed++;
      } else {
        stats.byRole[role].denied++;
      }

      const resource = entry.request.resourceType;
      if (!stats.byResource[resource]) stats.byResource[resource] = { allowed: 0, denied: 0 };
      if (entry.result.allowed) {
        stats.byResource[resource].allowed++;
      } else {
        stats.byResource[resource].denied++;
      }
    }

    return stats;
  }

  async getAllConsents(): Promise<PatientConsent[]> {
    return Array.from(this.consents.values());
  }
}

export const fhirAccessControlService = new FHIRAccessControlService();
