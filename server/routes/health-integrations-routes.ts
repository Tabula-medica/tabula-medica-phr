/**
 * Health Integrations API Routes
 * 
 * Unified API for healthcare data integrations:
 * - FHIR EHR systems via Fasten Health
 * - Health data aggregators (1upHealth, Human API)
 * - Wearable devices (Apple Health, Fitbit, Oura, etc.)
 */

import { Router, Request, Response } from 'express';
import { unifiedFHIRIntegrationService } from '../services/unified-fhir-integration-service';
import { healthDataAggregatorService } from '../services/health-data-aggregator-service';
import { wearableSyncService } from '../services/wearable-sync-service';
import { unifiedHealthHubService } from '../services/unified-health-hub-service';

const router = Router();

// ============================================================
// Unified Health Hub Routes
// ============================================================

/**
 * GET /api/health-integrations/hub/dashboard
 * Get the unified health hub dashboard
 */
router.get('/hub/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboard = unifiedHealthHubService.getDashboard();
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('[HealthIntegrations] Hub dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get hub dashboard' });
  }
});

/**
 * GET /api/health-integrations/hub/patient/:patientId/dashboard
 * Get patient-specific dashboard from all connected sources
 */
router.get('/hub/patient/:patientId/dashboard', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const dashboard = await unifiedHealthHubService.getPatientDashboard(patientId);
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('[HealthIntegrations] Patient dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get patient dashboard' });
  }
});

/**
 * GET /api/health-integrations/hub/patient/:patientId/sources
 * Get all connected data sources for a patient
 */
router.get('/hub/patient/:patientId/sources', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const sources = unifiedHealthHubService.getPatientDataSources(patientId);
    res.json({
      success: true,
      count: sources.length,
      sources
    });
  } catch (error) {
    console.error('[HealthIntegrations] Data sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to get data sources' });
  }
});

/**
 * GET /api/health-integrations/hub/patient/:patientId/timeline
 * Get unified timeline of health events
 */
router.get('/hub/patient/:patientId/timeline', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { limit, types } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (types) options.types = (types as string).split(',');
    
    const events = unifiedHealthHubService.getTimelineEvents(patientId, options);
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('[HealthIntegrations] Timeline error:', error);
    res.status(500).json({ success: false, error: 'Failed to get timeline' });
  }
});

/**
 * GET /api/health-integrations/hub/patient/:patientId/medications
 * Get unified medications from all sources
 */
router.get('/hub/patient/:patientId/medications', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const medications = unifiedHealthHubService.getUnifiedMedications(patientId);
    res.json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    console.error('[HealthIntegrations] Medications error:', error);
    res.status(500).json({ success: false, error: 'Failed to get medications' });
  }
});

/**
 * GET /api/health-integrations/hub/patient/:patientId/labs
 * Get unified lab results from all sources
 */
router.get('/hub/patient/:patientId/labs', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { category, limit } = req.query;
    
    const options: any = {};
    if (category) options.category = category as string;
    if (limit) options.limit = parseInt(limit as string);
    
    const labs = unifiedHealthHubService.getUnifiedLabResults(patientId, options);
    res.json({
      success: true,
      count: labs.length,
      labs
    });
  } catch (error) {
    console.error('[HealthIntegrations] Labs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get lab results' });
  }
});

/**
 * GET /api/health-integrations/hub/patient/:patientId/vitals
 * Get unified vital signs from EHR and wearables
 */
router.get('/hub/patient/:patientId/vitals', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { limit } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    
    const vitals = unifiedHealthHubService.getUnifiedVitalSigns(patientId, options);
    res.json({
      success: true,
      count: vitals.length,
      vitals
    });
  } catch (error) {
    console.error('[HealthIntegrations] Vitals error:', error);
    res.status(500).json({ success: false, error: 'Failed to get vitals' });
  }
});

/**
 * POST /api/health-integrations/hub/patient/:patientId/sync
 * Sync all connected data sources
 */
router.post('/hub/patient/:patientId/sync', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const result = await unifiedHealthHubService.syncAllSources(patientId);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('[HealthIntegrations] Sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync sources' });
  }
});

