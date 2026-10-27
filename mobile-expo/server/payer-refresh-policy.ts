/** Persistent retry policy; kept independent of DB/token handling for testing. */
export const PAYER_RETRY_BASE_MS = 5 * 60_000;
export const PAYER_RETRY_MAX_MS = 6 * 60 * 60_000;
export const PAYER_REFRESH_TIMEOUT_MS = 20_000;
export const PAYER_RETRY_ALERT_THRESHOLD = 5;
export const PAYER_RETRY_ALERT_COOLDOWN_MS = 24 * 60 * 60_000;

export function payerRefreshBackoffMs(failures: number): number {
  return Math.min(PAYER_RETRY_MAX_MS, PAYER_RETRY_BASE_MS * 2 ** Math.min(16, Math.max(0, failures - 1)));
}

export function isRetryableRefreshStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
