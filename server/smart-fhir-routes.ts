import type { Express, Request } from "express";
import { promises as dnsPromises } from "dns";
import { smartAppLaunchService } from "./services/smart-app-launch";
import { fhirResourceMapper } from "./services/fhir-resource-mapper";
import { fhirOutboundAPI } from "./services/fhir-outbound-api";
import { externalFhirConnector } from "./services/external-fhir-connector";
import { requirePhiAccess } from "./middleware/require-phi-access";

interface AuthRequest extends Request {
  user?: {
    claims?: {
      sub: string;
      email?: string;
    };
  };
}

function getAuthenticatedUserId(req: AuthRequest): string {
  const sub = req.user?.claims?.sub;
  if (!sub) {
    throw new Error("Authenticated principal missing from request");
  }
  return sub;
}

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToNumber(ip);
  const blocked: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["240.0.0.0", 4],
    ["255.255.255.255", 32],
  ];
  for (const [base, prefix] of blocked) {
    const mask = prefix === 32 ? 0xFFFFFFFF : (~0 << (32 - prefix)) >>> 0;
    if ((n & mask) === (ipv4ToNumber(base) & mask)) return true;
  }
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("::ffff:")) {
    const v4part = normalized.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4part)) return isBlockedIPv4(v4part);
    const hex = v4part.replace(/:/g, "");
    if (/^[0-9a-f]{8}$/.test(hex)) {
      const asIp = [0, 2, 4, 6].map(i => parseInt(hex.slice(i, i + 2), 16)).join(".");
      return isBlockedIPv4(asIp);
    }
  }
  return false;
}

async function validateDiscoveryUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL format";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Only https and http URLs are permitted for FHIR discovery";
  }

  if (parsed.username || parsed.password) {
    return "Discovery URL must not contain credentials";
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedIPv4(hostname)) {
      return "Discovery URL targets a restricted IP address";
    }
    return null;
  }

  if (hostname.includes(":")) {
    if (isBlockedIPv6(hostname)) {
      return "Discovery URL targets a restricted IPv6 address";
    }
    return null;
  }

  let v4Addresses: string[] = [];
  let v6Addresses: string[] = [];
  try {
    [v4Addresses, v6Addresses] = await Promise.all([
      dnsPromises.resolve4(hostname).catch(() => [] as string[]),
      dnsPromises.resolve6(hostname).catch(() => [] as string[]),
    ]);
  } catch {
    return "Unable to resolve discovery URL hostname";
  }

  const allAddresses = [...v4Addresses, ...v6Addresses];
  if (allAddresses.length === 0) {
    return "Unable to resolve discovery URL hostname";
  }

  for (const addr of v4Addresses) {
    if (isBlockedIPv4(addr)) {
      return "Discovery URL resolves to a restricted internal address";
    }
  }
  for (const addr of v6Addresses) {
    if (isBlockedIPv6(addr)) {
      return "Discovery URL resolves to a restricted internal address";
    }
  }

  return null;
}

