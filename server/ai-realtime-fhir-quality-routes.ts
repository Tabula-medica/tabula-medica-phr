import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  validateResourceRealtime,
  validateBatchResources,
  applyCorrectionSuggestion,
  profileDataset,
  getMonitoringEvents,
  getMonitoringDashboard,
  getValidationResult,
  getDatasetProfiles,
  getDatasetProfile,
} from "./services/ai-realtime-fhir-quality-service";

const router = Router();

const ValidateResourceSchema = z.object({
  resource: z.record(z.any()),
  generateAISuggestions: z.boolean().optional(),
  generateAnalysis: z.boolean().optional(),
});

const ValidateBatchSchema = z.object({
  resources: z.array(z.record(z.any())),
});

const ProfileDatasetSchema = z.object({
  resources: z.array(z.record(z.any())),
  datasetName: z.string().min(1),
});

const ApplyCorrectionSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "AI Real-time FHIR Data Quality",
    version: "1.0.0",
    description: "Real-time data quality monitoring with AI-powered correction suggestions",
    features: [
      "Real-time validation on create/update",
      "AI-powered correction suggestions",
      "Automated data profiling",
      "Quality issue detection",
      "Cross-resource analysis",
    ],
    endpoints: {
      validate: "POST /validate - Validate a single FHIR resource",
      validateBatch: "POST /validate/batch - Validate multiple resources",
      profile: "POST /profile - Profile a dataset for quality issues",
      dashboard: "GET /dashboard - Real-time monitoring dashboard",
      events: "GET /events - Recent validation events",
      validationResult: "GET /validations/:id - Get validation result details",
      applyCorrection: "POST /validations/:validationId/corrections/:correctionId - Accept/reject correction",
      profiles: "GET /profiles - List dataset profiles",
      profileDetail: "GET /profiles/:id - Get dataset profile details",
    },
    noCdsCompliance: "All AI outputs are for informational purposes only and do not constitute clinical decision support",
  });
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const dashboard = getMonitoringDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = getMonitoringEvents(limit);
    res.json({ events, total: events.length });
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Events error:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const parsed = ValidateResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { resource, generateAISuggestions, generateAnalysis } = parsed.data;
    const result = await validateResourceRealtime(resource, {
      generateAISuggestions,
      generateAnalysis,
    });

    res.json(result);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Validate error:", error);
    res.status(500).json({ error: "Validation failed" });
  }
});

router.post("/validate/batch", async (req: Request, res: Response) => {
  try {
    const parsed = ValidateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { resources } = parsed.data;
    const result = await validateBatchResources(resources);

    res.json(result);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Batch validate error:", error);
    res.status(500).json({ error: "Batch validation failed" });
  }
});

router.get("/validations/:id", async (req: Request, res: Response) => {
  try {
    const result = getValidationResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Validation result not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Get validation error:", error);
    res.status(500).json({ error: "Failed to get validation result" });
  }
});

router.post("/validations/:validationId/corrections/:correctionId", async (req: Request, res: Response) => {
  try {
    const parsed = ApplyCorrectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { validationId, correctionId } = req.params;
    const result = await applyCorrectionSuggestion(validationId, correctionId, parsed.data.action);

    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Apply correction error:", error);
    res.status(500).json({ error: "Failed to apply correction" });
  }
});

router.post("/profile", async (req: Request, res: Response) => {
  try {
    const parsed = ProfileDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { resources, datasetName } = parsed.data;
    const profile = await profileDataset(resources, datasetName);

    res.json(profile);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Profile error:", error);
    res.status(500).json({ error: "Profiling failed" });
  }
});

router.get("/profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = getDatasetProfiles();
    res.json({ profiles, total: profiles.length });
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Get profiles error:", error);
    res.status(500).json({ error: "Failed to get profiles" });
  }
});

router.get("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = getDatasetProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("[RealtimeQualityRoutes] Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

export default router;

console.log("[RealtimeQualityRoutes] Routes registered at /api/realtime-fhir-quality/*");
