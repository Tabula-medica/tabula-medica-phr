import { randomUUID } from "crypto";

export type Permission = "read" | "write" | "delete" | "share" | "admin";
export type ResourceSensitivity = "normal" | "sensitive" | "restricted";

export interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  roles: string[];
  resourceTypes: string[];
  permissions: Permission[];
  conditions?: AccessCondition[];
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccessCondition {
  type: "attribute" | "time" | "location" | "purpose" | "relationship";
  attribute?: string;
  operator: "equals" | "contains" | "in" | "not_in" | "greater_than" | "less_than";
  value: string | string[] | number;
}

export interface AccessDecision {
  allowed: boolean;
  policy?: AccessPolicy;
  reason: string;
  conditions?: string[];
  auditId: string;
}

export interface ResourceAccess {
  resourceType: string;
  resourceId: string;
  sensitivity: ResourceSensitivity;
  owner?: string;
  allowedRoles: string[];
  deniedRoles: string[];
  attributes: Record<string, string>;
}

export interface AccessAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  resourceType: string;
  resourceId?: string;
  action: Permission;
  decision: "allowed" | "denied";
  policyId?: string;
  reason: string;
  context?: Record<string, unknown>;
}

const DEFAULT_POLICIES: AccessPolicy[] = [
  {
    id: "policy-admin-full",
    name: "Admin Full Access",
    description: "Administrators have full access to all resources",
    roles: ["admin", "system_admin"],
    resourceTypes: ["*"],
    permissions: ["read", "write", "delete", "share", "admin"],
    priority: 100,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-provider-clinical",
    name: "Provider Clinical Access",
    description: "Healthcare providers can read and write clinical data",
    roles: ["provider", "physician", "nurse", "clinical_staff"],
    resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Encounter", "DiagnosticReport", "Procedure"],
    permissions: ["read", "write"],
    priority: 80,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-patient-own",
    name: "Patient Own Records",
    description: "Patients can read their own records",
    roles: ["patient"],
    resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Immunization", "AllergyIntolerance", "DocumentReference"],
    permissions: ["read"],
    conditions: [
      {
        type: "relationship",
        attribute: "patientId",
        operator: "equals",
        value: "${user.patientId}",
      },
    ],
    priority: 70,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-caregiver-delegated",
    name: "Caregiver Delegated Access",
    description: "Caregivers can access delegated patient records",
    roles: ["caregiver", "family_member"],
    resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Appointment"],
    permissions: ["read"],
    conditions: [
      {
        type: "relationship",
        attribute: "delegatedPatients",
        operator: "contains",
        value: "${resource.patientId}",
      },
    ],
    priority: 60,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-researcher-deidentified",
    name: "Researcher De-identified Access",
    description: "Researchers can only access de-identified data",
    roles: ["researcher", "analyst"],
    resourceTypes: ["Observation", "Condition", "Procedure"],
    permissions: ["read"],
    conditions: [
      {
        type: "attribute",
        attribute: "isDeidentified",
        operator: "equals",
        value: "true",
      },
    ],
    priority: 50,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-sensitive-mental-health",
    name: "Mental Health Data Protection",
    description: "Mental health data requires additional authorization",
    roles: ["provider", "physician"],
    resourceTypes: ["Condition", "Observation"],
    permissions: ["read", "write"],
    conditions: [
      {
        type: "attribute",
        attribute: "category",
        operator: "not_in",
        value: ["mental-health", "behavioral-health", "substance-abuse"],
      },
    ],
    priority: 90,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class FhirAccessControlService {
  private policies: Map<string, AccessPolicy> = new Map();
  private resourceAccess: Map<string, ResourceAccess> = new Map();
  private auditLog: AccessAuditEntry[] = [];

  constructor() {
    DEFAULT_POLICIES.forEach((policy) => {
      this.policies.set(policy.id, policy);
    });
    console.log(`[AccessControl] Initialized with ${this.policies.size} policies`);
  }

  async checkAccess(params: {
    userId: string;
    userRole: string;
    userAttributes?: Record<string, unknown>;
    resourceType: string;
    resourceId?: string;
    resourceAttributes?: Record<string, unknown>;
    action: Permission;
  }): Promise<AccessDecision> {
    const auditId = randomUUID();
    const { userId, userRole, userAttributes, resourceType, resourceId, resourceAttributes, action } = params;

    const applicablePolicies = Array.from(this.policies.values())
      .filter((policy) => {
        if (!policy.enabled) return false;
        if (!policy.roles.includes(userRole) && !policy.roles.includes("*")) return false;
        if (!policy.resourceTypes.includes(resourceType) && !policy.resourceTypes.includes("*")) return false;
        if (!policy.permissions.includes(action)) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);

    let decision: AccessDecision;

    if (applicablePolicies.length === 0) {
      decision = {
        allowed: false,
        reason: "No matching policy found",
        auditId,
      };
    } else {
      const matchingPolicy = applicablePolicies[0];
      
      if (matchingPolicy.conditions && matchingPolicy.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(
          matchingPolicy.conditions,
          userAttributes || {},
          resourceAttributes || {}
        );

        decision = {
          allowed: conditionsMet.allMet,
          policy: matchingPolicy,
          reason: conditionsMet.allMet 
            ? `Access granted by policy: ${matchingPolicy.name}`
            : `Conditions not met: ${conditionsMet.failedConditions.join(", ")}`,
          conditions: conditionsMet.failedConditions,
          auditId,
        };
      } else {
        decision = {
          allowed: true,
          policy: matchingPolicy,
          reason: `Access granted by policy: ${matchingPolicy.name}`,
          auditId,
        };
      }
    }

    this.logAccess({
      id: auditId,
      timestamp: new Date().toISOString(),
      userId,
      userRole,
      resourceType,
      resourceId,
      action,
      decision: decision.allowed ? "allowed" : "denied",
      policyId: decision.policy?.id,
      reason: decision.reason,
      context: { userAttributes, resourceAttributes },
    });

    return decision;
  }

  private evaluateConditions(
    conditions: AccessCondition[],
    userAttributes: Record<string, unknown>,
    resourceAttributes: Record<string, unknown>
  ): { allMet: boolean; failedConditions: string[] } {
    const failedConditions: string[] = [];

    for (const condition of conditions) {
      let value: unknown;
      
      if (condition.attribute?.startsWith("${user.")) {
        const attrName = condition.attribute.replace("${user.", "").replace("}", "");
        value = userAttributes[attrName];
      } else if (condition.attribute?.startsWith("${resource.")) {
        const attrName = condition.attribute.replace("${resource.", "").replace("}", "");
        value = resourceAttributes[attrName];
      } else {
        value = resourceAttributes[condition.attribute || ""];
      }

      let conditionMet = false;
      const targetValue = condition.value;

      switch (condition.operator) {
        case "equals":
          conditionMet = value === targetValue;
          break;
        case "contains":
          conditionMet = Array.isArray(value) 
            ? value.includes(targetValue)
            : String(value).includes(String(targetValue));
          break;
        case "in":
          conditionMet = Array.isArray(targetValue) && targetValue.includes(value as string);
          break;
        case "not_in":
          conditionMet = Array.isArray(targetValue) && !targetValue.includes(value as string);
          break;
        case "greater_than":
          conditionMet = Number(value) > Number(targetValue);
          break;
        case "less_than":
          conditionMet = Number(value) < Number(targetValue);
          break;
      }

      if (!conditionMet) {
        failedConditions.push(`${condition.type}: ${condition.attribute} ${condition.operator} ${targetValue}`);
      }
    }

    return {
      allMet: failedConditions.length === 0,
      failedConditions,
    };
  }

  private logAccess(entry: AccessAuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
    console.log(`[AccessControl] ${entry.decision.toUpperCase()}: ${entry.userRole} -> ${entry.action} ${entry.resourceType}${entry.resourceId ? `/${entry.resourceId}` : ""}`);
  }

  async createPolicy(policy: Omit<AccessPolicy, "id" | "createdAt" | "updatedAt">): Promise<AccessPolicy> {
    const newPolicy: AccessPolicy = {
      ...policy,
      id: `policy-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.policies.set(newPolicy.id, newPolicy);
    console.log(`[AccessControl] Created policy: ${newPolicy.name}`);
    return newPolicy;
  }

  async updatePolicy(policyId: string, updates: Partial<AccessPolicy>): Promise<AccessPolicy> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    const updatedPolicy: AccessPolicy = {
      ...policy,
      ...updates,
      id: policy.id,
      createdAt: policy.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.policies.set(policyId, updatedPolicy);
    return updatedPolicy;
  }

  async deletePolicy(policyId: string): Promise<void> {
    if (!this.policies.has(policyId)) {
      throw new Error("Policy not found");
    }
    this.policies.delete(policyId);
  }

  async getPolicy(policyId: string): Promise<AccessPolicy | undefined> {
    return this.policies.get(policyId);
  }

  async listPolicies(filters?: { enabled?: boolean; role?: string }): Promise<AccessPolicy[]> {
    let policies = Array.from(this.policies.values());

    if (filters?.enabled !== undefined) {
      policies = policies.filter((p) => p.enabled === filters.enabled);
    }
    if (filters?.role) {
      policies = policies.filter((p) => p.roles.includes(filters.role!));
    }

    return policies.sort((a, b) => b.priority - a.priority);
  }

  async getAuditLog(filters?: {
    userId?: string;
    resourceType?: string;
    decision?: "allowed" | "denied";
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<AccessAuditEntry[]> {
    let entries = [...this.auditLog];

    if (filters?.userId) {
      entries = entries.filter((e) => e.userId === filters.userId);
    }
    if (filters?.resourceType) {
      entries = entries.filter((e) => e.resourceType === filters.resourceType);
    }
    if (filters?.decision) {
      entries = entries.filter((e) => e.decision === filters.decision);
    }
    if (filters?.startDate) {
      entries = entries.filter((e) => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      entries = entries.filter((e) => e.timestamp <= filters.endDate!);
    }

    entries = entries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return entries.slice(0, filters?.limit || 100);
  }

  getAccessStats(): {
    totalPolicies: number;
    enabledPolicies: number;
    totalAuditEntries: number;
    allowedCount: number;
    deniedCount: number;
  } {
    const policies = Array.from(this.policies.values());
    return {
      totalPolicies: policies.length,
      enabledPolicies: policies.filter((p) => p.enabled).length,
      totalAuditEntries: this.auditLog.length,
      allowedCount: this.auditLog.filter((e) => e.decision === "allowed").length,
      deniedCount: this.auditLog.filter((e) => e.decision === "denied").length,
    };
  }

  getRoles(): string[] {
    const rolesSet = new Set<string>();
    this.policies.forEach((policy) => {
      policy.roles.forEach((role) => rolesSet.add(role));
    });
    return Array.from(rolesSet);
  }
}

export const fhirAccessControl = new FhirAccessControlService();
