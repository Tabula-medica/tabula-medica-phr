/**
 * optumEdi.service.ts
 * Tabula Medica — Optum VA Community Care Network (CCN) EDI Service (Lane B)
 *
 * Handles VA veteran payment flow for Lane B. When a veteran has a
 * VA Community Care referral, the VA pays the provider directly through
 * the Optum CCN (Community Care Network) — the veteran pays $0.
 *
 * EDI flow:
 *   1. Veteran selects Lane B on BookingScreen
 *   2. VAVerificationScreen captures VA referral number
 *   3. At visit completion, this service submits an 837P (professional claim)
 *      to Optum via their EDI gateway
 *   4. Optum adjudicates and pays provider within 30 days
 *   5. Claim status tracked via 276/277 status inquiry
 *
 * Optum VA CCN Payer ID: VACCN
 * EDI clearinghouse: Optum (Change Healthcare)
 * Requires: OPTUM_EDI_SENDER_ID, OPTUM_EDI_API_KEY in environment
 *
 * NOTE: All EDI transactions MUST go through your backend. The mobile app
 * only captures referral info and displays claim status.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PENDING'
  | 'ADJUDICATED'
  | 'PAID'
  | 'DENIED'
  | 'APPEALED';

export type DenialReason =
  | 'INVALID_REFERRAL'
  | 'EXPIRED_REFERRAL'
  | 'SERVICE_NOT_AUTHORIZED'
  | 'PROVIDER_NOT_IN_CCN'
  | 'DUPLICATE_CLAIM'
  | 'MISSING_INFO'
  | 'OTHER';

export interface VAReferral {
  referralNumber: string;
  veteranICN: string;
  veteranName: string;
  veteranDOB: string;
  authorizedServices: string[];
  authorizedCPTs: string[];
  expirationDate: string;
  issuingVAFacility: string;
  verified: boolean;
  verifiedAt?: string;
}

export interface CCNClaim {
  claimId: string;
  referralNumber: string;
  veteranICN: string;
  providerId: string;
  providerNPI: string;
  cptCode: string;
  serviceDescription: string;
  medicareRate: number;
  visitDate: string;
  status: ClaimStatus;
  submittedAt?: string;
  paidAt?: string;
  paidAmount?: number;
  denialReason?: DenialReason;
  denialMessage?: string;
  ediTraceNumber?: string;
  optumClaimNumber?: string;
}

export interface ClaimSubmitRequest {
  referralNumber: string;
  veteranICN: string;
  veteranName: string;
  veteranDOB: string;
  providerId: string;
  providerName: string;
  providerNPI: string;
  providerTaxId: string;
  providerAddress: string;
  cptCode: string;
  serviceDescription: string;
  icd10Codes: string[];
  medicareRate: number;
  visitDate: string;
  placeOfService: string;
  gfeId: string;
}

export interface ClaimSubmitResponse {
  success: boolean;
  claimId?: string;
  ediTraceNumber?: string;
  status: ClaimStatus;
  estimatedPayment?: string;
  errorMessage?: string;
}

export interface ReferralVerifyResponse {
  valid: boolean;
  referral?: VAReferral;
  errorMessage?: string;
  expired?: boolean;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const OPTUM_PAYER_ID = 'VACCN';

function getBackendEdiUrl(): string {
  return '/api/uninsurance/va-ccn';
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Referral Verification ───────────────────────────────────────────────────

export async function verifyVAReferral(
  referralNumber: string,
  veteranDOB: string,
): Promise<ReferralVerifyResponse> {
  const url = `${getBackendEdiUrl()}/verify-referral`;

  try {
    const resp = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralNumber, veteranDOB, payerId: OPTUM_PAYER_ID }),
      },
      15000,
    );

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      return {
        valid: false,
        errorMessage:
          (error as any).message || `Referral verification failed (${resp.status})`,
      };
    }

    const data = await resp.json();

    if (data.expired) {
      return {
        valid: false,
        expired: true,
        errorMessage:
          'This VA referral has expired. Contact your VA care coordinator for a new referral.',
      };
    }

    return {
      valid: data.valid,
      referral: data.valid
        ? {
            referralNumber: data.referralNumber,
            veteranICN: data.veteranICN,
            veteranName: data.veteranName,
            veteranDOB: data.veteranDOB,
            authorizedServices: data.authorizedServices ?? [],
            authorizedCPTs: data.authorizedCPTs ?? [],
            expirationDate: data.expirationDate,
            issuingVAFacility: data.issuingVAFacility,
            verified: true,
            verifiedAt: new Date().toISOString(),
          }
        : undefined,
      errorMessage: data.valid ? undefined : data.message,
    };
  } catch (err) {
    return {
      valid: false,
      errorMessage: `Network error verifying referral: ${(err as Error).message}`,
    };
  }
}

// ─── Claim Submission (837P) ─────────────────────────────────────────────────

export async function submitCCNClaim(
  request: ClaimSubmitRequest,
): Promise<ClaimSubmitResponse> {
  const url = `${getBackendEdiUrl()}/submit-claim`;

  try {
    const resp = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          payerId: OPTUM_PAYER_ID,
          claimType: '837P',
        }),
      },
      30000,
    );

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      return {
        success: false,
        status: 'DRAFT',
        errorMessage:
          (error as any).message || `Claim submission failed (${resp.status})`,
      };
    }

    const data = await resp.json();
    return {
      success: true,
      claimId: data.claimId,
      ediTraceNumber: data.ediTraceNumber,
      status: data.status ?? 'SUBMITTED',
      estimatedPayment: data.estimatedPayment ?? '30 calendar days',
    };
  } catch (err) {
    return {
      success: false,
      status: 'DRAFT',
      errorMessage: `Claim submission error: ${(err as Error).message}`,
    };
  }
}

// ─── Claim Status Inquiry (276/277) ──────────────────────────────────────────

export async function checkClaimStatus(
  claimId: string,
): Promise<CCNClaim | null> {
  const url = `${getBackendEdiUrl()}/claim-status/${encodeURIComponent(claimId)}`;

  try {
    const resp = await fetchWithTimeout(url, { method: 'GET' }, 10000);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function getVeteranClaims(
  veteranICN: string,
): Promise<CCNClaim[]> {
  const url = `${getBackendEdiUrl()}/claims?veteranICN=${encodeURIComponent(veteranICN)}`;

  try {
    const resp = await fetchWithTimeout(url, { method: 'GET' }, 10000);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.claims ?? [];
  } catch {
    return [];
  }
}

// ─── Status Display Helpers ──────────────────────────────────────────────────

export function getClaimStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    DRAFT: 'Draft — not yet submitted',
    SUBMITTED: 'Submitted to Optum CCN',
    ACKNOWLEDGED: 'Received by Optum — processing',
    PENDING: 'Under review by VA',
    ADJUDICATED: 'Adjudicated — payment processing',
    PAID: 'Paid to provider',
    DENIED: 'Denied — see details',
    APPEALED: 'Appeal submitted',
  };
  return labels[status] ?? status;
}

export function getClaimStatusColor(status: ClaimStatus): string {
  const colors: Record<ClaimStatus, string> = {
    DRAFT: '#8fa3b8',
    SUBMITTED: '#0284c7',
    ACKNOWLEDGED: '#0284c7',
    PENDING: '#f59e0b',
    ADJUDICATED: '#0d9e8a',
    PAID: '#15803d',
    DENIED: '#e11d48',
    APPEALED: '#7c3aed',
  };
  return colors[status] ?? '#8fa3b8';
}

export function formatVeteranClaimSummary(claim: CCNClaim): string {
  return [
    `Claim: ${claim.optumClaimNumber ?? claim.claimId}`,
    `Service: ${claim.serviceDescription} (${claim.cptCode})`,
    `Visit: ${claim.visitDate}`,
    `Status: ${getClaimStatusLabel(claim.status)}`,
    `VA Referral: ${claim.referralNumber}`,
    claim.paidAmount != null ? `Paid: $${claim.paidAmount.toFixed(2)}` : '',
    claim.denialMessage ? `Note: ${claim.denialMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
