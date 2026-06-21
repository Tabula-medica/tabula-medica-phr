import { Router, Request, Response } from 'express';
import { wormAuditLogService } from '../services/worm-audit-log-service';

const router = Router();

router.get('/metadata', (_req: Request, res: Response) => {
  res.json({
    service: 'WORM Audit Log Service',
    version: '1.0.0',
    description: 'Write Once Read Many (WORM) compliant audit logging with hash chain verification',
    compliance: ['HITRUST', 'SOC2', 'HIPAA'],
    features: [
      'Append-only storage',
      'Hash chain verification',
      'Tamper-evident logging',
      'Cryptographic signatures',
      'Chain integrity validation',
      'Export capabilities (JSON/CSV)'
    ],
    endpoints: {
      'GET /metadata': 'Service information',
      'GET /statistics': 'Audit log statistics and chain integrity',
      'GET /entries': 'Query audit log entries with filters',
      'GET /entries/:id': 'Get specific audit entry by ID',
      'GET /entries/:id/proof': 'Get chain proof for specific entry',
      'POST /validate-chain': 'Validate entire audit chain integrity',
      'POST /export': 'Export audit log in JSON or CSV format'
    }
  });
});

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const statistics = wormAuditLogService.getStatistics();
    res.json({
      success: true,
      statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error getting statistics:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit statistics' });
  }
});

router.get('/entries', (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      eventTypes,
      userId,
      patientId,
      limit,
      offset
    } = req.query;

    const entries = wormAuditLogService.getEntries({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      eventTypes: eventTypes ? (eventTypes as string).split(',') : undefined,
      userId: userId as string | undefined,
      patientId: patientId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0
    });

    res.json({
      success: true,
      count: entries.length,
      entries,
      filters: {
        startDate,
        endDate,
        eventTypes: eventTypes ? (eventTypes as string).split(',') : undefined,
        userId,
        patientId
      }
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error querying entries:', error);
    res.status(500).json({ success: false, error: 'Failed to query audit entries' });
  }
});

router.get('/entries/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entry = wormAuditLogService.getEntryById(id);

    if (!entry) {
      res.status(404).json({ success: false, error: 'Audit entry not found' });
      return;
    }

    res.json({
      success: true,
      entry
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error getting entry:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit entry' });
  }
});

router.get('/entries/:id/proof', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const proof = wormAuditLogService.getChainProof(id);

    if (!proof) {
      res.status(404).json({ success: false, error: 'Audit entry not found' });
      return;
    }

    res.json({
      success: true,
      proof,
      description: 'Cryptographic proof of entry position and integrity in the audit chain'
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error getting chain proof:', error);
    res.status(500).json({ success: false, error: 'Failed to get chain proof' });
  }
});

router.post('/validate-chain', (_req: Request, res: Response) => {
  try {
    const validation = wormAuditLogService.validateChain();

    wormAuditLogService.logSecurityEvent(
      'CHAIN_VALIDATION',
      'system',
      'VALIDATE_AUDIT_CHAIN',
      {
        result: validation.valid ? 'PASSED' : 'FAILED',
        totalEntries: validation.totalEntries,
        invalidEntries: validation.invalidEntries
      }
    );

    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString(),
      message: validation.valid 
        ? 'Audit chain integrity verified - no tampering detected'
        : 'WARNING: Audit chain integrity compromised - potential tampering detected'
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error validating chain:', error);
    res.status(500).json({ success: false, error: 'Failed to validate audit chain' });
  }
});

router.post('/export', (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      eventTypes,
      userId,
      patientId,
      format = 'json',
      includeChainValidation = true
    } = req.body;

    const result = wormAuditLogService.exportAuditLog({
      startDate,
      endDate,
      eventTypes,
      userId,
      patientId,
      format: format as 'json' | 'csv',
      includeChainValidation
    });

    wormAuditLogService.logSecurityEvent(
      'AUDIT_EXPORT',
      req.body.requestingUserId || 'system',
      'EXPORT_AUDIT_LOG',
      {
        format,
        filters: { startDate, endDate, eventTypes, userId, patientId },
        includeChainValidation
      },
      req.ip
    );

    res.json({
      success: true,
      filename: result.filename,
      data: result.data,
      chainValidation: result.chainValidation,
      exportedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error exporting audit log:', error);
    res.status(500).json({ success: false, error: 'Failed to export audit log' });
  }
});

router.post('/log-test', (req: Request, res: Response) => {
  try {
    const { eventType, action, userId, details } = req.body;

    const entry = wormAuditLogService.appendEntry({
      eventType: eventType || 'TEST_EVENT',
      action: action || 'TEST_ACTION',
      userId: userId || 'test-user',
      details: details || { testMode: true },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      entry,
      message: 'Test audit entry created successfully'
    });
  } catch (error) {
    console.error('[WORMAuditRoutes] Error creating test entry:', error);
    res.status(500).json({ success: false, error: 'Failed to create test entry' });
  }
});

export default router;
