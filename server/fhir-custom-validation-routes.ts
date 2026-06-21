import { Router, Request, Response } from "express";
import { aiFHIRCustomValidationService } from "./services/ai-fhir-custom-validation-service";

const router = Router();

router.get("/profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = await aiFHIRCustomValidationService.getProfiles();
    res.json(profiles);
  } catch (error) {
    console.error("[CustomValidation] Error fetching profiles:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = await aiFHIRCustomValidationService.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("[CustomValidation] Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.post("/profiles/upload", async (req: Request, res: Response) => {
  try {
    const { content, fileName } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "File content is required" });
    }
    
    const profile = await aiFHIRCustomValidationService.uploadProfileFromFile(
      content,
      fileName || "uploaded-profile.json"
    );
    res.status(201).json(profile);
  } catch (error) {
    console.error("[CustomValidation] Error uploading profile:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upload profile" });
  }
});

router.post("/profiles/import-url", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    
    const profile = await aiFHIRCustomValidationService.uploadProfileFromUrl(url);
    res.status(201).json(profile);
  } catch (error) {
    console.error("[CustomValidation] Error importing profile from URL:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to import profile" });
  }
});

router.delete("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const success = await aiFHIRCustomValidationService.deleteProfile(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({ success: true, message: "Profile deleted" });
  } catch (error) {
    console.error("[CustomValidation] Error deleting profile:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete profile" });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;
    
    if (!resource) {
      return res.status(400).json({ error: "Resource is required" });
    }
    if (!profileId) {
      return res.status(400).json({ error: "Profile ID is required" });
    }
    
    const report = await aiFHIRCustomValidationService.validateResource(resource, profileId);
    res.json(report);
  } catch (error) {
    console.error("[CustomValidation] Error validating resource:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to validate resource" });
  }
});

router.post("/ai/suggestions", async (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;
    
    if (!resource) {
      return res.status(400).json({ error: "Resource is required" });
    }
    if (!profileId) {
      return res.status(400).json({ error: "Profile ID is required" });
    }
    
    const suggestions = await aiFHIRCustomValidationService.generateValidationSuggestions(
      resource,
      profileId
    );
    res.json(suggestions);
  } catch (error) {
    console.error("[CustomValidation] Error generating suggestions:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to generate suggestions" });
  }
});

router.get("/reports", async (_req: Request, res: Response) => {
  try {
    const reports = await aiFHIRCustomValidationService.getValidationReports();
    res.json(reports);
  } catch (error) {
    console.error("[CustomValidation] Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch validation reports" });
  }
});

router.get("/reports/:id", async (req: Request, res: Response) => {
  try {
    const report = await aiFHIRCustomValidationService.getValidationReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    console.error("[CustomValidation] Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch validation report" });
  }
});

router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = aiFHIRCustomValidationService.getProfileCategories();
    res.json(categories);
  } catch (error) {
    console.error("[CustomValidation] Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/statistics", async (_req: Request, res: Response) => {
  try {
    const statistics = aiFHIRCustomValidationService.getStatistics();
    res.json(statistics);
  } catch (error) {
    console.error("[CustomValidation] Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export function registerFHIRCustomValidationRoutes(app: Router) {
  app.use("/api/fhir-custom-validation", router);
  console.log("[Routes] FHIR Custom Validation routes registered at /api/fhir-custom-validation/*");
}
