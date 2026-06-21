import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  fhirExternalAPIGateway,
  type FHIRVersion,
  type FHIROperation,
  type GatewayRequest,
  type AuthContext,
} from "./services/fhir-external-api-gateway";
import { UserRole } from "./services/rbac-service";

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  clientId: z.string().min(1),
  clientSecret: z.string().min(8),
  redirectUris: z.array(z.string().url()),
  allowedScopes: z.array(z.string()),
  allowedResourceTypes: z.array(z.string()),
  fhirVersions: z.array(z.enum(["R4", "R5"])),
  isActive: z.boolean().default(true),
  rateLimits: z.object({
    requestsPerMinute: z.number().min(1).max(1000),
    requestsPerHour: z.number().min(1).max(10000),
    requestsPerDay: z.number().min(1).max(100000),
  }),
  customProfiles: z.array(z.string()).optional(),
});

const profileSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  version: z.string().min(1),
  fhirVersion: z.enum(["R4", "R5"]),
  resourceType: z.string().min(1),
  constraints: z.array(z.object({
    id: z.string(),
    path: z.string(),
    severity: z.enum(["error", "warning"]),
    human: z.string(),
    expression: z.string().optional(),
    xpath: z.string().optional(),
  })),
  extensions: z.array(z.object({
    url: z.string(),
    path: z.string(),
    valueType: z.string(),
    isRequired: z.boolean(),
  })),
  isActive: z.boolean().default(true),
});

function parseAuthContext(req: Request): AuthContext {
  const authHeader = req.headers.authorization || "";
  const scopes = (req.headers["x-oauth-scopes"] as string || "patient/*.read").split(" ");
  
  return {
    userId: (req as any).user?.id || "anonymous",
    userRole: ((req as any).user?.role as UserRole) || "patient",
    clientId: req.headers["x-client-id"] as string || "unknown",
    scopes,
    patientContext: req.headers["x-patient-context"] as string,
    sessionId: req.headers["x-session-id"] as string,
  };
}

function parseFhirVersion(req: Request): FHIRVersion {
  const acceptHeader = req.headers.accept || "";
  const versionParam = req.params.version?.toUpperCase();
  
  if (versionParam === "R5" || acceptHeader.includes("fhirVersion=5.0")) {
    return "R5";
  }
  return "R4";
}

function parseOperation(req: Request): FHIROperation {
  const method = req.method.toUpperCase();
  const { resourceId, version } = req.params;
  const path = req.path;

  if (path.includes("/metadata") || path.includes("/$metadata")) {
    return "capabilities";
  }
  if (path.includes("/_history")) {
    return "history";
  }
  if (version && resourceId) {
    return "vread";
  }

  switch (method) {
    case "GET":
      return resourceId ? "read" : "search";
    case "POST":
      if (path.includes("/_search")) return "search";
      if (path.includes("/$")) return "batch";
      return "create";
    case "PUT":
      return "update";
    case "PATCH":
      return "patch";
    case "DELETE":
      return "delete";
    default:
      return "read";
  }
}

router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const stats = fhirExternalAPIGateway.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

router.get("/clients", async (req: Request, res: Response) => {
  try {
    const clients = fhirExternalAPIGateway.getClients().map(c => ({
      ...c,
      clientSecretHash: undefined,
    }));
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: "Failed to get clients" });
  }
});

router.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const client = fhirExternalAPIGateway.getClient(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json({ ...client, clientSecretHash: undefined });
  } catch (error) {
    res.status(500).json({ error: "Failed to get client" });
  }
});

router.post("/clients", async (req: Request, res: Response) => {
  try {
    const validation = clientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid client data", details: validation.error.issues });
    }
    
    const client = fhirExternalAPIGateway.createClient(validation.data);
    res.status(201).json({ ...client, clientSecretHash: undefined });
  } catch (error) {
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.patch("/clients/:id", async (req: Request, res: Response) => {
  try {
    const client = fhirExternalAPIGateway.updateClient(req.params.id, req.body);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json({ ...client, clientSecretHash: undefined });
  } catch (error) {
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.delete("/clients/:id", async (req: Request, res: Response) => {
  try {
    const deleted = fhirExternalAPIGateway.deleteClient(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete client" });
  }
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const profiles = fhirExternalAPIGateway.getCustomProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Failed to get profiles" });
  }
});

router.get("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = fhirExternalAPIGateway.getCustomProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid profile data", details: validation.error.issues });
    }
    
    const profile = fhirExternalAPIGateway.createCustomProfile(validation.data);
    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to create profile" });
  }
});

router.get("/resource-types", async (req: Request, res: Response) => {
  try {
    const resourceTypes = fhirExternalAPIGateway.getSupportedResourceTypes();
    res.json(resourceTypes);
  } catch (error) {
    res.status(500).json({ error: "Failed to get resource types" });
  }
});

router.get("/:version/metadata", async (req: Request, res: Response) => {
  try {
    const fhirVersion = parseFhirVersion(req);
    const authContext = parseAuthContext(req);

    const gatewayRequest: GatewayRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      clientId: authContext.clientId,
      authContext,
      fhirVersion,
      operation: "capabilities",
      resourceType: "CapabilityStatement",
      headers: req.headers as Record<string, string>,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      timestamp: new Date().toISOString(),
    };

    const response = await fhirExternalAPIGateway.processRequest(gatewayRequest);
    
    res.status(response.statusCode);
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.setHeader("Content-Type", "application/fhir+json");
    res.json(response.body);
  } catch (error) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "fatal", code: "exception", diagnostics: "Internal server error" }],
    });
  }
});

async function handleFhirRequest(req: Request, res: Response) {
  try {
    const fhirVersion = parseFhirVersion(req);
    const operation = parseOperation(req);
    const authContext = parseAuthContext(req);
    const { resourceType, resourceId, versionId } = req.params;

    const gatewayRequest: GatewayRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      clientId: authContext.clientId,
      authContext,
      fhirVersion,
      operation,
      resourceType: resourceType || "Unknown",
      resourceId,
      versionId,
      queryParams: req.query as Record<string, string | string[]>,
      body: req.body,
      headers: req.headers as Record<string, string>,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      timestamp: new Date().toISOString(),
    };

    const response = await fhirExternalAPIGateway.processRequest(gatewayRequest);
    
    res.status(response.statusCode);
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.setHeader("Content-Type", "application/fhir+json");
    
    if (response.statusCode === 204) {
      res.send();
    } else {
      res.json(response.body);
    }
  } catch (error) {
    console.error("[FHIR Gateway] Request error:", error);
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "fatal", code: "exception", diagnostics: "Internal server error" }],
    });
  }
}

router.get("/:version/:resourceType", handleFhirRequest);
router.get("/:version/:resourceType/:resourceId", handleFhirRequest);
router.get("/:version/:resourceType/:resourceId/_history", handleFhirRequest);
router.get("/:version/:resourceType/:resourceId/_history/:versionId", handleFhirRequest);

router.post("/:version/:resourceType", handleFhirRequest);
router.post("/:version/:resourceType/_search", handleFhirRequest);

router.put("/:version/:resourceType/:resourceId", handleFhirRequest);

router.patch("/:version/:resourceType/:resourceId", handleFhirRequest);

router.delete("/:version/:resourceType/:resourceId", handleFhirRequest);

export default router;