export function registerSmartFhirRoutes(app: Express) {
  app.get("/api/smart/discovery/:encodedUrl", requirePhiAccess, async (req, res) => {
    try {
      const fhirBaseUrl = decodeURIComponent(req.params.encodedUrl);

      const ssrfError = await validateDiscoveryUrl(fhirBaseUrl);
      if (ssrfError) {
        return res.status(400).json({ success: false, message: ssrfError });
      }

      const config = await smartAppLaunchService.discoverConfiguration(fhirBaseUrl);
      
      if (!config) {
        return res.status(404).json({ 
          success: false, 
          message: "SMART configuration not found for this FHIR server" 
        });
      }

      res.json({ success: true, configuration: config });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Discovery failed" 
      });
    }
  });

  app.post("/api/smart/register", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { clientId, clientSecret, redirectUri, scope, fhirBaseUrl, authorizationEndpoint, tokenEndpoint } = req.body;

      if (!clientId || !redirectUri || !scope || !fhirBaseUrl || !authorizationEndpoint || !tokenEndpoint) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: clientId, redirectUri, scope, fhirBaseUrl, authorizationEndpoint, tokenEndpoint" 
        });
      }

      const ownerId = getAuthenticatedUserId(req);
      const fullConfig = await smartAppLaunchService.registerApp({
        clientId,
        clientSecret,
        redirectUri,
        scope,
        fhirBaseUrl,
        authorizationEndpoint,
        tokenEndpoint,
        ownerId,
      });

      const { clientSecret: _secret, ...safeConfig } = fullConfig;
      res.json({ success: true, config: safeConfig });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Registration failed" 
      });
    }
  });

  app.get("/api/smart/configs", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const ownerId = getAuthenticatedUserId(req);
      const configs = smartAppLaunchService.getAllConfigsForOwner(ownerId);
      res.json({ success: true, configs });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get configs" 
      });
    }
  });

  app.post("/api/smart/authorize/:configId", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { configId } = req.params;
      const { launchContext } = req.body;
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(500).json({ success: false, message: "Authentication principal missing" });
      }

      const result = smartAppLaunchService.initiateAuthorization(configId, userId, launchContext);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Authorization initiation failed" 
      });
    }
  });

  app.post("/api/smart/callback", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { code, state } = req.body;

      if (!code || !state) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing code or state parameter" 
        });
      }

      const ownerId = getAuthenticatedUserId(req);
      const result = await smartAppLaunchService.exchangeCodeForToken(code, state, ownerId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Token exchange failed" 
      });
    }
  });

  app.post("/api/smart/refresh/:sessionId", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const callerId = getAuthenticatedUserId(req);
      const session = await smartAppLaunchService.refreshToken(sessionId, callerId);
      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Token refresh failed" 
      });
    }
  });

  app.get("/api/smart/sessions", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const ownerId = getAuthenticatedUserId(req);
      const sessions = smartAppLaunchService.getActiveSessionsForOwner(ownerId);
      const sanitizedSessions = sessions.map(s => ({
        ...s,
        accessToken: "***",
        refreshToken: s.refreshToken ? "***" : undefined,
        ownerId: undefined,
      }));
      res.json({ success: true, sessions: sanitizedSessions });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get sessions" 
      });
    }
  });

  app.delete("/api/smart/sessions/:sessionId", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const callerId = getAuthenticatedUserId(req);
      const revoked = smartAppLaunchService.revokeSession(sessionId, callerId);
      res.json({ success: revoked, message: revoked ? "Session revoked" : "Session not found or not owned by caller" });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to revoke session" 
      });
    }
  });

  app.post("/api/smart/fhir/:sessionId/:resourcePath(*)", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { sessionId, resourcePath } = req.params;
      const callerId = getAuthenticatedUserId(req);
      const result = await smartAppLaunchService.makeFHIRRequest(
        sessionId,
        resourcePath,
        "POST",
        req.body,
        callerId
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "FHIR request failed" 
      });
    }
  });

  app.get("/api/smart/fhir/:sessionId/:resourcePath(*)", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { sessionId, resourcePath } = req.params;
      const callerId = getAuthenticatedUserId(req);
      const result = await smartAppLaunchService.makeFHIRRequest(sessionId, resourcePath, "GET", undefined, callerId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "FHIR request failed" 
      });
    }
  });

  app.get("/api/smart/scopes", async (_req, res) => {
    try {
      const scopes = smartAppLaunchService.getSupportedScopes();
      const usCoreScopes = smartAppLaunchService.getUSCoreScopes();
      res.json({ success: true, scopes, usCoreScopes });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get scopes" 
      });
    }
  });

  app.post("/api/smart/generate-scope", async (req, res) => {
    try {
      const { resources, includeWrite, launchType } = req.body;
      
      const scope = launchType === "ehr"
        ? smartAppLaunchService.generateEHRLaunchScope(resources, includeWrite)
        : smartAppLaunchService.generateStandaloneScope(resources, includeWrite);
      
      res.json({ success: true, scope });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to generate scope" 
      });
    }
  });

  app.get("/api/fhir/mapping-rules", async (_req, res) => {
    try {
      const rules = fhirResourceMapper.getMappingRules();
      res.json({ success: true, rules });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get mapping rules" 
      });
    }
  });

  app.get("/api/fhir/mapping-rules/:resourceType", async (req, res) => {
    try {
      const { resourceType } = req.params;
      const rule = fhirResourceMapper.getMappingRuleByResourceType(resourceType);
      
      if (!rule) {
        return res.status(404).json({ 
          success: false, 
          message: `No mapping rule found for ${resourceType}` 
        });
      }

      res.json({ success: true, rule });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get mapping rule" 
      });
    }
  });

  app.post("/api/fhir/mapping-rules", requirePhiAccess, async (req, res) => {
    try {
      const rule = fhirResourceMapper.addCustomMappingRule(req.body);
      res.json({ success: true, rule });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to add mapping rule" 
      });
    }
  });

  app.post("/api/fhir/map-resource", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { resource, serverId } = req.body;
      const userId = getAuthenticatedUserId(req);

      if (!resource || !serverId) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing resource or serverId" 
        });
      }

      const entity = fhirResourceMapper.mapResource(resource, serverId, userId);
      
      if (!entity) {
        return res.status(404).json({ 
          success: false, 
          message: "No mapping rule found for this resource type" 
        });
      }

      res.json({ success: true, entity });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to map resource" 
      });
    }
  });

  app.post("/api/fhir/import-bundle", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { bundle, serverId } = req.body;
      const userId = getAuthenticatedUserId(req);

      if (!bundle || !serverId) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing bundle or serverId" 
        });
      }

      const result = await fhirResourceMapper.importBundle(bundle, serverId, userId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to import bundle" 
      });
    }
  });

  app.get("/api/fhir/mapped-entities", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { entityType, serverId, hasErrors } = req.query;
      const userId = getAuthenticatedUserId(req);
      
      const entities = fhirResourceMapper.getMappedEntities({
        userId,
        entityType: entityType as string,
        serverId: serverId as string,
        hasErrors: hasErrors === "true" ? true : hasErrors === "false" ? false : undefined,
      });

      res.json({ success: true, entities, total: entities.length });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get mapped entities" 
      });
    }
  });

  app.get("/api/fhir/import-results", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const results = fhirResourceMapper.getImportResults(userId);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get import results" 
      });
    }
  });

  app.get("/api/fhir/import-results/:id", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      const result = fhirResourceMapper.getImportResult(id, userId);
      
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: "Import result not found" 
        });
      }

      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get import result" 
      });
    }
  });

  app.get("/api/fhir/supported-resource-types", async (_req, res) => {
    try {
      const resourceTypes = fhirResourceMapper.getSupportedResourceTypes();
      res.json({ success: true, resourceTypes });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get supported resource types" 
      });
    }
  });

  app.post("/api/fhir/outbound/register-server", requirePhiAccess, async (req, res) => {
    try {
      const { serverId, baseUrl, authMethod, credentials } = req.body;

      if (!serverId || !baseUrl || !authMethod) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: serverId, baseUrl, authMethod" 
        });
      }

      const ownerId = getAuthenticatedUserId(req as AuthRequest);
      fhirOutboundAPI.registerServer(serverId, baseUrl, authMethod, credentials, ownerId);
      res.json({ success: true, message: "Server registered for outbound operations" });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to register server" 
      });
    }
  });

  app.post("/api/fhir/outbound/validate", async (req, res) => {
    try {
      const { resource } = req.body;

      if (!resource) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing resource" 
        });
      }

      const validation = fhirOutboundAPI.validateResource(resource);
      res.json({ success: true, validation });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Validation failed" 
      });
    }
  });

  app.post("/api/fhir/outbound/create", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { serverId, resource, enforceUSCore = true } = req.body;
      const userId = getAuthenticatedUserId(req);

      if (!serverId || !resource) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing serverId or resource" 
        });
      }

      const result = await fhirOutboundAPI.createResource(serverId, resource, userId, enforceUSCore);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Create failed" 
      });
    }
  });

  app.post("/api/fhir/outbound/update", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { serverId, resource, enforceUSCore = true } = req.body;
      const userId = getAuthenticatedUserId(req);

      if (!serverId || !resource) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing serverId or resource" 
        });
      }

      const result = await fhirOutboundAPI.updateResource(serverId, resource, userId, enforceUSCore);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Update failed" 
      });
    }
  });

  app.post("/api/fhir/outbound/transaction", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { serverId, bundle, enforceUSCore = true } = req.body;
      const userId = getAuthenticatedUserId(req);

      if (!serverId || !bundle) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing serverId or bundle" 
        });
      }

      const result = await fhirOutboundAPI.pushTransaction(serverId, bundle, userId, enforceUSCore);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Transaction failed" 
      });
    }
  });

  app.post("/api/fhir/outbound/vital-sign", async (req, res) => {
    try {
      const { vitalType, patientReference, value, unit, effectiveDateTime, additionalData } = req.body;

      if (!vitalType || !patientReference || value === undefined || !unit || !effectiveDateTime) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: vitalType, patientReference, value, unit, effectiveDateTime" 
        });
      }

      const observation = fhirOutboundAPI.createVitalSignObservation(
        vitalType,
        patientReference,
        value,
        unit,
        effectiveDateTime,
        additionalData
      );

      res.json({ success: true, observation });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to create vital sign" 
      });
    }
  });

  app.post("/api/fhir/outbound/care-plan-progress", async (req, res) => {
    try {
      const { carePlanId, patientReference, status, activities, notes } = req.body;

      if (!carePlanId || !patientReference || !status || !activities) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: carePlanId, patientReference, status, activities" 
        });
      }

      const carePlan = fhirOutboundAPI.createCarePlanProgress(
        carePlanId,
        patientReference,
        status,
        activities,
        notes
      );

      res.json({ success: true, carePlan });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to create care plan progress" 
      });
    }
  });

  app.get("/api/fhir/outbound/requests", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { serverId, status, resourceType } = req.query;
      const ownerId = getAuthenticatedUserId(req);
      
      const requests = fhirOutboundAPI.getOutboundRequestsForOwner(ownerId, {
        serverId: serverId as string,
        status: status as string,
        resourceType: resourceType as string,
      });

      res.json({ success: true, requests, total: requests.length });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get outbound requests" 
      });
    }
  });

  app.get("/api/fhir/outbound/requests/:id", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const ownerId = getAuthenticatedUserId(req);
      const request = fhirOutboundAPI.getOutboundRequestForOwner(id, ownerId);
      
      if (!request) {
        return res.status(404).json({ 
          success: false, 
          message: "Outbound request not found" 
        });
      }

      res.json({ success: true, request });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get outbound request" 
      });
    }
  });

  app.get("/api/fhir/outbound/transactions", requirePhiAccess, async (req: AuthRequest, res) => {
    try {
      const ownerId = getAuthenticatedUserId(req);
      const results = fhirOutboundAPI.getTransactionResultsForOwner(ownerId);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get transaction results" 
      });
    }
  });

  app.get("/api/fhir/outbound/profiles", async (_req, res) => {
    try {
      const profiles = fhirOutboundAPI.getSupportedProfiles();
      const vitalSignProfiles = fhirOutboundAPI.getVitalSignProfiles();
      res.json({ success: true, profiles, vitalSignProfiles });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get profiles" 
      });
    }
  });

  console.log("[Routes] SMART App Launch routes registered at /api/smart/*");
  console.log("[Routes] FHIR Resource Mapping routes registered at /api/fhir/mapping-rules/*, /api/fhir/map-resource, /api/fhir/import-bundle, /api/fhir/mapped-entities");
  console.log("[Routes] FHIR Outbound API routes registered at /api/fhir/outbound/*");
}
