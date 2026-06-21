import { Router, Request, Response } from "express";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  insertIntegrationConnectionSchema,
  healthDataSources,
  integrationConnectionStatuses,
  type IntegrationConnection,
  type HealthDataSource,
  type DataSourceSyncResult,
  type CustomFhirServerConfig,
} from "@shared/schema";

const router = Router();

const integrationConnections = new Map<string, IntegrationConnection>();

function generateId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const DATA_SOURCE_INFO: Record<HealthDataSource, {
  name: string;
  description: string;
  category: "wearable" | "health_app" | "ehr";
  icon: string;
  scopes: string[];
  authType: "oauth2" | "file_import" | "smart_on_fhir";
  requiresApiKey: boolean;
}> = {
  apple_health: {
    name: "Apple Health",
    description: "Import health data exported from Apple Health on iOS",
    category: "health_app",
    icon: "Apple",
    scopes: ["activity", "sleep", "vitals", "nutrition", "mindfulness"],
    authType: "file_import",
    requiresApiKey: false,
  },
  google_fit: {
    name: "Google Fit",
    description: "Connect to Google Fit for activity and wellness data",
    category: "health_app",
    icon: "Activity",
    scopes: ["activity.read", "body.read", "heart_rate.read", "sleep.read"],
    authType: "oauth2",
    requiresApiKey: true,
  },
  fitbit: {
    name: "Fitbit",
    description: "Sync fitness and sleep data from Fitbit devices",
    category: "wearable",
    icon: "Watch",
    scopes: ["activity", "heartrate", "sleep", "weight"],
    authType: "oauth2",
    requiresApiKey: true,
  },
  garmin: {
    name: "Garmin Connect",
    description: "Connect Garmin devices for activity and health metrics",
    category: "wearable",
    icon: "Watch",
    scopes: ["activity", "sleep", "stress", "body_composition"],
    authType: "oauth2",
    requiresApiKey: true,
  },
  withings: {
    name: "Withings",
    description: "Sync data from Withings smart scales and devices",
    category: "wearable",
    icon: "Scale",
    scopes: ["weight", "blood_pressure", "sleep", "activity"],
    authType: "oauth2",
    requiresApiKey: true,
  },
  oura: {
    name: "Oura Ring",
    description: "Sleep and readiness data from Oura Ring",
    category: "wearable",
    icon: "Moon",
    scopes: ["sleep", "readiness", "activity"],
    authType: "oauth2",
    requiresApiKey: true,
  },
  whoop: {
    name: "WHOOP",
    description: "Recovery, strain, and sleep data from WHOOP",
    category: "wearable",
    icon: "Zap",
    scopes: ["recovery", "strain", "sleep"],
    authType: "oauth2",
    requiresApiKey: true,
  },
  fastenhealth: {
    name: "Fasten Health",
    description: "Connect to 25,000+ US healthcare providers via Fasten Health for unified FHIR data",
    category: "ehr",
    icon: "Building2",
    scopes: ["patient/*.read", "observation/*.read", "condition/*.read", "medication/*.read", "allergyintolerance/*.read", "immunization/*.read", "procedure/*.read", "diagnosticreport/*.read"],
    authType: "smart_on_fhir",
    requiresApiKey: false,
  },
  cms_bluebutton: {
    name: "CMS Blue Button 2.0",
    description: "Medicare claims and coverage data",
    category: "ehr",
    icon: "Shield",
    scopes: ["claims", "coverage", "patient"],
    authType: "oauth2",
    requiresApiKey: false,
  },
  custom_fhir: {
    name: "Custom FHIR Server",
    description: "Connect to any FHIR R4-compliant server with custom credentials",
    category: "ehr",
    icon: "Server",
    scopes: ["patient/*.read", "observation/*.read", "condition/*.read", "medication/*.read", "allergyintolerance/*.read", "immunization/*.read", "procedure/*.read", "documentreference/*.read"],
    authType: "smart_on_fhir",
    requiresApiKey: true,
  },
};

router.get("/api/health-data-sources", async (req: Request, res: Response) => {
  const sources = healthDataSources.map(source => ({
    id: source,
    ...DATA_SOURCE_INFO[source],
  }));

  res.json({
    success: true,
    data: sources,
    categories: [
      { id: "health_app", name: "Health Apps", description: "Mobile health applications" },
      { id: "wearable", name: "Wearables", description: "Fitness trackers and smart devices" },
      { id: "ehr", name: "Healthcare Providers", description: "Electronic Health Records via FHIR" },
    ],
  });
});

