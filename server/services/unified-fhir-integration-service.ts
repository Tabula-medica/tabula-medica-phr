/**
 * Unified FHIR API Integration Service
 * 
 * Implements HL7 FHIR R4 standard for connecting to major EHR systems:
 * - Fasten Health
 * - Hospital Network
 * - Healthcare Provider
 * 
 * Uses SMART on FHIR OAuth 2.0 + PKCE for secure authorization
 */

import crypto from 'crypto';

// FHIR R4 Resource Types
export type FHIRResourceType = 
  | 'Patient'
  | 'Observation'
  | 'Condition'
  | 'MedicationRequest'
  | 'AllergyIntolerance'
  | 'Immunization'
  | 'DiagnosticReport'
  | 'Encounter'
  | 'Procedure'
  | 'DocumentReference'
  | 'CarePlan'
  | 'Goal'
  | 'CareTeam';

// Supported EHR Systems
export type EHRSystem = 'epic' | 'cerner' | 'allscripts' | 'healthcare-provider' | 'meditech';

// EHR System Configuration
export interface EHRSystemConfig {
  id: string;
  name: string;
  type: EHRSystem;
  fhirBaseUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  supportedResources: FHIRResourceType[];
  version: 'R4' | 'R5';
  isActive: boolean;
}

// SMART on FHIR Authorization State
export interface SMARTAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  ehrSystemId: string;
  redirectUri: string;
  patientId?: string;
  expiresAt: Date;
}

// OAuth Token Response
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
  patientId?: string;
  issuedAt: Date;
}

// FHIR Bundle Response
export interface FHIRBundle<T> {
  resourceType: 'Bundle';
  type: 'searchset' | 'collection' | 'batch-response';
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry?: Array<{
    fullUrl?: string;
    resource: T;
    search?: {
      mode: 'match' | 'include';
    };
  }>;
}

// Patient Demographics
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
    type?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
  }>;
  name: Array<{
    use?: string;
    family: string;
    given: string[];
    prefix?: string[];
    suffix?: string[];
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax';
    value: string;
    use?: string;
  }>;
}

// Connection Status
export interface EHRConnectionStatus {
  ehrSystemId: string;
  patientId: string;
  connected: boolean;
  lastSync?: Date;
  syncStatus: 'idle' | 'syncing' | 'error' | 'completed';
  resourceCounts: Record<FHIRResourceType, number>;
  errorMessage?: string;
}

// Unified Health Record from all sources
export interface UnifiedHealthRecord {
  patientId: string;
  sources: Array<{
    ehrSystemId: string;
    ehrSystemName: string;
    connectedAt: Date;
    lastSync: Date;
  }>;
  demographics: FHIRPatient;
  conditions: any[];
  medications: any[];
  allergies: any[];
  immunizations: any[];
  labResults: any[];
  vitalSigns: any[];
  encounters: any[];
  procedures: any[];
  documents: any[];
}

class UnifiedFHIRIntegrationService {
  private ehrSystems: Map<string, EHRSystemConfig> = new Map();
  private authStates: Map<string, SMARTAuthState> = new Map();
  private patientConnections: Map<string, Map<string, OAuthTokens>> = new Map();
  private connectionStatus: Map<string, EHRConnectionStatus> = new Map();

  constructor() {
    this.initializeEHRSystems();
    console.log('[UnifiedFHIR] Service initialized');
    console.log('[UnifiedFHIR] Supported systems: Fasten Health, Healthcare Provider, athenahealth, MEDITECH');
    console.log('[UnifiedFHIR] FHIR version: R4');
  }

