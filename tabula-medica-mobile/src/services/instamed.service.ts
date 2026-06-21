/**
 * instamed.service.ts
 * Tabula Medica — InstaMed Patient Payment Service (Lane A)
 *
 * Handles self-pay patient payments for Lane A (civilian uninsured).
 * InstaMed (a J.P. Morgan company) processes the payment at point of care
 * with 24-hour ACH settlement to the provider.
 *
 * Integration flow:
 *   1. Patient selects Lane A ("I'll pay today") on BookingScreen
 *   2. At check-in, provider initiates payment via InstaMed terminal or API
 *   3. Patient taps/swipes/inserts card (or AaNeel NFC card)
 *   4. InstaMed processes → returns transaction ID
 *   5. Transaction ID stored in encounter writeback for reconciliation
 *
 * InstaMed API docs: https://developer.instamed.com
 * Requires: INSTAMED_API_KEY, INSTAMED_MERCHANT_ID in environment
 *
 * NOTE: In production, all payment API calls MUST go through your backend.
 * The mobile app should never hold merchant credentials.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'INITIATED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'VOIDED';

export type PaymentMethod =
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'HSA_CARD'
  | 'FSA_CARD'
  | 'ACH_BANK'
  | 'AANEEL_NFC'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY';

export interface PaymentRequest {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  providerId: string;
  providerName: string;
  providerMerchantId: string;
  amount: number;
  currency: 'USD';
  cptCode: string;
  serviceDescription: string;
  gfeId: string;
  paymentMethod?: PaymentMethod;
  aaneelCardId?: string;
  idempotencyKey: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status: PaymentStatus;
  amount?: number;
  settledAt?: string;
  estimatedSettlement?: string;
  receiptUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export interface PaymentEstimate {
  subtotal: number;
  slidingScaleDiscount: number;
  adjustedTotal: number;
  processingFee: number;
  patientOwes: number;
  hsaEligible: boolean;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
  patientId: string;
  gfeId: string;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  estimatedArrival?: string;
  errorMessage?: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const INSTAMED_BASE_URL = 'https://connect.instamed.com/api/v1';
const PAYMENT_TIMEOUT_MS = 30000;

function getBackendPaymentUrl(): string {
  return '/api/uninsurance/payments';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateIdempotencyKey(patientId: string, gfeId: string): string {
  return `${patientId}-${gfeId}-${Date.now()}`;
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

// ─── Payment Functions ───────────────────────────────────────────────────────

export async function initiatePayment(
  request: PaymentRequest,
): Promise<PaymentResponse> {
  const url = `${getBackendPaymentUrl()}/initiate`;

  try {
    const resp = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          idempotencyKey:
            request.idempotencyKey ||
            generateIdempotencyKey(request.patientId, request.gfeId),
        }),
      },
      PAYMENT_TIMEOUT_MS,
    );

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      return {
        success: false,
        status: 'FAILED',
        errorCode: `HTTP_${resp.status}`,
        errorMessage:
          (error as any).message || `Payment request failed (${resp.status})`,
        retryable: resp.status >= 500,
      };
    }

    const data = await resp.json();
    return {
      success: true,
      transactionId: data.transactionId,
      status: data.status ?? 'COMPLETED',
      amount: data.amount,
      settledAt: data.settledAt,
      estimatedSettlement: data.estimatedSettlement ?? '24 hours (ACH)',
      receiptUrl: data.receiptUrl,
    };
  } catch (err) {
    const message = (err as Error).message;
    return {
      success: false,
      status: 'FAILED',
      errorCode: message.includes('abort') ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: message.includes('abort')
        ? 'Payment request timed out — try again'
        : `Network error: ${message}`,
      retryable: true,
    };
  }
}

export async function checkPaymentStatus(
  transactionId: string,
): Promise<PaymentResponse> {
  const url = `${getBackendPaymentUrl()}/status/${encodeURIComponent(transactionId)}`;

  try {
    const resp = await fetchWithTimeout(url, { method: 'GET' }, 10000);
    if (!resp.ok) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: `Status check failed (${resp.status})`,
      };
    }
    const data = await resp.json();
    return {
      success: data.status === 'COMPLETED',
      transactionId,
      status: data.status,
      amount: data.amount,
      settledAt: data.settledAt,
      receiptUrl: data.receiptUrl,
    };
  } catch {
    return {
      success: false,
      status: 'PROCESSING',
      transactionId,
      errorMessage: 'Unable to check status — will retry',
      retryable: true,
    };
  }
}

export async function requestRefund(
  request: RefundRequest,
): Promise<RefundResponse> {
  const url = `${getBackendPaymentUrl()}/refund`;

  try {
    const resp = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
      PAYMENT_TIMEOUT_MS,
    );

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      return {
        success: false,
        status: 'FAILED',
        errorMessage:
          (error as any).message || `Refund request failed (${resp.status})`,
      };
    }

    const data = await resp.json();
    return {
      success: true,
      refundId: data.refundId,
      status: data.status ?? 'PENDING',
      estimatedArrival: data.estimatedArrival ?? '5-10 business days',
    };
  } catch (err) {
    return {
      success: false,
      status: 'FAILED',
      errorMessage: `Refund error: ${(err as Error).message}`,
    };
  }
}

export function calculatePaymentEstimate(params: {
  medicareRate: number;
  slidingScaleDiscount: number;
  hsaEligible: boolean;
}): PaymentEstimate {
  const adjustedTotal = Math.round(
    params.medicareRate * (1 - params.slidingScaleDiscount / 100) * 100,
  ) / 100;
  const processingFee = 0;

  return {
    subtotal: params.medicareRate,
    slidingScaleDiscount: params.slidingScaleDiscount,
    adjustedTotal,
    processingFee,
    patientOwes: adjustedTotal + processingFee,
    hsaEligible: params.hsaEligible,
  };
}

export function formatReceiptText(payment: PaymentResponse, serviceName: string): string {
  return [
    '═══════════════════════════════════════',
    '       TABULA MEDICA — UNINSURANCE',
    '           PAYMENT RECEIPT',
    '═══════════════════════════════════════',
    '',
    `Service:        ${serviceName}`,
    `Amount Paid:    $${(payment.amount ?? 0).toFixed(2)}`,
    `Transaction ID: ${payment.transactionId ?? 'N/A'}`,
    `Status:         ${payment.status}`,
    `Date:           ${payment.settledAt ?? new Date().toISOString()}`,
    '',
    'Payment processed by InstaMed (J.P. Morgan)',
    'Settlement: 24-hour ACH to provider',
    '',
    'Questions? support@tabulamedica.health',
    '═══════════════════════════════════════',
  ].join('\n');
}
