import { Express, Request, Response } from "express";
import { z } from "zod";
import {
  getExternalSystems,
  getExternalSystem,
  registerExternalSystem,
  startSyncJob,
  getSyncJob,
  getSyncJobs,
  getSyncConflicts,
  resolveConflict,
  getSyncAuditLog,
  getSyncMetrics,
} from "./services/fhir-sync-service";
import {
  getResourceDetail,
  getAllResources,
  getResourceVersionHistory,
  getResourceAuditTrail,
  getResourcesByType,
} from "./services/fhir-resource-viewer-service";
import {
  getCodeSystemInfo,
  getCodeSystemById,
  lookupCode,
  translateCode,
  getMappings,
  addMapping,
  searchCodes,
  getAllMappingsForCode,
} from "./services/code-system-mapper-service";
import type { CodeSystemType } from "./services/code-system-mapper-service";
import type { SyncDirection } from "./services/fhir-sync-service";

const startSyncSchema = z.object({
  externalSystemId: z.string(),
  direction: z.enum(["inbound", "outbound", "bidirectional"]),
  resourceTypes: z.array(z.string()).min(1),
});

const resolveConflictSchema = z.object({
  conflictId: z.string(),
  resolution: z.enum(["keep_local", "keep_remote", "merge", "skip"]),
});

const translateCodeSchema = z.object({
  sourceSystem: z.enum(["SNOMED_CT", "LOINC", "ICD10_CM", "RXNORM"]),
  sourceCode: z.string(),
  targetSystem: z.enum(["SNOMED_CT", "LOINC", "ICD10_CM", "RXNORM"]),
});

const addMappingSchema = z.object({
  sourceSystem: z.enum(["SNOMED_CT", "LOINC", "ICD10_CM", "RXNORM"]),
  sourceCode: z.string(),
  sourceDisplay: z.string(),
  targetSystem: z.enum(["SNOMED_CT", "LOINC", "ICD10_CM", "RXNORM"]),
  targetCode: z.string(),
  targetDisplay: z.string(),
  equivalence: z.enum(["equivalent", "equal", "wider", "narrower", "inexact", "unmatched"]),
  comments: z.string().optional(),
  verified: z.boolean().default(false),
});

