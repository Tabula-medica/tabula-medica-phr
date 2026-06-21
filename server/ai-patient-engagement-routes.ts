import { Router, Request, Response } from "express";
import * as engagementService from "./services/ai-patient-engagement-service";

const router = Router();

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const dashboard = await engagementService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[AIPatientEngagement] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.get("/outreach", async (_req: Request, res: Response) => {
  try {
    const outreach = await engagementService.getPreventiveOutreach();
    res.json(outreach);
  } catch (error) {
    console.error("[AIPatientEngagement] Outreach fetch error:", error);
    res.status(500).json({ error: "Failed to fetch outreach" });
  }
});

router.post("/outreach/generate/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const outreach = await engagementService.generateProactiveOutreach(patientId);
    res.json(outreach);
  } catch (error) {
    console.error("[AIPatientEngagement] Generate outreach error:", error);
    res.status(500).json({ error: "Failed to generate outreach" });
  }
});

router.patch("/outreach/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const outreach = await engagementService.updateOutreachStatus(id, status);
    if (!outreach) {
      return res.status(404).json({ error: "Outreach not found" });
    }
    res.json(outreach);
  } catch (error) {
    console.error("[AIPatientEngagement] Update outreach error:", error);
    res.status(500).json({ error: "Failed to update outreach status" });
  }
});

router.get("/education", async (_req: Request, res: Response) => {
  try {
    const education = await engagementService.getPersonalizedEducation();
    res.json(education);
  } catch (error) {
    console.error("[AIPatientEngagement] Education fetch error:", error);
    res.status(500).json({ error: "Failed to fetch education content" });
  }
});

router.post("/education/:id/deliver", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const content = await engagementService.deliverEducationContent(id);
    if (!content) {
      return res.status(404).json({ error: "Education content not found" });
    }
    res.json(content);
  } catch (error) {
    console.error("[AIPatientEngagement] Deliver education error:", error);
    res.status(500).json({ error: "Failed to deliver education content" });
  }
});

router.post("/education/:id/view", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const content = await engagementService.markEducationViewed(id);
    if (!content) {
      return res.status(404).json({ error: "Education content not found" });
    }
    res.json(content);
  } catch (error) {
    console.error("[AIPatientEngagement] Mark viewed error:", error);
    res.status(500).json({ error: "Failed to mark content as viewed" });
  }
});

router.post("/education/:id/rate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const content = await engagementService.rateEducationContent(id, rating);
    if (!content) {
      return res.status(404).json({ error: "Education content not found" });
    }
    res.json(content);
  } catch (error) {
    console.error("[AIPatientEngagement] Rate content error:", error);
    res.status(500).json({ error: "Failed to rate education content" });
  }
});

router.get("/reminders", async (_req: Request, res: Response) => {
  try {
    const reminders = await engagementService.getAppointmentReminders();
    res.json(reminders);
  } catch (error) {
    console.error("[AIPatientEngagement] Reminders fetch error:", error);
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

router.post("/reminders/:id/send", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reminder = await engagementService.sendReminder(id);
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }
    res.json(reminder);
  } catch (error) {
    console.error("[AIPatientEngagement] Send reminder error:", error);
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

router.post("/reminders/:id/confirm", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reminder = await engagementService.confirmAppointment(id);
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }
    res.json(reminder);
  } catch (error) {
    console.error("[AIPatientEngagement] Confirm appointment error:", error);
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
});

router.post("/reminders/:id/reschedule", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { slotIndex } = req.body;
    const reminder = await engagementService.requestReschedule(id, slotIndex);
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }
    res.json(reminder);
  } catch (error) {
    console.error("[AIPatientEngagement] Reschedule error:", error);
    res.status(500).json({ error: "Failed to reschedule appointment" });
  }
});

router.get("/surveys", async (_req: Request, res: Response) => {
  try {
    const surveys = await engagementService.getSatisfactionSurveys();
    res.json(surveys);
  } catch (error) {
    console.error("[AIPatientEngagement] Surveys fetch error:", error);
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

router.post("/surveys/:id/send", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const survey = await engagementService.sendSurvey(id);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    res.json(survey);
  } catch (error) {
    console.error("[AIPatientEngagement] Send survey error:", error);
    res.status(500).json({ error: "Failed to send survey" });
  }
});

router.post("/surveys/:id/submit", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { responses } = req.body;
    const survey = await engagementService.submitSurveyResponses(id, responses);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    res.json(survey);
  } catch (error) {
    console.error("[AIPatientEngagement] Submit survey error:", error);
    res.status(500).json({ error: "Failed to submit survey responses" });
  }
});

router.post("/surveys/create", async (req: Request, res: Response) => {
  try {
    const { visitId, patientId, patientName, providerName, visitType } = req.body;
    const survey = await engagementService.createAutomatedSurvey(
      visitId, patientId, patientName, providerName, visitType
    );
    res.json(survey);
  } catch (error) {
    console.error("[AIPatientEngagement] Create survey error:", error);
    res.status(500).json({ error: "Failed to create survey" });
  }
});

console.log("[Routes] AI Patient Engagement routes registered at /api/patient-engagement-ai/*");

export default router;
