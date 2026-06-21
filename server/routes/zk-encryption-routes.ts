import { Router, Request, Response } from 'express';
import { zkEncryptionService } from '../services/zk-encryption-service';

const router = Router();

router.get('/metadata', (_req: Request, res: Response) => {
  res.json({
    service: 'Zero-Knowledge Encryption Service',
    version: '1.0.0',
    description: 'Client-side encryption with patient-held master keys',
    compliance: ['HIPAA', 'Zero-Knowledge Architecture'],
    features: [
      'Client-side AES-256-GCM encryption',
      'Patient-held master keys',
      'PBKDF2 key derivation',
      'Key rotation support',
      'Cryptographic key verification'
    ],
    endpoints: {
      'GET /metadata': 'Service information',
      'GET /instructions': 'Client encryption instructions',
      'GET /statistics': 'Key store statistics',
      'POST /generate-key': 'Generate new master key',
      'POST /register-key': 'Register patient key metadata',
      'POST /verify-key': 'Verify master key',
      'POST /rotate-key': 'Rotate patient master key',
      'POST /encrypt-sample': 'Sample encryption (for testing)',
      'POST /decrypt-sample': 'Sample decryption (for testing)',
      'GET /patient/:patientId/key-metadata': 'Get patient key metadata'
    },
    securityNote: 'Master keys are NEVER transmitted or stored on server. Only key hashes are stored for verification.'
  });
});

router.get('/instructions', (_req: Request, res: Response) => {
  const instructions = zkEncryptionService.getEncryptionInstructions();
  res.json({
    success: true,
    ...instructions
  });
});

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const stats = zkEncryptionService.getKeyStoreStats();
    res.json({
      success: true,
      statistics: stats,
      config: zkEncryptionService.getConfig()
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error getting statistics:', error);
    res.status(500).json({ success: false, error: 'Failed to get encryption statistics' });
  }
});

router.post('/generate-key', (_req: Request, res: Response) => {
  try {
    const { masterKey, keyHash } = zkEncryptionService.generateMasterKey();
    
    res.json({
      success: true,
      masterKey,
      keyHash,
      warning: 'IMPORTANT: Store this master key securely. It is the ONLY way to decrypt your data. Lost keys cannot be recovered.',
      instructions: [
        'Save this key in a secure password manager',
        'Consider creating a secure backup',
        'Never share this key with anyone',
        'The server never stores or sees this key'
      ]
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error generating key:', error);
    res.status(500).json({ success: false, error: 'Failed to generate master key' });
  }
});

router.post('/register-key', (req: Request, res: Response) => {
  try {
    const { patientId, masterKeyHash } = req.body;

    if (!patientId || !masterKeyHash) {
      res.status(400).json({ success: false, error: 'Missing patientId or masterKeyHash' });
      return;
    }

    const keyMetadata = zkEncryptionService.registerPatientKey(patientId, masterKeyHash);

    res.json({
      success: true,
      keyMetadata,
      message: 'Patient encryption key registered successfully'
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error registering key:', error);
    res.status(500).json({ success: false, error: 'Failed to register patient key' });
  }
});

router.post('/verify-key', (req: Request, res: Response) => {
  try {
    const { patientId, masterKey } = req.body;

    if (!patientId || !masterKey) {
      res.status(400).json({ success: false, error: 'Missing patientId or masterKey' });
      return;
    }

    const verified = zkEncryptionService.verifyMasterKey(patientId, masterKey);

    res.json({
      success: true,
      verified,
      message: verified ? 'Master key verified successfully' : 'Master key verification failed'
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error verifying key:', error);
    res.status(500).json({ success: false, error: 'Failed to verify master key' });
  }
});

router.post('/rotate-key', (req: Request, res: Response) => {
  try {
    const { patientId, oldMasterKey, newMasterKey } = req.body;

    if (!patientId || !oldMasterKey || !newMasterKey) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const keyMetadata = zkEncryptionService.rotatePatientKey(patientId, oldMasterKey, newMasterKey);

    if (!keyMetadata) {
      res.status(401).json({ success: false, error: 'Key rotation failed - invalid old master key' });
      return;
    }

    res.json({
      success: true,
      keyMetadata,
      message: 'Master key rotated successfully',
      warning: 'You must re-encrypt all data with the new key'
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error rotating key:', error);
    res.status(500).json({ success: false, error: 'Failed to rotate master key' });
  }
});

router.post('/encrypt-sample', (req: Request, res: Response) => {
  try {
    const { plaintext, masterKey } = req.body;

    if (!plaintext || !masterKey) {
      res.status(400).json({ success: false, error: 'Missing plaintext or masterKey' });
      return;
    }

    const encrypted = zkEncryptionService.encryptData(plaintext, masterKey);

    res.json({
      success: true,
      encrypted,
      note: 'This is a sample endpoint. In production, encryption happens client-side.'
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error encrypting:', error);
    res.status(500).json({ success: false, error: 'Failed to encrypt data' });
  }
});

router.post('/decrypt-sample', (req: Request, res: Response) => {
  try {
    const { encrypted, masterKey } = req.body;

    if (!encrypted || !masterKey) {
      res.status(400).json({ success: false, error: 'Missing encrypted payload or masterKey' });
      return;
    }

    const plaintext = zkEncryptionService.decryptData(encrypted, masterKey);

    res.json({
      success: true,
      plaintext,
      note: 'This is a sample endpoint. In production, decryption happens client-side.'
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error decrypting:', error);
    res.status(500).json({ success: false, error: 'Failed to decrypt data - invalid key or corrupted data' });
  }
});

router.get('/patient/:patientId/key-metadata', (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const keyMetadata = zkEncryptionService.getPatientKeyMetadata(patientId);

    if (!keyMetadata) {
      res.status(404).json({ success: false, error: 'Patient key not found' });
      return;
    }

    res.json({
      success: true,
      keyMetadata
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error getting key metadata:', error);
    res.status(500).json({ success: false, error: 'Failed to get patient key metadata' });
  }
});

router.post('/revoke-key', (req: Request, res: Response) => {
  try {
    const { patientId, reason, revokedBy } = req.body;

    if (!patientId || !reason || !revokedBy) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const revoked = zkEncryptionService.revokePatientKey(patientId, reason, revokedBy);

    if (!revoked) {
      res.status(404).json({ success: false, error: 'Patient key not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Patient key revoked successfully',
      warning: 'Data encrypted with this key can no longer be verified'
    });
  } catch (error) {
    console.error('[ZKEncryptionRoutes] Error revoking key:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke patient key' });
  }
});

export default router;
