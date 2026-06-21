/**
 * TEFCA Framework Service
 * 
 * Implements the Trusted Exchange Framework and Common Agreement (TEFCA)
 * for nationwide health information exchange through Qualified Health
 * Information Networks (QHINs).
 * 
 * TEFCA enables:
 * - Individual Access Services (IAS) - Patient access to their records
 * - Treatment Exchange - Provider-to-provider data sharing
 * - Payment Exchange - Payer access for claims/coverage
 * - Healthcare Operations - Quality improvement, public health
 * - Public Health Activities - Disease surveillance, reporting
 * - Government Benefits Determination
 * 
 * Qualified Health Information Networks (QHINs):
 * - eHealth Exchange
 * - Carequality
 * - CommonWell Health Alliance
 * - CARIN Alliance
 * - DirectTrust
 */

export type TEFCAExchangePurpose = 
  | 'treatment'
  | 'individual_access'
  | 'payment'
  | 'healthcare_operations'
  | 'public_health'
  | 'government_benefits';

export type QHINIdentifier = 
  | 'ehealth_exchange'
  | 'carequality'
  | 'commonwell'
  | 'carin_alliance'
  | 'direct_trust'
  | 'epic_nexus'
  | (string & {});

export interface QHINConnection {
  qhinId: QHINIdentifier;
  name: string;
  status: 'active' | 'pending' | 'inactive' | 'maintenance';
  capabilities: TEFCAExchangePurpose[];
  endpoints: {
    discovery: string;
    query: string;
    retrieve: string;
  };
  certificationDate: string;
  lastHealthCheck: string;
  supportedFhirVersions: string[];
  participantCount: number;
}

export interface TEFCAQueryRequest {
  requestId: string;
  purpose: TEFCAExchangePurpose;
  patientDemographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
    ssn?: string;
    address?: {
      line: string[];
      city: string;
      state: string;
      postalCode: string;
    };
  };
  requestingOrganization: {
    oid: string;
    name: string;
    npi?: string;
  };
  requestingUser?: {
    npi?: string;
    name: string;
    role: string;
  };
  targetQHINs?: QHINIdentifier[];
  dataElements?: string[];
  dateRange?: { start: string; end: string };
}

export interface TEFCAQueryResponse {
  queryId: string;
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  initiatedAt: string;
  completedAt?: string;
  qhinResponses: QHINQueryResult[];
  aggregatedResults: TEFCAAggregatedResult;
  errors?: TEFCAError[];
  auditTrail: TEFCAAuditEntry[];
}

export interface QHINQueryResult {
  qhinId: QHINIdentifier;
  qhinName: string;
  status: 'success' | 'partial' | 'no_records' | 'error' | 'timeout';
  responseTime: number;
  matchedPatients: TEFCAPatientMatch[];
  documentCount: number;
  documents: TEFCADocument[];
  error?: string;
}

export interface TEFCAPatientMatch {
  matchId: string;
  confidence: number;
  matchAlgorithm: string;
  sourceSystem: string;
  patientId: string;
  demographics: {
    name: string;
    dateOfBirth: string;
    gender: string;
    address?: string;
  };
}

export interface TEFCADocument {
  documentId: string;
  sourceQHIN: QHINIdentifier;
  sourceOrganization: string;
  documentType: string;
  documentClass: string;
  title: string;
  createdDate: string;
  contentType: string;
  size: number;
  hash: string;
  available: boolean;
  retrievalUrl?: string;
}

export interface TEFCAAggregatedResult {
  totalQHINsQueried: number;
  totalQHINsResponded: number;
  totalPatientMatches: number;
  totalDocuments: number;
  documentsByType: Record<string, number>;
  sourceOrganizations: string[];
  uniqueDataElements: string[];
  overallConfidence: number;
}

export interface TEFCAError {
  qhinId?: QHINIdentifier;
  errorCode: string;
  errorMessage: string;
  severity: 'warning' | 'error' | 'critical';
  recoverable: boolean;
  timestamp: string;
}

export interface TEFCAAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  actorOrganization: string;
  purpose: TEFCAExchangePurpose;
  patientId?: string;
  qhinsInvolved: QHINIdentifier[];
  outcome: 'success' | 'failure';
  details: string;
}

export interface TEFCADocumentRetrievalRequest {
  queryId: string;
  documentIds: string[];
  requestingOrganization: string;
  requestingUser: string;
  purpose: TEFCAExchangePurpose;
}

export interface TEFCADocumentRetrievalResponse {
  retrievalId: string;
  queryId: string;
  documents: RetrievedDocument[];
  errors?: TEFCAError[];
}

