import type { Express } from "express";
import { aiFhirPatientValidationService } from "./services/ai-fhir-patient-validation-service";
import { comprehensiveAuditTrailService } from "./services/comprehensive-audit-trail-service";

export function registerAIFHIRPatientValidationRoutes(app: Express) {
  app.get("/api/fhir-patient-validation/metadata", async (req, res) => {
    const userId = (req as any).userId || "anonymous";
    try {
      const metadata = await aiFhirPatientValidationService.getMetadata();
      
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_governance",
          action: "read",
          resourceType: "ValidationMetadata",
          resourceId: "metadata",
          description: "Retrieved AI FHIR patient validation service metadata"
        },
        why: { reason: "Service information request" },
        result: { success: true },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "info",
        tags: ["metadata", "validation", "no-cds"],
        phiAccessed: false,
        complianceFlags: ["NO-CDS"],
        metadata: { version: metadata.version }
      });
      
      res.json(metadata);
    } catch (error: any) {
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_governance",
          action: "read",
          resourceType: "ValidationMetadata",
          resourceId: "metadata",
          description: "Failed to retrieve validation metadata"
        },
        why: { reason: "Service information request" },
        result: { success: false, errorMessage: error.message },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "error",
        tags: ["metadata", "validation", "error"],
        phiAccessed: false,
        complianceFlags: ["NO-CDS"]
      });
      
      res.status(500).json({ error: "Failed to retrieve metadata" });
    }
  });

  app.get("/api/fhir-patient-validation/patients", async (req, res) => {
    const userId = (req as any).userId || "anonymous";
    try {
      const patients = await aiFhirPatientValidationService.getAvailablePatients();
      
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_access",
          action: "read",
          resourceType: "PatientList",
          resourceId: "all",
          description: "Listed patients available for validation"
        },
        why: { reason: "Patient selection for validation" },
        result: { success: true },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "info",
        tags: ["patients", "validation", "list"],
        phiAccessed: true,
        complianceFlags: ["HIPAA", "NO-CDS"],
        metadata: { patientCount: patients.length }
      });
      
      res.json(patients);
    } catch (error: any) {
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_access",
          action: "read",
          resourceType: "PatientList",
          resourceId: "all",
          description: "Failed to list patients for validation"
        },
        why: { reason: "Patient selection for validation" },
        result: { success: false, errorMessage: error.message },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "error",
        tags: ["patients", "validation", "error"],
        phiAccessed: false,
        complianceFlags: ["HIPAA", "NO-CDS"]
      });
      
      res.status(500).json({ error: "Failed to retrieve patients" });
    }
  });

  app.post("/api/fhir-patient-validation/validate", async (req, res) => {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }
    
    try {
      const result = await aiFhirPatientValidationService.validatePatient(patientId, userId);
      res.json(result);
    } catch (error: any) {
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_governance",
          action: "execute",
          resourceType: "PatientValidation",
          resourceId: patientId,
          description: "Failed to validate patient data"
        },
        why: { reason: "Data quality assessment" },
        result: { success: false, errorMessage: error.message },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "error",
        tags: ["validation", "error", "patient"],
        phiAccessed: true,
        complianceFlags: ["HIPAA", "NO-CDS"]
      });
      
      res.status(500).json({ error: "Failed to validate patient data" });
    }
  });

  app.get("/api/fhir-patient-validation/history/:patientId", async (req, res) => {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    
    try {
      const history = await aiFhirPatientValidationService.getValidationHistory(patientId);
      
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_access",
          action: "read",
          resourceType: "ValidationHistory",
          resourceId: patientId,
          description: `Retrieved validation history for patient ${patientId}`
        },
        why: { reason: "Review past validations" },
        result: { success: true },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "info",
        tags: ["validation", "history", "patient"],
        phiAccessed: true,
        complianceFlags: ["HIPAA", "NO-CDS"],
        metadata: { historyCount: history.length }
      });
      
      res.json(history);
    } catch (error: any) {
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_access",
          action: "read",
          resourceType: "ValidationHistory",
          resourceId: patientId,
          description: "Failed to retrieve validation history"
        },
        why: { reason: "Review past validations" },
        result: { success: false, errorMessage: error.message },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "error",
        tags: ["validation", "history", "error"],
        phiAccessed: false,
        complianceFlags: ["HIPAA", "NO-CDS"]
      });
      
      res.status(500).json({ error: "Failed to retrieve validation history" });
    }
  });

  app.get("/api/fhir-patient-validation/rules", async (req, res) => {
    const userId = (req as any).userId || "anonymous";
    try {
      const rules = await aiFhirPatientValidationService.getValidationRules();
      
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_governance",
          action: "read",
          resourceType: "ValidationRules",
          resourceId: "all",
          description: "Retrieved validation rules"
        },
        why: { reason: "Review validation rules" },
        result: { success: true },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "info",
        tags: ["validation", "rules", "config"],
        phiAccessed: false,
        complianceFlags: ["NO-CDS"],
        metadata: { ruleCount: rules.length }
      });
      
      res.json(rules);
    } catch (error: any) {
      await comprehensiveAuditTrailService.logAuditEntry(userId, {
        who: { userId, userRole: "user" },
        what: {
          category: "data_governance",
          action: "read",
          resourceType: "ValidationRules",
          resourceId: "all",
          description: "Failed to retrieve validation rules"
        },
        why: { reason: "Review validation rules" },
        result: { success: false, errorMessage: error.message },
        context: { 
          ipAddress: req.ip || "unknown", 
          userAgent: req.headers["user-agent"] || "unknown",
          sessionId: `session-${Date.now()}`
        },
        severity: "error",
        tags: ["validation", "rules", "error"],
        phiAccessed: false,
        complianceFlags: ["NO-CDS"]
      });
      
      res.status(500).json({ error: "Failed to retrieve validation rules" });
    }
  });

  console.log("[Routes] AI FHIR Patient Validation routes registered at /api/fhir-patient-validation/*");
}
