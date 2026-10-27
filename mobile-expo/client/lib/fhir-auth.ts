import { getApiUrl, apiRequest } from "./query-client";

export interface SmartAuthResult {
  accessToken: string;
  refreshToken?: string;
  patient?: string;
  expiresIn?: number;
  scope?: string;
  tokenType: string;
}

export interface EpicSearchResult {
  name: string;
  fhirBaseUrl: string;
  id: string;
  isConfigured: boolean;
}

export interface SmartAuthSession {
  authorizeUrl: string;
  organizationId: string;
  state: string;
}

export async function searchEpicHospitals(query: string): Promise<EpicSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = new URL("/api/epic/endpoints/search", getApiUrl());
    url.searchParams.set("q", query.trim());
    url.searchParams.set("limit", "20");

    const response: any = await apiRequest("GET", url.pathname + url.search);
    return response.results || [];
  } catch (error) {
    console.error("[FHIR] Epic hospital search error:", error);
    return [];
  }
}

export async function buildAuthorizeUrl(
  searchResult: EpicSearchResult
): Promise<SmartAuthSession> {
  const params = new URLSearchParams({
    fhirBaseUrl: searchResult.fhirBaseUrl,
    name: searchResult.name,
  });
  const response: any = await apiRequest(
    "GET",
    `/api/epic/ias/auth-url/${encodeURIComponent(searchResult.id)}?${params.toString()}`
  );

  return {
    authorizeUrl: response.authUrl,
    organizationId: searchResult.id,
    state: response.state,
  };
}

export function extractCodeFromUrl(url: string): {
  code: string;
  state: string;
} | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    if (code) {
      return { code, state: state || "" };
    }
    return null;
  } catch {
    return null;
  }
}

export function isCallbackUrl(url: string): boolean {
  try {
    return url.includes("/callback?code=") || url.includes("/callback?error=");
  } catch {
    return false;
  }
}

export async function exchangeCodeOnServer(
  organizationId: string,
  code: string
): Promise<SmartAuthResult> {
  const response: any = await apiRequest("POST", "/api/epic/ias/token", {
    organizationId,
    code,
  });

  const tokens = response.tokens;
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    patient: tokens.patient,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
    tokenType: tokens.token_type || "Bearer",
  };
}
