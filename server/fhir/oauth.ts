import { randomBytes, createHash } from "crypto";
import type { FhirConfig, OAuthTokens, SmartLaunchContext } from "@shared/schema";
import { resolveAuthEndpoints } from "./discovery";

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface AuthorizationUrlParams {
  fhirConfig: FhirConfig;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  clientId?: string;
}

export function buildAuthorizationUrl(params: AuthorizationUrlParams): string {
  const { fhirConfig, redirectUri, state, codeChallenge, clientId } = params;
  
  const url = new URL(fhirConfig.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId || fhirConfig.clientId || "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", fhirConfig.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("aud", fhirConfig.fhirBaseUrl);
  
  if (fhirConfig.usePkce) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  
  return url.toString();
}

export interface TokenExchangeParams {
  fhirConfig: FhirConfig;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId?: string;
  clientSecret?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  patient?: string;
  encounter?: string;
  need_patient_banner?: boolean;
  smart_style_url?: string;
}

export async function exchangeCodeForTokens(
  params: TokenExchangeParams
): Promise<{ tokens: OAuthTokens; smartContext: SmartLaunchContext }> {
  const { fhirConfig, code, redirectUri, codeVerifier, clientId, clientSecret } = params;
  
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId || fhirConfig.clientId || "",
  });
  
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  
  if (clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }
  
  const response = await fetch(fhirConfig.tokenEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }
  
  const tokenResponse: TokenResponse = await response.json();
  
  const expiresAt = new Date(
    Date.now() + (tokenResponse.expires_in || 3600) * 1000
  ).toISOString();
  
  const tokens: OAuthTokens = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type || "Bearer",
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    scopes: tokenResponse.scope?.split(" ") || fhirConfig.scopes,
    idToken: tokenResponse.id_token,
  };
  
  const smartContext: SmartLaunchContext = {
    patientId: tokenResponse.patient,
    encounterId: tokenResponse.encounter,
    needPatientBanner: tokenResponse.need_patient_banner,
  };
  
  return { tokens, smartContext };
}

export interface RefreshTokenParams {
  fhirConfig: FhirConfig;
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
}

export async function refreshAccessToken(
  params: RefreshTokenParams
): Promise<OAuthTokens> {
  const { fhirConfig, refreshToken, clientId, clientSecret } = params;
  
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId || fhirConfig.clientId || "",
  });
  
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  
  if (clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }
  
  const response = await fetch(fhirConfig.tokenEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }
  
  const tokenResponse: TokenResponse = await response.json();
  
  const expiresAt = new Date(
    Date.now() + (tokenResponse.expires_in || 3600) * 1000
  ).toISOString();
  
  return {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type || "Bearer",
    refreshToken: tokenResponse.refresh_token || refreshToken,
    expiresAt,
    scopes: tokenResponse.scope?.split(" ") || [],
    idToken: tokenResponse.id_token,
  };
}

export function isTokenExpired(expiresAt: string, bufferSeconds = 60): boolean {
  const expiry = new Date(expiresAt);
  const now = new Date(Date.now() + bufferSeconds * 1000);
  return expiry <= now;
}

export async function buildSmartAuthorizationUrl(
  params: AuthorizationUrlParams & { fhirBaseUrl?: string }
): Promise<string> {
  const { fhirConfig, fhirBaseUrl } = params;
  const baseUrl = fhirBaseUrl || fhirConfig.fhirBaseUrl;

  const resolved = await resolveAuthEndpoints(
    baseUrl,
    fhirConfig.authorizationEndpoint,
    fhirConfig.tokenEndpoint
  );

  const enhancedConfig = {
    ...fhirConfig,
    authorizationEndpoint: resolved.authorizationEndpoint,
    tokenEndpoint: resolved.tokenEndpoint,
    usePkce: resolved.supportsPkce,
  };

  return buildAuthorizationUrl({ ...params, fhirConfig: enhancedConfig });
}
