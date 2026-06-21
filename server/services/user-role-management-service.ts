import OpenAI from "openai";

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: "fhir_data" | "admin" | "export" | "audit" | "ai_features" | "patient_portal";
  resource?: string;
  actions: ("create" | "read" | "update" | "delete" | "export" | "manage")[];
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  roleName: string;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  reason?: string;
  isActive: boolean;
}

export interface RoleSuggestion {
  id: string;
  userId: string;
  userName: string;
  currentRole?: string;
  suggestedRole: string;
  confidence: number;
  reasoning: string;
  factors: {
    factor: string;
    weight: "high" | "medium" | "low";
    description: string;
  }[];
  dataSensitivityLevel: "high" | "medium" | "low";
  activityPatterns: string[];
  recommendation: "upgrade" | "downgrade" | "maintain" | "review";
  createdAt: string;
}

export interface UserActivity {
  userId: string;
  userName: string;
  actions: {
    type: string;
    resource: string;
    count: number;
    lastOccurred: string;
  }[];
  dataAccessPatterns: {
    resourceType: string;
    accessCount: number;
    sensitivityLevel: "high" | "medium" | "low";
  }[];
  loginFrequency: "daily" | "weekly" | "monthly" | "rarely";
  lastActive: string;
}

class UserRoleManagementService {
  private openai: OpenAI | null = null;
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private userAssignments: Map<string, UserRoleAssignment> = new Map();
  private roleSuggestions: Map<string, RoleSuggestion[]> = new Map();

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    this.initializePermissions();
    this.initializeDefaultRoles();
    this.initializeSampleUsers();
  }

  private initializePermissions(): void {
    const defaultPermissions: Permission[] = [
      { id: "fhir.patient.read", name: "Read Patient Data", description: "View patient demographic and administrative information", category: "fhir_data", resource: "Patient", actions: ["read"] },
      { id: "fhir.patient.write", name: "Write Patient Data", description: "Create and update patient records", category: "fhir_data", resource: "Patient", actions: ["create", "update"] },
      { id: "fhir.patient.delete", name: "Delete Patient Data", description: "Remove patient records from the system", category: "fhir_data", resource: "Patient", actions: ["delete"] },
      { id: "fhir.observation.read", name: "Read Observations", description: "View clinical observations and vitals", category: "fhir_data", resource: "Observation", actions: ["read"] },
      { id: "fhir.observation.write", name: "Write Observations", description: "Create and update clinical observations", category: "fhir_data", resource: "Observation", actions: ["create", "update"] },
      { id: "fhir.condition.read", name: "Read Conditions", description: "View patient conditions and diagnoses", category: "fhir_data", resource: "Condition", actions: ["read"] },
      { id: "fhir.condition.write", name: "Write Conditions", description: "Create and update patient conditions", category: "fhir_data", resource: "Condition", actions: ["create", "update"] },
      { id: "fhir.medication.read", name: "Read Medications", description: "View medication requests and prescriptions", category: "fhir_data", resource: "MedicationRequest", actions: ["read"] },
      { id: "fhir.medication.write", name: "Write Medications", description: "Create and update medication orders", category: "fhir_data", resource: "MedicationRequest", actions: ["create", "update"] },
      { id: "fhir.encounter.read", name: "Read Encounters", description: "View patient encounters and visits", category: "fhir_data", resource: "Encounter", actions: ["read"] },
      { id: "fhir.encounter.write", name: "Write Encounters", description: "Create and update patient encounters", category: "fhir_data", resource: "Encounter", actions: ["create", "update"] },
      { id: "fhir.document.read", name: "Read Documents", description: "View clinical documents and reports", category: "fhir_data", resource: "DocumentReference", actions: ["read"] },
      { id: "fhir.document.write", name: "Write Documents", description: "Create and upload clinical documents", category: "fhir_data", resource: "DocumentReference", actions: ["create", "update"] },
      { id: "fhir.all.read", name: "Read All FHIR Resources", description: "View all FHIR resource types", category: "fhir_data", actions: ["read"] },
      { id: "fhir.all.write", name: "Write All FHIR Resources", description: "Create and update all FHIR resource types", category: "fhir_data", actions: ["create", "update"] },
      { id: "fhir.all.manage", name: "Manage All FHIR Resources", description: "Full access to all FHIR resource operations", category: "fhir_data", actions: ["create", "read", "update", "delete", "manage"] },
      { id: "admin.users.read", name: "View Users", description: "View user accounts and profiles", category: "admin", actions: ["read"] },
      { id: "admin.users.manage", name: "Manage Users", description: "Create, update, and deactivate user accounts", category: "admin", actions: ["create", "read", "update", "delete", "manage"] },
      { id: "admin.roles.read", name: "View Roles", description: "View role definitions and assignments", category: "admin", actions: ["read"] },
      { id: "admin.roles.manage", name: "Manage Roles", description: "Create, update, and assign user roles", category: "admin", actions: ["create", "read", "update", "delete", "manage"] },
      { id: "admin.settings.read", name: "View Settings", description: "View system configuration settings", category: "admin", actions: ["read"] },
      { id: "admin.settings.manage", name: "Manage Settings", description: "Configure system settings and preferences", category: "admin", actions: ["read", "update", "manage"] },
      { id: "admin.smart.read", name: "View SMART Apps", description: "View registered SMART on FHIR applications", category: "admin", actions: ["read"] },
      { id: "admin.smart.manage", name: "Manage SMART Apps", description: "Register and configure SMART applications", category: "admin", actions: ["create", "read", "update", "delete", "manage"] },
      { id: "export.basic", name: "Basic Export", description: "Export own patient data in standard formats", category: "export", actions: ["export"] },
      { id: "export.bulk", name: "Bulk Export", description: "Perform bulk data exports across patients", category: "export", actions: ["export", "manage"] },
      { id: "export.research", name: "Research Export", description: "Export de-identified data for research purposes", category: "export", actions: ["export"] },
      { id: "audit.read", name: "Read Audit Logs", description: "View system audit logs and access history", category: "audit", actions: ["read"] },
      { id: "audit.manage", name: "Manage Audit Logs", description: "Configure audit policies and export logs", category: "audit", actions: ["read", "export", "manage"] },
      { id: "audit.compliance", name: "Compliance Reporting", description: "Generate compliance and security reports", category: "audit", actions: ["read", "export"] },
      { id: "ai.assistant", name: "AI Assistant Access", description: "Use AI-powered health assistant features", category: "ai_features", actions: ["read"] },
      { id: "ai.analytics", name: "AI Analytics", description: "Access AI-powered analytics and insights", category: "ai_features", actions: ["read"] },
      { id: "ai.suggestions", name: "AI Suggestions", description: "Receive AI-powered recommendations", category: "ai_features", actions: ["read"] },
      { id: "portal.view", name: "Patient Portal Access", description: "Access patient portal features", category: "patient_portal", actions: ["read"] },
      { id: "portal.manage", name: "Manage Patient Portal", description: "Configure patient portal settings", category: "patient_portal", actions: ["read", "update", "manage"] },
    ];

    for (const permission of defaultPermissions) {
      this.permissions.set(permission.id, permission);
    }
  }

  private initializeDefaultRoles(): void {
    const now = new Date().toISOString();
    const defaultRoles: Role[] = [
      {
        id: "role-admin",
        name: "administrator",
        displayName: "System Administrator",
        description: "Full system access with all administrative capabilities",
        permissions: [
          "fhir.all.manage", "admin.users.manage", "admin.roles.manage", "admin.settings.manage",
          "admin.smart.manage", "export.bulk", "export.research", "audit.manage", "audit.compliance",
          "ai.assistant", "ai.analytics", "ai.suggestions", "portal.manage"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 2
      },
      {
        id: "role-clinician",
        name: "clinician",
        displayName: "Clinician",
        description: "Healthcare provider with full clinical data access",
        permissions: [
          "fhir.patient.read", "fhir.patient.write", "fhir.observation.read", "fhir.observation.write",
          "fhir.condition.read", "fhir.condition.write", "fhir.medication.read", "fhir.medication.write",
          "fhir.encounter.read", "fhir.encounter.write", "fhir.document.read", "fhir.document.write",
          "export.basic", "ai.assistant", "ai.suggestions", "portal.view"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 15
      },
      {
        id: "role-nurse",
        name: "nurse",
        displayName: "Nurse",
        description: "Nursing staff with clinical data access",
        permissions: [
          "fhir.patient.read", "fhir.observation.read", "fhir.observation.write",
          "fhir.condition.read", "fhir.medication.read", "fhir.encounter.read",
          "fhir.document.read", "export.basic", "ai.assistant", "portal.view"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 25
      },
      {
        id: "role-readonly",
        name: "read_only",
        displayName: "Read-Only",
        description: "View-only access to FHIR data without modification capabilities",
        permissions: [
          "fhir.patient.read", "fhir.observation.read", "fhir.condition.read",
          "fhir.medication.read", "fhir.encounter.read", "fhir.document.read",
          "ai.assistant", "portal.view"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 10
      },
      {
        id: "role-data-manager",
        name: "data_manager",
        displayName: "Data Manager",
        description: "Manage and maintain FHIR data quality and exports",
        permissions: [
          "fhir.all.read", "fhir.all.write", "export.bulk", "export.research",
          "admin.settings.read", "ai.analytics", "ai.suggestions"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 5
      },
      {
        id: "role-auditor",
        name: "auditor",
        displayName: "Auditor",
        description: "Compliance and security auditing access",
        permissions: [
          "fhir.all.read", "admin.users.read", "admin.roles.read", "admin.settings.read",
          "admin.smart.read", "audit.read", "audit.compliance", "ai.analytics"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 3
      },
      {
        id: "role-researcher",
        name: "researcher",
        displayName: "Researcher",
        description: "Research access with de-identified data export capabilities",
        permissions: [
          "fhir.patient.read", "fhir.observation.read", "fhir.condition.read",
          "fhir.medication.read", "export.research", "ai.analytics"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 8
      },
      {
        id: "role-patient",
        name: "patient",
        displayName: "Patient",
        description: "Patient access to their own health records",
        permissions: [
          "fhir.patient.read", "fhir.observation.read", "fhir.condition.read",
          "fhir.medication.read", "fhir.encounter.read", "fhir.document.read",
          "export.basic", "ai.assistant", "portal.view"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 150
      },
      {
        id: "role-caregiver",
        name: "caregiver",
        displayName: "Caregiver/Proxy",
        description: "Delegated access to patient records with consent",
        permissions: [
          "fhir.patient.read", "fhir.observation.read", "fhir.condition.read",
          "fhir.medication.read", "export.basic", "ai.assistant", "portal.view"
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        userCount: 20
      }
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }
  }

  private initializeSampleUsers(): void {
    const now = new Date().toISOString();
    const sampleAssignments: UserRoleAssignment[] = [
      { id: "assign-001", userId: "user-001", userName: "Dr. Sarah Chen", userEmail: "sarah.chen@hospital.org", roleId: "role-clinician", roleName: "Clinician", assignedBy: "system", assignedAt: now, isActive: true },
      { id: "assign-002", userId: "user-002", userName: "James Wilson", userEmail: "james.wilson@hospital.org", roleId: "role-admin", roleName: "System Administrator", assignedBy: "system", assignedAt: now, isActive: true },
      { id: "assign-003", userId: "user-003", userName: "Emily Rodriguez", userEmail: "emily.rodriguez@hospital.org", roleId: "role-nurse", roleName: "Nurse", assignedBy: "user-002", assignedAt: now, isActive: true },
      { id: "assign-004", userId: "user-004", userName: "Michael Brown", userEmail: "michael.brown@hospital.org", roleId: "role-data-manager", roleName: "Data Manager", assignedBy: "user-002", assignedAt: now, isActive: true },
      { id: "assign-005", userId: "user-005", userName: "Lisa Thompson", userEmail: "lisa.thompson@audit.org", roleId: "role-auditor", roleName: "Auditor", assignedBy: "user-002", assignedAt: now, isActive: true },
      { id: "assign-006", userId: "user-006", userName: "Dr. Robert Kim", userEmail: "robert.kim@research.edu", roleId: "role-researcher", roleName: "Researcher", assignedBy: "user-002", assignedAt: now, isActive: true },
      { id: "assign-007", userId: "user-007", userName: "John Smith (Patient)", userEmail: "john.smith@email.com", roleId: "role-patient", roleName: "Patient", assignedBy: "system", assignedAt: now, isActive: true },
      { id: "assign-008", userId: "user-008", userName: "Mary Johnson", userEmail: "mary.johnson@email.com", roleId: "role-caregiver", roleName: "Caregiver/Proxy", assignedBy: "system", assignedAt: now, reason: "Authorized caregiver for patient John Smith", isActive: true },
      { id: "assign-009", userId: "user-009", userName: "David Lee", userEmail: "david.lee@hospital.org", roleId: "role-readonly", roleName: "Read-Only", assignedBy: "user-002", assignedAt: now, isActive: true },
      { id: "assign-010", userId: "user-010", userName: "Jennifer Martinez", userEmail: "jennifer.martinez@hospital.org", roleId: "role-clinician", roleName: "Clinician", assignedBy: "user-002", assignedAt: now, isActive: true },
    ];

    for (const assignment of sampleAssignments) {
      this.userAssignments.set(assignment.id, assignment);
    }
  }

  getAllPermissions(): Permission[] {
    console.log(`[HIPAA-AUDIT][RoleManagement] Permissions list retrieved`);
    return Array.from(this.permissions.values());
  }

  getPermissionsByCategory(category: string): Permission[] {
    return Array.from(this.permissions.values()).filter(p => p.category === category);
  }

  getAllRoles(): Role[] {
    console.log(`[HIPAA-AUDIT][RoleManagement] Roles list retrieved`);
    return Array.from(this.roles.values());
  }

  getRoleById(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  createRole(roleData: Omit<Role, "id" | "createdAt" | "updatedAt" | "isSystemRole" | "userCount">): Role {
    const roleId = `role-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const role: Role = {
      ...roleData,
      id: roleId,
      isSystemRole: false,
      createdAt: now,
      updatedAt: now,
      userCount: 0
    };
    this.roles.set(roleId, role);
    console.log(`[HIPAA-AUDIT][RoleManagement] Role created: roleId=${roleId}, name=${role.name}`);
    return role;
  }

  updateRole(roleId: string, updates: Partial<Omit<Role, "id" | "createdAt" | "isSystemRole">>): Role | null {
    const role = this.roles.get(roleId);
    if (!role) return null;

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: roleId,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.roles.set(roleId, updatedRole);
    console.log(`[HIPAA-AUDIT][RoleManagement] Role updated: roleId=${roleId}`);
    return updatedRole;
  }

  deleteRole(roleId: string): boolean {
    const role = this.roles.get(roleId);
    if (!role || role.isSystemRole) {
      console.log(`[HIPAA-AUDIT][RoleManagement] Role deletion blocked: roleId=${roleId}, isSystemRole=${role?.isSystemRole}`);
      return false;
    }
    this.roles.delete(roleId);
    console.log(`[HIPAA-AUDIT][RoleManagement] Role deleted: roleId=${roleId}`);
    return true;
  }

  getAllUserAssignments(): UserRoleAssignment[] {
    console.log(`[HIPAA-AUDIT][RoleManagement] User assignments list retrieved`);
    return Array.from(this.userAssignments.values());
  }

  getUserAssignmentsByRole(roleId: string): UserRoleAssignment[] {
    return Array.from(this.userAssignments.values()).filter(a => a.roleId === roleId);
  }

  getUserAssignment(userId: string): UserRoleAssignment | undefined {
    return Array.from(this.userAssignments.values()).find(a => a.userId === userId && a.isActive);
  }

  assignRole(data: { userId: string; userName: string; userEmail: string; roleId: string; assignedBy: string; reason?: string; expiresAt?: string }): UserRoleAssignment | null {
    const role = this.roles.get(data.roleId);
    if (!role) return null;

    const existingAssignment = Array.from(this.userAssignments.values()).find(a => a.userId === data.userId && a.isActive);
    if (existingAssignment) {
      existingAssignment.isActive = false;
    }

    const assignmentId = `assign-${Date.now().toString(36)}`;
    const assignment: UserRoleAssignment = {
      id: assignmentId,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      roleId: data.roleId,
      roleName: role.displayName,
      assignedBy: data.assignedBy,
      assignedAt: new Date().toISOString(),
      reason: data.reason,
      expiresAt: data.expiresAt,
      isActive: true
    };
    this.userAssignments.set(assignmentId, assignment);

    if (role.userCount !== undefined) {
      role.userCount++;
    }

    console.log(`[HIPAA-AUDIT][RoleManagement] Role assigned: userId=${data.userId}, roleId=${data.roleId}, assignedBy=${data.assignedBy}`);
    return assignment;
  }

  revokeRole(assignmentId: string, revokedBy: string): boolean {
    const assignment = this.userAssignments.get(assignmentId);
    if (!assignment) return false;

    assignment.isActive = false;
    const role = this.roles.get(assignment.roleId);
    if (role && role.userCount !== undefined && role.userCount > 0) {
      role.userCount--;
    }

    console.log(`[HIPAA-AUDIT][RoleManagement] Role revoked: assignmentId=${assignmentId}, userId=${assignment.userId}, revokedBy=${revokedBy}`);
    return true;
  }

  checkPermission(userId: string, permissionId: string): { allowed: boolean; role?: string; reason: string } {
    const assignment = this.getUserAssignment(userId);
    if (!assignment) {
      return { allowed: false, reason: "User has no active role assignment" };
    }

    const role = this.roles.get(assignment.roleId);
    if (!role || !role.isActive) {
      return { allowed: false, reason: "Role is not active" };
    }

    if (role.permissions.includes(permissionId)) {
      return { allowed: true, role: role.displayName, reason: `Permission granted via ${role.displayName} role` };
    }

    const wildcardPermission = permissionId.split(".").slice(0, -1).join(".") + ".manage";
    if (role.permissions.includes(wildcardPermission)) {
      return { allowed: true, role: role.displayName, reason: `Permission granted via ${role.displayName} role (wildcard)` };
    }

    return { allowed: false, role: role.displayName, reason: `Permission not included in ${role.displayName} role` };
  }

  private getSampleUserActivities(): UserActivity[] {
    return [
      {
        userId: "user-009",
        userName: "David Lee",
        actions: [
          { type: "read", resource: "Patient", count: 245, lastOccurred: "2026-02-01T10:30:00Z" },
          { type: "read", resource: "Observation", count: 180, lastOccurred: "2026-02-01T09:45:00Z" },
          { type: "read", resource: "Condition", count: 95, lastOccurred: "2026-01-31T16:20:00Z" },
          { type: "update", resource: "Patient", count: 12, lastOccurred: "2026-01-30T14:15:00Z" }
        ],
        dataAccessPatterns: [
          { resourceType: "Patient", accessCount: 245, sensitivityLevel: "high" },
          { resourceType: "Observation", accessCount: 180, sensitivityLevel: "medium" },
          { resourceType: "Condition", accessCount: 95, sensitivityLevel: "high" }
        ],
        loginFrequency: "daily",
        lastActive: "2026-02-01T10:30:00Z"
      },
      {
        userId: "user-003",
        userName: "Emily Rodriguez",
        actions: [
          { type: "read", resource: "Patient", count: 520, lastOccurred: "2026-02-01T11:00:00Z" },
          { type: "update", resource: "Observation", count: 340, lastOccurred: "2026-02-01T10:55:00Z" },
          { type: "create", resource: "Observation", count: 89, lastOccurred: "2026-02-01T10:50:00Z" }
        ],
        dataAccessPatterns: [
          { resourceType: "Patient", accessCount: 520, sensitivityLevel: "high" },
          { resourceType: "Observation", accessCount: 429, sensitivityLevel: "medium" }
        ],
        loginFrequency: "daily",
        lastActive: "2026-02-01T11:00:00Z"
      },
      {
        userId: "user-006",
        userName: "Dr. Robert Kim",
        actions: [
          { type: "read", resource: "Patient", count: 1250, lastOccurred: "2026-02-01T09:00:00Z" },
          { type: "export", resource: "Condition", count: 45, lastOccurred: "2026-01-31T15:00:00Z" },
          { type: "read", resource: "Observation", count: 2100, lastOccurred: "2026-02-01T08:45:00Z" }
        ],
        dataAccessPatterns: [
          { resourceType: "Patient", accessCount: 1250, sensitivityLevel: "high" },
          { resourceType: "Observation", accessCount: 2100, sensitivityLevel: "medium" },
          { resourceType: "Condition", accessCount: 45, sensitivityLevel: "high" }
        ],
        loginFrequency: "weekly",
        lastActive: "2026-02-01T09:00:00Z"
      }
    ];
  }

  async getAIRoleSuggestions(): Promise<RoleSuggestion[]> {
    console.log(`[HIPAA-AUDIT][RoleManagement] AI role suggestions requested`);

    const userActivities = this.getSampleUserActivities();
    const roles = this.getAllRoles();

    if (!this.openai) {
      return this.getDefaultRoleSuggestions(userActivities);
    }

    try {
      const prompt = `You are a healthcare IT security expert. Analyze the following user activities and suggest role-based access control improvements.

Available Roles:
${roles.map(r => `- ${r.displayName} (${r.name}): ${r.description}`).join("\n")}

User Activities:
${JSON.stringify(userActivities, null, 2)}

For each user, analyze:
1. Their access patterns and frequency
2. Data sensitivity levels they access
3. Whether their current permissions match their activities
4. Potential security risks or over-privileged access

Return a JSON array of role suggestions. Each suggestion should have:
- userId: The user ID
- userName: The user name
- currentRole: Their current role (if known)
- suggestedRole: The recommended role ID
- confidence: 0-100 confidence score
- reasoning: Brief explanation
- factors: Array of { factor, weight, description } analyzing their activity
- dataSensitivityLevel: "high", "medium", or "low"
- activityPatterns: Array of observed patterns
- recommendation: "upgrade", "downgrade", "maintain", or "review"

Return ONLY valid JSON array, no markdown.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "[]";
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const suggestions = JSON.parse(cleanContent);

      return suggestions.map((s: any, i: number) => ({
        id: `suggestion-${i + 1}`,
        userId: s.userId,
        userName: s.userName,
        currentRole: s.currentRole,
        suggestedRole: s.suggestedRole,
        confidence: s.confidence,
        reasoning: s.reasoning,
        factors: s.factors || [],
        dataSensitivityLevel: s.dataSensitivityLevel,
        activityPatterns: s.activityPatterns || [],
        recommendation: s.recommendation,
        createdAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error("[RoleManagement] AI suggestions error:", error);
      return this.getDefaultRoleSuggestions(userActivities);
    }
  }

  private getDefaultRoleSuggestions(activities: UserActivity[]): RoleSuggestion[] {
    const now = new Date().toISOString();
    return [
      {
        id: "suggestion-1",
        userId: "user-009",
        userName: "David Lee",
        currentRole: "Read-Only",
        suggestedRole: "role-clinician",
        confidence: 78,
        reasoning: "User shows update activity on Patient records which exceeds Read-Only permissions. Consider upgrading to Clinician role for proper access control.",
        factors: [
          { factor: "Write Activity Detected", weight: "high", description: "12 Patient record updates detected in current role that only allows read access" },
          { factor: "High Access Volume", weight: "medium", description: "245 Patient record reads indicate clinical workflow involvement" },
          { factor: "Daily Login Pattern", weight: "medium", description: "Consistent daily usage suggests active clinical role" }
        ],
        dataSensitivityLevel: "high",
        activityPatterns: ["Frequent patient data access", "Occasional data modifications", "Daily active usage"],
        recommendation: "upgrade",
        createdAt: now
      },
      {
        id: "suggestion-2",
        userId: "user-003",
        userName: "Emily Rodriguez",
        currentRole: "Nurse",
        suggestedRole: "role-nurse",
        confidence: 92,
        reasoning: "Current role permissions align well with observed activities. Nurse role provides appropriate access for clinical observation documentation.",
        factors: [
          { factor: "Permission Alignment", weight: "high", description: "All activities fall within Nurse role permissions" },
          { factor: "Clinical Workflow", weight: "high", description: "High observation creation and update activity matches nursing duties" },
          { factor: "No Excessive Access", weight: "medium", description: "No access attempts outside permitted resources" }
        ],
        dataSensitivityLevel: "medium",
        activityPatterns: ["Observation documentation", "Patient vitals tracking", "Consistent workflow patterns"],
        recommendation: "maintain",
        createdAt: now
      },
      {
        id: "suggestion-3",
        userId: "user-006",
        userName: "Dr. Robert Kim",
        currentRole: "Researcher",
        suggestedRole: "role-researcher",
        confidence: 85,
        reasoning: "Research activities align with Researcher role. However, high data volume access warrants periodic review for compliance.",
        factors: [
          { factor: "Bulk Data Access", weight: "high", description: "Large volume reads across Patient and Observation resources" },
          { factor: "Export Activity", weight: "medium", description: "45 Condition exports indicate research data collection" },
          { factor: "Weekly Access Pattern", weight: "low", description: "Periodic access pattern typical for research workflows" }
        ],
        dataSensitivityLevel: "high",
        activityPatterns: ["Bulk data retrieval", "Research exports", "Periodic batch processing"],
        recommendation: "review",
        createdAt: now
      }
    ];
  }

  getRoleStats(): { totalRoles: number; totalUsers: number; activeAssignments: number; systemRoles: number; customRoles: number } {
    const roles = Array.from(this.roles.values());
    const assignments = Array.from(this.userAssignments.values());
    return {
      totalRoles: roles.length,
      totalUsers: new Set(assignments.map(a => a.userId)).size,
      activeAssignments: assignments.filter(a => a.isActive).length,
      systemRoles: roles.filter(r => r.isSystemRole).length,
      customRoles: roles.filter(r => !r.isSystemRole).length
    };
  }
}

export const userRoleManagementService = new UserRoleManagementService();
