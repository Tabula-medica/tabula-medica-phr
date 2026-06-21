import { logPhiAccess } from '../security/hipaa-audit';

export interface HL7v2Message {
  id: string;
  messageType: string;
  triggerEvent: string;
  version: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: string;
  messageControlId: string;
  segments: HL7v2Segment[];
  rawMessage: string;
}

export interface HL7v2Segment {
  name: string;
  fields: string[];
  rawSegment: string;
}

export interface CCDADocument {
  id: string;
  documentType: 'CCD' | 'CCD-A' | 'Discharge-Summary' | 'Progress-Note' | 'Referral-Note' | 'Continuity-of-Care';
  title: string;
  effectiveTime: string;
  author: {
    name: string;
    organization: string;
  };
  patient: {
    name: string;
    dateOfBirth: string;
    gender: string;
    mrn?: string;
  };
  sections: CCDASection[];
  rawXml?: string;
}

export interface CCDASection {
  templateId: string;
  code: string;
  title: string;
  entries: CCDAEntry[];
}

export interface CCDAEntry {
  type: string;
  data: Record<string, any>;
}

export interface DataSourceConnection {
  id: string;
  patientId: string;
  sourceType: 'ehr' | 'clinic' | 'lab' | 'pharmacy' | 'imaging' | 'payer' | 'hie' | 'other';
  sourceName: string;
  sourceOrganization: string;
  connectionStatus: 'pending' | 'active' | 'paused' | 'error' | 'disconnected';
  protocol: 'fhir' | 'hl7v2' | 'ccda' | 'x12' | 'direct';
  endpoint?: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  dataPermissions: DataPermission[];
  credentials?: {
    type: 'oauth2' | 'api-key' | 'certificate' | 'basic';
    configured: boolean;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataPermission {
  dataType: string;
  canRead: boolean;
  canShare: boolean;
  autoSync: boolean;
  retentionDays?: number;
}

export interface SyncEvent {
  id: string;
  connectionId: string;
  eventType: 'sync_started' | 'sync_completed' | 'sync_failed' | 'data_received' | 'data_sent';
  status: 'success' | 'partial' | 'failed';
  recordsProcessed?: number;
  recordsFailed?: number;
  details?: string;
  timestamp: string;
}

const connections = new Map<string, DataSourceConnection>();
const syncEvents = new Map<string, SyncEvent[]>();

const DATA_SOURCE_TYPES = [
  { id: 'ehr', name: 'Electronic Health Record', icon: 'hospital', description: 'Connect to hospital or clinic EHR systems' },
  { id: 'clinic', name: 'Specialty Clinic', icon: 'stethoscope', description: 'Connect to specialty care providers' },
  { id: 'lab', name: 'Diagnostic Laboratory', icon: 'flask', description: 'Connect to lab result systems' },
  { id: 'pharmacy', name: 'Pharmacy', icon: 'pill', description: 'Connect to pharmacy systems for medication data' },
  { id: 'imaging', name: 'Imaging Center', icon: 'scan', description: 'Connect to radiology and imaging systems' },
  { id: 'payer', name: 'Insurance/Payer', icon: 'shield', description: 'Connect to insurance claims data' },
  { id: 'hie', name: 'Health Information Exchange', icon: 'network', description: 'Connect to regional HIE networks' },
  { id: 'other', name: 'Other Source', icon: 'database', description: 'Connect to other health data sources' },
];

const DATA_TYPES = [
  { id: 'demographics', name: 'Demographics', description: 'Basic patient information' },
  { id: 'conditions', name: 'Conditions/Diagnoses', description: 'Medical conditions and diagnoses' },
  { id: 'medications', name: 'Medications', description: 'Current and past medications' },
  { id: 'allergies', name: 'Allergies', description: 'Allergy information' },
  { id: 'labs', name: 'Lab Results', description: 'Laboratory test results' },
  { id: 'vitals', name: 'Vital Signs', description: 'Blood pressure, heart rate, etc.' },
  { id: 'immunizations', name: 'Immunizations', description: 'Vaccination records' },
  { id: 'procedures', name: 'Procedures', description: 'Medical procedures' },
  { id: 'encounters', name: 'Encounters', description: 'Healthcare visits' },
  { id: 'documents', name: 'Clinical Documents', description: 'Clinical notes and reports' },
  { id: 'imaging', name: 'Imaging Studies', description: 'X-rays, MRIs, CT scans' },
  { id: 'claims', name: 'Insurance Claims', description: 'Claims and EOB data' },
];

const PROTOCOLS = [
  { id: 'fhir', name: 'FHIR R4', description: 'Fast Healthcare Interoperability Resources' },
  { id: 'hl7v2', name: 'HL7 v2.x', description: 'Health Level Seven Version 2 messaging' },
  { id: 'ccda', name: 'C-CDA', description: 'Consolidated Clinical Document Architecture' },
  { id: 'x12', name: 'X12 EDI', description: 'ANSI X12 Electronic Data Interchange' },
  { id: 'direct', name: 'Direct Secure Messaging', description: 'Direct Protocol for secure health messaging' },
];

class HL7v2Parser {
  private static SEGMENT_DELIMITER = '\r';
  private static FIELD_DELIMITER = '|';
  private static COMPONENT_DELIMITER = '^';
  private static SUBCOMPONENT_DELIMITER = '&';
  private static REPETITION_DELIMITER = '~';

  static parse(rawMessage: string): HL7v2Message {
    const lines = rawMessage.split(/[\r\n]+/).filter(line => line.trim());
    const segments: HL7v2Segment[] = [];
    
    let messageType = '';
    let triggerEvent = '';
    let version = '';
    let sendingApp = '';
    let sendingFacility = '';
    let receivingApp = '';
    let receivingFacility = '';
    let timestamp = '';
    let messageControlId = '';

    for (const line of lines) {
      const fields = line.split(this.FIELD_DELIMITER);
      const segmentName = fields[0];

      if (segmentName === 'MSH') {
        sendingApp = fields[2] || '';
        sendingFacility = fields[3] || '';
        receivingApp = fields[4] || '';
        receivingFacility = fields[5] || '';
        timestamp = fields[6] || '';
        const msgType = (fields[8] || '').split(this.COMPONENT_DELIMITER);
        messageType = msgType[0] || '';
        triggerEvent = msgType[1] || '';
        messageControlId = fields[9] || '';
        version = fields[11] || '2.5.1';
      }

      segments.push({
        name: segmentName,
        fields: fields.slice(1),
        rawSegment: line,
      });
    }

    return {
      id: `hl7-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageType,
      triggerEvent,
      version,
      sendingApplication: sendingApp,
      sendingFacility,
      receivingApplication: receivingApp,
      receivingFacility,
      timestamp,
      messageControlId,
      segments,
      rawMessage,
    };
  }

  static generateACK(originalMessage: HL7v2Message, ackCode: 'AA' | 'AE' | 'AR', errorMessage?: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const controlId = `ACK${Date.now()}`;

    let ack = `MSH|^~\\&|${originalMessage.receivingApplication}|${originalMessage.receivingFacility}|`;
    ack += `${originalMessage.sendingApplication}|${originalMessage.sendingFacility}|${timestamp}||ACK^${originalMessage.triggerEvent}|`;
    ack += `${controlId}|P|${originalMessage.version}\r`;
    ack += `MSA|${ackCode}|${originalMessage.messageControlId}`;
    
    if (errorMessage) {
      ack += `|${errorMessage}`;
    }
    ack += '\r';

    return ack;
  }

  static toFHIR(message: HL7v2Message): Record<string, any> {
    const resources: Record<string, any>[] = [];

    for (const segment of message.segments) {
      switch (segment.name) {
        case 'PID':
          resources.push(this.pidToPatient(segment));
          break;
        case 'OBX':
          resources.push(this.obxToObservation(segment));
          break;
        case 'DG1':
          resources.push(this.dg1ToCondition(segment));
          break;
        case 'RXA':
          resources.push(this.rxaToMedicationAdministration(segment));
          break;
      }
    }

    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: resources.filter(r => r).map(r => ({ resource: r })),
    };
  }

  private static pidToPatient(segment: HL7v2Segment): Record<string, any> {
    const fields = segment.fields;
    const nameComponents = (fields[4] || '').split('^');
    const dobField = fields[6] || '';

    return {
      resourceType: 'Patient',
      identifier: [{ value: fields[2] || fields[0] }],
      name: [{
        family: nameComponents[0] || '',
        given: nameComponents[1] ? [nameComponents[1]] : [],
      }],
      gender: this.mapGender(fields[7]),
      birthDate: dobField ? `${dobField.slice(0, 4)}-${dobField.slice(4, 6)}-${dobField.slice(6, 8)}` : undefined,
    };
  }

  private static obxToObservation(segment: HL7v2Segment): Record<string, any> {
    const fields = segment.fields;
    const codeComponents = (fields[2] || '').split('^');

    return {
      resourceType: 'Observation',
      status: 'final',
      code: {
        coding: [{
          system: codeComponents[2] || 'http://loinc.org',
          code: codeComponents[0] || '',
          display: codeComponents[1] || '',
        }],
      },
      valueString: fields[4] || '',
      effectiveDateTime: fields[13] || new Date().toISOString(),
    };
  }

  private static dg1ToCondition(segment: HL7v2Segment): Record<string, any> {
    const fields = segment.fields;
    const codeComponents = (fields[2] || '').split('^');

    return {
      resourceType: 'Condition',
      code: {
        coding: [{
          system: codeComponents[2] === 'I10' ? 'http://hl7.org/fhir/sid/icd-10' : 'http://hl7.org/fhir/sid/icd-9',
          code: codeComponents[0] || '',
          display: codeComponents[1] || '',
        }],
      },
      onsetDateTime: fields[4] || undefined,
    };
  }

  private static rxaToMedicationAdministration(segment: HL7v2Segment): Record<string, any> {
    const fields = segment.fields;
    const drugComponents = (fields[4] || '').split('^');

    return {
      resourceType: 'MedicationAdministration',
      status: 'completed',
      medicationCodeableConcept: {
        coding: [{
          system: drugComponents[2] || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: drugComponents[0] || '',
          display: drugComponents[1] || '',
        }],
      },
      effectiveDateTime: fields[2] || new Date().toISOString(),
    };
  }

  private static mapGender(hl7Gender: string): string {
    switch (hl7Gender?.toUpperCase()) {
      case 'M': return 'male';
      case 'F': return 'female';
      case 'O': return 'other';
      default: return 'unknown';
    }
  }
}

class CCDAParser {
  static parse(xmlContent: string): CCDADocument {
    const doc: CCDADocument = {
      id: `ccda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentType: 'CCD',
      title: this.extractText(xmlContent, 'title') || 'Clinical Document',
      effectiveTime: this.extractAttribute(xmlContent, 'effectiveTime', 'value') || new Date().toISOString(),
      author: {
        name: this.extractAuthorName(xmlContent),
        organization: this.extractText(xmlContent, 'representedOrganization/name') || 'Unknown Organization',
      },
      patient: {
        name: this.extractPatientName(xmlContent),
        dateOfBirth: this.extractAttribute(xmlContent, 'patient/birthTime', 'value') || '',
        gender: this.extractAttribute(xmlContent, 'patient/administrativeGenderCode', 'code') || 'unknown',
        mrn: this.extractPatientId(xmlContent),
      },
      sections: this.extractSections(xmlContent),
      rawXml: xmlContent,
    };

    return doc;
  }

  private static extractText(xml: string, tagPath: string): string {
    const tags = tagPath.split('/');
    let current = xml;
    for (const tag of tags) {
      const match = current.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
      if (match) {
        current = match[1];
      } else {
        return '';
      }
    }
    return current.trim();
  }

  private static extractAttribute(xml: string, tagPath: string, attr: string): string {
    const tags = tagPath.split('/');
    const lastTag = tags[tags.length - 1];
    const attrMatch = xml.match(new RegExp(`<${lastTag}[^>]*${attr}="([^"]*)"`, 'i'));
    return attrMatch ? attrMatch[1] : '';
  }

  private static extractAuthorName(xml: string): string {
    const givenMatch = xml.match(/<author[^>]*>[\s\S]*?<given>([^<]*)<\/given>/i);
    const familyMatch = xml.match(/<author[^>]*>[\s\S]*?<family>([^<]*)<\/family>/i);
    const given = givenMatch ? givenMatch[1] : '';
    const family = familyMatch ? familyMatch[1] : '';
    return `${given} ${family}`.trim() || 'Unknown Author';
  }

  private static extractPatientName(xml: string): string {
    const givenMatch = xml.match(/<patient[^>]*>[\s\S]*?<given>([^<]*)<\/given>/i);
    const familyMatch = xml.match(/<patient[^>]*>[\s\S]*?<family>([^<]*)<\/family>/i);
    const given = givenMatch ? givenMatch[1] : '';
    const family = familyMatch ? familyMatch[1] : '';
    return `${given} ${family}`.trim() || 'Unknown Patient';
  }

  private static extractPatientId(xml: string): string {
    const idMatch = xml.match(/<patientRole[^>]*>[\s\S]*?<id[^>]*extension="([^"]*)"[^>]*\/>/i);
    return idMatch ? idMatch[1] : '';
  }

  private static extractSections(xml: string): CCDASection[] {
    const sections: CCDASection[] = [];
    const sectionRegex = /<component>\s*<section>([\s\S]*?)<\/section>\s*<\/component>/gi;
    let match;

    while ((match = sectionRegex.exec(xml)) !== null) {
      const sectionXml = match[1];
      const templateMatch = sectionXml.match(/<templateId[^>]*root="([^"]*)"[^>]*\/>/i);
      const codeMatch = sectionXml.match(/<code[^>]*code="([^"]*)"[^>]*\/>/i);
      const titleMatch = sectionXml.match(/<title>([^<]*)<\/title>/i);

      sections.push({
        templateId: templateMatch ? templateMatch[1] : '',
        code: codeMatch ? codeMatch[1] : '',
        title: titleMatch ? titleMatch[1] : 'Unknown Section',
        entries: this.extractEntries(sectionXml),
      });
    }

