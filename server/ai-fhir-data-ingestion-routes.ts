import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { aiFHIRDataIngestionService } from './services/ai-fhir-data-ingestion-service';
import { logPhiAccess } from './security/hipaa-audit';

const router = Router();

const NO_CDS_COMPLIANCE = "INFORMATIONAL ONLY - AI-generated content for data governance and operational purposes. Not intended for clinical decision-making.";

const submitNoteSchema = z.object({
  patientId: z.string(),
  noteType: z.enum(['doctor_note', 'lab_report', 'discharge_summary', 'radiology_report', 'pathology_report', 'consultation_note']),
  rawText: z.string().min(10),
  sourceSystem: z.string().optional(),
  documentDate: z.string()
});

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const validated = submitNoteSchema.parse(req.body);
    
    logPhiAccess({
      action: 'write',
      resourceType: 'ClinicalNote',
      resourceId: 'new',
      userId: 'system',
      patientId: validated.patientId,
      details: `Submitting ${validated.noteType} for AI ingestion`
    });

    const result = await aiFHIRDataIngestionService.submitClinicalNote(validated);
    
    res.json({
      ...result,
      noCdsCompliance: NO_CDS_COMPLIANCE
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to submit clinical note', message: String(error) });
  }
});

router.get('/jobs', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'IngestionJob',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing ingestion jobs list'
    });

    const jobs = aiFHIRDataIngestionService.getAllJobs();
    res.json({ items: jobs, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get jobs', message: String(error) });
  }
});

router.get('/jobs/:jobId', (req: Request, res: Response) => {
  try {
    const details = aiFHIRDataIngestionService.getJobDetails(req.params.jobId);
    if (!details) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    logPhiAccess({
      action: 'read',
      resourceType: 'IngestionJob',
      resourceId: req.params.jobId,
      userId: 'system',
      patientId: details.job.patientId,
      details: 'Viewing ingestion job details'
    });

    res.json({ ...details, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job details', message: String(error) });
  }
});

router.post('/jobs/:jobId/reprocess', async (req: Request, res: Response) => {
  try {
    const job = await aiFHIRDataIngestionService.reprocessJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found or not in failed state' });
    }
    
    logPhiAccess({
      action: 'write',
      resourceType: 'IngestionJob',
      resourceId: req.params.jobId,
      userId: 'system',
      patientId: job.patientId,
      details: 'Reprocessing failed ingestion job'
    });

    res.json({ job, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reprocess job', message: String(error) });
  }
});

router.get('/parsed', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'ParsedClinicalData',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing AI-parsed clinical data list'
    });

    const parsedData = aiFHIRDataIngestionService.getAllParsedData();
    res.json({ items: parsedData, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get parsed data', message: String(error) });
  }
});

router.get('/mappings', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'FHIRMappingResult',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing FHIR mapping results list'
    });

    const mappings = aiFHIRDataIngestionService.getAllMappings();
    res.json({ items: mappings, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get mappings', message: String(error) });
  }
});

router.get('/quality/metrics', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'QualityMetrics',
      resourceId: 'aggregate',
      userId: 'system',
      details: 'Viewing ingestion quality metrics'
    });

    const metrics = aiFHIRDataIngestionService.getQualityMetrics();
    res.json({ ...metrics, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get quality metrics', message: String(error) });
  }
});

router.get('/quality/issues', (req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'QualityIssue',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing quality issues list'
    });

    const status = req.query.status as string | undefined;
    const issues = aiFHIRDataIngestionService.getQualityIssues(status);
    res.json({ items: issues, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get quality issues', message: String(error) });
  }
});

const updateIssueSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'ignored'])
});

router.patch('/quality/issues/:issueId', (req: Request, res: Response) => {
  try {
    const validated = updateIssueSchema.parse(req.body);
    const issue = aiFHIRDataIngestionService.updateIssueStatus(req.params.issueId, validated.status);
    
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    logPhiAccess({
      action: 'write',
      resourceType: 'QualityIssue',
      resourceId: req.params.issueId,
      userId: 'system',
      details: `Updated issue status to ${validated.status}`
    });

    res.json({ ...issue, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update issue', message: String(error) });
  }
});

router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'IngestionDashboard',
      resourceId: 'aggregate',
      userId: 'system',
      details: 'Viewing ingestion dashboard'
    });

    const metrics = aiFHIRDataIngestionService.getQualityMetrics();
    const jobs = aiFHIRDataIngestionService.getAllJobs().slice(0, 10);
    const issues = aiFHIRDataIngestionService.getQualityIssues('open').slice(0, 10);
    const mappings = aiFHIRDataIngestionService.getAllMappings().slice(0, 10);
    
    res.json({
      metrics,
      recentJobs: jobs,
      openIssues: issues,
      recentMappings: mappings,
      noCdsCompliance: NO_CDS_COMPLIANCE
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard', message: String(error) });
  }
});

export function registerAIFHIRDataIngestionRoutes(app: any) {
  app.use('/api/fhir-data-ingestion', router);
  console.log('[Routes] AI FHIR Data Ingestion routes registered at /api/fhir-data-ingestion/*');
}
