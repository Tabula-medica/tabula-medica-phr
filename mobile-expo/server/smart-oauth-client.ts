import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import type { InsertSmartApp, InsertSmartAppToken, InsertSmartAppAccessLog } from "@shared/schema";

export interface SmartAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  patient?: string;
  id_token?: string;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

// Standard SMART on FHIR scopes
export const SMART_SCOPES = {
  // Launch scopes
  launch: "launch",
  launchPatient: "launch/patient",
  launchEncounter: "launch/encounter",
  launchPractitioner: "launch/practitioner",

  // OpenID scopes
  openid: "openid",
  fhirUser: "fhirUser",
  profile: "profile",
  offline: "offline_access",

  // Patient-level read scopes
  patientRead: {
    all: "patient/*.read",
    patient: "patient/Patient.read",
    observation: "patient/Observation.read",
    condition: "patient/Condition.read",
    medicationRequest: "patient/MedicationRequest.read",
    medicationStatement: "patient/MedicationStatement.read",
    immunization: "patient/Immunization.read",
    encounter: "patient/Encounter.read",
    procedure: "patient/Procedure.read",
    allergyIntolerance: "patient/AllergyIntolerance.read",
    diagnosticReport: "patient/DiagnosticReport.read",
    documentReference: "patient/DocumentReference.read",
    careTeam: "patient/CareTeam.read",
    carePlan: "patient/CarePlan.read",
    goal: "patient/Goal.read",
  },

  // User-level read scopes
  userRead: {
    all: "user/*.read",
    patient: "user/Patient.read",
    practitioner: "user/Practitioner.read",
    organization: "user/Organization.read",
  },

  // Write scopes
  patientWrite: {
    all: "patient/*.write",
    observation: "patient/Observation.write",
    condition: "patient/Condition.write",
  },
} as const;

