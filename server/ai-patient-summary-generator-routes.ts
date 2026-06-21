import { Express, Request, Response } from "express";
import { aiPatientSummaryGeneratorService, SummaryRequest } from "./services/ai-patient-summary-generator";
import { comprehensiveAuditTrailService } from "./services/comprehensive-audit-trail-service";

function logAudit(
  userId: string,
  action: string,
  resource: string,
  details: string,
  success: boolean,
  patientId?: string
): void {
  comprehensiveAuditTrailService.logAuditEntry(userId, {
    who: {
      userId,
      userRole: "system",
      userName: "AI Patient Summary Generator"
    },
    what: {
      category: "patient_record",
      action: action.includes("Generate") ? "create" : "read",
      resourceType: resource,
      resourceId: patientId,
      description: details
    },
    why: {
      reason: "AI-powered patient summary generation from FHIR data",
      businessJustification: "Documentation review and data organization"
    },
    result: {
      success,
      statusCode: success ? 200 : 500
    },
    context: {
      environment: "production"
    },
    severity: success ? "info" : "warning",
    tags: ["ai-summary", "fhir", "patient-record"],
    phiAccessed: !!patientId,
    complianceFlags: ["HIPAA", "NO-CDS"],
    metadata: {
      noCdsCompliance: "INFORMATIONAL ONLY: Not for clinical decision support"
    }
  });
}

export function registerAIPatientSummaryGeneratorRoutes(app: Express): void {
  app.get("/api/patient-summary-generator/patients", async (req: Request, res: Response) => {
    try {
      const patients = await aiPatientSummaryGeneratorService.getAvailablePatients();
      logAudit("system", "List Patients", "Patient", `Retrieved ${patients.length} patients for summary selection`, true);
      res.json(patients);
    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error listing patients:", error);
      logAudit("system", "List Patients", "Patient", "Failed to retrieve patients", false);
      res.status(500).json({ error: "Failed to retrieve patients" });
    }
  });

  app.post("/api/patient-summary-generator/generate", async (req: Request, res: Response) => {
    try {
      const request: SummaryRequest = {
        patientId: req.body.patientId,
        userId: req.body.userId || "system",
        focusAreas: req.body.focusAreas,
        timeframeDays: req.body.timeframeDays || 365,
        includeInsights: req.body.includeInsights !== false
      };

      if (!request.patientId) {
        logAudit(request.userId || "system", "Generate Summary", "PatientSummary", "Missing patient ID", false);
        return res.status(400).json({ error: "Patient ID is required" });
      }

      const summary = await aiPatientSummaryGeneratorService.generateSummary(request);
      logAudit(
        request.userId || "system", 
        "Generate Summary", 
        "PatientSummary", 
        `Generated AI summary for patient ${request.patientId}`, 
        true,
        request.patientId
      );
      res.json(summary);
    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error generating summary:", error);
      const patientId = req.body.patientId || "unknown";
      logAudit("system", "Generate Summary", "PatientSummary", `Failed to generate summary for patient ${patientId}`, false, patientId);
      res.status(500).json({ error: "Failed to generate patient summary" });
    }
  });

  app.get("/api/patient-summary-generator/patient/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const patientData = await aiPatientSummaryGeneratorService.getPatientFHIRData(patientId);
      
      if (!patientData) {
        logAudit("system", "Get Patient Data", "Patient", `Patient ${patientId} not found`, false, patientId);
        return res.status(404).json({ error: "Patient not found" });
      }

      logAudit("system", "Get Patient Data", "Patient", `Retrieved FHIR data for patient ${patientId}`, true, patientId);
      res.json(patientData);
    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error getting patient data:", error);
      logAudit("system", "Get Patient Data", "Patient", "Failed to retrieve patient data", false, req.params.patientId);
      res.status(500).json({ error: "Failed to retrieve patient data" });
    }
  });

  app.get("/api/patient-summary-generator/history/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const history = await aiPatientSummaryGeneratorService.getSummaryHistory(patientId);
      logAudit("system", "Get Summary History", "PatientSummary", `Retrieved ${history.length} summaries for patient ${patientId}`, true, patientId);
      res.json(history);
    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error getting summary history:", error);
      logAudit("system", "Get Summary History", "PatientSummary", "Failed to retrieve summary history", false, req.params.patientId);
      res.status(500).json({ error: "Failed to retrieve summary history" });
    }
  });

  app.get("/api/patient-summary-generator/metadata", async (req: Request, res: Response) => {
    try {
      const metadata = aiPatientSummaryGeneratorService.getMetadata();
      logAudit("system", "Get Metadata", "PatientSummary", "Retrieved service metadata", true);
      res.json(metadata);
    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error getting metadata:", error);
      logAudit("system", "Get Metadata", "PatientSummary", "Failed to retrieve metadata", false);
      res.status(500).json({ error: "Failed to retrieve metadata" });
    }
  });

  console.log("[Routes] AI Patient Summary Generator routes registered at /api/patient-summary-generator/*");
}