  private initializeEHRSystems(): void {
    // Fasten Health Configuration
    this.ehrSystems.set('epic-mychart', {
      id: 'epic-mychart',
      name: 'Fasten Health',
      type: 'epic',
      fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
      authorizationEndpoint: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      tokenEndpoint: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      clientId: process.env.EPIC_CLIENT_ID || 'tabula-medica-epic',
      scopes: [
        'openid',
        'fhirUser',
        'patient/*.read',
        'launch/patient',
        'offline_access'
      ],
      supportedResources: [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
        'Encounter', 'Procedure', 'DocumentReference', 'CarePlan', 'Goal'
      ],
      version: 'R4',
      isActive: true
    });

    // Hospital Network Configuration
    this.ehrSystems.set('cerner', {
      id: 'cerner',
      name: 'Hospital Network',
      type: 'cerner',
      fhirBaseUrl: 'https://fhir-myrecord.cerner.com/r4',
      authorizationEndpoint: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
      tokenEndpoint: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
      clientId: process.env.CERNER_CLIENT_ID || 'tabula-medica-cerner',
      scopes: [
        'openid',
        'fhirUser',
        'patient/Patient.read',
        'patient/Observation.read',
        'patient/Condition.read',
        'patient/MedicationRequest.read',
        'patient/AllergyIntolerance.read',
        'patient/Immunization.read',
        'offline_access'
      ],
      supportedResources: [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
        'Encounter', 'Procedure', 'DocumentReference'
      ],
      version: 'R4',
      isActive: true
    });

    // Healthcare Provider Configuration
    this.ehrSystems.set('allscripts', {
      id: 'allscripts',
      name: 'Healthcare Provider',
      type: 'allscripts',
      fhirBaseUrl: 'https://api.allscripts.com/fhir/r4',
      authorizationEndpoint: 'https://api.allscripts.com/oauth2/authorize',
      tokenEndpoint: 'https://api.allscripts.com/oauth2/token',
      clientId: process.env.ALLSCRIPTS_CLIENT_ID || 'tabula-medica-allscripts',
      scopes: [
        'openid',
        'patient/*.read',
        'launch/patient',
        'offline_access'
      ],
      supportedResources: [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
        'Encounter', 'Procedure'
      ],
      version: 'R4',
      isActive: true
    });

    // athenahealth Configuration
    this.ehrSystems.set('healthcare-provider', {
      id: 'healthcare-provider',
      name: 'healthcare-provider',
      type: 'healthcare-provider',
      fhirBaseUrl: 'https://api.platform.athenahealth.com/fhir/r4',
      authorizationEndpoint: 'https://api.platform.athenahealth.com/oauth2/v1/authorize',
      tokenEndpoint: 'https://api.platform.athenahealth.com/oauth2/v1/token',
      clientId: process.env.ATHENA_CLIENT_ID || 'tabula-medica-athena',
      scopes: [
        'openid',
        'patient/*.read',
        'launch/patient',
        'offline_access'
      ],
      supportedResources: [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
        'Encounter', 'Procedure'
      ],
      version: 'R4',
      isActive: true
    });

    // MEDITECH Configuration
    this.ehrSystems.set('meditech', {
      id: 'meditech',
      name: 'MEDITECH',
      type: 'meditech',
      fhirBaseUrl: 'https://api.meditech.com/fhir/r4',
      authorizationEndpoint: 'https://api.meditech.com/oauth2/authorize',
      tokenEndpoint: 'https://api.meditech.com/oauth2/token',
      clientId: process.env.MEDITECH_CLIENT_ID || 'tabula-medica-meditech',
      scopes: [
        'openid',
        'patient/*.read',
        'launch/patient',
        'offline_access'
      ],
      supportedResources: [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
        'Encounter'
      ],
      version: 'R4',
      isActive: true
    });
  }

