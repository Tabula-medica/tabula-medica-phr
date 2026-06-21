import { Express } from "express";
import { aiFHIRResourceMapperService } from "./services/ai-fhir-resource-mapper-service";
import { aiFHIRInsightsEngineService } from "./services/ai-fhir-insights-engine-service";
import { aiFHIRResourceGeneratorService } from "./services/ai-fhir-resource-generator-service";

export function registerAIFHIRCapabilitiesRoutes(app: Express): void {
  // ===== AI FHIR Resource Mapper Routes =====
  
  app.get("/api/ai-fhir-mapper/stats", async (req, res) => {
    try {
      const stats = await aiFHIRResourceMapperService.getStats();
      res.json({ ...stats, disclaimer: "Mapping operations are for data governance purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error fetching mapper stats:", error);
      res.status(500).json({ error: "Failed to fetch mapper statistics" });
    }
  });

  app.get("/api/ai-fhir-mapper/rules", async (req, res) => {
    try {
      const rules = await aiFHIRResourceMapperService.getMappingRules();
      res.json({ rules, disclaimer: "Mapping rules are for data governance purposes only." });
    } catch (error) {
      console.error("Error fetching mapping rules:", error);
      res.status(500).json({ error: "Failed to fetch mapping rules" });
    }
  });

  app.get("/api/ai-fhir-mapper/rules/:ruleId", async (req, res) => {
    try {
      const rule = await aiFHIRResourceMapperService.getMappingRule(req.params.ruleId);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching rule:", error);
      res.status(500).json({ error: "Failed to fetch rule" });
    }
  });

  app.post("/api/ai-fhir-mapper/rules", async (req, res) => {
    try {
      const rule = await aiFHIRResourceMapperService.createMappingRule(req.body);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating rule:", error);
      res.status(500).json({ error: "Failed to create mapping rule" });
    }
  });

  app.post("/api/ai-fhir-mapper/map", async (req, res) => {
    try {
      const { sourceResource, targetFormat } = req.body;
      const result = await aiFHIRResourceMapperService.mapResource(sourceResource, targetFormat || "FHIR R4");
      res.json({ ...result, disclaimer: "Mapped data is for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error mapping resource:", error);
      res.status(500).json({ error: "Failed to map resource" });
    }
  });

  app.post("/api/ai-fhir-mapper/auto-detect", async (req, res) => {
    try {
      const { sourceResource } = req.body;
      const result = await aiFHIRResourceMapperService.autoDetectAndMap(sourceResource);
      res.json({ ...result, disclaimer: "Auto-detection is for informational purposes only." });
    } catch (error) {
      console.error("Error auto-detecting format:", error);
      res.status(500).json({ error: "Failed to auto-detect and map" });
    }
  });

  app.post("/api/ai-fhir-mapper/generate-mapping", async (req, res) => {
    try {
      const { sourceSchema, targetFormat } = req.body;
      const result = await aiFHIRResourceMapperService.generateMappingWithAI(sourceSchema, targetFormat || "FHIR R4");
      res.json({ ...result, disclaimer: "AI-generated mappings should be reviewed before use." });
    } catch (error) {
      console.error("Error generating mapping:", error);
      res.status(500).json({ error: "Failed to generate mapping" });
    }
  });

  app.get("/api/ai-fhir-mapper/sessions", async (req, res) => {
    try {
      const sessions = await aiFHIRResourceMapperService.getHarmonizationSessions();
      res.json({ sessions });
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/ai-fhir-mapper/sessions", async (req, res) => {
    try {
      const { name, sourceResources } = req.body;
      const session = await aiFHIRResourceMapperService.startHarmonizationSession(name, sourceResources || []);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error starting session:", error);
      res.status(500).json({ error: "Failed to start harmonization session" });
    }
  });

  // ===== AI FHIR Insights Engine Routes =====

  app.get("/api/ai-fhir-insights/stats", async (req, res) => {
    try {
      const stats = await aiFHIRInsightsEngineService.getStats();
      res.json({ ...stats, disclaimer: "Insights are for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error fetching insights stats:", error);
      res.status(500).json({ error: "Failed to fetch insights statistics" });
    }
  });

  app.get("/api/ai-fhir-insights/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const insights = await aiFHIRInsightsEngineService.getRecentInsights(limit);
      res.json({ insights, disclaimer: "Insights are for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error fetching recent insights:", error);
      res.status(500).json({ error: "Failed to fetch recent insights" });
    }
  });

  app.get("/api/ai-fhir-insights/patient/:patientId", async (req, res) => {
    try {
      const insights = await aiFHIRInsightsEngineService.getPatientInsights(req.params.patientId);
      res.json({ insights, disclaimer: "Insights are for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error fetching patient insights:", error);
      res.status(500).json({ error: "Failed to fetch patient insights" });
    }
  });

  app.post("/api/ai-fhir-insights/generate", async (req, res) => {
    try {
      const { patientId, fhirData } = req.body;
      const insights = await aiFHIRInsightsEngineService.generatePatientInsights(patientId, fhirData);
      res.json({ insights, disclaimer: "AI-generated insights are for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  app.get("/api/ai-fhir-insights/summaries", async (req, res) => {
    try {
      const summaries = await aiFHIRInsightsEngineService.getSummaries();
      res.json({ summaries });
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ error: "Failed to fetch summaries" });
    }
  });

  app.post("/api/ai-fhir-insights/summarize", async (req, res) => {
    try {
      const { scope, data } = req.body;
      const summary = await aiFHIRInsightsEngineService.generateDataSummary(scope, data);
      res.json(summary);
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  app.get("/api/ai-fhir-insights/trends", async (req, res) => {
    try {
      const patientId = req.query.patientId as string | undefined;
      const trends = await aiFHIRInsightsEngineService.getTrendAnalyses(patientId);
      res.json({ trends, disclaimer: "Trend analyses are for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  app.post("/api/ai-fhir-insights/analyze-trends", async (req, res) => {
    try {
      const { patientId, metric, observations } = req.body;
      const analysis = await aiFHIRInsightsEngineService.analyzeTrends(patientId, metric, observations);
      res.json({ ...analysis, disclaimer: "Trend analysis is for informational purposes only. Not for clinical decision-making." });
    } catch (error) {
      console.error("Error analyzing trends:", error);
      res.status(500).json({ error: "Failed to analyze trends" });
    }
  });

  // ===== AI FHIR Resource Generator Routes =====

  app.get("/api/ai-fhir-generator/stats", async (req, res) => {
    try {
      const stats = await aiFHIRResourceGeneratorService.getStats();
      res.json({ ...stats, disclaimer: "Generated resources are for testing/validation. Review before clinical use." });
    } catch (error) {
      console.error("Error fetching generator stats:", error);
      res.status(500).json({ error: "Failed to fetch generator statistics" });
    }
  });

  app.get("/api/ai-fhir-generator/templates", async (req, res) => {
    try {
      const templates = await aiFHIRResourceGeneratorService.getTemplates();
      res.json({ templates });
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/ai-fhir-generator/templates/:resourceType", async (req, res) => {
    try {
      const template = await aiFHIRResourceGeneratorService.getTemplate(req.params.resourceType);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.get("/api/ai-fhir-generator/resource-types", async (req, res) => {
    try {
      const types = await aiFHIRResourceGeneratorService.getSupportedResourceTypes();
      res.json({ resourceTypes: types });
    } catch (error) {
      console.error("Error fetching resource types:", error);
      res.status(500).json({ error: "Failed to fetch resource types" });
    }
  });

  app.get("/api/ai-fhir-generator/resources", async (req, res) => {
    try {
      const resources = await aiFHIRResourceGeneratorService.getGeneratedResources();
      res.json({ resources, disclaimer: "Generated resources are for testing/validation purposes." });
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ error: "Failed to fetch generated resources" });
    }
  });

  app.get("/api/ai-fhir-generator/resources/:id", async (req, res) => {
    try {
      const resource = await aiFHIRResourceGeneratorService.getGeneratedResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      console.error("Error fetching resource:", error);
      res.status(500).json({ error: "Failed to fetch resource" });
    }
  });

  app.post("/api/ai-fhir-generator/generate", async (req, res) => {
    try {
      const { prompt, resourceType } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const resource = await aiFHIRResourceGeneratorService.generateFromNaturalLanguage(prompt, resourceType);
      res.status(201).json({ ...resource, disclaimer: "AI-generated resources should be reviewed before use." });
    } catch (error) {
      console.error("Error generating resource:", error);
      res.status(500).json({ error: "Failed to generate resource" });
    }
  });

  app.post("/api/ai-fhir-generator/generate-batch", async (req, res) => {
    try {
      const { prompts } = req.body;
      if (!prompts || !Array.isArray(prompts)) {
        return res.status(400).json({ error: "Prompts array is required" });
      }
      const resources = await aiFHIRResourceGeneratorService.generateBatch(prompts);
      res.status(201).json({ resources, disclaimer: "AI-generated resources should be reviewed before use." });
    } catch (error) {
      console.error("Error batch generating:", error);
      res.status(500).json({ error: "Failed to batch generate resources" });
    }
  });

  app.post("/api/ai-fhir-generator/resources/:id/refine", async (req, res) => {
    try {
      const { feedback } = req.body;
      const resource = await aiFHIRResourceGeneratorService.refineResource(req.params.id, feedback);
      res.json(resource);
    } catch (error) {
      console.error("Error refining resource:", error);
      res.status(500).json({ error: "Failed to refine resource" });
    }
  });

  app.post("/api/ai-fhir-generator/resources/:id/commit", async (req, res) => {
    try {
      const result = await aiFHIRResourceGeneratorService.validateAndCommit(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error committing resource:", error);
      res.status(500).json({ error: "Failed to commit resource" });
    }
  });

  app.delete("/api/ai-fhir-generator/resources/:id", async (req, res) => {
    try {
      const deleted = await aiFHIRResourceGeneratorService.deleteGeneratedResource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Resource not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ error: "Failed to delete resource" });
    }
  });
}
