import { Router, Request, Response } from "express";
import {
  createIntegration,
  generateMappingRules,
  transformData,
  detectConflicts,
  resolveConflict,
  generateQualityInsights,
  getIntegration,
  getAllIntegrations,
  deleteIntegration,
  getMappingRuleLibrary,
  SourceDataFormat,
  ConflictResolution,
} from "./services/ai-fhir-data-integration";

const router = Router();

router.post("/integrations", async (req: Request, res: Response) => {
  try {
    const { name, description, sourceSystem, sourceFormat } = req.body;

    if (!name || !sourceSystem || !sourceFormat) {
      return res.status(400).json({ error: "Name, source system, and source format are required" });
    }

    const integration = await createIntegration(
      name,
      description || "",
      sourceSystem,
      sourceFormat as SourceDataFormat
    );

    res.status(201).json(integration);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Create integration error:", error);
    res.status(500).json({ error: "Failed to create integration" });
  }
});

router.get("/integrations", async (_req: Request, res: Response) => {
  try {
    const integrations = getAllIntegrations();
    res.json(integrations);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get integrations error:", error);
    res.status(500).json({ error: "Failed to get integrations" });
  }
});

router.get("/integrations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = getIntegration(id);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    res.json(integration);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get integration error:", error);
    res.status(500).json({ error: "Failed to get integration" });
  }
});

router.delete("/integrations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = deleteIntegration(id);

    if (!deleted) {
      return res.status(404).json({ error: "Integration not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Delete integration error:", error);
    res.status(500).json({ error: "Failed to delete integration" });
  }
});

router.post("/integrations/:id/generate-mappings", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sampleData } = req.body;

    if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
      return res.status(400).json({ error: "Sample data array is required" });
    }

    const rules = await generateMappingRules(id, sampleData);
    res.json({ rules, count: rules.length });
  } catch (error: any) {
    console.error("[FHIRIntegrationRoutes] Generate mappings error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Integration not found" });
    }
    res.status(500).json({ error: "Failed to generate mapping rules" });
  }
});

router.post("/integrations/:id/transform", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format, sourceSystem, records, metadata } = req.body;

    if (!format || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: "Format and records array are required" });
    }

    const transformed = await transformData(id, {
      format,
      sourceSystem: sourceSystem || "unknown",
      records,
      metadata,
    });

    const integration = getIntegration(id);

    res.json({
      transformedResources: transformed,
      statistics: integration?.statistics,
      status: integration?.status,
    });
  } catch (error: any) {
    console.error("[FHIRIntegrationRoutes] Transform error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Integration not found" });
    }
    res.status(500).json({ error: "Failed to transform data" });
  }
});

router.post("/integrations/:id/detect-conflicts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conflicts = await detectConflicts(id);

    res.json({ conflicts, count: conflicts.length });
  } catch (error: any) {
    console.error("[FHIRIntegrationRoutes] Detect conflicts error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Integration not found" });
    }
    res.status(500).json({ error: "Failed to detect conflicts" });
  }
});

router.get("/integrations/:id/conflicts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = getIntegration(id);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    res.json(integration.conflicts);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get conflicts error:", error);
    res.status(500).json({ error: "Failed to get conflicts" });
  }
});

router.post("/integrations/:id/conflicts/:conflictId/resolve", async (req: Request, res: Response) => {
  try {
    const { id, conflictId } = req.params;
    const { resolution, resolvedBy } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: "Resolution is required" });
    }

    const resolved = await resolveConflict(
      id,
      conflictId,
      resolution as ConflictResolution,
      resolvedBy || "user"
    );

    res.json(resolved);
  } catch (error: any) {
    console.error("[FHIRIntegrationRoutes] Resolve conflict error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to resolve conflict" });
  }
});

router.post("/integrations/:id/quality-insights", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const insights = await generateQualityInsights(id);

    res.json({ insights, count: insights.length });
  } catch (error: any) {
    console.error("[FHIRIntegrationRoutes] Generate quality insights error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Integration not found" });
    }
    res.status(500).json({ error: "Failed to generate quality insights" });
  }
});

router.get("/integrations/:id/quality-insights", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = getIntegration(id);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    res.json(integration.qualityInsights);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get quality insights error:", error);
    res.status(500).json({ error: "Failed to get quality insights" });
  }
});

router.get("/integrations/:id/transformed-resources", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = getIntegration(id);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    res.json(integration.transformedResources);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get transformed resources error:", error);
    res.status(500).json({ error: "Failed to get transformed resources" });
  }
});

router.get("/mapping-library", async (_req: Request, res: Response) => {
  try {
    const library = getMappingRuleLibrary();
    const result: Record<string, any[]> = {};

    library.forEach((rules, key) => {
      result[key] = rules;
    });

    res.json(result);
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get mapping library error:", error);
    res.status(500).json({ error: "Failed to get mapping library" });
  }
});

router.get("/supported-formats", async (_req: Request, res: Response) => {
  try {
    res.json({
      formats: [
        { id: "hl7v2", name: "HL7 v2", description: "HL7 Version 2 messages" },
        { id: "ccd", name: "CCD", description: "Continuity of Care Document" },
        { id: "ccda", name: "C-CDA", description: "Consolidated Clinical Document Architecture" },
        { id: "csv", name: "CSV", description: "Comma-Separated Values" },
        { id: "json", name: "JSON", description: "JavaScript Object Notation" },
        { id: "xml", name: "XML", description: "Extensible Markup Language" },
        { id: "custom", name: "Custom", description: "Custom format with manual mapping" },
      ],
    });
  } catch (error) {
    console.error("[FHIRIntegrationRoutes] Get supported formats error:", error);
    res.status(500).json({ error: "Failed to get supported formats" });
  }
});

export default router;
