import { Router, Request, Response } from "express";
import { fhirAuditMiddleware } from "./middleware/fhir-audit-middleware";
import { z } from "zod";
import { getFhirStore, getAuditLogger, getAnalyticsStore } from "./services/integrations/factory";
import type { AuditLogEntry } from "./services/integrations/interfaces";
import {
  createBatchExportJob,
  getBatchExportJob,
  listBatchExportJobs,
  deleteBatchExportJob,
  triggerFullExport,
  getSyncConfig,
  updateSyncConfig,
  startSyncHook,
  stopSyncHook,
  pushToSyncBuffer,
} from "./services/sync-export";

const batchExportSchema = z.object({
  resourceTypes: z.array(z.string()).min(1, "resourceTypes must have at least one item"),
  patientIds: z.array(z.string()).optional(),
  deIdentify: z.boolean().default(true),
  format: z.enum(["fhir_ndjson", "csv", "parquet"]).default("fhir_ndjson"),
  destination: z.object({
    type: z.enum(["bigquery", "gcs", "s3"]),
    path: z.string(),
  }).optional(),
});

const syncConfigSchema = z.object({
  enabled: z.boolean().optional(),
  resourceTypes: z.array(z.string()).optional(),
  destination: z.enum(["bigquery", "analytics_store"]).optional(),
  deIdentify: z.boolean().optional(),
  batchSize: z.number().int().min(1).max(10000).optional(),
  flushIntervalMs: z.number().int().min(1000).max(3600000).optional(),
});

const fullExportSchema = z.object({
  deIdentify: z.boolean().default(true),
  destination: z.object({
    type: z.enum(["bigquery", "gcs", "s3"]),
    path: z.string(),
  }).optional(),
});

const bigqueryExportSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  tablePrefix: z.string().optional(),
});

const analyticsInsertSchema = z.object({
  table: z.string().min(1, "table name is required"),
  rows: z.array(z.record(z.unknown())).min(1, "rows must have at least one item"),
  deIdentify: z.boolean().default(false),
});

const router = Router();

