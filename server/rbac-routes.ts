import { Router, Request, Response, NextFunction } from "express";
import { 
  rbacService, 
  UserRole, 
  ResourceCategory, 
  PermissionAction 
} from "./services/rbac-service";
import { 
  extractUserContext, 
  requireRole, 
  AuthorizedRequest 
} from "./middleware/rbac-authorization";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

router.use(extractUserContext);

const logRbacAccess = (operation: string) => {
  return (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    logPhiAccess({
      action: "read",
      userId: getUserId(req),
      resourceType: "RBACManagement",
      details: `RBAC_API_ACCESS: ${operation} by user ${req.userId} (${req.userRole})`,
    });
    next();
  };
};

router.get("/metadata", logRbacAccess("GET_METADATA"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const metadata = await rbacService.getServiceMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[RBAC] Error getting metadata:", error);
    res.status(500).json({ error: "Failed to get RBAC metadata" });
  }
});

router.get("/roles", logRbacAccess("LIST_ROLES"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const roles = await rbacService.getRoles(userId);
    res.json({ 
      roles,
      count: roles.length
    });
  } catch (error) {
    console.error("[RBAC] Error getting roles:", error);
    res.status(500).json({ error: "Failed to get roles" });
  }
});

router.get("/roles/:roleId", logRbacAccess("GET_ROLE"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { roleId } = req.params;
    
    const role = await rbacService.getRole(userId, roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json({ role });
  } catch (error) {
    console.error("[RBAC] Error getting role:", error);
    res.status(500).json({ error: "Failed to get role" });
  }
});

router.post("/roles", requireRole("administrator"), logRbacAccess("CREATE_ROLE"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const roleData = req.body;
    
    if (!roleData.name) {
      return res.status(400).json({ error: "name is required" });
    }
    
    const role = await rbacService.createRole(userId, roleData);
    res.status(201).json({ 
      role,
      message: "Role created successfully"
    });
  } catch (error) {
    console.error("[RBAC] Error creating role:", error);
    res.status(500).json({ error: "Failed to create role" });
  }
});

router.patch("/roles/:roleId", requireRole("administrator"), logRbacAccess("UPDATE_ROLE"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { roleId } = req.params;
    const updates = req.body;
    
    const role = await rbacService.updateRole(userId, roleId, updates);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json({ 
      role,
      message: "Role updated successfully"
    });
  } catch (error: any) {
    if (error.message?.includes("system roles")) {
      return res.status(403).json({ error: error.message });
    }
    console.error("[RBAC] Error updating role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.get("/permissions", logRbacAccess("LIST_PERMISSIONS"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const resource = req.query.resource as ResourceCategory | undefined;
    
    let permissions;
    if (resource) {
      permissions = await rbacService.getPermissionsByResource(userId, resource);
    } else {
      permissions = await rbacService.getPermissions(userId);
    }
    
    res.json({ 
      permissions,
      count: permissions.length
    });
  } catch (error) {
    console.error("[RBAC] Error getting permissions:", error);
    res.status(500).json({ error: "Failed to get permissions" });
  }
});

router.post("/check-access", logRbacAccess("CHECK_ACCESS"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const { userId, userRole, resource, action, resourceId } = req.body;
    
    if (!userId || !userRole || !resource || !action) {
      return res.status(400).json({ 
        error: "userId, userRole, resource, and action are required" 
      });
    }
    
    const decision = await rbacService.checkAccess(
      userId,
      userRole as UserRole,
      resource as ResourceCategory,
      action as PermissionAction,
      resourceId
    );
    
    res.json({ decision });
  } catch (error) {
    console.error("[RBAC] Error checking access:", error);
    res.status(500).json({ error: "Failed to check access" });
  }
});

router.post("/users/:targetUserId/roles", requireRole("administrator"), logRbacAccess("ASSIGN_ROLE"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const adminUserId = getUserId(req);
    const { targetUserId } = req.params;
    const { roleId, scope } = req.body;
    
    if (!roleId) {
      return res.status(400).json({ error: "roleId is required" });
    }
    
    const assignment = await rbacService.assignRoleToUser(
      adminUserId,
      targetUserId,
      roleId,
      scope
    );
    
    res.status(201).json({ 
      assignment,
      message: "Role assigned successfully"
    });
  } catch (error) {
    console.error("[RBAC] Error assigning role:", error);
    res.status(500).json({ error: "Failed to assign role" });
  }
});

router.get("/users/:targetUserId/roles", requireRole("administrator", "auditor"), logRbacAccess("GET_USER_ROLES"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const adminUserId = getUserId(req);
    const { targetUserId } = req.params;
    
    const roles = await rbacService.getUserRoles(adminUserId, targetUserId);
    res.json({ 
      roles,
      count: roles.length
    });
  } catch (error) {
    console.error("[RBAC] Error getting user roles:", error);
    res.status(500).json({ error: "Failed to get user roles" });
  }
});

router.delete("/assignments/:assignmentId", requireRole("administrator"), logRbacAccess("REVOKE_ROLE"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const adminUserId = getUserId(req);
    const { assignmentId } = req.params;
    
    const success = await rbacService.revokeUserRole(adminUserId, assignmentId);
    if (!success) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    res.json({ message: "Role assignment revoked successfully" });
  } catch (error) {
    console.error("[RBAC] Error revoking role:", error);
    res.status(500).json({ error: "Failed to revoke role" });
  }
});

router.get("/policies", requireRole("administrator", "auditor"), logRbacAccess("LIST_POLICIES"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const policies = await rbacService.getPolicies(userId);
    res.json({ 
      policies,
      count: policies.length
    });
  } catch (error) {
    console.error("[RBAC] Error getting policies:", error);
    res.status(500).json({ error: "Failed to get policies" });
  }
});

router.post("/policies", requireRole("administrator"), logRbacAccess("CREATE_POLICY"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const policyData = req.body;
    
    if (!policyData.name || !policyData.principals || !policyData.resources || !policyData.actions) {
      return res.status(400).json({ 
        error: "name, principals, resources, and actions are required" 
      });
    }
    
    const policy = await rbacService.createPolicy(userId, policyData);
    res.status(201).json({ 
      policy,
      message: "Policy created successfully"
    });
  } catch (error) {
    console.error("[RBAC] Error creating policy:", error);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.get("/audit-logs", requireRole("administrator", "auditor"), logRbacAccess("GET_AUDIT_LOGS"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { startDate, endDate, targetUserId, resource, decision, limit } = req.query;
    
    const logs = await rbacService.getAccessAuditLogs(userId, {
      startDate: startDate as string,
      endDate: endDate as string,
      targetUserId: targetUserId as string,
      resource: resource as ResourceCategory,
      decision: decision as "allowed" | "denied",
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ 
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error("[RBAC] Error getting audit logs:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

console.log("[RBAC] Routes registered at /api/rbac/*");
console.log("[RBAC] Endpoints: /metadata, /roles, /permissions, /check-access, /users/:id/roles, /policies, /audit-logs");

export default router;
