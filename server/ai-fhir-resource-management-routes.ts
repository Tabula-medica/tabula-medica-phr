import { Express, Request, Response } from "express";
import { z } from "zod";
import { aiFHIRResourceManagementService } from "./services/ai-fhir-resource-management-service";
import { comprehensiveAuditTrailService } from "./services/comprehensive-audit-trail-service";

const generateResourceSchema = z.object({
  naturalLanguageInput: z.string().min(10, "Description must be at least 10 characters"),
  resourceType: z.string().optional(),
});

const createLinkSchema = z.object({
  sourceResourceId: z.string(),
  targetResourceId: z.string(),
  linkType: z.enum(["reference", "subject", "performer", "encounter", "author", "basedOn", "partOf"]),
});

const suggestStructureSchema = z.object({
  resourceType: z.string(),
  useCase: z.string().min(5, "Use case must be at least 5 characters"),
});

function getUserId(req: Request): string {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  return user?.claims?.sub || "anonymous";
}

async function logRouteAudit(
  userId: string,
  action: string,
  resourceType: string,
  success: boolean,
  metadata: Record<string, unknown>,
  req: Request
): Promise<void> {
  await comprehensiveAuditTrailService.logAuditEntry(userId, {
    who: {
      userId,
      userRole: "user",
      ipAddress: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      sessionId: `session-${Date.now()}`,
    },
    what: {
      category: "ai_prediction",
      action: success ? "read" : "error",
      resourceType,
      description: `AI FHIR Resource Management: ${action}`,
    },
    why: {
      reason: "AI FHIR resource management operation",
      automatedAction: false,
    },
    result: {
      success,
      errorMessage: !success && metadata.error ? String(metadata.error) : undefined,
    },
    context: {
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    },
    severity: success ? "info" : "warning",
    tags: ["ai", "fhir", "resource-management"],
    phiAccessed: true,
    complianceFlags: ["HIPAA", "NO-CDS"],
    metadata,
  });
}

export function registerAIFHIRResourceManagementRoutes(app: Express): void {
  app.get("/api/fhir-resource-management/metadata", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const metadata = aiFHIRResourceManagementService.getMetadata();
      await logRouteAudit(userId, "get_metadata", "Metadata", true, {}, req);
      res.json(metadata);
    } catch (error) {
      await logRouteAudit(userId, "get_metadata", "Metadata", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Metadata error:", error);
      res.status(500).json({ error: "Failed to get metadata" });
    }
  });

  app.get("/api/fhir-resource-management/resources", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const resources = aiFHIRResourceManagementService.getGeneratedResources();
      await logRouteAudit(userId, "list_resources", "FHIRResource", true, { count: resources.length }, req);
      res.json({ resources });
    } catch (error) {
      await logRouteAudit(userId, "list_resources", "FHIRResource", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Get resources error:", error);
      res.status(500).json({ error: "Failed to get generated resources" });
    }
  });

  app.post("/api/fhir-resource-management/generate", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const validation = generateResourceSchema.safeParse(req.body);
      if (!validation.success) {
        await logRouteAudit(userId, "generate_resource", "FHIRResource", false, { error: "Validation failed" }, req);
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { naturalLanguageInput, resourceType } = validation.data;
      const result = await aiFHIRResourceManagementService.generateResourceFromNaturalLanguage(
        userId,
        naturalLanguageInput,
        resourceType
      );

      res.json(result);
    } catch (error) {
      await logRouteAudit(userId, "generate_resource", "FHIRResource", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Generate resource error:", error);
      res.status(500).json({ 
        error: "Failed to generate resource",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/fhir-resource-management/links", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const links = aiFHIRResourceManagementService.getResourceLinks();
      await logRouteAudit(userId, "list_links", "ResourceLink", true, { count: links.length }, req);
      res.json({ links });
    } catch (error) {
      await logRouteAudit(userId, "list_links", "ResourceLink", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Get links error:", error);
      res.status(500).json({ error: "Failed to get resource links" });
    }
  });

  app.post("/api/fhir-resource-management/links", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const validation = createLinkSchema.safeParse(req.body);
      if (!validation.success) {
        await logRouteAudit(userId, "create_link", "ResourceLink", false, { error: "Validation failed" }, req);
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { sourceResourceId, targetResourceId, linkType } = validation.data;
      const result = await aiFHIRResourceManagementService.createManualLink(
        userId,
        sourceResourceId,
        targetResourceId,
        linkType
      );

      res.json(result);
    } catch (error) {
      await logRouteAudit(userId, "create_link", "ResourceLink", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Create link error:", error);
      res.status(500).json({ 
        error: "Failed to create link",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/fhir-resource-management/links/:id", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const deleted = aiFHIRResourceManagementService.deleteLink(userId, req.params.id);
      if (!deleted) {
        await logRouteAudit(userId, "delete_link", "ResourceLink", false, { error: "Not found" }, req);
        res.status(404).json({ error: "Link not found" });
        return;
      }

      await logRouteAudit(userId, "delete_link", "ResourceLink", true, { linkId: req.params.id }, req);
      res.json({ success: true });
    } catch (error) {
      await logRouteAudit(userId, "delete_link", "ResourceLink", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Delete link error:", error);
      res.status(500).json({ error: "Failed to delete link" });
    }
  });

  app.get("/api/fhir-resource-management/suggestions", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const suggestions = aiFHIRResourceManagementService.getStructureSuggestions();
      await logRouteAudit(userId, "list_suggestions", "StructureSuggestion", true, { count: suggestions.length }, req);
      res.json({ suggestions });
    } catch (error) {
      await logRouteAudit(userId, "list_suggestions", "StructureSuggestion", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Get suggestions error:", error);
      res.status(500).json({ error: "Failed to get structure suggestions" });
    }
  });

  app.post("/api/fhir-resource-management/suggest-structure", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const validation = suggestStructureSchema.safeParse(req.body);
      if (!validation.success) {
        await logRouteAudit(userId, "suggest_structure", "StructureSuggestion", false, { error: "Validation failed" }, req);
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { resourceType, useCase } = validation.data;
      const result = await aiFHIRResourceManagementService.suggestStructure(
        userId,
        resourceType,
        useCase
      );

      res.json(result);
    } catch (error) {
      await logRouteAudit(userId, "suggest_structure", "StructureSuggestion", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Suggest structure error:", error);
      res.status(500).json({ 
        error: "Failed to suggest structure",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/fhir-resource-management/resources/:id", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const deleted = aiFHIRResourceManagementService.deleteGeneratedResource(userId, req.params.id);
      if (!deleted) {
        await logRouteAudit(userId, "delete_resource", "FHIRResource", false, { error: "Not found" }, req);
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      await logRouteAudit(userId, "delete_resource", "FHIRResource", true, { resourceId: req.params.id }, req);
      res.json({ success: true });
    } catch (error) {
      await logRouteAudit(userId, "delete_resource", "FHIRResource", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRResourceManagement] Delete resource error:", error);
      res.status(500).json({ error: "Failed to delete resource" });
    }
  });

  console.log("[Routes] AI FHIR Resource Management routes registered at /api/fhir-resource-management/*");
}
