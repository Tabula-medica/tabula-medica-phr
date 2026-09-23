import { Router, Request, Response } from "express";
import {
  createHarmonizationSession,
  getHarmonizationSession,
  getAllHarmonizationSessions,
  mapConceptBetweenSystems,
  analyzeResourceForCleansing,
  getProfileSuggestion,
  applyCleansingResult,
  validateConceptMapping,
  getTerminologyStats,
  getCanonicalProfiles,
  generateSampleFHIRData,
  TerminologySystem
} from "./services/ai-fhir-data-harmonization-service";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.use(requireUser);

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = getTerminologyStats();
    res.json({
      ...stats,
      disclaimer: "This harmonization service is for data quality purposes only, not clinical decision support."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions", async (_req: Request, res: Response) => {
  try {
    const sessions = getAllHarmonizationSessions();
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = getHarmonizationSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { name, description, fhirResources, sourceFHIRVersion, targetFHIRVersion } = req.body;
    
    if (!fhirResources || !Array.isArray(fhirResources) || fhirResources.length === 0) {
      return res.status(400).json({ error: "fhirResources must be a non-empty array" });
    }

    const session = await createHarmonizationSession(
      name || "Harmonization Session",
      description || "AI-powered FHIR data harmonization",
      fhirResources,
      sourceFHIRVersion || "R4",
      targetFHIRVersion || "R4"
    );

    res.status(201).json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/map-concept", async (req: Request, res: Response) => {
  try {
    const { sourceCode, sourceSystem, sourceDisplay, targetSystem } = req.body;
    
    if (!sourceCode || !sourceSystem || !targetSystem) {
      return res.status(400).json({ error: "sourceCode, sourceSystem, and targetSystem are required" });
    }

    const mapping = await mapConceptBetweenSystems(
      sourceCode,
      sourceSystem as TerminologySystem,
      sourceDisplay || "",
      targetSystem as TerminologySystem
    );

    res.json({ mapping });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/analyze-cleansing", async (req: Request, res: Response) => {
  try {
    const { resource } = req.body;
    
    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "A valid FHIR resource is required" });
    }

    const results = await analyzeResourceForCleansing(resource);
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/suggest-profile", async (req: Request, res: Response) => {
  try {
    const { resource } = req.body;
    
    if (!resource || !resource.resourceType) {
      return res.status(400).json({ error: "A valid FHIR resource is required" });
    }

    const suggestion = await getProfileSuggestion(resource);
    res.json({ suggestion });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:sessionId/apply-cleansing/:resultId", async (req: Request, res: Response) => {
  try {
    const { sessionId, resultId } = req.params;
    const success = applyCleansingResult(resultId, sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "Session or cleansing result not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:sessionId/validate-mapping/:mappingId", async (req: Request, res: Response) => {
  try {
    const { sessionId, mappingId } = req.params;
    const { validatedBy } = req.body;

    const success = validateConceptMapping(mappingId, sessionId, validatedBy || getUserId(req));
    
    if (!success) {
      return res.status(404).json({ error: "Session or mapping not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const { resourceType } = req.query;
    const profiles = getCanonicalProfiles(resourceType as string | undefined);
    res.json({ profiles });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate-sample", async (_req: Request, res: Response) => {
  try {
    const resources = generateSampleFHIRData();
    res.json({ resources });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export function registerAIFHIRDataHarmonizationRoutes(app: any) {
  app.use("/api/fhir-data-harmonization", router);
  console.log("[Routes] AI FHIR Data Harmonization routes registered at /api/fhir-data-harmonization/*");
}

export default router;
