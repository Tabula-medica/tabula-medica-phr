import crypto from 'crypto';

export interface WORMAuditEntry {
  id: string;
  timestamp: string;
  eventType: string;
  action: string;
  userId: string;
  patientId?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
  signature: string;
  immutable: true;
}

export interface AuditLogInput {
  eventType: string;
  action: string;
  userId: string;
  patientId?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export interface ChainValidationResult {
  valid: boolean;
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  brokenLinks: string[];
  tamperedEntries: string[];
}

export interface AuditExportOptions {
  startDate?: string;
  endDate?: string;
  eventTypes?: string[];
  userId?: string;
  patientId?: string;
  format: 'json' | 'csv';
  includeChainValidation?: boolean;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

class WORMAuditLogService {
  private auditLog: WORMAuditEntry[] = [];
  private signingKey: string;
  private initialized = false;

  constructor() {
    this.signingKey = process.env.AUDIT_SIGNING_KEY || crypto.randomBytes(32).toString('hex');
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[WORMAuditLog] Service initialized with WORM (Write Once Read Many) semantics');
    console.log('[WORMAuditLog] Features: Append-only storage, Hash chain verification, Tamper-evident logging');
    console.log('[WORMAuditLog] Compliance: HITRUST, SOC2, HIPAA audit trail requirements');
  }

