/* eslint-disable expo/no-dynamic-env-var -- Server-only OAuth registrations are selected by source at runtime. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getPayerToken, storePayerToken } from "./auth0-fhir-broker";
import { safeFetch, validateExternalUrl } from "./utils/safe-fetch";

interface ReauthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  webRedirectUri?: string;
  scopes: string;
}

export class PayerReauthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Dependencies {
  getConnection: typeof getPayerToken;
  storeTokens: typeof storePayerToken;
  fetch: typeof safeFetch;
  validateUrl: typeof validateExternalUrl;
  config: (source: string) => ReauthConfig;
  signingKey: () => string;
}

function configuredSource(source: string): ReauthConfig {
  const prefix = `SMART_${source.toUpperCase()}`;
  const authorizationUrl = process.env[`${prefix}_AUTHORIZATION_URL`];
  const tokenUrl = process.env[`${prefix}_TOKEN_URL`];
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  if (!authorizationUrl || !tokenUrl || !clientId) {
    throw new PayerReauthError(503, "Reconnecting this source is temporarily unavailable. Please try again later.");
  }
  return {
    authorizationUrl,
    tokenUrl,
    clientId,
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    redirectUri: process.env[`${prefix}_REDIRECT_URI`] || "tabulamedica://payer-reconnect",
    webRedirectUri: process.env[`${prefix}_WEB_REDIRECT_URI`],
    scopes: process.env[`${prefix}_SCOPES`] || "openid fhirUser offline_access patient/*.read",
  };
}

/**
 * Source-specific authorization-code + PKCE flow. State is signed, expires in
 * ten minutes, and is bound to the authenticated patient and exact source.
 * The verifier is derived server-side, never exposed in the authorization URL.
 * The upstream authorization code is single-use; no process-local session
 * storage is required, so starting and completing on different servers works.
 */
