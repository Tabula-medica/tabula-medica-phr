import { Express, Request, Response } from "express";
import { smartAppRegistrationService } from "./services/smart-app-registration-service";

export function registerSmartAppRegistrationRoutes(app: Express): void {
  const prefix = "/api/smart-apps";

  app.get(`${prefix}`, async (req: Request, res: Response) => {
    try {
      const apps = smartAppRegistrationService.listApps({
        status: req.query.status as any,
        appType: req.query.appType as any,
        enabledForPatients: req.query.enabledForPatients === "true" ? true : req.query.enabledForPatients === "false" ? false : undefined,
        enabledForProviders: req.query.enabledForProviders === "true" ? true : req.query.enabledForProviders === "false" ? false : undefined,
        featured: req.query.featured === "true" ? true : req.query.featured === "false" ? false : undefined,
        search: req.query.search as string
      });
      res.json({ apps });
    } catch (error: any) {
      console.error("[SMART-Apps] Error listing apps:", error);
      res.status(500).json({ error: "Failed to list apps" });
    }
  });

  app.get(`${prefix}/patient`, async (_req: Request, res: Response) => {
    try {
      const apps = smartAppRegistrationService.getPatientApps();
      res.json({ apps });
    } catch (error: any) {
      console.error("[SMART-Apps] Error getting patient apps:", error);
      res.status(500).json({ error: "Failed to get patient apps" });
    }
  });

  app.get(`${prefix}/dashboard`, async (_req: Request, res: Response) => {
    try {
      const stats = smartAppRegistrationService.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[SMART-Apps] Error getting dashboard stats:", error);
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  app.get(`${prefix}/:appId`, async (req: Request, res: Response) => {
    try {
      const app = smartAppRegistrationService.getApp(req.params.appId);
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error getting app:", error);
      res.status(500).json({ error: "Failed to get app" });
    }
  });

  app.post(`${prefix}`, async (req: Request, res: Response) => {
    try {
      const app = smartAppRegistrationService.registerApp(
        req.body,
        (req as any).user?.id || "api-user"
      );
      res.status(201).json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error registering app:", error);
      res.status(500).json({ error: "Failed to register app" });
    }
  });

  app.put(`${prefix}/:appId`, async (req: Request, res: Response) => {
    try {
      const app = smartAppRegistrationService.updateApp(
        req.params.appId,
        req.body,
        (req as any).user?.id || "api-user"
      );
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error updating app:", error);
      res.status(500).json({ error: "Failed to update app" });
    }
  });

  app.post(`${prefix}/:appId/approve`, async (req: Request, res: Response) => {
    try {
      const { approvedScopes } = req.body;
      const app = smartAppRegistrationService.approveApp(
        req.params.appId,
        approvedScopes || [],
        (req as any).user?.id || "api-user"
      );
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error approving app:", error);
      res.status(500).json({ error: "Failed to approve app" });
    }
  });

  app.post(`${prefix}/:appId/enable`, async (req: Request, res: Response) => {
    try {
      const { forPatients, forProviders } = req.body;
      const app = smartAppRegistrationService.enableApp(
        req.params.appId,
        { forPatients, forProviders },
        (req as any).user?.id || "api-user"
      );
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error enabling app:", error);
      res.status(500).json({ error: "Failed to enable app" });
    }
  });

  app.post(`${prefix}/:appId/disable`, async (req: Request, res: Response) => {
    try {
      const app = smartAppRegistrationService.disableApp(
        req.params.appId,
        (req as any).user?.id || "api-user"
      );
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error disabling app:", error);
      res.status(500).json({ error: "Failed to disable app" });
    }
  });

  app.post(`${prefix}/:appId/revoke`, async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const app = smartAppRegistrationService.revokeApp(
        req.params.appId,
        reason || "No reason provided",
        (req as any).user?.id || "api-user"
      );
      if (!app) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(app);
    } catch (error: any) {
      console.error("[SMART-Apps] Error revoking app:", error);
      res.status(500).json({ error: "Failed to revoke app" });
    }
  });

  app.post(`${prefix}/:appId/rotate-credentials`, async (req: Request, res: Response) => {
    try {
      const credentials = smartAppRegistrationService.rotateClientCredentials(
        req.params.appId,
        (req as any).user?.id || "api-user"
      );
      if (!credentials) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(credentials);
    } catch (error: any) {
      console.error("[SMART-Apps] Error rotating credentials:", error);
      res.status(500).json({ error: "Failed to rotate credentials" });
    }
  });

  app.get(`${prefix}/:appId/events`, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const events = smartAppRegistrationService.getConnectionEvents(req.params.appId, limit);
      res.json({ events });
    } catch (error: any) {
      console.error("[SMART-Apps] Error getting events:", error);
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  app.post(`${prefix}/:appId/events`, async (req: Request, res: Response) => {
    try {
      const event = smartAppRegistrationService.recordConnectionEvent({
        ...req.body,
        appId: req.params.appId
      });
      res.status(201).json(event);
    } catch (error: any) {
      console.error("[SMART-Apps] Error recording event:", error);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  app.post(`${prefix}/:appId/launch`, async (req: Request, res: Response) => {
    try {
      const { patientId, encounterId, practitionerId, iss } = req.body;
      
      const launchUrl = smartAppRegistrationService.generateLaunchUrl(req.params.appId, {
        patientId,
        encounterId,
        practitionerId,
        iss: iss || `${req.protocol}://${req.get("host")}/api/fhir`
      });

      if (!launchUrl) {
        return res.status(404).json({ error: "App not found or not active" });
      }

      smartAppRegistrationService.recordConnectionEvent({
        appId: req.params.appId,
        userId: (req as any).user?.id,
        patientId,
        eventType: "LAUNCH",
        status: "SUCCESS",
        metadata: { launchUrl }
      });

      res.json({ launchUrl });
    } catch (error: any) {
      console.error("[SMART-Apps] Error generating launch URL:", error);
      res.status(500).json({ error: "Failed to generate launch URL" });
    }
  });

  app.get(`${prefix}/patient/:patientId/access`, async (req: Request, res: Response) => {
    try {
      const accesses = smartAppRegistrationService.getPatientAppAccesses(req.params.patientId);
      res.json({ accesses });
    } catch (error: any) {
      console.error("[SMART-Apps] Error getting patient accesses:", error);
      res.status(500).json({ error: "Failed to get patient accesses" });
    }
  });

  app.post(`${prefix}/patient/:patientId/access`, async (req: Request, res: Response) => {
    try {
      const { appId, grantedScopes, expiresInDays } = req.body;
      const access = smartAppRegistrationService.grantPatientAccess(
        {
          appId,
          patientId: req.params.patientId,
          grantedScopes,
          expiresInDays
        },
        (req as any).user?.id || "api-user"
      );
      res.status(201).json(access);
    } catch (error: any) {
      console.error("[SMART-Apps] Error granting patient access:", error);
      res.status(500).json({ error: "Failed to grant patient access" });
    }
  });

  app.delete(`${prefix}/patient/:patientId/access/:accessId`, async (req: Request, res: Response) => {
    try {
      const success = smartAppRegistrationService.revokePatientAccess(
        req.params.accessId,
        req.params.patientId,
        (req as any).user?.id || "api-user"
      );
      if (!success) {
        return res.status(404).json({ error: "Access not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SMART-Apps] Error revoking patient access:", error);
      res.status(500).json({ error: "Failed to revoke patient access" });
    }
  });

  console.log("[HIPAA-AUDIT][SMART-Apps] Registration routes registered at", prefix);
}