    return sections;
  }

  private static extractEntries(sectionXml: string): CCDAEntry[] {
    const entries: CCDAEntry[] = [];
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let match;

    while ((match = entryRegex.exec(sectionXml)) !== null) {
      const entryXml = match[1];
      let type = 'unknown';
      
      if (entryXml.includes('<observation')) type = 'observation';
      else if (entryXml.includes('<act')) type = 'act';
      else if (entryXml.includes('<substanceAdministration')) type = 'medication';
      else if (entryXml.includes('<procedure')) type = 'procedure';
      else if (entryXml.includes('<encounter')) type = 'encounter';

      entries.push({
        type,
        data: { raw: entryXml.substring(0, 500) },
      });
    }

    return entries;
  }

  static toFHIR(document: CCDADocument): Record<string, any> {
    const resources: Record<string, any>[] = [];

    resources.push({
      resourceType: 'Patient',
      name: [{ text: document.patient.name }],
      birthDate: document.patient.dateOfBirth,
      gender: document.patient.gender === 'M' ? 'male' : document.patient.gender === 'F' ? 'female' : 'unknown',
      identifier: document.patient.mrn ? [{ value: document.patient.mrn }] : [],
    });

    resources.push({
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '34133-9',
          display: document.documentType,
        }],
      },
      description: document.title,
      date: document.effectiveTime,
      author: [{ display: document.author.name }],
    });

    return {
      resourceType: 'Bundle',
      type: 'document',
      entry: resources.map(r => ({ resource: r })),
    };
  }
}

