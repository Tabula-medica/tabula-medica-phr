import { Express, Request, Response } from "express";
import {
  summarizePatientHistory,
  summarizeConsultation,
  summarizeRecentConsultations,
  getMockPatientData,
  type PatientData,
} from "./services/ai-medical-assistant";
import { logPhiAccess } from "./security/hipaa-audit";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";

export function registerAIMedicalAssistantRoutes(app: Express) {
  console.log("[Routes] AI Medical Assistant routes registered at /api/medical-assistant");

  app.get("/api/medical-assistant/patient/:patientId/summary", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      await logPhiAccess({
        userId: (req as any).user?.id || "current-user",
        action: "read",
        resourceType: "PatientHistorySummary",
        resourceId: patientId,
        details: `AI-generated patient history summary for ${patientId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const patientData = getMockPatientData(patientId);
      const summary = await summarizePatientHistory(patientData);

      res.json({
        success: true,
        data: summary,
        patientInfo: {
          id: patientData.patientId,
          name: patientData.name,
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
        },
      });
    } catch (error) {
      console.error("[AIMedicalAssistant] Error generating patient summary:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate patient summary",
      });
    }
  });

  app.get("/api/medical-assistant/patient/:patientId/consultations", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const { limit = "5" } = req.query;

      await logPhiAccess({
        userId: (req as any).user?.id || "current-user",
        action: "read",
        resourceType: "ConsultationSummaries",
        resourceId: patientId,
        details: `AI-generated consultation summaries for ${patientId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const patientData = getMockPatientData(patientId);
      const consultations = patientData.consultations.slice(0, parseInt(limit as string));

      const result = await summarizeRecentConsultations(
        consultations,
        {
          name: patientData.name,
          conditions: patientData.conditions.map((c) => c.name),
        }
      );

      res.json({
        success: true,
        data: result,
        patientInfo: {
          id: patientData.patientId,
          name: patientData.name,
        },
      });
    } catch (error) {
      console.error("[AIMedicalAssistant] Error generating consultation summaries:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate consultation summaries",
      });
    }
  });

  app.get("/api/medical-assistant/patient/:patientId/consultation/:consultationId", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { patientId, consultationId } = req.params;

      await logPhiAccess({
        userId: (req as any).user?.id || "current-user",
        action: "read",
        resourceType: "ConsultationSummary",
        resourceId: `${patientId}/${consultationId}`,
        details: `AI-generated consultation summary for consultation ${consultationId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const patientData = getMockPatientData(patientId);
      const consultation = patientData.consultations.find((c) => c.id === consultationId);

      if (!consultation) {
        return res.status(404).json({
          success: false,
          error: "Consultation not found",
        });
      }

      const summary = await summarizeConsultation(consultation, {
        name: patientData.name,
        conditions: patientData.conditions.map((c) => c.name),
      });

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("[AIMedicalAssistant] Error generating consultation summary:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate consultation summary",
      });
    }
  });

  app.post("/api/medical-assistant/summarize", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { patientData } = req.body as { patientData: PatientData };

      if (!patientData || !patientData.patientId) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: patientData",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "current-user",
        action: "read",
        resourceType: "PatientHistorySummary",
        resourceId: patientData.patientId,
        details: `Custom patient data summarization`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const summary = await summarizePatientHistory(patientData);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("[AIMedicalAssistant] Error summarizing patient data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to summarize patient data",
      });
    }
  });

  app.get("/api/medical-assistant/sample-patients", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    await logPhiAccess({
      userId: (req as any).user?.id || "current-user",
      action: "read",
      resourceType: "PatientList",
      details: "Accessed sample patient list for AI Medical Assistant",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    res.json({
      success: true,
      data: [
        { id: "patient-001", name: "John Smith", conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"] },
        { id: "patient-002", name: "Maria Garcia", conditions: ["Asthma", "Anxiety"] },
      ],
    });
  });
}
