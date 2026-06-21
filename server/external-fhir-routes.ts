import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { externalFhirConnector, FhirValidationError } from "./services/external-fhir-connector";
import { isAuthenticated } from "./replit_integrations/auth";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][ExternalFHIRRoutes] ${timestamp} - ${action}`, JSON.stringify(details));
}

function getAuthenticatedUserId(req: Request): string | null {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  const userId = user?.claims?.sub;
  return userId && userId.length > 0 ? userId : null;
}

function requireAuthenticatedUser(req: Request, res: Response, next: () => void): void {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }
  next();
}

const addServerSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  fhirVersion: z.enum(["R4", "STU3", "DSTU2"]),
  authMethod: z.enum(["none", "basic", "bearer", "smart_on_fhir", "oauth2_client_credentials"]),
  isTestServer: z.boolean().optional(),
});

const searchParamsSchema = z.object({
  resourceType: z.string().min(1),
  params: z.record(z.string()).optional().default({}),
  includeCount: z.boolean().optional(),
  pageSize: z.number().min(1).max(100).optional(),
  page: z.number().min(1).optional(),
});

const importDataSchema = z.object({
  patientId: z.string().min(1),
  resourceTypes: z.array(z.string()).min(1),
});

router.get("/servers", isAuthenticated, requireAuthenticatedUser, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const servers = externalFhirConnector.getServers(userId);
    const sanitizedServers = servers.map(s => ({
      id: s.id, name: s.name, baseUrl: s.baseUrl, fhirVersion: s.fhirVersion,
      authMethod: s.authMethod, status: s.status, lastConnectedAt: s.lastConnectedAt,
      lastSyncAt: s.lastSyncAt, supportedResources: s.supportedResources,
      isTestServer: s.isTestServer, errorMessage: s.errorMessage,
    }));

    res.json({ success: true, data: sanitizedServers });
  } catch (error) {
    console.error("[ExternalFHIR] Get servers error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve servers" });
  }
});

router.get("/servers/:serverId", isAuthenticated, requireAuthenticatedUser, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId } = req.params;
    const server = externalFhirConnector.getServer(serverId, userId);
    if (!server) return res.status(404).json({ success: false, error: "Server not found" });

    res.json({
      success: true,
      data: {
        id: server.id, name: server.name, baseUrl: server.baseUrl, fhirVersion: server.fhirVersion,
        authMethod: server.authMethod, status: server.status, lastConnectedAt: server.lastConnectedAt,
        supportedResources: server.supportedResources, metadata: server.metadata, isTestServer: server.isTestServer,
      },
    });
  } catch (error) {
    console.error("[ExternalFHIR] Get server error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve server" });
  }
});

router.post("/servers", isAuthenticated, requireAuthenticatedUser, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const validation = addServerSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error.errors[0].message });

    const server = await externalFhirConnector.addServer(validation.data, userId);
    logHipaaAudit("SERVER_ADDED", { user: hashIdentifier(userId), serverId: server.id, serverName: server.name });
    res.status(201).json({ success: true, data: server });
  } catch (error) {
    console.error("[ExternalFHIR] Add server error:", error);
    if (error instanceof FhirValidationError) return res.status(400).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: "Failed to add server" });
  }
});

router.post("/servers/:serverId/test", isAuthenticated, requireAuthenticatedUser, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId } = req.params;
    const server = externalFhirConnector.getServer(serverId, userId);
    if (!server) return res.status(404).json({ success: false, error: "Server not found" });

    logHipaaAudit("CONNECTION_TEST_INITIATED", { user: hashIdentifier(userId), serverId });
    const result = await externalFhirConnector.testConnection(serverId, userId);

    res.json({
      success: result.success,
      message: result.message,
      metadata: result.metadata ? {
        fhirVersion: result.metadata.fhirVersion, status: result.metadata.status,
        software: result.metadata.software, resourceCount: result.metadata.rest?.[0]?.resource?.length || 0,
      } : undefined,
    });
  } catch (error) {
    console.error("[ExternalFHIR] Test connection error:", error);
    res.status(500).json({ success: false, error: "Connection test failed" });
  }
});

router.delete("/servers/:serverId", isAuthenticated, requireAuthenticatedUser, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId } = req.params;
    const server = externalFhirConnector.getServer(serverId, userId);
    if (!server) return res.status(404).json({ success: false, error: "Server not found" });

    const removed = externalFhirConnector.removeServer(serverId, userId);
    if (!removed) return res.status(404).json({ success: false, error: "Server not found or cannot be removed" });

    logHipaaAudit("SERVER_REMOVED", { user: hashIdentifier(userId), serverId });
    res.json({ success: true, message: "Server removed" });
  } catch (error) {
    console.error("[ExternalFHIR] Remove server error:", error);
    res.status(500).json({ success: false, error: "Failed to remove server" });
  }
});

router.post("/servers/:serverId/search", isAuthenticated, requireAuthenticatedUser, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId } = req.params;
    const server = externalFhirConnector.getServer(serverId, userId);
    if (!server) return res.status(404).json({ success: false, error: "Server not found" });

    const validation = searchParamsSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error.errors[0].message });

    const bundle = await externalFhirConnector.searchResources(serverId, validation.data, userId);
    res.json({
      success: true,
      data: { total: bundle.total, entries: bundle.entry?.map(e => ({ fullUrl: e.fullUrl, resource: e.resource })) || [], links: bundle.link },
    });
  } catch (error) {
    console.error("[ExternalFHIR] Search error:", error);
    if (error instanceof FhirValidationError) return res.status(400).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: "Search failed" });
  }
});

router.get("/servers/:serverId/:resourceType/:resourceId", isAuthenticated, requireAuthenticatedUser, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId, resourceType, resourceId } = req.params;
    const server = externalFhirConnector.getServer(serverId, userId);
    if (!server) return res.status(404).json({ success: false, error: "Server not found" });

    const resource = await externalFhirConnector.getResource(serverId, resourceType, resourceId, userId);
    res.json({ success: true, data: resource });
  } catch (error) {
    console.error("[ExternalFHIR] Get resource error:", error);
    if (error instanceof FhirValidationError) return res.status(400).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: "Failed to get resource" });
  }
});

router.post("/servers/:serverId/import", isAuthenticated, requireAuthenticatedUser, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId } = req.params;
    const server = externalFhirConnector.getServer(serverId, userId);
    if (!server) return res.status(404).json({ success: false, error: "Server not found" });

    const validation = importDataSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error.errors[0].message });

    const exchange = await externalFhirConnector.importPatientData(serverId, validation.data.patientId, validation.data.resourceTypes, userId);
    res.json({ success: true, data: exchange });
  } catch (error) {
    console.error("[ExternalFHIR] Import error:", error);
    if (error instanceof FhirValidationError) return res.status(400).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: "Import failed" });
  }
});

router.get("/exchanges", isAuthenticated, requireAuthenticatedUser, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { serverId } = req.query;
    const exchanges = externalFhirConnector.getExchanges(userId, serverId as string | undefined);
    res.json({ success: true, data: exchanges });
  } catch (error) {
    console.error("[ExternalFHIR] Get exchanges error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve exchanges" });
  }
});

router.get("/exchanges/:exchangeId", isAuthenticated, requireAuthenticatedUser, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { exchangeId } = req.params;
    const exchange = externalFhirConnector.getExchange(exchangeId, userId);
    if (!exchange) return res.status(404).json({ success: false, error: "Exchange not found" });

    res.json({ success: true, data: exchange });
  } catch (error) {
    console.error("[ExternalFHIR] Get exchange error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve exchange" });
  }
});

router.get("/search-params/:resourceType", isAuthenticated, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const { resourceType } = req.params;
    const params = externalFhirConnector.getSupportedSearchParams(resourceType);
    res.json({ success: true, data: params });
  } catch (error) {
    console.error("[ExternalFHIR] Get search params error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve search parameters" });
  }
});

router.get("/supported-resources", isAuthenticated, (_req: Request, res: Response) => {
  try {
    const resources = [
      { type: "Patient", description: "Patient demographics and identifiers", usCore: true },
      { type: "Observation", description: "Lab results, vital signs, and clinical observations", usCore: true },
      { type: "Condition", description: "Problems, diagnoses, and health concerns", usCore: true },
      { type: "MedicationRequest", description: "Medication orders and prescriptions", usCore: true },
      { type: "AllergyIntolerance", description: "Allergy and intolerance records", usCore: true },
      { type: "Procedure", description: "Surgical and therapeutic procedures", usCore: true },
      { type: "Immunization", description: "Vaccination history", usCore: true },
      { type: "DiagnosticReport", description: "Laboratory and imaging reports", usCore: true },
      { type: "CarePlan", description: "Treatment and care plans", usCore: true },
      { type: "Goal", description: "Patient health goals", usCore: true },
      { type: "Encounter", description: "Healthcare visits and episodes", usCore: true },
      { type: "DocumentReference", description: "Clinical documents", usCore: true },
      { type: "Medication", description: "Medication information", usCore: false },
      { type: "Practitioner", description: "Healthcare provider information", usCore: true },
      { type: "Organization", description: "Healthcare organization information", usCore: true },
      { type: "Location", description: "Physical locations", usCore: true },
    ];
    res.json({ success: true, data: resources });
  } catch (error) {
    console.error("[ExternalFHIR] Get supported resources error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve supported resources" });
  }
});

console.log("[Routes] External FHIR Connector routes registered at /api/fhir/external");

export default router;