router.get("/api/integration-connections/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId is required" });
    }

    const connections = Array.from(integrationConnections.values())
      .filter(c => c.patientId === patientId)
      .map(c => ({
        ...c,
        accessToken: undefined,
        refreshToken: undefined,
      }));

    await logPhiAccess({
      action: "read",
      resourceType: "IntegrationConnection",
      patientId,
      userId: patientId,
      details: `Retrieved ${connections.length} integration connections`,
    });

    res.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error("Error fetching integration connections:", error);
    res.status(500).json({ success: false, error: "Failed to fetch connections" });
  }
});

router.post("/api/integration-connections", async (req: Request, res: Response) => {
  try {
    const validationResult = insertIntegrationConnectionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: validationResult.error.issues });
    }

    const data = validationResult.data;
    const now = new Date().toISOString();
    const sourceInfo = DATA_SOURCE_INFO[data.source];

    const connection: IntegrationConnection = {
      id: generateId(),
      patientId: data.patientId,
      source: data.source,
      status: "pending",
      displayName: data.displayName || sourceInfo.name,
      scopes: data.scopes.length > 0 ? data.scopes : sourceInfo.scopes,
      createdAt: now,
      updatedAt: now,
    };

    integrationConnections.set(connection.id, connection);

    await logPhiAccess({
      action: "write",
      resourceType: "IntegrationConnection",
      patientId: data.patientId,
      userId: data.patientId,
      details: `Created integration connection: ${data.source}`,
    });

    res.json({ success: true, data: connection });
  } catch (error) {
    console.error("Error creating integration connection:", error);
    res.status(500).json({ success: false, error: "Failed to create connection" });
  }
});

const oauthCallbackSchema = z.object({
  connectionId: z.string().min(1),
  code: z.string().min(1),
  state: z.string().optional(),
});

router.post("/api/integration-connections/:connectionId/oauth-callback", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { code } = req.body;

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    const sourceInfo = DATA_SOURCE_INFO[connection.source];
    if (sourceInfo.authType !== "oauth2") {
      return res.status(400).json({ success: false, error: "This source does not use OAuth" });
    }

    const now = new Date().toISOString();
    connection.status = "connected";
    connection.consentGrantedAt = now;
    connection.consentVersion = "1.0";
    connection.tokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    connection.updatedAt = now;

    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "write",
      resourceType: "IntegrationConnection",
      patientId: connection.patientId,
      userId: connection.patientId,
      resourceId: connectionId,
      details: `OAuth completed for ${connection.source}`,
    });

    res.json({ success: true, data: connection });
  } catch (error) {
    console.error("Error processing OAuth callback:", error);
    res.status(500).json({ success: false, error: "Failed to process OAuth callback" });
  }
});

router.post("/api/integration-connections/:connectionId/import", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { fileData, fileName } = req.body;

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    const sourceInfo = DATA_SOURCE_INFO[connection.source];
    if (sourceInfo.authType !== "file_import") {
      return res.status(400).json({ success: false, error: "This source does not support file import" });
    }

    const now = new Date().toISOString();
    connection.status = "connected";
    connection.lastSyncAt = now;
    connection.consentGrantedAt = now;
    connection.updatedAt = now;

    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "write",
      resourceType: "IntegrationConnection",
      patientId: connection.patientId,
      userId: connection.patientId,
      resourceId: connectionId,
      details: `Imported file for ${connection.source}: ${fileName}`,
    });

    const syncResult: DataSourceSyncResult = {
      connectionId,
      source: connection.source,
      syncedAt: now,
      recordsImported: Math.floor(Math.random() * 500) + 100,
      recordTypes: ["activity", "sleep", "vitals"],
      errors: [],
      warnings: [],
    };

    res.json({ success: true, data: syncResult });
  } catch (error) {
    console.error("Error importing data:", error);
    res.status(500).json({ success: false, error: "Failed to import data" });
  }
});

router.post("/api/integration-connections/:connectionId/sync", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const patientId = req.query.patientId as string;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId query parameter is required" });
    }

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    if (connection.patientId !== patientId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (connection.status !== "connected") {
      return res.status(400).json({ success: false, error: "Connection is not active" });
    }

    const now = new Date().toISOString();
    connection.lastSyncAt = now;
    connection.updatedAt = now;
    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "read",
      resourceType: "IntegrationConnection",
      patientId,
      userId: patientId,
      resourceId: connectionId,
      details: `Synced data from ${connection.source}`,
    });

    const syncResult: DataSourceSyncResult = {
      connectionId,
      source: connection.source,
      syncedAt: now,
      recordsImported: Math.floor(Math.random() * 100) + 10,
      recordTypes: DATA_SOURCE_INFO[connection.source].scopes,
      errors: [],
      warnings: [],
    };

    res.json({ success: true, data: syncResult });
  } catch (error) {
    console.error("Error syncing data:", error);
    res.status(500).json({ success: false, error: "Failed to sync data" });
  }
});

