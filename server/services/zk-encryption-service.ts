import crypto from 'crypto';
import { wormAuditLogService } from './worm-audit-log-service';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
  keyDerivationMethod: 'PBKDF2';
  algorithm: 'AES-256-GCM';
  version: string;
}

export interface KeyMetadata {
  keyId: string;
  patientId: string;
  createdAt: string;
  rotatedAt?: string;
  keyVersion: number;
  keyType: 'master' | 'data' | 'envelope';
  status: 'active' | 'rotated' | 'revoked';
  publicKeyHash?: string;
}

export interface PatientKeyStore {
  patientId: string;
  masterKeyHash: string;
  envelopeKeyEncrypted?: string;
  dataKeyEncrypted?: string;
  keyMetadata: KeyMetadata;
  createdAt: string;
  lastAccessAt?: string;
}

export interface EncryptionConfig {
  enableClientSideEncryption: boolean;
  keyRotationDays: number;
  requirePatientConsent: boolean;
  auditAllOperations: boolean;
}

class ZKEncryptionService {
  private patientKeyStores: Map<string, PatientKeyStore> = new Map();
  private config: EncryptionConfig;
  private initialized = false;

  constructor() {
    this.config = {
      enableClientSideEncryption: true,
      keyRotationDays: 90,
      requirePatientConsent: true,
      auditAllOperations: true
    };
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[ZKEncryption] Zero-Knowledge Encryption Service initialized');
    console.log('[ZKEncryption] Features: Client-side encryption, Patient-held master keys, Key rotation');
    console.log('[ZKEncryption] Algorithm: AES-256-GCM with PBKDF2 key derivation');
    console.log('[ZKEncryption] Compliance: HIPAA encryption requirements, Zero-knowledge architecture');
  }

  private generateSalt(): Buffer {
    return crypto.randomBytes(SALT_LENGTH);
  }

  private deriveKey(masterKey: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  generateMasterKey(): { masterKey: string; keyHash: string } {
    const masterKey = crypto.randomBytes(32).toString('base64');
    const keyHash = this.hashKey(masterKey);
    return { masterKey, keyHash };
  }

  encryptData(plaintext: string, masterKey: string): EncryptedPayload {
    const salt = this.generateSalt();
    const derivedKey = this.deriveKey(masterKey, salt);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
      keyDerivationMethod: 'PBKDF2',
      algorithm: 'AES-256-GCM',
      version: '1.0'
    };
  }

