import { logPhiAccess } from "../security/hipaa-audit";

export const RBAC_VERSION = "1.0.0";

const NO_CDS_DISCLAIMER = "IMPORTANT: Access control configurations do not constitute medical advice. Always consult with your healthcare provider for medical decisions.";

export type UserRole = 
  | "administrator"
  | "clinician"
  | "data_analyst"
  | "care_coordinator"
  | "patient"
  | "caregiver"
  | "auditor"
  | "system"
  // H6 — HIPAA compliance roles. Assigned via account_role_assignments
  // table (DB-backed, persistent), separate from a user's primary role.
  | "privacy_officer"       // §164.530(a)(1) Privacy Official
  | "security_officer"      // §164.308(a)(2)  Security Official
  | "compliance_viewer"     // read-only audit dashboard access
  | "auditor_external";     // time-bounded external auditor

export type ResourceCategory = 
  | "data_sources"
  | "clinical_workflows"
  | "ai_models"
  | "patient_records"
  | "reports"
  | "system_config"
  | "audit_logs"
  | "user_management"
  | "integrations"
  | "analytics"
  | "fhir_resources"
  | "fhir_mappings"
  | "fhir_rules"
  | "fhir_sync"
  | "fhir_endpoints";

export type PermissionAction = 
  | "create"
  | "read"
  | "update"
  | "delete"
  | "execute"
  | "configure"
  | "approve"
  | "export"
  | "share";

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: ResourceCategory;
  action: PermissionAction;
  scope: "own" | "team" | "organization" | "global";
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: "time_based" | "location" | "data_sensitivity" | "patient_relationship" | "workflow_state" | "custom";
  operator: "equals" | "not_equals" | "in" | "not_in" | "between" | "exists";
  field: string;
  value: string | number | boolean | string[];
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  inheritsFrom?: string[];
  isSystem: boolean;
  isActive: boolean;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  };
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
  expiresAt?: string;
  scope?: {
    type: "global" | "facility" | "department" | "team";
    scopeId?: string;
    scopeName?: string;
  };
  isActive: boolean;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedPermission?: string;
  conditions?: string[];
  auditId: string;
}

export interface RBACPolicy {
  id: string;
  name: string;
  description: string;
  priority: number;
  effect: "allow" | "deny";
  principals: string[];
  resources: string[];
  actions: PermissionAction[];
  conditions?: PermissionCondition[];
  isActive: boolean;
}

export interface AccessAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  resource: string;
  resourceCategory: ResourceCategory;
  action: PermissionAction;
  decision: "allowed" | "denied";
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

class RBACService {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private userAssignments: Map<string, UserRoleAssignment[]> = new Map();
  private policies: Map<string, RBACPolicy> = new Map();
  private auditLogs: AccessAuditLog[] = [];

  constructor() {
    this.initializeDefaultPermissions();
    this.initializeDefaultRoles();
    this.initializeDefaultPolicies();
    console.log("[RBAC] Service initialized");
    console.log(`[RBAC] Version: ${RBAC_VERSION}`);
    console.log(`[RBAC] Roles: ${this.roles.size}, Permissions: ${this.permissions.size}`);
    console.log("[RBAC] Features: granular permissions, role inheritance, resource scoping");
  }

