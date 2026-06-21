import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { aiFHIRAPIIntegrationService } from './services/ai-fhir-api-integration-service';
import { comprehensiveAuditTrailService } from './services/comprehensive-audit-trail-service';

const router = Router();

const discoverServerSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL')
});

const createMappingSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  sourceServerId: z.string(),
  targetServerId: z.string().default('local'),
  resourceType: z.string(),
  mappings: z.array(z.object({
    id: z.string(),
    sourcePath: z.string(),
    targetPath: z.string(),
    transform: z.string().optional(),
    defaultValue: z.string().optional(),
    required: z.boolean().default(false),
    description: z.string().optional()
  })).default([]),
  transformations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['terminology', 'format', 'structure', 'calculation', 'conditional']),
    sourcePath: z.string(),
    targetPath: z.string(),
    config: z.record(z.unknown()).default({}),
    description: z.string()
  })).default([]),
  validationRules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['required', 'format', 'range', 'reference', 'terminology', 'custom']),
    path: z.string(),
    config: z.record(z.unknown()).default({}),
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string()
  })).default([]),
  status: z.enum(['draft', 'active', 'testing']).default('draft')
});

const generateCodeSchema = z.object({
  language: z.enum(['typescript', 'javascript', 'python', 'json']).default('typescript')
});

const getSuggestionsSchema = z.object({
  sourceServerId: z.string(),
  targetServerId: z.string().default('local'),
  resourceType: z.string()
});

const testMappingSchema = z.object({
  sampleData: z.record(z.unknown())
});

function logAudit(action: string, details: Record<string, unknown>, result: string) {
  comprehensiveAuditTrailService.logAuditEntry('system', {
    who: {
      userId: 'system',
      userRole: 'system'
    },
    what: {
      category: 'integration',
      action: 'read',
      resourceType: 'FHIRAPIIntegration',
      resourceId: details.resourceId as string || 'N/A',
      description: action
    },
    why: {
      reason: 'FHIR API Integration operation',
      automatedAction: false
    },
    result: {
      success: result === 'success'
    },
    context: {
      environment: 'development'
    },
    severity: 'info',
    tags: ['fhir-api-integration', 'ai-powered'],
    metadata: details,
    phiAccessed: false,
    complianceFlags: ['HIPAA']
  });
}

