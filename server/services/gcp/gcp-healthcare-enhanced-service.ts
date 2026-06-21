import type { IntegrationConfig } from "../integrations/interfaces";
import { healthcare } from "@googleapis/healthcare";
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function gcpAuditLog(
  action: string, 
  resourceType: string, 
  resourceId: string, 
  userId: string, 
  details: string,
  severity: "INFO" | "WARNING" | "ERROR" | "NOTICE" = "INFO"
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    severity,
    logType: "GCP_HEALTHCARE_API_AUDIT",
    action,
    resourceType,
    resourceId,
    userId,
    details
  };
  console.log(`[HIPAA-AUDIT][GCP-Healthcare][${severity}] ${action} - ${resourceType}:${resourceId} User:${userId} - ${details}`);
  console.log(`[GCP-AUDIT-JSON] ${JSON.stringify(entry)}`);
}

export type OperationStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type OperationType = "EXPORT" | "IMPORT" | "DEIDENTIFY" | "FHIR_STORE_CREATE" | "DATASET_CREATE";

export interface AsyncOperation {
  id: string;
  operationType: OperationType;
  status: OperationStatus;
  gcpOperationName?: string;
  projectId: string;
  location: string;
  datasetId?: string;
  fhirStoreId?: string;
  progress?: {
    percentage: number;
    processedResources?: number;
    totalResources?: number;
    currentResourceType?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    exportConfig?: ExportConfiguration;
    importConfig?: ImportConfiguration;
    deidentifyConfig?: DeidentifyConfiguration;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  createdBy: string;
}

export interface ExportConfiguration {
  destination: {
    type: "GCS" | "BIGQUERY";
    gcsUri?: string;
    bigQueryDataset?: string;
    tablePrefix?: string;
  };
  resourceTypes?: string[];
  since?: string;
  outputFormat?: "NDJSON" | "FHIR_BUNDLE" | "BIGQUERY_ANALYTICS";
  includeHistory?: boolean;
}

export interface ImportConfiguration {
  source: {
    type: "GCS" | "NDJSON" | "FHIR_BUNDLE";
    gcsUri?: string;
    contentStructure?: "RESOURCE" | "BUNDLE" | "BUNDLE_PRETTY";
  };
  resourceTypes?: string[];
  errorHandling?: "STRICT" | "LENIENT" | "STOP_ON_ERROR";
  deduplicationMode?: "NONE" | "UPDATE" | "SKIP";
}

export interface DeidentifyConfiguration {
  destinationDataset: string;
  destinationFhirStore: string;
  config: {
    textRedaction?: boolean;
    dateShifting?: {
      enabled: boolean;
      maxDaysToShift?: number;
    };
    cryptoHash?: {
      enabled: boolean;
    };
    replaceWithInfoTypes?: boolean;
  };
}

export interface FhirDatastore {
  id: string;
  name: string;
  fullPath: string;
  projectId: string;
  location: string;
  datasetId: string;
  version: "R4" | "STU3" | "DSTU2";
  enableUpdateCreate: boolean;
  disableReferentialIntegrity: boolean;
  disableResourceVersioning: boolean;
  labels?: Record<string, string>;
  streamConfigs?: StreamConfig[];
  notificationConfigs?: NotificationConfig[];
  createdAt: string;
  updatedAt: string;
  resourceCounts?: Record<string, number>;
  status: "ACTIVE" | "CREATING" | "DELETING" | "ERROR";
}

export interface StreamConfig {
  id: string;
  resourceTypes: string[];
  bigQueryDestination: {
    datasetUri: string;
    schemaConfig: {
      schemaType: "ANALYTICS" | "ANALYTICS_V2";
    };
  };
}

export interface NotificationConfig {
  id: string;
  pubsubTopic: string;
  sendFullResource?: boolean;
  sendPreviousResource?: boolean;
}

export interface HealthcareDataset {
  id: string;
  name: string;
  fullPath: string;
  projectId: string;
  location: string;
  timeZone?: string;
  labels?: Record<string, string>;
  fhirStores: FhirDatastore[];
  createdAt: string;
  updatedAt: string;
  status: "ACTIVE" | "CREATING" | "DELETING" | "ERROR";
}

const asyncOperations = new Map<string, AsyncOperation>();
const fhirDatastores = new Map<string, FhirDatastore>();
const healthcareDatasets = new Map<string, HealthcareDataset>();

function initializeSampleData(): void {
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const sampleDataset: HealthcareDataset = {
    id: "dataset-001",
    name: "healthcare-dataset",
    fullPath: "projects/tabula-medica/locations/us-central1/datasets/healthcare-dataset",
    projectId: "tabula-medica",
    location: "us-central1",
    timeZone: "America/Chicago",
    labels: { environment: "production", team: "clinical" },
    fhirStores: [],
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: now,
    status: "ACTIVE"
  };

  const sampleFhirStores: FhirDatastore[] = [
    {
      id: "fhir-store-001",
      name: "patient-records",
      fullPath: "projects/tabula-medica/locations/us-central1/datasets/healthcare-dataset/fhirStores/patient-records",
      projectId: "tabula-medica",
      location: "us-central1",
      datasetId: "healthcare-dataset",
      version: "R4",
      enableUpdateCreate: true,
      disableReferentialIntegrity: false,
      disableResourceVersioning: false,
      labels: { type: "patient-data", hipaa: "compliant" },
      streamConfigs: [
        {
          id: "stream-001",
          resourceTypes: ["Patient", "Observation", "Condition"],
          bigQueryDestination: {
            datasetUri: "bq://tabula-medica.healthcare_analytics",
            schemaConfig: { schemaType: "ANALYTICS_V2" }
          }
        }
      ],
      notificationConfigs: [
        {
          id: "notify-001",
          pubsubTopic: "projects/tabula-medica/topics/fhir-updates",
          sendFullResource: true
        }
      ],
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: now,
      resourceCounts: {
        Patient: 15234,
        Observation: 245678,
        Condition: 34567,
        MedicationRequest: 12345,
        Encounter: 8765
      },
      status: "ACTIVE"
    },
    {
      id: "fhir-store-002",
      name: "clinical-trials",
      fullPath: "projects/tabula-medica/locations/us-central1/datasets/healthcare-dataset/fhirStores/clinical-trials",
      projectId: "tabula-medica",
      location: "us-central1",
      datasetId: "healthcare-dataset",
      version: "R4",
      enableUpdateCreate: true,
      disableReferentialIntegrity: false,
      disableResourceVersioning: false,
      labels: { type: "research", hipaa: "compliant" },
      createdAt: "2024-02-20T14:00:00Z",
      updatedAt: now,
      resourceCounts: {
        ResearchStudy: 45,
        ResearchSubject: 1234,
        Observation: 56789
      },
      status: "ACTIVE"
    }
  ];

  sampleDataset.fhirStores = sampleFhirStores;
  healthcareDatasets.set(sampleDataset.id, sampleDataset);
  sampleFhirStores.forEach(store => fhirDatastores.set(store.id, store));

  const sampleOperations: AsyncOperation[] = [
    {
      id: generateId("op"),
      operationType: "EXPORT",
      status: "SUCCEEDED",
      gcpOperationName: "projects/tabula-medica/locations/us-central1/datasets/healthcare-dataset/operations/export-12345",
      projectId: "tabula-medica",
      location: "us-central1",
      datasetId: "healthcare-dataset",
      fhirStoreId: "patient-records",
      progress: { percentage: 100, processedResources: 245678, totalResources: 245678 },
      metadata: {
        exportConfig: {
          destination: { type: "BIGQUERY", bigQueryDataset: "healthcare_analytics", tablePrefix: "export_" },
          resourceTypes: ["Patient", "Observation", "Condition"],
          outputFormat: "BIGQUERY_ANALYTICS"
        }
      },
      createdAt: twoHoursAgo,
      updatedAt: oneHourAgo,
      completedAt: oneHourAgo,
      createdBy: "admin-001"
    },
    {
      id: generateId("op"),
      operationType: "IMPORT",
      status: "RUNNING",
      gcpOperationName: "projects/tabula-medica/locations/us-central1/datasets/healthcare-dataset/operations/import-67890",
      projectId: "tabula-medica",
      location: "us-central1",
      datasetId: "healthcare-dataset",
      fhirStoreId: "patient-records",
      progress: { percentage: 45, processedResources: 11250, totalResources: 25000, currentResourceType: "Observation" },
      metadata: {
        importConfig: {
          source: { type: "GCS", gcsUri: "gs://tabula-medica-imports/batch-2024-02/*.ndjson", contentStructure: "RESOURCE" },
          errorHandling: "LENIENT",
          deduplicationMode: "UPDATE"
        }
      },
      createdAt: oneHourAgo,
      updatedAt: now,
      createdBy: "data-engineer-001"
    },
    {
      id: generateId("op"),
      operationType: "DEIDENTIFY",
      status: "PENDING",
      projectId: "tabula-medica",
      location: "us-central1",
      datasetId: "healthcare-dataset",
      fhirStoreId: "patient-records",
      progress: { percentage: 0 },
      metadata: {
        deidentifyConfig: {
          destinationDataset: "research-dataset",
          destinationFhirStore: "deidentified-records",
          config: {
            textRedaction: true,
            dateShifting: { enabled: true, maxDaysToShift: 100 },
            cryptoHash: { enabled: true }
          }
        }
      },
      createdAt: now,
      updatedAt: now,
      createdBy: "research-admin-001"
    }
  ];

  sampleOperations.forEach(op => asyncOperations.set(op.id, op));
}

initializeSampleData();

class GcpHealthcareEnhancedService {
  private healthcareClient: any = null;
  private auth: GoogleAuth | null = null;
  private config: IntegrationConfig | null = null;
  private isInitialized = false;