  private initializeDefaultPermissions(): void {
    const defaultPermissions: Permission[] = [
      { id: "ds_create", name: "Create Data Sources", description: "Create new data source configurations", resource: "data_sources", action: "create", scope: "organization" },
      { id: "ds_read", name: "Read Data Sources", description: "View data source configurations", resource: "data_sources", action: "read", scope: "organization" },
      { id: "ds_update", name: "Update Data Sources", description: "Modify data source configurations", resource: "data_sources", action: "update", scope: "organization" },
      { id: "ds_delete", name: "Delete Data Sources", description: "Remove data source configurations", resource: "data_sources", action: "delete", scope: "organization" },
      { id: "ds_configure", name: "Configure Data Sources", description: "Configure connection settings and sync schedules", resource: "data_sources", action: "configure", scope: "organization" },
      { id: "ds_execute", name: "Execute Data Source Operations", description: "Run sync, test connections, trigger ingestion", resource: "data_sources", action: "execute", scope: "organization" },

      { id: "cw_create", name: "Create Clinical Workflows", description: "Create new clinical workflow templates", resource: "clinical_workflows", action: "create", scope: "organization" },
      { id: "cw_read", name: "Read Clinical Workflows", description: "View clinical workflow configurations", resource: "clinical_workflows", action: "read", scope: "team" },
      { id: "cw_update", name: "Update Clinical Workflows", description: "Modify clinical workflow configurations", resource: "clinical_workflows", action: "update", scope: "organization" },
      { id: "cw_delete", name: "Delete Clinical Workflows", description: "Remove clinical workflow configurations", resource: "clinical_workflows", action: "delete", scope: "organization" },
      { id: "cw_execute", name: "Execute Clinical Workflows", description: "Run and manage clinical workflows", resource: "clinical_workflows", action: "execute", scope: "team" },
      { id: "cw_approve", name: "Approve Clinical Workflows", description: "Approve clinical workflow changes", resource: "clinical_workflows", action: "approve", scope: "organization" },

      { id: "ai_read", name: "Read AI Models", description: "View AI model configurations and outputs", resource: "ai_models", action: "read", scope: "organization" },
      { id: "ai_configure", name: "Configure AI Models", description: "Configure AI model parameters and thresholds", resource: "ai_models", action: "configure", scope: "organization" },
      { id: "ai_execute", name: "Execute AI Models", description: "Run AI inference and analysis", resource: "ai_models", action: "execute", scope: "team" },
      { id: "ai_approve", name: "Approve AI Outputs", description: "Review and approve AI-generated recommendations", resource: "ai_models", action: "approve", scope: "team" },

      { id: "pr_create", name: "Create Patient Records", description: "Create new patient records", resource: "patient_records", action: "create", scope: "team" },
      { id: "pr_read", name: "Read Patient Records", description: "View patient health records", resource: "patient_records", action: "read", scope: "team" },
      { id: "pr_update", name: "Update Patient Records", description: "Modify patient health records", resource: "patient_records", action: "update", scope: "team" },
      { id: "pr_delete", name: "Delete Patient Records", description: "Remove patient records (with audit)", resource: "patient_records", action: "delete", scope: "organization" },
      { id: "pr_export", name: "Export Patient Records", description: "Export patient data for sharing", resource: "patient_records", action: "export", scope: "own" },
      { id: "pr_share", name: "Share Patient Records", description: "Share patient records with providers", resource: "patient_records", action: "share", scope: "own" },

      { id: "rpt_create", name: "Create Reports", description: "Generate new reports", resource: "reports", action: "create", scope: "team" },
      { id: "rpt_read", name: "Read Reports", description: "View generated reports", resource: "reports", action: "read", scope: "team" },
      { id: "rpt_export", name: "Export Reports", description: "Export reports in various formats", resource: "reports", action: "export", scope: "team" },

      { id: "cfg_read", name: "Read System Config", description: "View system configuration", resource: "system_config", action: "read", scope: "organization" },
      { id: "cfg_update", name: "Update System Config", description: "Modify system configuration", resource: "system_config", action: "update", scope: "global" },

      { id: "audit_read", name: "Read Audit Logs", description: "View audit trail and access logs", resource: "audit_logs", action: "read", scope: "organization" },
      { id: "audit_export", name: "Export Audit Logs", description: "Export audit logs for compliance", resource: "audit_logs", action: "export", scope: "organization" },
      // H6 — HIPAA compliance permissions
      { id: "audit_dashboard_read", name: "Read Audit Dashboard", description: "View consolidated HIPAA audit dashboard", resource: "audit_logs", action: "read", scope: "organization" },
      { id: "phi_access_investigate", name: "Investigate PHI Access", description: "Run PHI-access-log investigations across the organization", resource: "audit_logs", action: "read", scope: "organization" },
      { id: "breach_investigate", name: "Investigate Breaches", description: "Run breach detection and incident analysis", resource: "audit_logs", action: "read", scope: "organization" },
      { id: "consent_admin", name: "Administer Consents", description: "Review and modify patient consent records under §164.508", resource: "patient_records", action: "update", scope: "organization" },
      { id: "security_incident_admin", name: "Administer Security Incidents", description: "Manage security incidents and response per §164.308(a)(6)", resource: "audit_logs", action: "configure", scope: "organization" },

      { id: "usr_create", name: "Create Users", description: "Create new user accounts", resource: "user_management", action: "create", scope: "organization" },
      { id: "usr_read", name: "Read Users", description: "View user accounts and roles", resource: "user_management", action: "read", scope: "organization" },
      { id: "usr_update", name: "Update Users", description: "Modify user accounts and assignments", resource: "user_management", action: "update", scope: "organization" },
      { id: "usr_delete", name: "Delete Users", description: "Remove user accounts", resource: "user_management", action: "delete", scope: "organization" },

      { id: "int_create", name: "Create Integrations", description: "Set up new external integrations", resource: "integrations", action: "create", scope: "organization" },
      { id: "int_read", name: "Read Integrations", description: "View integration configurations", resource: "integrations", action: "read", scope: "organization" },
      { id: "int_configure", name: "Configure Integrations", description: "Configure integration settings", resource: "integrations", action: "configure", scope: "organization" },

      { id: "anl_read", name: "Read Analytics", description: "View analytics dashboards", resource: "analytics", action: "read", scope: "team" },
      { id: "anl_create", name: "Create Analytics", description: "Create custom analytics views", resource: "analytics", action: "create", scope: "team" },
      { id: "anl_export", name: "Export Analytics", description: "Export analytics data", resource: "analytics", action: "export", scope: "team" },

      { id: "fhir_res_create", name: "Create FHIR Resources", description: "Create new FHIR resources (Patient, Observation, etc.)", resource: "fhir_resources", action: "create", scope: "team" },
      { id: "fhir_res_read", name: "Read FHIR Resources", description: "View FHIR resources and data", resource: "fhir_resources", action: "read", scope: "team" },
      { id: "fhir_res_update", name: "Update FHIR Resources", description: "Modify existing FHIR resources", resource: "fhir_resources", action: "update", scope: "team" },
      { id: "fhir_res_delete", name: "Delete FHIR Resources", description: "Remove FHIR resources (with audit)", resource: "fhir_resources", action: "delete", scope: "organization" },
      { id: "fhir_res_export", name: "Export FHIR Resources", description: "Export FHIR bundles and data", resource: "fhir_resources", action: "export", scope: "team" },

      { id: "fhir_map_create", name: "Create FHIR Mappings", description: "Create code mappings and terminology translations", resource: "fhir_mappings", action: "create", scope: "organization" },
      { id: "fhir_map_read", name: "Read FHIR Mappings", description: "View code mappings and terminology sets", resource: "fhir_mappings", action: "read", scope: "team" },
      { id: "fhir_map_update", name: "Update FHIR Mappings", description: "Modify code mappings and terminology translations", resource: "fhir_mappings", action: "update", scope: "organization" },
      { id: "fhir_map_delete", name: "Delete FHIR Mappings", description: "Remove code mappings", resource: "fhir_mappings", action: "delete", scope: "organization" },
      { id: "fhir_map_approve", name: "Approve FHIR Mappings", description: "Approve mapping changes for production use", resource: "fhir_mappings", action: "approve", scope: "organization" },

      { id: "fhir_rule_create", name: "Create FHIR Rules", description: "Create clinical rules and validation policies", resource: "fhir_rules", action: "create", scope: "organization" },
      { id: "fhir_rule_read", name: "Read FHIR Rules", description: "View clinical rules and validation policies", resource: "fhir_rules", action: "read", scope: "team" },
      { id: "fhir_rule_update", name: "Update FHIR Rules", description: "Modify clinical rules and validation policies", resource: "fhir_rules", action: "update", scope: "organization" },
      { id: "fhir_rule_delete", name: "Delete FHIR Rules", description: "Remove clinical rules", resource: "fhir_rules", action: "delete", scope: "organization" },
      { id: "fhir_rule_execute", name: "Execute FHIR Rules", description: "Run validation and clinical rules", resource: "fhir_rules", action: "execute", scope: "team" },

      { id: "fhir_sync_create", name: "Create Sync Configurations", description: "Create synchronization configurations", resource: "fhir_sync", action: "create", scope: "organization" },
      { id: "fhir_sync_read", name: "Read Sync Configurations", description: "View synchronization configurations and status", resource: "fhir_sync", action: "read", scope: "team" },
      { id: "fhir_sync_update", name: "Update Sync Configurations", description: "Modify synchronization configurations", resource: "fhir_sync", action: "update", scope: "organization" },
      { id: "fhir_sync_delete", name: "Delete Sync Configurations", description: "Remove synchronization configurations", resource: "fhir_sync", action: "delete", scope: "organization" },
      { id: "fhir_sync_execute", name: "Execute Sync", description: "Trigger manual synchronization", resource: "fhir_sync", action: "execute", scope: "organization" },
      { id: "fhir_sync_configure", name: "Configure Sync Settings", description: "Configure conflict resolution and scheduling", resource: "fhir_sync", action: "configure", scope: "organization" },

      { id: "fhir_ep_create", name: "Create FHIR Endpoints", description: "Register external FHIR server endpoints", resource: "fhir_endpoints", action: "create", scope: "organization" },
      { id: "fhir_ep_read", name: "Read FHIR Endpoints", description: "View FHIR endpoint configurations", resource: "fhir_endpoints", action: "read", scope: "team" },
      { id: "fhir_ep_update", name: "Update FHIR Endpoints", description: "Modify FHIR endpoint configurations", resource: "fhir_endpoints", action: "update", scope: "organization" },
      { id: "fhir_ep_delete", name: "Delete FHIR Endpoints", description: "Remove FHIR endpoint configurations", resource: "fhir_endpoints", action: "delete", scope: "organization" },
      { id: "fhir_ep_configure", name: "Configure FHIR Endpoints", description: "Configure OAuth/OIDC credentials and settings", resource: "fhir_endpoints", action: "configure", scope: "organization" },
    ];

    defaultPermissions.forEach(p => this.permissions.set(p.id, p));
  }

