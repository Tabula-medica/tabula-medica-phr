import { Router, Request, Response } from "express";
import { aiPHIAnonymizationService, DeidentificationStrategy, AnonymizationRule } from "./services/ai-phi-anonymization-service";

const router = Router();

router.get("/metadata", async (_req: Request, res: Response) => {
  try {
    const categories = aiPHIAnonymizationService.getSupportedCategories();
    const strategies = aiPHIAnonymizationService.getStrategies();
    const defaultRules = aiPHIAnonymizationService.getDefaultRules();

    res.json({
      categories,
      strategies,
      defaultRules,
      hipaaInfo: {
        safeHarborMethod: "Removes or generalizes all 18 HIPAA-defined identifiers",
        expertDetermination: "Statistical analysis to ensure re-identification risk is very small",
        identifierCount: 18,
      },
    });
  } catch (error) {
    console.error("Error fetching metadata:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

router.post("/detect", async (req: Request, res: Response) => {
  try {
    const { resource } = req.body;

    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "Valid FHIR resource required" });
    }

    const detections = await aiPHIAnonymizationService.detectPHI(resource);

    res.json({
      resourceType: resource.resourceType,
      resourceId: resource.id,
      phiDetected: detections.length > 0,
      detectionCount: detections.length,
      detections,
      riskSummary: {
        high: detections.filter((d) => d.riskLevel === "high").length,
        medium: detections.filter((d) => d.riskLevel === "medium").length,
        low: detections.filter((d) => d.riskLevel === "low").length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error detecting PHI:", error);
    res.status(500).json({ error: "Failed to detect PHI" });
  }
});

router.post("/anonymize", async (req: Request, res: Response) => {
  try {
    const { resource, strategy = "safe_harbor", customRules } = req.body;

    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "Valid FHIR resource required" });
    }

    const validStrategies: DeidentificationStrategy[] = [
      "safe_harbor",
      "pseudonymization",
      "generalization",
      "suppression",
      "perturbation",
      "k_anonymity",
    ];

    if (!validStrategies.includes(strategy)) {
      return res.status(400).json({
        error: `Invalid strategy. Must be one of: ${validStrategies.join(", ")}`,
      });
    }

    const result = await aiPHIAnonymizationService.anonymizeResource(
      resource,
      strategy as DeidentificationStrategy,
      customRules as AnonymizationRule[] | undefined
    );

    res.json(result);
  } catch (error) {
    console.error("Error anonymizing resource:", error);
    res.status(500).json({ error: "Failed to anonymize resource" });
  }
});

router.post("/anonymize-dataset", async (req: Request, res: Response) => {
  try {
    const { resources, datasetName, strategy = "safe_harbor", kValue } = req.body;

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ error: "Array of FHIR resources required" });
    }

    if (!datasetName) {
      return res.status(400).json({ error: "Dataset name required" });
    }

    const result = await aiPHIAnonymizationService.anonymizeDataset(
      resources,
      datasetName,
      strategy as DeidentificationStrategy,
      kValue
    );

    res.json(result);
  } catch (error) {
    console.error("Error anonymizing dataset:", error);
    res.status(500).json({ error: "Failed to anonymize dataset" });
  }
});

router.post("/ai-suggestions", async (req: Request, res: Response) => {
  try {
    const { resource, preserveFields = [] } = req.body;

    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "Valid FHIR resource required" });
    }

    const suggestions = await aiPHIAnonymizationService.getAIAnonymizationSuggestions(
      resource,
      preserveFields
    );

    res.json({
      resourceType: resource.resourceType,
      resourceId: resource.id,
      ...suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    res.status(500).json({ error: "Failed to get AI suggestions" });
  }
});

router.get("/rules", async (_req: Request, res: Response) => {
  try {
    const rules = aiPHIAnonymizationService.getDefaultRules();
    res.json({ rules });
  } catch (error) {
    console.error("Error fetching rules:", error);
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

export default router;
