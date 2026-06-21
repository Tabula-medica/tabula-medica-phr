import { Router, Request, Response } from "express";
import { fhirOAuthService } from "./services/fhir-oauth-service";
import { rbacService } from "./services/rbac-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/metadata", async (req: Request, res: Response) => {
  res.json({
    version: "1.0.0",
    service: "FHIR OAuth Service",
    description: "OAuth 2.0/OpenID Connect authentication for external FHIR servers",
    features: [
      "OAuth 2.0 Authorization Code flow",
      "OpenID Connect support",
      "SMART on FHIR app launch",
      "PKCE support",
      "Client credentials flow",
      "Token refresh and revocation",
      "Token introspection"
    ],
    supportedAuthMethods: ["oauth2", "oidc", "smart_on_fhir", "basic", "api_key", "mtls"],
    supportedGrantTypes: ["authorization_code", "client_credentials", "refresh_token"]
  });
});

router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const stats = fhirOAuthService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error("[FHIROAuth] Error getting statistics:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

router.get("/clients", async (req: Request, res: Response) => {
  try {
    const { endpointId, authMethod, isActive } = req.query;
    const configs = await fhirOAuthService.listClientConfigs({
      endpointId: endpointId as string | undefined,
      authMethod: authMethod as any,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined
    });
    
    const sanitized = configs.map(c => ({
      ...c,
      clientSecretHash: c.clientSecretHash ? "[REDACTED]" : undefined
    }));
    
    res.json(sanitized);
  } catch (error) {
    console.error("[FHIROAuth] Error listing clients:", error);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

router.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const config = await fhirOAuthService.getClientConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Client configuration not found" });
    }
    
    const sanitized = {
      ...config,
      clientSecretHash: config.clientSecretHash ? "[REDACTED]" : undefined
    };
    
    res.json(sanitized);
  } catch (error) {
    console.error("[FHIROAuth] Error getting client:", error);
    res.status(500).json({ error: "Failed to get client" });
  }
});

router.post("/clients", async (req: Request, res: Response) => {
  try {
    const config = await fhirOAuthService.createClientConfig(req.body);
    
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "OAuthClient",
      resourceId: config.id,
      accessReason: "OAuth client configuration created"
    });
    
    res.status(201).json({
      ...config,
      clientSecretHash: config.clientSecretHash ? "[REDACTED]" : undefined
    });
  } catch (error) {
    console.error("[FHIROAuth] Error creating client:", error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.patch("/clients/:id", async (req: Request, res: Response) => {
  try {
    const updated = await fhirOAuthService.updateClientConfig(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Client configuration not found" });
    }
    
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "OAuthClient",
      resourceId: updated.id,
      accessReason: "OAuth client configuration updated"
    });
    
    res.json({
      ...updated,
      clientSecretHash: updated.clientSecretHash ? "[REDACTED]" : undefined
    });
  } catch (error) {
    console.error("[FHIROAuth] Error updating client:", error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.delete("/clients/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await fhirOAuthService.deleteClientConfig(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Client configuration not found" });
    }
    
    logPhiAccess({
      userId: "system",
      action: "delete",
      resourceType: "OAuthClient",
      resourceId: req.params.id,
      accessReason: "OAuth client configuration deleted"
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[FHIROAuth] Error deleting client:", error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

router.post("/authorize/initiate", async (req: Request, res: Response) => {
  try {
    const { clientConfigId, userId, scopes, redirectUri } = req.body;
    
    if (!clientConfigId || !userId || !scopes || !redirectUri) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const result = await fhirOAuthService.initiateAuthorization(
      clientConfigId,
      userId,
      scopes,
      redirectUri
    );
    
    if (!result) {
      return res.status(400).json({ error: "Failed to initiate authorization" });
    }
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "OAuthAuthorization",
      resourceId: result.state,
      accessReason: "OAuth authorization initiated"
    });
    
    res.json(result);
  } catch (error) {
    console.error("[FHIROAuth] Error initiating authorization:", error);
    res.status(500).json({ error: "Failed to initiate authorization" });
  }
});

router.post("/token/exchange", async (req: Request, res: Response) => {
  try {
    const { state, code } = req.body;
    
    if (!state || !code) {
      return res.status(400).json({ error: "Missing state or code" });
    }
    
    const ipAddress = req.ip || "unknown";
    const userAgent = req.get("user-agent") || "unknown";
    
    const result = await fhirOAuthService.exchangeAuthorizationCode(
      state,
      code,
      ipAddress,
      userAgent
    );
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        error_description: result.errorDescription
      });
    }
    
    res.json({
      access_token: result.token!.accessToken,
      token_type: result.token!.tokenType,
      expires_in: Math.floor((new Date(result.token!.expiresAt).getTime() - Date.now()) / 1000),
      refresh_token: result.token!.refreshToken,
      scope: result.token!.scopes.join(" ")
    });
  } catch (error) {
    console.error("[FHIROAuth] Error exchanging code:", error);
    res.status(500).json({ error: "server_error", error_description: "Failed to exchange code" });
  }
});