export interface RetrievedDocument {
  documentId: string;
  retrieved: boolean;
  content?: string;
  contentType: string;
  fhirBundle?: Record<string, unknown>;
  error?: string;
}

class TEFCAFrameworkService {
  private qhinConnections: Map<QHINIdentifier, QHINConnection> = new Map();
  private activeQueries: Map<string, TEFCAQueryResponse> = new Map();
  private queryHistory: TEFCAQueryResponse[] = [];
  private auditLog: TEFCAAuditEntry[] = [];

  constructor() {
    this.initializeQHINConnections();
  }

  private initializeQHINConnections(): void {
    const connections: QHINConnection[] = [
      {
        qhinId: 'ehealth_exchange',
        name: 'eHealth Exchange',
        status: 'active',
        capabilities: ['treatment', 'individual_access', 'payment', 'healthcare_operations', 'public_health'],
        endpoints: {
          discovery: 'https://api.ehealthexchange.org/fhir/discovery',
          query: 'https://api.ehealthexchange.org/fhir/query',
          retrieve: 'https://api.ehealthexchange.org/fhir/retrieve'
        },
        certificationDate: '2024-01-15',
        lastHealthCheck: new Date().toISOString(),
        supportedFhirVersions: ['R4', 'R4B'],
        participantCount: 3500
      },
      {
        qhinId: 'carequality',
        name: 'Carequality',
        status: 'active',
        capabilities: ['treatment', 'individual_access', 'payment', 'healthcare_operations'],
        endpoints: {
          discovery: 'https://api.carequality.org/fhir/discovery',
          query: 'https://api.carequality.org/fhir/query',
          retrieve: 'https://api.carequality.org/fhir/retrieve'
        },
        certificationDate: '2024-02-01',
        lastHealthCheck: new Date().toISOString(),
        supportedFhirVersions: ['R4'],
        participantCount: 2800
      },
      {
        qhinId: 'commonwell',
        name: 'CommonWell Health Alliance',
        status: 'active',
        capabilities: ['treatment', 'individual_access', 'healthcare_operations'],
        endpoints: {
          discovery: 'https://api.commonwellalliance.org/fhir/discovery',
          query: 'https://api.commonwellalliance.org/fhir/query',
          retrieve: 'https://api.commonwellalliance.org/fhir/retrieve'
        },
        certificationDate: '2024-01-20',
        lastHealthCheck: new Date().toISOString(),
        supportedFhirVersions: ['R4'],
        participantCount: 25000
      },
      {
        qhinId: 'carin_alliance',
        name: 'CARIN Alliance',
        status: 'active',
        capabilities: ['individual_access', 'payment'],
        endpoints: {
          discovery: 'https://api.carinalliance.org/fhir/discovery',
          query: 'https://api.carinalliance.org/fhir/query',
          retrieve: 'https://api.carinalliance.org/fhir/retrieve'
        },
        certificationDate: '2024-03-01',
        lastHealthCheck: new Date().toISOString(),
        supportedFhirVersions: ['R4'],
        participantCount: 150
      },
      {
        qhinId: 'direct_trust',
        name: 'DirectTrust',
        status: 'active',
        capabilities: ['treatment', 'healthcare_operations'],
        endpoints: {
          discovery: 'https://api.directtrust.org/fhir/discovery',
          query: 'https://api.directtrust.org/fhir/query',
          retrieve: 'https://api.directtrust.org/fhir/retrieve'
        },
        certificationDate: '2024-02-15',
        lastHealthCheck: new Date().toISOString(),
        supportedFhirVersions: ['R4'],
        participantCount: 180000
      },
      {
        qhinId: 'epic_nexus',
        name: 'Epic Nexus',
        status: 'active',
        capabilities: ['treatment', 'individual_access', 'healthcare_operations'],
        endpoints: {
          discovery: 'https://fhir.epic.com/nexus/discovery',
          query: 'https://fhir.epic.com/nexus/query',
          retrieve: 'https://fhir.epic.com/nexus/retrieve'
        },
        certificationDate: '2024-01-01',
        lastHealthCheck: new Date().toISOString(),
        supportedFhirVersions: ['R4', 'R4B'],
        participantCount: 290000000
      }
    ];

    connections.forEach(conn => this.qhinConnections.set(conn.qhinId, conn));
  }

  getQHINConnections(): QHINConnection[] {
    return Array.from(this.qhinConnections.values());
  }

  getQHINConnection(qhinId: QHINIdentifier): QHINConnection | undefined {
    return this.qhinConnections.get(qhinId);
  }

