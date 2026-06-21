import { Router, Request, Response } from "express";
import * as SMARTAppsService from "./services/smart-on-fhir-apps-service";

const router = Router();

router.get("/.well-known/smart-configuration", (_req: Request, res: Response) => {
  try {
    const config = SMARTAppsService.getWellKnownSmartConfig();
    res.json(config);
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error getting configuration:", error);
    res.status(500).json({ error: "Failed to get configuration" });
  }
});

router.get("/gallery", (req: Request, res: Response) => {
  try {
    const { category, launchContext, fhirVersion, trusted, search } = req.query;
    
    const filters: Parameters<typeof SMARTAppsService.getAppGallery>[0] = {};
    
    if (category) {
      filters.category = category as SMARTAppsService.SMARTAppCategory;
    }
    
    if (launchContext) {
      filters.launchContext = launchContext as SMARTAppsService.SMARTLaunchContext;
    }
    
    if (fhirVersion) {
      filters.fhirVersion = fhirVersion as string;
    }
    
    if (trusted !== undefined) {
      filters.trusted = trusted === "true";
    }
    
    if (search) {
      filters.searchQuery = search as string;
    }

    const apps = SMARTAppsService.getAppGallery(filters);
    res.json({ apps, total: apps.length });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error fetching gallery:", error);
    res.status(500).json({ error: "Failed to fetch app gallery" });
  }
});

router.get("/categories", (_req: Request, res: Response) => {
  try {
    const categories = SMARTAppsService.getAppCategories();
    res.json({ categories });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/statistics", (_req: Request, res: Response) => {
  try {
    const statistics = SMARTAppsService.getAppStatistics();
    res.json(statistics);
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/apps/:appId", (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const app = SMARTAppsService.getAppById(appId);
    
    if (!app) {
      return res.status(404).json({ error: "App not found" });
    }
    
    res.json(app);
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error fetching app:", error);
    res.status(500).json({ error: "Failed to fetch app" });
  }
});

router.get("/installations", (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || "default-user";
    const installations = SMARTAppsService.getUserInstallations(userId);
    res.json({ installations });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error fetching installations:", error);
    res.status(500).json({ error: "Failed to fetch installations" });
  }
});

router.post("/install", (req: Request, res: Response) => {
  try {
    const { appId, userId, organizationId, customScopes } = req.body;
    
    if (!appId || !userId) {
      return res.status(400).json({ error: "appId and userId are required" });
    }
    
    const installation = SMARTAppsService.installApp(appId, userId, organizationId, customScopes);
    
    if (!installation) {
      return res.status(404).json({ error: "App not found" });
    }
    
    res.json(installation);
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error installing app:", error);
    res.status(500).json({ error: "Failed to install app" });
  }
});

router.delete("/installations/:installationId", (req: Request, res: Response) => {
  try {
    const { installationId } = req.params;
    const userId = req.query.userId as string || "default-user";
    
    const success = SMARTAppsService.uninstallApp(installationId, userId);
    
    if (!success) {
      return res.status(404).json({ error: "Installation not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error uninstalling app:", error);
    res.status(500).json({ error: "Failed to uninstall app" });
  }
});

router.post("/launch", (req: Request, res: Response) => {
  try {
    const { installationId, userId, launchContext, contextParams } = req.body;
    
    if (!installationId || !userId || !launchContext) {
      return res.status(400).json({ error: "installationId, userId, and launchContext are required" });
    }
    
    const launch = SMARTAppsService.initiateLaunch(installationId, userId, launchContext, contextParams || {});
    
    if (!launch) {
      return res.status(400).json({ error: "Failed to initiate launch. Check installation and context." });
    }
    
    const launchUrl = SMARTAppsService.buildLaunchUrl(launch);
    
    res.json({ launch, launchUrl });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error initiating launch:", error);
    res.status(500).json({ error: "Failed to initiate launch" });
  }
});

router.post("/authorize", (req: Request, res: Response) => {
  try {
    const { launchId, code_challenge, code_challenge_method, client_id, redirect_uri, scope, state } = req.body;
    
    if (!launchId) {
      return res.status(400).json({ error: "launchId is required" });
    }
    
    // PKCE is recommended for public clients
    const pkceParams = code_challenge ? {
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method as "S256" | "plain" || "S256",
      clientId: client_id,
      redirectUri: redirect_uri,
      scope: scope,
    } : undefined;
    
    const launch = SMARTAppsService.authorizeLaunch(launchId, pkceParams);
    
    if (!launch) {
      return res.status(400).json({ error: "Failed to authorize launch" });
    }
    
    res.json({
      code: launch.authorizationCode,
      state: state || launch.state,
    });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error authorizing:", error);
    res.status(500).json({ error: "Failed to authorize" });
  }
});

router.post("/token", (req: Request, res: Response) => {
  try {
    const { code, grant_type, code_verifier, client_id, redirect_uri } = req.body;
    
    if (grant_type !== "authorization_code" || !code) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Invalid grant type or missing code" });
    }
    
    const tokens = SMARTAppsService.exchangeCodeForToken(code, {
      codeVerifier: code_verifier,
      clientId: client_id,
      redirectUri: redirect_uri,
    });
    
    if (!tokens) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Invalid, expired, or already used authorization code, or PKCE verification failed" });
    }
    
    res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      scope: "launch/patient patient/*.read",
      patient: tokens.patientId,
    });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error exchanging token:", error);
    res.status(500).json({ error: "server_error", error_description: "Failed to exchange token" });
  }
});

router.post("/revoke", (req: Request, res: Response) => {
  try {
    const { launchId, userId } = req.body;
    
    if (!launchId || !userId) {
      return res.status(400).json({ error: "launchId and userId are required" });
    }
    
    const success = SMARTAppsService.revokeLaunch(launchId, userId);
    
    if (!success) {
      return res.status(404).json({ error: "Launch not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error revoking:", error);
    res.status(500).json({ error: "Failed to revoke" });
  }
});

router.get("/client/:clientId", (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const app = SMARTAppsService.getAppByClientId(clientId);
    
    if (!app) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    res.json({
      client_id: app.clientId,
      client_name: app.name,
      redirect_uris: app.redirectUrls,
      launch_uri: app.launchUrl,
      logo_uri: app.logoUrl,
      scope: app.scopes.map(s => `${s.resource}.${s.permissions.join(",")}`).join(" "),
    });
  } catch (error) {
    console.error("[SMARTAppsRoutes] Error fetching client:", error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

console.log("[SMARTAppsRoutes] Routes module loaded");
console.log("[SMARTAppsRoutes] SMART on FHIR endpoints: /gallery, /install, /launch, /authorize, /token");
console.log("[SMARTAppsRoutes] OAuth 2.0 + PKCE support enabled");

export default router;
