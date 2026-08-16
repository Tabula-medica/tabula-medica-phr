import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export interface FHIRResource {
  id: string;
  resourceType: string;
  meta?: {
    versionId: string;
    lastUpdated: string;
    source?: string;
    profile?: string[];
    tag?: { system: string; code: string; display?: string }[];
  };
  [key: string]: any;
}

export interface ResourceVersion {
  versionId: string;
  resource: FHIRResource;
  timestamp: string;
  changeType: 'create' | 'update' | 'delete';
  changedBy?: string;
  changeReason?: string;
  diff?: ResourceDiff[];
}

export interface ResourceDiff {
  path: string;
  oldValue: any;
  newValue: any;
  operation: 'add' | 'remove' | 'replace';
}

export interface ResourceSearchResult {
  resource: FHIRResource;
  score: number;
  highlights?: { path: string; value: string }[];
  semanticMatch?: boolean;
}

export interface BulkOperation {
  id: string;
  type: 'import' | 'export';
  format: 'ndjson' | 'fhir_bundle' | 'csv';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  resourceTypes: string[];
  totalResources: number;
  processedResources: number;
  errors: { index: number; message: string; resource?: string }[];
  startedAt: string;
  completedAt?: string;
  createdBy?: string;
  fileUrl?: string;
  options?: {
    validateOnImport?: boolean;
    overwriteExisting?: boolean;
    dryRun?: boolean;
  };
}

export interface PlaygroundSession {
  id: string;
  name: string;
  resources: FHIRResource[];
  validationResults: ValidationResult[];
  status: 'draft' | 'validated' | 'pushed';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ValidationResult {
  resourceId: string;
  valid: boolean;
  errors: { path: string; message: string; severity: 'error' | 'warning' | 'info' }[];
  warnings: { path: string; message: string }[];
  profile?: string;
}

export interface UsagePattern {
  resourceType: string;
  totalCount: number;
  recentAccess: number;
  avgVersions: number;
  duplicateCount: number;
  orphanedCount: number;
  lastAccessed: string;
  sizeBytes: number;
  recommendations?: string[];
}

export interface LifecycleStats {
  totalResources: number;
  totalVersions: number;
  resourceTypeBreakdown: { type: string; count: number }[];
  activeBulkOperations: number;
  playgroundSessions: number;
  duplicatesDetected: number;
  orphanedResources: number;
  storageUsedBytes: number;
  lastAnalysisRun: string;
}

class FHIRResourceLifecycleService {
  private resources: Map<string, FHIRResource> = new Map();
  private resourceVersions: Map<string, ResourceVersion[]> = new Map();
  private bulkOperations: Map<string, BulkOperation> = new Map();
  private playgroundSessions: Map<string, PlaygroundSession> = new Map();
  private usagePatterns: Map<string, UsagePattern> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[FHIRResourceLifecycle] Service initialized with intelligent resource management");
    console.log("[FHIRResourceLifecycle] Features: Versioning, Bulk ops, Playground, Usage analytics");
    console.log("[FHIRResourceLifecycle] NO-CDS compliance enabled for all outputs");
  }

