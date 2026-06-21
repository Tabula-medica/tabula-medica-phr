import { v4 as uuidv4 } from "uuid";
import type { Request, Response, NextFunction, RequestHandler } from "express";

export interface TenantConfig {
  id: string;
  name: string;
  domain?: string;
  status: "active" | "suspended" | "trial";
  tier: "standard" | "enterprise" | "white_glove";
  features: {
    ssoEnabled: boolean;
    customBranding: boolean;
    dedicatedSupport: boolean;
    advancedAudit: boolean;
    dataRetentionDays: number;
    maxUsers: number;
    maxStorageGb: number;
  };
  security: {
    requireMfa: boolean;
    passwordPolicy: "standard" | "strict";
    sessionTimeoutMinutes: number;
    ipWhitelist?: string[];
    allowedOrigins?: string[];
  };
  compliance: {
    baaSignedAt?: string;
    hipaaEnabled: boolean;
    soc2Enabled: boolean;
    dataResidency: "us" | "eu" | "global";
    retentionPolicyDays: number;
    lastAuditAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  tier: TenantConfig["tier"];
  features: TenantConfig["features"];
  security: TenantConfig["security"];
}

const tenants = new Map<string, TenantConfig>();
const domainToTenant = new Map<string, string>();

const defaultTenant: TenantConfig = {
  id: "default",
  name: "Default Tenant",
  status: "active",
  tier: "standard",
  features: {
    ssoEnabled: false,
    customBranding: false,
    dedicatedSupport: false,
    advancedAudit: false,
    dataRetentionDays: 365,
    maxUsers: 100,
    maxStorageGb: 10,
  },
  security: {
    requireMfa: false,
    passwordPolicy: "standard",
    sessionTimeoutMinutes: 30,
  },
  compliance: {
    hipaaEnabled: true,
    soc2Enabled: false,
    dataResidency: "us",
    retentionPolicyDays: 2555,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

tenants.set("default", defaultTenant);

export function createTenant(config: Partial<TenantConfig> & { name: string }): TenantConfig {
  const id = config.id || uuidv4();
  
  const tenant: TenantConfig = {
    id,
    name: config.name,
    domain: config.domain,
    status: config.status || "trial",
    tier: config.tier || "standard",
    features: {
      ssoEnabled: config.features?.ssoEnabled ?? false,
      customBranding: config.features?.customBranding ?? false,
      dedicatedSupport: config.features?.dedicatedSupport ?? false,
      advancedAudit: config.features?.advancedAudit ?? (config.tier === "enterprise" || config.tier === "white_glove"),
      dataRetentionDays: config.features?.dataRetentionDays ?? 365,
      maxUsers: config.features?.maxUsers ?? (config.tier === "enterprise" ? 1000 : 100),
      maxStorageGb: config.features?.maxStorageGb ?? (config.tier === "enterprise" ? 100 : 10),
    },
    security: {
      requireMfa: config.security?.requireMfa ?? (config.tier === "enterprise"),
      passwordPolicy: config.security?.passwordPolicy ?? "standard",
      sessionTimeoutMinutes: config.security?.sessionTimeoutMinutes ?? 30,
      ipWhitelist: config.security?.ipWhitelist,
      allowedOrigins: config.security?.allowedOrigins,
    },
    compliance: {
      baaSignedAt: config.compliance?.baaSignedAt,
      hipaaEnabled: config.compliance?.hipaaEnabled ?? true,
      soc2Enabled: config.compliance?.soc2Enabled ?? false,
      dataResidency: config.compliance?.dataResidency ?? "us",
      retentionPolicyDays: config.compliance?.retentionPolicyDays ?? 2555,
      lastAuditAt: config.compliance?.lastAuditAt,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tenants.set(id, tenant);
  
  if (config.domain) {
    domainToTenant.set(config.domain, id);
  }

  console.log(`[TenantIsolation] Created tenant: ${tenant.name} (${id})`);
  return tenant;
}

export function getTenant(tenantId: string): TenantConfig | undefined {
  return tenants.get(tenantId);
}

export function getTenantByDomain(domain: string): TenantConfig | undefined {
  const tenantId = domainToTenant.get(domain);
  return tenantId ? tenants.get(tenantId) : undefined;
}

export function updateTenant(tenantId: string, updates: Partial<TenantConfig>): TenantConfig | null {
  const tenant = tenants.get(tenantId);
  if (!tenant) return null;

  const updated: TenantConfig = {
    ...tenant,
    ...updates,
    features: { ...tenant.features, ...updates.features },
    security: { ...tenant.security, ...updates.security },
    compliance: { ...tenant.compliance, ...updates.compliance },
    updatedAt: new Date().toISOString(),
  };

  tenants.set(tenantId, updated);
  return updated;
}

export function listTenants(): TenantConfig[] {
  return Array.from(tenants.values());
}

export function resolveTenantId(req: Request): string {
  const headerTenantId = req.headers["x-tenant-id"] as string;
  if (headerTenantId && tenants.has(headerTenantId)) {
    return headerTenantId;
  }

  const host = req.headers.host || "";
  const domain = host.split(":")[0];
  const domainTenantId = domainToTenant.get(domain);
  if (domainTenantId) {
    return domainTenantId;
  }

  const user = req.user as { tenantId?: string } | undefined;
  if (user?.tenantId && tenants.has(user.tenantId)) {
    return user.tenantId;
  }

  return "default";
}

export const tenantIsolationMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const tenantId = resolveTenantId(req);
  const tenant = tenants.get(tenantId);

  if (!tenant) {
    res.status(403).json({
      success: false,
      error: "Invalid tenant",
    });
    return;
  }

  if (tenant.status === "suspended") {
    res.status(403).json({
      success: false,
      error: "Tenant account is suspended",
    });
    return;
  }

  (req as any).tenantContext = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tier: tenant.tier,
    features: tenant.features,
    security: tenant.security,
  };

  res.setHeader("X-Tenant-ID", tenantId);

  next();
};

export function requireTenantFeature(feature: keyof TenantConfig["features"]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = (req as any).tenantContext as TenantContext | undefined;

    if (!context) {
      res.status(500).json({
        success: false,
        error: "Tenant context not available",
      });
      return;
    }

    const featureValue = context.features[feature];
    if (typeof featureValue === "boolean" && !featureValue) {
      res.status(403).json({
        success: false,
        error: `Feature '${feature}' is not available for your plan`,
        upgradeRequired: true,
      });
      return;
    }

    next();
  };
}

export function requireTier(minTier: "standard" | "enterprise" | "white_glove"): RequestHandler {
  const tierOrder = { standard: 1, enterprise: 2, white_glove: 3 };

  return (req: Request, res: Response, next: NextFunction): void => {
    const context = (req as any).tenantContext as TenantContext | undefined;

    if (!context) {
      res.status(500).json({
        success: false,
        error: "Tenant context not available",
      });
      return;
    }

    if (tierOrder[context.tier] < tierOrder[minTier]) {
      res.status(403).json({
        success: false,
        error: `This feature requires ${minTier} tier or higher`,
        currentTier: context.tier,
        requiredTier: minTier,
        upgradeRequired: true,
      });
      return;
    }

    next();
  };
}

export function enforceTenantMfa(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = (req as any).tenantContext as TenantContext | undefined;
    const user = req.user as { mfaVerified?: boolean } | undefined;

    if (!context) {
      next();
      return;
    }

    if (context.security.requireMfa && !user?.mfaVerified) {
      res.status(403).json({
        success: false,
        error: "MFA verification required",
        mfaRequired: true,
      });
      return;
    }

    next();
  };
}

export function enforceTenantIpWhitelist(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = (req as any).tenantContext as TenantContext | undefined;

    if (!context || !context.security.ipWhitelist?.length) {
      next();
      return;
    }

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
                     req.socket.remoteAddress || "";

    if (!context.security.ipWhitelist.includes(clientIp)) {
      console.log(`[TenantIsolation] IP ${clientIp} not in whitelist for tenant ${context.tenantId}`);
      res.status(403).json({
        success: false,
        error: "Access denied from this IP address",
      });
      return;
    }

    next();
  };
}

export function getTenantContext(req: Request): TenantContext | undefined {
  return (req as any).tenantContext;
}

export function scopeQueryToTenant<T extends { tenantId?: string }>(
  items: T[],
  tenantId: string
): T[] {
  return items.filter(item => item.tenantId === tenantId || item.tenantId === undefined);
}

export function addTenantScope<T extends object>(item: T, tenantId: string): T & { tenantId: string } {
  return { ...item, tenantId };
}

export function getTenantStats(): {
  totalTenants: number;
  byStatus: Record<string, number>;
  byTier: Record<string, number>;
  activeUsers: number;
} {
  const byStatus: Record<string, number> = { active: 0, suspended: 0, trial: 0 };
  const byTier: Record<string, number> = { standard: 0, enterprise: 0, white_glove: 0 };

  for (const tenant of tenants.values()) {
    byStatus[tenant.status]++;
    byTier[tenant.tier]++;
  }

  return {
    totalTenants: tenants.size,
    byStatus,
    byTier,
    activeUsers: 0,
  };
}
