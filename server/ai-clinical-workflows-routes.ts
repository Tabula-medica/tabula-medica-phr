import { Router, Request, Response } from "express";
import { aiPatientSummaryService, PatientRecordData } from "./services/ai-patient-summary-service";
import { aiRiskStratificationService, RiskFactorData } from "./services/ai-risk-stratification-service";
import { aiImagingDiagnosticService, ImagingStudy, ImagingReport } from "./services/ai-imaging-diagnostic-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { createAuditLogEntry } from "./ai-audit-log-routes";
import type { InsertAiAuditLogEntry, UserRole, TrendParameters } from "@shared/schema";

const router = Router();

function logClinicalWorkflowAccess(workflowType: string, req: Request, patientId: string) {
  const userId = (req as any).user?.id || (req as any).session?.userId || 'system';
  
  logPhiAccess({
    userId,
    action: 'read',
    resourceType: 'Patient',
    patientId,
    details: `AI clinical workflow: ${workflowType} - NO-CDS compliant, AI-assisted`
  });
}

function getUserRole(req: Request): UserRole {
  return (req as any).user?.role || (req as any).session?.userRole || 'patient';
}

function getTrendParameters(req: Request): TrendParameters | undefined {
  const params = req.body?.trendParameters;
  if (!params) return undefined;
  return {
    userId: (req as any).user?.id || 'system',
    sensitivity: params.sensitivity || 'medium',
    timeframeDays: params.timeframeDays || 90,
    smoothingEnabled: params.smoothingEnabled ?? true,
    smoothingLevel: params.smoothingLevel || 'light',
    comparisonMode: params.comparisonMode || 'absolute',
    includeOutliers: params.includeOutliers ?? true,
  };
}

/**
 * POST /api/ai-clinical/patient-summary/:patientId
 * Generate AI-powered patient record summary
 */
router.post("/patient-summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const patientData: PatientRecordData = req.body;

    if (!patientData.demographics) {
      return res.status(400).json({ 
        error: "Patient demographics required",
        disclaimer: "INFORMATIONAL ONLY"
      });
    }

    logClinicalWorkflowAccess('patient_summary', req, patientId);

    const startTime = Date.now();
    const summary = await aiPatientSummaryService.generatePatientSummary(patientData);
    const duration = Date.now() - startTime;

    const userId = (req as any).user?.id || (req as any).session?.userId || 'system';
    const userRole = getUserRole(req);
    const trendParams = getTrendParameters(req);

    const auditEntry: InsertAiAuditLogEntry = {
      eventType: 'patient_summary_generated',
      userId,
      userRole,
      patientId,
      sessionId: (req as any).session?.id,
      parameters: {
        sensitivity: trendParams?.sensitivity,
        timeframeDays: trendParams?.timeframeDays,
        smoothingEnabled: trendParams?.smoothingEnabled,
        comparisonMode: trendParams?.comparisonMode,
        includeOutliers: trendParams?.includeOutliers,
        modelUsed: 'gpt-4o',
      },
      summary: {
        title: 'Patient Record Summary',
        contentPreview: summary.oneLineSummary?.substring(0, 200) || 'Summary generated',
        confidenceScore: summary.dataQualityScore,
        warningsGenerated: summary.clinicalFlags,
        disclaimersIncluded: true,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestDurationMs: duration,
        cacheHit: false,
        fallbackUsed: false,
      },
    };
    const createdAuditLog = createAuditLogEntry(auditEntry, req);

    res.setHeader('X-AI-Disclaimer', 'Informational Only - Not Medical Advice');
    res.json({
      success: true,
      patientId,
      summary,
      auditLogId: createdAuditLog.id,
      disclaimer: summary.disclaimer
    });
  } catch (error) {
    console.error("Patient summary generation failed:", error);
    res.status(500).json({ 
      error: "Failed to generate patient summary",
      disclaimer: "INFORMATIONAL ONLY: Please consult healthcare providers for clinical decisions."
    });
  }
});

/**
 * POST /api/ai-clinical/risk-stratification/:patientId
 * Generate AI-powered risk stratification based on documented factors
 */
