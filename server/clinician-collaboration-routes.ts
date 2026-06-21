import { Express, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  getSharedCases,
  getCaseById,
  getAvailableClinicians,
  generateAICaseSummary,
  generateAlertAnalysis,
  addDiscussionNote,
  addDifferentialConsideration,
  acknowledgeAlert,
  createSharedCase,
} from "./services/clinician-collaboration";

export function registerClinicianCollaborationRoutes(app: Express) {
  app.get("/api/collaboration/cases", async (req: Request, res: Response) => {
    try {
      const clinicianId = (req as any).user?.id || "clinician-001";

      await logPhiAccess({
        userId: clinicianId,
        action: "read",
        resourceType: "SharedCaseList",
        details: "Clinician accessed shared patient cases list",
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const cases = await getSharedCases(clinicianId);
      res.json({ success: true, data: cases });
    } catch (error) {
      console.error("Error fetching shared cases:", error);
      res.status(500).json({ success: false, error: "Failed to fetch shared cases" });
    }
  });

  app.get("/api/collaboration/cases/:caseId", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const clinicianId = (req as any).user?.id || "clinician-001";

      await logPhiAccess({
        userId: clinicianId,
        action: "read",
        resourceType: "SharedCase",
        resourceId: caseId,
        details: `Clinician accessed shared patient case ${caseId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const caseData = await getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ success: false, error: "Case not found" });
      }

      res.json({ success: true, data: caseData });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ success: false, error: "Failed to fetch case" });
    }
  });

  app.get("/api/collaboration/clinicians", async (req: Request, res: Response) => {
    try {
      const clinicians = await getAvailableClinicians();
      res.json({ success: true, data: clinicians });
    } catch (error) {
      console.error("Error fetching clinicians:", error);
      res.status(500).json({ success: false, error: "Failed to fetch clinicians" });
    }
  });

  app.post("/api/collaboration/cases", async (req: Request, res: Response) => {
    try {
      const clinicianId = (req as any).user?.id || "clinician-001";
      const { patientId, patientName, sharedWith, summary, clinicalContext } = req.body;

      if (!patientId || !patientName || !summary) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      await logPhiAccess({
        userId: clinicianId,
        action: "write",
        resourceType: "SharedCase",
        details: `Created shared case for patient ${patientId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const newCase = await createSharedCase(
        patientId,
        patientName,
        clinicianId,
        "Sample Clinician",
        sharedWith || [],
        summary,
        clinicalContext || ""
      );

      res.json({ success: true, data: newCase });
    } catch (error) {
      console.error("Error creating shared case:", error);
      res.status(500).json({ success: false, error: "Failed to create shared case" });
    }
  });

  app.post("/api/collaboration/cases/:caseId/notes", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const clinicianId = (req as any).user?.id || "clinician-001";
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ success: false, error: "Note content required" });
      }

      await logPhiAccess({
        userId: clinicianId,
        action: "write",
        resourceType: "DiscussionNote",
        resourceId: caseId,
        details: `Added discussion note to case ${caseId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const note = await addDiscussionNote(caseId, clinicianId, "Sample Clinician", content);
      res.json({ success: true, data: note });
    } catch (error) {
      console.error("Error adding discussion note:", error);
      res.status(500).json({ success: false, error: "Failed to add discussion note" });
    }
  });

  app.post("/api/collaboration/cases/:caseId/differential", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const clinicianId = (req as any).user?.id || "clinician-001";
      const { condition, supportingEvidence, againstEvidence, likelihood } = req.body;

      if (!condition) {
        return res.status(400).json({ success: false, error: "Condition name required" });
      }

      await logPhiAccess({
        userId: clinicianId,
        action: "write",
        resourceType: "DifferentialDraft",
        resourceId: caseId,
        details: `Added differential consideration to case ${caseId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const consideration = await addDifferentialConsideration(caseId, {
        condition,
        supportingEvidence: supportingEvidence || [],
        againstEvidence: againstEvidence || [],
        likelihood: likelihood || "moderate",
        addedBy: clinicianId,
        addedByName: "Sample Clinician",
      });

      if (!consideration) {
        return res.status(404).json({ success: false, error: "Case not found" });
      }

      res.json({ success: true, data: consideration });
    } catch (error) {
      console.error("Error adding differential:", error);
      res.status(500).json({ success: false, error: "Failed to add differential consideration" });
    }
  });

  app.post("/api/collaboration/cases/:caseId/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
    try {
      const { caseId, alertId } = req.params;
      const clinicianId = (req as any).user?.id || "clinician-001";

      await logPhiAccess({
        userId: clinicianId,
        action: "write",
        resourceType: "CaseAlert",
        resourceId: `${caseId}/${alertId}`,
        details: `Acknowledged alert ${alertId} in case ${caseId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const alert = await acknowledgeAlert(caseId, alertId, clinicianId);
      if (!alert) {
        return res.status(404).json({ success: false, error: "Alert not found" });
      }

      res.json({ success: true, data: alert });
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      res.status(500).json({ success: false, error: "Failed to acknowledge alert" });
    }
  });

  app.post("/api/collaboration/cases/:caseId/ai-summary", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const clinicianId = (req as any).user?.id || "clinician-001";

      await logPhiAccess({
        userId: clinicianId,
        action: "read",
        resourceType: "AICaseSummary",
        resourceId: caseId,
        details: `Generated AI summary for case ${caseId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const caseData = await getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ success: false, error: "Case not found" });
      }

      const summary = await generateAICaseSummary(
        caseData.clinicalContext,
        caseData.discussionNotes
      );

      res.json({ success: true, data: { summary } });
    } catch (error) {
      console.error("Error generating AI summary:", error);
      res.status(500).json({ success: false, error: "Failed to generate AI summary" });
    }
  });

  app.post("/api/collaboration/cases/:caseId/alerts/:alertId/analyze", async (req: Request, res: Response) => {
    try {
      const { caseId, alertId } = req.params;
      const clinicianId = (req as any).user?.id || "clinician-001";

      await logPhiAccess({
        userId: clinicianId,
        action: "read",
        resourceType: "AIAlertAnalysis",
        resourceId: `${caseId}/${alertId}`,
        details: `Generated AI analysis for alert ${alertId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const caseData = await getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ success: false, error: "Case not found" });
      }

      const alert = caseData.alerts.find((a) => a.id === alertId);
      if (!alert) {
        return res.status(404).json({ success: false, error: "Alert not found" });
      }

      const analysis = await generateAlertAnalysis(alert, caseData.clinicalContext);
      res.json({ success: true, data: { analysis } });
    } catch (error) {
      console.error("Error generating alert analysis:", error);
      res.status(500).json({ success: false, error: "Failed to generate alert analysis" });
    }
  });
}