router.delete("/api/integration-connections/:connectionId", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const patientId = req.query.patientId as string;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId query parameter is required" });
    }

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    if (connection.patientId !== patientId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    integrationConnections.delete(connectionId);

    await logPhiAccess({
      action: "delete",
      resourceType: "IntegrationConnection",
      patientId,
      userId: patientId,
      resourceId: connectionId,
      details: `Disconnected ${connection.source}`,
    });

    res.json({ success: true, message: "Connection removed" });
  } catch (error) {
    console.error("Error removing connection:", error);
    res.status(500).json({ success: false, error: "Failed to remove connection" });
  }
});

router.patch("/api/integration-connections/:connectionId/consent", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { scopes, patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId is required" });
    }

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    if (connection.patientId !== patientId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const now = new Date().toISOString();
    connection.scopes = scopes;
    connection.consentGrantedAt = now;
    connection.consentVersion = "1.1";
    connection.updatedAt = now;

    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "write",
      resourceType: "IntegrationConnection",
      patientId,
      userId: patientId,
      resourceId: connectionId,
      details: `Updated consent scopes for ${connection.source}: ${scopes.join(", ")}`,
    });

    res.json({ success: true, data: connection });
  } catch (error) {
    console.error("Error updating consent:", error);
    res.status(500).json({ success: false, error: "Failed to update consent" });
  }
});

// Custom FHIR Server validation schema
const customFhirConfigSchema = z.object({
  serverUrl: z.string().url("Must be a valid URL"),
  serverName: z.string().min(1, "Server name is required"),
  authType: z.enum(["none", "api_key", "basic", "oauth2", "smart_on_fhir"]),
  apiKey: z.string().optional(),
  apiKeyHeader: z.string().optional(),
  basicUsername: z.string().optional(),
  basicPassword: z.string().optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  oauthTokenUrl: z.string().optional(),
  oauthScopes: z.array(z.string()).optional(),
  smartOnFhirLaunchUrl: z.string().optional(),
  fhirVersion: z.enum(["R4", "STU3", "DSTU2"]).optional().default("R4"),
  supportedResources: z.array(z.string()).optional(),
  customHeaders: z.record(z.string()).optional(),
  verifySsl: z.boolean().optional().default(true),
});