router.use(fhirAuditMiddleware);
function createAuditEntry(
  req: Request,
  action: AuditLogEntry["action"],
  resourceType: string,
  resourceId?: string,
  patientId?: string
): Omit<AuditLogEntry, "id" | "timestamp"> {
  return {
    userId: (req as any).user?.id || "anonymous",
    userRole: (req as any).user?.role || "patient",
    action,
    resourceType,
    resourceId,
    patientId,
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    requestPath: req.path,
    requestMethod: req.method,
    responseStatus: 200,
    responseTimeMs: 0,
    phiAccessed: true,
    accessReason: req.headers["x-access-reason"] as string,
  };
}

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const patient = await fhirStore.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const entry = createAuditEntry(req, "read", "Patient", patientId, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    await auditLogger.log(entry);

    res.json(patient);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/observations", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;
    const { category } = req.query;

    const observations = await fhirStore.getPatientObservations(patientId, category as string);

    const entry = createAuditEntry(req, "search", "Observation", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: observations.length, category };
    await auditLogger.log(entry);

    res.json(observations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/medications", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const [medicationRequests, medicationStatements] = await Promise.all([
      fhirStore.getPatientMedicationRequests(patientId),
      fhirStore.getPatientMedicationStatements(patientId),
    ]);

    const entry = createAuditEntry(req, "search", "Medication", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { requestsCount: medicationRequests.length, statementsCount: medicationStatements.length };
    await auditLogger.log(entry);

    res.json({
      medicationRequests,
      medicationStatements,
      combined: [...medicationRequests, ...medicationStatements],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/encounters", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const encounters = await fhirStore.getPatientEncounters(patientId);

    const entry = createAuditEntry(req, "search", "Encounter", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: encounters.length };
    await auditLogger.log(entry);

    res.json(encounters);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/conditions", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const conditions = await fhirStore.getPatientConditions(patientId);

    const entry = createAuditEntry(req, "search", "Condition", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: conditions.length };
    await auditLogger.log(entry);

    res.json(conditions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/labs", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const [observations, diagnosticReports] = await Promise.all([
      fhirStore.getPatientObservations(patientId, "laboratory"),
      fhirStore.getPatientDiagnosticReports(patientId),
    ]);

    const entry = createAuditEntry(req, "search", "DiagnosticReport", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { observationsCount: observations.length, reportsCount: diagnosticReports.length };
    await auditLogger.log(entry);

    res.json({
      labObservations: observations,
      diagnosticReports,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/immunizations", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const immunizations = await fhirStore.getPatientImmunizations(patientId);

    const entry = createAuditEntry(req, "search", "Immunization", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: immunizations.length };
    await auditLogger.log(entry);

    res.json(immunizations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/allergies", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const allergies = await fhirStore.getPatientAllergies(patientId);

    const entry = createAuditEntry(req, "search", "AllergyIntolerance", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: allergies.length };
    await auditLogger.log(entry);

    res.json(allergies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/procedures", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const procedures = await fhirStore.getPatientProcedures(patientId);

    const entry = createAuditEntry(req, "search", "Procedure", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: procedures.length };
    await auditLogger.log(entry);

    res.json(procedures);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/timeline", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;
    const { type, startDate, endDate, limit } = req.query;

    let timeline = await fhirStore.getPatientTimeline(patientId);

    if (type) {
      const types = (type as string).split(",");
      timeline = timeline.filter((item) => types.includes(item.type));
    }

    if (startDate) {
      const start = new Date(startDate as string);
      timeline = timeline.filter((item) => new Date(item.date) >= start);
    }

    if (endDate) {
      const end = new Date(endDate as string);
      timeline = timeline.filter((item) => new Date(item.date) <= end);
    }

    if (limit) {
      timeline = timeline.slice(0, parseInt(limit as string, 10));
    }

    const entry = createAuditEntry(req, "search", "Timeline", undefined, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { count: timeline.length, filters: { type, startDate, endDate, limit } };
    await auditLogger.log(entry);

    res.json(timeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId/summary", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;

    const [patient, conditions, medications, allergies, encounters, observations] = await Promise.all([
      fhirStore.getPatient(patientId),
      fhirStore.getPatientConditions(patientId),
      fhirStore.getPatientMedicationRequests(patientId),
      fhirStore.getPatientAllergies(patientId),
      fhirStore.getPatientEncounters(patientId),
      fhirStore.getPatientObservations(patientId),
    ]);

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const activeConditions = conditions.filter((c) => c.clinicalStatus?.coding?.[0]?.code === "active");
    const activeMedications = medications.filter((m) => m.status === "active");
    const activeAllergies = allergies.filter((a) => a.clinicalStatus?.coding?.[0]?.code === "active");

    const summary = {
      patient: {
        id: patient.id,
        name: patient.name?.[0] ? `${patient.name[0].given?.join(" ")} ${patient.name[0].family}` : "Unknown",
        birthDate: patient.birthDate,
        gender: patient.gender,
      },
      counts: {
        conditions: conditions.length,
        activeConditions: activeConditions.length,
        medications: medications.length,
        activeMedications: activeMedications.length,
        allergies: allergies.length,
        activeAllergies: activeAllergies.length,
        encounters: encounters.length,
        observations: observations.length,
      },
      activeConditions: activeConditions.slice(0, 5).map((c) => ({
        id: c.id,
        display: c.code?.text || c.code?.coding?.[0]?.display,
        onsetDate: c.onsetDateTime,
      })),
      activeMedications: activeMedications.slice(0, 5).map((m) => ({
        id: m.id,
        display: m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display,
        dosage: m.dosageInstruction?.[0]?.text,
      })),
      activeAllergies: activeAllergies.map((a) => ({
        id: a.id,
        display: a.code?.text || a.code?.coding?.[0]?.display,
        severity: a.reaction?.[0]?.severity,
      })),
      recentEncounters: encounters.slice(0, 3).map((e) => ({
        id: e.id,
        type: e.type?.[0]?.text || e.type?.[0]?.coding?.[0]?.display,
        date: e.period?.start,
        provider: e.serviceProvider?.display,
      })),
    };

    const entry = createAuditEntry(req, "read", "PatientSummary", patientId, patientId);
    entry.responseTimeMs = Date.now() - startTime;
    await auditLogger.log(entry);

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/export/bigquery", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();
    
    const parseResult = bigqueryExportSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors 
      });
    }
    
    const { datasetId, tablePrefix } = parseResult.data;

    if (!fhirStore.exportToBigQuery) {
      return res.status(400).json({ error: "Export to BigQuery not supported by current FHIR provider" });
    }

    const result = await fhirStore.exportToBigQuery(datasetId, tablePrefix);

    const entry = createAuditEntry(req, "export", "FHIR", undefined, undefined);
    entry.responseTimeMs = Date.now() - startTime;
    entry.details = { datasetId, tablePrefix, jobId: result.jobId };
    await auditLogger.log(entry);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sync/analytics", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const analyticsStore = getAnalyticsStore();
    const auditLogger = getAuditLogger();
    
    const parseResult = analyticsInsertSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors 
      });
    }
    
    const { table, rows, deIdentify } = parseResult.data;

    let processedRows = rows as Record<string, unknown>[];
    if (deIdentify) {
      processedRows = rows.map((row) => {
        const deIdentified = { ...row };
        if (deIdentified.name) delete deIdentified.name;
        if (deIdentified.address) delete deIdentified.address;
        if (deIdentified.telecom) delete deIdentified.telecom;
        if (deIdentified.identifier) delete deIdentified.identifier;
        if (deIdentified.birthDate && typeof deIdentified.birthDate === "string") {
          const date = new Date(deIdentified.birthDate);
          deIdentified.birthYear = date.getFullYear();
          delete deIdentified.birthDate;
        }
        return deIdentified;
      });
    }

    const result = await analyticsStore.insertData(table, processedRows);

    const entry = createAuditEntry(req, "create", "AnalyticsData", undefined, undefined);
    entry.responseTimeMs = Date.now() - startTime;
    entry.phiAccessed = !deIdentify;
    entry.details = { table, rowCount: rows.length, deIdentified: deIdentify, insertedCount: result.insertedCount };
    await auditLogger.log(entry);

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit/logs", async (req: Request, res: Response) => {
  try {
    const auditLogger = getAuditLogger();
    const { userId, patientId, resourceType, action, startDate, endDate, phiAccessedOnly } = req.query;

    const logs = await auditLogger.query({
      userId: userId as string,
      patientId: patientId as string,
      resourceType: resourceType as string,
      action: action as string,
      startDate: startDate as string,
      endDate: endDate as string,
      phiAccessedOnly: phiAccessedOnly === "true",
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit/patient/:patientId/access-report", async (req: Request, res: Response) => {
  try {
    const auditLogger = getAuditLogger();
    const { patientId } = req.params;
    const { startDate, endDate } = req.query;

    const start = (startDate as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = (endDate as string) || new Date().toISOString();

    const report = await auditLogger.getAccessReport(patientId, { start, end });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/export/batch", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const auditLogger = getAuditLogger();
    
    const parseResult = batchExportSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors 
      });
    }
    
    const { resourceTypes, patientIds, deIdentify, format, destination } = parseResult.data;

    const job = await createBatchExportJob({
      resourceTypes,
      patientIds,
      deIdentify,
      format,
      destination: destination || { type: "bigquery", path: "fhir_export" },
    });

    const entry = createAuditEntry(req, "export", "BatchExportJob", job.jobId, undefined);
    entry.responseTimeMs = Date.now() - startTime;
    entry.phiAccessed = !deIdentify;
    entry.details = { resourceTypes, patientIds, deIdentify, format };
    await auditLogger.log(entry);

    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/export/batch/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = getBatchExportJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Export job not found" });
    }

    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/export/batch", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const jobs = listBatchExportJobs(status as any);
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/export/batch/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const deleted = deleteBatchExportJob(jobId);

    if (!deleted) {
      return res.status(404).json({ error: "Export job not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/export/full", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const auditLogger = getAuditLogger();
    
    const parseResult = fullExportSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors 
      });
    }
    
    const { deIdentify, destination } = parseResult.data;

    const job = await triggerFullExport({
      deIdentify,
      destination: destination || { type: "bigquery", path: "fhir_full_export" },
    });

    const entry = createAuditEntry(req, "export", "FullExport", job.jobId, undefined);
    entry.responseTimeMs = Date.now() - startTime;
    entry.phiAccessed = !deIdentify;
    await auditLogger.log(entry);

    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sync/config", async (_req: Request, res: Response) => {
  try {
    const config = getSyncConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/sync/config", async (req: Request, res: Response) => {
  try {
    const parseResult = syncConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors 
      });
    }
    
    const config = updateSyncConfig(parseResult.data);
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sync/start", async (req: Request, res: Response) => {
  try {
    const auditLogger = getAuditLogger();
    startSyncHook(req.body);

    await auditLogger.log({
      userId: (req as any).user?.id || "anonymous",
      userRole: (req as any).user?.role || "admin",
      action: "create",
      resourceType: "SyncHook",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: req.path,
      requestMethod: req.method,
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: { action: "start", config: getSyncConfig() },
    });

    res.json({ success: true, message: "Sync hook started", config: getSyncConfig() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sync/stop", async (req: Request, res: Response) => {
  try {
    const auditLogger = getAuditLogger();
    stopSyncHook();

    await auditLogger.log({
      userId: (req as any).user?.id || "anonymous",
      userRole: (req as any).user?.role || "admin",
      action: "delete",
      resourceType: "SyncHook",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: req.path,
      requestMethod: req.method,
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: { action: "stop" },
    });

    res.json({ success: true, message: "Sync hook stopped" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export function registerFhirRoutes(app: any) {
  app.use("/api/fhir", router);
}

export default router;
