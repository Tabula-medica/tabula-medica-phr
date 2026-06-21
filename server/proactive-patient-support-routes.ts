import { Router, Request, Response } from "express";
import { z } from "zod";
import { proactivePatientSupportService } from "./services/proactive-patient-support-service";

const router = Router();

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated recommendations are for INFORMATIONAL purposes only. They do NOT constitute clinical decision support or medical advice. All clinical decisions must be made by qualified healthcare professionals.";

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await proactivePatientSupportService.getStats();
    res.json({
      success: true,
      data: stats,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stats"
    });
  }
});

router.get("/patients", async (_req: Request, res: Response) => {
  try {
    const profiles = proactivePatientSupportService.getAllProfiles();
    res.json({
      success: true,
      data: profiles,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error fetching patients:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch patient profiles"
    });
  }
});

router.get("/patients/needs-support", async (_req: Request, res: Response) => {
  try {
    const patients = await proactivePatientSupportService.identifyPatientsNeedingSupport();
    res.json({
      success: true,
      data: patients,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error identifying patients:", error);
    res.status(500).json({
      success: false,
      error: "Failed to identify patients needing support"
    });
  }
});

router.get("/patients/:patientId", async (req: Request, res: Response) => {
  try {
    const profile = await proactivePatientSupportService.getPatientSupportProfile(req.params.patientId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Patient profile not found"
      });
    }
    res.json({
      success: true,
      data: profile,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error fetching patient:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch patient profile"
    });
  }
});

router.post("/patients/:patientId/analyze", async (req: Request, res: Response) => {
  try {
    const analysis = await proactivePatientSupportService.analyzePatientForSupport(req.params.patientId);
    res.json({
      success: true,
      data: analysis,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error analyzing patient:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze patient"
    });
  }
});

const outreachSchema = z.object({
  outreachType: z.enum(["initial", "follow_up", "reminder", "wellness", "care_gap", "adverse_event"]),
  supportNeedId: z.string().optional()
});

router.post("/patients/:patientId/outreach", async (req: Request, res: Response) => {
  try {
    const parsed = outreachSchema.parse(req.body);
    const outreach = await proactivePatientSupportService.generatePersonalizedOutreach(
      req.params.patientId,
      parsed.outreachType,
      parsed.supportNeedId
    );
    res.json({
      success: true,
      data: outreach,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors
      });
    }
    console.error("[ProactiveSupportRoutes] Error generating outreach:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate outreach"
    });
  }
});

router.get("/patients/:patientId/wellness-programs", async (req: Request, res: Response) => {
  try {
    const programs = await proactivePatientSupportService.recommendWellnessPrograms(req.params.patientId);
    res.json({
      success: true,
      data: programs,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error recommending programs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to recommend wellness programs"
    });
  }
});

const followUpSchema = z.object({
  followUpType: z.enum(["routine", "post_visit", "post_adverse_event", "medication_check"]),
  daysFromNow: z.number().min(1).max(365)
});

router.post("/patients/:patientId/schedule-follow-up", async (req: Request, res: Response) => {
  try {
    const parsed = followUpSchema.parse(req.body);
    const result = await proactivePatientSupportService.scheduleFollowUp(
      req.params.patientId,
      parsed.followUpType,
      parsed.daysFromNow
    );
    res.json({
      success: true,
      data: result,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors
      });
    }
    console.error("[ProactiveSupportRoutes] Error scheduling follow-up:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to schedule follow-up"
    });
  }
});

const updateNeedSchema = z.object({
  status: z.enum(["identified", "outreach_sent", "in_progress", "resolved", "declined"])
});

router.patch("/patients/:patientId/needs/:needId", async (req: Request, res: Response) => {
  try {
    const parsed = updateNeedSchema.parse(req.body);
    const need = await proactivePatientSupportService.updateSupportNeedStatus(
      req.params.patientId,
      req.params.needId,
      parsed.status
    );
    if (!need) {
      return res.status(404).json({
        success: false,
        error: "Support need not found"
      });
    }
    res.json({
      success: true,
      data: need,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors
      });
    }
    console.error("[ProactiveSupportRoutes] Error updating need:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update support need"
    });
  }
});

router.get("/campaigns", async (_req: Request, res: Response) => {
  try {
    const campaigns = proactivePatientSupportService.getAllCampaigns();
    res.json({
      success: true,
      data: campaigns,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error fetching campaigns:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch campaigns"
    });
  }
});

router.get("/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const campaign = proactivePatientSupportService.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found"
      });
    }
    res.json({
      success: true,
      data: campaign,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error fetching campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch campaign"
    });
  }
});

router.get("/wellness-programs", async (_req: Request, res: Response) => {
  try {
    const programs = proactivePatientSupportService.getAllWellnessPrograms();
    res.json({
      success: true,
      data: programs,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[ProactiveSupportRoutes] Error fetching wellness programs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch wellness programs"
    });
  }
});

export default router;