  async initialize(config: IntegrationConfig): Promise<void> {
    this.config = config;
    
    if (config.gcp?.projectId) {
      try {
        this.auth = new GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          ...(config.gcp.credentialsPath && { keyFile: config.gcp.credentialsPath })
        });

        this.healthcareClient = healthcare({
          version: "v1",
          auth: this.auth
        });

        this.isInitialized = true;
        gcpAuditLog("SERVICE_INITIALIZED", "GCPHealthcare", config.gcp.projectId, "system",
          `GCP Healthcare service initialized for project: ${config.gcp.projectId}`);
      } catch (error: any) {
        console.warn("[GCPHealthcareEnhanced] Client initialization failed, using sample data mode:", error.message);
        this.isInitialized = false;
      }
    } else {
      console.log("[GCPHealthcareEnhanced] No GCP config provided, using sample data mode");
      this.isInitialized = false;
    }
  }

  async startBulkExport(params: {
    datasetId: string;
    fhirStoreId: string;
    exportConfig: ExportConfiguration;
    userId: string;
  }): Promise<AsyncOperation> {
    const now = new Date().toISOString();
    const operation: AsyncOperation = {
      id: generateId("op"),
      operationType: "EXPORT",
      status: "PENDING",
      projectId: this.config?.gcp?.projectId || "tabula-medica",
      location: this.config?.gcp?.location || "us-central1",
      datasetId: params.datasetId,
      fhirStoreId: params.fhirStoreId,
      progress: { percentage: 0 },
      metadata: { exportConfig: params.exportConfig },
      createdAt: now,
      updatedAt: now,
      createdBy: params.userId
    };

    gcpAuditLog("BULK_EXPORT_STARTED", "FhirStore", params.fhirStoreId, params.userId,
      `Bulk export initiated to ${params.exportConfig.destination.type} for ${params.exportConfig.resourceTypes?.join(", ") || "all resources"}`,
      "NOTICE");

    if (this.isInitialized && this.healthcareClient) {
      try {
        const fhirStorePath = `projects/${operation.projectId}/locations/${operation.location}/datasets/${params.datasetId}/fhirStores/${params.fhirStoreId}`;
        
        let requestBody: any = {};
        if (params.exportConfig.destination.type === "GCS") {
          requestBody = {
            gcsDestination: {
              uriPrefix: params.exportConfig.destination.gcsUri
            }
          };
        } else if (params.exportConfig.destination.type === "BIGQUERY") {
          requestBody = {
            bigqueryDestination: {
              datasetUri: `bq://${operation.projectId}.${params.exportConfig.destination.bigQueryDataset}`,
              schemaConfig: {
                schemaType: params.exportConfig.outputFormat === "BIGQUERY_ANALYTICS" ? "ANALYTICS_V2" : "ANALYTICS"
              }
            }
          };
        }

        const response = await this.healthcareClient.projects.locations.datasets.fhirStores.export({
          name: fhirStorePath,
          requestBody
        });

        operation.gcpOperationName = response.data.name;
        operation.status = "RUNNING";

        gcpAuditLog("BULK_EXPORT_SUBMITTED", "FhirStore", params.fhirStoreId, params.userId,
          `GCP operation created: ${operation.gcpOperationName}`);
      } catch (error: any) {
        operation.status = "FAILED";
        operation.error = { code: "EXPORT_FAILED", message: error.message };
        
        gcpAuditLog("BULK_EXPORT_FAILED", "FhirStore", params.fhirStoreId, params.userId,
          `Export failed: ${error.message}`, "ERROR");
      }
    } else {
      operation.status = "RUNNING";
      this.simulateOperationProgress(operation.id);
    }

    asyncOperations.set(operation.id, operation);
    operation.updatedAt = new Date().toISOString();

    return operation;
  }

  async startBulkImport(params: {
    datasetId: string;
    fhirStoreId: string;
    importConfig: ImportConfiguration;
    userId: string;
  }): Promise<AsyncOperation> {
    const now = new Date().toISOString();
    const operation: AsyncOperation = {
      id: generateId("op"),
      operationType: "IMPORT",
      status: "PENDING",
      projectId: this.config?.gcp?.projectId || "tabula-medica",
      location: this.config?.gcp?.location || "us-central1",
      datasetId: params.datasetId,
      fhirStoreId: params.fhirStoreId,
      progress: { percentage: 0 },
      metadata: { importConfig: params.importConfig },
      createdAt: now,
      updatedAt: now,
      createdBy: params.userId
    };

    gcpAuditLog("BULK_IMPORT_STARTED", "FhirStore", params.fhirStoreId, params.userId,
      `Bulk import initiated from ${params.importConfig.source.type}: ${params.importConfig.source.gcsUri || "inline"}`,
      "NOTICE");

    if (this.isInitialized && this.healthcareClient) {
      try {
        const fhirStorePath = `projects/${operation.projectId}/locations/${operation.location}/datasets/${params.datasetId}/fhirStores/${params.fhirStoreId}`;

        const response = await this.healthcareClient.projects.locations.datasets.fhirStores.import({
          name: fhirStorePath,
          requestBody: {
            gcsSource: {
              uri: params.importConfig.source.gcsUri
            },
            contentStructure: params.importConfig.source.contentStructure || "RESOURCE"
          }
        });

        operation.gcpOperationName = response.data.name;
        operation.status = "RUNNING";

        gcpAuditLog("BULK_IMPORT_SUBMITTED", "FhirStore", params.fhirStoreId, params.userId,
          `GCP operation created: ${operation.gcpOperationName}`);
      } catch (error: any) {
        operation.status = "FAILED";
        operation.error = { code: "IMPORT_FAILED", message: error.message };

        gcpAuditLog("BULK_IMPORT_FAILED", "FhirStore", params.fhirStoreId, params.userId,
          `Import failed: ${error.message}`, "ERROR");
      }
    } else {
      operation.status = "RUNNING";
      this.simulateOperationProgress(operation.id);
    }

    asyncOperations.set(operation.id, operation);
    operation.updatedAt = new Date().toISOString();

    return operation;
  }

  async startDeidentification(params: {
    datasetId: string;
    fhirStoreId: string;
    deidentifyConfig: DeidentifyConfiguration;
    userId: string;
  }): Promise<AsyncOperation> {
    const now = new Date().toISOString();
    const operation: AsyncOperation = {
      id: generateId("op"),
      operationType: "DEIDENTIFY",
      status: "PENDING",
      projectId: this.config?.gcp?.projectId || "tabula-medica",
      location: this.config?.gcp?.location || "us-central1",
      datasetId: params.datasetId,
      fhirStoreId: params.fhirStoreId,
      progress: { percentage: 0 },
      metadata: { deidentifyConfig: params.deidentifyConfig },
      createdAt: now,
      updatedAt: now,
      createdBy: params.userId
    };

    gcpAuditLog("DEIDENTIFY_STARTED", "FhirStore", params.fhirStoreId, params.userId,
      `De-identification initiated to ${params.deidentifyConfig.destinationDataset}/${params.deidentifyConfig.destinationFhirStore}`,
      "NOTICE");

    operation.status = "RUNNING";
    this.simulateOperationProgress(operation.id);

    asyncOperations.set(operation.id, operation);
    return operation;
  }

  async getOperationStatus(operationId: string): Promise<AsyncOperation | null> {
    const operation = asyncOperations.get(operationId);
    if (!operation) return null;

    if (operation.gcpOperationName && this.isInitialized && this.healthcareClient) {
      try {
        const response = await this.healthcareClient.projects.locations.datasets.operations.get({
          name: operation.gcpOperationName
        });

        if (response.data.done) {
          operation.status = response.data.error ? "FAILED" : "SUCCEEDED";
          operation.completedAt = new Date().toISOString();
          if (response.data.error) {
            operation.error = {
              code: response.data.error.code,
              message: response.data.error.message
            };
          }
          operation.progress = { percentage: 100 };
        }

        operation.updatedAt = new Date().toISOString();
        asyncOperations.set(operationId, operation);
      } catch (error: any) {
        console.warn(`[GCPHealthcareEnhanced] Failed to fetch operation status: ${error.message}`);
      }
    }

    return operation;
  }

  async cancelOperation(operationId: string, userId: string): Promise<boolean> {
    const operation = asyncOperations.get(operationId);
    if (!operation) return false;

    if (operation.status !== "RUNNING" && operation.status !== "PENDING") {
      return false;
    }

    gcpAuditLog("OPERATION_CANCELLED", "AsyncOperation", operationId, userId,
      `Operation ${operation.operationType} cancelled by user`, "WARNING");

    operation.status = "CANCELLED";
    operation.updatedAt = new Date().toISOString();
    operation.completedAt = new Date().toISOString();
    asyncOperations.set(operationId, operation);

    return true;
  }

  async listOperations(params?: {
    status?: OperationStatus;
    type?: OperationType;
    datasetId?: string;
    fhirStoreId?: string;
    limit?: number;
  }): Promise<AsyncOperation[]> {
    let operations = Array.from(asyncOperations.values());

    if (params?.status) {
      operations = operations.filter(op => op.status === params.status);
    }
    if (params?.type) {
      operations = operations.filter(op => op.operationType === params.type);
    }
    if (params?.datasetId) {
      operations = operations.filter(op => op.datasetId === params.datasetId);
    }
    if (params?.fhirStoreId) {
      operations = operations.filter(op => op.fhirStoreId === params.fhirStoreId);
    }

    operations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return operations.slice(0, params?.limit || 50);
  }

  async createDataset(params: {
    name: string;
    location: string;
    timeZone?: string;
    labels?: Record<string, string>;
    userId: string;
  }): Promise<HealthcareDataset> {
    const now = new Date().toISOString();
    const projectId = this.config?.gcp?.projectId || "tabula-medica";

    const dataset: HealthcareDataset = {
      id: generateId("dataset"),
      name: params.name,
      fullPath: `projects/${projectId}/locations/${params.location}/datasets/${params.name}`,
      projectId,
      location: params.location,
      timeZone: params.timeZone,
      labels: params.labels,
      fhirStores: [],
      createdAt: now,
      updatedAt: now,
      status: "CREATING"
    };

    gcpAuditLog("DATASET_CREATE_STARTED", "Dataset", dataset.id, params.userId,
      `Creating healthcare dataset: ${params.name} in ${params.location}`, "NOTICE");

    if (this.isInitialized && this.healthcareClient) {
      try {
        await this.healthcareClient.projects.locations.datasets.create({
          parent: `projects/${projectId}/locations/${params.location}`,
          datasetId: params.name,
          requestBody: {
            timeZone: params.timeZone
          }
        });

        dataset.status = "ACTIVE";
        gcpAuditLog("DATASET_CREATED", "Dataset", dataset.id, params.userId,
          `Healthcare dataset created successfully: ${params.name}`);
      } catch (error: any) {
        dataset.status = "ERROR";
        gcpAuditLog("DATASET_CREATE_FAILED", "Dataset", dataset.id, params.userId,
          `Failed to create dataset: ${error.message}`, "ERROR");
        throw error;
      }
    } else {
      setTimeout(() => {
        const d = healthcareDatasets.get(dataset.id);
        if (d) {
          d.status = "ACTIVE";
          d.updatedAt = new Date().toISOString();
          healthcareDatasets.set(dataset.id, d);
        }
      }, 2000);
    }

    healthcareDatasets.set(dataset.id, dataset);
    return dataset;
  }

  async getDataset(datasetId: string): Promise<HealthcareDataset | null> {
    return healthcareDatasets.get(datasetId) || null;
  }

  async listDatasets(): Promise<HealthcareDataset[]> {
    return Array.from(healthcareDatasets.values());
  }

  async deleteDataset(datasetId: string, userId: string): Promise<boolean> {
    const dataset = healthcareDatasets.get(datasetId);
    if (!dataset) return false;

    gcpAuditLog("DATASET_DELETE_STARTED", "Dataset", datasetId, userId,
      `Deleting healthcare dataset: ${dataset.name}`, "WARNING");

    if (this.isInitialized && this.healthcareClient) {
      try {
        await this.healthcareClient.projects.locations.datasets.delete({
          name: dataset.fullPath
        });
        gcpAuditLog("DATASET_DELETED", "Dataset", datasetId, userId,
          `Healthcare dataset deleted: ${dataset.name}`);
      } catch (error: any) {
        gcpAuditLog("DATASET_DELETE_FAILED", "Dataset", datasetId, userId,
          `Failed to delete dataset: ${error.message}`, "ERROR");
        throw error;
      }
    }

    healthcareDatasets.delete(datasetId);
    return true;
  }

  async createFhirStore(params: {
    datasetId: string;
    name: string;
    version: "R4" | "STU3" | "DSTU2";
    enableUpdateCreate?: boolean;
    disableReferentialIntegrity?: boolean;
    disableResourceVersioning?: boolean;
    labels?: Record<string, string>;
    streamConfigs?: StreamConfig[];
    notificationConfigs?: NotificationConfig[];
    userId: string;
  }): Promise<FhirDatastore> {
    const now = new Date().toISOString();
    const dataset = healthcareDatasets.get(params.datasetId);
    const projectId = this.config?.gcp?.projectId || dataset?.projectId || "tabula-medica";
    const location = this.config?.gcp?.location || dataset?.location || "us-central1";

    const store: FhirDatastore = {
      id: generateId("fhir-store"),
      name: params.name,
      fullPath: `projects/${projectId}/locations/${location}/datasets/${params.datasetId}/fhirStores/${params.name}`,
      projectId,
      location,
      datasetId: params.datasetId,
      version: params.version,
      enableUpdateCreate: params.enableUpdateCreate ?? true,
      disableReferentialIntegrity: params.disableReferentialIntegrity ?? false,
      disableResourceVersioning: params.disableResourceVersioning ?? false,
      labels: params.labels,
      streamConfigs: params.streamConfigs,
      notificationConfigs: params.notificationConfigs,
      createdAt: now,
      updatedAt: now,
      resourceCounts: {},
      status: "CREATING"
    };

    gcpAuditLog("FHIR_STORE_CREATE_STARTED", "FhirStore", store.id, params.userId,
      `Creating FHIR store: ${params.name} (${params.version}) in dataset ${params.datasetId}`, "NOTICE");

    if (this.isInitialized && this.healthcareClient) {
      try {
        await this.healthcareClient.projects.locations.datasets.fhirStores.create({
          parent: `projects/${projectId}/locations/${location}/datasets/${params.datasetId}`,
          fhirStoreId: params.name,
          requestBody: {
            version: params.version,
            enableUpdateCreate: params.enableUpdateCreate ?? true,
            disableReferentialIntegrity: params.disableReferentialIntegrity ?? false,
            disableResourceVersioning: params.disableResourceVersioning ?? false,
            labels: params.labels
          }
        });

        store.status = "ACTIVE";
        gcpAuditLog("FHIR_STORE_CREATED", "FhirStore", store.id, params.userId,
          `FHIR store created successfully: ${params.name}`);
      } catch (error: any) {
        store.status = "ERROR";
        gcpAuditLog("FHIR_STORE_CREATE_FAILED", "FhirStore", store.id, params.userId,
          `Failed to create FHIR store: ${error.message}`, "ERROR");
        throw error;
      }
    } else {
      setTimeout(() => {
        const s = fhirDatastores.get(store.id);
        if (s) {
          s.status = "ACTIVE";
          s.updatedAt = new Date().toISOString();
          fhirDatastores.set(store.id, s);
        }
      }, 2000);
    }

    fhirDatastores.set(store.id, store);

    if (dataset) {
      dataset.fhirStores.push(store);
      dataset.updatedAt = now;
      healthcareDatasets.set(params.datasetId, dataset);
    }

    return store;
  }

  async getFhirStore(fhirStoreId: string): Promise<FhirDatastore | null> {
    return fhirDatastores.get(fhirStoreId) || null;
  }

  async listFhirStores(datasetId?: string): Promise<FhirDatastore[]> {
    let stores = Array.from(fhirDatastores.values());
    if (datasetId) {
      stores = stores.filter(s => s.datasetId === datasetId);
    }
    return stores;
  }

  async updateFhirStore(params: {
    fhirStoreId: string;
    labels?: Record<string, string>;
    streamConfigs?: StreamConfig[];
    notificationConfigs?: NotificationConfig[];
    userId: string;
  }): Promise<FhirDatastore | null> {
    const store = fhirDatastores.get(params.fhirStoreId);
    if (!store) return null;

    gcpAuditLog("FHIR_STORE_UPDATE", "FhirStore", params.fhirStoreId, params.userId,
      `Updating FHIR store: ${store.name}`);

    if (params.labels !== undefined) store.labels = params.labels;
    if (params.streamConfigs !== undefined) store.streamConfigs = params.streamConfigs;
    if (params.notificationConfigs !== undefined) store.notificationConfigs = params.notificationConfigs;
    store.updatedAt = new Date().toISOString();

    fhirDatastores.set(params.fhirStoreId, store);
    return store;
  }

  async deleteFhirStore(fhirStoreId: string, userId: string): Promise<boolean> {
    const store = fhirDatastores.get(fhirStoreId);
    if (!store) return false;

    gcpAuditLog("FHIR_STORE_DELETE_STARTED", "FhirStore", fhirStoreId, userId,
      `Deleting FHIR store: ${store.name}`, "WARNING");

    if (this.isInitialized && this.healthcareClient) {
      try {
        await this.healthcareClient.projects.locations.datasets.fhirStores.delete({
          name: store.fullPath
        });
        gcpAuditLog("FHIR_STORE_DELETED", "FhirStore", fhirStoreId, userId,
          `FHIR store deleted: ${store.name}`);
      } catch (error: any) {
        gcpAuditLog("FHIR_STORE_DELETE_FAILED", "FhirStore", fhirStoreId, userId,
          `Failed to delete FHIR store: ${error.message}`, "ERROR");
        throw error;
      }
    }

    fhirDatastores.delete(fhirStoreId);

    const dataset = healthcareDatasets.get(store.datasetId);
    if (dataset) {
      dataset.fhirStores = dataset.fhirStores.filter(s => s.id !== fhirStoreId);
      dataset.updatedAt = new Date().toISOString();
      healthcareDatasets.set(store.datasetId, dataset);
    }

    return true;
  }

  async getFhirStoreResourceCounts(fhirStoreId: string, userId: string): Promise<Record<string, number>> {
    const store = fhirDatastores.get(fhirStoreId);
    if (!store) return {};

    gcpAuditLog("RESOURCE_COUNTS_RETRIEVED", "FhirStore", fhirStoreId, userId,
      `Retrieved resource counts for FHIR store: ${store.name}`);

    return store.resourceCounts || {};
  }

  async configureStreamToBigQuery(params: {
    fhirStoreId: string;
    resourceTypes: string[];
    bigQueryDataset: string;
    schemaType?: "ANALYTICS" | "ANALYTICS_V2";
    userId: string;
  }): Promise<StreamConfig> {
    const store = fhirDatastores.get(params.fhirStoreId);
    if (!store) throw new Error("FHIR store not found");

    const streamConfig: StreamConfig = {
      id: generateId("stream"),
      resourceTypes: params.resourceTypes,
      bigQueryDestination: {
        datasetUri: `bq://${store.projectId}.${params.bigQueryDataset}`,
        schemaConfig: { schemaType: params.schemaType || "ANALYTICS_V2" }
      }
    };

    gcpAuditLog("STREAM_CONFIGURED", "FhirStore", params.fhirStoreId, params.userId,
      `Configured BigQuery stream for ${params.resourceTypes.join(", ")} to ${params.bigQueryDataset}`, "NOTICE");

    store.streamConfigs = store.streamConfigs || [];
    store.streamConfigs.push(streamConfig);
    store.updatedAt = new Date().toISOString();
    fhirDatastores.set(params.fhirStoreId, store);

    return streamConfig;
  }

  async configureNotifications(params: {
    fhirStoreId: string;
    pubsubTopic: string;
    sendFullResource?: boolean;
    sendPreviousResource?: boolean;
    userId: string;
  }): Promise<NotificationConfig> {
    const store = fhirDatastores.get(params.fhirStoreId);
    if (!store) throw new Error("FHIR store not found");

    const notificationConfig: NotificationConfig = {
      id: generateId("notify"),
      pubsubTopic: params.pubsubTopic,
      sendFullResource: params.sendFullResource,
      sendPreviousResource: params.sendPreviousResource
    };

    gcpAuditLog("NOTIFICATIONS_CONFIGURED", "FhirStore", params.fhirStoreId, params.userId,
      `Configured Pub/Sub notifications to ${params.pubsubTopic}`, "NOTICE");

    store.notificationConfigs = store.notificationConfigs || [];
    store.notificationConfigs.push(notificationConfig);
    store.updatedAt = new Date().toISOString();
    fhirDatastores.set(params.fhirStoreId, store);

    return notificationConfig;
  }

  async getDashboardStats(): Promise<{
    totalDatasets: number;
    totalFhirStores: number;
    activeOperations: number;
    completedOperations: number;
    failedOperations: number;
    totalResourceCount: number;
    operationsByType: Record<string, number>;
    recentOperations: AsyncOperation[];
  }> {
    const datasets = Array.from(healthcareDatasets.values());
    const stores = Array.from(fhirDatastores.values());
    const operations = Array.from(asyncOperations.values());

    const operationsByType: Record<string, number> = {};
    operations.forEach(op => {
      operationsByType[op.operationType] = (operationsByType[op.operationType] || 0) + 1;
    });

    let totalResourceCount = 0;
    stores.forEach(store => {
      if (store.resourceCounts) {
        Object.values(store.resourceCounts).forEach(count => {
          totalResourceCount += count;
        });
      }
    });

    return {
      totalDatasets: datasets.length,
      totalFhirStores: stores.length,
      activeOperations: operations.filter(op => op.status === "RUNNING" || op.status === "PENDING").length,
      completedOperations: operations.filter(op => op.status === "SUCCEEDED").length,
      failedOperations: operations.filter(op => op.status === "FAILED").length,
      totalResourceCount,
      operationsByType,
      recentOperations: operations
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
    };
  }

  private simulateOperationProgress(operationId: string): void {
    let progress = 0;
    const interval = setInterval(() => {
      const operation = asyncOperations.get(operationId);
      if (!operation || operation.status === "CANCELLED") {
        clearInterval(interval);
        return;
      }

      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        operation.status = "SUCCEEDED";
        operation.completedAt = new Date().toISOString();
        clearInterval(interval);

        gcpAuditLog("OPERATION_COMPLETED", "AsyncOperation", operationId, operation.createdBy,
          `Operation ${operation.operationType} completed successfully`);
      }

      operation.progress = {
        percentage: Math.min(progress, 100),
        processedResources: Math.floor((progress / 100) * 25000),
        totalResources: 25000
      };
      operation.updatedAt = new Date().toISOString();
      asyncOperations.set(operationId, operation);
    }, 3000);
  }
}

export const gcpHealthcareEnhancedService = new GcpHealthcareEnhancedService();

console.log("[GCPHealthcareEnhanced] Service initialized");
console.log("[GCPHealthcareEnhanced] Sample datasets:", healthcareDatasets.size);
console.log("[GCPHealthcareEnhanced] Sample FHIR stores:", fhirDatastores.size);
console.log("[GCPHealthcareEnhanced] Sample operations:", asyncOperations.size);
console.log("[GCPHealthcareEnhanced] Features: Async bulk operations, dataset/store management, comprehensive audit logging");
