/**
 * Health Data Aggregator Service
 * 
 * Integrates with health data aggregation platforms:
 * - 1upHealth - "Plaid for Healthcare"
 * - Human API
 * 
 * Enables patients to connect their provider portals:
 * - Quest Diagnostics
 * - CVS/Caremark
 * - Hospital systems
 * - Insurance portals
 * - Pharmacy benefits
 */

import crypto from 'crypto';

// Supported Aggregator Platforms
export type AggregatorPlatform = '1uphealth' | 'humanapi';

// Health Data Source Types
export type HealthDataSourceType =
  | 'laboratory'
  | 'pharmacy'
  | 'hospital'
  | 'insurance'
  | 'imaging'
  | 'primary_care'
  | 'specialty'
  | 'urgent_care'
  | 'retail_clinic';

// Available Health Data Sources (Provider Portals)
export interface HealthDataSource {
  id: string;
  name: string;
  type: HealthDataSourceType;
  logoUrl: string;
  supportedDataTypes: string[];
  aggregatorPlatform: AggregatorPlatform;
  isPopular: boolean;
  connectionInstructions?: string;
}

// Patient Connection to a Data Source
export interface PatientDataConnection {
  id: string;
  patientId: string;
  dataSourceId: string;
  dataSourceName: string;
  aggregatorPlatform: AggregatorPlatform;
  status: 'pending' | 'connected' | 'disconnected' | 'error' | 'refreshing';
  connectedAt?: Date;
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'completed' | 'failed';
  dataTypesAvailable: string[];
  recordCount: number;
  errorMessage?: string;
}

// Aggregated Lab Result
export interface AggregatedLabResult {
  id: string;
  patientId: string;
  sourceId: string;
  sourceName: string;
  testName: string;
  testCode?: string;
  testCodeSystem?: string;
  value: string | number;
  unit?: string;
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  status: 'final' | 'preliminary' | 'corrected';
  collectedAt: Date;
  reportedAt: Date;
  category: string;
  interpretation?: 'normal' | 'abnormal' | 'critical';
}

// Aggregated Medication/Pharmacy Data
export interface AggregatedMedication {
  id: string;
  patientId: string;
  sourceId: string;
  sourceName: string;
  medicationName: string;
  genericName?: string;
  rxNormCode?: string;
  ndc?: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  prescribedDate: Date;
  lastFilledDate?: Date;
  refillsRemaining?: number;
  daysSupply?: number;
  pharmacy?: string;
  prescriber?: string;
  status: 'active' | 'discontinued' | 'on-hold';
}

// Aggregated Claims Data
export interface AggregatedClaim {
  id: string;
  patientId: string;
  sourceId: string;
  sourceName: string;
  claimNumber: string;
  claimType: 'medical' | 'pharmacy' | 'dental' | 'vision';
  serviceDate: Date;
  providerName: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  billedAmount: number;
  allowedAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  status: 'processed' | 'pending' | 'denied';
}

// 1upHealth API Configuration
interface OneUpHealthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  authUrl: string;
}

// OAuth State for aggregator connections
interface AggregatorAuthState {
  state: string;
  patientId: string;
  dataSourceId: string;
  platform: AggregatorPlatform;
  redirectUri: string;
  expiresAt: Date;
}

class HealthDataAggregatorService {
  private dataSources: Map<string, HealthDataSource> = new Map();
  private patientConnections: Map<string, PatientDataConnection[]> = new Map();
  private authStates: Map<string, AggregatorAuthState> = new Map();
  private labResults: Map<string, AggregatedLabResult[]> = new Map();
  private medications: Map<string, AggregatedMedication[]> = new Map();
  private claims: Map<string, AggregatedClaim[]> = new Map();

  private oneUpConfig: OneUpHealthConfig;

  constructor() {
    this.oneUpConfig = {
      clientId: process.env.ONEUP_CLIENT_ID || 'tabula-medica-1up',
      clientSecret: process.env.ONEUP_CLIENT_SECRET || '',
      baseUrl: 'https://api.1up.health/fhir/dstu2',
      authUrl: 'https://api.1up.health/connect'
    };

    this.initializeDataSources();
    console.log('[HealthAggregator] Service initialized');
    console.log('[HealthAggregator] Supported platforms: 1upHealth, Human API');
    console.log(`[HealthAggregator] Available data sources: ${this.dataSources.size}`);
  }

