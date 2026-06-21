import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirProfileValidator, ProfileType } from "./services/fhir-profile-validator";

const router = Router();

function logHipaaAudit(action: string, details: string, userId: string = "system") {
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} - ${action}: ${details} by ${userId}`);
}

const constraintSchema = z.object({
  id: z.string(),
  path: z.string(),
  severity: z.enum(["error", "warning", "information"]),
  expression: z.string().optional(),
  human: z.string(),
  source: z.string().optional(),
});

const extensionSchema = z.object({
  id: z.string(),
  url: z.string(),
  path: z.string(),
  min: z.number(),
  max: z.string(),
  type: z.string(),
});

const sliceSchema = z.object({
  id: z.string(),
  path: z.string(),
  discriminator: z.array(z.object({ type: z.string(), path: z.string() })),
  rules: z.enum(["open", "closed", "openAtEnd"]),
  slices: z.array(z.object({
    name: z.string(),
    min: z.number(),
    max: z.string(),
    conditions: z.record(z.unknown()),
  })),
});

const profileSchema = z.object({
  name: z.string().min(1),
  url: z.string(),
  version: z.string(),
  type: z.enum(["standard", "custom", "extension"]),
  baseDefinition: z.string(),
  resourceType: z.string(),
  description: z.string(),
  constraints: z.array(constraintSchema),
  extensions: z.array(extensionSchema).optional().default([]),
  slices: z.array(sliceSchema).optional().default([]),
  required: z.array(z.string()),
  mustSupport: z.array(z.string()),
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;

    if (!resource || !profileId) {
      return res.status(400).json({
        success: false,
        error: "Missing resource or profileId",
      });
    }

    const result = await fhirProfileValidator.validateResource(resource, profileId);

    logHipaaAudit("RESOURCE_VALIDATED", `${resource.resourceType}/${resource.id} against ${profileId}: ${result.valid ? "VALID" : "INVALID"}`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error validating resource:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate resource",
    });
  }
});

router.post("/validate/batch", async (req: Request, res: Response) => {
  try {
    const { resources, profileId } = req.body;

    if (!Array.isArray(resources) || !profileId) {
      return res.status(400).json({
        success: false,
        error: "Missing resources array or profileId",
      });
    }

    const job = await fhirProfileValidator.startBatchValidation(profileId, resources);

    logHipaaAudit("BATCH_VALIDATION_STARTED", `Job ${job.id} with ${resources.length} resources`);

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error starting batch validation:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start batch validation",
    });
  }
});

router.get("/jobs", async (_req: Request, res: Response) => {
  try {
    const jobs = await fhirProfileValidator.listJobs();

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error listing jobs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list jobs",
    });
  }
});

router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await fhirProfileValidator.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error getting job:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get job",
    });
  }
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const type = req.query.type as ProfileType | undefined;
    const profiles = await fhirProfileValidator.listProfiles(type);

    logHipaaAudit("PROFILES_LISTED", `${profiles.length} profiles retrieved`);

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error listing profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list profiles",
    });
  }
});

router.get("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = await fhirProfileValidator.getProfile(profileId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error getting profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get profile",
    });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const validated = profileSchema.parse(req.body);
    const profile = await fhirProfileValidator.createProfile(validated);

    logHipaaAudit("PROFILE_CREATED", `Profile ${profile.name} (${profile.id})`);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error creating profile:", error);
    res.status(400).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to create profile",
    });
  }
});

router.patch("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = await fhirProfileValidator.updateProfile(profileId, req.body);

    logHipaaAudit("PROFILE_UPDATED", `Profile ${profile.name} (${profileId})`);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error updating profile:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update profile",
    });
  }
});

router.delete("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    await fhirProfileValidator.deleteProfile(profileId);

    logHipaaAudit("PROFILE_DELETED", `Profile ${profileId}`);

    res.json({
      success: true,
      message: "Profile deleted",
    });
  } catch (error) {
    console.error("[ProfileValidator] Error deleting profile:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete profile",
    });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = fhirProfileValidator.getValidationStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stats",
    });
  }
});

router.get("/resource-types", async (_req: Request, res: Response) => {
  try {
    const types = fhirProfileValidator.getSupportedResourceTypes();

    res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("[ProfileValidator] Error getting resource types:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get resource types",
    });
  }
});

export default router;
