import { db } from "./db";
import { eq, and, or, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import {
  userRoles,
  userRoleAssignments,
  rolePermissions,
  accessPolicies,
  patientConsents,
  accessDecisionLogs,
  smartApps,
  smartAppTokens,
  UserRole,
  RolePermission,
  AccessPolicy,
  PatientConsent,
  InsertAccessDecisionLog,
  SMART_SCOPES,
} from "@shared/schema";

export interface AccessContext {
  userId?: string;
  appId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestedScopes?: string[];
}

export interface AccessRequest {
  resourceType: string;
  resourceId?: string;
  action: "read" | "write" | "delete" | "search" | "history";
  patientId?: string;
  context: AccessContext;
}

export interface AccessDecision {
  permitted: boolean;
  reason: string;
  grantedScopes: string[];
  appliedPolicy?: string;
  consentId?: string;
}

export class AccessControlService {
  private static readonly FHIR_RESOURCE_TYPES = [
    "Patient",
    "Observation",
    "Condition",
    "MedicationRequest",
    "AllergyIntolerance",
    "Immunization",
    "Procedure",
    "DiagnosticReport",
    "DocumentReference",
    "Encounter",
    "CarePlan",
    "Goal",
    "CareTeam",
    "Practitioner",
    "Organization",
    "Location",
    "Device",
  ];

  async initializeDefaultRoles(): Promise<void> {
    const defaultRoles = [
      {
        name: "patient",
        displayName: "Patient",
        description: "Standard patient access to own health records",
        isSystem: true,
        priority: 10,
      },
      {
        name: "caregiver",
        displayName: "Caregiver",
        description: "Delegated access to manage patient records",
        isSystem: true,
        priority: 20,
      },
      {
        name: "provider",
        displayName: "Healthcare Provider",
        description: "Clinical access to patient records for treatment",
        isSystem: true,
        priority: 30,
      },
      {
        name: "admin",
        displayName: "Administrator",
        description: "Full administrative access",
        isSystem: true,
        priority: 100,
      },
      {
        name: "researcher",
        displayName: "Researcher",
        description: "Read-only access for approved research purposes",
        isSystem: true,
        priority: 15,
      },
      {
        name: "read_only",
        displayName: "Read-Only",
        description: "View-only access to FHIR data without modification rights",
        isSystem: true,
        priority: 5,
      },
      {
        name: "data_manager",
        displayName: "Data Manager",
        description: "Full CRUD access to FHIR data for data management tasks",
        isSystem: true,
        priority: 40,
      },
      {
        name: "auditor",
        displayName: "Auditor",
        description: "Read access to all data and audit logs for compliance review",
        isSystem: true,
        priority: 35,
      },
      {
        name: "data_analyst",
        displayName: "Data Analyst",
        description: "Read access to aggregated and de-identified data for analytics",
        isSystem: true,
        priority: 25,
      },
      {
        name: "emergency_responder",
        displayName: "Emergency Responder",
        description: "Break-the-glass emergency access to critical patient data",
        isSystem: true,
        priority: 45,
      },
    ];

    for (const role of defaultRoles) {
      const existing = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.name, role.name))
        .limit(1);

      if (existing.length === 0) {
        const [newRole] = await db.insert(userRoles).values(role).returning();
        await this.initializeRolePermissions(newRole.id, role.name);
      }
    }
  }

  private async initializeRolePermissions(roleId: string, roleName: string): Promise<void> {
    const permissionConfigs: Record<string, Array<{ resourceType: string; action: string; scope: string }>> = {
      patient: [
        { resourceType: "*", action: "read", scope: "patient/*.read" },
        { resourceType: "*", action: "search", scope: "patient/*.read" },
        { resourceType: "Observation", action: "write", scope: "patient/Observation.write" },
        { resourceType: "DocumentReference", action: "write", scope: "patient/DocumentReference.write" },
      ],
      caregiver: [
        { resourceType: "*", action: "read", scope: "patient/*.read" },
        { resourceType: "*", action: "search", scope: "patient/*.read" },
        { resourceType: "Observation", action: "write", scope: "patient/Observation.write" },
      ],
      provider: [
        { resourceType: "*", action: "read", scope: "user/*.read" },
        { resourceType: "*", action: "write", scope: "user/*.write" },
        { resourceType: "*", action: "search", scope: "user/*.read" },
      ],
      admin: [
        { resourceType: "*", action: "*", scope: "user/*.*" },
      ],
      researcher: [
        { resourceType: "*", action: "read", scope: "patient/*.read" },
        { resourceType: "*", action: "search", scope: "patient/*.read" },
      ],
      read_only: [
        { resourceType: "*", action: "read", scope: "user/*.read" },
        { resourceType: "*", action: "search", scope: "user/*.read" },
      ],
      data_manager: [
        { resourceType: "*", action: "read", scope: "user/*.read" },
        { resourceType: "*", action: "write", scope: "user/*.write" },
        { resourceType: "*", action: "delete", scope: "user/*.write" },
        { resourceType: "*", action: "search", scope: "user/*.read" },
        { resourceType: "*", action: "history", scope: "user/*.read" },
      ],
      auditor: [
        { resourceType: "*", action: "read", scope: "user/*.read" },
        { resourceType: "*", action: "search", scope: "user/*.read" },
        { resourceType: "*", action: "history", scope: "user/*.read" },
        { resourceType: "AuditLog", action: "read", scope: "system/AuditLog.read" },
      ],
      data_analyst: [
        { resourceType: "Observation", action: "read", scope: "user/Observation.read" },
        { resourceType: "Condition", action: "read", scope: "user/Condition.read" },
        { resourceType: "Procedure", action: "read", scope: "user/Procedure.read" },
        { resourceType: "DiagnosticReport", action: "read", scope: "user/DiagnosticReport.read" },
        { resourceType: "*", action: "search", scope: "user/*.read" },
      ],
      emergency_responder: [
        { resourceType: "Patient", action: "read", scope: "user/Patient.read" },
        { resourceType: "AllergyIntolerance", action: "read", scope: "user/AllergyIntolerance.read" },
        { resourceType: "MedicationRequest", action: "read", scope: "user/MedicationRequest.read" },
        { resourceType: "Condition", action: "read", scope: "user/Condition.read" },
        { resourceType: "Immunization", action: "read", scope: "user/Immunization.read" },
        { resourceType: "*", action: "search", scope: "user/*.read" },
      ],
    };

    const permissions = permissionConfigs[roleName] || [];
    for (const perm of permissions) {
      await db.insert(rolePermissions).values({
        roleId,
        resourceType: perm.resourceType,
        action: perm.action,
        scope: perm.scope,
        isAllowed: true,
      });
    }
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const assignments = await db
      .select({
        role: userRoles,
      })
      .from(userRoleAssignments)
      .innerJoin(userRoles, eq(userRoleAssignments.roleId, userRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.isActive, true),
          or(
            isNull(userRoleAssignments.expiresAt),
            gte(userRoleAssignments.expiresAt, new Date())
          )
        )
      );

    return assignments.map((a) => a.role);
  }

  async assignRole(userId: string, roleName: string, assignedBy?: string, expiresAt?: Date): Promise<void> {
    const role = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.name, roleName))
      .limit(1);

    if (role.length === 0) {
      throw new Error(`Role '${roleName}' not found`);
    }

    const existing = await db
      .select()
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, role[0].id),
          eq(userRoleAssignments.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.insert(userRoleAssignments).values({
      userId,
      roleId: role[0].id,
      assignedBy,
      expiresAt,
      isActive: true,
    });
  }

  async revokeRole(userId: string, roleName: string): Promise<void> {
    const role = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.name, roleName))
      .limit(1);

    if (role.length === 0) {
      return;
    }

    await db
      .update(userRoleAssignments)
      .set({ isActive: false })
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, role[0].id)
        )
      );
  }

  async getPermissionsForRoles(roleIds: string[]): Promise<RolePermission[]> {
    if (roleIds.length === 0) return [];

    return db
      .select()
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));
  }

  async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    const startTime = Date.now();
    let decision: AccessDecision = {
      permitted: false,
      reason: "No matching policy found",
      grantedScopes: [],
    };

    try {
      if (request.context.appId) {
        decision = await this.evaluateAppAccess(request);
      } else if (request.context.userId) {
        decision = await this.evaluateUserAccess(request);
      }

      await this.logAccessDecision(request, decision, Date.now() - startTime);
      return decision;
    } catch (error) {
      console.error("Access evaluation error:", error);
      decision = {
        permitted: false,
        reason: "Access evaluation error",
        grantedScopes: [],
      };
      await this.logAccessDecision(request, decision, Date.now() - startTime);
      return decision;
    }
  }

  private async evaluateUserAccess(request: AccessRequest): Promise<AccessDecision> {
    if (!request.context.userId) {
      return { permitted: false, reason: "No user context", grantedScopes: [] };
    }

    const roles = await this.getUserRoles(request.context.userId);
    
    if (roles.length === 0) {
      await this.assignRole(request.context.userId, "patient");
      const patientRole = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.name, "patient"))
        .limit(1);
      if (patientRole.length > 0) {
        roles.push(patientRole[0]);
      }
    }

    // Require both name === "admin" AND isSystem === true so that portal-created
    // roles with a colliding name (if the route-level guard were somehow bypassed)
    // cannot grant platform-wide admin access. System roles are seeded at boot
    // and are immutable via the portal surface. (Hardened Task #160.)
    const isAdmin = roles.some((r) => r.name === "admin" && r.isSystem === true);
    if (isAdmin) {
      return {
        permitted: true,
        reason: "Admin access granted",
        grantedScopes: ["user/*.*"],
      };
    }

    const roleIds = roles.map((r) => r.id);
    const permissions = await this.getPermissionsForRoles(roleIds);

    for (const perm of permissions) {
      if (!perm.isAllowed) continue;

      const resourceMatch =
        perm.resourceType === "*" || perm.resourceType === request.resourceType;
      const actionMatch =
        perm.action === "*" || perm.action === request.action;

      if (resourceMatch && actionMatch) {
        return {
          permitted: true,
          reason: `Permission granted via role`,
          grantedScopes: perm.scope ? [perm.scope] : [],
        };
      }
    }

    const policies = await this.getApplicablePolicies(
      request.context.userId,
      undefined,
      roleIds
    );

    for (const policy of policies) {
      if (!policy.isActive) continue;

      if (policy.resourceType !== "*" && policy.resourceType !== request.resourceType) {
        continue;
      }

      const allowedActions = (policy.allowedActions as string[]) || [];
      const deniedActions = (policy.deniedActions as string[]) || [];

      if (deniedActions.includes(request.action) || deniedActions.includes("*")) {
        return {
          permitted: false,
          reason: `Denied by policy: ${policy.name}`,
          grantedScopes: [],
          appliedPolicy: policy.id,
        };
      }

      if (allowedActions.includes(request.action) || allowedActions.includes("*")) {
        return {
          permitted: true,
          reason: `Permitted by policy: ${policy.name}`,
          grantedScopes: request.context.requestedScopes || [],
          appliedPolicy: policy.id,
        };
      }
    }

    return {
      permitted: false,
      reason: "No matching permission found",
      grantedScopes: [],
    };
  }

  private async evaluateAppAccess(request: AccessRequest): Promise<AccessDecision> {
    if (!request.context.appId) {
      return { permitted: false, reason: "No app context", grantedScopes: [] };
    }

    const app = await db
      .select()
      .from(smartApps)
      .where(eq(smartApps.id, request.context.appId))
      .limit(1);

    if (app.length === 0 || !app[0].isActive) {
      return { permitted: false, reason: "App not found or inactive", grantedScopes: [] };
    }

    if (request.patientId) {
      const consent = await this.getActiveConsent(request.patientId, request.context.appId);
      if (!consent) {
        return {
          permitted: false,
          reason: "No valid patient consent for this app",
          grantedScopes: [],
        };
      }

      const resourceTypes = (consent.resourceTypes as string[]) || [];
      if (resourceTypes.length > 0 && !resourceTypes.includes(request.resourceType) && !resourceTypes.includes("*")) {
        return {
          permitted: false,
          reason: "Resource type not covered by consent",
          grantedScopes: [],
          consentId: consent.id,
        };
      }

      const consentScopes = (consent.scope as string[]) || [];
      const grantedScopes = this.filterScopesForRequest(consentScopes, request);

      if (grantedScopes.length === 0) {
        return {
          permitted: false,
          reason: "No matching scopes in consent",
          grantedScopes: [],
          consentId: consent.id,
        };
      }

      return {
        permitted: true,
        reason: "Access granted via patient consent",
        grantedScopes,
        consentId: consent.id,
      };
    }

    const appScopes = (app[0].scopes as string[]) || [];
    const grantedScopes = this.filterScopesForRequest(appScopes, request);

    if (grantedScopes.length > 0) {
      return {
        permitted: true,
        reason: "Access granted via app scopes",
        grantedScopes,
      };
    }

    return {
      permitted: false,
      reason: "No matching scopes for requested action",
      grantedScopes: [],
    };
  }

  private filterScopesForRequest(scopes: string[], request: AccessRequest): string[] {
    const matched: string[] = [];
    const actionToScope: Record<string, string> = {
      read: "read",
      search: "read",
      history: "read",
      write: "write",
      delete: "write",
    };

    const scopeAction = actionToScope[request.action] || request.action;

    for (const scope of scopes) {
      if (this.scopeMatchesRequest(scope, request.resourceType, scopeAction)) {
        matched.push(scope);
      }
    }

    return matched;
  }

  private scopeMatchesRequest(scope: string, resourceType: string, action: string): boolean {
    const scopePatterns = [
      { pattern: /^(patient|user)\/\*\.\*$/, matchesAll: true },
      { pattern: /^(patient|user)\/\*\.(read|write)$/, action: (m: RegExpMatchArray) => m[2] },
      { pattern: /^(patient|user)\/(\w+)\.(read|write)$/, resource: (m: RegExpMatchArray) => m[2], action: (m: RegExpMatchArray) => m[3] },
    ];

    for (const { pattern, matchesAll, resource, action: getAction } of scopePatterns) {
      const match = scope.match(pattern);
      if (match) {
        if (matchesAll) return true;
        
        const scopeResource = resource ? resource(match) : "*";
        const scopeAction = getAction ? getAction(match) : "*";
        
        const resourceMatch = scopeResource === "*" || scopeResource === resourceType;
        const actionMatch = scopeAction === "*" || scopeAction === action;
        
        if (resourceMatch && actionMatch) {
          return true;
        }
      }
    }

    return false;
  }

  async getActiveConsent(patientUserId: string, appId: string): Promise<PatientConsent | null> {
    const consents = await db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientUserId, patientUserId),
          eq(patientConsents.appId, appId),
          eq(patientConsents.status, "active"),
          or(
            isNull(patientConsents.expiresAt),
            gte(patientConsents.expiresAt, new Date())
          )
        )
      )
      .limit(1);

    return consents[0] || null;
  }

  private async getApplicablePolicies(
    userId?: string,
    appId?: string,
    roleIds?: string[]
  ): Promise<AccessPolicy[]> {
    const conditions = [];

    conditions.push(eq(accessPolicies.policyType, "default"));

    if (userId) {
      conditions.push(
        and(
          eq(accessPolicies.policyType, "user"),
          eq(accessPolicies.targetId, userId)
        )
      );
    }

    if (appId) {
      conditions.push(
        and(
          eq(accessPolicies.policyType, "app"),
          eq(accessPolicies.targetId, appId)
        )
      );
    }

    if (roleIds && roleIds.length > 0) {
      conditions.push(
        and(
          eq(accessPolicies.policyType, "role"),
          inArray(accessPolicies.targetId, roleIds)
        )
      );
    }

    const policies = await db
      .select()
      .from(accessPolicies)
      .where(
        and(
          eq(accessPolicies.isActive, true),
          or(...conditions),
          or(
            isNull(accessPolicies.effectiveFrom),
            lte(accessPolicies.effectiveFrom, new Date())
          ),
          or(
            isNull(accessPolicies.effectiveUntil),
            gte(accessPolicies.effectiveUntil, new Date())
          )
        )
      )
      .orderBy(accessPolicies.priority);

    return policies;
  }

  private async logAccessDecision(
    request: AccessRequest,
    decision: AccessDecision,
    responseTimeMs: number
  ): Promise<void> {
    try {
      await db.insert(accessDecisionLogs).values({
        userId: request.context.userId,
        appId: request.context.appId,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        action: request.action,
        decision: decision.permitted ? "permit" : "deny",
        decisionReason: decision.reason,
        policyId: decision.appliedPolicy,
        consentId: decision.consentId,
        scopesRequested: request.context.requestedScopes,
        scopesGranted: decision.grantedScopes,
        ipAddress: request.context.ipAddress,
        userAgent: request.context.userAgent,
        responseTimeMs,
      });
    } catch (error) {
      console.error("Failed to log access decision:", error);
    }
  }

  async getAccessDecisionLogs(
    filters: {
      userId?: string;
      appId?: string;
      decision?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit = 100
  ): Promise<any[]> {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(accessDecisionLogs.userId, filters.userId));
    }
    if (filters.appId) {
      conditions.push(eq(accessDecisionLogs.appId, filters.appId));
    }
    if (filters.decision) {
      conditions.push(eq(accessDecisionLogs.decision, filters.decision));
    }
    if (filters.startDate) {
      conditions.push(gte(accessDecisionLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(accessDecisionLogs.createdAt, filters.endDate));
    }

    return db
      .select()
      .from(accessDecisionLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${accessDecisionLogs.createdAt} DESC`)
      .limit(limit);
  }

  parseSmartScopes(scopes: string[]): Array<{ context: string; resourceType: string; action: string }> {
    const parsed: Array<{ context: string; resourceType: string; action: string }> = [];

    for (const scope of scopes) {
      const match = scope.match(/^(patient|user)\/(\*|\w+)\.(read|write|\*)$/);
      if (match) {
        parsed.push({
          context: match[1],
          resourceType: match[2],
          action: match[3],
        });
      }
    }

    return parsed;
  }

  validateScopes(requestedScopes: string[], allowedScopes: string[]): string[] {
    const validated: string[] = [];

    for (const requested of requestedScopes) {
      for (const allowed of allowedScopes) {
        if (this.isScopeSubset(requested, allowed)) {
          validated.push(requested);
          break;
        }
      }
    }

    return validated;
  }

  private isScopeSubset(requested: string, allowed: string): boolean {
    if (allowed === requested) return true;

    const reqMatch = requested.match(/^(patient|user)\/(\*|\w+)\.(read|write|\*)$/);
    const allowMatch = allowed.match(/^(patient|user)\/(\*|\w+)\.(read|write|\*)$/);

    if (!reqMatch || !allowMatch) return false;

    const [, reqContext, reqResource, reqAction] = reqMatch;
    const [, allowContext, allowResource, allowAction] = allowMatch;

    if (reqContext !== allowContext) return false;

    const resourceMatch = allowResource === "*" || allowResource === reqResource;
    const actionMatch = allowAction === "*" || allowAction === reqAction;

    return resourceMatch && actionMatch;
  }

  getAvailableScopes(): string[] {
    return [...SMART_SCOPES];
  }

  async getAllRoles(): Promise<UserRole[]> {
    return db.select().from(userRoles).orderBy(userRoles.priority);
  }

  async createRole(role: {
    name: string;
    displayName: string;
    description?: string;
    priority?: number;
  }): Promise<UserRole> {
    const [newRole] = await db.insert(userRoles).values({
      ...role,
      isSystem: false,
    }).returning();
    return newRole;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const role = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, roleId))
      .limit(1);

    if (role.length === 0 || role[0].isSystem) {
      return false;
    }

    await db.delete(userRoles).where(eq(userRoles.id, roleId));
    return true;
  }

  async createPolicy(policy: {
    name: string;
    description?: string;
    policyType: string;
    targetType: string;
    targetId?: string;
    resourceType: string;
    allowedActions?: string[];
    deniedActions?: string[];
    priority?: number;
  }): Promise<AccessPolicy> {
    const [newPolicy] = await db.insert(accessPolicies).values({
      ...policy,
      allowedActions: policy.allowedActions || [],
      deniedActions: policy.deniedActions || [],
    }).returning();
    return newPolicy;
  }

  async updatePolicy(policyId: string, updates: Partial<AccessPolicy>): Promise<AccessPolicy | null> {
    const [updated] = await db
      .update(accessPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accessPolicies.id, policyId))
      .returning();
    return updated || null;
  }

  async deletePolicy(policyId: string): Promise<boolean> {
    await db.delete(accessPolicies).where(eq(accessPolicies.id, policyId));
    return true;
  }

  async getPolicies(filters?: { policyType?: string; isActive?: boolean }): Promise<AccessPolicy[]> {
    const conditions = [];

    if (filters?.policyType) {
      conditions.push(eq(accessPolicies.policyType, filters.policyType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(accessPolicies.isActive, filters.isActive));
    }

    return db
      .select()
      .from(accessPolicies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(accessPolicies.priority);
  }

  async getAllUsers(): Promise<Array<{ id: string; email: string; name: string; roles: UserRole[] }>> {
    const { users } = await import("@shared/schema");
    const allUsers = await db.select().from(users);
    
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        const roles = await this.getUserRoles(user.id);
        return {
          id: user.id,
          email: user.email || "",
          name: user.name || "",
          roles,
        };
      })
    );
    
    return usersWithRoles;
  }

  async getUserWithRoles(userId: string): Promise<{ id: string; email: string; name: string; roles: UserRole[] } | null> {
    const { users } = await import("@shared/schema");
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) return null;
    
    const roles = await this.getUserRoles(userId);
    return {
      id: user.id,
      email: user.email || "",
      name: user.name || "",
      roles,
    };
  }

  async getRoleAssignments(userId: string): Promise<Array<{
    roleId: string;
    roleName: string;
    assignedAt: Date;
    assignedBy?: string;
    expiresAt?: Date;
    isActive: boolean;
  }>> {
    const assignments = await db
      .select({
        roleId: userRoleAssignments.roleId,
        roleName: userRoles.name,
        roleDisplayName: userRoles.displayName,
        assignedAt: userRoleAssignments.createdAt,
        assignedBy: userRoleAssignments.assignedBy,
        expiresAt: userRoleAssignments.expiresAt,
        isActive: userRoleAssignments.isActive,
      })
      .from(userRoleAssignments)
      .innerJoin(userRoles, eq(userRoleAssignments.roleId, userRoles.id))
      .where(eq(userRoleAssignments.userId, userId));
    
    return assignments.map((a) => ({
      roleId: a.roleId,
      roleName: a.roleName,
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy || undefined,
      expiresAt: a.expiresAt || undefined,
      isActive: a.isActive ?? true,
    }));
  }

  async getUserActivitySummary(userId: string): Promise<{
    totalAccessDecisions: number;
    readCount: number;
    writeCount: number;
    lastActivity: Date | null;
    resourceTypesAccessed: string[];
    sensitiveDataAccess: boolean;
  }> {
    const logs = await db
      .select()
      .from(accessDecisionLogs)
      .where(eq(accessDecisionLogs.userId, userId))
      .orderBy(accessDecisionLogs.createdAt);
    
    const readActions = ["read", "search", "history"];
    const writeActions = ["write", "delete"];
    const sensitiveResources = ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance"];
    
    const resourceTypes = new Set<string>();
    let sensitiveDataAccess = false;
    
    for (const log of logs) {
      resourceTypes.add(log.resourceType);
      if (sensitiveResources.includes(log.resourceType)) {
        sensitiveDataAccess = true;
      }
    }
    
    return {
      totalAccessDecisions: logs.length,
      readCount: logs.filter((l) => readActions.includes(l.action)).length,
      writeCount: logs.filter((l) => writeActions.includes(l.action)).length,
      lastActivity: logs.length > 0 ? logs[logs.length - 1].createdAt : null,
      resourceTypesAccessed: Array.from(resourceTypes),
      sensitiveDataAccess,
    };
  }

  async suggestRolesWithAI(userId: string): Promise<{
    suggestedRoles: Array<{
      roleName: string;
      displayName: string;
      confidence: number;
      reasoning: string;
    }>;
    activityAnalysis: string;
    securityRecommendations: string[];
  }> {
    const activitySummary = await this.getUserActivitySummary(userId);
    const currentRoles = await this.getUserRoles(userId);
    const allRoles = await this.getAllRoles();
    
    const prompt = `Analyze the following user activity data and suggest appropriate roles for a healthcare data management system.

Current User Roles: ${currentRoles.map((r) => r.displayName).join(", ") || "None"}

Activity Summary:
- Total access decisions: ${activitySummary.totalAccessDecisions}
- Read operations: ${activitySummary.readCount}
- Write operations: ${activitySummary.writeCount}
- Resource types accessed: ${activitySummary.resourceTypesAccessed.join(", ") || "None"}
- Has accessed sensitive data: ${activitySummary.sensitiveDataAccess ? "Yes" : "No"}
- Last activity: ${activitySummary.lastActivity?.toISOString() || "Never"}

Available Roles:
${allRoles.map((r) => `- ${r.name} (${r.displayName}): ${r.description}`).join("\n")}

Based on the user's activity patterns, suggest:
1. Which roles would be most appropriate (considering least privilege principle)
2. A brief analysis of the user's activity pattern
3. Security recommendations for this user

Respond in JSON format:
{
  "suggestedRoles": [
    { "roleName": "role_name", "displayName": "Role Display Name", "confidence": 0.85, "reasoning": "Brief explanation" }
  ],
  "activityAnalysis": "Brief analysis of user activity patterns",
  "securityRecommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    try {
      const { chatComplete } = await import("./ai-client");

      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: "You are a healthcare IT security specialist analyzing user access patterns to recommend appropriate role-based access controls. Always follow the principle of least privilege and HIPAA requirements.",
          },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.3,
        dataCategories: ["demographics"],
        purpose: "identity_verification",
        callerService: "access-control-service",
        callerMethod: "suggestRoles",
      });

      const content = response.content;
      if (!content) {
        throw new Error("No response from AI");
      }
      
      const result = JSON.parse(content);
      return {
        suggestedRoles: result.suggestedRoles || [],
        activityAnalysis: result.activityAnalysis || "Unable to analyze activity patterns",
        securityRecommendations: result.securityRecommendations || [],
      };
    } catch (error) {
      console.error("AI role suggestion error:", error);
      
      const suggestions = [];
      
      if (activitySummary.writeCount === 0 && activitySummary.readCount > 0) {
        suggestions.push({
          roleName: "read_only",
          displayName: "Read-Only",
          confidence: 0.8,
          reasoning: "User only performs read operations, no write access detected",
        });
      }
      
      if (activitySummary.resourceTypesAccessed.includes("AuditLog")) {
        suggestions.push({
          roleName: "auditor",
          displayName: "Auditor",
          confidence: 0.75,
          reasoning: "User has accessed audit logs, suggesting compliance/audit responsibilities",
        });
      }
      
      if (activitySummary.writeCount > activitySummary.readCount) {
        suggestions.push({
          roleName: "data_manager",
          displayName: "Data Manager",
          confidence: 0.7,
          reasoning: "High write-to-read ratio suggests data management responsibilities",
        });
      }
      
      if (suggestions.length === 0) {
        suggestions.push({
          roleName: "patient",
          displayName: "Patient",
          confidence: 0.6,
          reasoning: "Default patient role for standard health record access",
        });
      }
      
      return {
        suggestedRoles: suggestions,
        activityAnalysis: `User has performed ${activitySummary.totalAccessDecisions} access decisions with ${activitySummary.readCount} reads and ${activitySummary.writeCount} writes.`,
        securityRecommendations: [
          "Review role assignments periodically",
          "Enable multi-factor authentication if not already enabled",
          activitySummary.sensitiveDataAccess ? "Monitor access to sensitive health data" : "User does not appear to access sensitive data",
        ],
      };
    }
  }

  async bulkAssignRole(userIds: string[], roleName: string, assignedBy: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const userId of userIds) {
      try {
        await this.assignRole(userId, roleName, assignedBy);
        success++;
      } catch {
        failed++;
      }
    }
    
    return { success, failed };
  }

  async bulkRevokeRole(userIds: string[], roleName: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const userId of userIds) {
      try {
        await this.revokeRole(userId, roleName);
        success++;
      } catch {
        failed++;
      }
    }
    
    return { success, failed };
  }
}

export const accessControlService = new AccessControlService();
