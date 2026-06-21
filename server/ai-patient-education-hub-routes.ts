import { Router, Request, Response } from "express";
import { aiPatientEducationHubService } from "./services/ai-patient-education-hub";
import { z } from "zod";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][PATIENT-EDUCATION] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Patient education audit log. Educational content only, not clinical decision-making."
  })}`);
}

router.get("/profile/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GET_EDUCATION_PROFILE", { patientId }, req);

  try {
    const profile = await aiPatientEducationHubService.getOrCreatePatientProfile(patientId);
    res.json({
      profile,
      noCdsCompliance: "Patient education profile for personalized learning. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting education profile:", error);
    res.status(500).json({ error: "Failed to get education profile" });
  }
});

router.get("/progress/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GET_EDUCATION_PROGRESS", { patientId }, req);

  try {
    const progress = await aiPatientEducationHubService.getPatientProgress(patientId);
    res.json({
      progress,
      noCdsCompliance: "Education progress tracking. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting education progress:", error);
    res.status(500).json({ error: "Failed to get education progress" });
  }
});

const GenerateContentSchema = z.object({
  topic: z.string().optional(),
  category: z.enum(["condition", "medication", "treatment", "lifestyle", "prevention", "nutrition", "mental_health", "emergency"]).optional()
});

router.post("/content/generate/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GENERATE_PERSONALIZED_CONTENT", { patientId }, req);

  try {
    const validation = GenerateContentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const { topic, category } = validation.data;
    const content = await aiPatientEducationHubService.generatePersonalizedContent(patientId, topic, category);
    
    res.json({
      content,
      noCdsCompliance: content.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating personalized content:", error);
    res.status(500).json({ error: "Failed to generate personalized content" });
  }
});

router.get("/content/:contentId", (req: Request, res: Response) => {
  const { contentId } = req.params;
  logHIPAAAudit("GET_CONTENT", { contentId }, req);

  try {
    const content = aiPatientEducationHubService.getPersonalizedContent(contentId);
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }
    res.json({
      content,
      noCdsCompliance: content.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting content:", error);
    res.status(500).json({ error: "Failed to get content" });
  }
});

const GenerateMedTutorialSchema = z.object({
  medicationName: z.string()
});

router.post("/tutorials/medication/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GENERATE_MEDICATION_TUTORIAL", { patientId }, req);

  try {
    const validation = GenerateMedTutorialSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const tutorial = await aiPatientEducationHubService.generateMedicationAdherenceTutorial(
      patientId,
      validation.data.medicationName
    );
    
    res.json({
      tutorial,
      noCdsCompliance: tutorial.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating medication tutorial:", error);
    res.status(500).json({ error: "Failed to generate medication tutorial" });
  }
});

router.get("/tutorials/medication/:tutorialId", (req: Request, res: Response) => {
  const { tutorialId } = req.params;
  logHIPAAAudit("GET_MEDICATION_TUTORIAL", { tutorialId }, req);

  try {
    const tutorial = aiPatientEducationHubService.getMedicationTutorial(tutorialId);
    if (!tutorial) {
      return res.status(404).json({ error: "Tutorial not found" });
    }
    res.json({
      tutorial,
      noCdsCompliance: tutorial.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting medication tutorial:", error);
    res.status(500).json({ error: "Failed to get medication tutorial" });
  }
});

const GenerateTreatmentTutorialSchema = z.object({
  treatmentPlanId: z.string().optional()
});

router.post("/tutorials/treatment/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GENERATE_TREATMENT_TUTORIAL", { patientId }, req);

  try {
    const validation = GenerateTreatmentTutorialSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const tutorial = await aiPatientEducationHubService.generateTreatmentPlanTutorial(
      patientId,
      validation.data.treatmentPlanId
    );
    
    res.json({
      tutorial,
      noCdsCompliance: tutorial.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating treatment tutorial:", error);
    res.status(500).json({ error: "Failed to generate treatment tutorial" });
  }
});

router.get("/tutorials/treatment/:tutorialId", (req: Request, res: Response) => {
  const { tutorialId } = req.params;
  logHIPAAAudit("GET_TREATMENT_TUTORIAL", { tutorialId }, req);

  try {
    const tutorial = aiPatientEducationHubService.getTreatmentTutorial(tutorialId);
    if (!tutorial) {
      return res.status(404).json({ error: "Tutorial not found" });
    }
    res.json({
      tutorial,
      noCdsCompliance: tutorial.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting treatment tutorial:", error);
    res.status(500).json({ error: "Failed to get treatment tutorial" });
  }
});

const UpdateProgressSchema = z.object({
  stepId: z.string(),
  type: z.enum(["medication", "treatment"])
});

router.post("/tutorials/:tutorialId/progress", async (req: Request, res: Response) => {
  const { tutorialId } = req.params;
  logHIPAAAudit("UPDATE_TUTORIAL_PROGRESS", { tutorialId }, req);

  try {
    const validation = UpdateProgressSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const result = await aiPatientEducationHubService.updateTutorialProgress(
      tutorialId,
      validation.data.stepId,
      validation.data.type
    );
    
    if (!result.success) {
      return res.status(404).json({ error: "Tutorial not found" });
    }

    res.json({
      ...result,
      noCdsCompliance: "Tutorial progress update. Educational tracking only."
    });
  } catch (error) {
    console.error("Error updating tutorial progress:", error);
    res.status(500).json({ error: "Failed to update tutorial progress" });
  }
});

router.get("/recommendations/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GET_RECOMMENDATIONS", { patientId }, req);

  try {
    let recs = aiPatientEducationHubService.getPatientRecommendations(patientId);
    
    if (recs.length === 0) {
      recs = await aiPatientEducationHubService.generateContentRecommendations(patientId);
    }

    res.json({
      recommendations: recs,
      count: recs.length,
      noCdsCompliance: "Educational content recommendations. Not medical advice."
    });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

router.post("/recommendations/:patientId/generate", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  logHIPAAAudit("GENERATE_RECOMMENDATIONS", { patientId }, req);

  try {
    const recs = await aiPatientEducationHubService.generateContentRecommendations(patientId);
    res.json({
      recommendations: recs,
      count: recs.length,
      noCdsCompliance: "AI-generated educational recommendations. Not medical advice."
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

const UpdateRecommendationSchema = z.object({
  status: z.enum(["viewed", "dismissed", "completed"])
});

router.patch("/recommendations/:patientId/:recommendationId", async (req: Request, res: Response) => {
  const { patientId, recommendationId } = req.params;
  logHIPAAAudit("UPDATE_RECOMMENDATION_STATUS", { patientId, recommendationId }, req);

  try {
    const validation = UpdateRecommendationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const success = await aiPatientEducationHubService.updateRecommendationStatus(
      patientId,
      recommendationId,
      validation.data.status
    );

    if (!success) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    res.json({
      success: true,
      noCdsCompliance: "Recommendation status update. Educational tracking only."
    });
  } catch (error) {
    console.error("Error updating recommendation:", error);
    res.status(500).json({ error: "Failed to update recommendation" });
  }
});

export default router;
