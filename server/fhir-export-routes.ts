import { Express } from "express";
import { fhirExportService } from "./services/fhir-export-service";
import { requireFeature } from "./middleware/require-feature";
import { requireUser, getUserId } from "./middleware/require-user";

export function registerFHIRExportRoutes(app: Express): void {
  const BASE_PATH = "/api/fhir-export";
  // Feature gate for bulk-export actions. Reads (formats, resource-types,
  // jobs list) remain open so the UI can render dashboards on free tier;
  // the actual export/download/cancel actions are gated.
  const gateBulkExport = requireFeature("bulk_export");

  app.get(`${BASE_PATH}/formats`, requireUser, async (req, res) => {
    try {
      const formats = await fhirExportService.getSupportedFormats();
      res.json({ formats });
    } catch (error) {
      console.error("[FHIRExport] Get formats error:", error);
      res.status(500).json({ error: "Failed to fetch supported formats" });
    }
  });

  app.get(`${BASE_PATH}/resource-types`, requireUser, async (req, res) => {
    try {
      const resourceTypes = await fhirExportService.getSupportedResourceTypes();
      res.json({ resourceTypes });
    } catch (error) {
      console.error("[FHIRExport] Get resource types error:", error);
      res.status(500).json({ error: "Failed to fetch resource types" });
    }
  });

  app.post(`${BASE_PATH}/preview`, requireUser, async (req, res) => {
    try {
      const preview = await fhirExportService.getExportPreview(req.body);
      res.json(preview);
    } catch (error) {
      console.error("[FHIRExport] Preview error:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  app.post(`${BASE_PATH}/requests`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const request = await fhirExportService.createExportRequest(userId, req.body);
      res.status(201).json(request);
    } catch (error) {
      console.error("[FHIRExport] Create request error:", error);
      res.status(500).json({ error: "Failed to create export request" });
    }
  });

  app.post(`${BASE_PATH}/start/:requestId`, requireUser, gateBulkExport, async (req, res) => {
    try {
      const userId = getUserId(req);
      const job = await fhirExportService.startExport(userId, req.params.requestId);
      res.json(job);
    } catch (error) {
      console.error("[FHIRExport] Start export error:", error);
      res.status(500).json({ error: "Failed to start export" });
    }
  });

  app.get(`${BASE_PATH}/jobs`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const jobs = await fhirExportService.getExportJobs(userId);
      res.json({ jobs });
    } catch (error) {
      console.error("[FHIRExport] Get jobs error:", error);
      res.status(500).json({ error: "Failed to fetch export jobs" });
    }
  });

  app.get(`${BASE_PATH}/jobs/:jobId`, requireUser, async (req, res) => {
    try {
      const job = await fhirExportService.getExportJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Export job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("[FHIRExport] Get job error:", error);
      res.status(500).json({ error: "Failed to fetch export job" });
    }
  });

  app.post(`${BASE_PATH}/jobs/:jobId/cancel`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const job = await fhirExportService.cancelExport(req.params.jobId, userId);
      if (!job) {
        return res.status(404).json({ error: "Export job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("[FHIRExport] Cancel job error:", error);
      res.status(500).json({ error: "Failed to cancel export" });
    }
  });

  app.get(`${BASE_PATH}/download/:jobId`, requireUser, gateBulkExport, async (req, res) => {
    try {
      const { data, contentType, filename } = await fhirExportService.generateExportData(req.params.jobId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(data);
    } catch (error) {
      console.error("[FHIRExport] Download error:", error);
      res.status(500).json({ error: "Failed to download export" });
    }
  });

  app.post(`${BASE_PATH}/suggestions`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { context } = req.body;
      const suggestions = await fhirExportService.getAIExportSuggestions(userId, context);
      res.json({ suggestions });
    } catch (error) {
      console.error("[FHIRExport] AI suggestions error:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  console.log("[FHIRExport] Routes registered at /api/fhir-export/*");
  console.log("[FHIRExport] Endpoints: /formats, /resource-types, /preview, /requests, /start, /jobs, /download, /suggestions");
}
