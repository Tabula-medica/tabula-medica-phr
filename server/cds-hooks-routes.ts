/**
 * CDS Hooks API Routes - HL7 CDS Hooks REST Endpoints
 * 
 * Implements the CDS Hooks specification REST API for:
 * - Service discovery (GET /cds-services)
 * - Hook invocation (POST /cds-services/:id)
 * - Feedback endpoint (POST /cds-services/:id/feedback)
 * 
 * STRICT COMPLIANCE: All responses include informational disclaimers.
 * This API does NOT provide treatment recommendations.
 */

import { Router, Request, Response } from 'express';
import { cdsHooksService, CDSRequest, CDSHookType } from './services/cds-hooks-service';
import { logPhiAccess } from './security/hipaa-audit';

const router = Router();

// HIPAA-compliant audit logging for CDS hooks access
function logCDSAccess(action: string, details: Record<string, any>): void {
  // Use centralized HIPAA audit logging system
  logPhiAccess({
    userId: details.userId || 'system',
    patientId: details.patientId,
    resourceType: 'CDSHooks',
    action: 'read',
    userRole: 'provider',
    ipAddress: 'internal',
    userAgent: 'cds-hooks-api',
    requestPath: `/api/cds-hooks/${action}`,
    requestMethod: 'POST',
    details: `[CDSHooks][PHI-Access] Action: ${action} | Details: ${JSON.stringify(details)} | Info-only: true`
  }).catch(err => {
    console.error('[CDSHooks] HIPAA audit logging failed:', err);
  });
}

// Informational disclaimer header
const DISCLAIMER_HEADER = 'X-CDS-Informational-Only';
const DISCLAIMER_VALUE = 'true';

/**
 * CDS Hooks Discovery Endpoint
 * GET /api/cds-hooks/cds-services
 * 
 * Returns list of available CDS hooks per HL7 specification
 */
router.get('/cds-services', (req: Request, res: Response) => {
  try {
    const hooks = cdsHooksService.getAvailableHooks();
    
    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json({
      ...hooks,
      disclaimer: 'All CDS services provide INFORMATIONAL context only. They do NOT provide medical advice or treatment recommendations.',
      complianceNotice: 'This implementation adheres to strict informational-only principles. Clinical judgment by qualified providers is required for all patient care decisions.'
    });
  } catch (error) {
    console.error('[CDSHooks] Discovery error:', error);
    res.status(500).json({ 
      error: 'CDS discovery failed',
      disclaimer: 'Service temporarily unavailable. Consult authoritative clinical sources directly.'
    });
  }
});

/**
 * CDS Hook Invocation Endpoint
 * POST /api/cds-hooks/cds-services/:hookId
 * 
 * Invokes a specific CDS hook and returns informational cards
 */
router.post('/cds-services/:hookId', async (req: Request, res: Response) => {
  try {
    const { hookId } = req.params;
    const hookRequest = req.body as CDSRequest;

    // Validate request
    if (!hookRequest.hook || !hookRequest.context?.patientId) {
      return res.status(400).json({
        error: 'Invalid CDS request',
        message: 'Request must include hook type and patient context',
        disclaimer: 'This is an API validation error, not a clinical recommendation.'
      });
    }

    // Log PHI access
    logCDSAccess('hook_invocation', {
      hookId,
      hookType: hookRequest.hook,
      patientId: hookRequest.context.patientId,
      userId: hookRequest.context.userId || 'anonymous'
    });

    // Invoke hook
    const response = await cdsHooksService.invokeHook(hookRequest);

    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json(response);
  } catch (error) {
    console.error('[CDSHooks] Hook invocation error:', error);
    res.status(500).json({
      cards: [],
      error: 'CDS hook invocation failed',
      disclaimer: 'Service error. Consult authoritative clinical sources directly.'
    });
  }
});

/**
 * CDS Feedback Endpoint
 * POST /api/cds-hooks/cds-services/:hookId/feedback
 * 
 * Receives feedback on CDS cards (acceptance, override, etc.)
 */
