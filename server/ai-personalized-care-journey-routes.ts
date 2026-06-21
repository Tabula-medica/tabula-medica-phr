import { Router, Request, Response } from "express";
import {
  createPersonalizedCareJourney,
  getPatientCareJourneys,
  getAITreatmentRecommendations,
  getPersonalizedEducationContent,
  generateAdaptiveReminders,
  updateJourneyFromProgress,
  getAvailablePatients,
} from "./services/ai-personalized-care-journey-service";

const router = Router();

const NO_CDS_DISCLAIMER = "IMPORTANT: This is NOT clinical decision support. All content is for patient engagement, education, and care coordination only. Treatment decisions must be made by qualified healthcare professionals.";

function logHipaaAudit(action: string, userId: string, patientId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][CareJourneyRoutes] ${timestamp} | Action: ${action} | User: ${userId} | Patient: ${patientId} | Details: ${details}`);
}

router.get("/patients", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || "system";
    logHipaaAudit("LIST_PATIENTS", userId, "all", "Fetching available patients");
    
    const result = await getAvailablePatients();
    
    logHipaaAudit("LIST_PATIENTS_SUCCESS", userId, "all", `Retrieved ${result.patients.length} patients`);
    res.json({ success: true, ...result });
  } catch (error) {
    const userId = (req.query.userId as string) || "system";
    logHipaaAudit("LIST_PATIENTS_ERROR", userId, "all", `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error fetching patients:", error);
    res.status(500).json({ error: "Failed to fetch patients", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/journeys", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || "system";
    const patientId = req.query.patientId as string | undefined;

    logHipaaAudit("LIST_JOURNEYS", userId, patientId || "all", "Fetching care journeys");

    const result = await getPatientCareJourneys(userId, patientId);

    logHipaaAudit("LIST_JOURNEYS_SUCCESS", userId, patientId || "all", `Retrieved ${result.journeys.length} journeys`);

    res.json({ success: true, ...result });
  } catch (error) {
    const userId = (req.query.userId as string) || "system";
    logHipaaAudit("LIST_JOURNEYS_ERROR", userId, "all", `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error fetching journeys:", error);
    res.status(500).json({ error: "Failed to fetch care journeys", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.post("/journeys", async (req: Request, res: Response) => {
  try {
    const { userId = "system", patientId, journeyType = "Comprehensive Care" } = req.body;

    if (!patientId) {
      logHipaaAudit("CREATE_JOURNEY_ERROR", userId, "none", "Missing patientId");
      return res.status(400).json({ error: "patientId is required", disclaimer: NO_CDS_DISCLAIMER });
    }

    logHipaaAudit("CREATE_JOURNEY", userId, patientId, `Creating ${journeyType} journey`);

    const journey = await createPersonalizedCareJourney(userId, patientId, journeyType);

    logHipaaAudit("CREATE_JOURNEY_SUCCESS", userId, patientId, `Journey ${journey.journeyId} created`);

    res.json({ success: true, journey });
  } catch (error) {
    const userId = req.body?.userId || "system";
    const patientId = req.body?.patientId || "unknown";
    logHipaaAudit("CREATE_JOURNEY_ERROR", userId, patientId, `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error creating journey:", error);
    res.status(500).json({ error: "Failed to create care journey", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/recommendations/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req.query.userId as string) || "system";
    const recentLabResults = req.query.labResults as string | undefined;
    const symptoms = req.query.symptoms ? (req.query.symptoms as string).split(",") : undefined;

    logHipaaAudit("GET_RECOMMENDATIONS", userId, patientId, `Labs: ${recentLabResults ? "yes" : "no"}, Symptoms: ${symptoms?.length || 0}`);

    const result = await getAITreatmentRecommendations(userId, patientId, {
      recentLabResults,
      symptoms,
    });

    logHipaaAudit("GET_RECOMMENDATIONS_SUCCESS", userId, patientId, `${result.recommendations.length} recommendations generated`);

    res.json({ success: true, ...result });
  } catch (error) {
    const userId = (req.query.userId as string) || "system";
    const patientId = req.params.patientId;
    logHipaaAudit("GET_RECOMMENDATIONS_ERROR", userId, patientId, `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error getting recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/education/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req.query.userId as string) || "system";
    const topic = req.query.topic as string | undefined;

    logHipaaAudit("GET_EDUCATION", userId, patientId, `Topic: ${topic || "all"}`);

    const result = await getPersonalizedEducationContent(userId, patientId, topic);

    logHipaaAudit("GET_EDUCATION_SUCCESS", userId, patientId, `${result.content.length} education items generated`);

    res.json({ success: true, ...result });
  } catch (error) {
    const userId = (req.query.userId as string) || "system";
    const patientId = req.params.patientId;
    logHipaaAudit("GET_EDUCATION_ERROR", userId, patientId, `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error getting education content:", error);
    res.status(500).json({ error: "Failed to generate education content", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/reminders/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req.query.userId as string) || "system";
    const adherenceRate = req.query.adherenceRate ? parseFloat(req.query.adherenceRate as string) : undefined;
    const engagementScore = req.query.engagementScore ? parseFloat(req.query.engagementScore as string) : undefined;

    logHipaaAudit("GET_REMINDERS", userId, patientId, `Adherence: ${adherenceRate || "N/A"}, Engagement: ${engagementScore || "N/A"}`);

    const result = await generateAdaptiveReminders(userId, patientId, {
      adherenceRate,
      engagementScore,
    });

    logHipaaAudit("GET_REMINDERS_SUCCESS", userId, patientId, `${result.reminders.length} reminders generated`);

    res.json({ success: true, ...result });
  } catch (error) {
    const userId = (req.query.userId as string) || "system";
    const patientId = req.params.patientId;
    logHipaaAudit("GET_REMINDERS_ERROR", userId, patientId, `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error generating reminders:", error);
    res.status(500).json({ error: "Failed to generate reminders", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.post("/progress/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { userId = "system", completedTasks, completedMilestones, feedback, symptoms, adherenceData } = req.body;

    logHipaaAudit("UPDATE_PROGRESS", userId, patientId, `Tasks: ${completedTasks?.length || 0}, Milestones: ${completedMilestones?.length || 0}, Feedback: ${feedback ? "yes" : "no"}`);

    const result = await updateJourneyFromProgress(userId, patientId, {
      completedTasks,
      completedMilestones,
      feedback,
      symptoms,
      adherenceData,
    });

    logHipaaAudit("UPDATE_PROGRESS_SUCCESS", userId, patientId, `Progress: ${result.updatedProgress.overallProgress}%, Adaptations: ${result.adaptations.length}`);

    res.json({ success: true, ...result });
  } catch (error) {
    const userId = req.body?.userId || "system";
    const patientId = req.params.patientId;
    logHipaaAudit("UPDATE_PROGRESS_ERROR", userId, patientId, `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    console.error("[CareJourney] Error updating progress:", error);
    res.status(500).json({ error: "Failed to update progress", disclaimer: NO_CDS_DISCLAIMER });
  }
});

console.log("[CareJourneyRoutes] Routes module loaded with NO-CDS compliance");

export default router;