/**
 * POST /api/health-integrations/hub/patient/:patientId/reconcile
 * Reconcile data from multiple sources
 */
router.post('/hub/patient/:patientId/reconcile', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const result = await unifiedHealthHubService.reconcilePatientData(patientId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[HealthIntegrations] Reconcile error:', error);
    res.status(500).json({ success: false, error: 'Failed to reconcile data' });
  }
});

// ============================================================
// FHIR EHR Integration Routes
// ============================================================

/**
 * GET /api/health-integrations/fhir/systems
 * Get available EHR systems for connection
 */
router.get('/fhir/systems', async (req: Request, res: Response) => {
  try {
    const systems = unifiedFHIRIntegrationService.getAvailableEHRSystems();
    res.json({
      success: true,
      count: systems.length,
      systems: systems.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        supportedResources: s.supportedResources,
        version: s.version
      }))
    });
  } catch (error) {
    console.error('[HealthIntegrations] EHR systems error:', error);
    res.status(500).json({ success: false, error: 'Failed to get EHR systems' });
  }
});

/**
 * POST /api/health-integrations/fhir/connect
 * Initiate SMART on FHIR connection to an EHR
 */
router.post('/fhir/connect', async (req: Request, res: Response) => {
  try {
    const { ehrSystemId, redirectUri, patientId } = req.body;
    
    if (!ehrSystemId || !redirectUri) {
      return res.status(400).json({ success: false, error: 'ehrSystemId and redirectUri are required' });
    }
    
    const result = unifiedFHIRIntegrationService.initiateAuthorization(ehrSystemId, redirectUri, patientId);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[HealthIntegrations] FHIR connect error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate connection' });
  }
});

/**
 * POST /api/health-integrations/fhir/callback
 * Complete SMART on FHIR authorization
 */
router.post('/fhir/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({ success: false, error: 'code and state are required' });
    }
    
    const result = await unifiedFHIRIntegrationService.completeAuthorization(code, state);
    res.json(result);
  } catch (error) {
    console.error('[HealthIntegrations] FHIR callback error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete authorization' });
  }
});

/**
 * GET /api/health-integrations/fhir/patient/:patientId/connections
 * Get EHR connections for a patient
 */
router.get('/fhir/patient/:patientId/connections', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const connections = unifiedFHIRIntegrationService.getPatientConnections(patientId);
    res.json({
      success: true,
      count: connections.length,
      connections
    });
  } catch (error) {
    console.error('[HealthIntegrations] FHIR connections error:', error);
    res.status(500).json({ success: false, error: 'Failed to get connections' });
  }
});

/**
 * POST /api/health-integrations/fhir/patient/:patientId/sync
 * Sync data from a connected EHR
 */
router.post('/fhir/patient/:patientId/sync', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { ehrSystemId } = req.body;
    
    if (!ehrSystemId) {
      return res.status(400).json({ success: false, error: 'ehrSystemId is required' });
    }
    
    const result = await unifiedFHIRIntegrationService.syncPatientData(patientId, ehrSystemId);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('[HealthIntegrations] FHIR sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync EHR data' });
  }
});

/**
 * GET /api/health-integrations/fhir/patient/:patientId/unified-record
 * Get unified health record from all connected EHRs
 */
router.get('/fhir/patient/:patientId/unified-record', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const record = await unifiedFHIRIntegrationService.getUnifiedHealthRecord(patientId);
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('[HealthIntegrations] Unified record error:', error);
    res.status(500).json({ success: false, error: 'Failed to get unified record' });
  }
});

/**
 * DELETE /api/health-integrations/fhir/patient/:patientId/disconnect/:ehrSystemId
 * Disconnect from an EHR
 */
