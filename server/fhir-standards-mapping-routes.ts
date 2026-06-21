import { Express, Request, Response } from "express";
import { fhirStandardsMappingService } from "./services/fhir-standards-mapping-service";

export function registerFhirStandardsMappingRoutes(app: Express): void {
  const prefix = "/api/fhir-standards-mapping";

  console.log("[HIPAA-AUDIT][FHIRStandardsMapping] Registering FHIR Standards Mapping routes");

  app.get(`${prefix}/standards`, async (req: Request, res: Response) => {
    try {
      const standards = fhirStandardsMappingService.getSupportedStandards();
      console.log(`[HIPAA-AUDIT][FHIRStandardsMapping] Listed ${standards.length} supported standards`);
      res.json(standards);
    } catch (error: any) {
      console.error("[FHIRStandardsMapping] Error listing standards:", error);
      res.status(500).json({ error: "Failed to list supported standards" });
    }
  });

  app.get(`${prefix}/templates`, async (req: Request, res: Response) => {
    try {
      let templates = fhirStandardsMappingService.getMappingTemplates();
      
      if (req.query.sourceFormat) {
        templates = templates.filter(t => t.sourceFormat === req.query.sourceFormat);
      }
      if (req.query.targetFormat) {
        templates = templates.filter(t => t.targetFormat === req.query.targetFormat);
      }
      
      res.json(templates);
    } catch (error: any) {
      console.error("[FHIRStandardsMapping] Error listing templates:", error);
      res.status(500).json({ error: "Failed to list mapping templates" });
    }
  });

  app.post(`${prefix}/map`, async (req: Request, res: Response) => {
    try {
      const { sourceData, sourceFormat, targetFormat, templateId } = req.body;
      
      if (!sourceData || !sourceFormat || !targetFormat) {
        return res.status(400).json({ 
          error: "Missing required fields: sourceData, sourceFormat, targetFormat" 
        });
      }

      console.log(`[HIPAA-AUDIT][FHIRStandardsMapping] Mapping from ${sourceFormat} to ${targetFormat}`);
      
      const result = await fhirStandardsMappingService.mapResource(
        sourceData,
        sourceFormat,
        targetFormat,
        templateId
      );

      console.log(`[HIPAA-AUDIT][FHIRStandardsMapping] Mapping completed: ${result.id} status=${result.validationStatus}`);
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRStandardsMapping] Error mapping resource:", error);
      res.status(500).json({ error: "Failed to map resource" });
    }
  });

  app.get(`${prefix}/history`, async (req: Request, res: Response) => {
    try {
      let history = fhirStandardsMappingService.getMappingHistory();
      
      const limit = parseInt(req.query.limit as string) || 50;
      history = history.slice(0, limit);
      
      res.json(history);
    } catch (error: any) {
      console.error("[FHIRStandardsMapping] Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch mapping history" });
    }
  });

  app.get(`${prefix}/history/:mappingId`, async (req: Request, res: Response) => {
    try {
      const mapping = fhirStandardsMappingService.getMappingById(req.params.mappingId);
      
      if (!mapping) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      res.json(mapping);
    } catch (error: any) {
      console.error("[FHIRStandardsMapping] Error fetching mapping:", error);
      res.status(500).json({ error: "Failed to fetch mapping" });
    }
  });

  app.get(`${prefix}/statistics`, async (req: Request, res: Response) => {
    try {
      const stats = fhirStandardsMappingService.getStatistics();
      res.json(stats);
    } catch (error: any) {
      console.error("[FHIRStandardsMapping] Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  console.log("[HIPAA-AUDIT][FHIRStandardsMapping] Routes registered successfully at /api/fhir-standards-mapping/*");
}
