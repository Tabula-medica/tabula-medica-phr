import { Router, Request, Response } from "express";
import * as DICOMViewerService from "./services/dicom-viewer-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/studies", (req: Request, res: Response) => {
  try {
    const patientId = req.query.patientId as string | undefined;
    const studies = DICOMViewerService.getStudies(patientId);
    res.json({ studies, total: studies.length });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching studies:", error);
    res.status(500).json({ error: "Failed to fetch studies" });
  }
});

router.get("/studies/:studyId", (req: Request, res: Response) => {
  try {
    const { studyId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    const study = DICOMViewerService.getStudyById(studyId, userId);
    
    if (!study) {
      return res.status(404).json({ error: "Study not found" });
    }
    
    res.json({ study });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching study:", error);
    res.status(500).json({ error: "Failed to fetch study" });
  }
});

router.get("/studies/:studyId/fhir", (req: Request, res: Response) => {
  try {
    const { studyId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    const study = DICOMViewerService.getStudyById(studyId, userId);
    
    if (!study) {
      return res.status(404).json({ error: "Study not found" });
    }
    
    const fhirResource = DICOMViewerService.convertToFHIRImagingStudy(study);
    res.json(fhirResource);
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error converting to FHIR:", error);
    res.status(500).json({ error: "Failed to convert study to FHIR" });
  }
});

router.get("/annotations", (req: Request, res: Response) => {
  try {
    const studyId = req.query.studyId as string;
    const userId = (req as any).user?.id || "anonymous";
    
    if (!studyId) {
      return res.status(400).json({ error: "studyId is required" });
    }
    
    const annotations = DICOMViewerService.getAnnotations(studyId, userId);
    res.json({ annotations, total: annotations.length });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching annotations:", error);
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
});

router.post("/annotations", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const userName = (req as any).user?.username || "Anonymous Clinician";
    
    const { studyId, seriesId, instanceId, type, coordinates, label, description, color, diagnosis, aiFinding } = req.body;
    
    if (!studyId || !type || !coordinates) {
      return res.status(400).json({ error: "studyId, type, and coordinates are required" });
    }
    
    const annotation = DICOMViewerService.createAnnotation({
      studyId,
      seriesId,
      instanceId,
      type,
      coordinates,
      label,
      description,
      color: color || "#ef4444",
      clinicianId: userId,
      clinicianName: userName,
      diagnosis,
      aiFinding,
    }, userId);
    
    res.status(201).json(annotation);
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error creating annotation:", error);
    res.status(500).json({ error: "Failed to create annotation" });
  }
});

router.patch("/annotations/:annotationId", (req: Request, res: Response) => {
  try {
    const { annotationId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const annotation = DICOMViewerService.updateAnnotation(annotationId, req.body, userId);
    
    if (!annotation) {
      return res.status(404).json({ error: "Annotation not found" });
    }
    
    res.json(annotation);
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error updating annotation:", error);
    res.status(500).json({ error: "Failed to update annotation" });
  }
});

router.delete("/annotations/:annotationId", (req: Request, res: Response) => {
  try {
    const { annotationId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const success = DICOMViewerService.deleteAnnotation(annotationId, userId);
    
    if (!success) {
      return res.status(404).json({ error: "Annotation not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error deleting annotation:", error);
    res.status(500).json({ error: "Failed to delete annotation" });
  }
});

router.get("/ai-findings", (req: Request, res: Response) => {
  try {
    const studyId = req.query.studyId as string;
    const userId = (req as any).user?.id || "anonymous";
    
    if (!studyId) {
      return res.status(400).json({ error: "studyId is required" });
    }
    
    const findings = DICOMViewerService.getAIFindings(studyId);
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImagingAIFindings",
      resourceId: studyId,
      details: `ai_findings_access:${findings.length}`,
    });
    
    res.json({
      findings,
      disclaimer: "AI findings are INFORMATIONAL ONLY. All findings must be verified by a qualified healthcare professional. This system does not provide medical diagnoses or treatment recommendations.",
      model: "Multiple AI models",
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching AI findings:", error);
    res.status(500).json({ error: "Failed to fetch AI findings" });
  }
});

router.get("/pacs-connections", (_req: Request, res: Response) => {
  try {
    const connections = DICOMViewerService.getPACSConnections();
    res.json({ connections, total: connections.length });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching PACS connections:", error);
    res.status(500).json({ error: "Failed to fetch PACS connections" });
  }
});

router.post("/pacs-connections", (req: Request, res: Response) => {
  try {
    const { name, endpoint, aetitle, calledAetitle, port, protocol, syncSchedule, autoIngest } = req.body;
    
    if (!name || !endpoint || !aetitle || !calledAetitle) {
      return res.status(400).json({ error: "name, endpoint, aetitle, and calledAetitle are required" });
    }
    
    const connection = DICOMViewerService.createPACSConnection({
      name,
      endpoint,
      aetitle,
      calledAetitle,
      port: port || 11112,
      protocol: protocol || "DICOMweb",
      syncSchedule,
      autoIngest: autoIngest ?? false,
    });
    
    res.status(201).json(connection);
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error creating PACS connection:", error);
    res.status(500).json({ error: "Failed to create PACS connection" });
  }
});

router.post("/pacs-connections/:connectionId/sync", (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const job = DICOMViewerService.syncPACSConnection(connectionId);
    
    if (!job) {
      return res.status(404).json({ error: "PACS connection not found" });
    }
    
    res.json({ job, message: "Sync started" });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error syncing PACS:", error);
    res.status(500).json({ error: "Failed to start PACS sync" });
  }
});

router.get("/ingestion-jobs", (_req: Request, res: Response) => {
  try {
    const jobs = DICOMViewerService.getIngestionJobs();
    res.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching ingestion jobs:", error);
    res.status(500).json({ error: "Failed to fetch ingestion jobs" });
  }
});

router.get("/ingestion-jobs/:jobId", (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = DICOMViewerService.getIngestionJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: "Ingestion job not found" });
    }
    
    res.json(job);
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error fetching ingestion job:", error);
    res.status(500).json({ error: "Failed to fetch ingestion job" });
  }
});

router.post("/ingest", (req: Request, res: Response) => {
  try {
    const { source, sourceConfig } = req.body;
    
    if (!source) {
      return res.status(400).json({ error: "source is required" });
    }
    
    const job = DICOMViewerService.createIngestionJob(source, sourceConfig || {});
    res.status(202).json({ job, message: "Ingestion job created" });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error creating ingestion job:", error);
    res.status(500).json({ error: "Failed to create ingestion job" });
  }
});

router.post("/extract-metadata", (req: Request, res: Response) => {
  try {
    const metadata = DICOMViewerService.extractDICOMMetadata(Buffer.from(""));
    res.json({ metadata, message: "Metadata extraction simulated" });
  } catch (error) {
    console.error("[DICOMViewerRoutes] Error extracting metadata:", error);
    res.status(500).json({ error: "Failed to extract metadata" });
  }
});

console.log("[DICOMViewerRoutes] Routes module loaded");
console.log("[DICOMViewerRoutes] Endpoints: /studies, /annotations, /ai-findings, /pacs-connections, /ingestion-jobs, /ingest");

export default router;
