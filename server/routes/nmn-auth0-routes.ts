import { Router, Request, Response } from "express";
import {
  normalizeName,
  encryptPatientName,
  formatDisplayName,
  labOrderName,
  encryptField,
  decryptField,
} from "../services/said-patient-id-service";
import { auth0SmartFhirService } from "../services/auth0-smart-fhir-service";
import { healthcareHardeningService } from "../services/healthcare-hardening-service";
import {
  AUTH0_JWT_CONFIG,
  verifyUninsuranceToken,
  verifyTabulaMedicaToken,
  type Auth0AuthenticatedRequest,
} from "../middleware/auth0-jwt-verify";

const router = Router();

router.post("/nmn/normalize", (req: Request, res: Response) => {
  try {
    const { nameFirst, nameMiddle, nameLast } = req.body;

    if (!nameFirst || !nameLast) {
      return res.status(400).json({ error: "nameFirst and nameLast are required" });
    }

    const result = normalizeName({ nameFirst, nameMiddle, nameLast });

    return res.json({
      normalized: result,
      displayName: `${result.first} ${result.middle} ${result.last}`,
      isNMN: result.isNMN,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/nmn/encrypt-name", (req: Request, res: Response) => {
  try {
    const { nameFirst, nameMiddle, nameLast } = req.body;

    if (!nameFirst || !nameLast) {
      return res.status(400).json({ error: "nameFirst and nameLast are required" });
    }

    const encrypted = encryptPatientName({ nameFirst, nameMiddle, nameLast });

    return res.json({
      encrypted,
      displayPreview: formatDisplayName(encrypted),
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/nmn/lab-order-name", (req: Request, res: Response) => {
  try {
    const { nameFirstEnc, nameMiddleEnc, nameLastEnc } = req.body;

    if (!nameFirstEnc || !nameMiddleEnc || !nameLastEnc) {
      return res.status(400).json({ error: "Encrypted name fields are required" });
    }

    const result = labOrderName({ nameFirstEnc, nameMiddleEnc, nameLastEnc });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/nmn/display-name", (req: Request, res: Response) => {
  try {
    const { nameFirstEnc, nameMiddleEnc, nameLastEnc } = req.body;

    if (!nameFirstEnc || !nameMiddleEnc || !nameLastEnc) {
      return res.status(400).json({ error: "Encrypted name fields are required" });
    }

    const displayName = formatDisplayName({ nameFirstEnc, nameMiddleEnc, nameLastEnc });

    return res.json({ displayName });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/auth0-smart/store-payer-token", async (req: Request, res: Response) => {
  try {
    const { auth0UserId, sourceType, tokens } = req.body;

    if (!auth0UserId || !sourceType || !tokens) {
      return res.status(400).json({ error: "auth0UserId, sourceType, and tokens are required" });
    }

    if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt || !tokens.fhirBaseUrl) {
      return res.status(400).json({ error: "tokens must include accessToken, refreshToken, expiresAt, fhirBaseUrl" });
    }

    const result = await auth0SmartFhirService.storePaperTokenInAuth0(
      auth0UserId,
      sourceType,
      tokens
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/auth0-smart/connected-sources/:auth0UserId", async (req: Request, res: Response) => {
  try {
    const sources = await auth0SmartFhirService.getConnectedSources(req.params.auth0UserId);
    return res.json({ sources });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/auth0-smart/get-payer-token", async (req: Request, res: Response) => {
  try {
    const { auth0UserId, sourceType } = req.body;

    if (!auth0UserId || !sourceType) {
      return res.status(400).json({ error: "auth0UserId and sourceType are required" });
    }

    const token = await auth0SmartFhirService.getPaperToken(auth0UserId, sourceType);

    if (!token) {
      return res.status(404).json({ error: `No ${sourceType} token found for user` });
    }

    return res.json(token);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/auth0-smart/refresh-payer-token", async (req: Request, res: Response) => {
  try {
    const { auth0UserId, sourceType } = req.body;

    if (!auth0UserId || !sourceType) {
      return res.status(400).json({ error: "auth0UserId and sourceType are required" });
    }

    const refreshed = await auth0SmartFhirService.refreshPaperToken(auth0UserId, sourceType);

    return res.json({ refreshed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/auth0-smart/disconnect-payer", async (req: Request, res: Response) => {
  try {
    const { auth0UserId, sourceType } = req.body;

    if (!auth0UserId || !sourceType) {
      return res.status(400).json({ error: "auth0UserId and sourceType are required" });
    }

    const disconnected = await auth0SmartFhirService.disconnectPayer(auth0UserId, sourceType);

    return res.json({ disconnected });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/auth0-smart/post-login-action", (_req: Request, res: Response) => {
  const code = auth0SmartFhirService.getPostLoginActionCode();
  return res.json({ code, instructions: "Deploy this code in Auth0 Dashboard → Actions → Flows → Login → Post Login" });
});

router.get("/auth0-smart/fasten-config", (_req: Request, res: Response) => {
  const yaml = auth0SmartFhirService.getFastenConfigYaml();
  return res.json({ yaml, instructions: "Place this config.yaml in your Fasten Health self-hosted deployment" });
});

router.get("/auth0-smart/config", (_req: Request, res: Response) => {
  const config = auth0SmartFhirService.getSmartConfig();
  return res.json(config);
});

router.get("/auth0-smart/data-boundary", (_req: Request, res: Response) => {
  const boundary = auth0SmartFhirService.getDataBoundaryTable();
  return res.json({ boundary });
});

router.get("/healthcare-hardening/baa-status", (_req: Request, res: Response) => {
  const baa = healthcareHardeningService.getBaaStatus();
  return res.json(baa);
});

router.get("/healthcare-hardening/mfa-policy", (_req: Request, res: Response) => {
  const policy = healthcareHardeningService.getMfaPolicy();
  return res.json(policy);
});

router.get("/healthcare-hardening/webauthn-action", (_req: Request, res: Response) => {
  const code = healthcareHardeningService.getWebAuthnRegistrationActionCode();
  return res.json({
    code,
    instructions: "Deploy in Auth0 Dashboard → Actions → Flows → Login → Post Login (AFTER SAID/fhir_sources claims action)",
  });
});

router.get("/healthcare-hardening/guardian-config", (_req: Request, res: Response) => {
  const config = healthcareHardeningService.getMfaGuardianConfig();
  return res.json({
    config,
    instructions: "Apply via Auth0 Dashboard → Security → Multi-Factor Authentication",
  });
});

router.get("/healthcare-hardening/tenant-isolation", (_req: Request, res: Response) => {
  const isolation = healthcareHardeningService.getTenantIsolationConfig();
  return res.json(isolation);
});

router.get("/healthcare-hardening/org-action", (_req: Request, res: Response) => {
  const code = healthcareHardeningService.getOrgLoginFlowActionCode();
  return res.json({
    code,
    instructions: "Deploy in Auth0 Dashboard → Actions → Flows → Login → Post Login (AFTER MFA enforcement action)",
  });
});

router.get("/healthcare-hardening/checklist", (_req: Request, res: Response) => {
  const checklist = healthcareHardeningService.getHardeningChecklist();
  return res.json({ checklist });
});

router.get("/auth0-jwt/config", (_req: Request, res: Response) => {
  return res.json({
    ...AUTH0_JWT_CONFIG,
    envVars: {
      required: ["AUTH0_ISSUER_BASE_URL", "AUTH0_AUDIENCE"],
      optional: ["UNINSURANCE_ORIGIN"],
      note: "Tabula Medica only verifies tokens — it does not initiate login. No client ID or secret needed.",
    },
    cors: {
      uninsuranceOrigin: process.env.UNINSURANCE_ORIGIN || "(not set — set UNINSURANCE_ORIGIN to the Uninsurance Replit URL)",
      productionOrigins: [
        "https://uninsurance.care",
        "https://app.uninsurance.care",
        "https://www.uninsurance.care",
      ],
      devPatterns: [
        "*.replit.dev",
        "*.replit.app",
        "*.uninsurance.care",
      ],
    },
    middleware: {
      requireAuth0Token: {
        description: "Express middleware that verifies Auth0 JWT tokens via JWKS using AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE",
        usage: 'requireAuth0Token({ requireSaid: true })',
        options: {
          requireSaid: "Reject if SAID™ Patient ID not in token",
          requireSegment: "Restrict to specific Auth0 Organization segments",
          requirePhiAccess: "Reject if PHI access not authorized",
        },
      },
      convenienceMiddleware: {
        requireSaidPatient: 'requireAuth0Token({ requireSaid: true })',
        requireProviderAccess: 'requireAuth0Token({ requireSegment: ["provider_admin","system_admin"], requirePhiAccess: true })',
        requireSystemAdmin: 'requireAuth0Token({ requireSegment: ["system_admin"], requirePhiAccess: true })',
      },
      standaloneVerifiers: {
        verifyUninsuranceToken: "Returns SAID string | null — extracts SAID from any valid Auth0 token (used for cross-app handoff)",
        verifyTabulaMedicaToken: "Returns full Auth0TokenPayload | null — used for TM API access",
      },
    },
    postLoginAction: {
      description: "Auth0 Post-Login Action injects these custom claims into every JWT",
      claims: Object.entries(AUTH0_JWT_CONFIG.claims).map(([key, namespace]) => ({
        key,
        namespace,
        source: key === "said" ? "user_metadata.said_patient_id"
          : key === "fhirSources" ? "user_metadata.fhir_connections (keys only)"
          : key === "hasNoMiddleName" ? "user_metadata.has_no_middle_name"
          : key === "segment" ? "org.metadata.hipaa_segment"
          : key === "phiAccess" ? "org.metadata.phi_access"
          : "org.id",
      })),
    },
    integrationCode: {
      description: "Drop-in Express middleware — only needs AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE",
      example: `import { requireAuth0Token, requireSaidPatient } from "./middleware/auth0-jwt-verify";

// Protect a route — verifies any token from AUTH0_ISSUER_BASE_URL
app.get("/api/patient/records", requireAuth0Token(), handler);

// Require SAID for cross-app handoff from Uninsurance
app.post("/api/orders/create", requireSaidPatient(), handler);

// Restrict to provider admins with PHI access
app.get("/api/admin/patients", requireProviderAccess(), handler);

// Standalone verification for Uninsurance cross-origin requests
const saidId = await verifyUninsuranceToken(req);
if (!saidId) return res.status(401).json({ error: "No Uninsurance session" });`,
    },
  });
});

router.post("/auth0-jwt/verify", async (req: Request, res: Response) => {
  try {
    const tmPayload = await verifyTabulaMedicaToken(req);
    if (tmPayload) {
      return res.json({
        valid: true,
        tokenType: "tabula-medica",
        sub: tmPayload.sub,
        saidPatientId: tmPayload.saidPatientId,
        fhirSources: tmPayload.fhirSources,
        hasNoMiddleName: tmPayload.hasNoMiddleName,
        segment: tmPayload.segment,
        phiAccess: tmPayload.phiAccess,
        orgId: tmPayload.orgId,
      });
    }

    const saidId = await verifyUninsuranceToken(req);
    if (saidId) {
      return res.json({
        valid: true,
        tokenType: "uninsurance",
        saidPatientId: saidId,
      });
    }

    return res.json({
      valid: false,
      tokenType: null,
      error: "Token could not be verified against Auth0 JWKS",
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
