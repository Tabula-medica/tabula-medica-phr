// ABHA enrollment (India). Two-step Aadhaar/mobile flow: request OTP → verify → create ABHA.
// Sensitive fields RSA-encrypted (crypto); calls carry the v3 session bearer (gateway). Stub-by-default.
// VERIFY endpoint paths + consent version against the ABHA v3 sandbox docs (centralized below).
// Mirrors omnihealth-ehr api/src/integrations/abdm-abha.ts.
import { abdmConfig } from "./config";
import { abdmFetch } from "./fetch";
import { getAbdmToken, abdmHeaders } from "./gateway";
import { getAbdmPublicCert, rsaEncrypt } from "./crypto";

const ENDPOINTS = {
  requestOtp: "/v3/enrollment/request/otp",
  enrolByAadhaar: "/v3/enrollment/enrol/byAadhaar",
};
const ENROL_CONSENT = { code: "abha-enrollment", version: "1.4" };

export type OtpMode = "aadhaar" | "mobile";
export interface AbhaOtpRequest { value: string; mode: OtpMode }
export interface AbhaOtpResult { txnId: string; message: string; source: "stub" | "abdm" }
export interface AbhaProfile {
  abhaNumber?: string;
  abhaAddress?: string;
  name?: string;
  token?: string;
  source: "stub" | "abdm";
  verified: boolean;
}

async function authedHeaders(nowMs: number) {
  return abdmHeaders(nowMs, await getAbdmToken(nowMs));
}

export async function requestAbhaOtp(input: AbhaOtpRequest, nowMs: number): Promise<AbhaOtpResult> {
  if (!abdmConfig.enabled) {
    return { txnId: "stub-txn", message: "OTP sent (sandbox test OTP: 123456)", source: "stub" };
  }
  const cert = await getAbdmPublicCert(nowMs);
  const body = {
    txnId: "",
    scope: ["abha-enrol"],
    loginHint: input.mode,
    loginId: rsaEncrypt(cert, input.value),
    otpSystem: input.mode === "aadhaar" ? "aadhaar" : "abdm",
  };
  const res = await abdmFetch(`${abdmConfig.abhaBaseUrl}${ENDPOINTS.requestOtp}`, {
    method: "POST", headers: await authedHeaders(nowMs), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ABHA request-OTP failed: ${res.status}`);
  const j = (await res.json()) as { txnId?: string; message?: string };
  if (!j.txnId) throw new Error("ABHA request-OTP response missing txnId");
  return { txnId: j.txnId, message: j.message ?? "OTP sent", source: "abdm" };
}

export async function enrolAbhaByOtp(input: { txnId: string; otp: string; mobile?: string }, nowMs: number): Promise<AbhaProfile> {
  if (!abdmConfig.enabled) {
    return { abhaNumber: "91-1111-1111-1111", abhaAddress: "demo.patient@sbx", name: "Demo Patient", source: "stub", verified: false };
  }
  const cert = await getAbdmPublicCert(nowMs);
  const body = {
    authData: {
      authMethods: ["otp"],
      otp: {
        txnId: input.txnId,
        otpValue: rsaEncrypt(cert, input.otp),
        timeStamp: new Date(nowMs).toISOString(),
        ...(input.mobile ? { mobile: input.mobile } : {}),
      },
    },
    consent: ENROL_CONSENT,
  };
  const res = await abdmFetch(`${abdmConfig.abhaBaseUrl}${ENDPOINTS.enrolByAadhaar}`, {
    method: "POST", headers: await authedHeaders(nowMs), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ABHA enrol failed: ${res.status}`);
  const j = (await res.json()) as { ABHAProfile?: Record<string, unknown>; tokens?: { token?: string } };
  const p = (j.ABHAProfile ?? {}) as Record<string, unknown>;
  return {
    abhaNumber: (p.ABHANumber ?? p.abhaNumber) as string | undefined,
    abhaAddress: (p.phrAddress ?? p.abhaAddress) as string | undefined,
    name: (p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" ")) as string | undefined,
    token: j.tokens?.token,
    source: "abdm",
    verified: true,
  };
}