  /**
   * Get all available EHR systems
   */
  getAvailableEHRSystems(): EHRSystemConfig[] {
    return Array.from(this.ehrSystems.values()).filter(sys => sys.isActive);
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Initiate SMART on FHIR authorization flow
   */
  initiateAuthorization(
    ehrSystemId: string,
    redirectUri: string,
    patientId?: string
  ): { authorizationUrl: string; state: string } {
    const ehrSystem = this.ehrSystems.get(ehrSystemId);
    if (!ehrSystem) {
      throw new Error(`Unknown EHR system: ${ehrSystemId}`);
    }

    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = this.generatePKCE();

    // Store authorization state
    this.authStates.set(state, {
      state,
      codeVerifier,
      codeChallenge,
      ehrSystemId,
      redirectUri,
      patientId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: ehrSystem.clientId,
      redirect_uri: redirectUri,
      scope: ehrSystem.scopes.join(' '),
      state,
      aud: ehrSystem.fhirBaseUrl,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authorizationUrl = `${ehrSystem.authorizationEndpoint}?${params.toString()}`;

    console.log(`[UnifiedFHIR] Authorization initiated for ${ehrSystem.name}`);
    
    return { authorizationUrl, state };
  }

  /**
   * Complete authorization by exchanging code for tokens
   */
  async completeAuthorization(
    code: string,
    state: string
  ): Promise<{ success: boolean; patientId?: string; ehrSystemId?: string; error?: string }> {
    const authState = this.authStates.get(state);
    if (!authState) {
      return { success: false, error: 'Invalid or expired authorization state' };
    }

    if (new Date() > authState.expiresAt) {
      this.authStates.delete(state);
      return { success: false, error: 'Authorization state expired' };
    }

    const ehrSystem = this.ehrSystems.get(authState.ehrSystemId);
    if (!ehrSystem) {
      return { success: false, error: 'EHR system not found' };
    }

    try {
      // Exchange code for tokens (simulated)
      const tokens: OAuthTokens = {
        accessToken: crypto.randomBytes(32).toString('hex'),
        refreshToken: crypto.randomBytes(32).toString('hex'),
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: ehrSystem.scopes.join(' '),
        patientId: authState.patientId || `patient-${crypto.randomBytes(8).toString('hex')}`,
        issuedAt: new Date()
      };

      // Store patient connection
      const patientId = tokens.patientId!;
      if (!this.patientConnections.has(patientId)) {
        this.patientConnections.set(patientId, new Map());
      }
      this.patientConnections.get(patientId)!.set(authState.ehrSystemId, tokens);

      // Initialize connection status
      const statusKey = `${patientId}-${authState.ehrSystemId}`;
      this.connectionStatus.set(statusKey, {
        ehrSystemId: authState.ehrSystemId,
        patientId,
        connected: true,
        lastSync: new Date(),
        syncStatus: 'idle',
        resourceCounts: {} as Record<FHIRResourceType, number>
      });

      // Clean up auth state
      this.authStates.delete(state);

      console.log(`[UnifiedFHIR] Authorization completed for ${ehrSystem.name}, patient: ${patientId}`);

      return {
        success: true,
        patientId,
        ehrSystemId: authState.ehrSystemId
      };
    } catch (error) {
      console.error(`[UnifiedFHIR] Token exchange failed:`, error);
      return { success: false, error: 'Token exchange failed' };
    }
  }

  /**
   * Fetch FHIR resources from connected EHR
   */
  async fetchResources<T>(
    patientId: string,
    ehrSystemId: string,
    resourceType: FHIRResourceType,
    params?: Record<string, string>
  ): Promise<FHIRBundle<T>> {
    const tokens = this.patientConnections.get(patientId)?.get(ehrSystemId);
    if (!tokens) {
      throw new Error(`Patient ${patientId} not connected to ${ehrSystemId}`);
    }

    const ehrSystem = this.ehrSystems.get(ehrSystemId);
    if (!ehrSystem) {
      throw new Error(`Unknown EHR system: ${ehrSystemId}`);
    }

    // Simulated FHIR data based on resource type
    const mockData = this.generateMockFHIRData(resourceType, patientId);

    // Update connection status
    const statusKey = `${patientId}-${ehrSystemId}`;
    const status = this.connectionStatus.get(statusKey);
    if (status) {
      status.lastSync = new Date();
      status.resourceCounts[resourceType] = mockData.total || 0;
    }

    console.log(`[UnifiedFHIR] Fetched ${resourceType} from ${ehrSystem.name} for patient ${patientId}`);

    return mockData as FHIRBundle<T>;
  }

  /**
   * Sync all patient data from a connected EHR
   */
  async syncPatientData(
    patientId: string,
    ehrSystemId: string
  ): Promise<{ success: boolean; resourcesSynced: number; errors: string[] }> {
    const ehrSystem = this.ehrSystems.get(ehrSystemId);
    if (!ehrSystem) {
      return { success: false, resourcesSynced: 0, errors: ['EHR system not found'] };
    }

    const statusKey = `${patientId}-${ehrSystemId}`;
    const status = this.connectionStatus.get(statusKey);
    if (status) {
      status.syncStatus = 'syncing';
    }

    const errors: string[] = [];
    let resourcesSynced = 0;

    try {
      for (const resourceType of ehrSystem.supportedResources) {
        try {
          const bundle = await this.fetchResources(patientId, ehrSystemId, resourceType);
          resourcesSynced += bundle.total || bundle.entry?.length || 0;
        } catch (error) {
          errors.push(`Failed to sync ${resourceType}: ${error}`);
        }
      }

      if (status) {
        status.syncStatus = errors.length > 0 ? 'error' : 'completed';
        status.lastSync = new Date();
        status.errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
      }

      console.log(`[UnifiedFHIR] Sync completed for ${ehrSystem.name}: ${resourcesSynced} resources`);

      return {
        success: errors.length === 0,
        resourcesSynced,
        errors
      };
    } catch (error) {
      if (status) {
        status.syncStatus = 'error';
        status.errorMessage = `Sync failed: ${error}`;
      }
      return { success: false, resourcesSynced: 0, errors: [`Sync failed: ${error}`] };
    }
  }

  /**
   * Get connection status for patient
   */
  getPatientConnections(patientId: string): EHRConnectionStatus[] {
    const connections: EHRConnectionStatus[] = [];
    
    for (const [key, status] of this.connectionStatus.entries()) {
      if (key.startsWith(`${patientId}-`)) {
        connections.push(status);
      }
    }

    return connections;
  }

  /**
   * Disconnect patient from EHR
   */
  disconnectEHR(patientId: string, ehrSystemId: string): boolean {
    const patientConns = this.patientConnections.get(patientId);
    if (patientConns) {
      patientConns.delete(ehrSystemId);
    }

    const statusKey = `${patientId}-${ehrSystemId}`;
    this.connectionStatus.delete(statusKey);

    console.log(`[UnifiedFHIR] Disconnected patient ${patientId} from ${ehrSystemId}`);
    return true;
  }

  /**
   * Get unified health record combining all connected EHRs
   */
  async getUnifiedHealthRecord(patientId: string): Promise<UnifiedHealthRecord> {
    const connections = this.getPatientConnections(patientId);
    
    const unifiedRecord: UnifiedHealthRecord = {
      patientId,
      sources: connections.map(conn => ({
        ehrSystemId: conn.ehrSystemId,
        ehrSystemName: this.ehrSystems.get(conn.ehrSystemId)?.name || conn.ehrSystemId,
        connectedAt: conn.lastSync || new Date(),
        lastSync: conn.lastSync || new Date()
      })),
      demographics: this.generateMockPatient(patientId),
      conditions: [],
      medications: [],
      allergies: [],
      immunizations: [],
      labResults: [],
      vitalSigns: [],
      encounters: [],
      procedures: [],
      documents: []
    };

    // Aggregate data from all connected EHRs
    for (const conn of connections) {
      try {
        const conditions = await this.fetchResources(patientId, conn.ehrSystemId, 'Condition');
        unifiedRecord.conditions.push(...(conditions.entry?.map(e => ({
          ...e.resource,
          source: conn.ehrSystemId
        })) || []));

        const medications = await this.fetchResources(patientId, conn.ehrSystemId, 'MedicationRequest');
        unifiedRecord.medications.push(...(medications.entry?.map(e => ({
          ...e.resource,
          source: conn.ehrSystemId
        })) || []));

        const allergies = await this.fetchResources(patientId, conn.ehrSystemId, 'AllergyIntolerance');
        unifiedRecord.allergies.push(...(allergies.entry?.map(e => ({
          ...e.resource,
          source: conn.ehrSystemId
        })) || []));
      } catch (error) {
        console.error(`[UnifiedFHIR] Error aggregating data from ${conn.ehrSystemId}:`, error);
      }
    }

    console.log(`[UnifiedFHIR] Generated unified health record for patient ${patientId}`);
    return unifiedRecord;
  }

  /**
   * Generate mock FHIR data for sample purposes
   */
  private generateMockFHIRData(resourceType: FHIRResourceType, patientId: string): FHIRBundle<any> {
    const baseBundle: FHIRBundle<any> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: []
    };

    switch (resourceType) {
      case 'Condition':
        baseBundle.total = 3;
        baseBundle.entry = [
          {
            resource: {
              resourceType: 'Condition',
              id: `cond-${crypto.randomBytes(4).toString('hex')}`,
              clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
              code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 diabetes mellitus' }] },
              subject: { reference: `Patient/${patientId}` },
              onsetDateTime: '2020-03-15'
            }
          },
          {
            resource: {
              resourceType: 'Condition',
              id: `cond-${crypto.randomBytes(4).toString('hex')}`,
              clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
              code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Essential hypertension' }] },
              subject: { reference: `Patient/${patientId}` },
              onsetDateTime: '2018-06-20'
            }
          },
          {
            resource: {
              resourceType: 'Condition',
              id: `cond-${crypto.randomBytes(4).toString('hex')}`,
              clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'resolved' }] },
              code: { coding: [{ system: 'http://snomed.info/sct', code: '195662009', display: 'Acute viral pharyngitis' }] },
              subject: { reference: `Patient/${patientId}` },
              onsetDateTime: '2023-12-01',
              abatementDateTime: '2023-12-10'
            }
          }
        ];
        break;

      case 'MedicationRequest':
        baseBundle.total = 2;
        baseBundle.entry = [
          {
            resource: {
              resourceType: 'MedicationRequest',
              id: `med-${crypto.randomBytes(4).toString('hex')}`,
              status: 'active',
              intent: 'order',
              medicationCodeableConcept: {
                coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin 500 MG Oral Tablet' }]
              },
              subject: { reference: `Patient/${patientId}` },
              authoredOn: '2020-03-15',
              dosageInstruction: [{ text: 'Take 1 tablet by mouth twice daily' }]
            }
          },
          {
            resource: {
              resourceType: 'MedicationRequest',
              id: `med-${crypto.randomBytes(4).toString('hex')}`,
              status: 'active',
              intent: 'order',
              medicationCodeableConcept: {
                coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '314076', display: 'Lisinopril 10 MG Oral Tablet' }]
              },
              subject: { reference: `Patient/${patientId}` },
              authoredOn: '2018-06-20',
              dosageInstruction: [{ text: 'Take 1 tablet by mouth once daily' }]
            }
          }
        ];
        break;

      case 'AllergyIntolerance':
        baseBundle.total = 1;
        baseBundle.entry = [
          {
            resource: {
              resourceType: 'AllergyIntolerance',
              id: `allergy-${crypto.randomBytes(4).toString('hex')}`,
              clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
              type: 'allergy',
              category: ['medication'],
              criticality: 'high',
              code: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7984', display: 'Penicillin' }] },
              patient: { reference: `Patient/${patientId}` },
              reaction: [{ manifestation: [{ coding: [{ display: 'Anaphylaxis' }] }], severity: 'severe' }]
            }
          }
        ];
        break;

      case 'Observation':
        baseBundle.total = 4;
        baseBundle.entry = [
          {
            resource: {
              resourceType: 'Observation',
              id: `obs-${crypto.randomBytes(4).toString('hex')}`,
              status: 'final',
              category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
              code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
              subject: { reference: `Patient/${patientId}` },
              effectiveDateTime: new Date().toISOString(),
              valueQuantity: { value: 72, unit: 'beats/minute', system: 'http://unitsofmeasure.org', code: '/min' }
            }
          },
          {
            resource: {
              resourceType: 'Observation',
              id: `obs-${crypto.randomBytes(4).toString('hex')}`,
              status: 'final',
              category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
              code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] },
              subject: { reference: `Patient/${patientId}` },
              effectiveDateTime: new Date().toISOString(),
              component: [
                { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] }, valueQuantity: { value: 120, unit: 'mmHg' } },
                { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] }, valueQuantity: { value: 80, unit: 'mmHg' } }
              ]
            }
          },
          {
            resource: {
              resourceType: 'Observation',
              id: `obs-${crypto.randomBytes(4).toString('hex')}`,
              status: 'final',
              category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
              code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }] },
              subject: { reference: `Patient/${patientId}` },
              effectiveDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              valueQuantity: { value: 6.8, unit: '%', system: 'http://unitsofmeasure.org', code: '%' }
            }
          },
          {
            resource: {
              resourceType: 'Observation',
              id: `obs-${crypto.randomBytes(4).toString('hex')}`,
              status: 'final',
              category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
              code: { coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body weight' }] },
              subject: { reference: `Patient/${patientId}` },
              effectiveDateTime: new Date().toISOString(),
              valueQuantity: { value: 82, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' }
            }
          }
        ];
        break;

      case 'Immunization':
        baseBundle.total = 2;
        baseBundle.entry = [
          {
            resource: {
              resourceType: 'Immunization',
              id: `imm-${crypto.randomBytes(4).toString('hex')}`,
              status: 'completed',
              vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '208', display: 'COVID-19 mRNA Vaccine' }] },
              patient: { reference: `Patient/${patientId}` },
              occurrenceDateTime: '2023-10-15',
              lotNumber: 'FL1234567',
              doseQuantity: { value: 0.5, unit: 'mL' }
            }
          },
          {
            resource: {
              resourceType: 'Immunization',
              id: `imm-${crypto.randomBytes(4).toString('hex')}`,
              status: 'completed',
              vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '140', display: 'Influenza, seasonal, injectable' }] },
              patient: { reference: `Patient/${patientId}` },
              occurrenceDateTime: '2023-10-01',
              lotNumber: 'FLU2023890',
              doseQuantity: { value: 0.5, unit: 'mL' }
            }
          }
        ];
        break;

      default:
        baseBundle.total = 0;
        baseBundle.entry = [];
    }

    return baseBundle;
  }

  /**
   * Generate mock patient data
   */
  private generateMockPatient(patientId: string): FHIRPatient {
    return {
      resourceType: 'Patient',
      id: patientId,
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-ssn',
          value: '***-**-1234',
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'SS', display: 'Social Security Number' }] }
        }
      ],
      name: [{
        use: 'official',
        family: 'Smith',
        given: ['John', 'Robert']
      }],
      gender: 'male',
      birthDate: '1985-06-15',
      address: [{
        use: 'home',
        line: ['123 Main Street'],
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'USA'
      }],
      telecom: [
        { system: 'phone', value: '555-123-4567', use: 'mobile' },
        { system: 'email', value: 'john.smith@example.com', use: 'home' }
      ]
    };
  }

  /**
   * Get dashboard statistics
   */
  getDashboard(): {
    totalConnections: number;
    activeEHRSystems: number;
    lastSyncTime: Date | null;
    resourceTypeCounts: Record<FHIRResourceType, number>;
  } {
    const totalConnections = this.connectionStatus.size;
    const activeEHRSystems = this.ehrSystems.size;
    
    let lastSyncTime: Date | null = null;
    const resourceTypeCounts: Record<FHIRResourceType, number> = {} as any;

    for (const status of this.connectionStatus.values()) {
      if (!lastSyncTime || (status.lastSync && status.lastSync > lastSyncTime)) {
        lastSyncTime = status.lastSync || null;
      }
      
      for (const [resourceType, count] of Object.entries(status.resourceCounts)) {
        resourceTypeCounts[resourceType as FHIRResourceType] = 
          (resourceTypeCounts[resourceType as FHIRResourceType] || 0) + count;
      }
    }

    return {
      totalConnections,
      activeEHRSystems,
      lastSyncTime,
      resourceTypeCounts
    };
  }
}

export const unifiedFHIRIntegrationService = new UnifiedFHIRIntegrationService();