router.post("/token/refresh", async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing refresh token" });
    }
    
    const ipAddress = req.ip || "unknown";
    const userAgent = req.get("user-agent") || "unknown";
    
    const result = await fhirOAuthService.refreshAccessToken(
      refresh_token,
      ipAddress,
      userAgent
    );
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        error_description: result.errorDescription
      });
    }
    
    res.json({
      access_token: result.token!.accessToken,
      token_type: result.token!.tokenType,
      expires_in: Math.floor((new Date(result.token!.expiresAt).getTime() - Date.now()) / 1000),
      refresh_token: result.token!.refreshToken,
      scope: result.token!.scopes.join(" ")
    });
  } catch (error) {
    console.error("[FHIROAuth] Error refreshing token:", error);
    res.status(500).json({ error: "server_error", error_description: "Failed to refresh token" });
  }
});

router.post("/token/revoke", async (req: Request, res: Response) => {
  try {
    const { token_id, user_id } = req.body;
    
    if (!token_id || !user_id) {
      return res.status(400).json({ error: "Missing token_id or user_id" });
    }
    
    const ipAddress = req.ip || "unknown";
    const userAgent = req.get("user-agent") || "unknown";
    
    const success = await fhirOAuthService.revokeToken(token_id, user_id, ipAddress, userAgent);
    
    if (!success) {
      return res.status(404).json({ error: "Token not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[FHIROAuth] Error revoking token:", error);
    res.status(500).json({ error: "Failed to revoke token" });
  }
});

router.post("/token/introspect", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ active: false });
    }
    
    const result = await fhirOAuthService.introspectToken(token);
    res.json(result);
  } catch (error) {
    console.error("[FHIROAuth] Error introspecting token:", error);
    res.json({ active: false });
  }
});

router.post("/token/validate", async (req: Request, res: Response) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ valid: false, error: "Missing access token" });
    }
    
    const result = await fhirOAuthService.validateToken(access_token);
    res.json({
      valid: result.valid,
      userId: result.userId,
      scopes: result.scopes
    });
  } catch (error) {
    console.error("[FHIROAuth] Error validating token:", error);
    res.json({ valid: false });
  }
});

router.post("/token/client-credentials", async (req: Request, res: Response) => {
  try {
    const { client_config_id, scopes } = req.body;
    
    if (!client_config_id || !scopes) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing parameters" });
    }
    
    const ipAddress = req.ip || "unknown";
    const userAgent = req.get("user-agent") || "unknown";
    
    const result = await fhirOAuthService.getClientCredentialsToken(
      client_config_id,
      scopes,
      ipAddress,
      userAgent
    );
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        error_description: result.errorDescription
      });
    }
    
    res.json({
      access_token: result.token!.accessToken,
      token_type: result.token!.tokenType,
      expires_in: Math.floor((new Date(result.token!.expiresAt).getTime() - Date.now()) / 1000),
      scope: result.token!.scopes.join(" ")
    });
  } catch (error) {
    console.error("[FHIROAuth] Error getting client credentials token:", error);
    res.status(500).json({ error: "server_error", error_description: "Failed to issue token" });
  }
});

