import { Router, Request, Response } from 'express';
import { safetyAlertsService } from '../services/safety-alerts-service';

const router = Router();

router.get('/metadata', (_req: Request, res: Response) => {
  res.json({
    service: 'Safety Alerts Service (Red Flag System)',
    version: '1.0.0',
    description: 'Clinical range validation with abnormal value detection and patient prompts',
    compliance: ['NO-CDS (informational only)', 'Liability mitigation'],
    features: [
      'Clinical reference ranges (LOINC-based)',
      'Abnormal value detection',
      'Critical/Warning/Informational alert levels',
      'Age and gender adjustments',
      'Patient-friendly recommendations',
      'WORM audit trail integration'
    ],
    endpoints: {
      'GET /metadata': 'Service information',
      'GET /statistics': 'Alert statistics',
      'GET /clinical-ranges': 'All configured clinical ranges',
      'GET /clinical-ranges/:code': 'Specific clinical range',
      'POST /evaluate': 'Evaluate single observation',
      'POST /evaluate-batch': 'Evaluate multiple observations',
      'GET /patient/:patientId/alerts': 'Get patient alerts',
      'POST /alerts/:alertId/acknowledge': 'Acknowledge alert',
      'POST /alerts/:alertId/resolve': 'Resolve alert',
      'POST /alerts/:alertId/dismiss': 'Dismiss alert'
    },
    disclaimer: 'This system provides informational alerts only. It does not provide clinical decision support or medical advice. Always consult a healthcare provider for medical decisions.'
  });
});

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const stats = safetyAlertsService.getStatistics();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error getting statistics:', error);
    res.status(500).json({ success: false, error: 'Failed to get alert statistics' });
  }
});

router.get('/clinical-ranges', (_req: Request, res: Response) => {
  try {
    const ranges = safetyAlertsService.getAllClinicalRanges();
    res.json({
      success: true,
      count: ranges.length,
      ranges
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error getting clinical ranges:', error);
    res.status(500).json({ success: false, error: 'Failed to get clinical ranges' });
  }
});

router.get('/clinical-ranges/:code', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const range = safetyAlertsService.getClinicalRange(code);

    if (!range) {
      res.status(404).json({ success: false, error: 'Clinical range not found' });
      return;
    }

    res.json({
      success: true,
      range
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error getting clinical range:', error);
    res.status(500).json({ success: false, error: 'Failed to get clinical range' });
  }
});

router.post('/evaluate', (req: Request, res: Response) => {
  try {
    const { patientId, observationCode, value, age, gender, source } = req.body;

    if (!patientId || !observationCode || value === undefined) {
      res.status(400).json({ success: false, error: 'Missing required fields: patientId, observationCode, value' });
      return;
    }

    const alert = safetyAlertsService.evaluateObservation(patientId, observationCode, value, {
      age,
      gender,
      source
    });

    if (!alert) {
      res.json({
        success: true,
        withinNormalRange: true,
        message: 'Value is within normal range - no alert generated'
      });
      return;
    }

    res.json({
      success: true,
      withinNormalRange: false,
      alert,
      message: alert.message,
      recommendation: alert.recommendation
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error evaluating observation:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate observation' });
  }
});

router.post('/evaluate-batch', (req: Request, res: Response) => {
  try {
    const { patientId, observations, age, gender, source } = req.body;

    if (!patientId || !observations || !Array.isArray(observations)) {
      res.status(400).json({ success: false, error: 'Missing required fields: patientId, observations (array)' });
      return;
    }

    const alerts = safetyAlertsService.evaluateBatchObservations(patientId, observations, {
      age,
      gender,
      source
    });

    res.json({
      success: true,
      totalEvaluated: observations.length,
      alertsGenerated: alerts.length,
      alerts,
      summary: {
        critical: alerts.filter(a => a.alertType === 'CRITICAL').length,
        warning: alerts.filter(a => a.alertType === 'WARNING').length,
        informational: alerts.filter(a => a.alertType === 'INFORMATIONAL').length
      }
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error evaluating batch:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate observations' });
  }
});

router.get('/patient/:patientId/alerts', (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status, alertType, limit } = req.query;

    const alerts = safetyAlertsService.getPatientAlerts(patientId, {
      status: status as any,
      alertType: alertType as any,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });

    res.json({
      success: true,
      patientId,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error getting patient alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to get patient alerts' });
  }
});

router.get('/alerts/:alertId', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = safetyAlertsService.getAlertById(alertId);

    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error getting alert:', error);
    res.status(500).json({ success: false, error: 'Failed to get alert' });
  }
});

router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;

    if (!acknowledgedBy) {
      res.status(400).json({ success: false, error: 'Missing acknowledgedBy field' });
      return;
    }

    const alert = safetyAlertsService.acknowledgeAlert(alertId, acknowledgedBy);

    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({
      success: true,
      alert,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error acknowledging alert:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

router.post('/alerts/:alertId/resolve', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy } = req.body;

    if (!resolvedBy) {
      res.status(400).json({ success: false, error: 'Missing resolvedBy field' });
      return;
    }

    const alert = safetyAlertsService.resolveAlert(alertId, resolvedBy);

    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({
      success: true,
      alert,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error resolving alert:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

router.post('/alerts/:alertId/dismiss', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { dismissedBy, reason } = req.body;

    if (!dismissedBy) {
      res.status(400).json({ success: false, error: 'Missing dismissedBy field' });
      return;
    }

    const alert = safetyAlertsService.dismissAlert(alertId, dismissedBy, reason);

    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({
      success: true,
      alert,
      message: 'Alert dismissed successfully'
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error dismissing alert:', error);
    res.status(500).json({ success: false, error: 'Failed to dismiss alert' });
  }
});

router.post('/clinical-ranges', (req: Request, res: Response) => {
  try {
    const range = req.body;

    if (!range.code || !range.displayName || !range.unit || !range.normalRange) {
      res.status(400).json({ success: false, error: 'Missing required fields: code, displayName, unit, normalRange' });
      return;
    }

    safetyAlertsService.addCustomClinicalRange(range);

    res.json({
      success: true,
      range,
      message: 'Clinical range added successfully'
    });
  } catch (error) {
    console.error('[SafetyAlertsRoutes] Error adding clinical range:', error);
    res.status(500).json({ success: false, error: 'Failed to add clinical range' });
  }
});

export default router;
