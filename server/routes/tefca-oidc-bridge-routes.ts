import { Router, Request, Response } from "express";
import { tefcaOidcBridgeService, type OIDCIdentityAssertion } from "../services/tefca-oidc-bridge-service";

export function registerTefcaOidcBridgeRoutes(router: Router) {
  router.post("/api/tefca-bridge/session", async (req: Request, res: Response) => {
    try {
      const identity = extractIdentityFromRequest(req);
      const session = await tefcaOidcBridgeService.createTefcaSession(identity);
      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          said: session.said,
          expiresAt: session.expiresAt,
          identityProofLevel: session.identityProofLevel,
          authorizedNetworks: session.qhinAuthorizations.map((a) => ({
            network: a.qhinName,
            authorized: a.authorized,
            scope: a.scope,
          })),
          eliminatedLogins: session.qhinAuthorizations.filter((a) => a.authorized).length,
        },
        message: `TEFCA session created — ${session.qhinAuthorizations.length} health networks authorized without separate logins`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post("/api/tefca-bridge/query", async (req: Request, res: Response) => {
    try {
      const { sessionId, resourceTypes, dateRange, includeNonTefca } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "sessionId is required" });
      }

      const identity = extractIdentityFromRequest(req);
      const result = await tefcaOidcBridgeService.queryUnifiedRecords(
        sessionId,
        identity,
        { sessionId, resourceTypes, dateRange, includeNonTefca }
      );

      res.json({
        success: true,
        result: {
          queryId: result.tefcaResults.queryId,
          status: result.tefcaResults.status,
          said: result.said,
          networks: {
            queried: result.tefcaResults.networksQueried,
            responded: result.tefcaResults.networksResponded,
          },
          records: {
            total: result.combinedRecordCount,
            byNetwork: result.tefcaResults.documentsByNetwork,
            sourceOrganizations: result.tefcaResults.sourceOrganizations,
            confidence: Math.round(result.tefcaResults.overallConfidence * 100),
          },
          eliminatedLogins: result.eliminatedLogins,
          fastenFallback: result.fastenFallback,
          auditId: result.auditId,
        },
        message: `Retrieved ${result.combinedRecordCount} records from ${result.tefcaResults.networksResponded} networks — ${result.eliminatedLogins} separate EMR logins eliminated`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get("/api/tefca-bridge/status/:said", async (req: Request, res: Response) => {
    try {
      const { said } = req.params;
      const status = tefcaOidcBridgeService.getFlowStatus(said);
      res.json({
        success: true,
        status: {
          said: status.said,
          hasActiveSession: status.hasActiveSession,
          availableNetworks: status.availableNetworks,
          connectedNetworks: status.connectedNetworks,
          totalRecordsAccessed: status.totalRecordsAccessed,
          eliminatedLoginCount: status.eliminatedLoginCount,
          sessionExpiry: status.session?.expiresAt,
          identityProofLevel: status.session?.identityProofLevel,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get("/api/tefca-bridge/session/:sessionId", async (req: Request, res: Response) => {
    try {
      const session = tefcaOidcBridgeService.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }
      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          said: session.said,
          status: session.status,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          identityProofLevel: session.identityProofLevel,
          purpose: session.tefcaPurpose,
          networks: session.qhinAuthorizations.map((a) => ({
            network: a.qhinName,
            authorized: a.authorized,
            matchConfidence: a.matchConfidence
              ? Math.round(a.matchConfidence * 100)
              : null,
            scope: a.scope.length,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete("/api/tefca-bridge/session/:sessionId", async (req: Request, res: Response) => {
    try {
      const revoked = tefcaOidcBridgeService.revokeSession(req.params.sessionId);
      if (!revoked) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }
      res.json({ success: true, message: "TEFCA session revoked" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get("/api/tefca-bridge/flow-overview", async (_req: Request, res: Response) => {
    try {
      const networks = (await import("../services/tefca-framework-service")).tefcaFrameworkService;
      const iasNetworks = networks.getActiveQHINs("individual_access");

      res.json({
        success: true,
        overview: {
          flowName: "TEFCA-First Unified Access",
          description:
            "Authenticate once with Auth0, access health records across all TEFCA-participating networks without separate EMR logins",
          steps: [
            {
              step: 1,
              action: "Auth0 OIDC Login",
              description: "Patient authenticates via Auth0 (supports CAC/PIV, WebAuthn, TOTP)",
              result: "Verified identity with SAID Patient ID",
            },
            {
              step: 2,
              action: "TEFCA Session Creation",
              description: "Auth0 OIDC token is bridged to TEFCA Individual Access Services",
              result: `Authorized across ${iasNetworks.length} health networks simultaneously`,
            },
            {
              step: 3,
              action: "Federated Query",
              description: "Single query fans out to all authorized QHINs",
              result: "Records from multiple hospitals, clinics, and payers — zero additional logins",
            },
            {
              step: 4,
              action: "Fasten Health Fallback",
              description: "Non-TEFCA providers (dental, pharmacy, private practice) use Fasten direct connect",
              result: "Complete record coverage via hybrid TEFCA + Fasten approach",
            },
          ],
          availableNetworks: iasNetworks.map((n) => ({
            name: n.name,
            participants: n.participantCount.toLocaleString(),
            fhirVersions: n.supportedFhirVersions,
          })),
          totalParticipants: iasNetworks.reduce((sum, n) => sum + n.participantCount, 0).toLocaleString(),
          complianceStandards: ["TEFCA 2.0", "HIPAA", "FHIR R4", "SMART on FHIR", "NIST SP 800-63B IAL2"],
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("[TEFCA-OIDC-Bridge] Routes registered at /api/tefca-bridge/*");
  console.log("[TEFCA-OIDC-Bridge] Flow: Auth0 OIDC → TEFCA IAS → Federated Query → Fasten Fallback");
  console.log("[TEFCA-OIDC-Bridge] Eliminates repeat EMR logins for TEFCA-participating networks");
}

function extractIdentityFromRequest(req: Request): OIDCIdentityAssertion {
  const body = req.body;
  const now = Math.floor(Date.now() / 1000);

  return {
    sub: body.sub || body.userId || "demo-sub",
    email: body.email || "patient@example.com",
    said: body.said || body.saidPatientId || "",
    firstName: body.firstName || body.given_name || "Demo",
    lastName: body.lastName || body.family_name || "Patient",
    middleName: body.middleName || body.middle_name,
    dateOfBirth: body.dateOfBirth || body.birthdate || "1990-01-01",
    gender: body.gender,
    address: body.address,
    auth0OrgId: body.org_id,
    iss: body.iss || process.env.AUTH0_ISSUER_BASE_URL || "",
    aud: body.aud || process.env.AUTH0_AUDIENCE || "",
    iat: body.iat || now,
    exp: body.exp || now + 3600,
  };
}
