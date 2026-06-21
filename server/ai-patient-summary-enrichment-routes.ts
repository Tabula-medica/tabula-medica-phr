import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { aiPatientSummaryEnrichmentService, TimeframeOption } from './services/ai-patient-summary-enrichment-service';
import { logPhiAccess } from './security/hipaa-audit';

const NO_CDS_DISCLAIMER = "DISCLAIMER: This AI-generated analysis is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute medical advice, clinical recommendations, or a substitute for professional medical judgment.";

function getUserFromRequest(req: Request): { userId: string; name: string; role: string } {
  const anyReq = req as any;
  const userId = anyReq.user?.claims?.sub || anyReq.user?.id || 'user-1';
  const name = anyReq.user?.claims?.name || anyReq.user?.name || 'Dr. Sarah Chen';
  const role = anyReq.userRole || anyReq.user?.role || 'physician';
  return { userId, name, role };
}

async function auditLog(action: string, userId: string, resourceType: string, patientId: string | null, details: object) {
  try {
    await logPhiAccess({
      action: "read",
      userId,
      resourceType,
      patientId: patientId || undefined,
      details: JSON.stringify({ auditAction: action, ...details })
    });
  } catch (error) {
    console.error("[PatientSummaryEnrichment] Audit log error:", error);
  }
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: Function) => {
    const anyReq = req as any;
    const userRole = anyReq.userRole || anyReq.user?.role || anyReq.user?.claims?.role;
    const effectiveRole = userRole;
    
    if (!effectiveRole) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User role not found in request',
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
    
    anyReq.userRole = effectiveRole;
    
    if (roles.includes(effectiveRole)) {
      next();
    } else {
      res.status(403).json({
        error: 'Access denied',
        reason: `Role '${effectiveRole}' is not authorized for this operation`,
        allowedRoles: roles,
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  };
}

const ALLOWED_ROLES = ['administrator', 'clinician', 'care_coordinator', 'nurse', 'physician'];

const TimeframeSchema = z.enum(['7_days', '30_days', '90_days', '6_months', '1_year', 'all_time']);

const ExtractEventsSchema = z.object({
  patientId: z.string(),
  timeframeDays: z.number().min(1).max(365).optional().default(90)
});

const RiskInsightSchema = z.object({
  patientId: z.string()
});

const HistoricalComparisonSchema = z.object({
  patientId: z.string(),
  timeframe: TimeframeSchema.optional().default('90_days')
});

const EnrichedSummarySchema = z.object({
  patientId: z.string(),
  timeframeDays: z.number().min(1).max(365).optional().default(90),
  comparisonTimeframe: TimeframeSchema.optional().default('90_days'),
  forceRefresh: z.boolean().optional().default(false)
});

export function registerAIPatientSummaryEnrichmentRoutes(app: Express): void {
  const basePath = '/api/patient-summary-enrichment';

  app.get(`${basePath}/metadata`, (req: Request, res: Response) => {
    try {
      const metadata = aiPatientSummaryEnrichmentService.getMetadata();
      res.json({ ...metadata, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] Metadata error:', error);
      res.status(500).json({ error: 'Failed to get metadata', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.get(`${basePath}/dashboard`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      await auditLog('view_enrichment_dashboard', user.userId, 'dashboard', null, { role: user.role });
      
      const dashboard = aiPatientSummaryEnrichmentService.getDashboardSummary();
      res.json({ ...dashboard, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/extract-clinical-events`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = ExtractEventsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);
      const { patientId, timeframeDays } = parsed.data;

      await auditLog('extract_clinical_events', user.userId, 'clinical_notes', patientId, { timeframeDays });

      const eventSummary = await aiPatientSummaryEnrichmentService.extractClinicalEvents(
        patientId,
        timeframeDays,
        user.userId
      );

      res.json({ eventSummary, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] Extract events error:', error);
      res.status(500).json({ error: 'Failed to extract clinical events', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/risk-insights`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = RiskInsightSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);
      const { patientId } = parsed.data;

      await auditLog('generate_risk_insights', user.userId, 'patient_data', patientId, {});

      const riskSummary = await aiPatientSummaryEnrichmentService.generateRiskInsightSummary(
        patientId,
        user.userId
      );

      res.json({ riskSummary, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] Risk insights error:', error);
      res.status(500).json({ error: 'Failed to generate risk insights', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/historical-comparison`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = HistoricalComparisonSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);
      const { patientId, timeframe } = parsed.data;

      await auditLog('generate_historical_comparison', user.userId, 'patient_trends', patientId, { timeframe });

      const comparison = await aiPatientSummaryEnrichmentService.generateHistoricalComparison(
        patientId,
        timeframe as TimeframeOption,
        user.userId
      );

      res.json({ comparison, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] Historical comparison error:', error);
      res.status(500).json({ error: 'Failed to generate historical comparison', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/enriched-summary`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = EnrichedSummarySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);
      const { patientId, timeframeDays, comparisonTimeframe, forceRefresh } = parsed.data;

      await auditLog('generate_enriched_summary', user.userId, 'comprehensive_patient_data', patientId, {
        timeframeDays,
        comparisonTimeframe,
        forceRefresh
      });

      const enrichedSummary = await aiPatientSummaryEnrichmentService.generateEnrichedSummary(
        patientId,
        user.userId,
        {
          timeframeDays,
          comparisonTimeframe: comparisonTimeframe as TimeframeOption,
          forceRefresh
        }
      );

      res.json({ enrichedSummary, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] Enriched summary error:', error);
      res.status(500).json({ error: 'Failed to generate enriched summary', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.get(`${basePath}/patients`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      await auditLog('list_available_patients', user.userId, 'patient_list', null, {});
      
      const dashboard = aiPatientSummaryEnrichmentService.getDashboardSummary();
      res.json({ 
        patients: dashboard.samplePatients,
        total: dashboard.availablePatients,
        disclaimer: NO_CDS_DISCLAIMER 
      });
    } catch (error: any) {
      console.error('[PatientSummaryEnrichment] List patients error:', error);
      res.status(500).json({ error: 'Failed to list patients', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  console.log('[Routes] AI Patient Summary Enrichment routes registered at /api/patient-summary-enrichment/*');
}
