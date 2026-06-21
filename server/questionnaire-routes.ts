import { Express, Request, Response } from "express";
import {
  getQuestionnaires,
  getQuestionnaireById,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  getPatientResponses,
  getQuestionnaireResponses,
  getAllResponses,
  submitQuestionnaireResponse,
  getResponseById,
  getRecentAlerts,
  QuestionAnswer,
} from "./services/questionnaire-service";

export function registerQuestionnaireRoutes(app: Express): void {
  app.get("/api/questionnaires", async (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const questionnaires = getQuestionnaires(activeOnly);
      res.json({ questionnaires });
    } catch (error) {
      console.error("[Questionnaire] Error fetching questionnaires:", error);
      res.status(500).json({ error: "Failed to fetch questionnaires" });
    }
  });

  app.get("/api/questionnaires/:id", async (req: Request, res: Response) => {
    try {
      const questionnaire = getQuestionnaireById(req.params.id);
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      res.json({ questionnaire });
    } catch (error) {
      console.error("[Questionnaire] Error fetching questionnaire:", error);
      res.status(500).json({ error: "Failed to fetch questionnaire" });
    }
  });

  app.post("/api/questionnaires", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "admin";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      const questionnaire = await createQuestionnaire(
        { ...req.body, createdBy: userId },
        userId,
        ipAddress,
        userAgent
      );
      
      res.status(201).json({ questionnaire });
    } catch (error) {
      console.error("[Questionnaire] Error creating questionnaire:", error);
      res.status(500).json({ error: "Failed to create questionnaire" });
    }
  });

  app.patch("/api/questionnaires/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "admin";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      const questionnaire = await updateQuestionnaire(
        req.params.id,
        req.body,
        userId,
        ipAddress,
        userAgent
      );
      
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      
      res.json({ questionnaire });
    } catch (error) {
      console.error("[Questionnaire] Error updating questionnaire:", error);
      res.status(500).json({ error: "Failed to update questionnaire" });
    }
  });

  app.delete("/api/questionnaires/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "admin";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      const deleted = await deleteQuestionnaire(req.params.id, userId, ipAddress, userAgent);
      
      if (!deleted) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Questionnaire] Error deleting questionnaire:", error);
      res.status(500).json({ error: "Failed to delete questionnaire" });
    }
  });

  app.get("/api/questionnaires/:id/responses", async (req: Request, res: Response) => {
    try {
      const responses = getQuestionnaireResponses(req.params.id);
      res.json({ responses });
    } catch (error) {
      console.error("[Questionnaire] Error fetching responses:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  app.get("/api/patient-portal/:patientId/questionnaires", async (req: Request, res: Response) => {
    try {
      const questionnaires = getQuestionnaires(true);
      res.json({ questionnaires });
    } catch (error) {
      console.error("[Questionnaire] Error fetching patient questionnaires:", error);
      res.status(500).json({ error: "Failed to fetch questionnaires" });
    }
  });

  app.get("/api/patient-portal/:patientId/responses", async (req: Request, res: Response) => {
    try {
      const responses = getPatientResponses(req.params.patientId);
      res.json({ responses });
    } catch (error) {
      console.error("[Questionnaire] Error fetching patient responses:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  app.post("/api/patient-portal/:patientId/questionnaires/:questionnaireId/submit", async (req: Request, res: Response) => {
    try {
      const { patientId, questionnaireId } = req.params;
      const { patientName, answers } = req.body as { patientName: string; answers: QuestionAnswer[] };
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Answers are required" });
      }
      
      const result = await submitQuestionnaireResponse(
        questionnaireId,
        patientId,
        patientName,
        answers,
        ipAddress,
        userAgent
      );
      
      res.status(201).json({
        response: result.response,
        alerts: result.alerts,
        message: result.alerts.length > 0
          ? `Response submitted. ${result.alerts.length} alert(s) sent to your care team.`
          : "Response submitted successfully.",
      });
    } catch (error) {
      console.error("[Questionnaire] Error submitting response:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  app.get("/api/questionnaire-responses", async (req: Request, res: Response) => {
    try {
      const responses = getAllResponses();
      res.json({ responses });
    } catch (error) {
      console.error("[Questionnaire] Error fetching all responses:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  app.get("/api/questionnaire-responses/:id", async (req: Request, res: Response) => {
    try {
      const response = getResponseById(req.params.id);
      if (!response) {
        return res.status(404).json({ error: "Response not found" });
      }
      res.json({ response });
    } catch (error) {
      console.error("[Questionnaire] Error fetching response:", error);
      res.status(500).json({ error: "Failed to fetch response" });
    }
  });

  app.get("/api/questionnaire-alerts", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const alerts = getRecentAlerts(limit);
      res.json({ alerts });
    } catch (error) {
      console.error("[Questionnaire] Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });
}
