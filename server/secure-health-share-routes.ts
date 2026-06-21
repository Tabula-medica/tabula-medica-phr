import { Router, Request, Response } from 'express';
import { secureHealthShareService, CreateShareRequest } from './services/secure-health-share-service';
import { logPhiAccess } from './security/hipaa-audit';
import { logger } from './lib/logger';
import { isAuthenticated } from './replit_integrations/auth';

const router = Router();

logger.info({ component: 'SecureHealthShare' }, 'routes module loaded');

const PUBLIC_PATH_PREFIXES = ['/access/', '/validate/', '/sections'];

router.use((req, res, next) => {
  const isPublic = PUBLIC_PATH_PREFIXES.some(prefix => req.path.startsWith(prefix));
  if (isPublic) return next();
  return (isAuthenticated as any)(req, res, next);
});

router.get('/sections', async (req: Request, res: Response) => {
  try {
    const sections = secureHealthShareService.getShareableSections();
    res.json(sections);
  } catch (error) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error fetching sections');
    res.status(500).json({ error: 'Failed to fetch shareable sections' });
  }
});

router.get('/patient/:patientId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub as string;
    const { patientId } = req.params;

    if (userId !== patientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    logPhiAccess({
      action: 'read',
      userId,
      patientId,
      resourceType: 'HealthDataShare',
      details: 'LIST_HEALTH_SHARES: Retrieved list of health data shares',
    });

    logger.info({ component: 'SecureHealthShare', audit: 'HIPAA', action: 'list_shares', userId, patientId }, 'user accessed patient shares');

    const shares = await secureHealthShareService.getPatientShares(patientId);

    const sanitizedShares = shares.map(share => ({
      ...share,
      token: undefined,
      pinHash: undefined,
    }));

    res.json(sanitizedShares);
  } catch (error) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error fetching patient shares');
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
});

router.post('/create', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub as string;
    const request: CreateShareRequest = {
      ...req.body,
      patientId: userId,
    };

    if (!request.recipientName || !request.sections || !request.expiresInHours) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['provider', 'family', 'caregiver', 'other'].includes(request.recipientType)) {
      return res.status(400).json({ error: 'Invalid recipient type' });
    }

    if (request.requiresPin && (!request.pin || request.pin.length < 4)) {
      return res.status(400).json({ error: 'PIN required when PIN protection is enabled (minimum 4 digits)' });
    }

    logPhiAccess({
      action: 'write',
      userId,
      patientId: userId,
      resourceType: 'HealthDataShare',
      details: `CREATE_SHARE_REQUEST: Initiating share creation for ${request.recipientName}`,
    });

    const result = await secureHealthShareService.createShare(request, userId);

    res.json({
      success: true,
      share: {
        ...result.share,
        token: undefined,
        pinHash: undefined,
      },
      shareUrl: result.shareUrl,
    });
  } catch (error: any) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error creating share');
    res.status(400).json({ error: error.message || 'Failed to create share' });
  }
});

router.post('/revoke/:shareId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.claims?.sub as string;

    const share = await secureHealthShareService.revokeShare(shareId, userId, reason, userId);

    res.json({
      success: true,
      share: {
        ...share,
        token: undefined,
        pinHash: undefined,
      },
    });
  } catch (error: any) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error revoking share');
    res.status(400).json({ error: error.message || 'Failed to revoke share' });
  }
});

router.get('/access-log/:shareId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const userId = (req as any).user?.claims?.sub as string;

    logPhiAccess({
      action: 'read',
      userId,
      patientId: userId,
      resourceType: 'HealthDataShare',
      details: `VIEW_SHARE_ACCESS_LOG: Viewed access log for share ${shareId}`,
    });

    const accessLog = await secureHealthShareService.getShareAccessLog(shareId, userId);

    res.json(accessLog);
  } catch (error: any) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error fetching access log');
    res.status(400).json({ error: error.message || 'Failed to fetch access log' });
  }
});

router.post('/access/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { pin } = req.body;

    const accessorInfo = {
      ip: req.ip || req.headers['x-forwarded-for']?.toString(),
      userAgent: req.headers['user-agent'],
    };

    const sharedData = await secureHealthShareService.accessSharedData(token, pin, accessorInfo);

    res.json(sharedData);
  } catch (error: any) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error accessing shared data');
    
    if (error.message === 'PIN_REQUIRED') {
      return res.status(401).json({ error: 'PIN_REQUIRED', message: 'This share requires a PIN to access' });
    }

    if (typeof error.message === 'string' && error.message.startsWith('PIN_LOCKED:')) {
      const secsRemaining = parseInt(error.message.split(':')[1], 10);
      return res.status(429).json({
        error: 'PIN_LOCKED',
        message: 'Too many incorrect PIN attempts. Access is temporarily locked.',
        retryAfterSeconds: secsRemaining,
      });
    }

    if (typeof error.message === 'string' && error.message.startsWith('INVALID_PIN:')) {
      const attemptsLeft = parseInt(error.message.split(':')[1], 10);
      return res.status(401).json({
        error: 'INVALID_PIN',
        message: 'Incorrect PIN.',
        attemptsRemaining: attemptsLeft,
      });
    }
    
    res.status(400).json({ error: error.message || 'Failed to access shared data' });
  }
});

router.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const share = await secureHealthShareService.getShareByToken(token);

    if (!share) {
      return res.json({ valid: false, reason: 'Share not found' });
    }

    if (share.status === 'revoked') {
      return res.json({ valid: false, reason: 'Share has been revoked' });
    }

    if (new Date(share.expiresAt) < new Date()) {
      return res.json({ valid: false, reason: 'Share has expired' });
    }

    if (share.maxAccesses && share.accessCount >= share.maxAccesses) {
      return res.json({ valid: false, reason: 'Maximum access limit reached' });
    }

    if (share.requiresPin) {
      return res.json({
        valid: true,
        requiresPin: true,
      });
    }

    res.json({
      valid: true,
      requiresPin: false,
    });
  } catch (error: any) {
    logger.error({ component: 'SecureHealthShare', err: error }, 'error validating token');
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

export default router;