router.delete('/fhir/patient/:patientId/disconnect/:ehrSystemId', async (req: Request, res: Response) => {
  try {
    const { patientId, ehrSystemId } = req.params;
    const success = unifiedFHIRIntegrationService.disconnectEHR(patientId, ehrSystemId);
    res.json({ success });
  } catch (error) {
    console.error('[HealthIntegrations] FHIR disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// ============================================================
// Health Data Aggregator Routes (1upHealth, Human API)
// ============================================================

/**
 * GET /api/health-integrations/aggregator/sources
 * Get available health data sources
 */
router.get('/aggregator/sources', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const sources = healthDataAggregatorService.getAvailableDataSources(type as any);
    res.json({
      success: true,
      count: sources.length,
      sources
    });
  } catch (error) {
    console.error('[HealthIntegrations] Aggregator sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to get data sources' });
  }
});

/**
 * GET /api/health-integrations/aggregator/sources/popular
 * Get popular data sources for quick connect
 */
router.get('/aggregator/sources/popular', async (req: Request, res: Response) => {
  try {
    const sources = healthDataAggregatorService.getPopularDataSources();
    res.json({
      success: true,
      count: sources.length,
      sources
    });
  } catch (error) {
    console.error('[HealthIntegrations] Popular sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to get popular sources' });
  }
});

/**
 * GET /api/health-integrations/aggregator/sources/search
 * Search for data sources by name
 */
router.get('/aggregator/sources/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }
    
    const sources = healthDataAggregatorService.searchDataSources(q as string);
    res.json({
      success: true,
      count: sources.length,
      sources
    });
  } catch (error) {
    console.error('[HealthIntegrations] Search sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to search sources' });
  }
});

/**
 * POST /api/health-integrations/aggregator/connect
 * Initiate connection to a health data source
 */
router.post('/aggregator/connect', async (req: Request, res: Response) => {
  try {
    const { patientId, dataSourceId, redirectUri } = req.body;
    
    if (!patientId || !dataSourceId || !redirectUri) {
      return res.status(400).json({ 
        success: false, 
        error: 'patientId, dataSourceId, and redirectUri are required' 
      });
    }
    
    const result = healthDataAggregatorService.initiateConnection(patientId, dataSourceId, redirectUri);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[HealthIntegrations] Aggregator connect error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate connection' });
  }
});

/**
 * POST /api/health-integrations/aggregator/callback
 * Complete aggregator connection
 */
router.post('/aggregator/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({ success: false, error: 'code and state are required' });
    }
    
    const result = await healthDataAggregatorService.completeConnection(code, state);
    res.json(result);
  } catch (error) {
    console.error('[HealthIntegrations] Aggregator callback error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete connection' });
  }
});

/**
 * GET /api/health-integrations/aggregator/patient/:patientId/connections
 * Get patient's aggregator connections
 */
router.get('/aggregator/patient/:patientId/connections', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const connections = healthDataAggregatorService.getPatientConnections(patientId);
    res.json({
      success: true,
      count: connections.length,
      connections
    });
  } catch (error) {
    console.error('[HealthIntegrations] Aggregator connections error:', error);
    res.status(500).json({ success: false, error: 'Failed to get connections' });
  }
});

/**
 * GET /api/health-integrations/aggregator/patient/:patientId/labs
 * Get aggregated lab results
 */
router.get('/aggregator/patient/:patientId/labs', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { category, limit } = req.query;
    
    const options: any = {};
    if (category) options.category = category as string;
    if (limit) options.limit = parseInt(limit as string);
    
    const labs = healthDataAggregatorService.getLabResults(patientId, options);
    res.json({
      success: true,
      count: labs.length,
      labs
    });
  } catch (error) {
    console.error('[HealthIntegrations] Labs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get lab results' });
  }
});

/**
 * GET /api/health-integrations/aggregator/patient/:patientId/medications
 * Get aggregated medications
 */
router.get('/aggregator/patient/:patientId/medications', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status, limit } = req.query;
    
    const options: any = {};
    if (status) options.status = status as any;
    if (limit) options.limit = parseInt(limit as string);
    
    const medications = healthDataAggregatorService.getMedications(patientId, options);
    res.json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    console.error('[HealthIntegrations] Medications error:', error);
    res.status(500).json({ success: false, error: 'Failed to get medications' });
  }
});

