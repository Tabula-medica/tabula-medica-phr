// ABDM v3 gateway session client (India). Every ABHA / consent call needs a bearer token from
// POST {baseUrl}/api/hiecm/gateway/v3/sessions (clientId + clientSecret, grantType client_credentials).
// Plaintext-over-TLS (no RSA). Stub-by-default; real calls when abdmConfig.enabled + creds; enabled
// without a secret fails closed. Mirrors omnihealth-ehr api/src/integrations/abdm-gateway.ts.
import { randomUUID } from "node:crypto";
import { abdmConfig } from "./config";
import { abdmFetch } from "./fetch";

export interface AbdmSession {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  source: "stub" | "abdm";
}

let cached: { token: string; expiresAt: number } | null = null;

export function abdmHeaders(nowMs: number, accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "REQUEST-ID": randomUUID(),
    TIMESTAMP: new Date(nowMs).toISOString(),
    "X-CM-ID": abdmConfig.cmId,
  };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

export async function getAbdmSession(nowMs: number): Promise<AbdmSession> {
  if (!abdmConfig.enabled) {
    return { accessToken: "stub-abdm-token", expiresIn: 1200, tokenType: "bearer", source: "stub" };
  }
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    throw new Error("ABDM enabled but ABDM_CLIENT_ID/ABDM_CLIENT_SECRET are not configured.");
  }
  const res = await abdmFetch(`${abdmConfig.baseUrl}/api/hiecm/gateway/v3/sessions`, {
    method: "POST",
    headers: abdmHeaders(nowMs),
    body: JSON.stringify({ clientId: abdmConfig.clientId, clientSecret: abdmConfig.clientSecret, grantType: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`ABDM session request failed: ${res.status}`);
  const j = (await res.json()) as { accessToken?: string; expiresIn?: number; tokenType?: string };
  if (!j.accessToken) throw new Error("ABDM session response missing accessToken");
  return { accessToken: j.accessToken, expiresIn: j.expiresIn ?? 1200, tokenType: j.tokenType ?? "bearer", source: "abdm" };
}

export async function getAbdmToken(nowMs: number): Promise<string> {
  if (cached && cached.expiresAt > nowMs + 30_000) return cached.token;
  const s = await getAbdmSession(nowMs);
  cached = { token: s.accessToken, expiresAt: nowMs + s.expiresIn * 1000 };
  return s.accessToken;
}

export function _resetAbdmTokenCache(): void {
  cached = null;
}