  private initializeDefaultRoles(): void {
    const timestamp = new Date().toISOString();

    const defaultRoles: Role[] = [
      {
        id: "administrator",
        name: "administrator",
        displayName: "Administrator",
        description: "Full system access with all permissions. Can manage users, roles, and system configuration.",
        permissions: Array.from(this.permissions.keys()),
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "clinician",
        name: "clinician",
        displayName: "Clinician",
        description: "Healthcare provider with access to patient records, clinical workflows, and AI-assisted tools.",
        permissions: [
          "pr_read", "pr_update", "pr_create",
          "cw_read", "cw_execute",
          "ai_read", "ai_execute", "ai_approve",
          "rpt_read", "rpt_create", "rpt_export",
          "anl_read",
          "fhir_res_read", "fhir_res_create", "fhir_res_update", "fhir_res_export",
          "fhir_map_read", "fhir_rule_read", "fhir_rule_execute",
          "fhir_sync_read", "fhir_ep_read"
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "data_analyst",
        name: "data_analyst",
        displayName: "Data Analyst",
        description: "Access to data sources, analytics, and reporting. Can configure data pipelines and quality monitoring.",
        permissions: [
          "ds_read", "ds_configure", "ds_execute",
          "ai_read", "ai_configure",
          "rpt_read", "rpt_create", "rpt_export",
          "anl_read", "anl_create", "anl_export",
          "audit_read",
          "fhir_res_read", "fhir_res_export",
          "fhir_map_read", "fhir_map_create", "fhir_map_update",
          "fhir_rule_read", "fhir_rule_create", "fhir_rule_update", "fhir_rule_execute",
          "fhir_sync_read", "fhir_sync_create", "fhir_sync_update", "fhir_sync_execute",
          "fhir_ep_read", "fhir_ep_create", "fhir_ep_update"
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "care_coordinator",
        name: "care_coordinator",
        displayName: "Care Coordinator",
        description: "Coordinates patient care across providers. Access to patient records, workflows, and communication tools.",
        permissions: [
          "pr_read", "pr_update",
          "cw_read", "cw_execute",
          "ai_read",
          "rpt_read",
          "anl_read"
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "patient",
        name: "patient",
        displayName: "Patient",
        description: "Patient user with access to their own health records, sharing controls, and educational content.",
        permissions: [
          "pr_read", "pr_export", "pr_share",
          "ai_read",
          "rpt_read",
          "fhir_res_read", "fhir_res_export"
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "caregiver",
        name: "caregiver",
        displayName: "Caregiver",
        description: "Caregiver with delegated access to patient records they are authorized to manage.",
        permissions: [
          "pr_read",
          "ai_read",
          "rpt_read"
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "auditor",
        name: "auditor",
        displayName: "Auditor",
        description: "Compliance auditor with read-only access to audit logs, configurations, and reports.",
        permissions: [
          "audit_read", "audit_export",
          "cfg_read",
          "rpt_read",
          "usr_read",
          "ds_read",
          "int_read"
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      // H6 — HIPAA compliance roles
      {
        id: "privacy_officer",
        name: "privacy_officer",
        displayName: "Privacy Officer",
        description: "§164.530(a)(1) Privacy Official. Investigates PHI access, manages consents, responds to patient privacy complaints and §164.528 disclosure-accounting requests.",
        permissions: [
          "audit_read", "audit_export",
          "audit_dashboard_read",
          "phi_access_investigate",
          "breach_investigate",
          "consent_admin",
          "rpt_read", "rpt_export",
          "usr_read",
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "security_officer",
        name: "security_officer",
        displayName: "Security Officer",
        description: "§164.308(a)(2) Security Official. Manages security incidents, breach response, technical safeguards, and access reviews.",
        permissions: [
          "audit_read", "audit_export",
          "audit_dashboard_read",
          "phi_access_investigate",
          "breach_investigate",
          "security_incident_admin",
          "cfg_read",
          "usr_read",
          "rpt_read", "rpt_export",
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "compliance_viewer",
        name: "compliance_viewer",
        displayName: "Compliance Viewer",
        description: "Read-only access to compliance dashboards. For board members, internal audit, GRC tooling. No PHI access.",
        permissions: [
          "audit_read",
          "audit_dashboard_read",
          "rpt_read",
          "cfg_read",
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      },
      {
        id: "auditor_external",
        name: "auditor_external",
        displayName: "External Auditor (time-bounded)",
        description: "Third-party auditor (HITRUST, SOC2, ISO27001 assessor). Always time-bounded via account_role_assignments.expires_at. Read-only.",
        permissions: [
          "audit_read", "audit_export",
          "audit_dashboard_read",
          "rpt_read", "rpt_export",
          "cfg_read",
          "usr_read",
        ],
        isSystem: true,
        isActive: true,
        metadata: { createdAt: timestamp, updatedAt: timestamp, createdBy: "system" }
      }
    ];

    defaultRoles.forEach(r => this.roles.set(r.id, r));
  }

  private initializeDefaultPolicies(): void {
    const defaultPolicies: RBACPolicy[] = [
      {
        id: "policy_phi_access",
        name: "PHI Access Control",
        description: "Restrict PHI access to authorized clinical staff only",
        priority: 100,
        effect: "deny",
        principals: ["patient", "caregiver"],
        resources: ["data_sources", "system_config", "user_management"],
        actions: ["create", "update", "delete", "configure"],
        isActive: true
      },
      {
        id: "policy_audit_immutability",
        name: "Audit Log Immutability",
        description: "Prevent modification or deletion of audit logs",
        priority: 99,
        effect: "deny",
        principals: ["*"],
        resources: ["audit_logs"],
        actions: ["update", "delete"],
        isActive: true
      },
      {
        id: "policy_ai_oversight",
        name: "AI Model Oversight",
        description: "Require clinician approval for AI model configuration changes",
        priority: 80,
        effect: "allow",
        principals: ["clinician", "administrator"],
        resources: ["ai_models"],
        actions: ["approve"],
        conditions: [
          { type: "workflow_state", operator: "equals", field: "status", value: "pending_review" }
        ],
        isActive: true
      },
      {
        id: "policy_data_export",
        name: "Data Export Controls",
        description: "Restrict bulk data exports to authorized roles",
        priority: 70,
        effect: "allow",
        principals: ["administrator", "data_analyst", "auditor"],
        resources: ["patient_records", "reports", "analytics"],
        actions: ["export"],
        isActive: true
      }
    ];

    defaultPolicies.forEach(p => this.policies.set(p.id, p));
  }

  async checkAccess(
    userId: string,
    userRole: UserRole,
    resource: ResourceCategory,
    action: PermissionAction,
    resourceId?: string
  ): Promise<AccessDecision> {
    const auditId = `access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logPhiAccess({
      action: "read",
      userId,
      resourceType: "AccessControl",
      details: `RBAC_CHECK: User ${userId} (${userRole}) requesting ${action} on ${resource}${resourceId ? `:${resourceId}` : ""}`,
    });

    const role = this.roles.get(userRole);
    if (!role || !role.isActive) {
      this.logAccessDecision(auditId, userId, userRole, resource, action, "denied", "Role not found or inactive");
      return { allowed: false, reason: "Role not found or inactive", auditId };
    }

    for (const policy of Array.from(this.policies.values()).sort((a, b) => b.priority - a.priority)) {
      if (!policy.isActive) continue;

      const principalMatch = policy.principals.includes("*") || policy.principals.includes(userRole);
      const resourceMatch = policy.resources.includes(resource);
      const actionMatch = policy.actions.includes(action);

      if (principalMatch && resourceMatch && actionMatch) {
        if (policy.effect === "deny") {
          this.logAccessDecision(auditId, userId, userRole, resource, action, "denied", `Denied by policy: ${policy.name}`);
          return { allowed: false, reason: `Access denied by policy: ${policy.name}`, auditId };
        }
      }
    }

    const requiredPermissionId = this.findPermissionId(resource, action);
    if (!requiredPermissionId) {
      this.logAccessDecision(auditId, userId, userRole, resource, action, "denied", "No matching permission defined");
      return { allowed: false, reason: "No matching permission defined for this operation", auditId };
    }

    if (role.permissions.includes(requiredPermissionId)) {
      this.logAccessDecision(auditId, userId, userRole, resource, action, "allowed", `Granted by permission: ${requiredPermissionId}`);
      return { 
        allowed: true, 
        reason: "Access granted", 
        matchedPermission: requiredPermissionId,
        auditId 
      };
    }

    if (role.inheritsFrom) {
      for (const parentRoleId of role.inheritsFrom) {
        const parentRole = this.roles.get(parentRoleId);
        if (parentRole?.isActive && parentRole.permissions.includes(requiredPermissionId)) {
          this.logAccessDecision(auditId, userId, userRole, resource, action, "allowed", `Granted by inherited role: ${parentRoleId}`);
          return { 
            allowed: true, 
            reason: "Access granted through role inheritance", 
            matchedPermission: requiredPermissionId,
            auditId 
          };
        }
      }
    }

    this.logAccessDecision(auditId, userId, userRole, resource, action, "denied", "Insufficient permissions");
    return { allowed: false, reason: "Insufficient permissions for this operation", auditId };
  }

  private findPermissionId(resource: ResourceCategory, action: PermissionAction): string | null {
    const permissions = Array.from(this.permissions.entries());
    for (const [id, permission] of permissions) {
      if (permission.resource === resource && permission.action === action) {
        return id;
      }
    }
    return null;
  }

  private logAccessDecision(
    auditId: string,
    userId: string,
    userRole: string,
    resource: string,
    action: PermissionAction,
    decision: "allowed" | "denied",
    reason: string
  ): void {
    const log: AccessAuditLog = {
      id: auditId,
      timestamp: new Date().toISOString(),
      userId,
      userRole,
      resource,
      resourceCategory: resource as ResourceCategory,
      action,
      decision,
      reason
    };
    this.auditLogs.push(log);

    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000);
    }
  }

  async getRoles(userId: string): Promise<Role[]> {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "Role",
      details: "RBAC_GET_ROLES: Fetching all roles",
    });
    return Array.from(this.roles.values());
  }

  async getRole(userId: string, roleId: string): Promise<Role | null> {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "Role",
      details: `RBAC_GET_ROLE: Fetching role ${roleId}`,
    });
    return this.roles.get(roleId) || null;
  }

  async createRole(userId: string, roleData: Partial<Role>): Promise<Role> {
    logPhiAccess({
      action: "write",
      userId,
      resourceType: "Role",
      details: `RBAC_CREATE_ROLE: Creating role ${roleData.name}`,
    });

    const roleId = `role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const role: Role = {
      id: roleId,
      name: roleData.name || roleId,
      displayName: roleData.displayName || roleData.name || roleId,
      description: roleData.description || "",
      permissions: roleData.permissions || [],
      inheritsFrom: roleData.inheritsFrom,
      isSystem: false,
      isActive: true,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: userId
      }
    };

    this.roles.set(roleId, role);
    return role;
  }

  async updateRole(userId: string, roleId: string, updates: Partial<Role>): Promise<Role | null> {
    const role = this.roles.get(roleId);
    if (!role) return null;

    if (role.isSystem && updates.permissions) {
      logPhiAccess({
        action: "write",
        userId,
        resourceType: "Role",
        details: `RBAC_UPDATE_ROLE_BLOCKED: Cannot modify system role ${roleId}`,
      });
      throw new Error("Cannot modify permissions of system roles");
    }

    logPhiAccess({
      action: "write",
      userId,
      resourceType: "Role",
      details: `RBAC_UPDATE_ROLE: Updating role ${roleId}`,
    });

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id,
      isSystem: role.isSystem,
      metadata: {
        ...role.metadata,
        updatedAt: new Date().toISOString()
      }
    };

    this.roles.set(roleId, updatedRole);
    return updatedRole;
  }

  async getPermissions(userId: string): Promise<Permission[]> {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "Permission",
      details: "RBAC_GET_PERMISSIONS: Fetching all permissions",
    });
    return Array.from(this.permissions.values());
  }

  async getPermissionsByResource(userId: string, resource: ResourceCategory): Promise<Permission[]> {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "Permission",
      details: `RBAC_GET_PERMISSIONS_BY_RESOURCE: Fetching permissions for ${resource}`,
    });
    return Array.from(this.permissions.values()).filter(p => p.resource === resource);
  }

  async assignRoleToUser(
    adminUserId: string,
    targetUserId: string,
    roleId: string,
    scope?: UserRoleAssignment["scope"]
  ): Promise<UserRoleAssignment> {
    logPhiAccess({
      action: "write",
      userId: adminUserId,
      resourceType: "UserRoleAssignment",
      details: `RBAC_ASSIGN_ROLE: Assigning role ${roleId} to user ${targetUserId}`,
    });

    const assignment: UserRoleAssignment = {
      id: `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: targetUserId,
      roleId,
      assignedAt: new Date().toISOString(),
      assignedBy: adminUserId,
      scope,
      isActive: true
    };

    const userAssignments = this.userAssignments.get(targetUserId) || [];
    userAssignments.push(assignment);
    this.userAssignments.set(targetUserId, userAssignments);

    return assignment;
  }

  async getUserRoles(adminUserId: string, targetUserId: string): Promise<UserRoleAssignment[]> {
    logPhiAccess({
      action: "read",
      userId: adminUserId,
      resourceType: "UserRoleAssignment",
      details: `RBAC_GET_USER_ROLES: Fetching roles for user ${targetUserId}`,
    });

    return (this.userAssignments.get(targetUserId) || []).filter(a => a.isActive);
  }

  async revokeUserRole(adminUserId: string, assignmentId: string): Promise<boolean> {
    logPhiAccess({
      action: "delete",
      userId: adminUserId,
      resourceType: "UserRoleAssignment",
      details: `RBAC_REVOKE_ROLE: Revoking assignment ${assignmentId}`,
    });

    const entries = Array.from(this.userAssignments.entries());
    for (const [_userId, assignments] of entries) {
      const assignment = assignments.find((a: UserRoleAssignment) => a.id === assignmentId);
      if (assignment) {
        assignment.isActive = false;
        return true;
      }
    }
    return false;
  }

  async getPolicies(userId: string): Promise<RBACPolicy[]> {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "RBACPolicy",
      details: "RBAC_GET_POLICIES: Fetching all policies",
    });
    return Array.from(this.policies.values());
  }

  async createPolicy(userId: string, policyData: Partial<RBACPolicy>): Promise<RBACPolicy> {
    logPhiAccess({
      action: "write",
      userId,
      resourceType: "RBACPolicy",
      details: `RBAC_CREATE_POLICY: Creating policy ${policyData.name}`,
    });

    const policyId = `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const policy: RBACPolicy = {
      id: policyId,
      name: policyData.name || policyId,
      description: policyData.description || "",
      priority: policyData.priority || 50,
      effect: policyData.effect || "deny",
      principals: policyData.principals || [],
      resources: policyData.resources || [],
      actions: policyData.actions || [],
      conditions: policyData.conditions,
      isActive: policyData.isActive !== false
    };

    this.policies.set(policyId, policy);
    return policy;
  }

  async getAccessAuditLogs(userId: string, filters?: {
    startDate?: string;
    endDate?: string;
    targetUserId?: string;
    resource?: ResourceCategory;
    decision?: "allowed" | "denied";
    limit?: number;
  }): Promise<AccessAuditLog[]> {
    logPhiAccess({
      action: "read",
      userId,
      resourceType: "AccessAuditLog",
      details: "RBAC_GET_AUDIT_LOGS: Fetching access audit logs",
    });

    let logs = [...this.auditLogs];

    if (filters?.startDate) {
      logs = logs.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      logs = logs.filter(l => l.timestamp <= filters.endDate!);
    }
    if (filters?.targetUserId) {
      logs = logs.filter(l => l.userId === filters.targetUserId);
    }
    if (filters?.resource) {
      logs = logs.filter(l => l.resourceCategory === filters.resource);
    }
    if (filters?.decision) {
      logs = logs.filter(l => l.decision === filters.decision);
    }

    const limit = filters?.limit || 100;
    return logs.slice(-limit).reverse();
  }

  async getServiceMetadata(): Promise<{
    version: string;
    totalRoles: number;
    totalPermissions: number;
    totalPolicies: number;
    resourceCategories: ResourceCategory[];
    permissionActions: PermissionAction[];
    disclaimer: string;
  }> {
    return {
      version: RBAC_VERSION,
      totalRoles: this.roles.size,
      totalPermissions: this.permissions.size,
      totalPolicies: this.policies.size,
      resourceCategories: [
        "data_sources", "clinical_workflows", "ai_models", "patient_records",
        "reports", "system_config", "audit_logs", "user_management", "integrations", "analytics"
      ],
      permissionActions: ["create", "read", "update", "delete", "execute", "configure", "approve", "export", "share"],
      disclaimer: NO_CDS_DISCLAIMER
    };
  }
}

export const rbacService = new RBACService();