/**
 * GET /api/health-integrations/aggregator/patient/:patientId/claims
 * Get aggregated insurance claims
 */
router.get('/aggregator/patient/:patientId/claims', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type, limit } = req.query;
    
    const options: any = {};
    if (type) options.type = type as any;
    if (limit) options.limit = parseInt(limit as string);
    
    const claims = healthDataAggregatorService.getClaims(patientId, options);
    res.json({
      success: true,
      count: claims.length,
      claims
    });
  } catch (error) {
    console.error('[HealthIntegrations] Claims error:', error);
    res.status(500).json({ success: false, error: 'Failed to get claims' });
  }
});

/**
 * POST /api/health-integrations/aggregator/patient/:patientId/sync/:connectionId
 * Sync data from a connected source
 */
router.post('/aggregator/patient/:patientId/sync/:connectionId', async (req: Request, res: Response) => {
  try {
    const { patientId, connectionId } = req.params;
    const result = await healthDataAggregatorService.syncDataSource(patientId, connectionId);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('[HealthIntegrations] Aggregator sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync data' });
  }
});

/**
 * DELETE /api/health-integrations/aggregator/patient/:patientId/disconnect/:connectionId
 * Disconnect from a data source
 */
router.delete('/aggregator/patient/:patientId/disconnect/:connectionId', async (req: Request, res: Response) => {
  try {
    const { patientId, connectionId } = req.params;
    const success = healthDataAggregatorService.disconnectDataSource(patientId, connectionId);
    res.json({ success });
  } catch (error) {
    console.error('[HealthIntegrations] Aggregator disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// ============================================================
// Wearable Data Sync Routes (Terra, Apple Health, Fitbit, etc.)
// ============================================================

/**
 * GET /api/health-integrations/wearables/platforms
 * Get supported wearable platforms
 */
router.get('/wearables/platforms', async (req: Request, res: Response) => {
  try {
    const platforms = wearableSyncService.getSupportedPlatforms();
    res.json({
      success: true,
      count: platforms.length,
      platforms: platforms.map(p => ({
        id: p.id,
        name: p.displayName,
        supportedCategories: p.supportedCategories,
        requiresNativeApp: p.requiresNativeApp,
        supportsRealtime: p.supportsRealtime
      }))
    });
  } catch (error) {
    console.error('[HealthIntegrations] Wearable platforms error:', error);
    res.status(500).json({ success: false, error: 'Failed to get platforms' });
  }
});

/**
 * GET /api/health-integrations/wearables/platforms/by-category/:category
 * Get platforms by supported data category
 */
router.get('/wearables/platforms/by-category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const platforms = wearableSyncService.getPlatformsByCategory(category as any);
    res.json({
      success: true,
      count: platforms.length,
      platforms: platforms.map(p => ({
        id: p.id,
        name: p.displayName,
        supportedCategories: p.supportedCategories
      }))
    });
  } catch (error) {
    console.error('[HealthIntegrations] Platforms by category error:', error);
    res.status(500).json({ success: false, error: 'Failed to get platforms' });
  }
});

/**
 * POST /api/health-integrations/wearables/connect
 * Initiate wearable connection via Terra
 */
router.post('/wearables/connect', async (req: Request, res: Response) => {
  try {
    const { patientId, platform, redirectUri } = req.body;
    
    if (!patientId || !platform || !redirectUri) {
      return res.status(400).json({ 
        success: false, 
        error: 'patientId, platform, and redirectUri are required' 
      });
    }
    
    const result = await wearableSyncService.initiateConnection(patientId, platform, redirectUri);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[HealthIntegrations] Wearable connect error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate connection' });
  }
});

/**
 * POST /api/health-integrations/wearables/callback
 * Complete wearable connection
 */
router.post('/wearables/callback', async (req: Request, res: Response) => {
  try {
    const { patientId, platform, terraUserId } = req.body;
    
    if (!patientId || !platform || !terraUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'patientId, platform, and terraUserId are required' 
      });
    }
    
    const result = await wearableSyncService.completeConnection(patientId, platform, terraUserId);
    res.json(result);
  } catch (error) {
    console.error('[HealthIntegrations] Wearable callback error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete connection' });
  }
});

