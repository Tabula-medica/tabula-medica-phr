import { Router } from "express";
import * as healthData from "./services/comprehensive-health-data-integrations";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, resourceId: string, details: string) {
  console.log(`[HIPAA-AUDIT][HealthDataRoutes] ${action} - ${resourceId} by ${hashIdentifier(userId)}: ${details}`);
}

router.get("/api/health-data-integrations/types", async (req, res) => {
  try {
    const types = healthData.getAvailableIntegrationTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error("[HealthDataIntegrations] Get types error:", error);
    res.status(500).json({ success: false, error: "Failed to get integration types" });
  }
});

router.get("/api/health-data-integrations/categories", async (req, res) => {
  try {
    const categories = healthData.getIntegrationsByCategory();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("[HealthDataIntegrations] Get categories error:", error);
    res.status(500).json({ success: false, error: "Failed to get integration categories" });
  }
});

router.post("/api/health-data-integrations/create", async (req, res) => {
  try {
    const { userId, type, endpoint, authMethod, syncFrequency, metadata, permissions } = req.body;

    if (!userId || !type || !endpoint) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, type, endpoint",
      });
    }

    logHipaaAudit("CREATE_INTEGRATION", userId, "new", `Creating ${type} integration`);

    const integration = await healthData.createIntegration(userId, type, {
      endpoint,
      authMethod: authMethod || "smart_on_fhir",
      syncFrequency: syncFrequency || "daily",
      metadata,
      permissions,
    });

    res.json({ success: true, data: integration });
  } catch (error) {
    console.error("[HealthDataIntegrations] Create error:", error);
    res.status(500).json({ success: false, error: "Failed to create integration" });
  }
});

router.get("/api/health-data-integrations/user/:userId", async (req, res) => {
  try {
    const integrations = healthData.getUserIntegrations(req.params.userId);
    logHipaaAudit("VIEW_INTEGRATIONS", req.params.userId, "list", `Retrieved ${integrations.length} integrations`);
    res.json({ success: true, data: integrations });
  } catch (error) {
    console.error("[HealthDataIntegrations] Get user integrations error:", error);
    res.status(500).json({ success: false, error: "Failed to get user integrations" });
  }
});

router.get("/api/health-data-integrations/:integrationId", async (req, res) => {
  try {
    const integration = healthData.getIntegration(req.params.integrationId);
    if (!integration) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }
    res.json({ success: true, data: integration });
  } catch (error) {
    console.error("[HealthDataIntegrations] Get integration error:", error);
    res.status(500).json({ success: false, error: "Failed to get integration" });
  }
});

router.patch("/api/health-data-integrations/:integrationId/state", async (req, res) => {
  try {
    const { userId, state, errorMessage } = req.body;

    if (!userId || !state) {
      return res.status(400).json({ success: false, error: "Missing userId or state" });
    }

    const integration = await healthData.updateIntegrationState(
      req.params.integrationId,
      userId,
      state,
      errorMessage
    );

    if (!integration) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    logHipaaAudit("UPDATE_STATE", userId, req.params.integrationId, `State updated to ${state}`);
    res.json({ success: true, data: integration });
  } catch (error) {
    console.error("[HealthDataIntegrations] Update state error:", error);
    res.status(500).json({ success: false, error: "Failed to update state" });
  }
});

router.post("/api/health-data-integrations/:integrationId/sync", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    logHipaaAudit("START_SYNC", userId, req.params.integrationId, "Starting sync");

    const result = await healthData.syncIntegration(req.params.integrationId, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[HealthDataIntegrations] Sync error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to sync" });
  }
});

router.get("/api/health-data-integrations/sync-history/:userId", async (req, res) => {
  try {
    const integrationId = req.query.integrationId as string | undefined;
    const history = healthData.getSyncHistory(req.params.userId, integrationId);

    logHipaaAudit("VIEW_SYNC_HISTORY", req.params.userId, integrationId || "all", `Retrieved ${history.length} sync results`);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("[HealthDataIntegrations] Get sync history error:", error);
    res.status(500).json({ success: false, error: "Failed to get sync history" });
  }
});

router.post("/api/health-data-integrations/:integrationId/disconnect", async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const success = await healthData.disconnectIntegration(req.params.integrationId, userId, reason);

    if (!success) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    logHipaaAudit("DISCONNECT", userId, req.params.integrationId, `Disconnected: ${reason || "No reason"}`);
    res.json({ success: true, message: "Integration disconnected" });
  } catch (error) {
    console.error("[HealthDataIntegrations] Disconnect error:", error);
    res.status(500).json({ success: false, error: "Failed to disconnect" });
  }
});

router.get("/api/health-data-integrations/:integrationId/audit", async (req, res) => {
  try {
    const auditLog = healthData.getIntegrationAuditLog(req.params.integrationId);
    res.json({ success: true, data: auditLog });
  } catch (error) {
    console.error("[HealthDataIntegrations] Get audit log error:", error);
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

export function registerHealthDataIntegrationRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Comprehensive Health Data Integration routes registered at /api/health-data-integrations/*");
}

export default router;
