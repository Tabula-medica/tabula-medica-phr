import { Request, Response, NextFunction } from "express";
import * as jose from "jose";
import memoize from "memoizee";
import { logger } from "../utils/logger";

// Fail closed: do NOT default to a foreign Auth0 dev tenant when env vars are absent.
// Routes that depend on this middleware are dynamically mounted in server/routes.ts only
// when both env vars are present, so reaching this module without them is a config bug.
const AUTH0_ISSUER_BASE_URL = process.env.AUTH0_ISSUER_BASE_URL || "";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "";
const AUTH0_CONFIGURED = !!(AUTH0_ISSUER_BASE_URL && AUTH0_AUDIENCE);

const issuer = AUTH0_ISSUER_BASE_URL
  ? (AUTH0_ISSUER_BASE_URL.endsWith("/") ? AUTH0_ISSUER_BASE_URL : `${AUTH0_ISSUER_BASE_URL}/`)
  : "";
const jwksUri = AUTH0_ISSUER_BASE_URL ? `${AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json` : "";

if (!AUTH0_CONFIGURED) {
  console.warn("[Auth0-JWT] AUTH0_ISSUER_BASE_URL or AUTH0_AUDIENCE not set — Auth0 token verification will reject all requests with 503.");
}

const CLAIM_SAID = "https://tabulamedica.health/said";
const CLAIM_FHIR_SOURCES = "https://tabulamedica.health/fhir_sources";
const CLAIM_HAS_NO_MIDDLE_NAME = "https://tabulamedica.health/has_no_middle_name";
const CLAIM_SEGMENT = "https://tabulamedica.health/segment";
const CLAIM_PHI_ACCESS = "https://tabulamedica.health/phi_access";
const CLAIM_ORG_ID = "https://tabulamedica.health/org_id";

const getAuth0JWKS = memoize(
  () => jose.createRemoteJWKSet(new URL(jwksUri)),
  { maxAge: 3600 * 1000 }
);

export interface Auth0TokenPayload {
  sub: string;
  email?: string;
  name?: string;
  saidPatientId: string | null;
  fhirSources: string[];
  hasNoMiddleName: boolean;
  segment: string | null;
  phiAccess: boolean;
  orgId: string | null;
  rawClaims: jose.JWTPayload;
}

export interface Auth0AuthenticatedRequest extends Request {
  auth0Token?: Auth0TokenPayload;
}

function extractTokenPayload(claims: jose.JWTPayload): Auth0TokenPayload {
  return {
    sub: claims.sub || "",
    email: claims.email as string | undefined,
    name: claims.name as string | undefined,
    saidPatientId: (claims[CLAIM_SAID] as string) || null,
    fhirSources: (claims[CLAIM_FHIR_SOURCES] as string[]) || [],
    hasNoMiddleName: (claims[CLAIM_HAS_NO_MIDDLE_NAME] as boolean) || false,
    segment: (claims[CLAIM_SEGMENT] as string) || null,
    phiAccess: claims[CLAIM_PHI_ACCESS] === "true" || claims[CLAIM_PHI_ACCESS] === "full" || claims[CLAIM_PHI_ACCESS] === true,
    orgId: (claims[CLAIM_ORG_ID] as string) || null,
    rawClaims: claims,
  };
}

async function verifyAuth0Token(token: string): Promise<jose.JWTPayload | null> {
  const JWKS = getAuth0JWKS();

  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer,
      audience: AUTH0_AUDIENCE,
    });
    return payload;
  } catch {
    try {
      const { payload } = await jose.jwtVerify(token, JWKS, { issuer });
      return payload;
    } catch {
      return null;
    }
  }
}

export function requireAuth0Token(
  options?: {
    requireSaid?: boolean;
    requireSegment?: string[];
    requirePhiAccess?: boolean;
  }
) {
  return async (req: Auth0AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("[Auth0-JWT] No Bearer token in Authorization header");
      return res.status(401).json({
        error: "No authentication token provided",
        code: "MISSING_TOKEN",
      });
    }

    const token = authHeader.slice(7);
    const claims = await verifyAuth0Token(token);

    if (!claims) {
      logger.warn("[Auth0-JWT] Token verification failed");
      return res.status(401).json({
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
    }

    const tokenPayload = extractTokenPayload(claims);
    req.auth0Token = tokenPayload;

    if (options?.requireSaid && !tokenPayload.saidPatientId) {
      logger.warn(`[Auth0-JWT] SAID required but not present for sub=${tokenPayload.sub}`);
      return res.status(403).json({
        error: "SAID Patient ID required",
        code: "SAID_REQUIRED",
        detail: "This endpoint requires a SAID™ Patient ID in the token. Complete patient registration first.",
      });
    }

    if (options?.requireSegment && options.requireSegment.length > 0) {
      if (!tokenPayload.segment || !options.requireSegment.includes(tokenPayload.segment)) {
        logger.warn(`[Auth0-JWT] Segment mismatch: have=${tokenPayload.segment}, need=${options.requireSegment.join("|")}`);
        return res.status(403).json({
          error: "Insufficient segment access",
          code: "SEGMENT_DENIED",
          detail: `This endpoint requires segment: ${options.requireSegment.join(" or ")}`,
        });
      }
    }

    if (options?.requirePhiAccess && !tokenPayload.phiAccess) {
      logger.warn(`[Auth0-JWT] PHI access required but not granted for sub=${tokenPayload.sub}`);
      return res.status(403).json({
        error: "PHI access not authorized",
        code: "PHI_ACCESS_DENIED",
        detail: "This endpoint requires PHI access authorization from your organization.",
      });
    }

    next();
  };
}

export async function verifyUninsuranceToken(
  req: Request
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    logger.warn("[Auth0-JWT] No Uninsurance session found");
    return null;
  }

  const claims = await verifyAuth0Token(token);

  if (!claims) {
    logger.warn("[Auth0-JWT] Uninsurance token verification failed");
    return null;
  }

  const saidId = claims[CLAIM_SAID] as string | undefined;

  if (!saidId) {
    logger.warn(`[Auth0-JWT] No SAID in Uninsurance token for sub=${claims.sub}`);
    return null;
  }

  return saidId;
}

export async function verifyTabulaMedicaToken(
  req: Request
): Promise<Auth0TokenPayload | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;

  const claims = await verifyAuth0Token(token);
  if (!claims) return null;

  return extractTokenPayload(claims);
}

export function requireSaidPatient() {
  return requireAuth0Token({ requireSaid: true });
}

export function requireProviderAccess() {
  return requireAuth0Token({
    requireSegment: ["provider_admin", "system_admin"],
    requirePhiAccess: true,
  });
}

export function requireSystemAdmin() {
  return requireAuth0Token({
    requireSegment: ["system_admin"],
    requirePhiAccess: true,
  });
}

export const AUTH0_JWT_CONFIG = {
  issuerBaseUrl: AUTH0_ISSUER_BASE_URL,
  audience: AUTH0_AUDIENCE,
  issuer,
  jwksUri,
  claims: {
    said: CLAIM_SAID,
    fhirSources: CLAIM_FHIR_SOURCES,
    hasNoMiddleName: CLAIM_HAS_NO_MIDDLE_NAME,
    segment: CLAIM_SEGMENT,
    phiAccess: CLAIM_PHI_ACCESS,
    orgId: CLAIM_ORG_ID,
  },
} as const;
