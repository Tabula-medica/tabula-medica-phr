import { Router, Request, Response } from "express";
import {
  createVersionMapping,
  getMapping,
  getAllMappings,
  getTransformationRecommendations,
  validateAgainstProfile,
  validateWithAIAssistance,
  getAvailableProfiles,
  getValidationHistory,
  getSupportedVersions,
  getVersionChanges,
  getServiceMetadata,
  FHIRVersion,
} from "./services/ai-fhir-data-exchange-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    const metadata = getServiceMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Metadata error:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

router.get("/versions", (_req: Request, res: Response) => {
  try {
    const versions = getSupportedVersions();
    res.json({ versions });
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Versions error:", error);
    res.status(500).json({ error: "Failed to fetch supported versions" });
  }
});

router.get("/version-changes/:resourceType", (req: Request, res: Response) => {
  try {
    const changes = getVersionChanges(req.params.resourceType);
    res.json({ resourceType: req.params.resourceType, changes });
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Version changes error:", error);
    res.status(500).json({ error: "Failed to fetch version changes" });
  }
});

router.get("/mappings", (_req: Request, res: Response) => {
  try {
    const mappings = getAllMappings();
    res.json(mappings);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Get mappings error:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});

router.get("/mappings/:id", (req: Request, res: Response) => {
  try {
    const mapping = getMapping(req.params.id);
    if (!mapping) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }
    res.json(mapping);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Get mapping error:", error);
    res.status(500).json({ error: "Failed to fetch mapping" });
  }
});

router.post("/mappings", async (req: Request, res: Response) => {
  try {
    const { name, resourceType, sourceVersion, targetVersion } = req.body;
    
    if (!name || !resourceType || !sourceVersion || !targetVersion) {
      res.status(400).json({ error: "name, resourceType, sourceVersion, and targetVersion are required" });
      return;
    }

    const validVersions = getSupportedVersions();
    if (!validVersions.includes(sourceVersion) || !validVersions.includes(targetVersion)) {
      res.status(400).json({ error: "Invalid FHIR version", validVersions });
      return;
    }

    const mapping = await createVersionMapping(
      name,
      resourceType,
      sourceVersion as FHIRVersion,
      targetVersion as FHIRVersion
    );
    res.status(201).json(mapping);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Create mapping error:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
});

router.post("/recommendations", async (req: Request, res: Response) => {
  try {
    const { resourceType, sourceVersion, targetVersion } = req.body;
    
    if (!resourceType || !sourceVersion || !targetVersion) {
      res.status(400).json({ error: "resourceType, sourceVersion, and targetVersion are required" });
      return;
    }

    const recommendations = await getTransformationRecommendations(
      resourceType,
      sourceVersion as FHIRVersion,
      targetVersion as FHIRVersion
    );
    res.json({ recommendations });
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Recommendations error:", error);
    res.status(500).json({ error: "Failed to get transformation recommendations" });
  }
});

router.get("/profiles", (_req: Request, res: Response) => {
  try {
    const profiles = getAvailableProfiles();
    res.json(profiles);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Profiles error:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.post("/validate", (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;
    
    if (!resource || !profileId) {
      res.status(400).json({ error: "resource and profileId are required" });
      return;
    }

    if (!resource.resourceType) {
      res.status(400).json({ error: "resource must have a resourceType" });
      return;
    }

    const result = validateAgainstProfile(resource, profileId);
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Validation error:", error);
    res.status(500).json({ error: "Failed to validate resource" });
  }
});

router.post("/validate-with-ai", async (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;
    
    if (!resource || !profileId) {
      res.status(400).json({ error: "resource and profileId are required" });
      return;
    }

    if (!resource.resourceType) {
      res.status(400).json({ error: "resource must have a resourceType" });
      return;
    }

    const result = await validateWithAIAssistance(resource, profileId);
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] AI validation error:", error);
    res.status(500).json({ error: "Failed to validate resource with AI" });
  }
});

router.get("/validation-history", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = getValidationHistory(limit);
    res.json(history);
  } catch (error) {
    console.error("[FHIRDataExchangeRoutes] Validation history error:", error);
    res.status(500).json({ error: "Failed to fetch validation history" });
  }
});

export default router;
