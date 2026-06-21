import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiFhirHarmonizationEngine } from "./services/ai-fhir-harmonization-engine";

const PHI_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  mrn: /\bMRN[:\s]*\d+\b/gi,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
};

function sanitizePHI(text: string): string {
  let sanitized = text;
  sanitized = sanitized.replace(PHI_PATTERNS.ssn, "[SSN_REDACTED]");
  sanitized = sanitized.replace(PHI_PATTERNS.email, "[EMAIL_REDACTED]");
  sanitized = sanitized.replace(PHI_PATTERNS.phone, "[PHONE_REDACTED]");
  sanitized = sanitized.replace(PHI_PATTERNS.mrn, "[MRN_REDACTED]");
  sanitized = sanitized.replace(PHI_PATTERNS.uuid, "[UUID_REDACTED]");
  return sanitized;
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

const analyzeRequestSchema = z.object({
  systemIds: z.array(z.string()).optional(),
  resourceTypes: z.array(z.string()).optional(),
});

const mappingRequestSchema = z.object({
  systemId: z.string().min(1, "systemId is required"),
  systemName: z.string().min(1, "systemName is required"),
  systemType: z.enum(["ehr", "lab", "pharmacy", "payer", "hie", "registry", "other"]),
  resourceType: z.string().min(1, "resourceType is required"),
  fieldMappings: z.array(z.object({
    id: z.string().optional(),
    sourcePath: z.string(),
    sourceType: z.string(),
    targetPath: z.string(),
    targetType: z.string(),
    cardinality: z.string().optional(),
    transform: z.string().optional(),
    required: z.boolean().optional(),
  })).optional().default([]),
  codeSystemMappings: z.array(z.object({
    id: z.string().optional(),
    sourceCodeSystem: z.string(),
    sourceCodeSystemUrl: z.string().optional(),
    targetCodeSystem: z.string(),
    targetCodeSystemUrl: z.string().optional(),
    mappings: z.array(z.object({
      sourceCode: z.string(),
      sourceDisplay: z.string().optional(),
      targetCode: z.string(),
      targetDisplay: z.string().optional(),
      equivalence: z.string().optional(),
    })).optional(),
  })).optional().default([]),
});

const mappingUpdateSchema = z.object({
  systemName: z.string().min(1).optional(),
  systemType: z.enum(["ehr", "lab", "pharmacy", "payer", "hie", "registry", "other"]).optional(),
  resourceType: z.string().min(1).optional(),
  fieldMappings: z.array(z.object({
    id: z.string().optional(),
    sourcePath: z.string(),
    sourceType: z.string(),
    targetPath: z.string(),
    targetType: z.string(),
    cardinality: z.string().optional(),
    transform: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
  codeSystemMappings: z.array(z.object({
    id: z.string().optional(),
    sourceCodeSystem: z.string(),
    sourceCodeSystemUrl: z.string().optional(),
    targetCodeSystem: z.string(),
    targetCodeSystemUrl: z.string().optional(),
    mappings: z.array(z.object({
      sourceCode: z.string(),
      sourceDisplay: z.string().optional(),
      targetCode: z.string(),
      targetDisplay: z.string().optional(),
      equivalence: z.string().optional(),
    })).optional(),
  })).optional(),
});

const discrepancyStatusSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved", "ignored"]),
  resolution: z.string().optional(),
});

const configUpdateSchema = z.object({
  autoDetectDiscrepancies: z.boolean().optional(),
  autoSuggestRules: z.boolean().optional(),
  discrepancyThreshold: z.enum(["low", "medium", "high", "critical"]).optional(),
  preferredCodeSystems: z.array(z.string()).optional(),
  preferredDateFormat: z.string().optional(),
  enableAIAnalysis: z.boolean().optional(),
  notifyOnCritical: z.boolean().optional(),
});

interface AuditLogEntry {
  timestamp: string;
  userId: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestPath: string;
  requestMethod: string;
  responseStatus: number;
  details?: string;
  ipAddress?: string;
}

const auditLogs: AuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 10000;

function logAuditEvent(entry: Omit<AuditLogEntry, "timestamp">): void {
  const fullEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  
  auditLogs.push(fullEntry);
  
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_AUDIT_LOGS);
  }
  
  console.log(
    `[AUDIT][Harmonization] ${entry.action} on ${entry.resourceType}${entry.resourceId ? `/${hashIdentifier(entry.resourceId)}` : ""} by user ${hashIdentifier(entry.userId)} - ${entry.responseStatus}`
  );
}

