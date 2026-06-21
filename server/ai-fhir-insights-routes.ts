/**
 * AI FHIR Insights Routes - REST API for AI-Driven Trend Analysis
 * 
 * Provides endpoints for:
 * - Medication insights
 * - Condition insights
 * - Lab insights
 * - Encounter insights
 * - Comprehensive cross-domain insights
 * 
 * STRICT COMPLIANCE: All responses are INFORMATIONAL ONLY.
 */

import { Router, Request, Response } from 'express';
import { aiFhirInsightsService } from './services/ai-fhir-insights-service';
import { logPhiAccess } from './security/hipaa-audit';

const router = Router();

// Informational disclaimer header
const DISCLAIMER_HEADER = 'X-AI-Informational-Only';
const DISCLAIMER_VALUE = 'true';

// HIPAA-compliant audit logging with full request context
function logInsightsAccess(action: string, req: Request, patientId: string): void {
  const userId = (req as any).user?.id || (req as any).session?.userId || 'unauthenticated';
  const userRole = (req as any).user?.role || (req as any).session?.role || 'unknown';
  const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  logPhiAccess({
    userId,
    patientId,
    resourceType: 'AIFHIRInsights',
    action: 'read',
    userRole,
    ipAddress,
    userAgent,
    requestPath: req.path,
    requestMethod: req.method,
    details: `[AIFHIRInsights] Action: ${action} | Info-only: true | Endpoint: ${req.originalUrl}`
  }).catch(err => {
    console.error('[AIFHIRInsights] HIPAA audit logging failed:', err);
  });
}

/**
 * POST /api/ai-fhir-insights/medications/:patientId
 * Generate AI insights for medications with data
 */
router.post('/medications/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { medications = [] } = req.body;

    logInsightsAccess('medication_insights', req, patientId);

    const insights = await aiFhirInsightsService.generateMedicationInsights(
      patientId,
      medications
    );

    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json({
      success: true,
      data: insights,
      disclaimer: 'All insights are for informational purposes only and do not constitute medical advice.',
    });
  } catch (error) {
    console.error('[AIFHIRInsights] Medication insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate medication insights',
      disclaimer: 'Service temporarily unavailable. Consult healthcare providers directly.',
    });
  }
});

/**
 * POST /api/ai-fhir-insights/conditions/:patientId
 * Generate AI insights for conditions
 */
router.post('/conditions/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { conditions = [] } = req.body;

    logInsightsAccess('condition_insights', req, patientId);

    const insights = await aiFhirInsightsService.generateConditionInsights(
      patientId,
      conditions
    );

    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json({
      success: true,
      data: insights,
      disclaimer: 'All insights are for informational purposes only and do not constitute medical advice.',
    });
  } catch (error) {
    console.error('[AIFHIRInsights] Condition insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate condition insights',
      disclaimer: 'Service temporarily unavailable. Consult healthcare providers directly.',
    });
  }
});

/**
 * POST /api/ai-fhir-insights/labs/:patientId
 * Generate AI insights for labs
 */
router.post('/labs/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { labs = [] } = req.body;

    logInsightsAccess('lab_insights', req, patientId);

    const insights = await aiFhirInsightsService.generateLabInsights(
      patientId,
      labs
    );

    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json({
      success: true,
      data: insights,
      disclaimer: 'All insights are for informational purposes only and do not constitute medical advice.',
    });
  } catch (error) {
    console.error('[AIFHIRInsights] Lab insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate lab insights',
      disclaimer: 'Service temporarily unavailable. Consult healthcare providers directly.',
    });
  }
});

/**
 * POST /api/ai-fhir-insights/encounters/:patientId
 * Generate AI insights for encounters
 */
router.post('/encounters/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { encounters = [] } = req.body;

    logInsightsAccess('encounter_insights', req, patientId);

    const insights = await aiFhirInsightsService.generateEncounterInsights(
      patientId,
      encounters
    );

    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json({
      success: true,
      data: insights,
      disclaimer: 'All insights are for informational purposes only and do not constitute medical advice.',
    });
  } catch (error) {
    console.error('[AIFHIRInsights] Encounter insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate encounter insights',
      disclaimer: 'Service temporarily unavailable. Consult healthcare providers directly.',
    });
  }
});

/**
 * POST /api/ai-fhir-insights/comprehensive/:patientId
 * Generate comprehensive AI insights across all data types
 */
router.post('/comprehensive/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { medications = [], conditions = [], labs = [], encounters = [] } = req.body;

    logInsightsAccess('comprehensive_insights', req, patientId);

    const insights = await aiFhirInsightsService.generateComprehensiveInsights(
      patientId,
      medications,
      conditions,
      labs,
      encounters
    );

    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json({
      success: true,
      data: insights,
      disclaimer: 'All insights are for informational purposes only and do not constitute medical advice.',
    });
  } catch (error) {
    console.error('[AIFHIRInsights] Comprehensive insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate comprehensive insights',
      disclaimer: 'Service temporarily unavailable. Consult healthcare providers directly.',
    });
  }
});

/**
 * DELETE /api/ai-fhir-insights/cache/:patientId
 * Clear cached insights for a patient
 */
router.delete('/cache/:patientId', (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    aiFhirInsightsService.clearPatientCache(patientId);
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to clear cache' });
  }
});

/**
 * GET /api/ai-fhir-insights/disclaimer
 * Get disclaimers for AI insights
 */
router.get('/disclaimer', (req: Request, res: Response) => {
  const { type } = req.query;
  
  res.json({
    patient: aiFhirInsightsService.getPatientDisclaimer(),
    provider: aiFhirInsightsService.getProviderDisclaimer(),
  });
});

console.log('[AIFHIRInsights] Routes module loaded with NO-CDS compliance');

export default router;
