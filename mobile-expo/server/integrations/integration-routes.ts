import { Request, Response, Router } from "express";
import { 
  createAggregatorClient, 
  getSupportedProviders, 
  EHR_PROVIDER_REGISTRY,
  type AggregatorProvider,
} from "./health-aggregator-client";
import { 
  createWearableClient, 
  getSupportedWearableSources,
} from "./wearable-aggregator-client";
import { storage } from "../storage";
import { AuditService, AuditAction, ResourceType } from "../compliance/audit-service";

const router = Router();

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function getQueryParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) return value[0] as string;
  return value as string | undefined;
}

function getAuthenticatedUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

router.get("/providers", async (_req: Request, res: Response) => {
  try {
    const healthAggregators = getSupportedProviders();
    const wearableSources = getSupportedWearableSources();
    const ehrProviders = EHR_PROVIDER_REGISTRY;

    res.json({
      healthAggregators: Object.entries(healthAggregators).map(([id, provider]) => ({
        id,
        ...provider,
        available: !!createAggregatorClient(id as AggregatorProvider),
      })),
      wearableSources: Object.entries(wearableSources).map(([id, provider]) => ({
        id,
        ...provider,
        available: !!createWearableClient(),
      })),
      ehrProviders: Object.entries(ehrProviders).map(([id, provider]) => ({
        id,
        ...provider,
      })),
    });
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({ error: "Failed to get providers" });
  }
});

router.get("/aggregator/:provider/auth-url", async (req: Request, res: Response) => {
  try {
    const provider = getParam(req, "provider");
    const redirectUri = getQueryParam(req, "redirectUri");
    const state = getQueryParam(req, "state");

    if (!redirectUri || !state) {
      return res.status(400).json({ error: "Missing redirectUri or state" });
    }

    const client = createAggregatorClient(provider as AggregatorProvider);
    if (!client) {
      return res.status(400).json({ 
        error: "Aggregator not configured",
        message: `Please configure ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET environment variables`,
      });
    }

    const authUrl = await client.getAuthorizationUrl(redirectUri, state);

    res.json({ authUrl });
  } catch (error) {
    console.error("Get auth URL error:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

router.post("/aggregator/:provider/callback", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const provider = getParam(req, "provider");
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: "Missing code or redirectUri" });
    }

    const client = createAggregatorClient(provider as AggregatorProvider);
    if (!client) {
      return res.status(400).json({ error: "Aggregator not configured" });
    }

    const tokens = await client.exchangeCodeForToken(code, redirectUri);

    const source = await storage.createDataSource({
      userId,
      name: `${provider} Connected Sources`,
      type: provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresIn 
        ? new Date(Date.now() + tokens.expiresIn * 1000) 
        : undefined,
      patientId: tokens.userId,
      isConnected: true,
    });

    const connectedSources = await client.getConnectedSources(tokens.accessToken);

    AuditService.phiAccess(req, AuditAction.CREATE_PHI, ResourceType.DATA_SOURCE, source.id, {
      phiDetails: {
        recordCount: connectedSources.length,
        accessReason: `Connected ${provider} aggregator`,
      },
    });

    res.json({
      source,
      connectedSources,
    });
  } catch (error) {
    console.error("Aggregator callback error:", error);
    res.status(500).json({ error: "Failed to complete connection" });
  }
});

router.post("/aggregator/:sourceId/sync", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const sourceId = getParam(req, "sourceId");

    const source = await storage.getDataSource(sourceId);
    if (!source || source.userId !== userId) {
      return res.status(404).json({ error: "Data source not found" });
    }

    const client = createAggregatorClient(source.type as AggregatorProvider);
    if (!client) {
      return res.status(400).json({ error: "Aggregator not configured" });
    }

    if (!source.accessToken) {
      return res.status(400).json({ error: "Access token missing, reconnection required" });
    }

    const result = await client.syncToDatabase(userId, sourceId, source.accessToken, req);

    await storage.updateDataSource(sourceId, { 
      lastSyncAt: new Date(),
      recordCount: (source.recordCount || 0) + result.imported,
    });

    res.json({
      success: true,
      imported: result.imported,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Aggregator sync error:", error);
    res.status(500).json({ error: "Failed to sync data" });
  }
});

