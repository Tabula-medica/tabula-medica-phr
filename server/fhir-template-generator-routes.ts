import { Router, Request, Response } from "express";
import {
  generateFHIRTemplate,
  getTemplateHistory,
  getTemplateById,
  clearTemplateHistory,
  getSupportedResourceTypes,
  getSupportedProfiles,
  validateGeneratedResource,
  TemplateGenerationRequest,
  FHIRResourceType,
  FHIRProfile,
} from "./services/ai-fhir-template-generator-service";

const router = Router();

router.get("/resource-types", (_req: Request, res: Response) => {
  try {
    const types = getSupportedResourceTypes();
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: "Failed to get resource types" });
  }
});

router.get("/profiles", (_req: Request, res: Response) => {
  try {
    const profiles = getSupportedProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Failed to get profiles" });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const {
      resourceType,
      profile,
      customProfileUrl,
      context,
    } = req.body;

    if (!resourceType) {
      res.status(400).json({ error: "resourceType is required" });
      return;
    }

    if (!profile) {
      res.status(400).json({ error: "profile is required" });
      return;
    }

    const validResourceTypes = getSupportedResourceTypes().map(r => r.type);
    if (!validResourceTypes.includes(resourceType)) {
      res.status(400).json({ 
        error: `Invalid resourceType. Valid types: ${validResourceTypes.join(", ")}` 
      });
      return;
    }

    const validProfiles = getSupportedProfiles().map(p => p.id);
    if (!validProfiles.includes(profile)) {
      res.status(400).json({ 
        error: `Invalid profile. Valid profiles: ${validProfiles.join(", ")}` 
      });
      return;
    }

    if (profile === "custom" && !customProfileUrl) {
      res.status(400).json({ 
        error: "customProfileUrl is required when profile is 'custom'" 
      });
      return;
    }

    const request: TemplateGenerationRequest = {
      resourceType: resourceType as FHIRResourceType,
      profile: profile as FHIRProfile,
      customProfileUrl,
      context: context || {},
    };

    const template = await generateFHIRTemplate(request);
    res.json(template);
  } catch (error) {
    console.error("Template generation error:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to generate template" 
    });
  }
});

router.get("/history", (_req: Request, res: Response) => {
  try {
    const history = getTemplateHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to get template history" });
  }
});

router.get("/history/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = getTemplateById(id);
    
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to get template" });
  }
});

router.delete("/history", (_req: Request, res: Response) => {
  try {
    clearTemplateHistory();
    res.json({ success: true, message: "Template history cleared" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { resource, resourceType, profile } = req.body;

    if (!resource || !resourceType || !profile) {
      res.status(400).json({ 
        error: "resource, resourceType, and profile are required" 
      });
      return;
    }

    const result = await validateGeneratedResource(
      resource,
      resourceType as FHIRResourceType,
      profile as FHIRProfile
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to validate resource" });
  }
});

export function registerFHIRTemplateGeneratorRoutes(app: Router) {
  app.use("/api/fhir-template-generator", router);
}

export default router;