export function createPayerReauthorization(overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    getConnection: getPayerToken,
    storeTokens: storePayerToken,
    fetch: safeFetch,
    validateUrl: validateExternalUrl,
    config: configuredSource,
    signingKey: () => {
      if (!process.env.SESSION_SECRET) throw new PayerReauthError(503, "Reconnecting is temporarily unavailable.");
      return process.env.SESSION_SECRET;
    },
    ...overrides,
  };
  const mac = (key: string, text: string) => createHmac("sha256", key).update(text).digest("base64url");
  const verifier = (key: string, nonce: string) => mac(key, `payer-reauth-pkce:${nonce}`);
  const configHash = (config: ReauthConfig) => createHash("sha256")
    .update(JSON.stringify([config.authorizationUrl, config.tokenUrl, config.clientId, config.redirectUri, config.scopes]))
    .digest("base64url");

  function validateSource(source: unknown): asserts source is string {
    if (typeof source !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(source)) {
      throw new PayerReauthError(400, "Invalid connection source.");
    }
  }

  async function connection(userId: string, source: string) {
    const stored = await deps.getConnection(userId, source);
    if (!stored) throw new PayerReauthError(404, "This source is not linked to your account.");
    return stored;
  }
  function platformConfig(source: string, platform: unknown) {
    const config = deps.config(source);
    if (platform === "web") {
      if (!config.webRedirectUri || new URL(config.webRedirectUri).protocol !== "https:") {
        throw new PayerReauthError(503, "Reconnecting this source in a browser is not available. Please use the mobile app.");
      }
      return { ...config, redirectUri: config.webRedirectUri };
    }
    if (platform !== "native") throw new PayerReauthError(400, "Invalid reconnect platform.");
    return config;
  }

  return {
    async start(userId: string, source: unknown, platform: unknown = "native") {
      validateSource(source);
      const stored = await connection(userId, source);
      const config = platformConfig(source, platform);
      const key = deps.signingKey();
      await deps.validateUrl(config.authorizationUrl);
      await deps.validateUrl(config.tokenUrl);
      const redirect = new URL(config.redirectUri);
      if (redirect.protocol !== "https:" && config.redirectUri !== "tabulamedica://payer-reconnect") {
        throw new PayerReauthError(503, "This source's reconnect callback is not configured.");
      }
      const nonce = randomBytes(32).toString("base64url");
      const payload = Buffer.from(JSON.stringify({
        source, nonce, platform, expires: Date.now() + 10 * 60_000,
        patient: mac(key, `payer-reauth-patient:${userId}`),
        config: configHash(config),
      })).toString("base64url");
      const state = `${payload}.${mac(key, `payer-reauth-state:${payload}`)}`;
      const url = new URL(config.authorizationUrl);
      for (const [name, value] of Object.entries({
        response_type: "code", client_id: config.clientId,
        redirect_uri: config.redirectUri, scope: config.scopes, state,
        code_challenge: createHash("sha256").update(verifier(key, nonce)).digest("base64url"),
        code_challenge_method: "S256",
        ...(stored.fhirBaseUrl ? { aud: stored.fhirBaseUrl } : {}),
      })) url.searchParams.set(name, value);
      return { authorizationUrl: url.toString(), redirectUri: config.redirectUri, state };
    },

    async complete(userId: string, source: unknown, code: unknown, state: unknown) {
      validateSource(source);
      if (typeof code !== "string" || !code || code.length > 8192 ||
          typeof state !== "string" || state.length > 4096) {
        throw new PayerReauthError(400, "Invalid reconnect response. Please try again.");
      }
      const key = deps.signingKey();
      const [payload, signature, extra] = state.split(".");
      const expected = mac(key, `payer-reauth-state:${payload}`);
      if (!signature || extra || !/^[A-Za-z0-9_-]{43}$/.test(signature) ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new PayerReauthError(400, "Invalid reconnect session. Please try again.");
      }
      let session;
      try {
        session = JSON.parse(Buffer.from(payload, "base64url").toString());
      } catch {
        throw new PayerReauthError(400, "Invalid reconnect session. Please try again.");
      }
      if (!session || typeof session !== "object") {
        throw new PayerReauthError(400, "Invalid reconnect session. Please try again.");
      }
      const config = platformConfig(source, session.platform);
      if (session.source !== source || session.patient !== mac(key, `payer-reauth-patient:${userId}`) ||
          !Number.isFinite(session.expires) || session.expires < Date.now() ||
          typeof session.nonce !== "string" || session.config !== configHash(config)) {
        throw new PayerReauthError(400, "Reconnect session expired or does not match this connection. Please try again.");
      }
      const stored = await connection(userId, source);
      const body = new URLSearchParams({
        grant_type: "authorization_code", code, client_id: config.clientId,
        redirect_uri: config.redirectUri, code_verifier: verifier(key, session.nonce),
      });
      if (config.clientSecret) body.set("client_secret", config.clientSecret);
      let tokens;
      try {
        const response = await deps.fetch(config.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: AbortSignal.timeout(20_000),
          // Do not forward an authorization code or client secret on redirects.
          redirect: "error",
        }, 0);
        if (!response.ok) throw new Error("exchange rejected");
        tokens = await response.json();
        if (typeof tokens.access_token !== "string" || !tokens.access_token ||
            (tokens.refresh_token != null && typeof tokens.refresh_token !== "string")) {
          throw new Error("invalid token response");
        }
      } catch {
        // Never expose token endpoint response bodies, authorization codes or secrets.
        throw new PayerReauthError(502, "Could not renew this connection. Please try reconnecting again.");
      }
      const expiresIn = Number(tokens.expires_in ?? 3600);
      if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 365 * 24 * 3600) {
        throw new PayerReauthError(502, "The source returned an invalid reconnect response.");
      }
      await deps.storeTokens(userId, source, {
        accessToken: tokens.access_token,
        // Do not reuse the revoked refresh token when the new grant omits it.
        refreshToken: tokens.refresh_token || "",
        expiresAt: Date.now() + expiresIn * 1000,
        fhirBaseUrl: stored.fhirBaseUrl,
      });
      return { sourceType: source, syncStatus: "active" as const, needsReauth: false };
    },
  };
}