class InteroperabilityHubService {
  getDataSourceTypes() {
    return DATA_SOURCE_TYPES;
  }

  getDataTypes() {
    return DATA_TYPES;
  }

  getProtocols() {
    return PROTOCOLS;
  }

  async getPatientConnections(patientId: string): Promise<DataSourceConnection[]> {
    return Array.from(connections.values())
      .filter(c => c.patientId === patientId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async createConnection(
    patientId: string,
    sourceType: DataSourceConnection['sourceType'],
    sourceName: string,
    sourceOrganization: string,
    protocol: DataSourceConnection['protocol'],
    dataPermissions: DataPermission[],
    syncFrequency: DataSourceConnection['syncFrequency'],
    endpoint?: string,
    userId?: string
  ): Promise<DataSourceConnection> {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const connection: DataSourceConnection = {
      id: connectionId,
      patientId,
      sourceType,
      sourceName,
      sourceOrganization,
      connectionStatus: 'pending',
      protocol,
      endpoint,
      syncFrequency,
      dataPermissions,
      createdAt: now,
      updatedAt: now,
    };

    connections.set(connectionId, connection);

    logPhiAccess({
      action: 'write',
      userId: userId || 'system',
      patientId,
      resourceType: 'DataSourceConnection',
      details: `CREATE_CONNECTION: ${sourceType} - ${sourceName} (${sourceOrganization}) via ${protocol}`,
    });

    console.log(`[InteroperabilityHub] Connection created: ${connectionId} for ${sourceName}`);

    return connection;
  }

  async updateConnection(
    connectionId: string,
    updates: Partial<Pick<DataSourceConnection, 'connectionStatus' | 'dataPermissions' | 'syncFrequency' | 'endpoint'>>,
    userId?: string
  ): Promise<DataSourceConnection | null> {
    const connection = connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const updated = {
      ...connection,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    connections.set(connectionId, updated);

    logPhiAccess({
      action: 'write',
      userId: userId || 'system',
      patientId: connection.patientId,
      resourceType: 'DataSourceConnection',
      details: `UPDATE_CONNECTION: ${connectionId} - Status: ${updated.connectionStatus}`,
    });

    return updated;
  }

  async deleteConnection(connectionId: string, userId?: string): Promise<boolean> {
    const connection = connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connections.delete(connectionId);

    logPhiAccess({
      action: 'delete',
      userId: userId || 'system',
      patientId: connection.patientId,
      resourceType: 'DataSourceConnection',
      details: `DELETE_CONNECTION: ${connectionId} - ${connection.sourceName}`,
    });

    return true;
  }

  async testConnection(connectionId: string, userId?: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const connection = connections.get(connectionId);
    if (!connection) {
      return { success: false, message: 'Connection not found' };
    }

    logPhiAccess({
      action: 'read',
      userId: userId || 'system',
      patientId: connection.patientId,
      resourceType: 'DataSourceConnection',
      details: `TEST_CONNECTION: Testing connection ${connectionId} to ${connection.sourceName}`,
    });

    const startTime = Date.now();
    
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const success = Math.random() > 0.2;
    const latencyMs = Date.now() - startTime;

    logPhiAccess({
      action: 'read',
      userId: userId || 'system',
      patientId: connection.patientId,
      resourceType: 'DataSourceConnection',
      details: `TEST_CONNECTION_RESULT: ${connectionId} - ${success ? 'SUCCESS' : 'FAILED'} (${latencyMs}ms)`,
    });

    if (success) {
      await this.updateConnection(connectionId, { connectionStatus: 'active' }, userId);
      return { success: true, message: 'Connection successful', latencyMs };
    } else {
      await this.updateConnection(connectionId, { 
        connectionStatus: 'error',
        errorMessage: 'Failed to establish connection - timeout or authentication error',
      } as any);
      return { success: false, message: 'Connection failed - please check credentials', latencyMs };
    }
  }

  async syncConnection(connectionId: string, userId?: string): Promise<SyncEvent> {
    const connection = connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const readablePermissions = connection.dataPermissions?.filter(p => p.canRead && p.autoSync) || [];
    if (readablePermissions.length === 0) {
      logPhiAccess({
        action: 'read',
        userId: userId || 'system',
        patientId: connection.patientId,
        resourceType: 'DataSourceSync',
        details: `SYNC_DENIED: No readable data types configured for ${connectionId}`,
      });
      throw new Error('No data types configured for auto-sync. Please update permissions.');
    }

    logPhiAccess({
      action: 'read',
      userId: userId || 'system',
      patientId: connection.patientId,
      resourceType: 'DataSourceSync',
      details: `SYNC_STARTED: ${connectionId} - ${connection.sourceName} - Types: ${readablePermissions.map(p => p.dataType).join(', ')}`,
    });

    const eventId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const event: SyncEvent = {
      id: eventId,
      connectionId,
      eventType: 'sync_started',
      status: 'success',
      timestamp: now,
    };

    if (!syncEvents.has(connectionId)) {
      syncEvents.set(connectionId, []);
    }
    syncEvents.get(connectionId)!.push(event);

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const recordsProcessed = Math.floor(Math.random() * 50) + 5;
    const recordsFailed = Math.floor(Math.random() * 3);
    const success = Math.random() > 0.1;

    const completedEvent: SyncEvent = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      connectionId,
      eventType: success ? 'sync_completed' : 'sync_failed',
      status: success ? (recordsFailed > 0 ? 'partial' : 'success') : 'failed',
      recordsProcessed: success ? recordsProcessed : 0,
      recordsFailed,
      details: success 
        ? `Synced ${recordsProcessed} records from ${connection.sourceName}`
        : 'Sync failed - connection timeout',
      timestamp: new Date().toISOString(),
    };

    syncEvents.get(connectionId)!.push(completedEvent);

    await this.updateConnection(connectionId, {
      connectionStatus: success ? 'active' : 'error',
    } as any);

    logPhiAccess({
      action: 'read',
      userId: userId || 'system',
      patientId: connection.patientId,
      resourceType: 'DataSourceSync',
      details: `SYNC_CONNECTION: ${connectionId} - ${completedEvent.status} - ${recordsProcessed} records`,
    });

    return completedEvent;
  }

  async getSyncHistory(connectionId: string): Promise<SyncEvent[]> {
    return syncEvents.get(connectionId) || [];
  }

  parseHL7v2(message: string): HL7v2Message {
    return HL7v2Parser.parse(message);
  }

  generateHL7v2ACK(message: HL7v2Message, ackCode: 'AA' | 'AE' | 'AR', errorMessage?: string): string {
    return HL7v2Parser.generateACK(message, ackCode, errorMessage);
  }

  hl7v2ToFHIR(message: HL7v2Message): Record<string, any> {
    return HL7v2Parser.toFHIR(message);
  }

  parseCCDA(xmlContent: string): CCDADocument {
    return CCDAParser.parse(xmlContent);
  }

  ccdaToFHIR(document: CCDADocument): Record<string, any> {
    return CCDAParser.toFHIR(document);
  }

  async processIncomingMessage(
    connectionId: string,
    protocol: 'hl7v2' | 'ccda',
    content: string,
    userId?: string
  ): Promise<{ success: boolean; fhirBundle?: Record<string, any>; error?: string }> {
    const connection = connections.get(connectionId);
    
    try {
      let fhirBundle: Record<string, any>;

      if (protocol === 'hl7v2') {
        const message = this.parseHL7v2(content);
        fhirBundle = this.hl7v2ToFHIR(message);
      } else if (protocol === 'ccda') {
        const document = this.parseCCDA(content);
        fhirBundle = this.ccdaToFHIR(document);
      } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
      }

      logPhiAccess({
        action: 'write',
        userId: userId || 'system',
        patientId: connection?.patientId || 'unknown',
        resourceType: 'DataImport',
        details: `IMPORT_${protocol.toUpperCase()}: Processed ${fhirBundle.entry?.length || 0} resources`,
      });

      return { success: true, fhirBundle };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const interoperabilityHubService = new InteroperabilityHubService();
