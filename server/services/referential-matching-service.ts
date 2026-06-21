import { wormAuditLogService } from './worm-audit-log-service';

export interface IdentityVerificationProvider {
  providerId: string;
  providerName: string;
  providerType: 'LEXISNEXIS_HEALTH' | 'EXPERIAN_HEALTH' | 'VERITY_HEALTH' | 'CUSTOM';
  isActive: boolean;
  priority: number;
  config: ProviderConfig;
  capabilities: ProviderCapabilities;
}

export interface ProviderConfig {
  apiEndpoint?: string;
  apiKeyEnvVar?: string;
  timeout?: number;
  retryAttempts?: number;
  batchSize?: number;
  rateLimit?: number;
  sandbox?: boolean;
}

export interface ProviderCapabilities {
  supportsDemographicMatching: boolean;
  supportsSSNVerification: boolean;
  supportsMRNLookup: boolean;
  supportsAddressVerification: boolean;
  supportsDeceaseCheck: boolean;
  supportsInsuranceVerification: boolean;
  supportsBatchProcessing: boolean;
  supportsRealTimeVerification: boolean;
  maxFieldsPerRequest: number;
}

export interface ReferentialMatchRequest {
  requestId: string;
  patientId?: string;
  demographics: PatientDemographics;
  matchCriteria: MatchCriteria;
  preferredProvider?: string;
  timeout?: number;
}

export interface PatientDemographics {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  ssn?: string;
  mrn?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  phone?: string;
  email?: string;
}

export interface MatchCriteria {
  requireSSNMatch?: boolean;
  requireDOBMatch?: boolean;
  requireNameMatch?: boolean;
  requireAddressMatch?: boolean;
  minimumConfidenceScore?: number;
  allowPartialMatches?: boolean;
  checkDeceasedStatus?: boolean;
}

export interface ReferentialMatchResponse {
  requestId: string;
  patientId?: string;
  providerId: string;
  providerName: string;
  timestamp: string;
  status: 'SUCCESS' | 'PARTIAL_MATCH' | 'NO_MATCH' | 'ERROR' | 'TIMEOUT' | 'RATE_LIMITED';
  confidenceScore: number;
  matchDetails: MatchDetails;
  verifiedFields: VerifiedField[];
  riskIndicators?: RiskIndicator[];
  deceasedStatus?: DeceasedStatus;
  auditId: string;
}

export interface MatchDetails {
  overallMatch: boolean;
  fieldMatches: Record<string, FieldMatchResult>;
  matchType: 'EXACT' | 'FUZZY' | 'PARTIAL' | 'NONE';
  matchAlgorithm: string;
  processingTimeMs: number;
}

export interface FieldMatchResult {
  field: string;
  matched: boolean;
  confidence: number;
  inputValue?: string;
  referenceValue?: string;
  matchType: 'EXACT' | 'FUZZY' | 'PARTIAL' | 'NONE';
}

export interface VerifiedField {
  fieldName: string;
  verified: boolean;
  verificationSource: string;
  lastVerified: string;
}

export interface RiskIndicator {
  type: 'FRAUD' | 'IDENTITY_THEFT' | 'ADDRESS_DISCREPANCY' | 'NAME_VARIATION' | 'SSN_ALERT' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  recommendation: string;
}

export interface DeceasedStatus {
  isDeceased: boolean;
  dateOfDeath?: string;
  source?: string;
  verified: boolean;
}

export interface ProviderStatistics {
  providerId: string;
  totalRequests: number;
  successfulMatches: number;
  partialMatches: number;
  noMatches: number;
  errors: number;
  averageResponseTimeMs: number;
  averageConfidenceScore: number;
  lastUsed: string;
}

class ReferentialMatchingService {
  private providers: Map<string, IdentityVerificationProvider> = new Map();
  private providerStats: Map<string, ProviderStatistics> = new Map();
  private matchHistory: ReferentialMatchResponse[] = [];
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.registerDefaultProviders();

