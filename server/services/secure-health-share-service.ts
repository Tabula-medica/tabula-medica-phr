import crypto from 'crypto';
import { logPhiAccess } from '../security/hipaa-audit';

export interface ShareableDataSection {
  id: string;
  name: string;
  description: string;
  fhirResourceTypes: string[];
}

export const SHAREABLE_SECTIONS: ShareableDataSection[] = [
  { id: 'medications', name: 'Medications', description: 'Current and past medications', fhirResourceTypes: ['MedicationRequest', 'MedicationStatement'] },
  { id: 'conditions', name: 'Conditions', description: 'Diagnoses and health conditions', fhirResourceTypes: ['Condition'] },
  { id: 'labs', name: 'Lab Results', description: 'Recent laboratory test results', fhirResourceTypes: ['Observation', 'DiagnosticReport'] },
  { id: 'allergies', name: 'Allergies', description: 'Known allergies and reactions', fhirResourceTypes: ['AllergyIntolerance'] },
  { id: 'immunizations', name: 'Immunizations', description: 'Vaccination records', fhirResourceTypes: ['Immunization'] },
  { id: 'vitals', name: 'Vital Signs', description: 'Blood pressure, heart rate, weight, etc.', fhirResourceTypes: ['Observation'] },
  { id: 'encounters', name: 'Visits', description: 'Healthcare visits and encounters', fhirResourceTypes: ['Encounter'] },
  { id: 'procedures', name: 'Procedures', description: 'Medical procedures performed', fhirResourceTypes: ['Procedure'] },
  { id: 'documents', name: 'Documents', description: 'Clinical documents and notes', fhirResourceTypes: ['DocumentReference'] },
];

export interface HealthDataShare {
  id: string;
  patientId: string;
  token: string;
  recipientName: string;
  recipientEmail?: string;
  recipientType: 'provider' | 'family' | 'caregiver' | 'other';
  sections: string[];
  createdAt: string;
  expiresAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: string;
  revokedReason?: string;
  accessLog: ShareAccessLog[];
  maxAccesses?: number;
  requiresPin?: boolean;
  pinHash?: string;
  notes?: string;
}

export interface ShareAccessLog {
  id: string;
  timestamp: string;
  accessorIp?: string;
  accessorAgent?: string;
  sectionsAccessed: string[];
  success: boolean;
  failureReason?: string;
}

export interface CreateShareRequest {
  patientId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientType: 'provider' | 'family' | 'caregiver' | 'other';
  sections: string[];
  expiresInHours: number;
  maxAccesses?: number;
  requiresPin?: boolean;
  pin?: string;
  notes?: string;
}

export interface SharedHealthData {
  shareInfo: {
    recipientName: string;
    recipientType: string;
    expiresAt: string;
    sectionsGranted: string[];
  };
  patientInfo: {
    name: string;
    dateOfBirth?: string;
  };
  data: {
    sectionId: string;
    sectionName: string;
    resources: any[];
  }[];
  disclaimer: string;
}

const shares: Map<string, HealthDataShare> = new Map();

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface PinAttemptRecord {
  count: number;
  lockedUntil?: number;
}

const pinAttempts: Map<string, PinAttemptRecord> = new Map();

function checkPinLockout(token: string): void {
  const record = pinAttempts.get(token);
  if (!record) return;
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const secsRemaining = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    throw new Error(`PIN_LOCKED:${secsRemaining}`);
  }
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    pinAttempts.delete(token);
  }
}

function recordPinFailure(token: string): void {
  const record = pinAttempts.get(token) ?? { count: 0 };
  record.count += 1;
  if (record.count >= PIN_MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + PIN_LOCKOUT_MS;
  }
  pinAttempts.set(token, record);
}