router.post('/cds-services/:hookId/feedback', (req: Request, res: Response) => {
  try {
    const { hookId } = req.params;
    const { 
      card, 
      outcome, 
      outcomeTimestamp,
      overrideReasons,
      patientId,
      providerId
    } = req.body;

    // Log feedback for audit
    logCDSAccess('feedback_received', {
      hookId,
      cardId: card,
      outcome,
      patientId,
      providerId,
      overrideReasons
    });

    // Record in audit log
    if (outcome === 'accepted' && patientId) {
      cdsHooksService.logSuggestionAccepted(
        hookId as CDSHookType,
        patientId,
        card,
        providerId
      );
    } else if (outcome === 'overridden' && patientId) {
      cdsHooksService.logOverride(
        hookId as CDSHookType,
        patientId,
        card,
        overrideReasons?.join(', ') || 'No reason provided',
        providerId
      );
    }

    res.status(200).json({
      message: 'Feedback recorded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CDSHooks] Feedback error:', error);
    res.status(500).json({ error: 'Feedback recording failed' });
  }
});

/**
 * Convenience endpoint: Invoke patient-view hook
 * POST /api/cds-hooks/patient-view
 */
router.post('/patient-view', async (req: Request, res: Response) => {
  try {
    const { patientId, userId, medications, conditions, labResults } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    logCDSAccess('patient_view', { patientId, userId });

    const request: CDSRequest = {
      hook: 'patient-view',
      hookInstance: `pv-${Date.now()}`,
      context: {
        patientId,
        userId,
        medications,
        conditions,
        labResults
      }
    };

    const response = await cdsHooksService.invokeHook(request);
    
    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json(response);
  } catch (error) {
    console.error('[CDSHooks] Patient view error:', error);
    res.status(500).json({ error: 'Patient view hook failed' });
  }
});

/**
 * Convenience endpoint: Invoke medication-prescribe hook
 * POST /api/cds-hooks/medication-prescribe
 */
router.post('/medication-prescribe', async (req: Request, res: Response) => {
  try {
    const { patientId, userId, medications, draftOrders } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    logCDSAccess('medication_prescribe', { patientId, userId });

    const request: CDSRequest = {
      hook: 'medication-prescribe',
      hookInstance: `mp-${Date.now()}`,
      context: {
        patientId,
        userId,
        medications,
        draftOrders
      }
    };

    const response = await cdsHooksService.invokeHook(request);
    
    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json(response);
  } catch (error) {
    console.error('[CDSHooks] Medication prescribe error:', error);
    res.status(500).json({ error: 'Medication prescribe hook failed' });
  }
});

/**
 * Convenience endpoint: Invoke order-select hook
 * POST /api/cds-hooks/order-select
 */
router.post('/order-select', async (req: Request, res: Response) => {
  try {
    const { patientId, userId, conditions, draftOrders } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    logCDSAccess('order_select', { patientId, userId });

    const request: CDSRequest = {
      hook: 'order-select',
      hookInstance: `os-${Date.now()}`,
      context: {
        patientId,
        userId,
        conditions,
        draftOrders
      }
    };

    const response = await cdsHooksService.invokeHook(request);
    
    res.setHeader(DISCLAIMER_HEADER, DISCLAIMER_VALUE);
    res.json(response);
  } catch (error) {
    console.error('[CDSHooks] Order select error:', error);
    res.status(500).json({ error: 'Order select hook failed' });
  }
});

/**
 * Get CDS audit logs (admin/compliance endpoint)
 * GET /api/cds-hooks/audit-logs
 */
router.get('/audit-logs', (req: Request, res: Response) => {
  try {
    const { patientId, hookType, startDate, endDate } = req.query;

    logCDSAccess('audit_log_access', { 
      filters: { patientId, hookType, startDate, endDate } 
    });

    const logs = cdsHooksService.getAuditLogs({
      patientId: patientId as string,
      hookType: hookType as CDSHookType,
      startDate: startDate as string,
      endDate: endDate as string
    });

    res.json({
      logs,
      count: logs.length,
      disclaimer: 'Audit logs are provided for compliance and quality improvement purposes.'
    });
  } catch (error) {
    console.error('[CDSHooks] Audit logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

/**
 * Get external CDS service configurations
 * GET /api/cds-hooks/external-services
 */
router.get('/external-services', (req: Request, res: Response) => {
  try {
    const services = cdsHooksService.getExternalServices();
    res.json({
      services,
      disclaimer: 'External CDS services are for informational purposes only.'
    });
  } catch (error) {
    console.error('[CDSHooks] External services error:', error);
    res.status(500).json({ error: 'Failed to retrieve external services' });
  }
});

/**
 * Test external CDS service connectivity
 * POST /api/cds-hooks/external-services/:serviceId/test
 */
router.post('/external-services/:serviceId/test', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const result = await cdsHooksService.testExternalService(serviceId);
    res.json(result);
  } catch (error) {
    console.error('[CDSHooks] Service test error:', error);
    res.status(500).json({ error: 'Service test failed' });
  }
});

export default router;
