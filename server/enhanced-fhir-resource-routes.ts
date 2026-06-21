import { Router, Request, Response } from "express";
import { enhancedFHIRResourceService, FHIRResourceType, FHIRResource } from "./services/enhanced-fhir-resource-service";

const router = Router();

router.get("/dashboard", (req: Request, res: Response) => {
  try {
    const stats = enhancedFHIRResourceService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

router.get("/resource-types", (req: Request, res: Response) => {
  try {
    const types = enhancedFHIRResourceService.getSupportedResourceTypes();
    res.json(types);
  } catch (error) {
    console.error("Error getting resource types:", error);
    res.status(500).json({ error: "Failed to get resource types" });
  }
});

router.get("/profiles", (req: Request, res: Response) => {
  try {
    const { resourceType } = req.query;
    const profiles = resourceType
      ? enhancedFHIRResourceService.getProfilesByResourceType(resourceType as FHIRResourceType)
      : enhancedFHIRResourceService.getProfiles();
    res.json(profiles);
  } catch (error) {
    console.error("Error getting profiles:", error);
    res.status(500).json({ error: "Failed to get profiles" });
  }
});

router.get("/profiles/:id", (req: Request, res: Response) => {
  try {
    const profile = enhancedFHIRResourceService.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.get("/sync-configurations", (req: Request, res: Response) => {
  try {
    const configs = enhancedFHIRResourceService.getSyncConfigurations();
    res.json(configs);
  } catch (error) {
    console.error("Error getting sync configurations:", error);
    res.status(500).json({ error: "Failed to get sync configurations" });
  }
});

router.get("/sync-configurations/:id", (req: Request, res: Response) => {
  try {
    const config = enhancedFHIRResourceService.getSyncConfiguration(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Sync configuration not found" });
    }
    res.json(config);
  } catch (error) {
    console.error("Error getting sync configuration:", error);
    res.status(500).json({ error: "Failed to get sync configuration" });
  }
});

router.patch("/sync-configurations/:id", (req: Request, res: Response) => {
  try {
    const updated = enhancedFHIRResourceService.updateSyncConfiguration(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Sync configuration not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Error updating sync configuration:", error);
    res.status(500).json({ error: "Failed to update sync configuration" });
  }
});

router.patch("/sync-configurations/:id/resources/:resourceType", (req: Request, res: Response) => {
  try {
    const { id, resourceType } = req.params;
    const updated = enhancedFHIRResourceService.updateResourceSyncConfig(
      id,
      resourceType as FHIRResourceType,
      req.body
    );
    if (!updated) {
      return res.status(404).json({ error: "Sync configuration not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Error updating resource sync config:", error);
    res.status(500).json({ error: "Failed to update resource sync config" });
  }
});

router.get("/resources/:resourceType", (req: Request, res: Response) => {
  try {
    const resources = enhancedFHIRResourceService.getResources(req.params.resourceType as FHIRResourceType);
    res.json(resources);
  } catch (error) {
    console.error("Error getting resources:", error);
    res.status(500).json({ error: "Failed to get resources" });
  }
});

router.get("/resources/:resourceType/:id", (req: Request, res: Response) => {
  try {
    const { resourceType, id } = req.params;
    const resource = enhancedFHIRResourceService.getResource(resourceType as FHIRResourceType, id);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.json(resource);
  } catch (error) {
    console.error("Error getting resource:", error);
    res.status(500).json({ error: "Failed to get resource" });
  }
});

router.post("/validate", (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;
    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "Invalid resource" });
    }
    const result = enhancedFHIRResourceService.validateResource(resource as FHIRResource, profileId);
    res.json(result);
  } catch (error) {
    console.error("Error validating resource:", error);
    res.status(500).json({ error: "Failed to validate resource" });
  }
});

router.post("/validate/:resourceType/:id", (req: Request, res: Response) => {
  try {
    const { resourceType, id } = req.params;
    const { profileId } = req.body;
    const resource = enhancedFHIRResourceService.getResource(resourceType as FHIRResourceType, id);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    const result = enhancedFHIRResourceService.validateResource(resource, profileId);
    res.json(result);
  } catch (error) {
    console.error("Error validating resource:", error);
    res.status(500).json({ error: "Failed to validate resource" });
  }
});

router.post("/ai-suggestions", async (req: Request, res: Response) => {
  try {
    const { resource } = req.body;
    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "Invalid resource" });
    }
    const suggestions = await enhancedFHIRResourceService.getAIValidationSuggestions(resource as FHIRResource);
    res.json(suggestions);
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    res.status(500).json({ error: "Failed to get AI suggestions" });
  }
});

router.get("/sync-jobs", (req: Request, res: Response) => {
  try {
    const jobs = enhancedFHIRResourceService.getSyncJobs();
    res.json(jobs);
  } catch (error) {
    console.error("Error getting sync jobs:", error);
    res.status(500).json({ error: "Failed to get sync jobs" });
  }
});

router.get("/sync-jobs/:id", (req: Request, res: Response) => {
  try {
    const job = enhancedFHIRResourceService.getSyncJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Sync job not found" });
    }
    res.json(job);
  } catch (error) {
    console.error("Error getting sync job:", error);
    res.status(500).json({ error: "Failed to get sync job" });
  }
});

router.post("/sync-jobs", async (req: Request, res: Response) => {
  try {
    const { configId, resourceType, direction } = req.body;
    if (!configId || !resourceType || !direction) {
      return res.status(400).json({ error: "Missing required fields: configId, resourceType, direction" });
    }
    const job = await enhancedFHIRResourceService.startSyncJob(configId, resourceType, direction);
    res.status(201).json(job);
  } catch (error: any) {
    console.error("Error starting sync job:", error);
    res.status(400).json({ error: error.message || "Failed to start sync job" });
  }
});

router.post("/sync-jobs/:id/cancel", (req: Request, res: Response) => {
  try {
    const success = enhancedFHIRResourceService.cancelSyncJob(req.params.id);
    if (!success) {
      return res.status(400).json({ error: "Unable to cancel job" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error canceling sync job:", error);
    res.status(500).json({ error: "Failed to cancel sync job" });
  }
});

export function registerEnhancedFHIRResourceRoutes(app: any) {
  app.use("/api/enhanced-fhir", router);
}
