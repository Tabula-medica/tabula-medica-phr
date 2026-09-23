/**
 * eClinicalWorks FHIR R4 connector.
 *
 * ## Why this module exists rather than more entries in the presets table
 *
 * eCW does not have "a" FHIR base URL. Every practice gets its own, of the form
 * `{host}/fhir/r4/{practiceCode}`, and the practice code is part of the path —
 * multi-tenant routing is by URL, not by header. A single hardcoded base URL can
 * therefore only ever be right for one practice.
 *
 * The repository previously carried the eCW *sandbox* base URL — practice code
 * `IJCEAI` — as both the sandbox and the production endpoint. Pointed at a real
 * practice that configuration does not fail loudly; it authenticates against the
 * sandbox tenant and returns someone else's demo patients, which is worse than
 * an error because it looks like it worked. This module replaces the hardcoded
 * pair with a resolver that requires the practice code to be supplied.
 *
 * Endpoints are likewise discovered rather than hardcoded. SMART defines
 * `.well-known/smart-configuration` relative to the FHIR base URL, which returns
 * the authorization and token endpoints, the supported grant types, PKCE support
 * and the capabilities the tenant actually offers. Reading them beats guessing
 * them, and it keeps working when the vendor moves a path.
 */

const ECW_DEFAULT_HOST = "https://fhir4.eclinicalworks.com";

/** eCW's published sandbox practice code. Sandbox only — never production. */
export const ECW_SANDBOX_PRACTICE_CODE = "IJCEAI";

/**
 * Rate limit, per eCW's published limit effective 2025-10-07: 250 calls per
 * minute counted per practice code. Connecting N practices gives N times this
 * in aggregate, because each base URL has its own counter.
 */
export const ECW_RATE_LIMIT_PER_MINUTE = 250;

/** Where an integrator looks up a given practice's FHIR base URL. */
export const ECW_ENDPOINT_DIRECTORY_URL =
  "https://connect4.healow.com/apps/jsp/dev/r4/fhirEndpoints.jsp";

export interface EcwPracticeTarget {
  /** Practice code that forms the last path segment of the base URL. */
  practiceCode: string;
  /** Override host, for practices on a non-default eCW cluster. */
  host?: string;
}

export interface EcwSmartConfiguration {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  issuer?: string;
  scopesSupported: readonly string[];
  grantTypesSupported: readonly string[];
  codeChallengeMethodsSupported: readonly string[];
  /** True when the tenant advertises SMART backend services (system-level). */
  supportsBackendServices: boolean;
  /** True when the tenant advertises Bulk Data $export. */
  supportsBulkExport: boolean;
  /** The base URL the configuration was read from. */
  fhirBaseUrl: string;
}

export class EcwConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EcwConfigurationError";
  }
}

/**
 * Build a practice's FHIR base URL.
 *
 * Throws on an empty or malformed practice code rather than producing a URL
 * ending in `/fhir/r4/`, which would resolve to the wrong place quietly.
 */
export function buildEcwBaseUrl(target: EcwPracticeTarget): string {
  const code = target.practiceCode?.trim();
  if (!code) {
    throw new EcwConfigurationError(
      "An eClinicalWorks practice code is required. eCW FHIR base URLs are per-practice " +
        `(\${host}/fhir/r4/\${practiceCode}); look the practice up at ${ECW_ENDPOINT_DIRECTORY_URL}.`,
    );
  }
  if (!/^[A-Za-z0-9]{3,32}$/.test(code)) {
    throw new EcwConfigurationError(
      `"${code}" is not a well-formed eClinicalWorks practice code (expected 3-32 alphanumerics).`,
    );
  }
  const host = (target.host ?? ECW_DEFAULT_HOST).replace(/\/+$/, "");
  return `${host}/fhir/r4/${code}`;
}

/**
 * Resolve the practice target from configuration.
 *
 * Production requires `ECW_PRACTICE_CODE` to be set explicitly. There is no
 * fallback to the sandbox code: silently serving sandbox data to a production
 * deployment is the failure this whole module exists to prevent.
 */
export function resolveEcwTarget(
  mode: "sandbox" | "live",
  env: NodeJS.ProcessEnv = process.env,
): EcwPracticeTarget {
  const configured = env.ECW_PRACTICE_CODE?.trim();
  if (mode === "live") {
    if (!configured) {
      throw new EcwConfigurationError(
        "ECW_PRACTICE_CODE is not set. A live eClinicalWorks connection needs the " +
          "practice's own code; the sandbox code would return sandbox patients.",
      );
    }
    return { practiceCode: configured, host: env.ECW_FHIR_HOST?.trim() || undefined };
  }
  return {
    practiceCode: configured || ECW_SANDBOX_PRACTICE_CODE,
    host: env.ECW_FHIR_HOST?.trim() || undefined,
  };
}

interface SmartConfigurationPayload {
  authorization_endpoint?: string;
  token_endpoint?: string;
  issuer?: string;
  scopes_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  capabilities?: string[];
}