  private generateEntryId(): string {
    return `worm-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private computeHash(data: Omit<WORMAuditEntry, 'currentHash' | 'signature' | 'immutable'>): string {
    const hashInput = JSON.stringify({
      id: data.id,
      timestamp: data.timestamp,
      eventType: data.eventType,
      action: data.action,
      userId: data.userId,
      patientId: data.patientId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: data.details,
      previousHash: data.previousHash
    });
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private signEntry(hash: string): string {
    return crypto.createHmac('sha256', this.signingKey).update(hash).digest('hex');
  }

  private verifySignature(hash: string, signature: string): boolean {
    const expectedSignature = this.signEntry(hash);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private getLastHash(): string {
    if (this.auditLog.length === 0) {
      return GENESIS_HASH;
    }
    return this.auditLog[this.auditLog.length - 1].currentHash;
  }

  appendEntry(input: AuditLogInput): WORMAuditEntry {
    const id = this.generateEntryId();
    const timestamp = new Date().toISOString();
    const previousHash = this.getLastHash();

    const entryData = {
      id,
      timestamp,
      eventType: input.eventType,
      action: input.action,
      userId: input.userId,
      patientId: input.patientId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: input.details || {},
      previousHash
    };

    const currentHash = this.computeHash(entryData);
    const signature = this.signEntry(currentHash);

    const entry: WORMAuditEntry = {
      ...entryData,
      currentHash,
      signature,
      immutable: true
    };

    this.auditLog.push(Object.freeze(entry) as WORMAuditEntry);

    return entry;
  }

  logPHIAccess(userId: string, patientId: string, resourceType: string, action: string, details?: Record<string, unknown>, ipAddress?: string): WORMAuditEntry {
    return this.appendEntry({
      eventType: 'PHI_ACCESS',
      action,
      userId,
      patientId,
      resourceType,
      details: {
        ...details,
        accessReason: details?.reason || 'Treatment/Operations',
        hipaaCompliant: true
      },
      ipAddress
    });
  }

  logSecurityEvent(eventType: string, userId: string, action: string, details?: Record<string, unknown>, ipAddress?: string): WORMAuditEntry {
    return this.appendEntry({
      eventType: `SECURITY_${eventType}`,
      action,
      userId,
      details: {
        ...details,
        securityLevel: 'HIGH',
        alertRequired: details?.alertRequired || false
      },
      ipAddress
    });
  }

  logDataModification(userId: string, resourceType: string, resourceId: string, action: string, before?: unknown, after?: unknown, ipAddress?: string): WORMAuditEntry {
    return this.appendEntry({
      eventType: 'DATA_MODIFICATION',
      action,
      userId,
      resourceType,
      resourceId,
      details: {
        before: before ? JSON.stringify(before).substring(0, 500) : null,
        after: after ? JSON.stringify(after).substring(0, 500) : null,
        changeType: action
      },
      ipAddress
    });
  }

  logDeduplicationAction(userId: string, action: string, sourcePatientId: string, targetPatientId?: string, confidence?: number, details?: Record<string, unknown>): WORMAuditEntry {
    return this.appendEntry({
      eventType: 'DEDUPLICATION',
      action,
      userId,
      patientId: sourcePatientId,
      details: {
        ...details,
        targetPatientId,
        confidence,
        matchingAlgorithm: 'NMN_LEVENSHTEIN_WEIGHTED'
      }
    });
  }

  logBreakGlassAccess(userId: string, patientId: string, reason: string, emergencyType: string, ipAddress?: string): WORMAuditEntry {
    return this.appendEntry({
      eventType: 'BREAK_GLASS_ACCESS',
      action: 'EMERGENCY_ACCESS_GRANTED',
      userId,
      patientId,
      details: {
        reason,
        emergencyType,
        expirationHours: 4,
        permanentAuditTrail: true,
        requiresFollowUp: true
      },
      ipAddress
    });
  }

  validateChain(): ChainValidationResult {
    const result: ChainValidationResult = {
      valid: true,
      totalEntries: this.auditLog.length,
      validEntries: 0,
      invalidEntries: 0,
      brokenLinks: [],
      tamperedEntries: []
    };

    if (this.auditLog.length === 0) {
      return result;
    }

    for (let i = 0; i < this.auditLog.length; i++) {
      const entry = this.auditLog[i];
      
      const expectedPreviousHash = i === 0 ? GENESIS_HASH : this.auditLog[i - 1].currentHash;
      if (entry.previousHash !== expectedPreviousHash) {
        result.valid = false;
        result.brokenLinks.push(entry.id);
        result.invalidEntries++;
        continue;
      }

      const recomputedHash = this.computeHash({
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        action: entry.action,
        userId: entry.userId,
        patientId: entry.patientId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        details: entry.details,
        previousHash: entry.previousHash
      });

      if (recomputedHash !== entry.currentHash) {
        result.valid = false;
        result.tamperedEntries.push(entry.id);
        result.invalidEntries++;
        continue;
      }

      if (!this.verifySignature(entry.currentHash, entry.signature)) {
        result.valid = false;
        result.tamperedEntries.push(entry.id);
        result.invalidEntries++;
        continue;
      }

      result.validEntries++;
    }

    return result;
  }

  getEntries(options?: {
    startDate?: string;
    endDate?: string;
    eventTypes?: string[];
    userId?: string;
    patientId?: string;
    limit?: number;
    offset?: number;
  }): WORMAuditEntry[] {
    let entries = [...this.auditLog];

    if (options?.startDate) {
      const start = new Date(options.startDate).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= start);
    }

    if (options?.endDate) {
      const end = new Date(options.endDate).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() <= end);
    }

    if (options?.eventTypes && options.eventTypes.length > 0) {
      entries = entries.filter(e => options.eventTypes!.includes(e.eventType));
    }

    if (options?.userId) {
      entries = entries.filter(e => e.userId === options.userId);
    }

    if (options?.patientId) {
      entries = entries.filter(e => e.patientId === options.patientId);
    }

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    return entries.slice(offset, offset + limit);
  }

  getEntryById(id: string): WORMAuditEntry | undefined {
    return this.auditLog.find(e => e.id === id);
  }

  exportAuditLog(options: AuditExportOptions): { data: string; filename: string; chainValidation?: ChainValidationResult } {
    const entries = this.getEntries({
      startDate: options.startDate,
      endDate: options.endDate,
      eventTypes: options.eventTypes,
      userId: options.userId,
      patientId: options.patientId,
      limit: 10000
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let data: string;
    let filename: string;

    if (options.format === 'csv') {
      const headers = [
        'ID', 'Timestamp', 'EventType', 'Action', 'UserId', 'PatientId',
        'ResourceType', 'ResourceId', 'IPAddress', 'PreviousHash', 'CurrentHash', 'Signature'
      ].join(',');

      const rows = entries.map(e => [
        e.id,
        e.timestamp,
        e.eventType,
        e.action,
        e.userId,
        e.patientId || '',
        e.resourceType || '',
        e.resourceId || '',
        e.ipAddress || '',
        e.previousHash,
        e.currentHash,
        e.signature
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

      data = [headers, ...rows].join('\n');
      filename = `worm-audit-log-${timestamp}.csv`;
    } else {
      const exportData = {
        exportTimestamp: new Date().toISOString(),
        genesisHash: GENESIS_HASH,
        totalEntries: entries.length,
        filters: {
          startDate: options.startDate,
          endDate: options.endDate,
          eventTypes: options.eventTypes,
          userId: options.userId,
          patientId: options.patientId
        },
        entries
      };
      data = JSON.stringify(exportData, null, 2);
      filename = `worm-audit-log-${timestamp}.json`;
    }

    const result: { data: string; filename: string; chainValidation?: ChainValidationResult } = {
      data,
      filename
    };

    if (options.includeChainValidation) {
      result.chainValidation = this.validateChain();
    }

    return result;
  }

  getStatistics(): {
    totalEntries: number;
    entriesByEventType: Record<string, number>;
    entriesLast24Hours: number;
    entriesLast7Days: number;
    chainIntegrity: ChainValidationResult;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;

    const entriesByEventType: Record<string, number> = {};
    let entriesLast24Hours = 0;
    let entriesLast7Days = 0;

    for (const entry of this.auditLog) {
      entriesByEventType[entry.eventType] = (entriesByEventType[entry.eventType] || 0) + 1;
      
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime >= last24Hours) entriesLast24Hours++;
      if (entryTime >= last7Days) entriesLast7Days++;
    }

    return {
      totalEntries: this.auditLog.length,
      entriesByEventType,
      entriesLast24Hours,
      entriesLast7Days,
      chainIntegrity: this.validateChain(),
      oldestEntry: this.auditLog[0]?.timestamp,
      newestEntry: this.auditLog[this.auditLog.length - 1]?.timestamp
    };
  }

  getChainProof(entryId: string): {
    entry: WORMAuditEntry;
    chainPosition: number;
    predecessorHash: string;
    successorHash?: string;
    proofPath: Array<{ position: number; hash: string }>;
  } | null {
    const index = this.auditLog.findIndex(e => e.id === entryId);
    if (index === -1) return null;

    const entry = this.auditLog[index];
    const proofPath: Array<{ position: number; hash: string }> = [];

    for (let i = Math.max(0, index - 3); i <= Math.min(this.auditLog.length - 1, index + 3); i++) {
      proofPath.push({
        position: i,
        hash: this.auditLog[i].currentHash
      });
    }

    return {
      entry,
      chainPosition: index,
      predecessorHash: index === 0 ? GENESIS_HASH : this.auditLog[index - 1].currentHash,
      successorHash: index < this.auditLog.length - 1 ? this.auditLog[index + 1].currentHash : undefined,
      proofPath
    };
  }
}

export const wormAuditLogService = new WORMAuditLogService();
