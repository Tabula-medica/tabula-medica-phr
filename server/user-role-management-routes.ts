import { Router, Request, Response } from "express";
import { userRoleManagementService } from "./services/user-role-management-service";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";

const router = Router();

router.use(isAuthenticated);
router.use(requireRole("admin"));

router.get("/permissions", (_req: Request, res: Response) => {
  try {
    const permissions = userRoleManagementService.getAllPermissions();
    res.json({ permissions });
  } catch (error) {
    console.error("[RoleManagement] Get permissions error:", error);
    res.status(500).json({ error: "Failed to retrieve permissions" });
  }
});

router.get("/permissions/:category", (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const permissions = userRoleManagementService.getPermissionsByCategory(category);
    res.json({ permissions });
  } catch (error) {
    console.error("[RoleManagement] Get permissions by category error:", error);
    res.status(500).json({ error: "Failed to retrieve permissions" });
  }
});

router.get("/roles", (_req: Request, res: Response) => {
  try {
    const roles = userRoleManagementService.getAllRoles();
    res.json({ roles });
  } catch (error) {
    console.error("[RoleManagement] Get roles error:", error);
    res.status(500).json({ error: "Failed to retrieve roles" });
  }
});

router.get("/roles/:roleId", (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const role = userRoleManagementService.getRoleById(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json(role);
  } catch (error) {
    console.error("[RoleManagement] Get role error:", error);
    res.status(500).json({ error: "Failed to retrieve role" });
  }
});

router.post("/roles", (req: Request, res: Response) => {
  try {
    const { name, displayName, description, permissions, isActive } = req.body;
    if (!name || !displayName || !permissions) {
      return res.status(400).json({ error: "Name, displayName, and permissions are required" });
    }
    const role = userRoleManagementService.createRole({
      name,
      displayName,
      description: description || "",
      permissions,
      isActive: isActive !== false
    });
    res.status(201).json(role);
  } catch (error) {
    console.error("[RoleManagement] Create role error:", error);
    res.status(500).json({ error: "Failed to create role" });
  }
});

router.patch("/roles/:roleId", (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const updates = req.body;
    const role = userRoleManagementService.updateRole(roleId, updates);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json(role);
  } catch (error) {
    console.error("[RoleManagement] Update role error:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.delete("/roles/:roleId", (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const success = userRoleManagementService.deleteRole(roleId);
    if (!success) {
      return res.status(400).json({ error: "Cannot delete system role or role not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[RoleManagement] Delete role error:", error);
    res.status(500).json({ error: "Failed to delete role" });
  }
});

router.get("/assignments", (_req: Request, res: Response) => {
  try {
    const assignments = userRoleManagementService.getAllUserAssignments();
    res.json({ assignments });
  } catch (error) {
    console.error("[RoleManagement] Get assignments error:", error);
    res.status(500).json({ error: "Failed to retrieve assignments" });
  }
});

router.get("/assignments/role/:roleId", (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const assignments = userRoleManagementService.getUserAssignmentsByRole(roleId);
    res.json({ assignments });
  } catch (error) {
    console.error("[RoleManagement] Get assignments by role error:", error);
    res.status(500).json({ error: "Failed to retrieve assignments" });
  }
});

router.get("/assignments/user/:userId", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const assignment = userRoleManagementService.getUserAssignment(userId);
    if (!assignment) {
      return res.status(404).json({ error: "No active assignment found for user" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("[RoleManagement] Get user assignment error:", error);
    res.status(500).json({ error: "Failed to retrieve assignment" });
  }
});

router.post("/assignments", (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, roleId, assignedBy, reason, expiresAt } = req.body;
    if (!userId || !userName || !userEmail || !roleId) {
      return res.status(400).json({ error: "userId, userName, userEmail, and roleId are required" });
    }
    const assignment = userRoleManagementService.assignRole({
      userId,
      userName,
      userEmail,
      roleId,
      assignedBy: assignedBy || "admin",
      reason,
      expiresAt
    });
    if (!assignment) {
      return res.status(400).json({ error: "Role not found" });
    }
    res.status(201).json(assignment);
  } catch (error) {
    console.error("[RoleManagement] Assign role error:", error);
    res.status(500).json({ error: "Failed to assign role" });
  }
});

router.delete("/assignments/:assignmentId", (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const revokedBy = req.body.revokedBy || "admin";
    const success = userRoleManagementService.revokeRole(assignmentId, revokedBy);
    if (!success) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[RoleManagement] Revoke role error:", error);
    res.status(500).json({ error: "Failed to revoke role" });
  }
});

router.post("/check-permission", (req: Request, res: Response) => {
  try {
    const { userId, permissionId } = req.body;
    if (!userId || !permissionId) {
      return res.status(400).json({ error: "userId and permissionId are required" });
    }
    const result = userRoleManagementService.checkPermission(userId, permissionId);
    res.json(result);
  } catch (error) {
    console.error("[RoleManagement] Check permission error:", error);
    res.status(500).json({ error: "Failed to check permission" });
  }
});

router.get("/ai-suggestions", async (_req: Request, res: Response) => {
  try {
    const suggestions = await userRoleManagementService.getAIRoleSuggestions();
    res.json({ suggestions });
  } catch (error) {
    console.error("[RoleManagement] AI suggestions error:", error);
    res.status(500).json({ error: "Failed to generate AI suggestions" });
  }
});

router.get("/stats", (_req: Request, res: Response) => {
  try {
    const stats = userRoleManagementService.getRoleStats();
    res.json(stats);
  } catch (error) {
    console.error("[RoleManagement] Get stats error:", error);
    res.status(500).json({ error: "Failed to retrieve stats" });
  }
});

export default router;
