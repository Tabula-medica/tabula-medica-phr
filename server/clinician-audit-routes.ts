import { Router, Request, Response } from "express";
import {
  getClinicianAuditDashboard,
  getClinicianAuditEntries,
  getClinicianSummary,
  exportAuditReport
} from "./services/clinician-audit-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    res.json({
      name: "Clinician Audit View",
      version: "1.0.0",
      description: "HIPAA-compliant audit trail for clinician access to patient records",
      features: [
        "Real-time access monitoring",
        "Break-glass event tracking",
        "Emergency access logging",
        "Compliance scoring",
        "Department analytics",
        "Flagged access alerts",
        "Export audit reports"
      ],
      actionTypes: [
        "patient_record_view",
        "patient_record_edit",
        "medication_prescribe",
        "lab_order",
        "lab_review",
        "diagnosis_add",
        "note_create",
        "break_glass",
        "emergency_access"
      ]
    });
  } catch (error) {
    console.error("[ClinicianAudit] Metadata error:", error);
    res.status(500).json({ error: "Failed to get metadata" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const dashboard = await getClinicianAuditDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[ClinicianAudit] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

router.get("/entries", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const filters = {
      clinicianId: req.query.clinicianId as string | undefined,
      patientId: req.query.patientId as string | undefined,
      action: req.query.action as any,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      flaggedOnly: req.query.flaggedOnly === "true",
      emergencyOnly: req.query.emergencyOnly === "true"
    };
    
    const entries = await getClinicianAuditEntries(userId, filters);
    
    res.json({
      entries,
      count: entries.length,
      filters
    });
  } catch (error) {
    console.error("[ClinicianAudit] Entries error:", error);
    res.status(500).json({ error: "Failed to get entries" });
  }
});

router.get("/clinician/:clinicianId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { clinicianId } = req.params;
    
    const summary = await getClinicianSummary(userId, clinicianId);
    
    if (!summary) {
      return res.status(404).json({ error: "Clinician not found" });
    }
    
    res.json(summary);
  } catch (error) {
    console.error("[ClinicianAudit] Clinician summary error:", error);
    res.status(500).json({ error: "Failed to get clinician summary" });
  }
});

router.post("/export", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const filters = req.body;
    
    logPhiAccess({
      userId,
      action: "export",
      resourceType: "ClinicianAuditReport",
      details: "Export clinician audit report"
    });
    
    const report = await exportAuditReport(userId, filters);
    
    res.json({
      ...report,
      message: "Audit report generated successfully"
    });
  } catch (error) {
    console.error("[ClinicianAudit] Export error:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

export default router;
