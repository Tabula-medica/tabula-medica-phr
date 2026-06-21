import { Router, Request, Response } from 'express';
import { referentialMatchingService } from '../services/referential-matching-service';

const router = Router();

router.get('/metadata', (_req: Request, res: Response) => {
  res.json({
    service: 'Referential Matching Service',
    version: '1.0.0',
    description: 'Pluggable third-party identity verification with multiple provider support',
    compliance: ['HIPAA', 'WORM Audit Logging'],
    features: [
      'Multiple provider support (LexisNexis, Experian, Verity, Custom)',
      'Demographic matching with confidence scoring',
      'SSN and MRN verification',
      'Address verification',
      'Deceased status checking',
      'Provider failover and priority routing',
      'WORM audit trail integration'
    ],
    endpoints: {
      'GET /metadata': 'Service information',
      'GET /providers': 'List all registered providers',
      'GET /providers/:providerId': 'Get specific provider details',
      'POST /providers': 'Register new provider',
      'PATCH /providers/:providerId/status': 'Update provider active status',
      'PATCH /providers/:providerId/priority': 'Update provider priority',
      'POST /match': 'Perform referential match',
      'GET /statistics': 'Get provider statistics',
      'GET /history': 'Get match history'
    },
    disclaimer: 'This service integrates with third-party identity verification providers. API keys must be configured for production use. Sample mode uses simulated responses.'
  });
});

router.get('/providers', (_req: Request, res: Response) => {
  try {
    const providers = referentialMatchingService.getProviders();
    const activeProvider = referentialMatchingService.getActiveProvider();

    res.json({
      success: true,
      count: providers.length,
      activeProviderId: activeProvider?.providerId,
      providers
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error getting providers:', error);
    res.status(500).json({ success: false, error: 'Failed to get providers' });
  }
});

router.get('/providers/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const provider = referentialMatchingService.getProvider(providerId);

    if (!provider) {
      res.status(404).json({ success: false, error: 'Provider not found' });
      return;
    }

    const statistics = referentialMatchingService.getProviderStatistics(providerId);

    res.json({
      success: true,
      provider,
      statistics
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error getting provider:', error);
    res.status(500).json({ success: false, error: 'Failed to get provider' });
  }
});

router.post('/providers', (req: Request, res: Response) => {
  try {
    const provider = req.body;

    if (!provider.providerId || !provider.providerName || !provider.providerType) {
      res.status(400).json({ success: false, error: 'Missing required fields: providerId, providerName, providerType' });
      return;
    }

    referentialMatchingService.registerProvider(provider);

    res.json({
      success: true,
      provider,
      message: 'Provider registered successfully'
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error registering provider:', error);
    res.status(500).json({ success: false, error: 'Failed to register provider' });
  }
});

router.patch('/providers/:providerId/status', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, error: 'Missing or invalid isActive field' });
      return;
    }

    const updated = referentialMatchingService.updateProviderStatus(providerId, isActive);

    if (!updated) {
      res.status(404).json({ success: false, error: 'Provider not found' });
      return;
    }

    res.json({
      success: true,
      message: `Provider ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error updating provider status:', error);
    res.status(500).json({ success: false, error: 'Failed to update provider status' });
  }
});

router.patch('/providers/:providerId/priority', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const { priority } = req.body;

    if (typeof priority !== 'number') {
      res.status(400).json({ success: false, error: 'Missing or invalid priority field' });
      return;
    }

    const updated = referentialMatchingService.updateProviderPriority(providerId, priority);

    if (!updated) {
      res.status(404).json({ success: false, error: 'Provider not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Provider priority updated successfully'
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error updating provider priority:', error);
    res.status(500).json({ success: false, error: 'Failed to update provider priority' });
  }
});

router.post('/match', async (req: Request, res: Response) => {
  try {
    const { patientId, demographics, matchCriteria, preferredProvider, timeout } = req.body;

    if (!demographics || !demographics.firstName || !demographics.lastName || !demographics.dateOfBirth) {
      res.status(400).json({
        success: false,
        error: 'Missing required demographics: firstName, lastName, dateOfBirth'
      });
      return;
    }

    const response = await referentialMatchingService.performReferentialMatch({
      requestId: '',
      patientId,
      demographics,
      matchCriteria: matchCriteria || {},
      preferredProvider,
      timeout
    });

    res.json({
      success: true,
      ...response
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error performing match:', error);
    res.status(500).json({ success: false, error: 'Failed to perform referential match' });
  }
});

router.get('/statistics', (req: Request, res: Response) => {
  try {
    const { providerId } = req.query;
    const statistics = referentialMatchingService.getProviderStatistics(providerId as string);

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error getting statistics:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

router.get('/history', (req: Request, res: Response) => {
  try {
    const { patientId, providerId, status, limit } = req.query;

    const history = referentialMatchingService.getMatchHistory({
      patientId: patientId as string,
      providerId: providerId as string,
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('[ReferentialMatchingRoutes] Error getting history:', error);
    res.status(500).json({ success: false, error: 'Failed to get match history' });
  }
});

export default router;