  private initializeSampleData(): void {
    const sampleResources: FHIRResource[] = [
      {
        id: "patient-001",
        resourceType: "Patient",
        meta: { versionId: "3", lastUpdated: new Date().toISOString(), source: "Primary Care Provider" },
        identifier: [{ system: "urn:oid:2.16.840.1.113883.4.1", value: "123-45-6789" }],
        name: [{ family: "Smith", given: ["John", "Robert"], use: "official" }],
        birthDate: "1985-03-15",
        gender: "male",
        address: [{ line: ["123 Main St"], city: "Boston", state: "MA", postalCode: "02101" }]
      },
      {
        id: "observation-001",
        resourceType: "Observation",
        meta: { versionId: "1", lastUpdated: new Date().toISOString(), source: "Lab System" },
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose [Mass/volume] in Blood" }] },
        subject: { reference: "Patient/patient-001" },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: { value: 95, unit: "mg/dL", system: "http://unitsofmeasure.org", code: "mg/dL" }
      },
      {
        id: "condition-001",
        resourceType: "Condition",
        meta: { versionId: "2", lastUpdated: new Date().toISOString(), source: "Clinical Note" },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }] },
        subject: { reference: "Patient/patient-001" },
        onsetDateTime: "2020-01-15"
      },
      {
        id: "medication-001",
        resourceType: "MedicationRequest",
        meta: { versionId: "1", lastUpdated: new Date().toISOString(), source: "Pharmacy" },
        status: "active",
        intent: "order",
        medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG Oral Tablet" }] },
        subject: { reference: "Patient/patient-001" },
        dosageInstruction: [{ text: "Take 1 tablet twice daily with meals" }]
      }
    ];

    sampleResources.forEach(r => {
      this.resources.set(`${r.resourceType}/${r.id}`, r);
      
      const versions: ResourceVersion[] = [];
      const numVersions = parseInt(r.meta?.versionId || "1");
      for (let i = 1; i <= numVersions; i++) {
        versions.push({
          versionId: String(i),
          resource: { ...r, meta: { ...r.meta, versionId: String(i), lastUpdated: r.meta?.lastUpdated || new Date().toISOString() } },
          timestamp: new Date(Date.now() - (numVersions - i) * 24 * 60 * 60 * 1000).toISOString(),
          changeType: i === 1 ? 'create' : 'update',
          changedBy: 'system',
          changeReason: i === 1 ? 'Initial creation' : 'Data update'
        });
      }
      this.resourceVersions.set(`${r.resourceType}/${r.id}`, versions);
    });

    const bulkOps: BulkOperation[] = [
      {
        id: "bulk-001",
        type: "import",
        format: "ndjson",
        status: "completed",
        resourceTypes: ["Patient", "Observation"],
        totalResources: 150,
        processedResources: 150,
        errors: [],
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
        createdBy: "admin"
      },
      {
        id: "bulk-002",
        type: "export",
        format: "fhir_bundle",
        status: "processing",
        resourceTypes: ["Patient", "Condition", "MedicationRequest"],
        totalResources: 500,
        processedResources: 234,
        errors: [],
        startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        createdBy: "data_team"
      }
    ];
    bulkOps.forEach(op => this.bulkOperations.set(op.id, op));

    const playground: PlaygroundSession = {
      id: "playground-001",
      name: "Test Patient Bundle",
      resources: [
        {
          id: "temp-patient-001",
          resourceType: "Patient",
          name: [{ family: "Test", given: ["User"] }],
          birthDate: "1990-05-20",
          gender: "female"
        }
      ],
      validationResults: [
        {
          resourceId: "temp-patient-001",
          valid: true,
          errors: [],
          warnings: [{ path: "identifier", message: "No identifier provided - recommended for production use" }]
        }
      ],
      status: "validated",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "developer"
    };
    this.playgroundSessions.set(playground.id, playground);

    const patterns: UsagePattern[] = [
      {
        resourceType: "Patient",
        totalCount: 2500,
        recentAccess: 1847,
        avgVersions: 2.3,
        duplicateCount: 12,
        orphanedCount: 0,
        lastAccessed: new Date().toISOString(),
        sizeBytes: 15000000,
        recommendations: ["Consider merging 12 potential duplicate patient records"]
      },
      {
        resourceType: "Observation",
        totalCount: 45000,
        recentAccess: 23400,
        avgVersions: 1.1,
        duplicateCount: 234,
        orphanedCount: 45,
        lastAccessed: new Date().toISOString(),
        sizeBytes: 180000000,
        recommendations: ["Archive 45 orphaned observations", "Review 234 potential duplicates"]
      },
      {
        resourceType: "Condition",
        totalCount: 8500,
        recentAccess: 4200,
        avgVersions: 1.8,
        duplicateCount: 8,
        orphanedCount: 3,
        lastAccessed: new Date().toISOString(),
        sizeBytes: 25000000,
        recommendations: []
      },
      {
        resourceType: "MedicationRequest",
        totalCount: 12000,
        recentAccess: 8900,
        avgVersions: 1.5,
        duplicateCount: 0,
        orphanedCount: 15,
        lastAccessed: new Date().toISOString(),
        sizeBytes: 48000000,
        recommendations: ["Review 15 orphaned medication requests for cleanup"]
      }
    ];
    patterns.forEach(p => this.usagePatterns.set(p.resourceType, p));
  }

  getStats(): LifecycleStats {
    const resources = Array.from(this.resources.values());
    const typeBreakdown: Record<string, number> = {};
    resources.forEach(r => {
      typeBreakdown[r.resourceType] = (typeBreakdown[r.resourceType] || 0) + 1;
    });

    const patterns = Array.from(this.usagePatterns.values());

    return {
      totalResources: patterns.reduce((sum, p) => sum + p.totalCount, 0),
      totalVersions: Array.from(this.resourceVersions.values()).reduce((sum, v) => sum + v.length, 0),
      resourceTypeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({ type, count })),
      activeBulkOperations: Array.from(this.bulkOperations.values()).filter(o => o.status === 'processing').length,
      playgroundSessions: this.playgroundSessions.size,
      duplicatesDetected: patterns.reduce((sum, p) => sum + p.duplicateCount, 0),
      orphanedResources: patterns.reduce((sum, p) => sum + p.orphanedCount, 0),
      storageUsedBytes: patterns.reduce((sum, p) => sum + p.sizeBytes, 0),
      lastAnalysisRun: new Date().toISOString()
    };
  }

  getResource(resourceType: string, id: string): FHIRResource | undefined {
    return this.resources.get(`${resourceType}/${id}`);
  }

  getResources(resourceType?: string, limit: number = 100): FHIRResource[] {
    let resources = Array.from(this.resources.values());
    if (resourceType) {
      resources = resources.filter(r => r.resourceType === resourceType);
    }
    return resources.slice(0, limit);
  }

  createResource(resource: FHIRResource): FHIRResource {
    const id = resource.id || `${Date.now()}`;
    const now = new Date().toISOString();
    
    const newResource: FHIRResource = {
      ...resource,
      id,
      meta: {
        ...resource.meta,
        versionId: "1",
        lastUpdated: now
      }
    };

    const key = `${resource.resourceType}/${id}`;
    this.resources.set(key, newResource);

    const version: ResourceVersion = {
      versionId: "1",
      resource: newResource,
      timestamp: now,
      changeType: 'create',
      changedBy: 'system',
      changeReason: 'Initial creation'
    };
    this.resourceVersions.set(key, [version]);

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_CREATED - ${key}`);
    return newResource;
  }

  updateResource(resourceType: string, id: string, updates: Partial<FHIRResource>, changeReason?: string): FHIRResource | undefined {
    const key = `${resourceType}/${id}`;
    const existing = this.resources.get(key);
    if (!existing) return undefined;

    const currentVersion = parseInt(existing.meta?.versionId || "1");
    const now = new Date().toISOString();

    const diff = this.calculateDiff(existing, updates);

    const updated: FHIRResource = {
      ...existing,
      ...updates,
      id,
      resourceType,
      meta: {
        ...existing.meta,
        ...updates.meta,
        versionId: String(currentVersion + 1),
        lastUpdated: now
      }
    };

    this.resources.set(key, updated);

    const versions = this.resourceVersions.get(key) || [];
    versions.push({
      versionId: String(currentVersion + 1),
      resource: updated,
      timestamp: now,
      changeType: 'update',
      changedBy: 'system',
      changeReason: changeReason || 'Resource updated',
      diff
    });
    this.resourceVersions.set(key, versions);

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_UPDATED - ${key} to version ${currentVersion + 1}`);
    return updated;
  }

  deleteResource(resourceType: string, id: string): boolean {
    const key = `${resourceType}/${id}`;
    const existing = this.resources.get(key);
    if (!existing) return false;

    this.resources.delete(key);

    const versions = this.resourceVersions.get(key) || [];
    versions.push({
      versionId: `${versions.length + 1}-deleted`,
      resource: existing,
      timestamp: new Date().toISOString(),
      changeType: 'delete',
      changedBy: 'system',
      changeReason: 'Resource deleted'
    });
    this.resourceVersions.set(key, versions);

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_DELETED - ${key}`);
    return true;
  }

  getResourceHistory(resourceType: string, id: string): ResourceVersion[] {
    const key = `${resourceType}/${id}`;
    return this.resourceVersions.get(key) || [];
  }

  getResourceVersion(resourceType: string, id: string, versionId: string): FHIRResource | undefined {
    const history = this.getResourceHistory(resourceType, id);
    const version = history.find(v => v.versionId === versionId);
    return version?.resource;
  }

  rollbackResource(resourceType: string, id: string, targetVersionId: string): FHIRResource | undefined {
    const targetVersion = this.getResourceVersion(resourceType, id, targetVersionId);
    if (!targetVersion) return undefined;

    const restored = this.updateResource(resourceType, id, targetVersion, `Rollback to version ${targetVersionId}`);
    console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_ROLLBACK - ${resourceType}/${id} to version ${targetVersionId}`);
    return restored;
  }

  private calculateDiff(oldResource: FHIRResource, newResource: Partial<FHIRResource>): ResourceDiff[] {
    const diffs: ResourceDiff[] = [];

    for (const key of Object.keys(newResource)) {
      if (key === 'meta' || key === 'id' || key === 'resourceType') continue;

      const oldValue = (oldResource as any)[key];
      const newValue = (newResource as any)[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diffs.push({
          path: key,
          oldValue,
          newValue,
          operation: oldValue === undefined ? 'add' : newValue === undefined ? 'remove' : 'replace'
        });
      }
    }

    return diffs;
  }

  async searchResources(query: {
    text?: string;
    resourceType?: string;
    semantic?: boolean;
    filters?: Record<string, string>;
  }): Promise<ResourceSearchResult[]> {
    let resources = Array.from(this.resources.values());

    if (query.resourceType) {
      resources = resources.filter(r => r.resourceType === query.resourceType);
    }

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        resources = resources.filter(r => {
          const resourceValue = this.getNestedValue(r, key);
          return resourceValue?.toString().toLowerCase().includes(value.toLowerCase());
        });
      }
    }

    let results: ResourceSearchResult[] = resources.map(r => ({
      resource: r,
      score: 1.0,
      semanticMatch: false
    }));

    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.map(result => {
        const jsonStr = JSON.stringify(result.resource).toLowerCase();
        const matches = (jsonStr.match(new RegExp(searchText, 'g')) || []).length;
        return {
          ...result,
          score: matches > 0 ? Math.min(1.0, matches * 0.2) : 0,
          highlights: this.findHighlights(result.resource, searchText)
        };
      }).filter(r => r.score > 0);

      if (query.semantic && aiEnabled) {
        try {
          const semanticResults = await this.semanticSearch(query.text, resources);
          results = this.mergeSearchResults(results, semanticResults);
        } catch (error) {
          console.log("[ResourceLifecycle] Semantic search unavailable, using text search only");
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private findHighlights(resource: FHIRResource, searchText: string): { path: string; value: string }[] {
    const highlights: { path: string; value: string }[] = [];

    const findInObject = (obj: any, path: string) => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof value === 'string' && value.toLowerCase().includes(searchText)) {
          highlights.push({ path: currentPath, value });
        } else if (typeof value === 'object' && value !== null) {
          findInObject(value, currentPath);
        }
      }
    };

    findInObject(resource, '');
    return highlights.slice(0, 5);
  }

  private async semanticSearch(query: string, resources: FHIRResource[]): Promise<ResourceSearchResult[]> {
    if (!aiEnabled) {
      return [];
    }
    const content = await generatePhiSafeText({
      system: "You are a FHIR resource search assistant. Given a natural language query and a list of resource summaries, return the IDs of resources that match the semantic meaning of the query. Return JSON with: matchingIds (array of resource IDs), reasoning (brief)",
      user: `Query: "${query}"\n\nResources:\n${resources.slice(0, 20).map(r => `- ${r.resourceType}/${r.id}: ${JSON.stringify(r).slice(0, 200)}`).join('\n')}`,
      responseMimeType: "application/json",
      maxTokens: 500
    });

    if (content) {
      const parsed = JSON.parse(content);
      const matchingIds = parsed.matchingIds || [];
      return resources
        .filter(r => matchingIds.includes(r.id) || matchingIds.includes(`${r.resourceType}/${r.id}`))
        .map(r => ({
          resource: r,
          score: 0.9,
          semanticMatch: true
        }));
    }

    return [];
  }

  private mergeSearchResults(textResults: ResourceSearchResult[], semanticResults: ResourceSearchResult[]): ResourceSearchResult[] {
    const merged = new Map<string, ResourceSearchResult>();

    textResults.forEach(r => {
      merged.set(`${r.resource.resourceType}/${r.resource.id}`, r);
    });

    semanticResults.forEach(r => {
      const key = `${r.resource.resourceType}/${r.resource.id}`;
      const existing = merged.get(key);
      if (existing) {
        existing.score = Math.max(existing.score, r.score);
        existing.semanticMatch = true;
      } else {
        merged.set(key, r);
      }
    });

    return Array.from(merged.values());
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  startBulkImport(options: {
    format: 'ndjson' | 'fhir_bundle' | 'csv';
    resourceTypes: string[];
    data: any[];
    validateOnImport?: boolean;
    createdBy?: string;
  }): BulkOperation {
    const operation: BulkOperation = {
      id: `bulk-${Date.now()}`,
      type: 'import',
      format: options.format,
      status: 'processing',
      resourceTypes: options.resourceTypes,
      totalResources: options.data.length,
      processedResources: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      createdBy: options.createdBy,
      options: { validateOnImport: options.validateOnImport }
    };

    this.bulkOperations.set(operation.id, operation);

    setTimeout(() => {
      const op = this.bulkOperations.get(operation.id);
      if (op) {
        op.status = 'completed';
        op.processedResources = op.totalResources;
        op.completedAt = new Date().toISOString();
      }
    }, 5000);

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] BULK_IMPORT_STARTED - ${operation.id} with ${options.data.length} resources`);
    return operation;
  }

  startBulkExport(options: {
    format: 'ndjson' | 'fhir_bundle' | 'csv';
    resourceTypes: string[];
    createdBy?: string;
  }): BulkOperation {
    const resources = Array.from(this.resources.values())
      .filter(r => options.resourceTypes.includes(r.resourceType));

    const operation: BulkOperation = {
      id: `bulk-${Date.now()}`,
      type: 'export',
      format: options.format,
      status: 'processing',
      resourceTypes: options.resourceTypes,
      totalResources: resources.length,
      processedResources: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      createdBy: options.createdBy
    };

    this.bulkOperations.set(operation.id, operation);

    setTimeout(() => {
      const op = this.bulkOperations.get(operation.id);
      if (op) {
        op.status = 'completed';
        op.processedResources = op.totalResources;
        op.completedAt = new Date().toISOString();
        op.fileUrl = `/exports/${op.id}.${op.format === 'ndjson' ? 'ndjson' : op.format === 'fhir_bundle' ? 'json' : 'csv'}`;
      }
    }, 5000);

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] BULK_EXPORT_STARTED - ${operation.id} for ${resources.length} resources`);
    return operation;
  }

  getBulkOperation(operationId: string): BulkOperation | undefined {
    return this.bulkOperations.get(operationId);
  }

  getBulkOperations(type?: 'import' | 'export'): BulkOperation[] {
    let operations = Array.from(this.bulkOperations.values());
    if (type) {
      operations = operations.filter(o => o.type === type);
    }
    return operations.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  cancelBulkOperation(operationId: string): boolean {
    const operation = this.bulkOperations.get(operationId);
    if (operation && operation.status === 'processing') {
      operation.status = 'cancelled';
      console.log(`[HIPAA-AUDIT][ResourceLifecycle] BULK_OPERATION_CANCELLED - ${operationId}`);
      return true;
    }
    return false;
  }

  createPlaygroundSession(name: string, createdBy?: string): PlaygroundSession {
    const session: PlaygroundSession = {
      id: `playground-${Date.now()}`,
      name,
      resources: [],
      validationResults: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy
    };

    this.playgroundSessions.set(session.id, session);
    console.log(`[HIPAA-AUDIT][ResourceLifecycle] PLAYGROUND_CREATED - ${session.id}`);
    return session;
  }

  getPlaygroundSession(sessionId: string): PlaygroundSession | undefined {
    return this.playgroundSessions.get(sessionId);
  }

  getPlaygroundSessions(): PlaygroundSession[] {
    return Array.from(this.playgroundSessions.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  addResourceToPlayground(sessionId: string, resource: FHIRResource): PlaygroundSession | undefined {
    const session = this.playgroundSessions.get(sessionId);
    if (!session) return undefined;

    session.resources.push(resource);
    session.status = 'draft';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  updatePlaygroundResource(sessionId: string, resourceIndex: number, resource: FHIRResource): PlaygroundSession | undefined {
    const session = this.playgroundSessions.get(sessionId);
    if (!session || resourceIndex >= session.resources.length) return undefined;

    session.resources[resourceIndex] = resource;
    session.status = 'draft';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  removeResourceFromPlayground(sessionId: string, resourceIndex: number): PlaygroundSession | undefined {
    const session = this.playgroundSessions.get(sessionId);
    if (!session || resourceIndex >= session.resources.length) return undefined;

    session.resources.splice(resourceIndex, 1);
    session.validationResults = session.validationResults.filter((_, i) => i !== resourceIndex);
    session.status = 'draft';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  validatePlaygroundResources(sessionId: string): ValidationResult[] {
    const session = this.playgroundSessions.get(sessionId);
    if (!session) return [];

    const results: ValidationResult[] = session.resources.map(resource => {
      const errors: ValidationResult['errors'] = [];
      const warnings: ValidationResult['warnings'] = [];

      if (!resource.resourceType) {
        errors.push({ path: 'resourceType', message: 'resourceType is required', severity: 'error' });
      }

      if (!resource.id) {
        warnings.push({ path: 'id', message: 'id is recommended for resource tracking' });
      }

      if (resource.resourceType === 'Patient') {
        if (!resource.name || resource.name.length === 0) {
          warnings.push({ path: 'name', message: 'Patient name is recommended' });
        }
        if (!resource.birthDate) {
          warnings.push({ path: 'birthDate', message: 'birthDate is recommended for patient identification' });
        }
        if (!resource.identifier || resource.identifier.length === 0) {
          warnings.push({ path: 'identifier', message: 'No identifier provided - recommended for production use' });
        }
      }

      if (resource.resourceType === 'Observation') {
        if (!resource.status) {
          errors.push({ path: 'status', message: 'status is required for Observation', severity: 'error' });
        }
        if (!resource.code) {
          errors.push({ path: 'code', message: 'code is required for Observation', severity: 'error' });
        }
        if (!resource.subject) {
          warnings.push({ path: 'subject', message: 'subject reference is recommended' });
        }
      }

      return {
        resourceId: resource.id || `temp-${session.resources.indexOf(resource)}`,
        valid: errors.length === 0,
        errors,
        warnings
      };
    });

    session.validationResults = results;
    session.status = results.every(r => r.valid) ? 'validated' : 'draft';
    session.updatedAt = new Date().toISOString();

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] PLAYGROUND_VALIDATED - ${sessionId}: ${results.filter(r => r.valid).length}/${results.length} valid`);
    return results;
  }

  pushPlaygroundResources(sessionId: string): { success: boolean; created: FHIRResource[]; errors: string[] } {
    const session = this.playgroundSessions.get(sessionId);
    if (!session) {
      return { success: false, created: [], errors: ['Session not found'] };
    }

    if (session.status !== 'validated') {
      return { success: false, created: [], errors: ['Resources must be validated before pushing'] };
    }

    const created: FHIRResource[] = [];
    const errors: string[] = [];

    for (const resource of session.resources) {
      try {
        const newResource = this.createResource(resource);
        created.push(newResource);
      } catch (error: any) {
        errors.push(`Failed to create ${resource.resourceType}/${resource.id}: ${error.message}`);
      }
    }

    if (errors.length === 0) {
      session.status = 'pushed';
      session.updatedAt = new Date().toISOString();
    }

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] PLAYGROUND_PUSHED - ${sessionId}: ${created.length} created, ${errors.length} errors`);
    return { success: errors.length === 0, created, errors };
  }

  deletePlaygroundSession(sessionId: string): boolean {
    const deleted = this.playgroundSessions.delete(sessionId);
    if (deleted) {
      console.log(`[HIPAA-AUDIT][ResourceLifecycle] PLAYGROUND_DELETED - ${sessionId}`);
    }
    return deleted;
  }

  getUsagePatterns(): UsagePattern[] {
    return Array.from(this.usagePatterns.values())
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  async analyzeUsagePatterns(): Promise<{
    patterns: UsagePattern[];
    insights: string[];
    recommendations: string[];
  }> {
    const patterns = this.getUsagePatterns();
    
    const insights: string[] = [];
    const recommendations: string[] = [];

    const totalDuplicates = patterns.reduce((sum, p) => sum + p.duplicateCount, 0);
    if (totalDuplicates > 0) {
      insights.push(`Detected ${totalDuplicates} potential duplicate resources across ${patterns.filter(p => p.duplicateCount > 0).length} resource types`);
      recommendations.push(`Review and merge duplicate resources to improve data quality`);
    }

    const totalOrphaned = patterns.reduce((sum, p) => sum + p.orphanedCount, 0);
    if (totalOrphaned > 0) {
      insights.push(`Found ${totalOrphaned} orphaned resources that may need cleanup`);
      recommendations.push(`Archive or delete orphaned resources to optimize storage`);
    }

    const highVersionTypes = patterns.filter(p => p.avgVersions > 3);
    if (highVersionTypes.length > 0) {
      insights.push(`${highVersionTypes.length} resource types have high version counts (avg > 3 versions)`);
      recommendations.push(`Consider archiving old versions to reduce storage usage`);
    }

    const totalStorage = patterns.reduce((sum, p) => sum + p.sizeBytes, 0);
    insights.push(`Total storage usage: ${(totalStorage / 1024 / 1024).toFixed(2)} MB`);

    console.log(`[HIPAA-AUDIT][ResourceLifecycle] USAGE_ANALYSIS_COMPLETED - ${patterns.length} resource types analyzed`);

    return { patterns, insights, recommendations };
  }
}

export const fhirResourceLifecycleService = new FHIRResourceLifecycleService();
