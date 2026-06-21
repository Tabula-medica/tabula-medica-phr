import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { 
  fhirGatewayService, 
  GatewayScope,
  validateDemographicsSchema,
  validateClinicalSummarySchema,
  validateOutreachStatusSchema,
} from "./services/fhir-gateway-service";
import { getAuditLogger } from "./services/integrations/factory";
import { requireRole } from "./rbac";
import { requireConsents } from "./consent/consent-enforcement";

const router = Router();

const createConnectionSchema = z.object({
  externalSystemId: z.string().min(1),
  name: z.string().min(1),
  fhirEndpoint: z.string().url(),
  authType: z.enum(["smart_on_fhir", "oauth2", "api_key", "basic"]),
  authConfig: z.object({
    type: z.string(),
    issuer: z.string().optional(),
    clientId: z.string(),
    redirectUri: z.string().optional(),
    authorizeEndpoint: z.string().optional(),
    tokenEndpoint: z.string().optional(),
    jwksUri: z.string().optional(),
    pkceRequired: z.boolean().optional(),
    scopes: z.array(z.string()).optional(),
    apiKeyHeader: z.string().optional(),
    apiKeyValue: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
  supportedExchangeTypes: z.array(z.enum(["demographics", "clinical_summary", "outreach_status", "medications", "observations", "conditions", "allergies"])),
  allowedScopes: z.array(z.string()),
  rateLimitConfig: z.object({
    requestsPerMinute: z.number().int().min(1).max(1000),
    requestsPerHour: z.number().int().min(1).max(10000),
    burstLimit: z.number().int().min(1).max(100),
  }),
  consentPolicyId: z.string().optional(),
});

const exchangeRequestSchema = z.object({
  patientId: z.string().min(1),
  consentVerified: z.boolean(),
  consentId: z.string().optional(),
});

const outreachPushSchema = z.object({
  patientId: z.string().min(1),
  consentVerified: z.boolean(),
  outreachData: z.object({
    resourceType: z.literal("Communication").or(z.literal("Task")),
    status: z.enum(["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"]),
    priority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
    subject: z.object({
      reference: z.string().optional(),
      display: z.string().optional(),
    }).optional(),
    sent: z.string().optional(),
    payload: z.array(z.object({
      contentString: z.string().optional(),
    })).optional(),
  }),
});

const demographicsPushSchema = z.object({
  consentVerified: z.boolean(),
  patientData: validateDemographicsSchema.extend({
    id: z.string().optional(),
  }),
});

function getRequestInfo(req: Request): { userId: string; ipAddress: string; userAgent: string } {
  const user = (req as any).user;
  return {
    userId: user?.id || "anonymous",
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
  };
}

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const connectionId = req.params.connectionId;
  if (!connectionId) {
    return next();
  }
  
  const connection = fhirGatewayService.getConnection(connectionId);
  if (!connection) {
    return next();
  }
  
  const now = Date.now();
  const rateLimitKey = `ratelimit:${connectionId}`;
  const burstKey = `burst:${connectionId}`;
  const rateLimitData = (req.app.locals[rateLimitKey] || { 
    minute: 0, 
    hour: 0, 
    lastMinuteReset: now, 
    lastHourReset: now 
  }) as {
    minute: number;
    hour: number;
    lastMinuteReset: number;
    lastHourReset: number;
  };
  
  const burstData = (req.app.locals[burstKey] || { 
    count: 0, 
    windowStart: now 
  }) as {
    count: number;
    windowStart: number;
  };
  
  if (now - rateLimitData.lastMinuteReset > 60000) {
    rateLimitData.minute = 0;
    rateLimitData.lastMinuteReset = now;
  }
  
  if (now - rateLimitData.lastHourReset > 3600000) {
    rateLimitData.hour = 0;
    rateLimitData.lastHourReset = now;
  }
  
  if (now - burstData.windowStart > 1000) {
    burstData.count = 0;
    burstData.windowStart = now;
  }
  
  if (burstData.count >= connection.rateLimitConfig.burstLimit) {
    res.setHeader("Retry-After", "1");
    return res.status(429).json({ 
      error: "Burst limit exceeded",
      retryAfterSeconds: 1,
      message: "Too many requests in quick succession. Please slow down."
    });
  }
  
  if (rateLimitData.minute >= connection.rateLimitConfig.requestsPerMinute) {
    const retryAfter = Math.ceil((60000 - (now - rateLimitData.lastMinuteReset)) / 1000);
    res.setHeader("Retry-After", retryAfter.toString());
    return res.status(429).json({ 
      error: "Rate limit exceeded",
      retryAfterSeconds: retryAfter,
      message: "Too many requests. Please try again later."
    });
  }
  
  if (rateLimitData.hour >= connection.rateLimitConfig.requestsPerHour) {
    const retryAfter = Math.ceil((3600000 - (now - rateLimitData.lastHourReset)) / 1000);
    res.setHeader("Retry-After", retryAfter.toString());
    return res.status(429).json({ 
      error: "Hourly rate limit exceeded",
      retryAfterSeconds: retryAfter,
      message: "Hourly rate limit exceeded. Please try again later."
    });
  }
  
  burstData.count++;
  rateLimitData.minute++;
  rateLimitData.hour++;
  req.app.locals[rateLimitKey] = rateLimitData;
  req.app.locals[burstKey] = burstData;
  
  next();
}

function scopeCheckMiddleware(requiredScopes: GatewayScope[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const connectionId = req.params.connectionId;
    if (connectionId) {
      const hasScopes = fhirGatewayService.hasRequiredScopes(connectionId, requiredScopes);
      if (!hasScopes) {
        return res.status(403).json({ 
          error: "Insufficient scopes", 
          required: requiredScopes,
          message: "The connection does not have the required authorization scopes for this operation"
        });
      }
    }
    next();
  };
}

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function logGatewayAudit(
  connectionId: string,
  exchangeType: string,
  direction: "inbound" | "outbound",
  success: boolean,
  userId: string,
  patientId: string | null,
  ipAddress: string,
  userAgent: string,
  details?: string
) {
  try {
    const auditLogger = getAuditLogger();
    const hashedPatientId = patientId ? hashIdentifier(patientId) : null;
    const hashedUserId = userId !== "anonymous" ? hashIdentifier(userId) : "anonymous";
    const hashedIp = ipAddress ? hashIdentifier(ipAddress) : "unknown";
    
    await auditLogger.logAuditEvent({
      eventType: `gateway_${direction}_${exchangeType}`,
      userId: hashedUserId,
      resourceType: "ExternalDataExchange",
      action: direction === "inbound" ? "read" : "create",
      details: JSON.stringify({
        connectionId,
        exchangeType,
        direction,
        success,
        patientIdHash: hashedPatientId,
        timestamp: new Date().toISOString(),
        ...(details ? { additionalDetails: details } : {}),
      }),
      ipAddress: hashedIp,
      userAgent: userAgent ? userAgent.substring(0, 50) : "unknown",
    });
    
    console.log(`[FHIR Gateway Audit] ${direction} ${exchangeType}: success=${success}, user=${hashedUserId}, patient=${hashedPatientId || "none"}`);
  } catch (err) {
    console.error("[FHIR Gateway] Audit logging error:", err);
  }
}

router.get("/connections", requireRole("provider", "admin"), async (req: Request, res: Response) => {
  try {
    const connections = fhirGatewayService.getConnections();
    
    const sanitizedConnections = connections.map(conn => ({
      id: conn.id,
      externalSystemId: conn.externalSystemId,
      name: conn.name,
      fhirEndpoint: conn.fhirEndpoint,
      authType: conn.authType,
      supportedExchangeTypes: conn.supportedExchangeTypes,
      allowedScopes: conn.allowedScopes,
      isActive: conn.isActive,
      hasToken: !!conn.tokenData,
      tokenValid: fhirGatewayService.isTokenValid(conn.id),
      lastActivityAt: conn.lastActivityAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));
    
    res.json({ connections: sanitizedConnections });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/connections/:connectionId", requireRole("provider", "admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const connection = fhirGatewayService.getConnection(connectionId);
    
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    const status = fhirGatewayService.getConnectionStatus(connectionId);
    
    res.json({
      id: connection.id,
      externalSystemId: connection.externalSystemId,
      name: connection.name,
      fhirEndpoint: connection.fhirEndpoint,
      authType: connection.authType,
      supportedExchangeTypes: connection.supportedExchangeTypes,
      allowedScopes: connection.allowedScopes,
      isActive: connection.isActive,
      rateLimitConfig: connection.rateLimitConfig,
      consentPolicyId: connection.consentPolicyId,
      status,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/connections", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const validationResult = createConnectionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: "Validation failed", details: validationResult.error.errors });
    }
    
    const { userId, ipAddress, userAgent } = getRequestInfo(req);
    
    const connection = await fhirGatewayService.createConnection(
      {
        ...validationResult.data,
        isActive: true,
        authConfig: validationResult.data.authConfig as any,
        allowedScopes: validationResult.data.allowedScopes as GatewayScope[],
      },
      userId,
      ipAddress,
      userAgent
    );
    
    res.status(201).json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        fhirEndpoint: connection.fhirEndpoint,
        isActive: connection.isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/connections/:connectionId", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId, ipAddress, userAgent } = getRequestInfo(req);
    
    const connection = await fhirGatewayService.updateConnection(
      connectionId,
      req.body,
      userId,
      ipAddress,
      userAgent
    );
    
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    res.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        isActive: connection.isActive,
        updatedAt: connection.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/connections/:connectionId/activate", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId, ipAddress, userAgent } = getRequestInfo(req);
    
    const connection = await fhirGatewayService.updateConnection(
      connectionId,
      { isActive: true },
      userId,
      ipAddress,
      userAgent
    );
    
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    res.json({ success: true, message: "Connection activated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/connections/:connectionId/deactivate", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId, ipAddress, userAgent } = getRequestInfo(req);
    
    const connection = await fhirGatewayService.updateConnection(
      connectionId,
      { isActive: false },
      userId,
      ipAddress,
      userAgent
    );
    
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    res.json({ success: true, message: "Connection deactivated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/auth/start/:connectionId", requireRole("provider", "admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    
    const result = fhirGatewayService.startSMARTAuth(connectionId);
    
    if (!result) {
      return res.status(400).json({ 
        error: "Cannot start authentication", 
        message: "Connection not found or does not support SMART on FHIR authentication" 
      });
    }
    
    res.json({
      authUrl: result.authUrl,
      state: result.state,
      message: "Redirect the user to authUrl to complete authentication",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/auth/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error: authError, error_description } = req.query;
    
    if (authError) {
      return res.status(400).json({ 
        error: "Authentication failed", 
        authError,
        description: error_description 
      });
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state parameter" });
    }
    
    const { userId, ipAddress, userAgent } = getRequestInfo(req);
    
    const result = await fhirGatewayService.handleAuthCallback(
      state as string,
      code as string,
      userId,
      ipAddress,
      userAgent
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      connectionId: result.connectionId,
      message: "Authentication successful. Connection is now authorized.",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/auth/refresh/:connectionId", requireRole("provider", "admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId, ipAddress, userAgent } = getRequestInfo(req);
    
    const success = await fhirGatewayService.refreshToken(connectionId, userId, ipAddress, userAgent);
    
    if (!success) {
      return res.status(400).json({ 
        error: "Token refresh failed", 
        message: "No refresh token available or connection not found" 
      });
    }
    
    res.json({ success: true, message: "Token refreshed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/connections/:connectionId/demographics/:patientId", 
  requireRole("provider", "admin", "patient"), 
  requireConsents,
  rateLimitMiddleware,
  scopeCheckMiddleware(["patient/*.read"]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId, patientId } = req.params;
      const { userId, ipAddress, userAgent } = getRequestInfo(req);
      
      const result = await fhirGatewayService.fetchDemographics(
        connectionId,
        patientId,
        userId,
        true,
        ipAddress,
        userAgent
      );
      
      await logGatewayAudit(connectionId, "demographics", "inbound", result.success, userId, patientId, ipAddress, userAgent);
      
      if (!result.success) {
        const statusCode = result.error?.includes("Rate limited") ? 429 : 
                          result.error?.includes("consent") ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }
      
      res.json({ success: true, data: result.data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/connections/:connectionId/demographics", 
  requireRole("provider", "admin"),
  requireConsents,
  rateLimitMiddleware,
  scopeCheckMiddleware(["patient/*.write"]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      
      const validationResult = demographicsPushSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Validation failed", details: validationResult.error.errors });
      }
      
      const { userId, ipAddress, userAgent } = getRequestInfo(req);
      const patientId = validationResult.data.patientData?.id || null;
      
      const result = await fhirGatewayService.pushDemographics(
        connectionId,
        validationResult.data.patientData as Record<string, unknown>,
        userId,
        true,
        ipAddress,
        userAgent
      );
      
      await logGatewayAudit(connectionId, "demographics", "outbound", result.success, userId, patientId, ipAddress, userAgent);
      
      if (!result.success) {
        const statusCode = result.error?.includes("Rate limited") ? 429 : 
                          result.error?.includes("consent") ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }
      
      res.status(201).json({ success: true, resourceId: result.resourceId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/connections/:connectionId/clinical-summary/:patientId",
  requireRole("provider", "admin", "patient"),
  requireConsents,
  rateLimitMiddleware,
  scopeCheckMiddleware(["patient/*.read"]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId, patientId } = req.params;
      const { userId, ipAddress, userAgent } = getRequestInfo(req);
      
      const result = await fhirGatewayService.fetchClinicalSummary(
        connectionId,
        patientId,
        userId,
        true,
        ipAddress,
        userAgent
      );
      
      await logGatewayAudit(connectionId, "clinical_summary", "inbound", result.success, userId, patientId, ipAddress, userAgent);
      
      if (!result.success) {
        const statusCode = result.error?.includes("Rate limited") ? 429 : 
                          result.error?.includes("consent") ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }
      
      res.json({ success: true, data: result.data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/connections/:connectionId/outreach-status",
  requireRole("provider", "admin"),
  requireConsents,
  rateLimitMiddleware,
  scopeCheckMiddleware(["patient/*.write"]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      
      const validationResult = outreachPushSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Validation failed", details: validationResult.error.errors });
      }
      
      const { userId, ipAddress, userAgent } = getRequestInfo(req);
      const patientId = validationResult.data.patientId;
      
      const result = await fhirGatewayService.pushOutreachStatus(
        connectionId,
        patientId,
        validationResult.data.outreachData as Record<string, unknown>,
        userId,
        true,
        ipAddress,
        userAgent
      );
      
      await logGatewayAudit(connectionId, "outreach_status", "outbound", result.success, userId, patientId, ipAddress, userAgent);
      
      if (!result.success) {
        const statusCode = result.error?.includes("Rate limited") ? 429 : 
                          result.error?.includes("consent") ? 403 : 400;
        return res.status(statusCode).json({ error: result.error });
      }
      
      res.status(201).json({ success: true, resourceId: result.resourceId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/stats", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const stats = fhirGatewayService.getGatewayStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/connections/:connectionId/status", requireRole("provider", "admin"), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const status = fhirGatewayService.getConnectionStatus(connectionId);
    
    if (!status) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/supported-exchange-types", async (req: Request, res: Response) => {
  res.json({
    exchangeTypes: [
      { type: "demographics", description: "Patient demographic information (FHIR Patient resource)", direction: "bidirectional" },
      { type: "clinical_summary", description: "Clinical summary documents (FHIR Composition/Bundle)", direction: "inbound" },
      { type: "outreach_status", description: "Patient outreach and communication status (FHIR Communication/Task)", direction: "outbound" },
      { type: "medications", description: "Medication information (FHIR MedicationRequest)", direction: "inbound" },
      { type: "observations", description: "Clinical observations and vitals (FHIR Observation)", direction: "inbound" },
      { type: "conditions", description: "Patient conditions and diagnoses (FHIR Condition)", direction: "inbound" },
      { type: "allergies", description: "Allergy and intolerance information (FHIR AllergyIntolerance)", direction: "inbound" },
    ],
    authTypes: [
      { type: "smart_on_fhir", description: "SMART on FHIR OAuth 2.0 + PKCE (recommended for EHR systems)" },
      { type: "oauth2", description: "Standard OAuth 2.0 authorization" },
      { type: "api_key", description: "API key authentication" },
      { type: "basic", description: "Basic HTTP authentication" },
    ],
  });
});

export default router;