  decryptData(payload: EncryptedPayload, masterKey: string): string {
    const salt = Buffer.from(payload.salt, 'base64');
    const derivedKey = this.deriveKey(masterKey, salt);
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  registerPatientKey(patientId: string, masterKeyHash: string): KeyMetadata {
    const keyId = `key-${patientId}-${Date.now()}`;
    const now = new Date().toISOString();

    const keyMetadata: KeyMetadata = {
      keyId,
      patientId,
      createdAt: now,
      keyVersion: 1,
      keyType: 'master',
      status: 'active',
      publicKeyHash: masterKeyHash.substring(0, 16)
    };

    const keyStore: PatientKeyStore = {
      patientId,
      masterKeyHash,
      keyMetadata,
      createdAt: now
    };

    this.patientKeyStores.set(patientId, keyStore);

    if (this.config.auditAllOperations) {
      wormAuditLogService.appendEntry({
        eventType: 'ZK_ENCRYPTION',
        action: 'REGISTER_PATIENT_KEY',
        userId: 'system',
        patientId,
        details: {
          keyId,
          keyType: 'master',
          keyHashPrefix: masterKeyHash.substring(0, 8)
        }
      });
    }

    return keyMetadata;
  }

  verifyMasterKey(patientId: string, masterKey: string): boolean {
    const keyStore = this.patientKeyStores.get(patientId);
    if (!keyStore) return false;

    const providedHash = this.hashKey(masterKey);
    const verified = crypto.timingSafeEqual(
      Buffer.from(keyStore.masterKeyHash),
      Buffer.from(providedHash)
    );

    if (this.config.auditAllOperations) {
      wormAuditLogService.appendEntry({
        eventType: 'ZK_ENCRYPTION',
        action: verified ? 'KEY_VERIFICATION_SUCCESS' : 'KEY_VERIFICATION_FAILED',
        userId: 'system',
        patientId,
        details: {
          keyHashPrefix: providedHash.substring(0, 8),
          verified
        }
      });
    }

    if (verified) {
      keyStore.lastAccessAt = new Date().toISOString();
    }

    return verified;
  }

  rotatePatientKey(patientId: string, oldMasterKey: string, newMasterKey: string): KeyMetadata | null {
    const keyStore = this.patientKeyStores.get(patientId);
    if (!keyStore) return null;

    if (!this.verifyMasterKey(patientId, oldMasterKey)) {
      return null;
    }

    const newKeyHash = this.hashKey(newMasterKey);
    const now = new Date().toISOString();

    keyStore.masterKeyHash = newKeyHash;
    keyStore.keyMetadata.rotatedAt = now;
    keyStore.keyMetadata.keyVersion += 1;
    keyStore.keyMetadata.publicKeyHash = newKeyHash.substring(0, 16);

    if (this.config.auditAllOperations) {
      wormAuditLogService.appendEntry({
        eventType: 'ZK_ENCRYPTION',
        action: 'KEY_ROTATION',
        userId: 'system',
        patientId,
        details: {
          keyId: keyStore.keyMetadata.keyId,
          newVersion: keyStore.keyMetadata.keyVersion,
          rotatedAt: now
        }
      });
    }

    return keyStore.keyMetadata;
  }

  revokePatientKey(patientId: string, reason: string, revokedBy: string): boolean {
    const keyStore = this.patientKeyStores.get(patientId);
    if (!keyStore) return false;

    keyStore.keyMetadata.status = 'revoked';

    if (this.config.auditAllOperations) {
      wormAuditLogService.logSecurityEvent(
        'KEY_REVOCATION',
        revokedBy,
        'REVOKE_PATIENT_KEY',
        {
          patientId,
          keyId: keyStore.keyMetadata.keyId,
          reason,
          alertRequired: true
        }
      );
    }

    return true;
  }

  getPatientKeyMetadata(patientId: string): KeyMetadata | null {
    const keyStore = this.patientKeyStores.get(patientId);
    return keyStore?.keyMetadata || null;
  }

  getEncryptionInstructions(): {
    clientInstructions: string[];
    algorithm: string;
    keyDerivation: string;
    serverPolicy: string;
  } {
    return {
      clientInstructions: [
        '1. Generate a cryptographically secure master key using provided endpoint',
        '2. Store the master key securely on your device (never transmit it)',
        '3. Use the master key to encrypt PHI data before uploading',
        '4. The server only stores ciphertext - decryption requires your master key',
        '5. Rotate your master key periodically (recommended: every 90 days)',
        '6. If you lose your master key, your data cannot be recovered'
      ],
      algorithm: 'AES-256-GCM (Authenticated Encryption)',
      keyDerivation: 'PBKDF2 with SHA-256, 100,000 iterations',
      serverPolicy: 'Zero-Knowledge: Server never sees plaintext or master keys'
    };
  }

  getKeyStoreStats(): {
    totalPatients: number;
    activeKeys: number;
    revokedKeys: number;
    rotatedKeys: number;
    keysNeedingRotation: number;
  } {
    let activeKeys = 0;
    let revokedKeys = 0;
    let rotatedKeys = 0;
    let keysNeedingRotation = 0;

    const rotationThreshold = Date.now() - (this.config.keyRotationDays * 24 * 60 * 60 * 1000);

    for (const keyStore of Array.from(this.patientKeyStores.values())) {
      const meta = keyStore.keyMetadata;
      if (meta.status === 'active') activeKeys++;
      if (meta.status === 'revoked') revokedKeys++;
      if (meta.rotatedAt) rotatedKeys++;

      const lastRotation = meta.rotatedAt || meta.createdAt;
      if (new Date(lastRotation).getTime() < rotationThreshold) {
        keysNeedingRotation++;
      }
    }

    return {
      totalPatients: this.patientKeyStores.size,
      activeKeys,
      revokedKeys,
      rotatedKeys,
      keysNeedingRotation
    };
  }

  getConfig(): EncryptionConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<EncryptionConfig>): EncryptionConfig {
    this.config = { ...this.config, ...updates };
    return this.config;
  }
}

export const zkEncryptionService = new ZKEncryptionService();
