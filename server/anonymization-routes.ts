import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirAnonymizationEngine, AnonymizationMethod, PHICategory } from "./services/fhir-anonymization-engine";

const router = Router();

function logHipaaAudit(action: string, details: string, userId: string = "system") {
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} - ${action}: ${details} by ${userId}`);
}

const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(["name", "address", "date", "phone", "fax", "email", "url", "ssn", "mrn", "account_number", "certificate_license", "vehicle_id", "device_id", "ip_address", "biometric", "photo", "geographic", "age_over_89", "other_identifier"]),
  fhirPaths: z.array(z.string()).min(1),
  method: z.enum(["redact", "hash", "generalize", "date_shift", "zip_truncate", "age_range", "pseudonymize", "mask"]),
  parameters: z.record(z.unknown()).optional(),
  enabled: z.boolean(),
  priority: z.number().min(1).max(100),
});

const profileSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  useCase: z.enum(["research", "testing", "training", "analytics", "custom"]),
  rules: z.array(ruleSchema),
  preserveReferentialIntegrity: z.boolean(),
  dateShiftDays: z.number().optional(),
  createdBy: z.string(),
});

router.post("/anonymize", async (req: Request, res: Response) => {
  try {
    const { resource, profileId } = req.body;

    if (!resource || !profileId) {
      return res.status(400).json({
        success: false,
        error: "Missing resource or profileId",
      });
    }

    const result = await fhirAnonymizationEngine.anonymizeResource(resource, profileId);

    logHipaaAudit("RESOURCE_ANONYMIZED", `${resource.resourceType}/${resource.id} using ${profileId}`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Anonymization] Error anonymizing resource:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to anonymize resource",
    });
  }
});

router.post("/anonymize/batch", async (req: Request, res: Response) => {
  try {
    const { resources, profileId } = req.body;

    if (!Array.isArray(resources) || !profileId) {
      return res.status(400).json({
        success: false,
        error: "Missing resources array or profileId",
      });
    }

    const job = await fhirAnonymizationEngine.startBatchJob(profileId, resources);

    logHipaaAudit("BATCH_ANONYMIZATION_STARTED", `Job ${job.id} with ${resources.length} resources`);

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("[Anonymization] Error starting batch job:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start batch job",
    });
  }
});

router.get("/jobs", async (_req: Request, res: Response) => {
  try {
    const jobs = await fhirAnonymizationEngine.listJobs();

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error("[Anonymization] Error listing jobs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list jobs",
    });
  }
});

router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await fhirAnonymizationEngine.getJob(jobId);

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
    console.error("[Anonymization] Error getting job:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get job",
    });
  }
});

router.get("/profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = await fhirAnonymizationEngine.listProfiles();

    logHipaaAudit("PROFILES_LISTED", `${profiles.length} profiles retrieved`);

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    console.error("[Anonymization] Error listing profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list profiles",
    });
  }
});

router.get("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = await fhirAnonymizationEngine.getProfile(profileId);

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
    console.error("[Anonymization] Error getting profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get profile",
    });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const validated = profileSchema.parse(req.body);
    const profile = await fhirAnonymizationEngine.createProfile(validated);

    logHipaaAudit("PROFILE_CREATED", `Profile ${profile.name} (${profile.id})`);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("[Anonymization] Error creating profile:", error);
    res.status(400).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to create profile",
    });
  }
});

router.patch("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = await fhirAnonymizationEngine.updateProfile(profileId, req.body);

    logHipaaAudit("PROFILE_UPDATED", `Profile ${profile.name} (${profileId})`);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("[Anonymization] Error updating profile:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update profile",
    });
  }
});

router.delete("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    await fhirAnonymizationEngine.deleteProfile(profileId);

    logHipaaAudit("PROFILE_DELETED", `Profile ${profileId}`);

    res.json({
      success: true,
      message: "Profile deleted",
    });
  } catch (error) {
    console.error("[Anonymization] Error deleting profile:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete profile",
    });
  }
});

router.get("/methods", async (_req: Request, res: Response) => {
  try {
    const methods = fhirAnonymizationEngine.getAvailableMethods();

    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error("[Anonymization] Error getting methods:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get methods",
    });
  }
});

router.get("/phi-categories", async (_req: Request, res: Response) => {
  try {
    const categories = fhirAnonymizationEngine.getPHICategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("[Anonymization] Error getting PHI categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get PHI categories",
    });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = fhirAnonymizationEngine.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[Anonymization] Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stats",
    });
  }
});

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { resource, rules } = req.body;

    if (!resource || !Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: "Missing resource or rules array",
      });
    }

    const rulesWithIds = rules.map((r: Record<string, unknown>, idx: number) => ({
      ...r,
      id: r.id || `preview-rule-${idx}`,
    }));

    const tempProfile = await fhirAnonymizationEngine.createProfile({
      name: "Preview Profile",
      description: "Temporary profile for preview",
      useCase: "custom",
      rules: rulesWithIds,
      preserveReferentialIntegrity: false,
      createdBy: "system",
    });

    const result = await fhirAnonymizationEngine.anonymizeResource(resource, tempProfile.id);

    await fhirAnonymizationEngine.deleteProfile(tempProfile.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Anonymization] Error previewing:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to preview",
    });
  }
});

export default router;