// Generate PKCE challenge for secure OAuth flow
export function generatePKCEChallenge(): PKCEChallenge {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

// Generate secure state parameter
export function generateState(): string {
  return randomBytes(16).toString("hex");
}

// Build authorization URL with all required parameters
export function buildAuthorizationUrl(
  config: SmartAuthConfig,
  state: string,
  pkce: PKCEChallenge,
  audience?: string,
  launch?: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: pkce.codeChallengeMethod,
  });

  if (audience) {
    params.set("aud", audience);
  }

  if (launch) {
    params.set("launch", launch);
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  tokenUrl: string,
  code: string,
  clientId: string,
  clientSecret: string | undefined,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// Refresh access token
export async function refreshAccessToken(
  tokenUrl: string,
  refreshToken: string,
  clientId: string,
  clientSecret?: string,
  scopes?: string[]
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  if (scopes && scopes.length > 0) {
    body.set("scope", scopes.join(" "));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// Revoke token
export async function revokeToken(
  revokeUrl: string,
  token: string,
  tokenTypeHint: "access_token" | "refresh_token",
  clientId: string,
  clientSecret?: string
): Promise<boolean> {
  const body = new URLSearchParams({
    token,
    token_type_hint: tokenTypeHint,
    client_id: clientId,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }

  const response = await fetch(revokeUrl, {
    method: "POST",
    headers,
    body,
  });

  return response.ok;
}

// Check if token is expired or about to expire
export function isTokenExpired(expiresAt: Date, bufferSeconds = 60): boolean {
  const now = new Date();
  const bufferMs = bufferSeconds * 1000;
  return expiresAt.getTime() - bufferMs <= now.getTime();
}

// Validate scopes against allowed scopes
export function validateScopes(requestedScopes: string[], allowedScopes: string[]): {
  valid: boolean;
  approved: string[];
  denied: string[];
} {
  const approved: string[] = [];
  const denied: string[] = [];

  for (const scope of requestedScopes) {
    if (allowedScopes.includes(scope) || allowedScopes.includes("*")) {
      approved.push(scope);
    } else {
      // Check for wildcard patterns
      const hasWildcard = allowedScopes.some((allowed) => {
        if (allowed.endsWith(".*")) {
          const prefix = allowed.slice(0, -1);
          return scope.startsWith(prefix);
        }
        return false;
      });

      if (hasWildcard) {
        approved.push(scope);
      } else {
        denied.push(scope);
      }
    }
  }

  return {
    valid: denied.length === 0,
    approved,
    denied,
  };
}

// Parse scope string into scope categories
export function parseScopeCategories(scopes: string[]): {
  launch: string[];
  clinical: string[];
  user: string[];
  system: string[];
  openid: string[];
} {
  const categories = {
    launch: [] as string[],
    clinical: [] as string[],
    user: [] as string[],
    system: [] as string[],
    openid: [] as string[],
  };

  for (const scope of scopes) {
    if (scope.startsWith("launch")) {
      categories.launch.push(scope);
    } else if (scope.startsWith("patient/") || scope.startsWith("user/")) {
      if (scope.startsWith("patient/")) {
        categories.clinical.push(scope);
      } else {
        categories.user.push(scope);
      }
    } else if (scope.startsWith("system/")) {
      categories.system.push(scope);
    } else if (["openid", "fhirUser", "profile", "offline_access"].includes(scope)) {
      categories.openid.push(scope);
    }
  }

  return categories;
}

// Get FHIR resource types from scopes
export function getResourceTypesFromScopes(scopes: string[]): string[] {
  const resourceTypes = new Set<string>();

  for (const scope of scopes) {
    const match = scope.match(/^(patient|user|system)\/(\w+)\.(read|write|\*)$/);
    if (match) {
      const resourceType = match[2];
      if (resourceType !== "*") {
        resourceTypes.add(resourceType);
      }
    }
  }

  return Array.from(resourceTypes);
}

// SMART App Manager class
export class SmartAppManager {
  async registerApp(app: InsertSmartApp): Promise<any> {
    return storage.createSmartApp(app);
  }

  async getApp(appId: string): Promise<any> {
    return storage.getSmartApp(appId);
  }

  async getAppsForUser(userId: string): Promise<any[]> {
    return storage.getSmartAppsByUser(userId);
  }

  async updateApp(appId: string, updates: Partial<InsertSmartApp>): Promise<any> {
    return storage.updateSmartApp(appId, updates);
  }

  async deleteApp(appId: string): Promise<void> {
    await storage.deleteSmartApp(appId);
  }

  async storeToken(token: InsertSmartAppToken): Promise<any> {
    return storage.createSmartAppToken(token);
  }

  async getActiveToken(appId: string, userId: string): Promise<any> {
    return storage.getActiveSmartAppToken(appId, userId);
  }

  async revokeAppTokens(appId: string): Promise<void> {
    await storage.revokeSmartAppTokens(appId);
  }

  async logAccess(log: InsertSmartAppAccessLog): Promise<void> {
    await storage.createSmartAppAccessLog(log);
  }

  async getAccessLogs(appId: string, limit = 100): Promise<any[]> {
    return storage.getSmartAppAccessLogs(appId, limit);
  }

  async getAccessStats(appId: string): Promise<{
    totalAccess: number;
    resourceAccess: Record<string, number>;
    scopeUsage: Record<string, number>;
  }> {
    const logs = await storage.getSmartAppAccessLogs(appId, 1000);
    
    const resourceAccess: Record<string, number> = {};
    const scopeUsage: Record<string, number> = {};

    for (const log of logs) {
      if (log.resourceType) {
        resourceAccess[log.resourceType] = (resourceAccess[log.resourceType] || 0) + (log.resourceCount || 1);
      }
      if (log.scopesUsed) {
        for (const scope of log.scopesUsed as string[]) {
          scopeUsage[scope] = (scopeUsage[scope] || 0) + 1;
        }
      }
    }

    return {
      totalAccess: logs.length,
      resourceAccess,
      scopeUsage,
    };
  }
}

export const smartAppManager = new SmartAppManager();
