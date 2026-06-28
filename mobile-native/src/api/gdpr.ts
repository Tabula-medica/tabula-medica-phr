/**
 * GDPR / CCPA data-rights endpoints (server/routes/gdpr-routes.ts).
 *
 * These are legally mandated for ALL users (never feature-gated). "Account
 * deletion" maps to the erasure request, which the backend schedules with a
 * 30-day grace period and can be cancelled before it runs.
 *
 * IMPORTANT: the backend resolves the account from the authenticated session
 * EMAIL (resolveAccountIdFromSession). The bearer GCIP token carries that
 * email claim, so these calls authenticate the same way as the rest of the
 * app once a session exists.
 */
import { api } from "./client";
import type {
  DataRightsRequest,
  ErasureResponse,
  PrivacyPreferences,
} from "./types";

export async function getDataRightsRequests(): Promise<DataRightsRequest[]> {
  const res = await api.get<{ requests: DataRightsRequest[] }>("/api/gdpr/requests");
  return res.requests;
}

export async function getPrivacyPreferences(): Promise<PrivacyPreferences> {
  const res = await api.get<{ preferences: PrivacyPreferences }>("/api/gdpr/preferences");
  return res.preferences;
}

export type ProcessingPrefKey =
  | "aiProcessingOptOut"
  | "marketingEmailsOptOut"
  | "analyticsOptOut"
  | "doNotSell"
  | "limitSensitivePi"
  | "optOutAutomatedDecisions";

export async function updateProcessingPrefs(
  patch: Partial<Record<ProcessingPrefKey, boolean>>
): Promise<PrivacyPreferences> {
  const res = await api.patch<{ preferences: PrivacyPreferences }>(
    "/api/gdpr/processing-prefs",
    patch
  );
  return res.preferences;
}

export async function requestDataExport(
  framework: "gdpr" | "ccpa" = "gdpr"
): Promise<{ request: DataRightsRequest; message: string }> {
  return api.post("/api/gdpr/access-request", { framework });
}

export async function requestPortabilityExport(
  framework: "gdpr" | "ccpa" = "gdpr"
): Promise<{ request: DataRightsRequest; message: string }> {
  return api.post("/api/gdpr/portability-request", { framework });
}

/** Account deletion = right to erasure (30-day grace, cancellable). */
export async function requestAccountDeletion(
  framework: "gdpr" | "ccpa" = "gdpr"
): Promise<ErasureResponse> {
  return api.post<ErasureResponse>("/api/gdpr/erasure-request", { framework });
}

export async function cancelAccountDeletion(
  requestId: string
): Promise<{ request: DataRightsRequest }> {
  return api.post(`/api/gdpr/erasure-cancel/${requestId}`);
}

export interface DpoContact {
  name: string;
  email: string;
  address: string;
  responseSlaDays: number;
  escalation: string;
}

export async function getDpoContact(): Promise<DpoContact> {
  const res = await api.get<{ dpo: DpoContact }>("/api/gdpr/dpo");
  return res.dpo;
}
