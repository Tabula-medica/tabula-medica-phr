import { jwtVerify, createRemoteJWKSet } from "jose";

export interface UninsuranceTokenPayload {
  saidPatientId: string | null;
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  orgSegment?: string;
  mfaLevel?: string;
  fhirSources?: string[];
  raw: Record<string, unknown>;
}

const SAID_CLAIM = "https://uninsurance.com/said_id";
const SAID_CLAIM_ALT = "https://tabulamedica.health/said";
const MFA_LEVEL_CLAIM = "https://tabulamedica.health/mfa_level";
const ORG_SEGMENT_CLAIM = "https://tabulamedica.health/org_segment";
const FHIR_SOURCES_CLAIM = "https://tabulamedica.health/fhir_sources";

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedIssuer: string | null = null;

function getIssuerBaseUrl(): string {
  const issuerBase = process.env.AUTH0_ISSUER_BASE_URL;
  if (issuerBase) return issuerBase.replace(/\/+$/, "");

  const domain = process.env.AUTH0_DOMAIN;
  if (domain) return `https://${domain}`;

  throw new Error(
    "AUTH0_ISSUER_BASE_URL not configured — cannot verify Uninsurance tokens"
  );
}

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  const issuerBase = getIssuerBaseUrl();

  if (cachedJWKS && cachedIssuer === issuerBase) {
    return cachedJWKS;
  }

  cachedJWKS = createRemoteJWKSet(
    new URL(`${issuerBase}/.well-known/jwks.json`)
  );
  cachedIssuer = issuerBase;
  return cachedJWKS;
}

function getExpectedAudience(): string {
  return process.env.AUTH0_AUDIENCE || "https://api.uninsurance.com";
}

function getExpectedIssuer(): string {
  return `${getIssuerBaseUrl()}/`;
}

export async function verifyUninsuranceToken(
  token: string
): Promise<UninsuranceTokenPayload> {
  if (!token) {
    throw new Error("No token provided");
  }

  const jwks = getJWKS();
  const audience = getExpectedAudience();
  const issuer = getExpectedIssuer();

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
    clockTolerance: 30,
  });

  const saidPatientId =
    (payload[SAID_CLAIM] as string) ||
    (payload[SAID_CLAIM_ALT] as string) ||
    null;

  return {
    saidPatientId,
    sub: payload.sub || "",
    iss: payload.iss || "",
    aud: payload.aud || "",
    exp: payload.exp || 0,
    iat: payload.iat || 0,
    orgSegment: (payload[ORG_SEGMENT_CLAIM] as string) || undefined,
    mfaLevel: (payload[MFA_LEVEL_CLAIM] as string) || undefined,
    fhirSources: (payload[FHIR_SOURCES_CLAIM] as string[]) || undefined,
    raw: payload as Record<string, unknown>,
  };
}

export async function extractSaidFromRequest(
  authHeader: string | undefined
): Promise<string | null> {
  if (!authHeader) return null;

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) return null;

  try {
    const verified = await verifyUninsuranceToken(token);
    return verified.saidPatientId;
  } catch (error) {
    console.error(
      "[UninsuranceVerifier] Token verification failed:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export function isUninsuranceTokenConfigured(): boolean {
  return !!(process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_DOMAIN);
}