router.post("/risk-stratification/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const riskData: RiskFactorData = req.body;

    if (!riskData.demographics) {
      return res.status(400).json({ 
        error: "Patient demographics required",
        disclaimer: "INFORMATIONAL ONLY"
      });
    }

    logClinicalWorkflowAccess('risk_stratification', req, patientId);

    const startTime = Date.now();
    const result = await aiRiskStratificationService.stratifyPatientRisk(patientId, riskData);
    const duration = Date.now() - startTime;

    const userId = (req as any).user?.id || (req as any).session?.userId || 'system';
    const userRole = getUserRole(req);
    const trendParams = getTrendParameters(req);

    const auditEntry: InsertAiAuditLogEntry = {
      eventType: 'risk_stratification_generated',
      userId,
      userRole,
      patientId,
      sessionId: (req as any).session?.id,
      parameters: {
        sensitivity: trendParams?.sensitivity,
        timeframeDays: trendParams?.timeframeDays,
        modelUsed: 'gpt-4o',
      },
      summary: {
        title: 'Risk Stratification Analysis',
        contentPreview: `Overall risk: ${result.overallRiskLevel}. ${result.riskCategories?.length || 0} categories analyzed.`,
        confidenceScore: result.confidenceScore,
        warningsGenerated: result.priorityAlerts?.map((a: any) => a.message) || [],
        disclaimersIncluded: true,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestDurationMs: duration,
        cacheHit: false,
        fallbackUsed: false,
      },
    };
    const createdAuditLog = createAuditLogEntry(auditEntry, req);

    res.setHeader('X-AI-Disclaimer', 'Informational Only - Not Medical Advice');
    res.json({
      success: true,
      patientId,
      riskStratification: result,
      auditLogId: createdAuditLog.id,
      disclaimer: result.disclaimer
    });
  } catch (error) {
    console.error("Risk stratification failed:", error);
    res.status(500).json({ 
      error: "Failed to generate risk stratification",
      disclaimer: "INFORMATIONAL ONLY: Please consult healthcare providers for clinical decisions."
    });
  }
});

/**
 * POST /api/ai-clinical/imaging-analysis/:studyId
 * Analyze and summarize imaging report with AI assistance
 */
router.post("/imaging-analysis/:studyId", async (req: Request, res: Response) => {
  try {
    const { studyId } = req.params;
    const { study, report }: { study: ImagingStudy; report: ImagingReport } = req.body;

    if (!study || !report) {
      return res.status(400).json({ 
        error: "Study and report data required",
        disclaimer: "INFORMATIONAL ONLY"
      });
    }

    const patientId = study.patientId || studyId;
    logClinicalWorkflowAccess('imaging_analysis', req, patientId);

    const startTime = Date.now();
    const analysis = await aiImagingDiagnosticService.analyzeImagingReport(study, report);
    const duration = Date.now() - startTime;

    const userId = (req as any).user?.id || (req as any).session?.userId || 'system';
    const userRole = getUserRole(req);

    const auditEntry: InsertAiAuditLogEntry = {
      eventType: 'imaging_analysis_generated',
      userId,
      userRole,
      patientId,
      sessionId: (req as any).session?.id,
      parameters: {
        modelUsed: 'gpt-4o',
        imagingModality: study.modality,
        bodyPart: study.bodyPart,
      },
      summary: {
        title: `Imaging Analysis: ${study.modality} - ${study.description}`,
        contentPreview: analysis.plainLanguageSummary?.substring(0, 200) || 'Imaging analysis generated',
        confidenceScore: analysis.confidenceScore,
        warningsGenerated: analysis.criticalFindings?.map((f: any) => f.finding) || [],
        disclaimersIncluded: true,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestDurationMs: duration,
        cacheHit: false,
        fallbackUsed: false,
      },
    };
    const createdAuditLog = createAuditLogEntry(auditEntry, req);

    res.setHeader('X-AI-Disclaimer', 'Informational Only - Not Medical Advice');
    res.json({
      success: true,
      studyId,
      analysis,
      auditLogId: createdAuditLog.id,
      disclaimer: analysis.disclaimer
    });
  } catch (error) {
    console.error("Imaging analysis failed:", error);
    res.status(500).json({ 
      error: "Failed to analyze imaging report",
      disclaimer: "INFORMATIONAL ONLY: Please consult healthcare providers for clinical decisions."
    });
  }
});

/**
 * POST /api/ai-clinical/explain-term
 * Explain a medical imaging term in plain language
 */
router.post("/explain-term", async (req: Request, res: Response) => {
  try {
    const { term } = req.body;

    if (!term) {
      return res.status(400).json({ 
        error: "Term required",
        disclaimer: "INFORMATIONAL ONLY"
      });
    }

    const explanation = await aiImagingDiagnosticService.explainImagingTerm(term);

    res.setHeader('X-AI-Disclaimer', 'Informational Only - Not Medical Advice');
    res.json({
      success: true,
      ...explanation,
      disclaimer: "INFORMATIONAL ONLY: This explanation is for educational purposes and does not constitute medical advice."
    });
  } catch (error) {
    console.error("Term explanation failed:", error);
    res.status(500).json({ 
      error: "Failed to explain term",
      disclaimer: "INFORMATIONAL ONLY"
    });
  }
});

/**
 * GET /api/ai-clinical/health
 * Health check endpoint for AI clinical workflows
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    services: {
      patientSummary: "available",
      riskStratification: "available",
      imagingAnalysis: "available"
    },
    disclaimer: "All AI clinical workflow outputs are INFORMATIONAL ONLY and do not constitute medical advice."
  });
});

export default router;