router.get('/metadata', (_req: Request, res: Response) => {
  try {
    const metadata = aiFHIRAPIIntegrationService.getMetadata();
    logAudit('GET_METADATA', {}, 'success');
    res.json(metadata);
  } catch (error) {
    logAudit('GET_METADATA', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

router.get('/discoveries', (_req: Request, res: Response) => {
  try {
    const discoveries = aiFHIRAPIIntegrationService.getDiscoveries();
    logAudit('LIST_DISCOVERIES', { count: discoveries.length }, 'success');
    res.json(discoveries);
  } catch (error) {
    logAudit('LIST_DISCOVERIES', {}, 'failure');
    res.status(500).json({ error: 'Failed to get discoveries' });
  }
});

router.get('/discoveries/:id', (req: Request, res: Response) => {
  try {
    const discovery = aiFHIRAPIIntegrationService.getDiscovery(req.params.id);
    if (!discovery) {
      return res.status(404).json({ error: 'Discovery not found' });
    }
    logAudit('GET_DISCOVERY', { resourceId: req.params.id }, 'success');
    res.json(discovery);
  } catch (error) {
    logAudit('GET_DISCOVERY', { resourceId: req.params.id }, 'failure');
    res.status(500).json({ error: 'Failed to get discovery' });
  }
});

router.post('/discover', async (req: Request, res: Response) => {
  try {
    const validation = discoverServerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { baseUrl } = validation.data;
    logAudit('START_DISCOVERY', { baseUrl }, 'success');
    
    const discovery = await aiFHIRAPIIntegrationService.discoverFHIRServer(baseUrl);
    
    logAudit('COMPLETE_DISCOVERY', { 
      resourceId: discovery.id, 
      serverName: discovery.serverName,
      resourceCount: discovery.totalResources,
      status: discovery.status 
    }, discovery.status === 'error' ? 'failure' : 'success');
    
    res.json(discovery);
  } catch (error) {
    logAudit('DISCOVER_SERVER', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to discover FHIR server' });
  }
});

router.get('/mappings', (_req: Request, res: Response) => {
  try {
    const mappings = aiFHIRAPIIntegrationService.getMappings();
    logAudit('LIST_MAPPINGS', { count: mappings.length }, 'success');
    res.json(mappings);
  } catch (error) {
    logAudit('LIST_MAPPINGS', {}, 'failure');
    res.status(500).json({ error: 'Failed to get mappings' });
  }
});

router.get('/mappings/:id', (req: Request, res: Response) => {
  try {
    const mapping = aiFHIRAPIIntegrationService.getMapping(req.params.id);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    logAudit('GET_MAPPING', { resourceId: req.params.id }, 'success');
    res.json(mapping);
  } catch (error) {
    logAudit('GET_MAPPING', { resourceId: req.params.id }, 'failure');
    res.status(500).json({ error: 'Failed to get mapping' });
  }
});

router.post('/mappings', async (req: Request, res: Response) => {
  try {
    const validation = createMappingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const mapping = await aiFHIRAPIIntegrationService.createMapping(validation.data);
    logAudit('CREATE_MAPPING', { resourceId: mapping.id, name: mapping.name }, 'success');
    res.status(201).json(mapping);
  } catch (error) {
    logAudit('CREATE_MAPPING', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

router.patch('/mappings/:id', async (req: Request, res: Response) => {
  try {
    const mapping = await aiFHIRAPIIntegrationService.updateMapping(req.params.id, req.body);
    logAudit('UPDATE_MAPPING', { resourceId: req.params.id }, 'success');
    res.json(mapping);
  } catch (error) {
    logAudit('UPDATE_MAPPING', { resourceId: req.params.id, error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

router.delete('/mappings/:id', (req: Request, res: Response) => {
  try {
    const deleted = aiFHIRAPIIntegrationService.deleteMapping(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    logAudit('DELETE_MAPPING', { resourceId: req.params.id }, 'success');
    res.status(204).send();
  } catch (error) {
    logAudit('DELETE_MAPPING', { resourceId: req.params.id, error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const validation = getSuggestionsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { sourceServerId, targetServerId, resourceType } = validation.data;
    
    logAudit('GENERATE_SUGGESTIONS', { sourceServerId, targetServerId, resourceType }, 'success');
    
    const suggestions = await aiFHIRAPIIntegrationService.generateMappingSuggestions(
      sourceServerId,
      targetServerId,
      resourceType
    );
    
    res.json({
      suggestions,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These AI-generated suggestions are for DATA GOVERNANCE and OPERATIONAL purposes ONLY. They do NOT provide clinical decision support or medical advice.'
    });
  } catch (error) {
    logAudit('GENERATE_SUGGESTIONS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to generate suggestions', message: String(error) });
  }
});

router.post('/mappings/:id/generate-code', async (req: Request, res: Response) => {
  try {
    const validation = generateCodeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { language } = validation.data;
    
    logAudit('GENERATE_CODE', { resourceId: req.params.id, language }, 'success');
    
    const code = await aiFHIRAPIIntegrationService.generateIntegrationCode(req.params.id, language);
    
    res.json({
      ...code,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This generated code is for DATA GOVERNANCE and OPERATIONAL purposes ONLY. Review before production use.'
    });
  } catch (error) {
    logAudit('GENERATE_CODE', { resourceId: req.params.id, error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to generate code', message: String(error) });
  }
});

router.post('/mappings/:id/test', async (req: Request, res: Response) => {
  try {
    const validation = testMappingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const result = await aiFHIRAPIIntegrationService.testMapping(req.params.id, validation.data.sampleData);
    logAudit('TEST_MAPPING', { resourceId: req.params.id, status: result.status }, 'success');
    res.json(result);
  } catch (error) {
    logAudit('TEST_MAPPING', { resourceId: req.params.id, error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to test mapping', message: String(error) });
  }
});

router.get('/mappings/:id/test-history', (req: Request, res: Response) => {
  try {
    const history = aiFHIRAPIIntegrationService.getTestHistory(req.params.id);
    logAudit('GET_TEST_HISTORY', { mappingId: req.params.id }, 'success');
    res.json(history);
  } catch (error) {
    logAudit('GET_TEST_HISTORY', { mappingId: req.params.id, error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get test history' });
  }
});

const smartConfigSchema = z.object({
  serverId: z.string().optional(),
  baseUrl: z.string().url('Must be a valid URL').optional()
}).refine(data => data.serverId || data.baseUrl, { message: 'Either serverId or baseUrl is required' });

router.post('/smart-configuration', async (req: Request, res: Response) => {
  try {
    const validation = smartConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { serverId, baseUrl } = validation.data;
    
    let targetUrl = baseUrl;
    if (serverId && !baseUrl) {
      const discovery = aiFHIRAPIIntegrationService.getDiscovery(serverId);
      if (!discovery) {
        return res.status(404).json({ error: 'Server not found' });
      }
      targetUrl = discovery.baseUrl;
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'Could not determine server URL' });
    }
    
    logAudit('DISCOVER_SMART_CONFIG', { serverId, baseUrl: targetUrl }, 'success');
    
    const config = await aiFHIRAPIIntegrationService.discoverSmartConfiguration(targetUrl);
    
    res.json({
      serverId: serverId || 'unknown',
      smartConfiguration: config,
      capabilities: config.capabilities || [],
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This configuration is for DATA GOVERNANCE and OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('DISCOVER_SMART_CONFIG', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to discover SMART configuration' });
  }
});

const validationRulesSchema = z.object({
  resourceType: z.string(),
  strictness: z.enum(['lenient', 'standard', 'strict']).default('standard')
});

router.post('/validation-rules', async (req: Request, res: Response) => {
  try {
    const validation = validationRulesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { resourceType, strictness } = validation.data;
    logAudit('GENERATE_VALIDATION_RULES', { resourceType, strictness }, 'success');
    
    const rules = await aiFHIRAPIIntegrationService.generateValidationRules(resourceType, strictness);
    
    res.json({
      resourceType,
      strictness,
      rules,
      totalRules: rules.length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These validation rules are for DATA QUALITY purposes ONLY, not for clinical decision-making.'
    });
  } catch (error) {
    logAudit('GENERATE_VALIDATION_RULES', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to generate validation rules' });
  }
});

const transformationRulesSchema = z.object({
  resourceType: z.string(),
  targetFormat: z.enum(['local', 'hl7v2', 'cda', 'custom']).default('local')
});

router.post('/transformation-rules', async (req: Request, res: Response) => {
  try {
    const validation = transformationRulesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { resourceType, targetFormat } = validation.data;
    logAudit('GENERATE_TRANSFORMATION_RULES', { resourceType, targetFormat }, 'success');
    
    const transformations = await aiFHIRAPIIntegrationService.generateTransformationRules(resourceType, targetFormat);
    
    res.json({
      resourceType,
      targetFormat,
      rules: transformations,
      totalRules: transformations.length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These transformation rules are for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('GENERATE_TRANSFORMATION_RULES', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to generate transformation rules' });
  }
});

const compatibilitySchema = z.object({
  serverId1: z.string(),
  serverId2: z.string()
});

router.post('/compatibility', async (req: Request, res: Response) => {
  try {
    const validation = compatibilitySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { serverId1, serverId2 } = validation.data;
    logAudit('ANALYZE_COMPATIBILITY', { serverId1, serverId2 }, 'success');
    
    const analysis = await aiFHIRAPIIntegrationService.analyzeServerCompatibility(serverId1, serverId2);
    
    res.json({
      ...analysis,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This compatibility analysis is for INTEROPERABILITY PLANNING purposes ONLY.'
    });
  } catch (error) {
    logAudit('ANALYZE_COMPATIBILITY', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to analyze server compatibility', message: String(error) });
  }
});

router.get('/health/dashboard', (_req: Request, res: Response) => {
  try {
    logAudit('GET_HEALTH_DASHBOARD', {}, 'success');
    const dashboard = aiFHIRAPIIntegrationService.getHealthDashboard();
    res.json({
      ...dashboard,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This health monitoring dashboard is for OPERATIONAL purposes ONLY. Not for clinical decision support.'
    });
  } catch (error) {
    logAudit('GET_HEALTH_DASHBOARD', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get health dashboard' });
  }
});

router.get('/health/statuses', (_req: Request, res: Response) => {
  try {
    logAudit('GET_HEALTH_STATUSES', {}, 'success');
    const statuses = aiFHIRAPIIntegrationService.getAllHealthStatuses();
    res.json({
      items: statuses,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This health monitoring data is for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('GET_HEALTH_STATUSES', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get health statuses' });
  }
});

const integrationIdSchema = z.object({
  integrationId: z.string().min(1)
});

router.get('/health/:integrationId', (req: Request, res: Response) => {
  try {
    const validation = integrationIdSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const health = aiFHIRAPIIntegrationService.getHealthStatus(validation.data.integrationId);
    if (!health) {
      return res.status(404).json({ error: 'Health status not found for integration' });
    }

    logAudit('GET_HEALTH_STATUS', { integrationId: validation.data.integrationId }, 'success');
    res.json({
      ...health,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This health monitoring data is for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('GET_HEALTH_STATUS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

router.post('/health/:integrationId/check', async (req: Request, res: Response) => {
  try {
    const validation = integrationIdSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    logAudit('RUN_HEALTH_CHECK', { integrationId: validation.data.integrationId }, 'success');
    const health = await aiFHIRAPIIntegrationService.checkIntegrationHealth(validation.data.integrationId);
    
    res.json({
      ...health,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This health check result is for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('RUN_HEALTH_CHECK', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to run health check', message: String(error) });
  }
});

router.post('/health/check-all', async (_req: Request, res: Response) => {
  try {
    logAudit('RUN_ALL_HEALTH_CHECKS', {}, 'success');
    const results = await aiFHIRAPIIntegrationService.runHealthCheckAll();
    
    res.json({
      items: results,
      totalChecked: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These health check results are for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('RUN_ALL_HEALTH_CHECKS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to run health checks' });
  }
});

const metricsQuerySchema = z.object({
  hours: z.string().optional().transform(val => val ? parseInt(val, 10) : 24)
});

router.get('/health/:integrationId/metrics', (req: Request, res: Response) => {
  try {
    const paramsValidation = integrationIdSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: paramsValidation.error.errors });
    }

    const queryValidation = metricsQuerySchema.safeParse(req.query);
    const hours = queryValidation.success ? queryValidation.data.hours : 24;

    const metrics = aiFHIRAPIIntegrationService.getIntegrationMetrics(paramsValidation.data.integrationId, hours);
    logAudit('GET_INTEGRATION_METRICS', { integrationId: paramsValidation.data.integrationId, hours }, 'success');
    
    res.json({
      items: metrics,
      integrationId: paramsValidation.data.integrationId,
      periodHours: hours,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These metrics are for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('GET_INTEGRATION_METRICS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

const includeResolvedSchema = z.object({
  includeResolved: z.string().optional().transform(val => val === 'true')
});

router.get('/alerts', (req: Request, res: Response) => {
  try {
    const queryValidation = includeResolvedSchema.safeParse(req.query);
    const includeResolved = queryValidation.success ? queryValidation.data.includeResolved : false;

    const alerts = aiFHIRAPIIntegrationService.getAllAlerts(includeResolved);
    logAudit('GET_ALERTS', { includeResolved, count: alerts.length }, 'success');
    
    res.json({
      items: alerts,
      activeCount: alerts.filter(a => !a.resolvedAt).length,
      resolvedCount: alerts.filter(a => a.resolvedAt).length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These alerts are for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('GET_ALERTS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

const alertIdSchema = z.object({
  alertId: z.string().min(1)
});

router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  try {
    const validation = alertIdSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const alert = aiFHIRAPIIntegrationService.acknowledgeAlert(validation.data.alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    logAudit('ACKNOWLEDGE_ALERT', { alertId: validation.data.alertId }, 'success');
    res.json({
      alert,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This alert acknowledgment is for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('ACKNOWLEDGE_ALERT', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

router.post('/alerts/:alertId/resolve', (req: Request, res: Response) => {
  try {
    const validation = alertIdSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const alert = aiFHIRAPIIntegrationService.resolveAlert(validation.data.alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    logAudit('RESOLVE_ALERT', { alertId: validation.data.alertId }, 'success');
    res.json({
      alert,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This alert resolution is for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('RESOLVE_ALERT', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

router.get('/analytics/performance', (req: Request, res: Response) => {
  try {
    const integrationId = req.query.integrationId as string | undefined;
    
    logAudit('GET_PERFORMANCE_ANALYTICS', { integrationId: integrationId || 'all' }, 'success');
    const analytics = aiFHIRAPIIntegrationService.getPerformanceAnalytics(integrationId);
    
    res.json({
      ...analytics,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This performance analytics data is for OPERATIONAL purposes ONLY. Not for clinical decision support.'
    });
  } catch (error) {
    logAudit('GET_PERFORMANCE_ANALYTICS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get performance analytics' });
  }
});

const createConnectorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  connectorType: z.enum(['fhir_r4', 'fhir_r5', 'hl7v2', 'cda', 'custom']),
  sourceServerId: z.string().optional(),
  targetSystem: z.string().min(1),
  authConfig: z.object({
    authType: z.enum(['none', 'basic', 'oauth2', 'smart_on_fhir']),
    tokenEndpoint: z.string().optional(),
    scopes: z.array(z.string()).optional()
  }).optional(),
  syncConfig: z.object({
    syncMode: z.enum(['real_time', 'batch', 'on_demand']),
    batchSize: z.number().optional(),
    syncInterval: z.number().optional()
  }).optional()
});

const generateMappingsSchema = z.object({
  sourceServerId: z.string().min(1),
  targetSystem: z.string().min(1),
  resourceType: z.string().min(1)
});

const connectorIdSchema = z.object({
  connectorId: z.string().min(1)
});

const updateMappingSchema = z.object({
  validationStatus: z.enum(['pending', 'validated', 'rejected']).optional(),
  notes: z.string().optional()
});

router.get('/connectors/dashboard', (_req: Request, res: Response) => {
  try {
    logAudit('GET_CONNECTOR_DASHBOARD', {}, 'success');
    const dashboard = aiFHIRAPIIntegrationService.getConnectorDashboard();
    res.json({
      ...dashboard,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Dashboard metrics are for DATA GOVERNANCE and OPERATIONAL monitoring ONLY. Not for clinical decision-making.'
    });
  } catch (error) {
    logAudit('GET_CONNECTOR_DASHBOARD', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get connector dashboard' });
  }
});

router.get('/connectors', (_req: Request, res: Response) => {
  try {
    logAudit('LIST_CONNECTORS', {}, 'success');
    const connectors = aiFHIRAPIIntegrationService.getConnectors();
    res.json({
      items: connectors,
      total: connectors.length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These connectors are for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('LIST_CONNECTORS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get connectors' });
  }
});

router.get('/connectors/:connectorId', (req: Request, res: Response) => {
  try {
    const validation = connectorIdSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const connector = aiFHIRAPIIntegrationService.getConnector(validation.data.connectorId);
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    logAudit('GET_CONNECTOR', { connectorId: validation.data.connectorId }, 'success');
    res.json({
      ...connector,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This connector is for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('GET_CONNECTOR', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get connector' });
  }
});

router.post('/connectors', async (req: Request, res: Response) => {
  try {
    const validation = createConnectorSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    logAudit('CREATE_CONNECTOR', { name: validation.data.name }, 'success');
    const connector = await aiFHIRAPIIntegrationService.createConnector(validation.data);
    
    res.status(201).json({
      ...connector,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: This connector is for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('CREATE_CONNECTOR', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to create connector', message: String(error) });
  }
});

router.post('/connectors/:connectorId/auto-configure', async (req: Request, res: Response) => {
  try {
    const validation = connectorIdSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    logAudit('AUTO_CONFIGURE_CONNECTOR', { connectorId: validation.data.connectorId }, 'success');
    const connector = await aiFHIRAPIIntegrationService.autoConfigureConnector(validation.data.connectorId);
    
    res.json({
      ...connector,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Auto-configured settings must be reviewed before production use.'
    });
  } catch (error) {
    logAudit('AUTO_CONFIGURE_CONNECTOR', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to auto-configure connector', message: String(error) });
  }
});

router.patch('/connectors/:connectorId/status', (req: Request, res: Response) => {
  try {
    const paramsValidation = connectorIdSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: paramsValidation.error.errors });
    }

    const statusSchema = z.object({ status: z.enum(['draft', 'configured', 'testing', 'active', 'disabled']) });
    const bodyValidation = statusSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: bodyValidation.error.errors });
    }

    const connector = aiFHIRAPIIntegrationService.updateConnectorStatus(
      paramsValidation.data.connectorId,
      bodyValidation.data.status
    );
    
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    logAudit('UPDATE_CONNECTOR_STATUS', { connectorId: paramsValidation.data.connectorId, status: bodyValidation.data.status }, 'success');
    res.json({
      ...connector,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Status changes are for OPERATIONAL purposes ONLY.'
    });
  } catch (error) {
    logAudit('UPDATE_CONNECTOR_STATUS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to update connector status' });
  }
});

router.post('/connectors/:connectorId/generate-code', async (req: Request, res: Response) => {
  try {
    const paramsValidation = connectorIdSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: paramsValidation.error.errors });
    }

    const languageSchema = z.object({ language: z.enum(['typescript', 'javascript', 'python']).default('typescript') });
    const bodyValidation = languageSchema.safeParse(req.body);
    const language = bodyValidation.success ? bodyValidation.data.language : 'typescript';

    logAudit('GENERATE_CONNECTOR_CODE', { connectorId: paramsValidation.data.connectorId, language }, 'success');
    const code = await aiFHIRAPIIntegrationService.generateConnectorCode(
      paramsValidation.data.connectorId,
      language
    );
    
    res.json(code);
  } catch (error) {
    logAudit('GENERATE_CONNECTOR_CODE', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to generate connector code', message: String(error) });
  }
});

router.post('/cross-system-mappings/generate', async (req: Request, res: Response) => {
  try {
    const validation = generateMappingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const { sourceServerId, targetSystem, resourceType } = validation.data;
    logAudit('GENERATE_CROSS_SYSTEM_MAPPINGS', { sourceServerId, targetSystem, resourceType }, 'success');
    
    const mappings = await aiFHIRAPIIntegrationService.generateCrossSystemMappings(
      sourceServerId,
      targetSystem,
      resourceType
    );
    
    res.json({
      items: mappings,
      total: mappings.length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: AI-generated mappings must be reviewed and validated before production use.'
    });
  } catch (error) {
    logAudit('GENERATE_CROSS_SYSTEM_MAPPINGS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to generate cross-system mappings', message: String(error) });
  }
});

router.get('/cross-system-mappings', (req: Request, res: Response) => {
  try {
    const connectorId = req.query.connectorId as string | undefined;
    logAudit('LIST_CROSS_SYSTEM_MAPPINGS', { connectorId: connectorId || 'all' }, 'success');
    
    const mappings = aiFHIRAPIIntegrationService.getCrossSystemMappings(connectorId);
    
    res.json({
      items: mappings,
      total: mappings.length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: These mappings are for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('LIST_CROSS_SYSTEM_MAPPINGS', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get cross-system mappings' });
  }
});

router.patch('/cross-system-mappings/:mappingId', (req: Request, res: Response) => {
  try {
    const mappingIdValidation = z.object({ mappingId: z.string().min(1) }).safeParse(req.params);
    if (!mappingIdValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: mappingIdValidation.error.errors });
    }

    const bodyValidation = updateMappingSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: bodyValidation.error.errors });
    }

    const mapping = aiFHIRAPIIntegrationService.updateCrossSystemMapping(
      mappingIdValidation.data.mappingId,
      bodyValidation.data
    );
    
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    logAudit('UPDATE_CROSS_SYSTEM_MAPPING', { mappingId: mappingIdValidation.data.mappingId }, 'success');
    res.json({
      ...mapping,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Mapping updates are for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('UPDATE_CROSS_SYSTEM_MAPPING', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to update cross-system mapping' });
  }
});

router.post('/cross-system-mappings/:mappingId/validate', (req: Request, res: Response) => {
  try {
    const mappingIdValidation = z.object({ mappingId: z.string().min(1) }).safeParse(req.params);
    if (!mappingIdValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: mappingIdValidation.error.errors });
    }

    const statusSchema = z.object({ status: z.enum(['validated', 'rejected']) });
    const bodyValidation = statusSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: bodyValidation.error.errors });
    }

    const mapping = aiFHIRAPIIntegrationService.validateCrossSystemMapping(
      mappingIdValidation.data.mappingId,
      bodyValidation.data.status
    );
    
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    logAudit('VALIDATE_CROSS_SYSTEM_MAPPING', { mappingId: mappingIdValidation.data.mappingId, status: bodyValidation.data.status }, 'success');
    res.json({
      ...mapping,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Mapping validation is for DATA QUALITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('VALIDATE_CROSS_SYSTEM_MAPPING', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to validate cross-system mapping' });
  }
});

router.get('/schema-analyses', (_req: Request, res: Response) => {
  try {
    logAudit('LIST_SCHEMA_ANALYSES', {}, 'success');
    const analyses = aiFHIRAPIIntegrationService.getSchemaAnalyses();
    
    res.json({
      items: analyses,
      total: analyses.length,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Schema analyses are for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('LIST_SCHEMA_ANALYSES', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to get schema analyses' });
  }
});

router.post('/schema-analyses/:serverId', async (req: Request, res: Response) => {
  try {
    const serverIdValidation = z.object({ serverId: z.string().min(1) }).safeParse(req.params);
    if (!serverIdValidation.success) {
      return res.status(400).json({ error: 'Validation failed', details: serverIdValidation.error.errors });
    }

    logAudit('ANALYZE_SCHEMA', { serverId: serverIdValidation.data.serverId }, 'success');
    const analysis = await aiFHIRAPIIntegrationService.analyzeSchema(serverIdValidation.data.serverId);
    
    res.json({
      ...analysis,
      noCdsCompliance: 'CRITICAL COMPLIANCE NOTICE: Schema analysis is for DATA INTEROPERABILITY purposes ONLY.'
    });
  } catch (error) {
    logAudit('ANALYZE_SCHEMA', { error: String(error) }, 'failure');
    res.status(500).json({ error: 'Failed to analyze schema', message: String(error) });
  }
});

export function registerAIFHIRAPIIntegrationRoutes(app: Router) {
  app.use('/api/fhir-api-integration', router);
  console.log('[Routes] AI FHIR API Integration routes registered at /api/fhir-api-integration/*');
}

export default router;