  getActiveQHINs(purpose: TEFCAExchangePurpose): QHINConnection[] {
    return Array.from(this.qhinConnections.values())
      .filter(conn => conn.status === 'active' && conn.capabilities.includes(purpose));
  }

  async initiateQuery(request: TEFCAQueryRequest): Promise<TEFCAQueryResponse> {
    const queryId = `tefca_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const targetQHINs = request.targetQHINs || 
      this.getActiveQHINs(request.purpose).map(q => q.qhinId);

    const response: TEFCAQueryResponse = {
      queryId,
      requestId: request.requestId,
      status: 'processing',
      initiatedAt: new Date().toISOString(),
      qhinResponses: [],
      aggregatedResults: {
        totalQHINsQueried: targetQHINs.length,
        totalQHINsResponded: 0,
        totalPatientMatches: 0,
        totalDocuments: 0,
        documentsByType: {},
        sourceOrganizations: [],
        uniqueDataElements: [],
        overallConfidence: 0
      },
      auditTrail: []
    };

    this.activeQueries.set(queryId, response);

    // Log audit entry for query initiation
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'TEFCA_QUERY_INITIATED',
      actor: request.requestingUser?.name || 'System',
      actorOrganization: request.requestingOrganization.name,
      purpose: request.purpose,
      qhinsInvolved: targetQHINs,
      outcome: 'success',
      details: `Query initiated for patient: ${request.patientDemographics.lastName}, ${request.patientDemographics.firstName}`
    });

    // Query each QHIN
    for (const qhinId of targetQHINs) {
      try {
        const qhinResult = await this.queryQHIN(qhinId, request);
        response.qhinResponses.push(qhinResult);
        
        // Update aggregated results
        response.aggregatedResults.totalQHINsResponded++;
        response.aggregatedResults.totalPatientMatches += qhinResult.matchedPatients.length;
        response.aggregatedResults.totalDocuments += qhinResult.documentCount;
        
        qhinResult.documents.forEach(doc => {
          response.aggregatedResults.documentsByType[doc.documentType] = 
            (response.aggregatedResults.documentsByType[doc.documentType] || 0) + 1;
          
          if (!response.aggregatedResults.sourceOrganizations.includes(doc.sourceOrganization)) {
            response.aggregatedResults.sourceOrganizations.push(doc.sourceOrganization);
          }
        });
      } catch (error) {
        response.errors = response.errors || [];
        response.errors.push({
          qhinId,
          errorCode: 'QHIN_QUERY_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
          recoverable: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Calculate overall confidence
    if (response.aggregatedResults.totalPatientMatches > 0) {
      const confidences = response.qhinResponses
        .flatMap(r => r.matchedPatients.map(p => p.confidence));
      response.aggregatedResults.overallConfidence = 
        confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }

    response.status = response.errors?.length ? 
      (response.qhinResponses.length > 0 ? 'partial' : 'failed') : 
      'completed';
    response.completedAt = new Date().toISOString();

    // Log completion
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'TEFCA_QUERY_COMPLETED',
      actor: request.requestingUser?.name || 'System',
      actorOrganization: request.requestingOrganization.name,
      purpose: request.purpose,
      qhinsInvolved: targetQHINs,
      outcome: response.status === 'completed' ? 'success' : 'failure',
      details: `Found ${response.aggregatedResults.totalDocuments} documents from ${response.aggregatedResults.totalQHINsResponded} QHINs`
    });

    this.queryHistory.push(response);
    this.activeQueries.delete(queryId);

    return response;
  }

  private async queryQHIN(qhinId: QHINIdentifier, request: TEFCAQueryRequest): Promise<QHINQueryResult> {
    const qhin = this.qhinConnections.get(qhinId);
    if (!qhin) {
      throw new Error(`QHIN not found: ${qhinId}`);
    }

    // Simulate QHIN query response
    const startTime = Date.now();
    
    const mockMatches = this.generateMockPatientMatches(qhinId, request.patientDemographics);
    const mockDocuments = this.generateMockDocuments(qhinId, request.dataElements);

    return {
      qhinId,
      qhinName: qhin.name,
      status: mockMatches.length > 0 ? 'success' : 'no_records',
      responseTime: Date.now() - startTime + Math.random() * 500,
      matchedPatients: mockMatches,
      documentCount: mockDocuments.length,
      documents: mockDocuments
    };
  }

  private generateMockPatientMatches(
    qhinId: QHINIdentifier, 
    demographics: TEFCAQueryRequest['patientDemographics']
  ): TEFCAPatientMatch[] {
    const sources: Record<QHINIdentifier, string[]> = {
      ehealth_exchange: ['University Hospital', 'Regional Medical Center', 'Veterans Affairs'],
      carequality: ['Metro Health System', 'County General', 'Academic Medical Center'],
      commonwell: ['Community Hospital', 'Rural Health Clinic', 'Urgent Care Network'],
      carin_alliance: ['Blue Cross Claims', 'Medicare Advantage'],
      direct_trust: ['Primary Care Associates', 'Specialty Clinic Network'],
      epic_nexus: ['Epic Hospital Network', 'Epic Clinic System', 'Epic Academic Center']
    };

    const orgSources = sources[qhinId] || ['Unknown Organization'];
    
    return [{
      matchId: `match_${qhinId}_${Date.now()}`,
      confidence: 0.85 + Math.random() * 0.14,
      matchAlgorithm: 'TEFCA-MPI-v2',
      sourceSystem: orgSources[Math.floor(Math.random() * orgSources.length)],
      patientId: `${qhinId}_${Math.random().toString(36).substring(7)}`,
      demographics: {
        name: `${demographics.lastName}, ${demographics.firstName}`,
        dateOfBirth: demographics.dateOfBirth,
        gender: demographics.gender || 'unknown',
        address: demographics.address ? 
          `${demographics.address.city}, ${demographics.address.state}` : 
          undefined
      }
    }];
  }

  private generateMockDocuments(qhinId: QHINIdentifier, dataElements?: string[]): TEFCADocument[] {
    const documentTypes = [
      { type: 'CCD', class: 'clinical_summary', title: 'Continuity of Care Document' },
      { type: 'Discharge_Summary', class: 'clinical_notes', title: 'Discharge Summary' },
      { type: 'Progress_Note', class: 'clinical_notes', title: 'Progress Note' },
      { type: 'Lab_Report', class: 'laboratory', title: 'Laboratory Results' },
      { type: 'Radiology_Report', class: 'imaging', title: 'Radiology Report' },
      { type: 'Pathology_Report', class: 'pathology', title: 'Pathology Report' },
      { type: 'Consultation', class: 'clinical_notes', title: 'Consultation Note' },
      { type: 'Operative_Report', class: 'procedures', title: 'Operative Report' }
    ];

    const organizations: Record<QHINIdentifier, string[]> = {
      ehealth_exchange: ['University Hospital', 'Regional Medical Center'],
      carequality: ['Metro Health System', 'Academic Medical Center'],
      commonwell: ['Community Hospital', 'Urgent Care Network'],
      carin_alliance: ['Insurance Claims System'],
      direct_trust: ['Primary Care Associates'],
      epic_nexus: ['Epic Hospital Network', 'Epic Clinic System']
    };

    const numDocs = 2 + Math.floor(Math.random() * 5);
    const documents: TEFCADocument[] = [];
    const orgs = organizations[qhinId] || ['Unknown'];

    for (let i = 0; i < numDocs; i++) {
      const docType = documentTypes[Math.floor(Math.random() * documentTypes.length)];
      const daysAgo = Math.floor(Math.random() * 365);
      
      documents.push({
        documentId: `doc_${qhinId}_${Date.now()}_${i}`,
        sourceQHIN: qhinId,
        sourceOrganization: orgs[Math.floor(Math.random() * orgs.length)],
        documentType: docType.type,
        documentClass: docType.class,
        title: docType.title,
        createdDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'application/fhir+json',
        size: 10000 + Math.floor(Math.random() * 50000),
        hash: `sha256:${Math.random().toString(36).substring(2, 34)}`,
        available: true,
        retrievalUrl: `https://api.${qhinId.replace('_', '')}.org/retrieve/${Math.random().toString(36).substring(7)}`
      });
    }

    return documents;
  }

  async retrieveDocuments(request: TEFCADocumentRetrievalRequest): Promise<TEFCADocumentRetrievalResponse> {
    const retrievalId = `ret_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const documents: RetrievedDocument[] = [];
    
    for (const docId of request.documentIds) {
      // Simulate document retrieval
      documents.push({
        documentId: docId,
        retrieved: true,
        contentType: 'application/fhir+json',
        fhirBundle: {
          resourceType: 'Bundle',
          type: 'document',
          entry: [
            {
              resource: {
                resourceType: 'Composition',
                status: 'final',
                type: { text: 'Clinical Document' }
              }
            }
          ]
        }
      });
    }

    // Log retrieval audit
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'TEFCA_DOCUMENT_RETRIEVED',
      actor: request.requestingUser,
      actorOrganization: request.requestingOrganization,
      purpose: request.purpose,
      qhinsInvolved: [],
      outcome: 'success',
      details: `Retrieved ${documents.length} documents`
    });

    return {
      retrievalId,
      queryId: request.queryId,
      documents,
      errors: []
    };
  }

  private logAuditEntry(entry: TEFCAAuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(filters?: { 
    startDate?: string; 
    endDate?: string;
    purpose?: TEFCAExchangePurpose;
    organization?: string;
  }): TEFCAAuditEntry[] {
    let log = this.auditLog;

    if (filters?.startDate) {
      log = log.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      log = log.filter(e => e.timestamp <= filters.endDate!);
    }
    if (filters?.purpose) {
      log = log.filter(e => e.purpose === filters.purpose);
    }
    if (filters?.organization) {
      log = log.filter(e => e.actorOrganization === filters.organization);
    }

    return log;
  }

  getQueryStatus(queryId: string): TEFCAQueryResponse | undefined {
    return this.activeQueries.get(queryId) || 
           this.queryHistory.find(q => q.queryId === queryId);
  }

  getQueryHistory(limit?: number): TEFCAQueryResponse[] {
    const history = [...this.queryHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  getTEFCAStatistics(): {
    totalQueries: number;
    queriesByPurpose: Record<TEFCAExchangePurpose, number>;
    queriesByQHIN: Record<QHINIdentifier, number>;
    averageResponseTime: number;
    successRate: number;
    totalDocumentsRetrieved: number;
  } {
    const stats = {
      totalQueries: this.queryHistory.length,
      queriesByPurpose: {} as Record<TEFCAExchangePurpose, number>,
      queriesByQHIN: {} as Record<QHINIdentifier, number>,
      averageResponseTime: 0,
      successRate: 0,
      totalDocumentsRetrieved: 0
    };

    let totalResponseTime = 0;
    let successfulQueries = 0;

    this.queryHistory.forEach(query => {
      // Count by purpose from audit log
      const auditEntry = query.auditTrail.find(e => e.action === 'TEFCA_QUERY_INITIATED');
      if (auditEntry) {
        stats.queriesByPurpose[auditEntry.purpose] = 
          (stats.queriesByPurpose[auditEntry.purpose] || 0) + 1;
      }

      // Count by QHIN
      query.qhinResponses.forEach(response => {
        stats.queriesByQHIN[response.qhinId] = 
          (stats.queriesByQHIN[response.qhinId] || 0) + 1;
        totalResponseTime += response.responseTime;
        stats.totalDocumentsRetrieved += response.documentCount;
      });

      if (query.status === 'completed') {
        successfulQueries++;
      }
    });

    const totalResponses = this.queryHistory.reduce(
      (sum, q) => sum + q.qhinResponses.length, 0
    );

    stats.averageResponseTime = totalResponses > 0 ? 
      totalResponseTime / totalResponses : 0;
    stats.successRate = this.queryHistory.length > 0 ? 
      (successfulQueries / this.queryHistory.length) * 100 : 0;

    return stats;
  }
  getPartnerMetrics(): Array<{
    qhinId: QHINIdentifier;
    name: string;
    status: string;
    capabilities: TEFCAExchangePurpose[];
    participantCount: number;
    certificationDate: string;
    lastHealthCheck: string;
    totalExchanges: number;
    successfulExchanges: number;
    successRate: number;
    avgLatencyMs: number;
    documentsExchanged: number;
    lastExchangeAt: string | null;
  }> {
    const connections = this.getQHINConnections();
    return connections.map(conn => {
      const exchanges = this.queryHistory.flatMap(q =>
        q.qhinResponses.filter(r => r.qhinId === conn.qhinId)
      );
      const successful = exchanges.filter(e => e.status === 'success' || e.status === 'partial');
      const totalLatency = exchanges.reduce((sum, e) => sum + e.responseTime, 0);
      const docs = exchanges.reduce((sum, e) => sum + e.documentCount, 0);
      const lastExchange = exchanges.length > 0
        ? this.queryHistory
            .filter(q => q.qhinResponses.some(r => r.qhinId === conn.qhinId))
            .sort((a, b) => (b.completedAt || b.initiatedAt).localeCompare(a.completedAt || a.initiatedAt))[0]
        : null;

      return {
        qhinId: conn.qhinId,
        name: conn.name,
        status: conn.status,
        capabilities: conn.capabilities,
        participantCount: conn.participantCount,
        certificationDate: conn.certificationDate,
        lastHealthCheck: conn.lastHealthCheck,
        totalExchanges: exchanges.length,
        successfulExchanges: successful.length,
        successRate: exchanges.length > 0 ? (successful.length / exchanges.length) * 100 : 100,
        avgLatencyMs: exchanges.length > 0 ? Math.round(totalLatency / exchanges.length) : 0,
        documentsExchanged: docs,
        lastExchangeAt: lastExchange?.completedAt || lastExchange?.initiatedAt || null,
      };
    });
  }

  getPartnerExchangeLogs(qhinId?: QHINIdentifier): Array<{
    queryId: string;
    qhinId: QHINIdentifier;
    qhinName: string;
    timestamp: string;
    status: string;
    responseTimeMs: number;
    documentsCount: number;
    matchedPatients: number;
    errorMessage?: string;
  }> {
    const logs: Array<{
      queryId: string;
      qhinId: QHINIdentifier;
      qhinName: string;
      timestamp: string;
      status: string;
      responseTimeMs: number;
      documentsCount: number;
      matchedPatients: number;
      errorMessage?: string;
    }> = [];

    for (const query of this.queryHistory) {
      const responses = qhinId
        ? query.qhinResponses.filter(r => r.qhinId === qhinId)
        : query.qhinResponses;

      for (const resp of responses) {
        const relatedError = query.errors?.find(e => e.qhinId === resp.qhinId);
        logs.push({
          queryId: query.queryId,
          qhinId: resp.qhinId,
          qhinName: resp.qhinName,
          timestamp: query.completedAt || query.initiatedAt,
          status: resp.status,
          responseTimeMs: Math.round(resp.responseTime),
          documentsCount: resp.documentCount,
          matchedPatients: resp.matchedPatients.length,
          errorMessage: relatedError?.errorMessage || (resp.status === 'error' ? 'Exchange failed' : undefined),
        });
      }

      if (query.errors) {
        for (const err of query.errors) {
          if (qhinId && err.qhinId !== qhinId) continue;
          if (!query.qhinResponses.some(r => r.qhinId === err.qhinId)) {
            logs.push({
              queryId: query.queryId,
              qhinId: err.qhinId || 'ehealth_exchange',
              qhinName: this.qhinConnections.get(err.qhinId || 'ehealth_exchange')?.name || 'Unknown',
              timestamp: err.timestamp,
              status: 'error',
              responseTimeMs: 0,
              documentsCount: 0,
              matchedPatients: 0,
              errorMessage: err.errorMessage,
            });
          }
        }
      }
    }

    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  getErrorAnalytics(): {
    totalErrors: number;
    errorsByType: Array<{ errorCode: string; count: number; severity: string; lastOccurrence: string }>;
    errorsByPartner: Array<{ qhinId: QHINIdentifier; qhinName: string; errorCount: number }>;
    errorTrend: Array<{ date: string; count: number }>;
  } {
    const allErrors: TEFCAError[] = [];
    for (const query of this.queryHistory) {
      if (query.errors) {
        allErrors.push(...query.errors);
      }
    }

    const byType = new Map<string, { count: number; severity: string; lastOccurrence: string }>();
    const byPartner = new Map<string, { qhinName: string; count: number }>();
    const byDate = new Map<string, number>();

    for (const err of allErrors) {
      const existing = byType.get(err.errorCode);
      if (existing) {
        existing.count++;
        if (err.timestamp > existing.lastOccurrence) existing.lastOccurrence = err.timestamp;
      } else {
        byType.set(err.errorCode, { count: 1, severity: err.severity, lastOccurrence: err.timestamp });
      }

      if (err.qhinId) {
        const pExisting = byPartner.get(err.qhinId);
        if (pExisting) {
          pExisting.count++;
        } else {
          byPartner.set(err.qhinId, {
            qhinName: this.qhinConnections.get(err.qhinId)?.name || 'Unknown',
            count: 1,
          });
        }
      }

      const dateKey = err.timestamp.substring(0, 10);
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);
    }

    return {
      totalErrors: allErrors.length,
      errorsByType: Array.from(byType.entries()).map(([errorCode, data]) => ({
        errorCode,
        ...data,
      })).sort((a, b) => b.count - a.count),
      errorsByPartner: Array.from(byPartner.entries()).map(([qhinId, data]) => ({
        qhinId: qhinId as QHINIdentifier,
        qhinName: data.qhinName,
        errorCount: data.count,
      })).sort((a, b) => b.errorCount - a.errorCount),
      errorTrend: Array.from(byDate.entries()).map(([date, count]) => ({
        date,
        count,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  registerPartner(data: {
    partnerId: string;
    name: string;
    endpointUrl: string;
    supportedUscdiVersions: string[];
    capabilities?: TEFCAExchangePurpose[];
  }): QHINConnection {
    if (this.qhinConnections.has(data.partnerId)) {
      throw new Error(`Partner with ID "${data.partnerId}" already exists`);
    }

    const connection: QHINConnection = {
      qhinId: data.partnerId,
      name: data.name,
      status: 'pending',
      capabilities: data.capabilities || ['treatment', 'individual_access'],
      endpoints: {
        discovery: `${data.endpointUrl}/fhir/discovery`,
        query: `${data.endpointUrl}/fhir/query`,
        retrieve: `${data.endpointUrl}/fhir/retrieve`,
      },
      certificationDate: new Date().toISOString().split('T')[0],
      lastHealthCheck: new Date().toISOString(),
      supportedFhirVersions: data.supportedUscdiVersions,
      participantCount: 0,
    };

    this.qhinConnections.set(data.partnerId, connection);

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'PARTNER_REGISTERED',
      actor: 'Admin',
      actorOrganization: 'Tabula Medica',
      purpose: 'healthcare_operations',
      qhinsInvolved: [data.partnerId],
      outcome: 'success',
      details: `Registered new QHIN partner: ${data.name} (${data.partnerId})`,
    });

    return connection;
  }

  async testPartnerConnection(partnerId: string): Promise<{
    partnerId: string;
    reachable: boolean;
    latencyMs: number;
    fhirVersion: string | null;
    error: string | null;
    testedAt: string;
  }> {
    const connection = this.qhinConnections.get(partnerId);
    if (!connection) {
      throw new Error(`Partner "${partnerId}" not found`);
    }

    const start = Date.now();
    let reachable = false;
    let fhirVersion: string | null = null;
    let error: string | null = null;

    try {
      const url = new URL(connection.endpoints.discovery);
      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new Error('Only HTTP/HTTPS protocols are allowed');
      }
      const hostname = url.hostname;
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,
        /^\[::1\]$/,
        /^metadata\.google\.internal$/i,
      ];
      if (blockedPatterns.some(p => p.test(hostname))) {
        throw new Error('Connection to private/internal addresses is not allowed');
      }

      const response = await fetch(connection.endpoints.discovery, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      });
      reachable = response.ok || response.status === 401 || response.status === 403;
      if (reachable) {
        fhirVersion = connection.supportedFhirVersions[0] || 'R4';
      }
    } catch (err) {
      reachable = false;
      error = err instanceof Error ? err.message : 'Connection failed';
    }

    const latencyMs = Date.now() - start;

    connection.lastHealthCheck = new Date().toISOString();

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'PARTNER_CONNECTION_TEST',
      actor: 'Admin',
      actorOrganization: 'Tabula Medica',
      purpose: 'healthcare_operations',
      qhinsInvolved: [partnerId],
      outcome: reachable ? 'success' : 'failure',
      details: `Connection test for ${connection.name}: ${reachable ? 'reachable' : error}`,
    });

    return {
      partnerId,
      reachable,
      latencyMs,
      fhirVersion,
      error,
      testedAt: new Date().toISOString(),
    };
  }

  togglePartnerStatus(partnerId: string, enabled: boolean): QHINConnection {
    const connection = this.qhinConnections.get(partnerId);
    if (!connection) {
      throw new Error(`Partner "${partnerId}" not found`);
    }

    connection.status = enabled ? 'active' : 'inactive';

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: enabled ? 'PARTNER_ENABLED' : 'PARTNER_DISABLED',
      actor: 'Admin',
      actorOrganization: 'Tabula Medica',
      purpose: 'healthcare_operations',
      qhinsInvolved: [partnerId],
      outcome: 'success',
      details: `Partner ${connection.name} ${enabled ? 'enabled' : 'disabled'}`,
    });

    return connection;
  }

  deletePartner(partnerId: string): boolean {
    const connection = this.qhinConnections.get(partnerId);
    if (!connection) {
      throw new Error(`Partner "${partnerId}" not found`);
    }

    this.qhinConnections.delete(partnerId);

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      action: 'PARTNER_DELETED',
      actor: 'Admin',
      actorOrganization: 'Tabula Medica',
      purpose: 'healthcare_operations',
      qhinsInvolved: [partnerId],
      outcome: 'success',
      details: `Deleted QHIN partner: ${connection.name}`,
    });

    return true;
  }

  seedSampleExchangeHistory(): void {
    if (this.queryHistory.length > 0) return;

    const purposes: TEFCAExchangePurpose[] = ['treatment', 'individual_access', 'payment', 'healthcare_operations', 'public_health'];
    const qhinIds: QHINIdentifier[] = ['ehealth_exchange', 'carequality', 'commonwell', 'carin_alliance', 'direct_trust', 'epic_nexus'];

    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const hoursAgo = Math.floor(Math.random() * 24);
      const timestamp = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);
      const selectedQhins = qhinIds.filter(() => Math.random() > 0.4);
      if (selectedQhins.length === 0) selectedQhins.push(qhinIds[0]);
      const purpose = purposes[Math.floor(Math.random() * purposes.length)];

      const qhinResponses: QHINQueryResult[] = selectedQhins.map(qId => {
        const isError = Math.random() < 0.08;
        const isTimeout = Math.random() < 0.05;
        const latency = 50 + Math.random() * 450 + (isTimeout ? 5000 : 0);
        const conn = this.qhinConnections.get(qId)!;
        const docCount = isError ? 0 : 2 + Math.floor(Math.random() * 6);
        return {
          qhinId: qId,
          qhinName: conn.name,
          status: (isError ? 'error' : isTimeout ? 'timeout' : 'success') as 'success' | 'error' | 'timeout',
          responseTime: latency,
          matchedPatients: isError ? [] : [{
            matchId: `m_${i}_${qId}`,
            confidence: 0.85 + Math.random() * 0.14,
            matchAlgorithm: 'TEFCA-MPI-v2',
            sourceSystem: conn.name,
            patientId: `p_${Math.random().toString(36).substring(7)}`,
            demographics: { name: 'Patient Record', dateOfBirth: '1980-01-01', gender: 'unknown' },
          }],
          documentCount: docCount,
          documents: Array.from({ length: docCount }, (_, di) => ({
            documentId: `doc_${i}_${qId}_${di}`,
            sourceQHIN: qId,
            sourceOrganization: conn.name,
            documentType: ['CCD', 'Lab_Report', 'Progress_Note', 'Discharge_Summary'][Math.floor(Math.random() * 4)],
            documentClass: 'clinical',
            title: 'Clinical Document',
            createdDate: timestamp.toISOString(),
            contentType: 'application/fhir+json',
            size: 5000 + Math.floor(Math.random() * 50000),
            hash: `sha256:${Math.random().toString(36).substring(2)}`,
            available: true,
          })),
        };
      });

      const errors: TEFCAError[] = qhinResponses
        .filter(r => r.status === 'error' || r.status === 'timeout')
        .map(r => ({
          qhinId: r.qhinId,
          errorCode: r.status === 'timeout' ? 'QHIN_TIMEOUT' : ['QHIN_QUERY_ERROR', 'AUTHENTICATION_FAILED', 'RATE_LIMIT_EXCEEDED', 'INVALID_REQUEST', 'SERVICE_UNAVAILABLE'][Math.floor(Math.random() * 5)],
          errorMessage: r.status === 'timeout' ? 'Request timed out after 5000ms' : ['Query processing failed', 'Authentication token expired', 'Rate limit exceeded', 'Invalid patient demographics', 'Service temporarily unavailable'][Math.floor(Math.random() * 5)],
          severity: (r.status === 'timeout' ? 'warning' : 'error') as 'warning' | 'error',
          recoverable: true,
          timestamp: timestamp.toISOString(),
        }));

      const hasSuccessful = qhinResponses.some(r => r.status === 'success');
      const queryResponse: TEFCAQueryResponse = {
        queryId: `tefca_seed_${i}`,
        requestId: `req_${i}`,
        status: errors.length > 0 ? (hasSuccessful ? 'partial' : 'failed') : 'completed',
        initiatedAt: timestamp.toISOString(),
        completedAt: new Date(timestamp.getTime() + Math.max(...qhinResponses.map(r => r.responseTime))).toISOString(),
        qhinResponses,
        aggregatedResults: {
          totalQHINsQueried: selectedQhins.length,
          totalQHINsResponded: qhinResponses.filter(r => r.status === 'success').length,
          totalPatientMatches: qhinResponses.reduce((s, r) => s + r.matchedPatients.length, 0),
          totalDocuments: qhinResponses.reduce((s, r) => s + r.documentCount, 0),
          documentsByType: {},
          sourceOrganizations: [],
          uniqueDataElements: [],
          overallConfidence: 0.92,
        },
        errors: errors.length > 0 ? errors : undefined,
        auditTrail: [{
          timestamp: timestamp.toISOString(),
          action: 'TEFCA_QUERY_INITIATED',
          actor: 'System',
          actorOrganization: 'Tabula Medica',
          purpose,
          qhinsInvolved: selectedQhins,
          outcome: 'success',
          details: `Query for ${purpose}`,
        }],
      };

      this.queryHistory.push(queryResponse);
    }
  }
}

export const tefcaFrameworkService = new TEFCAFrameworkService();