router.get("/wearable/widget-session", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const client = createWearableClient();

    if (!client) {
      return res.status(400).json({ 
        error: "Wearable aggregator not configured",
        message: "Please configure TERRA_API_KEY and TERRA_DEV_ID environment variables",
      });
    }

    const session = await client.generateWidgetSession(userId, userId);

    res.json(session);
  } catch (error) {
    console.error("Widget session error:", error);
    res.status(500).json({ error: "Failed to generate widget session" });
  }
});

router.get("/wearable/:terraUserId/devices", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const terraUserId = getParam(req, "terraUserId");

    const userSources = await storage.getDataSources(userId);
    const ownsSource = userSources.some((s) => s.patientId === terraUserId);
    if (!ownsSource) {
      return res.status(403).json({ error: "Access denied" });
    }

    const client = createWearableClient();

    if (!client) {
      return res.status(400).json({ error: "Wearable aggregator not configured" });
    }

    const devices = await client.getUserConnections(terraUserId);

    res.json({ devices });
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({ error: "Failed to get connected devices" });
  }
});

router.post("/wearable/:sourceId/sync", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const sourceId = getParam(req, "sourceId");
    const { daysBack = 30 } = req.body;

    const source = await storage.getDataSource(sourceId);
    if (!source || source.userId !== userId) {
      return res.status(404).json({ error: "Data source not found" });
    }

    // Derive the Terra user ID exclusively from the server-authoritative source
    // record — never from req.body — so an attacker cannot supply a different
    // Terra user ID to pull another patient's wearable data into their account.
    const terraUserId = source.patientId;
    if (!terraUserId) {
      return res.status(400).json({ error: "Wearable source has no linked Terra user" });
    }

    const client = createWearableClient();
    if (!client) {
      return res.status(400).json({ error: "Wearable aggregator not configured" });
    }

    const result = await client.syncToDatabase(userId, sourceId, terraUserId, daysBack, req);

    await storage.updateDataSource(sourceId, { 
      lastSyncAt: new Date(),
      recordCount: (source.recordCount || 0) + result.imported,
    });

    res.json({
      success: true,
      imported: result.imported,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Wearable sync error:", error);
    res.status(500).json({ error: "Failed to sync wearable data" });
  }
});

router.get("/wearable/:terraUserId/data", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const terraUserId = getParam(req, "terraUserId");

    const userSources = await storage.getDataSources(userId);
    const ownsSource = userSources.some((s) => s.patientId === terraUserId);
    if (!ownsSource) {
      return res.status(403).json({ error: "Access denied" });
    }

    const startDateStr = getQueryParam(req, "startDate");
    const endDateStr = getQueryParam(req, "endDate");
    const typesStr = getQueryParam(req, "types");

    const client = createWearableClient();
    if (!client) {
      return res.status(400).json({ error: "Wearable aggregator not configured" });
    }

    const start = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDateStr ? new Date(endDateStr) : new Date();

    const requestedTypes = typesStr ? typesStr.split(",") : ["activity", "sleep", "body", "daily"];

    const data: Record<string, any[]> = {};

    if (requestedTypes.includes("activity")) {
      data.activity = await client.getActivityData(terraUserId, start, end).catch(() => []);
    }
    if (requestedTypes.includes("sleep")) {
      data.sleep = await client.getSleepData(terraUserId, start, end).catch(() => []);
    }
    if (requestedTypes.includes("body")) {
      data.body = await client.getBodyData(terraUserId, start, end).catch(() => []);
    }
    if (requestedTypes.includes("daily")) {
      data.daily = await client.getDailyData(terraUserId, start, end).catch(() => []);
    }

    res.json(data);
  } catch (error) {
    console.error("Get wearable data error:", error);
    res.status(500).json({ error: "Failed to get wearable data" });
  }
});

router.get("/ehr-providers", async (_req: Request, res: Response) => {
  try {
    const providers = Object.entries(EHR_PROVIDER_REGISTRY).map(([id, provider]) => ({
      id,
      ...provider,
    }));

    res.json({ providers });
  } catch (error) {
    console.error("Get EHR providers error:", error);
    res.status(500).json({ error: "Failed to get EHR providers" });
  }
});

export default router;