export function registerFHIRResourceManagementRoutes(app: Express): void {
  app.get("/api/fhir-sync/systems", async (_req: Request, res: Response) => {
    try {
      const systems = getExternalSystems();
      res.json({ systems });
    } catch (error) {
      console.error("[FHIRSync] Get systems error:", error);
      res.status(500).json({ error: "Failed to get external systems" });
    }
  });

  app.get("/api/fhir-sync/systems/:id", async (req: Request, res: Response) => {
    try {
      const system = getExternalSystem(req.params.id);
      if (!system) {
        res.status(404).json({ error: "System not found" });
        return;
      }
      res.json({ system });
    } catch (error) {
      console.error("[FHIRSync] Get system error:", error);
      res.status(500).json({ error: "Failed to get external system" });
    }
  });

  app.post("/api/fhir-sync/start", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = startSyncSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { externalSystemId, direction, resourceTypes } = validation.data;
      const job = await startSyncJob(
        externalSystemId,
        direction as SyncDirection,
        resourceTypes,
        userId,
        ipAddress,
        userAgent
      );

      res.status(201).json({ success: true, job });
    } catch (error) {
      console.error("[FHIRSync] Start sync error:", error);
      res.status(500).json({ error: "Failed to start sync job" });
    }
  });

  app.get("/api/fhir-sync/jobs", async (req: Request, res: Response) => {
    try {
      const systemId = req.query.systemId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const jobs = getSyncJobs(systemId, limit);
      res.json({ jobs });
    } catch (error) {
      console.error("[FHIRSync] Get jobs error:", error);
      res.status(500).json({ error: "Failed to get sync jobs" });
    }
  });

  app.get("/api/fhir-sync/jobs/:id", async (req: Request, res: Response) => {
    try {
      const job = getSyncJob(req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json({ job });
    } catch (error) {
      console.error("[FHIRSync] Get job error:", error);
      res.status(500).json({ error: "Failed to get sync job" });
    }
  });

  app.get("/api/fhir-sync/conflicts", async (req: Request, res: Response) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      const conflicts = getSyncConflicts(jobId);
      res.json({ conflicts });
    } catch (error) {
      console.error("[FHIRSync] Get conflicts error:", error);
      res.status(500).json({ error: "Failed to get conflicts" });
    }
  });

  app.post("/api/fhir-sync/conflicts/resolve", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = resolveConflictSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { conflictId, resolution } = validation.data;
      const resolved = await resolveConflict(conflictId, resolution, userId, ipAddress, userAgent);
      res.json({ success: true, conflict: resolved });
    } catch (error) {
      console.error("[FHIRSync] Resolve conflict error:", error);
      res.status(500).json({ error: "Failed to resolve conflict" });
    }
  });

  app.get("/api/fhir-sync/audit", async (req: Request, res: Response) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const auditLog = getSyncAuditLog(jobId, limit);
      res.json({ auditLog });
    } catch (error) {
      console.error("[FHIRSync] Get audit error:", error);
      res.status(500).json({ error: "Failed to get audit log" });
    }
  });

  app.get("/api/fhir-sync/metrics", async (_req: Request, res: Response) => {
    try {
      const metrics = getSyncMetrics();
      res.json({ metrics });
    } catch (error) {
      console.error("[FHIRSync] Get metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  app.get("/api/fhir-resources", async (_req: Request, res: Response) => {
    try {
      const resources = getAllResources();
      res.json({ resources });
    } catch (error) {
      console.error("[FHIRResourceViewer] Get resources error:", error);
      res.status(500).json({ error: "Failed to get resources" });
    }
  });

  app.get("/api/fhir-resources/by-type/:type", async (req: Request, res: Response) => {
    try {
      const resources = getResourcesByType(req.params.type);
      res.json({ resources });
    } catch (error) {
      console.error("[FHIRResourceViewer] Get by type error:", error);
      res.status(500).json({ error: "Failed to get resources" });
    }
  });

  app.get("/api/fhir-resources/:id", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const userRole = "user";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const resource = await getResourceDetail(req.params.id, userId, userRole, ipAddress, userAgent);
      if (!resource) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }
      res.json({ resource });
    } catch (error) {
      console.error("[FHIRResourceViewer] Get resource error:", error);
      res.status(500).json({ error: "Failed to get resource" });
    }
  });

  app.get("/api/fhir-resources/:id/versions", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const userRole = "user";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const versions = await getResourceVersionHistory(req.params.id, userId, userRole, ipAddress, userAgent);
      res.json({ versions });
    } catch (error) {
      console.error("[FHIRResourceViewer] Get versions error:", error);
      res.status(500).json({ error: "Failed to get version history" });
    }
  });

  app.get("/api/fhir-resources/:id/audit", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const auditTrail = getResourceAuditTrail(req.params.id, limit);
      res.json({ auditTrail });
    } catch (error) {
      console.error("[FHIRResourceViewer] Get audit error:", error);
      res.status(500).json({ error: "Failed to get audit trail" });
    }
  });

  app.get("/api/code-mapping/systems", async (_req: Request, res: Response) => {
    try {
      const systems = getCodeSystemInfo();
      res.json({ systems });
    } catch (error) {
      console.error("[CodeMapping] Get systems error:", error);
      res.status(500).json({ error: "Failed to get code systems" });
    }
  });

  app.get("/api/code-mapping/systems/:id", async (req: Request, res: Response) => {
    try {
      const system = getCodeSystemById(req.params.id as CodeSystemType);
      if (!system) {
        res.status(404).json({ error: "Code system not found" });
        return;
      }
      res.json({ system });
    } catch (error) {
      console.error("[CodeMapping] Get system error:", error);
      res.status(500).json({ error: "Failed to get code system" });
    }
  });

  app.get("/api/code-mapping/lookup/:system/:code", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await lookupCode(
        req.params.system as CodeSystemType,
        req.params.code,
        userId,
        ipAddress,
        userAgent
      );

      if (!result) {
        res.status(404).json({ error: "Code not found" });
        return;
      }
      res.json({ code: result });
    } catch (error) {
      console.error("[CodeMapping] Lookup error:", error);
      res.status(500).json({ error: "Failed to lookup code" });
    }
  });

  app.post("/api/code-mapping/translate", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = translateCodeSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const result = await translateCode(validation.data, userId, ipAddress, userAgent);
      res.json({ translation: result });
    } catch (error) {
      console.error("[CodeMapping] Translate error:", error);
      res.status(500).json({ error: "Failed to translate code" });
    }
  });

  app.get("/api/code-mapping/mappings", async (req: Request, res: Response) => {
    try {
      const sourceSystem = req.query.sourceSystem as CodeSystemType | undefined;
      const targetSystem = req.query.targetSystem as CodeSystemType | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const mappings = getMappings(sourceSystem, targetSystem, limit);
      res.json({ mappings });
    } catch (error) {
      console.error("[CodeMapping] Get mappings error:", error);
      res.status(500).json({ error: "Failed to get mappings" });
    }
  });

  app.post("/api/code-mapping/mappings", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = addMappingSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const mapping = await addMapping(validation.data, userId, ipAddress, userAgent);
      res.status(201).json({ success: true, mapping });
    } catch (error) {
      console.error("[CodeMapping] Add mapping error:", error);
      res.status(500).json({ error: "Failed to add mapping" });
    }
  });

  app.get("/api/code-mapping/search/:system", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string || "";
      const limit = parseInt(req.query.limit as string) || 20;
      const results = searchCodes(req.params.system as CodeSystemType, query, limit);
      res.json({ results });
    } catch (error) {
      console.error("[CodeMapping] Search error:", error);
      res.status(500).json({ error: "Failed to search codes" });
    }
  });

  app.get("/api/code-mapping/all-mappings/:system/:code", async (req: Request, res: Response) => {
    try {
      const mappings = getAllMappingsForCode(req.params.system as CodeSystemType, req.params.code);
      res.json({ mappings });
    } catch (error) {
      console.error("[CodeMapping] Get all mappings error:", error);
      res.status(500).json({ error: "Failed to get mappings" });
    }
  });

  console.log("[Routes] FHIR Resource Management routes registered");
  console.log("[Routes] - Sync: /api/fhir-sync/*");
  console.log("[Routes] - Resources: /api/fhir-resources/*");
  console.log("[Routes] - Code Mapping: /api/code-mapping/*");
}