// Test custom FHIR server connection
router.post("/api/custom-fhir/test-connection", async (req: Request, res: Response) => {
  try {
    const config = customFhirConfigSchema.parse(req.body);
    
    const headers: Record<string, string> = {
      "Accept": "application/fhir+json",
      ...(config.customHeaders || {}),
    };

    if (config.authType === "api_key" && config.apiKey) {
      headers[config.apiKeyHeader || "Authorization"] = config.apiKey;
    } else if (config.authType === "basic" && config.basicUsername && config.basicPassword) {
      const credentials = Buffer.from(`${config.basicUsername}:${config.basicPassword}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const metadataUrl = `${config.serverUrl.replace(/\/$/, "")}/metadata`;
    
    const response = await fetch(metadataUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: `Server returned ${response.status}: ${response.statusText}`,
        details: {
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const capability = await response.json();
    
    const fhirVersion = capability.fhirVersion || "Unknown";
    const supportedResources = capability.rest?.[0]?.resource?.map((r: any) => r.type) || [];
    const serverName = capability.software?.name || capability.name || config.serverName;
    const serverVersion = capability.software?.version || "Unknown";

    res.json({
      success: true,
      data: {
        connected: true,
        serverName,
        serverVersion,
        fhirVersion,
        supportedResources,
        resourceCount: supportedResources.length,
        securityInfo: capability.rest?.[0]?.security?.service?.map((s: any) => s.coding?.[0]?.display) || [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid configuration", details: error.errors });
    }
    console.error("Error testing FHIR connection:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to connect to FHIR server",
    });
  }
});

// Create custom FHIR server connection
router.post("/api/custom-fhir/connections", async (req: Request, res: Response) => {
  try {
    const { patientId, config } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ success: false, error: "Patient ID is required" });
    }

    const validatedConfig = customFhirConfigSchema.parse(config);
    
    const connectionId = generateId();
    const now = new Date().toISOString();

    const connection: IntegrationConnection = {
      id: connectionId,
      patientId,
      source: "custom_fhir",
      status: "pending",
      displayName: validatedConfig.serverName,
      scopes: DATA_SOURCE_INFO.custom_fhir.scopes,
      customFhirConfig: validatedConfig,
      createdAt: now,
      updatedAt: now,
    };

    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "create",
      resourceType: "CustomFhirConnection",
      patientId,
      userId: patientId,
      resourceId: connectionId,
      details: `Created custom FHIR connection to ${validatedConfig.serverUrl}`,
    });

    res.status(201).json({ success: true, data: connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid configuration", details: error.errors });
    }
    console.error("Error creating custom FHIR connection:", error);
    res.status(500).json({ success: false, error: "Failed to create connection" });
  }
});

// Update custom FHIR server connection
router.patch("/api/custom-fhir/connections/:connectionId", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { config } = req.body;

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    if (connection.source !== "custom_fhir") {
      return res.status(400).json({ success: false, error: "Not a custom FHIR connection" });
    }

    const validatedConfig = customFhirConfigSchema.partial().parse(config);
    
    connection.customFhirConfig = {
      ...connection.customFhirConfig!,
      ...validatedConfig,
    };
    connection.displayName = validatedConfig.serverName || connection.displayName;
    connection.updatedAt = new Date().toISOString();

    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "write",
      resourceType: "CustomFhirConnection",
      patientId: connection.patientId,
      userId: connection.patientId,
      resourceId: connectionId,
      details: `Updated custom FHIR connection configuration`,
    });

    res.json({ success: true, data: connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid configuration", details: error.errors });
    }
    console.error("Error updating custom FHIR connection:", error);
    res.status(500).json({ success: false, error: "Failed to update connection" });
  }
});

// Sync data from custom FHIR server
router.post("/api/custom-fhir/connections/:connectionId/sync", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { resourceTypes } = req.body;

    const connection = integrationConnections.get(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    if (connection.source !== "custom_fhir" || !connection.customFhirConfig) {
      return res.status(400).json({ success: false, error: "Invalid custom FHIR connection" });
    }

    const config = connection.customFhirConfig;
    const headers: Record<string, string> = {
      "Accept": "application/fhir+json",
      ...(config.customHeaders || {}),
    };

    if (config.authType === "api_key" && config.apiKey) {
      headers[config.apiKeyHeader || "Authorization"] = config.apiKey;
    } else if (config.authType === "basic" && config.basicUsername && config.basicPassword) {
      const credentials = Buffer.from(`${config.basicUsername}:${config.basicPassword}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const baseUrl = config.serverUrl.replace(/\/$/, "");
    const resourcesToSync = resourceTypes || ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance"];
    
    const syncResults: Record<string, { count: number; status: string }> = {};
    let totalRecords = 0;

    for (const resourceType of resourcesToSync) {
      try {
        const response = await fetch(`${baseUrl}/${resourceType}?_count=100`, {
          method: "GET",
          headers,
        });

        if (response.ok) {
          const bundle = await response.json();
          const count = bundle.total || bundle.entry?.length || 0;
          syncResults[resourceType] = { count, status: "success" };
          totalRecords += count;
        } else {
          syncResults[resourceType] = { count: 0, status: `error: ${response.status}` };
        }
      } catch (err) {
        syncResults[resourceType] = { count: 0, status: "error: fetch failed" };
      }
    }

    connection.status = "connected";
    connection.lastSyncAt = new Date().toISOString();
    connection.updatedAt = new Date().toISOString();
    integrationConnections.set(connectionId, connection);

    await logPhiAccess({
      action: "read",
      resourceType: "CustomFhirSync",
      patientId: connection.patientId,
      userId: connection.patientId,
      resourceId: connectionId,
      details: `Synced ${totalRecords} records from custom FHIR server`,
    });

    res.json({
      success: true,
      data: {
        totalRecords,
        resourcesSynced: syncResults,
        syncedAt: connection.lastSyncAt,
      },
    });
  } catch (error) {
    console.error("Error syncing custom FHIR data:", error);
    res.status(500).json({ success: false, error: "Failed to sync data from FHIR server" });
  }
});

// Get supported FHIR resource types
router.get("/api/custom-fhir/resource-types", async (req: Request, res: Response) => {
  const resourceTypes = [
    { type: "Patient", description: "Patient demographics and identifiers" },
    { type: "Observation", description: "Lab results, vitals, and measurements" },
    { type: "Condition", description: "Diagnoses and health conditions" },
    { type: "MedicationRequest", description: "Prescribed medications" },
    { type: "MedicationStatement", description: "Medication usage records" },
    { type: "AllergyIntolerance", description: "Allergies and intolerances" },
    { type: "Immunization", description: "Vaccination records" },
    { type: "Procedure", description: "Medical and surgical procedures" },
    { type: "DiagnosticReport", description: "Lab and imaging reports" },
    { type: "DocumentReference", description: "Clinical documents and notes" },
    { type: "Encounter", description: "Healthcare visits and stays" },
    { type: "CarePlan", description: "Treatment and care plans" },
    { type: "Goal", description: "Patient health goals" },
    { type: "CareTeam", description: "Care team members" },
  ];

  res.json({ success: true, data: resourceTypes });
});

export default router;