/**
 * Read a tenant's SMART configuration.
 *
 * `fetchImpl` is injectable so tests exercise the parsing without a network.
 */
export async function discoverEcwSmartConfiguration(
  target: EcwPracticeTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<EcwSmartConfiguration> {
  const fhirBaseUrl = buildEcwBaseUrl(target);
  const discoveryUrl = `${fhirBaseUrl}/.well-known/smart-configuration`;

  const response = await fetchImpl(discoveryUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new EcwConfigurationError(
      `SMART discovery failed for ${fhirBaseUrl} (HTTP ${response.status}). Verify the ` +
        `practice code against ${ECW_ENDPOINT_DIRECTORY_URL}.`,
    );
  }

  const payload = (await response.json()) as SmartConfigurationPayload;

  if (!payload.authorization_endpoint || !payload.token_endpoint) {
    throw new EcwConfigurationError(
      `SMART configuration at ${discoveryUrl} is missing authorization_endpoint or ` +
        "token_endpoint; it cannot be used to start an OAuth flow.",
    );
  }

  const capabilities = payload.capabilities ?? [];

  return {
    authorizationEndpoint: payload.authorization_endpoint,
    tokenEndpoint: payload.token_endpoint,
    issuer: payload.issuer,
    scopesSupported: payload.scopes_supported ?? [],
    grantTypesSupported: payload.grant_types_supported ?? [],
    codeChallengeMethodsSupported: payload.code_challenge_methods_supported ?? [],
    supportsBackendServices:
      capabilities.includes("permission-v2") ||
      capabilities.includes("client-confidential-asymmetric") ||
      (payload.grant_types_supported ?? []).includes("client_credentials"),
    supportsBulkExport: capabilities.some((c) => c.includes("bulk")),
    fhirBaseUrl,
  };
}

/**
 * SMART Backend Services token request parameters.
 *
 * Backend services authenticate with a private-key JWT client assertion rather
 * than a client secret: the app signs a short-lived JWT with its private key and
 * the server verifies it against the registered JWKS. This helper builds the
 * form body; signing is left to the caller so the private key stays in whatever
 * key-management the deployment already uses rather than being handled here.
 */
export function buildBackendServicesTokenBody(params: {
  signedClientAssertion: string;
  scope: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: "client_credentials",
    scope: params.scope,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: params.signedClientAssertion,
  });
}

/** Claims a backend-services client assertion must carry, per the SMART spec. */
export function backendServicesAssertionClaims(params: {
  clientId: string;
  tokenEndpoint: string;
  /** Unix seconds. Caller supplies it so this stays deterministic and testable. */
  issuedAt: number;
  jti: string;
  /** Assertion lifetime; the spec caps it at five minutes. */
  lifetimeSeconds?: number;
}): Record<string, string | number> {
  const lifetime = Math.min(params.lifetimeSeconds ?? 300, 300);
  return {
    iss: params.clientId,
    sub: params.clientId,
    // `aud` must be the token endpoint itself — a mismatch is the most common
    // cause of an opaque invalid_client from a conformant server.
    aud: params.tokenEndpoint,
    jti: params.jti,
    iat: params.issuedAt,
    exp: params.issuedAt + lifetime,
  };
}

/** A summary suitable for an ops/status endpoint. Contains no secrets. */
export function describeEcwIntegration(
  mode: "sandbox" | "live",
  env: NodeJS.ProcessEnv = process.env,
): {
  configured: boolean;
  mode: "sandbox" | "live";
  fhirBaseUrl: string | null;
  practiceCodeSource: "env" | "sandbox-default" | "missing";
  rateLimitPerMinute: number;
  notes: string[];
} {
  const notes: string[] = [];
  let fhirBaseUrl: string | null = null;
  let practiceCodeSource: "env" | "sandbox-default" | "missing" = "missing";

  try {
    const target = resolveEcwTarget(mode, env);
    practiceCodeSource = env.ECW_PRACTICE_CODE?.trim() ? "env" : "sandbox-default";
    fhirBaseUrl = buildEcwBaseUrl(target);
  } catch (err) {
    notes.push((err as Error).message);
  }

  if (practiceCodeSource === "sandbox-default") {
    notes.push(
      "Using the eCW sandbox practice code. This returns sandbox patients, not real ones.",
    );
  }
  if (!env.ECW_CLIENT_ID) {
    notes.push("ECW_CLIENT_ID is not set; register the app on the eCW developer portal.");
  }
  notes.push(
    `Rate limit is ${ECW_RATE_LIMIT_PER_MINUTE} calls/minute per practice code, counted per base URL.`,
  );

  return {
    configured: Boolean(fhirBaseUrl && env.ECW_CLIENT_ID),
    mode,
    fhirBaseUrl,
    practiceCodeSource,
    rateLimitPerMinute: ECW_RATE_LIMIT_PER_MINUTE,
    notes,
  };
}
