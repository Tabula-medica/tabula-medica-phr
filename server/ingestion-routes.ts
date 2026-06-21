import { Router, Request, Response } from "express";
import {
  createIngestionJob,
  processIngestionJob,
  getIngestionJob,
  getIngestionJobsByUser,
  getIngestionSummary,
  getSupportedFormats,
  detectDataFormat,
} from "./services/ai-data-ingestion-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/formats", async (_req: Request, res: Response) => {
  try {
    const formats = await getSupportedFormats();
    res.json({ formats });
  } catch (error) {
    console.error("[Ingestion] Failed to get formats:", error);
    res.status(500).json({ error: "Failed to retrieve supported formats" });
  }
});

router.post("/detect-format", async (req: Request, res: Response) => {
  try {
    const { data, filename, mimeType } = req.body;
    const userId = (req as any).user?.id || "anonymous";
    
    if (!data) {
      return res.status(400).json({ error: "Data is required" });
    }
    
    const format = detectDataFormat(data, filename, mimeType);
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "FormatDetection",
      details: `Detected format: ${format} for file: ${filename || "unknown"}`,
    });
    
    res.json({ format });
  } catch (error) {
    console.error("[Ingestion] Format detection failed:", error);
    res.status(500).json({ error: "Format detection failed" });
  }
});

router.post("/jobs", async (req: Request, res: Response) => {
  try {
    const { data, filename, mimeType, patientId } = req.body;
    const userId = (req as any).user?.id || "anonymous";
    
    if (!data) {
      return res.status(400).json({ error: "Data is required" });
    }
    
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }
    
    const job = await createIngestionJob(userId, data, filename, mimeType, patientId);
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionJob",
      resourceId: job.id,
      details: `Created ingestion job: format=${job.format}, filename=${job.filename}`,
    });
    
    res.status(201).json({
      jobId: job.id,
      status: job.status,
      format: job.format,
    });
  } catch (error) {
    console.error("[Ingestion] Job creation failed:", error);
    res.status(500).json({ error: "Failed to create ingestion job" });
  }
});

router.post("/jobs/:jobId/process", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const existingJob = getIngestionJob(jobId);
    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: "Processing started",
    });
    
    const job = await processIngestionJob(jobId);
    
    const resourceCount = job.normalizedResources 
      ? Object.values(job.normalizedResources).flat().length 
      : 0;
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: `Processing completed: status=${job.status}, errors=${job.errors.length}, resources=${resourceCount}`,
    });
    
    res.json({
      jobId: job.id,
      status: job.status,
      errors: job.errors,
      warnings: job.warnings,
      processingTimeMs: job.processingTimeMs,
    });
  } catch (error) {
    console.error("[Ingestion] Job processing failed:", error);
    res.status(500).json({ error: "Failed to process ingestion job" });
  }
});

router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const job = getIngestionJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: `Read job status: ${job.status}`,
    });
    
    const safeJob = {
      id: job.id,
      filename: job.filename,
      format: job.format,
      status: job.status,
      patientId: job.patientId,
      errors: job.errors,
      warnings: job.warnings,
      metadata: job.metadata,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      processingTimeMs: job.processingTimeMs,
    };
    
    res.json(safeJob);
  } catch (error) {
    console.error("[Ingestion] Failed to get job:", error);
    res.status(500).json({ error: "Failed to retrieve job" });
  }
});

router.get("/jobs/:jobId/parsed", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const job = getIngestionJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: "Read parsed data",
    });
    
    res.json({
      jobId: job.id,
      format: job.format,
      parsedData: job.parsedData,
    });
  } catch (error) {
    console.error("[Ingestion] Failed to get parsed data:", error);
    res.status(500).json({ error: "Failed to retrieve parsed data" });
  }
});

router.get("/jobs/:jobId/entities", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const job = getIngestionJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: "Read extracted entities",
    });
    
    res.json({
      jobId: job.id,
      extractedEntities: job.extractedEntities,
    });
  } catch (error) {
    console.error("[Ingestion] Failed to get entities:", error);
    res.status(500).json({ error: "Failed to retrieve entities" });
  }
});

router.get("/jobs/:jobId/fhir", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const job = getIngestionJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: "Read FHIR bundle",
    });
    
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [] as Array<{ resource: Record<string, unknown> }>,
    };
    
    if (job.normalizedResources) {
      if (job.normalizedResources.patient) {
        bundle.entry.push({ resource: job.normalizedResources.patient });
      }
      for (const r of job.normalizedResources.conditions) {
        bundle.entry.push({ resource: r });
      }
      for (const r of job.normalizedResources.observations) {
        bundle.entry.push({ resource: r });
      }
      for (const r of job.normalizedResources.medications) {
        bundle.entry.push({ resource: r });
      }
      for (const r of job.normalizedResources.procedures) {
        bundle.entry.push({ resource: r });
      }
      for (const r of job.normalizedResources.imagingStudies) {
        bundle.entry.push({ resource: r });
      }
      for (const r of job.normalizedResources.allergies) {
        bundle.entry.push({ resource: r });
      }
      for (const r of job.normalizedResources.immunizations) {
        bundle.entry.push({ resource: r });
      }
    }
    
    res.json(bundle);
  } catch (error) {
    console.error("[Ingestion] Failed to get FHIR bundle:", error);
    res.status(500).json({ error: "Failed to retrieve FHIR resources" });
  }
});

router.get("/jobs/:jobId/validation", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const job = getIngestionJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: "Read validation results",
    });
    
    res.json({
      jobId: job.id,
      validationResults: job.validationResults,
    });
  } catch (error) {
    console.error("[Ingestion] Failed to get validation:", error);
    res.status(500).json({ error: "Failed to retrieve validation results" });
  }
});

router.get("/jobs/:jobId/summary", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const summary = getIngestionSummary(jobId);
    if (!summary) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "IngestionJob",
      resourceId: jobId,
      details: "Read ingestion summary",
    });
    
    res.json(summary);
  } catch (error) {
    console.error("[Ingestion] Failed to get summary:", error);
    res.status(500).json({ error: "Failed to retrieve summary" });
  }
});

router.get("/jobs", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    
    const jobs = getIngestionJobsByUser(userId);
    
    const safeJobs = jobs.map(job => ({
      id: job.id,
      filename: job.filename,
      format: job.format,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      processingTimeMs: job.processingTimeMs,
      errorCount: job.errors.length,
    }));
    
    res.json({ jobs: safeJobs });
  } catch (error) {
    console.error("[Ingestion] Failed to list jobs:", error);
    res.status(500).json({ error: "Failed to retrieve jobs" });
  }
});

router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const { data, filename, mimeType, patientId } = req.body;
    const userId = (req as any).user?.id || "anonymous";
    
    if (!data) {
      return res.status(400).json({ error: "Data is required" });
    }
    
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }
    
    const job = await createIngestionJob(userId, data, filename, mimeType, patientId);
    
    const processedJob = await processIngestionJob(job.id);
    
    const summary = getIngestionSummary(job.id);
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "IngestionJob",
      resourceId: job.id,
      details: `Quick ingest completed: format=${processedJob.format}, status=${processedJob.status}, resources=${summary?.validationSummary.totalResources || 0}`,
    });
    
    res.json({
      jobId: processedJob.id,
      status: processedJob.status,
      format: processedJob.format,
      summary,
      errors: processedJob.errors,
      warnings: processedJob.warnings,
    });
  } catch (error) {
    console.error("[Ingestion] Quick ingest failed:", error);
    res.status(500).json({ error: "Data ingestion failed" });
  }
});

export default router;