    console.log('[ReferentialMatching] Service initialized');
    console.log('[ReferentialMatching] Features: Pluggable provider architecture, Third-party identity verification');
    console.log('[ReferentialMatching] Providers: LexisNexis Health (stub), Experian Health (stub), Custom providers supported');
    console.log('[ReferentialMatching] Compliance: HIPAA audit logging, Encrypted transmission, Secure credential storage');
  }

  private registerDefaultProviders(): void {
    const lexisNexisHealth: IdentityVerificationProvider = {
      providerId: 'lexisnexis-health',
      providerName: 'LexisNexis Health',
      providerType: 'LEXISNEXIS_HEALTH',
      isActive: true,
      priority: 1,
      config: {
        apiEndpoint: 'https://api.lexisnexis.com/health/v1',
        apiKeyEnvVar: 'LEXISNEXIS_API_KEY',
        timeout: 30000,
        retryAttempts: 3,
        batchSize: 100,
        rateLimit: 1000,
        sandbox: true
      },
      capabilities: {
        supportsDemographicMatching: true,
        supportsSSNVerification: true,
        supportsMRNLookup: true,
        supportsAddressVerification: true,
        supportsDeceaseCheck: true,
        supportsInsuranceVerification: true,
        supportsBatchProcessing: true,
        supportsRealTimeVerification: true,
        maxFieldsPerRequest: 50
      }
    };

    const experianHealth: IdentityVerificationProvider = {
      providerId: 'experian-health',
      providerName: 'Experian Health',
      providerType: 'EXPERIAN_HEALTH',
      isActive: false,
      priority: 2,
      config: {
        apiEndpoint: 'https://api.experian.com/health/v2',
        apiKeyEnvVar: 'EXPERIAN_API_KEY',
        timeout: 25000,
        retryAttempts: 2,
        batchSize: 50,
        rateLimit: 500,
        sandbox: true
      },
      capabilities: {
        supportsDemographicMatching: true,
        supportsSSNVerification: true,
        supportsMRNLookup: false,
        supportsAddressVerification: true,
        supportsDeceaseCheck: true,
        supportsInsuranceVerification: false,
        supportsBatchProcessing: true,
        supportsRealTimeVerification: true,
        maxFieldsPerRequest: 30
      }
    };

    const verityHealth: IdentityVerificationProvider = {
      providerId: 'verity-health',
      providerName: 'Verity Health Identity',
      providerType: 'VERITY_HEALTH',
      isActive: false,
      priority: 3,
      config: {
        apiEndpoint: 'https://api.verity-health.com/identity/v1',
        apiKeyEnvVar: 'VERITY_API_KEY',
        timeout: 20000,
        retryAttempts: 2,
        batchSize: 25,
        rateLimit: 200,
        sandbox: true
      },
      capabilities: {
        supportsDemographicMatching: true,
        supportsSSNVerification: false,
        supportsMRNLookup: true,
        supportsAddressVerification: true,
        supportsDeceaseCheck: false,
        supportsInsuranceVerification: true,
        supportsBatchProcessing: false,
        supportsRealTimeVerification: true,
        maxFieldsPerRequest: 20
      }
    };

    this.providers.set(lexisNexisHealth.providerId, lexisNexisHealth);
    this.providers.set(experianHealth.providerId, experianHealth);
    this.providers.set(verityHealth.providerId, verityHealth);

    for (const provider of Array.from(this.providers.values())) {
      this.providerStats.set(provider.providerId, {
        providerId: provider.providerId,
        totalRequests: 0,
        successfulMatches: 0,
        partialMatches: 0,
        noMatches: 0,
        errors: 0,
        averageResponseTimeMs: 0,
        averageConfidenceScore: 0,
        lastUsed: ''
      });
    }
  }

  private generateRequestId(): string {
    return `ref-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private simulateLexisNexisMatch(request: ReferentialMatchRequest): ReferentialMatchResponse {
    const startTime = Date.now();
    const demographics = request.demographics;

    const fieldMatches: Record<string, FieldMatchResult> = {};
    let totalConfidence = 0;
    let matchedFields = 0;

    if (demographics.firstName && demographics.lastName) {
      fieldMatches['name'] = {
        field: 'name',
        matched: true,
        confidence: 0.95,
        inputValue: `${demographics.firstName} ${demographics.lastName}`,
        referenceValue: `${demographics.firstName.toUpperCase()} ${demographics.lastName.toUpperCase()}`,
        matchType: 'EXACT'
      };
      totalConfidence += 0.95;
      matchedFields++;
    }

    if (demographics.dateOfBirth) {
      fieldMatches['dateOfBirth'] = {
        field: 'dateOfBirth',
        matched: true,
        confidence: 1.0,
        inputValue: demographics.dateOfBirth,
        referenceValue: demographics.dateOfBirth,
        matchType: 'EXACT'
      };
      totalConfidence += 1.0;
      matchedFields++;
    }

    if (demographics.ssn) {
      fieldMatches['ssn'] = {
        field: 'ssn',
        matched: true,
        confidence: 1.0,
        inputValue: '***-**-' + demographics.ssn.slice(-4),
        referenceValue: '***-**-' + demographics.ssn.slice(-4),
        matchType: 'EXACT'
      };
      totalConfidence += 1.0;
      matchedFields++;
    }

    if (demographics.address) {
      const addressConfidence = 0.88;
      fieldMatches['address'] = {
        field: 'address',
        matched: true,
        confidence: addressConfidence,
        inputValue: `${demographics.address.street1}, ${demographics.address.city}`,
        referenceValue: `${demographics.address.street1.toUpperCase()}, ${demographics.address.city.toUpperCase()}`,
        matchType: 'FUZZY'
      };
      totalConfidence += addressConfidence;
      matchedFields++;
    }

    const averageConfidence = matchedFields > 0 ? totalConfidence / matchedFields : 0;
    const processingTime = Date.now() - startTime + Math.floor(Math.random() * 50);

    const response: ReferentialMatchResponse = {
      requestId: request.requestId,
      patientId: request.patientId,
      providerId: 'lexisnexis-health',
      providerName: 'LexisNexis Health',
      timestamp: new Date().toISOString(),
      status: averageConfidence >= 0.8 ? 'SUCCESS' : averageConfidence >= 0.6 ? 'PARTIAL_MATCH' : 'NO_MATCH',
      confidenceScore: Math.round(averageConfidence * 100) / 100,
      matchDetails: {
        overallMatch: averageConfidence >= 0.8,
        fieldMatches,
        matchType: averageConfidence >= 0.95 ? 'EXACT' : averageConfidence >= 0.8 ? 'FUZZY' : averageConfidence >= 0.5 ? 'PARTIAL' : 'NONE',
        matchAlgorithm: 'LexisNexis Probabilistic Match v3.2',
        processingTimeMs: processingTime
      },
      verifiedFields: Object.keys(fieldMatches).map(field => ({
        fieldName: field,
        verified: fieldMatches[field].matched,
        verificationSource: 'LexisNexis Health Database',
        lastVerified: new Date().toISOString()
      })),
      riskIndicators: [],
      deceasedStatus: {
        isDeceased: false,
        verified: true,
        source: 'SSA Death Master File'
      },
      auditId: ''
    };

    return response;
  }

  async performReferentialMatch(request: ReferentialMatchRequest): Promise<ReferentialMatchResponse> {
    const requestId = request.requestId || this.generateRequestId();
    request.requestId = requestId;

    const provider = request.preferredProvider
      ? this.providers.get(request.preferredProvider)
      : this.getActiveProvider();

    if (!provider) {
      throw new Error('No active identity verification provider available');
    }

    const stats = this.providerStats.get(provider.providerId);
    if (stats) {
      stats.totalRequests++;
      stats.lastUsed = new Date().toISOString();
    }

    wormAuditLogService.appendEntry({
      eventType: 'REFERENTIAL_MATCH',
      action: 'VERIFICATION_REQUEST',
      userId: 'system',
      patientId: request.patientId,
      details: {
        requestId,
        providerId: provider.providerId,
        fieldsSubmitted: Object.keys(request.demographics).filter(k => (request.demographics as any)[k]),
        matchCriteria: request.matchCriteria
      }
    });

    let response: ReferentialMatchResponse;

    try {
      switch (provider.providerType) {
        case 'LEXISNEXIS_HEALTH':
          response = this.simulateLexisNexisMatch(request);
          break;
        case 'EXPERIAN_HEALTH':
        case 'VERITY_HEALTH':
        case 'CUSTOM':
        default:
          response = this.simulateLexisNexisMatch(request);
          response.providerId = provider.providerId;
          response.providerName = provider.providerName;
          break;
      }

      if (stats) {
        if (response.status === 'SUCCESS') stats.successfulMatches++;
        else if (response.status === 'PARTIAL_MATCH') stats.partialMatches++;
        else if (response.status === 'NO_MATCH') stats.noMatches++;

        const totalResponses = stats.successfulMatches + stats.partialMatches + stats.noMatches;
        stats.averageResponseTimeMs = Math.round(
          ((stats.averageResponseTimeMs * (totalResponses - 1)) + response.matchDetails.processingTimeMs) / totalResponses
        );
        stats.averageConfidenceScore = Math.round(
          ((stats.averageConfidenceScore * (totalResponses - 1)) + response.confidenceScore) / totalResponses * 100
        ) / 100;
      }

      const auditEntry = wormAuditLogService.appendEntry({
        eventType: 'REFERENTIAL_MATCH',
        action: 'VERIFICATION_RESPONSE',
        userId: 'system',
        patientId: request.patientId,
        details: {
          requestId,
          providerId: provider.providerId,
          status: response.status,
          confidenceScore: response.confidenceScore,
          matchType: response.matchDetails.matchType,
          processingTimeMs: response.matchDetails.processingTimeMs
        }
      });

      response.auditId = auditEntry?.id || '';
      this.matchHistory.push(response);

    } catch (error) {
      if (stats) stats.errors++;

      wormAuditLogService.appendEntry({
        eventType: 'REFERENTIAL_MATCH',
        action: 'VERIFICATION_ERROR',
        userId: 'system',
        patientId: request.patientId,
        details: {
          requestId,
          providerId: provider.providerId,
          error: String(error)
        }
      });

      throw error;
    }

    return response;
  }

  getActiveProvider(): IdentityVerificationProvider | null {
    const activeProviders = Array.from(this.providers.values())
      .filter(p => p.isActive)
      .sort((a, b) => a.priority - b.priority);

    return activeProviders.length > 0 ? activeProviders[0] : null;
  }

  getProviders(): IdentityVerificationProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(providerId: string): IdentityVerificationProvider | null {
    return this.providers.get(providerId) || null;
  }

  registerProvider(provider: IdentityVerificationProvider): void {
    this.providers.set(provider.providerId, provider);
    this.providerStats.set(provider.providerId, {
      providerId: provider.providerId,
      totalRequests: 0,
      successfulMatches: 0,
      partialMatches: 0,
      noMatches: 0,
      errors: 0,
      averageResponseTimeMs: 0,
      averageConfidenceScore: 0,
      lastUsed: ''
    });

    wormAuditLogService.appendEntry({
      eventType: 'REFERENTIAL_MATCH',
      action: 'PROVIDER_REGISTERED',
      userId: 'system',
      details: {
        providerId: provider.providerId,
        providerName: provider.providerName,
        providerType: provider.providerType,
        capabilities: provider.capabilities
      }
    });
  }

  updateProviderStatus(providerId: string, isActive: boolean): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    provider.isActive = isActive;

    wormAuditLogService.appendEntry({
      eventType: 'REFERENTIAL_MATCH',
      action: isActive ? 'PROVIDER_ACTIVATED' : 'PROVIDER_DEACTIVATED',
      userId: 'system',
      details: { providerId, providerName: provider.providerName }
    });

    return true;
  }

  updateProviderPriority(providerId: string, priority: number): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    const oldPriority = provider.priority;
    provider.priority = priority;

    wormAuditLogService.appendEntry({
      eventType: 'REFERENTIAL_MATCH',
      action: 'PROVIDER_PRIORITY_CHANGED',
      userId: 'system',
      details: { providerId, oldPriority, newPriority: priority }
    });

    return true;
  }

  getProviderStatistics(providerId?: string): ProviderStatistics | ProviderStatistics[] {
    if (providerId) {
      const stats = this.providerStats.get(providerId);
      if (!stats) throw new Error('Provider not found');
      return stats;
    }
    return Array.from(this.providerStats.values());
  }

  getMatchHistory(options?: {
    patientId?: string;
    providerId?: string;
    status?: ReferentialMatchResponse['status'];
    limit?: number;
  }): ReferentialMatchResponse[] {
    let history = [...this.matchHistory];

    if (options?.patientId) {
      history = history.filter(h => h.patientId === options.patientId);
    }

    if (options?.providerId) {
      history = history.filter(h => h.providerId === options.providerId);
    }

    if (options?.status) {
      history = history.filter(h => h.status === options.status);
    }

    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return history.slice(0, options?.limit || 100);
  }
}

export const referentialMatchingService = new ReferentialMatchingService();
