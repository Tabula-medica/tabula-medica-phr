import { Request, Response, NextFunction } from "express";
import { rbacService, UserRole, ResourceCategory, PermissionAction } from "../services/rbac-service";

export interface AuthorizedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  accessDecision?: {
    allowed: boolean;
    reason: string;
    auditId: string;
  };
}

export function requirePermission(
  resource: ResourceCategory,
  action: PermissionAction,
  options?: {
    getResourceId?: (req: Request) => string | undefined;
    onDenied?: (req: Request, res: Response, reason: string) => void;
  }
) {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId || (req as any).user?.id || "anonymous";
      const userRole = req.userRole || (req as any).user?.role || "patient";

      const resourceId = options?.getResourceId?.(req);

      const decision = await rbacService.checkAccess(
        userId,
        userRole as UserRole,
        resource,
        action,
        resourceId
      );

      req.accessDecision = {
        allowed: decision.allowed,
        reason: decision.reason,
        auditId: decision.auditId
      };

      if (!decision.allowed) {
        if (options?.onDenied) {
          options.onDenied(req, res, decision.reason);
          return;
        }

        return res.status(403).json({
          error: "Access denied",
          reason: decision.reason,
          auditId: decision.auditId,
          resource,
          action
        });
      }

      next();
    } catch (error) {
      console.error("[RBAC Middleware] Authorization error:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const userRole = req.userRole || (req as any).user?.role;

      if (!userRole) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User role not found in request"
        });
      }

      if (!allowedRoles.includes(userRole as UserRole)) {
        return res.status(403).json({
          error: "Access denied",
          reason: `Role '${userRole}' is not authorized for this operation`,
          allowedRoles
        });
      }

      next();
    } catch (error) {
      console.error("[RBAC Middleware] Role check error:", error);
      res.status(500).json({ error: "Role check failed" });
    }
  };
}

export function requireAnyPermission(
  permissions: Array<{ resource: ResourceCategory; action: PermissionAction }>
) {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId || (req as any).user?.id || "anonymous";
      const userRole = req.userRole || (req as any).user?.role || "patient";

      for (const perm of permissions) {
        const decision = await rbacService.checkAccess(
          userId,
          userRole as UserRole,
          perm.resource,
          perm.action
        );

        if (decision.allowed) {
          req.accessDecision = {
            allowed: true,
            reason: decision.reason,
            auditId: decision.auditId
          };
          return next();
        }
      }

      return res.status(403).json({
        error: "Access denied",
        reason: "None of the required permissions were granted",
        requiredPermissions: permissions
      });
    } catch (error) {
      console.error("[RBAC Middleware] Permission check error:", error);
      res.status(500).json({ error: "Permission check failed" });
    }
  };
}

export function requireAllPermissions(
  permissions: Array<{ resource: ResourceCategory; action: PermissionAction }>
) {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId || (req as any).user?.id || "anonymous";
      const userRole = req.userRole || (req as any).user?.role || "patient";

      const deniedPermissions: Array<{ resource: string; action: string; reason: string }> = [];

      for (const perm of permissions) {
        const decision = await rbacService.checkAccess(
          userId,
          userRole as UserRole,
          perm.resource,
          perm.action
        );

        if (!decision.allowed) {
          deniedPermissions.push({
            resource: perm.resource,
            action: perm.action,
            reason: decision.reason
          });
        }
      }

      if (deniedPermissions.length > 0) {
        return res.status(403).json({
          error: "Access denied",
          reason: "Not all required permissions were granted",
          deniedPermissions
        });
      }

      next();
    } catch (error) {
      console.error("[RBAC Middleware] Permission check error:", error);
      res.status(500).json({ error: "Permission check failed" });
    }
  };
}

export function extractUserContext(
  req: AuthorizedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const sessionUser = (req as any).session?.user;

  if (sessionUser) {
    req.userId = sessionUser.id;
    req.userRole = sessionUser.role;
  } else if (authHeader) {
    req.userId = "api-user";
    req.userRole = "data_analyst";
  } else {
    req.userId = "anonymous";
    req.userRole = "patient";
  }

  next();
}

console.log("[RBAC Middleware] Authorization middleware loaded");
console.log("[RBAC Middleware] Functions: requirePermission, requireRole, requireAnyPermission, requireAllPermissions");

export default {
  requirePermission,
  requireRole,
  requireAnyPermission,
  requireAllPermissions,
  extractUserContext
};
