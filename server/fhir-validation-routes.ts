import { Express, Request, Response } from "express";
import {
  getValidationRules,
  getAllValidationRules,
  createValidationRule,
  updateValidationRule,
  getValidationFailures,
  getValidationSummary,
  updateFailureStatus,
  getPatientsList,
  getResourceTypes,
  logValidationAccess,
} from "./services/fhir-validation-service";
import { requireUser, getUserId } from "./middleware/require-user";

export function registerFHIRValidationRoutes(app: Express): void {
  app.get("/api/fhir-validation/rules", requireUser, async (req: Request, res: Response) => {
    try {
      const { all } = req.query;
      const rules = all === "true" ? getAllValidationRules() : getValidationRules();
      res.json({ rules });
    } catch (error) {
      console.error("[FHIRValidation] Error fetching rules:", error);
      res.status(500).json({ error: "Failed to fetch validation rules" });
    }
  });

  app.post("/api/fhir-validation/rules", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const rule = await createValidationRule(req.body, userId, ipAddress, userAgent);
      res.status(201).json({ rule });
    } catch (error) {
      console.error("[FHIRValidation] Error creating rule:", error);
      res.status(500).json({ error: "Failed to create validation rule" });
    }
  });

  app.patch("/api/fhir-validation/rules/:id", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const rule = await updateValidationRule(req.params.id, req.body, userId, ipAddress, userAgent);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json({ rule });
    } catch (error) {
      console.error("[FHIRValidation] Error updating rule:", error);
      res.status(500).json({ error: "Failed to update validation rule" });
    }
  });

  app.get("/api/fhir-validation/failures", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const { patientId, resourceType, severity, status } = req.query;
      const failures = getValidationFailures({
        patientId: patientId as string,
        resourceType: resourceType as string,
        severity: severity as any,
        status: status as any,
      });
      await logValidationAccess("view_failures", { count: failures.length }, userId, ipAddress, userAgent);
      res.json({ failures });
    } catch (error) {
      console.error("[FHIRValidation] Error fetching failures:", error);
      res.status(500).json({ error: "Failed to fetch validation failures" });
    }
  });

  app.get("/api/fhir-validation/summary", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const summary = getValidationSummary();
      await logValidationAccess("view_summary", { totalFailures: summary.totalFailures }, userId, ipAddress, userAgent);
      res.json({ summary });
    } catch (error) {
      console.error("[FHIRValidation] Error fetching summary:", error);
      res.status(500).json({ error: "Failed to fetch validation summary" });
    }
  });

  app.patch("/api/fhir-validation/failures/:id/status", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const { status, notes } = req.body;

      const failure = await updateFailureStatus(req.params.id, status, notes, userId, ipAddress, userAgent);
      if (!failure) {
        return res.status(404).json({ error: "Failure not found" });
      }
      res.json({ failure });
    } catch (error) {
      console.error("[FHIRValidation] Error updating failure status:", error);
      res.status(500).json({ error: "Failed to update failure status" });
    }
  });

  app.get("/api/fhir-validation/patients", requireUser, async (req: Request, res: Response) => {
    try {
      const patients = getPatientsList();
      res.json({ patients });
    } catch (error) {
      console.error("[FHIRValidation] Error fetching patients:", error);
      res.status(500).json({ error: "Failed to fetch patients list" });
    }
  });

  app.get("/api/fhir-validation/resource-types", requireUser, async (req: Request, res: Response) => {
    try {
      const resourceTypes = getResourceTypes();
      res.json({ resourceTypes });
    } catch (error) {
      console.error("[FHIRValidation] Error fetching resource types:", error);
      res.status(500).json({ error: "Failed to fetch resource types" });
    }
  });

  console.log("[FHIRValidation] Routes registered");
}