/**
 * GET /api/health-integrations/wearables/patient/:patientId/connections
 * Get patient's wearable connections
 */
router.get('/wearables/patient/:patientId/connections', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const connections = wearableSyncService.getPatientConnections(patientId);
    res.json({
      success: true,
      count: connections.length,
      connections
    });
  } catch (error) {
    console.error('[HealthIntegrations] Wearable connections error:', error);
    res.status(500).json({ success: false, error: 'Failed to get connections' });
  }
});

/**
 * GET /api/health-integrations/wearables/patient/:patientId/summary
 * Get wearable data summary
 */
router.get('/wearables/patient/:patientId/summary', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { period } = req.query;
    
    const summary = wearableSyncService.getWearableSummary(
      patientId, 
      (period as 'day' | 'week' | 'month') || 'week'
    );
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[HealthIntegrations] Wearable summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

/**
 * GET /api/health-integrations/wearables/patient/:patientId/activity
 * Get activity data
 */
router.get('/wearables/patient/:patientId/activity', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { limit } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    
    const activity = wearableSyncService.getActivityData(patientId, options);
    res.json({
      success: true,
      count: activity.length,
      data: activity
    });
  } catch (error) {
    console.error('[HealthIntegrations] Activity data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get activity data' });
  }
});

/**
 * GET /api/health-integrations/wearables/patient/:patientId/sleep
 * Get sleep data
 */
router.get('/wearables/patient/:patientId/sleep', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { limit } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    
    const sleep = wearableSyncService.getSleepData(patientId, options);
    res.json({
      success: true,
      count: sleep.length,
      data: sleep
    });
  } catch (error) {
    console.error('[HealthIntegrations] Sleep data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sleep data' });
  }
});

/**
 * GET /api/health-integrations/wearables/patient/:patientId/heart-rate
 * Get heart rate data
 */
router.get('/wearables/patient/:patientId/heart-rate', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { source, limit } = req.query;
    
    const options: any = {};
    if (source) options.source = source as any;
    if (limit) options.limit = parseInt(limit as string);
    
    const heartRate = wearableSyncService.getHeartRateData(patientId, options);
    res.json({
      success: true,
      count: heartRate.length,
      data: heartRate
    });
  } catch (error) {
    console.error('[HealthIntegrations] Heart rate data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get heart rate data' });
  }
});

/**
 * GET /api/health-integrations/wearables/patient/:patientId/workouts
 * Get workout data
 */
router.get('/wearables/patient/:patientId/workouts', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type, limit } = req.query;
    
    const options: any = {};
    if (type) options.workoutType = type as string;
    if (limit) options.limit = parseInt(limit as string);
    
    const workouts = wearableSyncService.getWorkoutData(patientId, options);
    res.json({
      success: true,
      count: workouts.length,
      data: workouts
    });
  } catch (error) {
    console.error('[HealthIntegrations] Workout data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get workout data' });
  }
});

/**
 * POST /api/health-integrations/wearables/patient/:patientId/sync/:connectionId
 * Sync wearable data
 */
router.post('/wearables/patient/:patientId/sync/:connectionId', async (req: Request, res: Response) => {
  try {
    const { patientId, connectionId } = req.params;
    const result = await wearableSyncService.syncWearableData(patientId, connectionId);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('[HealthIntegrations] Wearable sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync wearable data' });
  }
});

/**
 * DELETE /api/health-integrations/wearables/patient/:patientId/disconnect/:connectionId
 * Disconnect wearable
 */
router.delete('/wearables/patient/:patientId/disconnect/:connectionId', async (req: Request, res: Response) => {
  try {
    const { patientId, connectionId } = req.params;
    const success = wearableSyncService.disconnectWearable(patientId, connectionId);
    res.json({ success });
  } catch (error) {
    console.error('[HealthIntegrations] Wearable disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect wearable' });
  }
});

export default router;
