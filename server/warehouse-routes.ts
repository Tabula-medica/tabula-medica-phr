import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  initializeWarehouseSchemas,
  runFullWarehouseExport,
  runIncrementalExport,
  createScheduledExport,
  getScheduledExport,
  listScheduledExports,
  updateScheduledExport,
  deleteScheduledExport,
  getWarehouseJob,
  listWarehouseJobs,
  getWarehouseSchemas,
  getPopulationHealthDashboard,
  HEALTHCARE_ANALYTICS_SCHEMAS,
} from "./services/dataWarehouse";
import { getAuditLogger } from "./services/integrations/factory";
import { requireRole, requirePermission } from "./rbac";

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  schedule: z.string().regex(/^\d{1,2}:\d{2}$/, "Schedule must be in HH:MM format"),
  exportType: z.enum(["full", "incremental"]),
  tables: z.array(z.string()).optional().default([]),
  deIdentify: z.boolean().optional().default(true),
});

const UpdateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schedule: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  enabled: z.boolean().optional(),
  tables: z.array(z.string()).optional(),
  deIdentify: z.boolean().optional(),
});

const ExportOptionsSchema = z.object({
  deIdentify: z.boolean().optional().default(true),
});

const IncrementalExportSchema = z.object({
  since: z.string().datetime(),
  deIdentify: z.boolean().optional().default(true),
});

export function registerWarehouseRoutes(app: Express): void {
  console.log("[Routes] Data warehouse routes registered at /api/warehouse");

  app.get("/api/warehouse/schemas", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const schemas = getWarehouseSchemas();
      res.json({
        schemas,
        totalTables: schemas.length,
        categories: {
          dimensions: schemas.filter(s => s.tableName.startsWith("dim_")).length,
          facts: schemas.filter(s => s.tableName.startsWith("fact_")).length,
          aggregates: schemas.filter(s => s.tableName.startsWith("agg_")).length,
          ml: schemas.filter(s => s.tableName.startsWith("ml_")).length,
        },
      });
    } catch (error: any) {
      console.error("[Warehouse] Get schemas error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/schemas/:tableName", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const schema = HEALTHCARE_ANALYTICS_SCHEMAS.find(s => s.tableName === tableName);
      
      if (!schema) {
        return res.status(404).json({ error: "Schema not found" });
      }
      
      res.json(schema);
    } catch (error: any) {
      console.error("[Warehouse] Get schema error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/warehouse/schemas/initialize", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const auditLogger = getAuditLogger();
      
      const job = await initializeWarehouseSchemas();
      
      await auditLogger.log({
        userId: "api-user",
        userRole: "admin",
        action: "create",
        resourceType: "DataWarehouseSchema",
        resourceId: job.jobId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 202,
        responseTimeMs: 0,
        phiAccessed: false,
        details: { tablesCount: HEALTHCARE_ANALYTICS_SCHEMAS.length },
      });
      
      res.status(202).json({
        message: "Schema initialization started",
        job,
      });
    } catch (error: any) {
      console.error("[Warehouse] Initialize schemas error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/warehouse/export/full", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const body = ExportOptionsSchema.parse(req.body || {});
      const auditLogger = getAuditLogger();
      
      const job = await runFullWarehouseExport(body.deIdentify);
      
      await auditLogger.log({
        userId: "api-user",
        userRole: "admin",
        action: "export",
        resourceType: "DataWarehouseFullExport",
        resourceId: job.jobId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 202,
        responseTimeMs: 0,
        phiAccessed: !body.deIdentify,
        details: { deIdentify: body.deIdentify },
      });
      
      res.status(202).json({
        message: "Full export started",
        job,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Warehouse] Full export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/warehouse/export/incremental", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const body = IncrementalExportSchema.parse(req.body);
      const auditLogger = getAuditLogger();
      
      const job = await runIncrementalExport(body.since, body.deIdentify);
      
      await auditLogger.log({
        userId: "api-user",
        userRole: "admin",
        action: "export",
        resourceType: "DataWarehouseIncrementalExport",
        resourceId: job.jobId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 202,
        responseTimeMs: 0,
        phiAccessed: !body.deIdentify,
        details: { since: body.since, deIdentify: body.deIdentify },
      });
      
      res.status(202).json({
        message: "Incremental export started",
        job,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Warehouse] Incremental export error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/jobs", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const jobs = listWarehouseJobs(status as any);
      
      res.json({
        jobs,
        total: jobs.length,
      });
    } catch (error: any) {
      console.error("[Warehouse] List jobs error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/jobs/:jobId", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = getWarehouseJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      res.json(job);
    } catch (error: any) {
      console.error("[Warehouse] Get job error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/schedules", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const schedules = listScheduledExports();
      
      res.json({
        schedules,
        total: schedules.length,
      });
    } catch (error: any) {
      console.error("[Warehouse] List schedules error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/warehouse/schedules", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const body = CreateScheduleSchema.parse(req.body);
      const auditLogger = getAuditLogger();
      
      const schedule = createScheduledExport({
        name: body.name,
        schedule: body.schedule,
        exportType: body.exportType,
        tables: body.tables,
        deIdentify: body.deIdentify,
      });
      
      await auditLogger.log({
        userId: "api-user",
        userRole: "admin",
        action: "create",
        resourceType: "DataWarehouseSchedule",
        resourceId: schedule.id,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 201,
        responseTimeMs: 0,
        phiAccessed: false,
        details: { name: body.name, schedule: body.schedule, exportType: body.exportType },
      });
      
      res.status(201).json(schedule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Warehouse] Create schedule error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/schedules/:scheduleId", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;
      const schedule = getScheduledExport(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      res.json(schedule);
    } catch (error: any) {
      console.error("[Warehouse] Get schedule error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/warehouse/schedules/:scheduleId", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;
      const body = UpdateScheduleSchema.parse(req.body);
      const auditLogger = getAuditLogger();
      
      const schedule = updateScheduledExport(scheduleId, body);
      
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      await auditLogger.log({
        userId: "api-user",
        userRole: "admin",
        action: "update",
        resourceType: "DataWarehouseSchedule",
        resourceId: scheduleId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 200,
        responseTimeMs: 0,
        phiAccessed: false,
        details: { updates: Object.keys(body) },
      });
      
      res.json(schedule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Warehouse] Update schedule error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/warehouse/schedules/:scheduleId", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;
      const auditLogger = getAuditLogger();
      
      const deleted = deleteScheduledExport(scheduleId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      await auditLogger.log({
        userId: "api-user",
        userRole: "admin",
        action: "delete",
        resourceType: "DataWarehouseSchedule",
        resourceId: scheduleId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        responseStatus: 204,
        responseTimeMs: 0,
        phiAccessed: false,
        details: {},
      });
      
      res.status(204).send();
    } catch (error: any) {
      console.error("[Warehouse] Delete schedule error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/analytics/dashboard", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const dashboard = await getPopulationHealthDashboard();
      res.json(dashboard);
    } catch (error: any) {
      console.error("[Warehouse] Dashboard error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/warehouse/analytics/population-health", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const dashboard = await getPopulationHealthDashboard();
      res.json(dashboard.populationHealth);
    } catch (error: any) {
      console.error("[Warehouse] Population health error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