function getUserFromRequest(req: Request): { id: string; role: string } {
  const user = (req as any).user;
  return {
    id: user?.id || "anonymous",
    role: user?.role || "anonymous",
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function registerAIFHIRHarmonizationRoutes(router: Express): void {
  router.post("/api/harmonization/analyze", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    const clientIp = getClientIp(req);
    
    try {
      const validationResult = analyzeRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "analyze_validation_failed",
          resourceType: "HarmonizationAnalysis",
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 400,
          details: sanitizePHI(validationResult.error.message),
          ipAddress: clientIp,
        });
        return res.status(400).json({
          success: false,
          error: "Invalid request parameters",
          details: validationResult.error.issues,
        });
      }

      const { systemIds, resourceTypes } = validationResult.data;

      const analysis = await aiFhirHarmonizationEngine.runHarmonizationAnalysis(
        systemIds,
        resourceTypes
      );

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "run_harmonization_analysis",
        resourceType: "HarmonizationAnalysis",
        resourceId: analysis.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: `Analyzed ${analysis.analyzedSystems.length} systems, found ${analysis.summary.discrepanciesFound} discrepancies`,
        ipAddress: clientIp,
      });

      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      console.error("[Harmonization] Analysis error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "analyze_error",
        resourceType: "HarmonizationAnalysis",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: clientIp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to run harmonization analysis",
      });
    }
  });

  router.get("/api/harmonization/analyses", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const analyses = aiFhirHarmonizationEngine.listAnalyses();

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_analyses",
        resourceType: "HarmonizationAnalysis",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        analyses,
      });
    } catch (error) {
      console.error("[Harmonization] List analyses error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_analyses_error",
        resourceType: "HarmonizationAnalysis",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to list analyses",
      });
    }
  });

  router.get("/api/harmonization/analyses/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const analysis = aiFhirHarmonizationEngine.getAnalysis(id);

      if (!analysis) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "get_analysis_not_found",
          resourceType: "HarmonizationAnalysis",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Analysis not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_analysis",
        resourceType: "HarmonizationAnalysis",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      console.error("[Harmonization] Get analysis error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_analysis_error",
        resourceType: "HarmonizationAnalysis",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get analysis",
      });
    }
  });

  router.get("/api/harmonization/mappings", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { systemType, resourceType } = req.query;

      const mappings = aiFhirHarmonizationEngine.listSystemMappings({
        systemType: systemType as string | undefined,
        resourceType: resourceType as string | undefined,
      });

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_mappings",
        resourceType: "ExternalSystemMapping",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: `Retrieved ${mappings.length} mappings`,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        mappings,
      });
    } catch (error) {
      console.error("[Harmonization] List mappings error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_mappings_error",
        resourceType: "ExternalSystemMapping",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to list system mappings",
      });
    }
  });

  router.get("/api/harmonization/mappings/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const mapping = aiFhirHarmonizationEngine.getSystemMapping(id);

      if (!mapping) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "get_mapping_not_found",
          resourceType: "ExternalSystemMapping",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Mapping not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_mapping",
        resourceType: "ExternalSystemMapping",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        mapping,
      });
    } catch (error) {
      console.error("[Harmonization] Get mapping error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_mapping_error",
        resourceType: "ExternalSystemMapping",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get system mapping",
      });
    }
  });

  router.post("/api/harmonization/mappings", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    const clientIp = getClientIp(req);
    
    try {
      const validationResult = mappingRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "create_mapping_validation_failed",
          resourceType: "ExternalSystemMapping",
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 400,
          details: sanitizePHI(validationResult.error.message),
          ipAddress: clientIp,
        });
        return res.status(400).json({
          success: false,
          error: "Invalid mapping data",
          details: validationResult.error.issues,
        });
      }

      const data = validationResult.data;

      const mapping = aiFhirHarmonizationEngine.addSystemMapping({
        systemId: data.systemId,
        systemName: data.systemName,
        systemType: data.systemType,
        resourceType: data.resourceType,
        fieldMappings: data.fieldMappings as any,
        codeSystemMappings: data.codeSystemMappings as any,
      });

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "create_mapping",
        resourceType: "ExternalSystemMapping",
        resourceId: mapping.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 201,
        details: `Created mapping for ${data.systemName} - ${data.resourceType}`,
        ipAddress: clientIp,
      });

      res.status(201).json({
        success: true,
        mapping,
      });
    } catch (error) {
      console.error("[Harmonization] Add mapping error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "create_mapping_error",
        resourceType: "ExternalSystemMapping",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: clientIp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to add system mapping",
      });
    }
  });

  router.patch("/api/harmonization/mappings/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    const clientIp = getClientIp(req);
    
    try {
      const { id } = req.params;
      
      const validationResult = mappingUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "update_mapping_validation_failed",
          resourceType: "ExternalSystemMapping",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 400,
          details: sanitizePHI(validationResult.error.message),
          ipAddress: clientIp,
        });
        return res.status(400).json({
          success: false,
          error: "Invalid mapping update data",
          details: validationResult.error.issues,
        });
      }
      
      const mapping = aiFhirHarmonizationEngine.updateSystemMapping(id, validationResult.data);

      if (!mapping) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "update_mapping_not_found",
          resourceType: "ExternalSystemMapping",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: clientIp,
        });
        return res.status(404).json({
          success: false,
          error: "Mapping not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "update_mapping",
        resourceType: "ExternalSystemMapping",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: sanitizePHI(`Updated fields: ${Object.keys(validationResult.data).join(", ")}`),
        ipAddress: clientIp,
      });

      res.json({
        success: true,
        mapping,
      });
    } catch (error) {
      console.error("[Harmonization] Update mapping error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "update_mapping_error",
        resourceType: "ExternalSystemMapping",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: clientIp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update system mapping",
      });
    }
  });

  router.delete("/api/harmonization/mappings/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const deleted = aiFhirHarmonizationEngine.deleteSystemMapping(id);

      if (!deleted) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "delete_mapping_not_found",
          resourceType: "ExternalSystemMapping",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Mapping not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "delete_mapping",
        resourceType: "ExternalSystemMapping",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        message: "Mapping deleted",
      });
    } catch (error) {
      console.error("[Harmonization] Delete mapping error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "delete_mapping_error",
        resourceType: "ExternalSystemMapping",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to delete system mapping",
      });
    }
  });

  router.get("/api/harmonization/discrepancies/summary", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const summary = aiFhirHarmonizationEngine.getDiscrepancySummary();

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_discrepancy_summary",
        resourceType: "SemanticDiscrepancy",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error("[Harmonization] Get discrepancy summary error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_discrepancy_summary_error",
        resourceType: "SemanticDiscrepancy",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get discrepancy summary",
      });
    }
  });

  router.get("/api/harmonization/discrepancies", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { severity, type, status, resourceType } = req.query;

      const discrepancies = aiFhirHarmonizationEngine.listDiscrepancies({
        severity: severity as any,
        type: type as any,
        status: status as any,
        resourceType: resourceType as string | undefined,
      });

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_discrepancies",
        resourceType: "SemanticDiscrepancy",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: `Retrieved ${discrepancies.length} discrepancies`,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        discrepancies,
      });
    } catch (error) {
      console.error("[Harmonization] List discrepancies error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_discrepancies_error",
        resourceType: "SemanticDiscrepancy",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to list discrepancies",
      });
    }
  });

  router.get("/api/harmonization/discrepancies/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const discrepancy = aiFhirHarmonizationEngine.getDiscrepancy(id);

      if (!discrepancy) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "get_discrepancy_not_found",
          resourceType: "SemanticDiscrepancy",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Discrepancy not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_discrepancy",
        resourceType: "SemanticDiscrepancy",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        discrepancy,
      });
    } catch (error) {
      console.error("[Harmonization] Get discrepancy error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_discrepancy_error",
        resourceType: "SemanticDiscrepancy",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get discrepancy",
      });
    }
  });

  router.patch("/api/harmonization/discrepancies/:id/status", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    const clientIp = getClientIp(req);
    
    try {
      const { id } = req.params;
      
      const validationResult = discrepancyStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid status data",
          details: validationResult.error.issues,
        });
      }

      const { status, resolution } = validationResult.data;

      const discrepancy = aiFhirHarmonizationEngine.updateDiscrepancyStatus(
        id,
        status,
        resolution
      );

      if (!discrepancy) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "update_discrepancy_status_not_found",
          resourceType: "SemanticDiscrepancy",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: clientIp,
        });
        return res.status(404).json({
          success: false,
          error: "Discrepancy not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "update_discrepancy_status",
        resourceType: "SemanticDiscrepancy",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: `Status changed to ${status}`,
        ipAddress: clientIp,
      });

      res.json({
        success: true,
        discrepancy,
      });
    } catch (error) {
      console.error("[Harmonization] Update discrepancy status error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "update_discrepancy_status_error",
        resourceType: "SemanticDiscrepancy",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: clientIp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update discrepancy status",
      });
    }
  });

  router.get("/api/harmonization/rules", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { resourceType, isActive } = req.query;

      const rules = aiFhirHarmonizationEngine.listConsolidatedRules({
        resourceType: resourceType as string | undefined,
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      });

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_rules",
        resourceType: "ConsolidatedMappingRule",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: `Retrieved ${rules.length} rules`,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        rules,
      });
    } catch (error) {
      console.error("[Harmonization] List rules error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "list_rules_error",
        resourceType: "ConsolidatedMappingRule",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to list consolidated rules",
      });
    }
  });

  router.get("/api/harmonization/rules/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const rule = aiFhirHarmonizationEngine.getConsolidatedRule(id);

      if (!rule) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "get_rule_not_found",
          resourceType: "ConsolidatedMappingRule",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Rule not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_rule",
        resourceType: "ConsolidatedMappingRule",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        rule,
      });
    } catch (error) {
      console.error("[Harmonization] Get rule error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_rule_error",
        resourceType: "ConsolidatedMappingRule",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get consolidated rule",
      });
    }
  });

  router.post("/api/harmonization/rules/:id/activate", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const rule = aiFhirHarmonizationEngine.activateRule(id);

      if (!rule) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "activate_rule_not_found",
          resourceType: "ConsolidatedMappingRule",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Rule not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "activate_rule",
        resourceType: "ConsolidatedMappingRule",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        rule,
        message: "Rule activated",
      });
    } catch (error) {
      console.error("[Harmonization] Activate rule error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "activate_rule_error",
        resourceType: "ConsolidatedMappingRule",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to activate rule",
      });
    }
  });

  router.post("/api/harmonization/rules/:id/deactivate", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const rule = aiFhirHarmonizationEngine.deactivateRule(id);

      if (!rule) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "deactivate_rule_not_found",
          resourceType: "ConsolidatedMappingRule",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Rule not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "deactivate_rule",
        resourceType: "ConsolidatedMappingRule",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        rule,
        message: "Rule deactivated",
      });
    } catch (error) {
      console.error("[Harmonization] Deactivate rule error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "deactivate_rule_error",
        resourceType: "ConsolidatedMappingRule",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to deactivate rule",
      });
    }
  });

  router.delete("/api/harmonization/rules/:id", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { id } = req.params;
      const deleted = aiFhirHarmonizationEngine.deleteRule(id);

      if (!deleted) {
        logAuditEvent({
          userId: user.id,
          userRole: user.role,
          action: "delete_rule_not_found",
          resourceType: "ConsolidatedMappingRule",
          resourceId: id,
          requestPath: req.path,
          requestMethod: req.method,
          responseStatus: 404,
          ipAddress: getClientIp(req),
        });
        return res.status(404).json({
          success: false,
          error: "Rule not found",
        });
      }

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "delete_rule",
        resourceType: "ConsolidatedMappingRule",
        resourceId: id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        message: "Rule deleted",
      });
    } catch (error) {
      console.error("[Harmonization] Delete rule error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "delete_rule_error",
        resourceType: "ConsolidatedMappingRule",
        resourceId: req.params.id,
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to delete rule",
      });
    }
  });

  router.get("/api/harmonization/config", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const config = aiFhirHarmonizationEngine.getConfig();

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_config",
        resourceType: "HarmonizationConfig",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        config,
      });
    } catch (error) {
      console.error("[Harmonization] Get config error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_config_error",
        resourceType: "HarmonizationConfig",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get configuration",
      });
    }
  });

  router.patch("/api/harmonization/config", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    const clientIp = getClientIp(req);
    
    try {
      const validationResult = configUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid configuration data",
          details: validationResult.error.issues,
        });
      }

      const config = aiFhirHarmonizationEngine.updateConfig(validationResult.data);

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "update_config",
        resourceType: "HarmonizationConfig",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        details: `Updated config: ${Object.keys(validationResult.data).join(", ")}`,
        ipAddress: clientIp,
      });

      res.json({
        success: true,
        config,
      });
    } catch (error) {
      console.error("[Harmonization] Update config error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "update_config_error",
        resourceType: "HarmonizationConfig",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: clientIp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update configuration",
      });
    }
  });

  router.get("/api/harmonization/audit-logs", async (req: Request, res: Response) => {
    const user = getUserFromRequest(req);
    
    try {
      const { action, resourceType, limit: limitStr } = req.query;
      const limit = limitStr ? parseInt(limitStr as string, 10) : 100;
      
      let results = [...auditLogs].reverse();
      
      if (action) {
        results = results.filter(log => log.action === action);
      }
      if (resourceType) {
        results = results.filter(log => log.resourceType === resourceType);
      }
      
      results = results.slice(0, Math.min(limit, 1000));

      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "view_audit_logs",
        resourceType: "AuditLog",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        logs: results.map(log => ({
          ...log,
          userId: hashIdentifier(log.userId),
        })),
        total: auditLogs.length,
      });
    } catch (error) {
      console.error("[Harmonization] Get audit logs error:", error);
      logAuditEvent({
        userId: user.id,
        userRole: user.role,
        action: "get_audit_logs_error",
        resourceType: "AuditLog",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 500,
        details: sanitizePHI(String(error)),
        ipAddress: getClientIp(req),
      });
      res.status(500).json({
        success: false,
        error: "Failed to get audit logs",
      });
    }
  });

  console.log("[Routes] AI FHIR Harmonization routes registered at /api/harmonization/* with HIPAA audit logging");
}
