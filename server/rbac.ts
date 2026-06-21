import type { Response, NextFunction, RequestHandler } from "express";
import { 
  type UserRole, 
  type Permission, 
  hasPermission,
} from "@shared/schema";
import { storage } from "./storage";

async function logPermissionDenied(
  userId: string,
  requiredPermission: Permission | Permission[],
  actualRole: UserRole,
  ipAddress: string,
  userAgent: string,
  resource?: string
): Promise<void> {
  const permStr = Array.isArray(requiredPermission) 
    ? requiredPermission.join(", ") 
    : requiredPermission;
    
  await storage.createSecurityAuditLog({
    userId,
    eventType: "permission_denied",
    description: `Access denied: User with role '${actualRole}' attempted action requiring '${permStr}'${resource ? ` on ${resource}` : ""}`,
    ipAddress,
    userAgent,
    metadata: {
      requiredPermission: permStr,
      userRole: actualRole,
      resource: resource || "unknown",
    },
  });
}

async function logDataAccess(
  userId: string,
  resource: string,
  action: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    userId,
    eventType: "data_access",
    description: `User accessed ${resource} (${action})`,
    ipAddress,
    userAgent,
    metadata: {
      resource,
      action,
    },
  });
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const user = await storage.getUser(userId);
  return user?.role || "patient";
}

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user?.claims?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userRole = await getUserRole(user.claims.sub);
      req.userRole = userRole;

      if (!allowedRoles.includes(userRole)) {
        await logPermissionDenied(
          user.claims.sub,
          [] as unknown as Permission,
          userRole,
          req.ip || "Unknown",
          req.get("user-agent") || "Unknown",
          req.originalUrl
        );
        
        return res.status(403).json({ 
          error: "Forbidden",
          message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      console.error("RBAC role check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function requirePermission(...requiredPermissions: Permission[]): RequestHandler {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user?.claims?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userRole = await getUserRole(user.claims.sub);
      req.userRole = userRole;

      const hasAllPermissions = requiredPermissions.every(
        permission => hasPermission(userRole, permission)
      );

      if (!hasAllPermissions) {
        await logPermissionDenied(
          user.claims.sub,
          requiredPermissions,
          userRole,
          req.ip || "Unknown",
          req.get("user-agent") || "Unknown",
          req.originalUrl
        );
        
        return res.status(403).json({ 
          error: "Forbidden",
          message: "You do not have permission to perform this action",
          required: requiredPermissions,
        });
      }

      next();
    } catch (error) {
      console.error("RBAC permission check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function requireAnyPermission(...requiredPermissions: Permission[]): RequestHandler {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user?.claims?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userRole = await getUserRole(user.claims.sub);
      req.userRole = userRole;

      const hasAnyPermission = requiredPermissions.some(
        permission => hasPermission(userRole, permission)
      );

      if (!hasAnyPermission) {
        await logPermissionDenied(
          user.claims.sub,
          requiredPermissions,
          userRole,
          req.ip || "Unknown",
          req.get("user-agent") || "Unknown",
          req.originalUrl
        );
        
        return res.status(403).json({ 
          error: "Forbidden",
          message: "You do not have permission to perform this action",
          requiredOneOf: requiredPermissions,
        });
      }

      next();
    } catch (error) {
      console.error("RBAC permission check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function auditDataAccess(resource: string, action: string): RequestHandler {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (user?.claims?.sub) {
        await logDataAccess(
          user.claims.sub,
          resource,
          action,
          req.ip || "Unknown",
          req.get("user-agent") || "Unknown"
        );
      }

      next();
    } catch (error) {
      console.error("Audit logging error:", error);
      next();
    }
  };
}

export async function checkCaregiverAccess(
  caregiverUserId: string,
  patientUserId: string,
  requiredPermission?: string
): Promise<boolean> {
  const caregivers = await storage.getCaregivingFor(caregiverUserId);
  
  const relationship = caregivers.find(
    c => c.patientUserId === patientUserId && c.status === "accepted"
  );
  
  if (!relationship) {
    return false;
  }

  if (requiredPermission) {
    return relationship.permissions.includes(requiredPermission);
  }

  return true;
}

export function requireCaregiverOrSelf(patientIdParam: string = "patientId"): RequestHandler {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user?.claims?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const targetPatientId = req.params[patientIdParam] || req.body[patientIdParam];
      
      if (user.claims.sub === targetPatientId) {
        return next();
      }

      const userRole = await getUserRole(user.claims.sub);

      if (userRole === "admin") {
        return next();
      }

      if (userRole === "support") {
        await logDataAccess(
          user.claims.sub,
          `patient:${targetPatientId}`,
          "support_access",
          req.ip || "Unknown",
          req.get("user-agent") || "Unknown"
        );
        return next();
      }

      const hasAccess = await checkCaregiverAccess(user.claims.sub, targetPatientId, "view");
      
      if (!hasAccess) {
        await logPermissionDenied(
          user.claims.sub,
          "records:read" as Permission,
          userRole,
          req.ip || "Unknown",
          req.get("user-agent") || "Unknown",
          `patient:${targetPatientId}`
        );
        
        return res.status(403).json({ 
          error: "Forbidden",
          message: "You do not have access to this patient's data",
        });
      }

      next();
    } catch (error) {
      console.error("RBAC caregiver check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export async function logAdminAction(
  adminUserId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, string>,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    userId: adminUserId,
    eventType: "admin_action",
    description: `Admin action: ${action}${targetUserId ? ` on user ${targetUserId}` : ""}`,
    ipAddress,
    userAgent,
    metadata: {
      action,
      targetUserId: targetUserId || "",
      ...details,
    },
  });
}

export async function logRoleChange(
  adminUserId: string,
  targetUserId: string,
  oldRole: UserRole,
  newRole: UserRole,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    userId: adminUserId,
    eventType: "role_changed",
    description: `User ${targetUserId} role changed from '${oldRole}' to '${newRole}'`,
    ipAddress,
    userAgent,
    metadata: {
      targetUserId,
      oldRole,
      newRole,
    },
  });

  await storage.createSecurityNotification({
    userId: targetUserId,
    type: "security_recommendation",
    title: "Account Role Updated",
    message: `Your account role has been changed from ${oldRole} to ${newRole}. If you did not expect this change, please contact support.`,
    severity: "warning",
    metadata: { oldRole, newRole },
  });
}
