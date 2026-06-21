import { Express, Request, Response } from "express";
import {
  dataSourceOnboardingWizard,
  ConnectionConfig,
  AnomalyDetectionConfig,
} from "./services/data-source-onboarding-wizard";

export function registerDataSourceOnboardingRoutes(app: Express): void {
  const BASE_PATH = "/api/data-onboarding";

  app.post(`${BASE_PATH}/sessions`, async (req: Request, res: Response) => {
    try {
      const config: ConnectionConfig = req.body;
      const userId = (req as any).user?.id || "anonymous";

      if (!config.type || !config.name) {
        return res.status(400).json({
          error: "Connection type and name are required",
        });
      }

      const session = await dataSourceOnboardingWizard.createOnboardingSession(config, userId);
      res.json(session);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error creating session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get(`${BASE_PATH}/sessions/:sessionId`, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const session = dataSourceOnboardingWizard.getSession(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json(session);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error getting session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${BASE_PATH}/sessions/:sessionId/test-connection`, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const result = await dataSourceOnboardingWizard.testConnection(sessionId, userId);
      res.json(result);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error testing connection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${BASE_PATH}/sessions/:sessionId/profile-data`, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const profile = await dataSourceOnboardingWizard.profileSampleData(sessionId, userId);
      res.json(profile);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error profiling data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${BASE_PATH}/sessions/:sessionId/anomaly-config`, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const config: AnomalyDetectionConfig = req.body;
      const userId = (req as any).user?.id || "anonymous";

      const session = await dataSourceOnboardingWizard.configureAnomalyDetection(
        sessionId,
        config,
        userId
      );
      res.json(session);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error configuring anomaly detection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${BASE_PATH}/sessions/:sessionId/complete`, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const source = await dataSourceOnboardingWizard.completeOnboarding(sessionId, userId);
      res.json(source);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error completing onboarding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get(`${BASE_PATH}/sources`, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "anonymous";
      const sources = dataSourceOnboardingWizard.getRegisteredSources(userId);
      res.json(sources);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error getting sources:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get(`${BASE_PATH}/sources/:sourceId`, async (req: Request, res: Response) => {
    try {
      const { sourceId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const source = dataSourceOnboardingWizard.getRegisteredSource(sourceId, userId);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }

      res.json(source);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error getting source:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${BASE_PATH}/sources/:sourceId/anomaly-check`, async (req: Request, res: Response) => {
    try {
      const { sourceId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const alerts = await dataSourceOnboardingWizard.triggerAnomalyCheck(sourceId, userId);
      res.json({ alerts, checkedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error triggering anomaly check:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get(`${BASE_PATH}/sources/:sourceId/alerts`, async (req: Request, res: Response) => {
    try {
      const { sourceId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const alerts = dataSourceOnboardingWizard.getAnomalyAlerts(sourceId, userId);
      res.json(alerts);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error getting alerts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${BASE_PATH}/sources/:sourceId/alerts/:alertId/acknowledge`, async (req: Request, res: Response) => {
    try {
      const { sourceId, alertId } = req.params;
      const userId = (req as any).user?.id || "anonymous";

      const alert = await dataSourceOnboardingWizard.acknowledgeAlert(alertId, sourceId, userId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json(alert);
    } catch (error: any) {
      console.error("[OnboardingRoutes] Error acknowledging alert:", error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log("[OnboardingRoutes] Routes registered at /api/data-onboarding/*");
  console.log("[OnboardingRoutes] Endpoints: /sessions, /sources, /test-connection, /profile-data, /anomaly-check");
}
