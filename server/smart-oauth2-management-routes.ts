import { Express, Request, Response } from "express";
import { smartOAuth2TokenManager } from "./services/smart-oauth2-token-manager";
import { smartScopeConfigurationService } from "./services/smart-scope-configuration-service";
import { smartDataAccessAnalyticsService } from "./services/smart-data-access-analytics-service";

export function registerSmartOAuth2ManagementRoutes(app: Express): void {
  const prefix = "/api/smart-oauth2";

  app.get(`${prefix}/tokens/analytics`, async (_req: Request, res: Response) => {
    try {
      const analytics = await smartOAuth2TokenManager.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching token analytics:", error);
      res.status(500).json({ error: "Failed to fetch token analytics" });
    }
  });

  app.get(`${prefix}/tokens`, async (req: Request, res: Response) => {
    try {
      const { appId, userId } = req.query;
      let tokens;
      if (appId) {
        tokens = await smartOAuth2TokenManager.getTokensForApp(appId as string);
      } else if (userId) {
        tokens = await smartOAuth2TokenManager.getTokensForUser(userId as string);
      } else {
        const analytics = await smartOAuth2TokenManager.getAnalytics();
        tokens = analytics.recentActivity;
      }
      res.json({ tokens });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching tokens:", error);
      res.status(500).json({ error: "Failed to fetch tokens" });
    }
  });

  app.get(`${prefix}/tokens/:tokenId`, async (req: Request, res: Response) => {
    try {
      const token = await smartOAuth2TokenManager.getToken(req.params.tokenId);
      if (!token) {
        return res.status(404).json({ error: "Token not found" });
      }
      res.json(token);
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching token:", error);
      res.status(500).json({ error: "Failed to fetch token" });
    }
  });

  app.post(`${prefix}/tokens/introspect`, async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      const result = await smartOAuth2TokenManager.introspectToken(token);
      res.json(result);
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error introspecting token:", error);
      res.status(500).json({ error: "Failed to introspect token" });
    }
  });

  app.post(`${prefix}/tokens/:tokenId/refresh`, async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }
      const result = await smartOAuth2TokenManager.refreshToken(refreshToken);
      res.json(result);
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error refreshing token:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  app.post(`${prefix}/tokens/:tokenId/revoke`, async (req: Request, res: Response) => {
    try {
      const { userId, reason } = req.body;
      const success = await smartOAuth2TokenManager.revokeToken(
        req.params.tokenId,
        userId || "system",
        reason
      );
      res.json({ success });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error revoking token:", error);
      res.status(500).json({ error: "Failed to revoke token" });
    }
  });

  app.post(`${prefix}/tokens/revoke-all`, async (req: Request, res: Response) => {
    try {
      const { userId, appId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const count = await smartOAuth2TokenManager.revokeAllTokensForUser(userId, appId);
      res.json({ success: true, revokedCount: count });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error revoking tokens:", error);
      res.status(500).json({ error: "Failed to revoke tokens" });
    }
  });

  app.get(`${prefix}/tokens/expiring`, async (req: Request, res: Response) => {
    try {
      const minutes = parseInt(req.query.minutes as string) || 60;
      const tokens = await smartOAuth2TokenManager.getExpiringTokens(minutes);
      res.json({ tokens, count: tokens.length });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching expiring tokens:", error);
      res.status(500).json({ error: "Failed to fetch expiring tokens" });
    }
  });

  app.get(`${prefix}/sessions`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const sessions = await smartOAuth2TokenManager.getSessionsForUser(userId as string);
      res.json({ sessions });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post(`${prefix}/sessions/:sessionId/terminate`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const success = await smartOAuth2TokenManager.terminateSession(
        req.params.sessionId,
        userId || "system"
      );
      res.json({ success });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error terminating session:", error);
      res.status(500).json({ error: "Failed to terminate session" });
    }
  });

  app.get(`${prefix}/clients`, async (_req: Request, res: Response) => {
    try {
      const configs = await smartOAuth2TokenManager.getAllClientConfigs();
      res.json({ clients: configs });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get(`${prefix}/clients/:clientId`, async (req: Request, res: Response) => {
    try {
      const config = await smartOAuth2TokenManager.getClientConfig(req.params.clientId);
      if (!config) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.put(`${prefix}/clients/:clientId`, async (req: Request, res: Response) => {
    try {
      await smartOAuth2TokenManager.setClientConfig(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.get(`${prefix}/activities`, async (req: Request, res: Response) => {
    try {
      const { tokenId, limit } = req.query;
      const activities = await smartOAuth2TokenManager.getActivities(
        tokenId as string,
        parseInt(limit as string) || 50
      );
      res.json({ activities });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post(`${prefix}/cleanup`, async (req: Request, res: Response) => {
    try {
      const { olderThanDays } = req.body;
      const cleaned = await smartOAuth2TokenManager.cleanupExpiredTokens(olderThanDays || 30);
      res.json({ success: true, cleanedCount: cleaned });
    } catch (error) {
      console.error("[SmartOAuth2Routes] Error cleaning up tokens:", error);
      res.status(500).json({ error: "Failed to cleanup tokens" });
    }
  });

  const scopePrefix = "/api/smart-scopes";

  app.get(`${scopePrefix}/stats`, async (_req: Request, res: Response) => {
    try {
      const stats = await smartScopeConfigurationService.getStats();
      res.json(stats);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get(`${scopePrefix}/definitions`, async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      const definitions = await smartScopeConfigurationService.getScopeDefinitions(
        category as any
      );
      res.json({ definitions });
    } catch (error) {
      console.error("[SmartScopesRoutes] Error fetching definitions:", error);
      res.status(500).json({ error: "Failed to fetch definitions" });
    }
  });

  app.post(`${scopePrefix}/definitions`, async (req: Request, res: Response) => {
    try {
      const definition = await smartScopeConfigurationService.createCustomScope({
        ...req.body,
        userId: req.body.userId || "system"
      });
      res.json(definition);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error creating definition:", error);
      res.status(500).json({ error: "Failed to create definition" });
    }
  });

  app.get(`${scopePrefix}/configurations`, async (_req: Request, res: Response) => {
    try {
      const configs = await smartScopeConfigurationService.getAllAppConfigurations();
      res.json({ configurations: configs });
    } catch (error) {
      console.error("[SmartScopesRoutes] Error fetching configurations:", error);
      res.status(500).json({ error: "Failed to fetch configurations" });
    }
  });

  app.get(`${scopePrefix}/configurations/:appId`, async (req: Request, res: Response) => {
    try {
      const config = await smartScopeConfigurationService.getAppConfiguration(req.params.appId);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error fetching configuration:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  app.post(`${scopePrefix}/configurations`, async (req: Request, res: Response) => {
    try {
      const config = await smartScopeConfigurationService.createAppConfiguration({
        ...req.body,
        userId: req.body.userId || "system"
      });
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error creating configuration:", error);
      res.status(500).json({ error: "Failed to create configuration" });
    }
  });

  app.put(`${scopePrefix}/configurations/:configId`, async (req: Request, res: Response) => {
    try {
      const config = await smartScopeConfigurationService.updateAppConfiguration(
        req.params.configId,
        req.body,
        req.body.userId || "system"
      );
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error updating configuration:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  app.post(`${scopePrefix}/configurations/:configId/grant`, async (req: Request, res: Response) => {
    try {
      const { scopes, userId } = req.body;
      const config = await smartScopeConfigurationService.grantScopes(
        req.params.configId,
        scopes,
        userId || "system"
      );
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error granting scopes:", error);
      res.status(500).json({ error: "Failed to grant scopes" });
    }
  });

  app.post(`${scopePrefix}/configurations/:configId/deny`, async (req: Request, res: Response) => {
    try {
      const { scopes, userId } = req.body;
      const config = await smartScopeConfigurationService.denyScopes(
        req.params.configId,
        scopes,
        userId || "system"
      );
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error denying scopes:", error);
      res.status(500).json({ error: "Failed to deny scopes" });
    }
  });

  app.post(`${scopePrefix}/configurations/:configId/rules`, async (req: Request, res: Response) => {
    try {
      const rule = await smartScopeConfigurationService.addScopeRule(
        req.params.configId,
        req.body,
        req.body.userId || "system"
      );
      if (!rule) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error adding rule:", error);
      res.status(500).json({ error: "Failed to add rule" });
    }
  });

  app.delete(`${scopePrefix}/configurations/:configId/rules/:ruleId`, async (req: Request, res: Response) => {
    try {
      const success = await smartScopeConfigurationService.removeScopeRule(
        req.params.configId,
        req.params.ruleId,
        req.body.userId || "system"
      );
      res.json({ success });
    } catch (error) {
      console.error("[SmartScopesRoutes] Error removing rule:", error);
      res.status(500).json({ error: "Failed to remove rule" });
    }
  });

  app.post(`${scopePrefix}/configurations/:configId/restrictions`, async (req: Request, res: Response) => {
    try {
      const restriction = await smartScopeConfigurationService.addScopeRestriction(
        req.params.configId,
        req.body,
        req.body.userId || "system"
      );
      if (!restriction) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(restriction);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error adding restriction:", error);
      res.status(500).json({ error: "Failed to add restriction" });
    }
  });

  app.post(`${scopePrefix}/validate`, async (req: Request, res: Response) => {
    try {
      const { scopes } = req.body;
      const result = await smartScopeConfigurationService.validateScopes(scopes);
      res.json(result);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error validating scopes:", error);
      res.status(500).json({ error: "Failed to validate scopes" });
    }
  });

  app.get(`${scopePrefix}/templates`, async (_req: Request, res: Response) => {
    try {
      const templates = await smartScopeConfigurationService.getTemplates();
      res.json({ templates });
    } catch (error) {
      console.error("[SmartScopesRoutes] Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post(`${scopePrefix}/configurations/:configId/apply-template`, async (req: Request, res: Response) => {
    try {
      const { templateId, userId } = req.body;
      const config = await smartScopeConfigurationService.applyTemplate(
        req.params.configId,
        templateId,
        userId || "system"
      );
      if (!config) {
        return res.status(404).json({ error: "Configuration or template not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error applying template:", error);
      res.status(500).json({ error: "Failed to apply template" });
    }
  });

  app.put(`${scopePrefix}/configurations/:configId/auth-params`, async (req: Request, res: Response) => {
    try {
      const config = await smartScopeConfigurationService.updateAuthorizationParams(
        req.params.configId,
        req.body,
        req.body.userId || "system"
      );
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error updating auth params:", error);
      res.status(500).json({ error: "Failed to update auth params" });
    }
  });

  app.put(`${scopePrefix}/configurations/:configId/consent-policy`, async (req: Request, res: Response) => {
    try {
      const config = await smartScopeConfigurationService.updateConsentPolicy(
        req.params.configId,
        req.body,
        req.body.userId || "system"
      );
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("[SmartScopesRoutes] Error updating consent policy:", error);
      res.status(500).json({ error: "Failed to update consent policy" });
    }
  });

  const accessPrefix = "/api/smart-access";

  app.get(`${accessPrefix}/analytics`, async (_req: Request, res: Response) => {
    try {
      const analytics = await smartDataAccessAnalyticsService.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get(`${accessPrefix}/events`, async (req: Request, res: Response) => {
    try {
      const events = await smartDataAccessAnalyticsService.getAccessEvents({
        appId: req.query.appId as string,
        userId: req.query.userId as string,
        patientId: req.query.patientId as string,
        resourceType: req.query.resourceType as string,
        eventType: req.query.eventType as any,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: parseInt(req.query.limit as string) || 100
      });
      res.json({ events });
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post(`${accessPrefix}/events`, async (req: Request, res: Response) => {
    try {
      const event = await smartDataAccessAnalyticsService.recordAccessEvent(req.body);
      res.json(event);
    } catch (error) {
      console.error("[SmartAccessRoutes] Error recording event:", error);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  app.get(`${accessPrefix}/patterns`, async (req: Request, res: Response) => {
    try {
      const patterns = await smartDataAccessAnalyticsService.getAccessPatterns({
        appId: req.query.appId as string,
        severity: req.query.severity as any,
        status: req.query.status as any,
        patternType: req.query.patternType as any
      });
      res.json({ patterns });
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching patterns:", error);
      res.status(500).json({ error: "Failed to fetch patterns" });
    }
  });

  app.post(`${accessPrefix}/patterns/:patternId/acknowledge`, async (req: Request, res: Response) => {
    try {
      const { userId, resolution } = req.body;
      const pattern = await smartDataAccessAnalyticsService.acknowledgePattern(
        req.params.patternId,
        userId || "system",
        resolution
      );
      if (!pattern) {
        return res.status(404).json({ error: "Pattern not found" });
      }
      res.json(pattern);
    } catch (error) {
      console.error("[SmartAccessRoutes] Error acknowledging pattern:", error);
      res.status(500).json({ error: "Failed to acknowledge pattern" });
    }
  });

  app.get(`${accessPrefix}/apps`, async (_req: Request, res: Response) => {
    try {
      const summaries = await smartDataAccessAnalyticsService.getAllAppSummaries();
      res.json({ apps: summaries });
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching app summaries:", error);
      res.status(500).json({ error: "Failed to fetch app summaries" });
    }
  });

  app.get(`${accessPrefix}/apps/:appId`, async (req: Request, res: Response) => {
    try {
      const summary = await smartDataAccessAnalyticsService.getAppSummary(req.params.appId);
      if (!summary) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(summary);
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching app summary:", error);
      res.status(500).json({ error: "Failed to fetch app summary" });
    }
  });

  app.get(`${accessPrefix}/apps/:appId/permissions`, async (req: Request, res: Response) => {
    try {
      const overview = await smartDataAccessAnalyticsService.getAppPermissionOverview(req.params.appId);
      if (!overview) {
        return res.status(404).json({ error: "App not found" });
      }
      res.json(overview);
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.get(`${accessPrefix}/apps/:appId/trends`, async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const trends = await smartDataAccessAnalyticsService.getAppTrends(req.params.appId, days);
      res.json({ trends });
    } catch (error) {
      console.error("[SmartAccessRoutes] Error fetching trends:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  app.post(`${accessPrefix}/apps/:appId/revoke`, async (req: Request, res: Response) => {
    try {
      const { userId, reason } = req.body;
      const success = await smartDataAccessAnalyticsService.revokeAppAccess(
        req.params.appId,
        userId || "system",
        reason || "Access revoked"
      );
      res.json({ success });
    } catch (error) {
      console.error("[SmartAccessRoutes] Error revoking access:", error);
      res.status(500).json({ error: "Failed to revoke access" });
    }
  });

  app.put(`${accessPrefix}/apps/:appId/permissions`, async (req: Request, res: Response) => {
    try {
      const { grantedScopes, deniedScopes, userId } = req.body;
      const success = await smartDataAccessAnalyticsService.updateAppPermissions(
        req.params.appId,
        { grantedScopes, deniedScopes },
        userId || "system"
      );
      res.json({ success });
    } catch (error) {
      console.error("[SmartAccessRoutes] Error updating permissions:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  console.log("[HIPAA-AUDIT][SmartOAuth2Management] Routes registered at", prefix);
  console.log("[HIPAA-AUDIT][SmartScopeConfiguration] Routes registered at", scopePrefix);
  console.log("[HIPAA-AUDIT][SmartDataAccessAnalytics] Routes registered at", accessPrefix);
}