router.get("/tokens/user/:userId", async (req: Request, res: Response) => {
  try {
    const tokens = await fhirOAuthService.getTokensForUser(req.params.userId);
    
    const sanitized = tokens.map(t => ({
      id: t.id,
      clientConfigId: t.clientConfigId,
      tokenType: t.tokenType,
      expiresAt: t.expiresAt,
      scopes: t.scopes,
      issuedAt: t.issuedAt,
      lastUsed: t.lastUsed
    }));
    
    res.json(sanitized);
  } catch (error) {
    console.error("[FHIROAuth] Error getting user tokens:", error);
    res.status(500).json({ error: "Failed to get user tokens" });
  }
});

router.post("/tokens/user/:userId/revoke-all", async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || "unknown";
    const userAgent = req.get("user-agent") || "unknown";
    
    const count = await fhirOAuthService.revokeAllUserTokens(
      req.params.userId,
      ipAddress,
      userAgent
    );
    
    logPhiAccess({
      userId: req.params.userId,
      action: "delete",
      resourceType: "OAuthToken",
      resourceId: "all",
      accessReason: `Revoked ${count} tokens for user`
    });
    
    res.json({ success: true, revokedCount: count });
  } catch (error) {
    console.error("[FHIROAuth] Error revoking user tokens:", error);
    res.status(500).json({ error: "Failed to revoke user tokens" });
  }
});

router.get("/audit", async (req: Request, res: Response) => {
  try {
    const { clientConfigId, userId, action, limit } = req.query;
    
    const entries = fhirOAuthService.getAuditEntries({
      clientConfigId: clientConfigId as string | undefined,
      userId: userId as string | undefined,
      action: action as string | undefined,
      limit: limit ? parseInt(limit as string) : 100
    });
    
    res.json(entries);
  } catch (error) {
    console.error("[FHIROAuth] Error getting audit entries:", error);
    res.status(500).json({ error: "Failed to get audit entries" });
  }
});

router.get("/smart/well-known", async (req: Request, res: Response) => {
  res.json({
    authorization_endpoint: "/api/fhir-oauth/authorize/initiate",
    token_endpoint: "/api/fhir-oauth/token/exchange",
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "private_key_jwt"],
    grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    registration_endpoint: "/api/fhir-oauth/clients",
    scopes_supported: [
      "openid",
      "fhirUser",
      "launch",
      "launch/patient",
      "launch/encounter",
      "patient/*.read",
      "patient/*.write",
      "user/*.read",
      "user/*.write",
      "system/*.read",
      "system/*.write",
      "offline_access"
    ],
    response_types_supported: ["code"],
    management_endpoint: "/api/fhir-oauth/clients",
    introspection_endpoint: "/api/fhir-oauth/token/introspect",
    revocation_endpoint: "/api/fhir-oauth/token/revoke",
    code_challenge_methods_supported: ["S256"],
    capabilities: [
      "launch-standalone",
      "launch-ehr",
      "client-public",
      "client-confidential-symmetric",
      "context-standalone-patient",
      "context-standalone-encounter",
      "sso-openid-connect",
      "context-ehr-patient",
      "context-ehr-encounter",
      "permission-patient",
      "permission-user",
      "permission-offline"
    ]
  });
});

export function registerFhirOAuthRoutes(app: any) {
  app.use("/api/fhir-oauth", router);
  console.log("[Routes] FHIR OAuth routes registered at /api/fhir-oauth/*");
}

export default router;
