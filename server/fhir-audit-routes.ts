import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirAuditService, FhirAuditAction, FhirAuditOutcome } from "./services/fhir-audit-service";

const router = Router();

const fhirAuditFilterSchema = z.object({
  userId: z.string().optional(),
  userRole: z.string().optional(),
  action: z.enum(["read", "search", "create", "update", "delete", "export", "import", "validate", "transform"]).optional(),
  outcome: z.enum(["success", "failure", "partial"]).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  patientId: z.string().optional(),
  fhirVersion: z.enum(["R4", "R5"]).optional(),
  operationType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  ipAddress: z.string().optional(),
  phiAccessed: z.boolean().optional(),
  sourceSystem: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

const complianceReportSchema = z.object({
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
});

const statisticsFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  resourceType: z.string().optional(),
  userRole: z.string().optional(),
});

const dailySummarySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(7),
});

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});

router.get("/entries", async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.userRole) filter.userRole = req.query.userRole;
    if (req.query.action) filter.action = req.query.action as FhirAuditAction;
    if (req.query.outcome) filter.outcome = req.query.outcome as FhirAuditOutcome;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;
    if (req.query.resourceId) filter.resourceId = req.query.resourceId;
    if (req.query.patientId) filter.patientId = req.query.patientId;
    if (req.query.fhirVersion) filter.fhirVersion = req.query.fhirVersion;
    if (req.query.operationType) filter.operationType = req.query.operationType;
    if (req.query.startDate) filter.startDate = req.query.startDate;
    if (req.query.endDate) filter.endDate = req.query.endDate;
    if (req.query.ipAddress) filter.ipAddress = req.query.ipAddress;
    if (req.query.phiAccessed !== undefined) filter.phiAccessed = req.query.phiAccessed === "true";
    if (req.query.sourceSystem) filter.sourceSystem = req.query.sourceSystem;
    if (req.query.limit) filter.limit = parseInt(req.query.limit as string);
    if (req.query.offset) filter.offset = parseInt(req.query.offset as string);

    const parsed = fhirAuditFilterSchema.parse(filter);
    const result = await fhirAuditService.query(parsed);
    
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filter parameters", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/entries/:id", async (req: Request, res: Response) => {
  try {
    const entry = await fhirAuditService.getEntry(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: "Audit entry not found" });
    }
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const parsed = statisticsFilterSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      resourceType: req.query.resourceType,
      userRole: req.query.userRole,
    });
    const statistics = await fhirAuditService.getStatistics(parsed);
    res.json(statistics);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filter parameters", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/summary/daily", async (req: Request, res: Response) => {
  try {
    const parsed = dailySummarySchema.parse({ days: req.query.days });
    const summary = await fhirAuditService.getDailySummary(parsed.days);
    res.json(summary);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid parameters", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/history", async (req: Request, res: Response) => {
  try {
    const parsed = limitSchema.parse({ limit: req.query.limit });
    const entries = await fhirAuditService.getPatientAccessHistory(req.params.patientId, parsed.limit);
    res.json(entries);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid parameters", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/user/:userId/activity", async (req: Request, res: Response) => {
  try {
    const parsed = limitSchema.parse({ limit: req.query.limit });
    const entries = await fhirAuditService.getUserActivityLog(req.params.userId, parsed.limit);
    res.json(entries);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid parameters", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/resource/:resourceType/:resourceId/history", async (req: Request, res: Response) => {
  try {
    const entries = await fhirAuditService.getResourceHistory(
      req.params.resourceType,
      req.params.resourceId
    );
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/compliance-report", async (req: Request, res: Response) => {
  try {
    const parsed = complianceReportSchema.parse(req.body);
    const report = await fhirAuditService.getComplianceReport(parsed.startDate, parsed.endDate);
    res.json(report);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    service: "FHIR Audit Service",
    version: "1.0.0",
    resourceTypes: fhirAuditService.getResourceTypes(),
    userRoles: fhirAuditService.getUserRoles(),
    actions: fhirAuditService.getActions(),
    outcomes: fhirAuditService.getOutcomes(),
    fhirVersions: ["R4", "R5"],
    features: {
      phiTracking: true,
      complianceReporting: true,
      realTimeLogging: true,
      patientAccessHistory: true,
      userActivityLog: true,
      resourceHistory: true,
    },
  });
});

export function registerFhirAuditRoutes(app: any): void {
  app.use("/api/fhir-audit", router);
  console.log("[Routes] FHIR Audit routes registered at /api/fhir-audit/*");
}