  private initializeDataSources(): void {
    // Laboratory Providers
    this.dataSources.set('quest-diagnostics', {
      id: 'quest-diagnostics',
      name: 'Quest Diagnostics',
      type: 'laboratory',
      logoUrl: '/images/providers/quest.png',
      supportedDataTypes: ['lab-results', 'diagnostic-reports'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your Quest MyQuest portal credentials'
    });

    this.dataSources.set('labcorp', {
      id: 'labcorp',
      name: 'LabCorp',
      type: 'laboratory',
      logoUrl: '/images/providers/labcorp.png',
      supportedDataTypes: ['lab-results', 'diagnostic-reports'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your LabCorp patient portal credentials'
    });

    // Pharmacy Providers
    this.dataSources.set('cvs-caremark', {
      id: 'cvs-caremark',
      name: 'CVS Caremark',
      type: 'pharmacy',
      logoUrl: '/images/providers/cvs.png',
      supportedDataTypes: ['medications', 'pharmacy-claims', 'immunizations'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your CVS.com account credentials'
    });

    this.dataSources.set('walgreens', {
      id: 'walgreens',
      name: 'Walgreens',
      type: 'pharmacy',
      logoUrl: '/images/providers/walgreens.png',
      supportedDataTypes: ['medications', 'pharmacy-claims', 'immunizations'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your Walgreens.com account credentials'
    });

    this.dataSources.set('express-scripts', {
      id: 'express-scripts',
      name: 'Express Scripts',
      type: 'pharmacy',
      logoUrl: '/images/providers/express-scripts.png',
      supportedDataTypes: ['medications', 'pharmacy-claims'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your Express Scripts portal credentials'
    });

    // Hospital Systems
    this.dataSources.set('kaiser-permanente', {
      id: 'kaiser-permanente',
      name: 'Kaiser Permanente',
      type: 'hospital',
      logoUrl: '/images/providers/kaiser.png',
      supportedDataTypes: ['clinical-notes', 'lab-results', 'medications', 'immunizations', 'encounters'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your Kaiser kp.org account credentials'
    });

    this.dataSources.set('cleveland-clinic', {
      id: 'cleveland-clinic',
      name: 'Cleveland Clinic',
      type: 'hospital',
      logoUrl: '/images/providers/cleveland-clinic.png',
      supportedDataTypes: ['clinical-notes', 'lab-results', 'medications', 'immunizations', 'encounters'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    this.dataSources.set('mayo-clinic', {
      id: 'mayo-clinic',
      name: 'Mayo Clinic',
      type: 'hospital',
      logoUrl: '/images/providers/mayo-clinic.png',
      supportedDataTypes: ['clinical-notes', 'lab-results', 'medications', 'imaging', 'encounters'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    this.dataSources.set('johns-hopkins', {
      id: 'johns-hopkins',
      name: 'Johns Hopkins Medicine',
      type: 'hospital',
      logoUrl: '/images/providers/johns-hopkins.png',
      supportedDataTypes: ['clinical-notes', 'lab-results', 'medications', 'encounters'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    // Insurance Providers
    this.dataSources.set('medicare-bluebutton', {
      id: 'medicare-bluebutton',
      name: 'Medicare (Blue Button 2.0)',
      type: 'insurance',
      logoUrl: '/images/providers/medicare.png',
      supportedDataTypes: ['claims', 'coverage', 'medications', 'providers'],
      aggregatorPlatform: '1uphealth',
      isPopular: true,
      connectionInstructions: 'Connect using your Medicare.gov account credentials'
    });

    this.dataSources.set('united-healthcare', {
      id: 'united-healthcare',
      name: 'UnitedHealthcare',
      type: 'insurance',
      logoUrl: '/images/providers/uhc.png',
      supportedDataTypes: ['claims', 'coverage', 'providers'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    this.dataSources.set('aetna', {
      id: 'aetna',
      name: 'Aetna',
      type: 'insurance',
      logoUrl: '/images/providers/aetna.png',
      supportedDataTypes: ['claims', 'coverage', 'providers'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    this.dataSources.set('cigna', {
      id: 'cigna',
      name: 'Cigna',
      type: 'insurance',
      logoUrl: '/images/providers/cigna.png',
      supportedDataTypes: ['claims', 'coverage', 'providers'],
      aggregatorPlatform: '1uphealth',
      isPopular: false
    });

    this.dataSources.set('anthem', {
      id: 'anthem',
      name: 'Anthem Blue Cross Blue Shield',
      type: 'insurance',
      logoUrl: '/images/providers/anthem.png',
      supportedDataTypes: ['claims', 'coverage', 'providers'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    // Imaging Centers
    this.dataSources.set('radnet', {
      id: 'radnet',
      name: 'RadNet',
      type: 'imaging',
      logoUrl: '/images/providers/radnet.png',
      supportedDataTypes: ['imaging', 'diagnostic-reports'],
      aggregatorPlatform: 'humanapi',
      isPopular: false
    });

    this.dataSources.set('simonmed', {
      id: 'simonmed',
      name: 'SimonMed Imaging',
      type: 'imaging',
      logoUrl: '/images/providers/simonmed.png',
      supportedDataTypes: ['imaging', 'diagnostic-reports'],
      aggregatorPlatform: 'humanapi',
      isPopular: false
    });

    // Retail Clinics
    this.dataSources.set('cvs-minuteclinic', {
      id: 'cvs-minuteclinic',
      name: 'CVS MinuteClinic',
      type: 'retail_clinic',
      logoUrl: '/images/providers/minuteclinic.png',
      supportedDataTypes: ['clinical-notes', 'immunizations', 'encounters'],
      aggregatorPlatform: '1uphealth',
      isPopular: true
    });

    this.dataSources.set('walgreens-healthcare-clinic', {
      id: 'walgreens-healthcare-clinic',
      name: 'Walgreens Healthcare Clinic',
      type: 'retail_clinic',
      logoUrl: '/images/providers/walgreens-clinic.png',
      supportedDataTypes: ['clinical-notes', 'immunizations', 'encounters'],
      aggregatorPlatform: '1uphealth',
      isPopular: false
    });
  }

  /**
   * Get all available data sources
   */
  getAvailableDataSources(type?: HealthDataSourceType): HealthDataSource[] {
    let sources = Array.from(this.dataSources.values());
    
    if (type) {
      sources = sources.filter(s => s.type === type);
    }
    
    return sources.sort((a, b) => {
      if (a.isPopular !== b.isPopular) return b.isPopular ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get popular data sources for quick connect
   */
  getPopularDataSources(): HealthDataSource[] {
    return Array.from(this.dataSources.values())
      .filter(s => s.isPopular)
      .slice(0, 10);
  }

  /**
   * Search data sources by name
   */
  searchDataSources(query: string): HealthDataSource[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.dataSources.values())
      .filter(s => 
        s.name.toLowerCase().includes(lowerQuery) ||
        s.type.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * Initiate connection to a data source
   */
  initiateConnection(
    patientId: string,
    dataSourceId: string,
    redirectUri: string
  ): { authorizationUrl: string; state: string } {
    const dataSource = this.dataSources.get(dataSourceId);
    if (!dataSource) {
      throw new Error(`Unknown data source: ${dataSourceId}`);
    }

    const state = crypto.randomBytes(16).toString('hex');

    // Store auth state
    this.authStates.set(state, {
      state,
      patientId,
      dataSourceId,
      platform: dataSource.aggregatorPlatform,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Build authorization URL based on aggregator platform
    let authorizationUrl: string;
    
    if (dataSource.aggregatorPlatform === '1uphealth') {
      const params = new URLSearchParams({
        client_id: this.oneUpConfig.clientId,
        redirect_uri: redirectUri,
        state,
        health_system: dataSourceId
      });
      authorizationUrl = `${this.oneUpConfig.authUrl}?${params.toString()}`;
    } else {
      // Human API
      const params = new URLSearchParams({
        client_id: process.env.HUMANAPI_CLIENT_ID || 'tabula-medica-humanapi',
        redirect_uri: redirectUri,
        state,
        source: dataSourceId
      });
      authorizationUrl = `https://connect.humanapi.co/auth?${params.toString()}`;
    }

    console.log(`[HealthAggregator] Connection initiated for ${dataSource.name} (patient: ${patientId})`);
    
    return { authorizationUrl, state };
  }

  /**
   * Complete connection after OAuth callback
   */
  async completeConnection(
    code: string,
    state: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const authState = this.authStates.get(state);
    if (!authState) {
      return { success: false, error: 'Invalid or expired authorization state' };
    }

    if (new Date() > authState.expiresAt) {
      this.authStates.delete(state);
      return { success: false, error: 'Authorization state expired' };
    }

    const dataSource = this.dataSources.get(authState.dataSourceId);
    if (!dataSource) {
      return { success: false, error: 'Data source not found' };
    }

    try {
      // Create connection record
      const connectionId = `conn-${crypto.randomBytes(8).toString('hex')}`;
      const connection: PatientDataConnection = {
        id: connectionId,
        patientId: authState.patientId,
        dataSourceId: authState.dataSourceId,
        dataSourceName: dataSource.name,
        aggregatorPlatform: authState.platform,
        status: 'connected',
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        syncStatus: 'idle',
        dataTypesAvailable: dataSource.supportedDataTypes,
        recordCount: 0
      };

      // Store connection
      if (!this.patientConnections.has(authState.patientId)) {
        this.patientConnections.set(authState.patientId, []);
      }
      this.patientConnections.get(authState.patientId)!.push(connection);

      // Trigger initial sync
      this.syncDataSource(authState.patientId, connectionId);

      // Clean up auth state
      this.authStates.delete(state);

      console.log(`[HealthAggregator] Connection completed: ${dataSource.name} for patient ${authState.patientId}`);

      return { success: true, connectionId };
    } catch (error) {
      console.error(`[HealthAggregator] Connection failed:`, error);
      return { success: false, error: 'Connection failed' };
    }
  }

  /**
   * Get patient's data connections
   */
  getPatientConnections(patientId: string): PatientDataConnection[] {
    return this.patientConnections.get(patientId) || [];
  }

  /**
   * Sync data from a connected source
   */
  async syncDataSource(patientId: string, connectionId: string): Promise<{
    success: boolean;
    recordsSync: number;
    error?: string;
  }> {
    const connections = this.patientConnections.get(patientId);
    const connection = connections?.find(c => c.id === connectionId);
    
    if (!connection) {
      return { success: false, recordsSync: 0, error: 'Connection not found' };
    }

    connection.syncStatus = 'syncing';

    try {
      let recordsSync = 0;
      const dataSource = this.dataSources.get(connection.dataSourceId);

      // Simulate fetching data based on supported data types
      if (dataSource?.supportedDataTypes.includes('lab-results')) {
        const labs = this.generateMockLabResults(patientId, connection.dataSourceId, dataSource.name);
        if (!this.labResults.has(patientId)) {
          this.labResults.set(patientId, []);
        }
        this.labResults.get(patientId)!.push(...labs);
        recordsSync += labs.length;
      }

      if (dataSource?.supportedDataTypes.includes('medications') || 
          dataSource?.supportedDataTypes.includes('pharmacy-claims')) {
        const meds = this.generateMockMedications(patientId, connection.dataSourceId, dataSource.name);
        if (!this.medications.has(patientId)) {
          this.medications.set(patientId, []);
        }
        this.medications.get(patientId)!.push(...meds);
        recordsSync += meds.length;
      }

      if (dataSource?.supportedDataTypes.includes('claims')) {
        const claimsData = this.generateMockClaims(patientId, connection.dataSourceId, dataSource.name);
        if (!this.claims.has(patientId)) {
          this.claims.set(patientId, []);
        }
        this.claims.get(patientId)!.push(...claimsData);
        recordsSync += claimsData.length;
      }

      connection.syncStatus = 'completed';
      connection.lastSyncAt = new Date();
      connection.recordCount = recordsSync;

      console.log(`[HealthAggregator] Synced ${recordsSync} records from ${dataSource?.name}`);

      return { success: true, recordsSync };
    } catch (error) {
      connection.syncStatus = 'failed';
      connection.errorMessage = `Sync failed: ${error}`;
      return { success: false, recordsSync: 0, error: `Sync failed: ${error}` };
    }
  }

  /**
   * Disconnect a data source
   */
  disconnectDataSource(patientId: string, connectionId: string): boolean {
    const connections = this.patientConnections.get(patientId);
    if (!connections) return false;

    const index = connections.findIndex(c => c.id === connectionId);
    if (index === -1) return false;

    connections[index].status = 'disconnected';
    console.log(`[HealthAggregator] Disconnected ${connectionId} for patient ${patientId}`);
    
    return true;
  }

  /**
   * Get aggregated lab results for patient
   */
  getLabResults(patientId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    limit?: number;
  }): AggregatedLabResult[] {
    let results = this.labResults.get(patientId) || [];

    if (options?.startDate) {
      results = results.filter(r => r.collectedAt >= options.startDate!);
    }
    if (options?.endDate) {
      results = results.filter(r => r.collectedAt <= options.endDate!);
    }
    if (options?.category) {
      results = results.filter(r => r.category === options.category);
    }

    results.sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime());

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get aggregated medications for patient
   */
  getMedications(patientId: string, options?: {
    status?: 'active' | 'discontinued' | 'on-hold';
    limit?: number;
  }): AggregatedMedication[] {
    let meds = this.medications.get(patientId) || [];

    if (options?.status) {
      meds = meds.filter(m => m.status === options.status);
    }

    meds.sort((a, b) => b.prescribedDate.getTime() - a.prescribedDate.getTime());

    if (options?.limit) {
      meds = meds.slice(0, options.limit);
    }

    return meds;
  }

  /**
   * Get aggregated claims for patient
   */
  getClaims(patientId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    type?: 'medical' | 'pharmacy' | 'dental' | 'vision';
    limit?: number;
  }): AggregatedClaim[] {
    let claimsData = this.claims.get(patientId) || [];

    if (options?.startDate) {
      claimsData = claimsData.filter(c => c.serviceDate >= options.startDate!);
    }
    if (options?.endDate) {
      claimsData = claimsData.filter(c => c.serviceDate <= options.endDate!);
    }
    if (options?.type) {
      claimsData = claimsData.filter(c => c.claimType === options.type);
    }

    claimsData.sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime());

    if (options?.limit) {
      claimsData = claimsData.slice(0, options.limit);
    }

    return claimsData;
  }

  /**
   * Get dashboard statistics
   */
  getDashboard(patientId?: string): {
    totalDataSources: number;
    popularSources: HealthDataSource[];
    patientConnections?: PatientDataConnection[];
    aggregatedStats?: {
      labResults: number;
      medications: number;
      claims: number;
    };
  } {
    const result: any = {
      totalDataSources: this.dataSources.size,
      popularSources: this.getPopularDataSources()
    };

    if (patientId) {
      result.patientConnections = this.getPatientConnections(patientId);
      result.aggregatedStats = {
        labResults: (this.labResults.get(patientId) || []).length,
        medications: (this.medications.get(patientId) || []).length,
        claims: (this.claims.get(patientId) || []).length
      };
    }

    return result;
  }

  /**
   * Generate mock lab results
   */
  private generateMockLabResults(patientId: string, sourceId: string, sourceName: string): AggregatedLabResult[] {
    const now = new Date();
    return [
      {
        id: `lab-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        testName: 'Hemoglobin A1c',
        testCode: '4548-4',
        testCodeSystem: 'LOINC',
        value: 6.8,
        unit: '%',
        referenceRange: { low: 4.0, high: 5.6, text: '4.0-5.6%' },
        status: 'final',
        collectedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        reportedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        category: 'Diabetes',
        interpretation: 'abnormal'
      },
      {
        id: `lab-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        testName: 'Glucose, Fasting',
        testCode: '1558-6',
        testCodeSystem: 'LOINC',
        value: 118,
        unit: 'mg/dL',
        referenceRange: { low: 70, high: 100, text: '70-100 mg/dL' },
        status: 'final',
        collectedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        reportedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        category: 'Metabolic',
        interpretation: 'abnormal'
      },
      {
        id: `lab-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        testName: 'Lipid Panel - LDL Cholesterol',
        testCode: '13457-7',
        testCodeSystem: 'LOINC',
        value: 128,
        unit: 'mg/dL',
        referenceRange: { low: 0, high: 100, text: '<100 mg/dL optimal' },
        status: 'final',
        collectedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        reportedAt: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
        category: 'Cardiovascular',
        interpretation: 'abnormal'
      },
      {
        id: `lab-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        testName: 'Complete Blood Count - WBC',
        testCode: '6690-2',
        testCodeSystem: 'LOINC',
        value: 7.2,
        unit: 'K/uL',
        referenceRange: { low: 4.5, high: 11.0, text: '4.5-11.0 K/uL' },
        status: 'final',
        collectedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        reportedAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000),
        category: 'Hematology',
        interpretation: 'normal'
      }
    ];
  }

  /**
   * Generate mock medications
   */
  private generateMockMedications(patientId: string, sourceId: string, sourceName: string): AggregatedMedication[] {
    const now = new Date();
    return [
      {
        id: `med-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        medicationName: 'Metformin HCL ER',
        genericName: 'Metformin',
        rxNormCode: '860975',
        ndc: '00093-7212-01',
        strength: '500 mg',
        form: 'Extended-Release Tablet',
        dosage: 'Take 1 tablet',
        frequency: 'Twice daily with meals',
        prescribedDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        lastFilledDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        refillsRemaining: 5,
        daysSupply: 90,
        pharmacy: sourceName,
        prescriber: 'Dr. Sarah Johnson',
        status: 'active'
      },
      {
        id: `med-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        medicationName: 'Lisinopril',
        genericName: 'Lisinopril',
        rxNormCode: '314076',
        ndc: '00093-7342-56',
        strength: '10 mg',
        form: 'Tablet',
        dosage: 'Take 1 tablet',
        frequency: 'Once daily',
        prescribedDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        lastFilledDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        refillsRemaining: 3,
        daysSupply: 90,
        pharmacy: sourceName,
        prescriber: 'Dr. Sarah Johnson',
        status: 'active'
      },
      {
        id: `med-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        medicationName: 'Atorvastatin Calcium',
        genericName: 'Atorvastatin',
        rxNormCode: '617314',
        ndc: '00378-3952-77',
        strength: '20 mg',
        form: 'Tablet',
        dosage: 'Take 1 tablet',
        frequency: 'Once daily at bedtime',
        prescribedDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        lastFilledDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        refillsRemaining: 11,
        daysSupply: 30,
        pharmacy: sourceName,
        prescriber: 'Dr. Michael Chen',
        status: 'active'
      }
    ];
  }

  /**
   * Generate mock claims
   */
  private generateMockClaims(patientId: string, sourceId: string, sourceName: string): AggregatedClaim[] {
    const now = new Date();
    return [
      {
        id: `claim-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        claimNumber: `CLM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        claimType: 'medical',
        serviceDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        providerName: 'Springfield Primary Care Associates',
        diagnosisCodes: ['E11.9', 'I10'],
        procedureCodes: ['99214'],
        billedAmount: 250.00,
        allowedAmount: 180.00,
        paidAmount: 144.00,
        patientResponsibility: 36.00,
        status: 'processed'
      },
      {
        id: `claim-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        claimNumber: `CLM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        claimType: 'pharmacy',
        serviceDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        providerName: 'CVS Pharmacy #1234',
        diagnosisCodes: ['E11.9'],
        procedureCodes: [],
        billedAmount: 85.00,
        allowedAmount: 45.00,
        paidAmount: 35.00,
        patientResponsibility: 10.00,
        status: 'processed'
      },
      {
        id: `claim-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        sourceId,
        sourceName,
        claimNumber: `CLM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        claimType: 'medical',
        serviceDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        providerName: 'Quest Diagnostics',
        diagnosisCodes: ['Z00.00'],
        procedureCodes: ['80053', '85025'],
        billedAmount: 320.00,
        allowedAmount: 95.00,
        paidAmount: 95.00,
        patientResponsibility: 0.00,
        status: 'processed'
      }
    ];
  }
}

export const healthDataAggregatorService = new HealthDataAggregatorService();