function clearPinAttempts(token: string): void {
  pinAttempts.delete(token);
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function maskPatientId(patientId: string): string {
  return crypto.createHash('sha256').update(patientId).digest('hex').slice(0, 16);
}

export class SecureHealthShareService {
  constructor() {
    console.log('[SecureHealthShare] Service initialized with secure token generation and access control');
    if (process.env.ENABLE_HEALTH_SHARE_SAMPLE_DATA === 'true') {
      console.warn('[SecureHealthShare] WARNING: sample share seeding is ENABLED via ENABLE_HEALTH_SHARE_SAMPLE_DATA — do NOT set this in production');
      this.initializeSampleShares();
    }
  }

  private initializeSampleShares(): void {
    const sampleShare: HealthDataShare = {
      id: 'share-001',
      patientId: 'patient-001',
      token: 'sample-token-abc123',
      recipientName: 'Dr. Sarah Johnson',
      recipientEmail: 'dr.johnson@hospital.org',
      recipientType: 'provider',
      sections: ['medications', 'conditions', 'labs'],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      accessCount: 3,
      status: 'active',
      accessLog: [
        {
          id: 'log-001',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          sectionsAccessed: ['medications', 'conditions'],
          success: true,
        },
      ],
    };

    const expiredShare: HealthDataShare = {
      id: 'share-002',
      patientId: 'patient-001',
      token: 'expired-token-xyz789',
      recipientName: 'Jane Smith (Daughter)',
      recipientType: 'family',
      sections: ['medications', 'allergies'],
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      accessCount: 5,
      status: 'expired',
      accessLog: [],
    };

    shares.set(sampleShare.id, sampleShare);
    shares.set(expiredShare.id, expiredShare);
  }

  async createShare(request: CreateShareRequest, userId: string): Promise<{ share: HealthDataShare; shareUrl: string }> {
    const validSections = request.sections.filter(s => 
      SHAREABLE_SECTIONS.some(section => section.id === s)
    );

    if (validSections.length === 0) {
      throw new Error('At least one valid data section must be selected');
    }

    if (request.expiresInHours < 1 || request.expiresInHours > 720) {
      throw new Error('Expiration must be between 1 hour and 30 days');
    }

    const token = generateSecureToken();
    const shareId = `share-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const share: HealthDataShare = {
      id: shareId,
      patientId: request.patientId,
      token,
      recipientName: request.recipientName,
      recipientEmail: request.recipientEmail,
      recipientType: request.recipientType,
      sections: validSections,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + request.expiresInHours * 60 * 60 * 1000).toISOString(),
      accessCount: 0,
      status: 'active',
      accessLog: [],
      maxAccesses: request.maxAccesses,
      requiresPin: request.requiresPin,
      pinHash: request.pin ? hashPin(request.pin) : undefined,
      notes: request.notes,
    };

    shares.set(shareId, share);

    logPhiAccess({
      action: 'write',
      userId,
      patientId: maskPatientId(request.patientId),
      resourceType: 'HealthDataShare',
      details: `CREATE_HEALTH_SHARE: Created share for ${request.recipientType}: ${request.recipientName}, sections: ${validSections.join(', ')}, expires: ${share.expiresAt}`,
    });

    console.log(`[SecureHealthShare] Share created: ${shareId} for ${request.recipientType} ${request.recipientName}`);

    const shareUrl = `/shared-health-data/${token}`;

    return { share, shareUrl };
  }

  async revokeShare(shareId: string, patientId: string, reason?: string, userId?: string): Promise<HealthDataShare> {
    const share = shares.get(shareId);

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.patientId !== patientId) {
      throw new Error('Unauthorized to revoke this share');
    }

    if (share.status === 'revoked') {
      throw new Error('Share is already revoked');
    }

    share.status = 'revoked';
    share.revokedAt = new Date().toISOString();
    share.revokedReason = reason || 'Revoked by patient';

    shares.set(shareId, share);

    logPhiAccess({
      action: 'delete',
      userId: userId || 'system',
      patientId: maskPatientId(patientId),
      resourceType: 'HealthDataShare',
      details: `REVOKE_HEALTH_SHARE: Revoked share ${shareId} for ${share.recipientName}, reason: ${share.revokedReason}`,
    });

    console.log(`[SecureHealthShare] Share revoked: ${shareId}`);

    return share;
  }

  async getPatientShares(patientId: string): Promise<HealthDataShare[]> {
    const patientShares: HealthDataShare[] = [];

    for (const share of Array.from(shares.values())) {
      if (share.patientId === patientId) {
        if (share.status === 'active' && new Date(share.expiresAt) < new Date()) {
          share.status = 'expired';
          shares.set(share.id, share);
        }
        patientShares.push(share);
      }
    }

    return patientShares.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getShareByToken(token: string): Promise<HealthDataShare | null> {
    for (const share of Array.from(shares.values())) {
      if (share.token === token) {
        return share;
      }
    }
    return null;
  }

  async accessSharedData(
    token: string,
    pin?: string,
    accessorInfo?: { ip?: string; userAgent?: string }
  ): Promise<SharedHealthData> {
    const share = await this.getShareByToken(token);

    if (!share) {
      throw new Error('Share not found or invalid token');
    }

    if (share.status === 'revoked') {
      this.logFailedAccess(share, 'Share has been revoked', accessorInfo);
      throw new Error('This share has been revoked by the patient');
    }

    if (new Date(share.expiresAt) < new Date()) {
      share.status = 'expired';
      shares.set(share.id, share);
      this.logFailedAccess(share, 'Share has expired', accessorInfo);
      throw new Error('This share has expired');
    }

    if (share.maxAccesses && share.accessCount >= share.maxAccesses) {
      this.logFailedAccess(share, 'Maximum access limit reached', accessorInfo);
      throw new Error('Maximum access limit has been reached');
    }

    if (share.requiresPin && share.pinHash) {
      if (!pin) {
        throw new Error('PIN_REQUIRED');
      }
      checkPinLockout(token);
      if (hashPin(pin) !== share.pinHash) {
        recordPinFailure(token);
        this.logFailedAccess(share, 'Invalid PIN', accessorInfo);
        const record = pinAttempts.get(token);
        const attemptsLeft = record?.lockedUntil
          ? 0
          : PIN_MAX_ATTEMPTS - (record?.count ?? 0);
        if (attemptsLeft === 0) {
          const secsRemaining = Math.ceil(PIN_LOCKOUT_MS / 1000);
          throw new Error(`PIN_LOCKED:${secsRemaining}`);
        }
        throw new Error(`INVALID_PIN:${attemptsLeft}`);
      }
      clearPinAttempts(token);
    }

    share.accessCount++;
    share.lastAccessedAt = new Date().toISOString();
    
    const accessLog: ShareAccessLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      accessorIp: accessorInfo?.ip,
      accessorAgent: accessorInfo?.userAgent,
      sectionsAccessed: share.sections,
      success: true,
    };
    share.accessLog.push(accessLog);
    shares.set(share.id, share);

    logPhiAccess({
      action: 'read',
      userId: `external:${share.recipientName}`,
      patientId: maskPatientId(share.patientId),
      resourceType: 'HealthDataShare',
      details: `ACCESS_SHARED_DATA: Accessed shared data via token, sections: ${share.sections.join(', ')}`,
    });

    const healthData = await this.fetchSharedHealthData(share);

    return healthData;
  }

  private logFailedAccess(share: HealthDataShare, reason: string, accessorInfo?: { ip?: string; userAgent?: string }): void {
    const accessLog: ShareAccessLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      accessorIp: accessorInfo?.ip,
      accessorAgent: accessorInfo?.userAgent,
      sectionsAccessed: [],
      success: false,
      failureReason: reason,
    };
    share.accessLog.push(accessLog);
    shares.set(share.id, share);

    logPhiAccess({
      action: 'read',
      userId: 'external:unknown',
      patientId: maskPatientId(share.patientId),
      resourceType: 'HealthDataShare',
      details: `FAILED_SHARE_ACCESS: Failed access attempt: ${reason}`,
    });
  }

  private async fetchSharedHealthData(share: HealthDataShare): Promise<SharedHealthData> {
    const sectionData: { sectionId: string; sectionName: string; resources: any[] }[] = [];

    for (const sectionId of share.sections) {
      const section = SHAREABLE_SECTIONS.find(s => s.id === sectionId);
      if (!section) continue;

      const resources = this.getSampleDataForSection(sectionId, share.patientId);
      sectionData.push({
        sectionId,
        sectionName: section.name,
        resources,
      });
    }

    return {
      shareInfo: {
        recipientName: share.recipientName,
        recipientType: share.recipientType,
        expiresAt: share.expiresAt,
        sectionsGranted: share.sections,
      },
      patientInfo: {
        name: 'John Smith',
        dateOfBirth: '1965-03-15',
      },
      data: sectionData,
      disclaimer: 'IMPORTANT: This health information is shared by the patient for informational purposes only. This does NOT constitute a formal medical record transfer. Always verify information with the patient and their primary care provider. This information is NOT medical advice.',
    };
  }

  private getSampleDataForSection(sectionId: string, patientId: string): any[] {
    switch (sectionId) {
      case 'medications':
        return [
          { name: 'Lisinopril 10mg', dosage: 'Once daily', startDate: '2024-01-15', status: 'active', prescriber: 'Dr. Smith' },
          { name: 'Metformin 500mg', dosage: 'Twice daily with meals', startDate: '2023-06-01', status: 'active', prescriber: 'Dr. Jones' },
          { name: 'Atorvastatin 20mg', dosage: 'Once daily at bedtime', startDate: '2024-03-10', status: 'active', prescriber: 'Dr. Smith' },
        ];
      case 'conditions':
        return [
          { name: 'Type 2 Diabetes Mellitus', onsetDate: '2023-06-01', status: 'active', severity: 'Moderate' },
          { name: 'Essential Hypertension', onsetDate: '2024-01-15', status: 'active', severity: 'Mild' },
          { name: 'Hyperlipidemia', onsetDate: '2024-03-10', status: 'active', severity: 'Mild' },
        ];
      case 'labs':
        return [
          { test: 'HbA1c', value: '7.2%', date: '2024-12-15', referenceRange: '4.0-5.6%', interpretation: 'Above Normal' },
          { test: 'Fasting Glucose', value: '142 mg/dL', date: '2024-12-15', referenceRange: '70-100 mg/dL', interpretation: 'High' },
          { test: 'Total Cholesterol', value: '195 mg/dL', date: '2024-12-15', referenceRange: '<200 mg/dL', interpretation: 'Normal' },
          { test: 'LDL Cholesterol', value: '115 mg/dL', date: '2024-12-15', referenceRange: '<100 mg/dL', interpretation: 'Borderline High' },
        ];
      case 'allergies':
        return [
          { allergen: 'Penicillin', reaction: 'Hives', severity: 'Moderate', recordedDate: '2020-05-10' },
          { allergen: 'Sulfa drugs', reaction: 'Rash', severity: 'Mild', recordedDate: '2018-03-22' },
        ];
      case 'immunizations':
        return [
          { vaccine: 'Influenza', date: '2024-10-01', manufacturer: 'Sanofi', lotNumber: 'FL2024001' },
          { vaccine: 'COVID-19 (Pfizer)', date: '2024-09-15', manufacturer: 'Pfizer', lotNumber: 'CV2024789' },
          { vaccine: 'Tdap', date: '2023-01-20', manufacturer: 'GSK', lotNumber: 'TD2023456' },
        ];
      case 'vitals':
        return [
          { type: 'Blood Pressure', value: '128/82 mmHg', date: '2024-12-20', location: 'Office visit' },
          { type: 'Heart Rate', value: '72 bpm', date: '2024-12-20', location: 'Office visit' },
          { type: 'Weight', value: '185 lbs', date: '2024-12-20', location: 'Office visit' },
          { type: 'BMI', value: '27.4', date: '2024-12-20', location: 'Calculated' },
        ];
      case 'encounters':
        return [
          { type: 'Office Visit', date: '2024-12-20', provider: 'Dr. Smith', reason: 'Diabetes follow-up', location: 'Main Clinic' },
          { type: 'Lab Visit', date: '2024-12-15', provider: 'LabCorp', reason: 'Routine bloodwork', location: 'LabCorp Downtown' },
          { type: 'Office Visit', date: '2024-09-15', provider: 'Dr. Jones', reason: 'Annual physical', location: 'Main Clinic' },
        ];
      case 'procedures':
        return [
          { name: 'Colonoscopy', date: '2024-06-10', provider: 'Dr. Williams', result: 'Normal' },
          { name: 'Echocardiogram', date: '2024-02-15', provider: 'Dr. Chen', result: 'Normal cardiac function' },
        ];
      case 'documents':
        return [
          { title: 'Annual Physical Summary', date: '2024-09-15', type: 'Clinical Note', author: 'Dr. Jones' },
          { title: 'Cardiology Consultation', date: '2024-02-15', type: 'Consultation Report', author: 'Dr. Chen' },
        ];
      default:
        return [];
    }
  }

  getShareableSections(): ShareableDataSection[] {
    return SHAREABLE_SECTIONS;
  }

  async getShareAccessLog(shareId: string, patientId: string): Promise<ShareAccessLog[]> {
    const share = shares.get(shareId);
    if (!share || share.patientId !== patientId) {
      throw new Error('Share not found or unauthorized');
    }
    return share.accessLog;
  }
}

export const secureHealthShareService = new SecureHealthShareService();
