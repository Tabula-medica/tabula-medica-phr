export interface SharePasscodeRecord {
  failures: number;
  lastFailure: number;
  lockedUntil: number;
}

export const SHARE_PASSCODE_WINDOW_MS = 3_600_000;

const SHARE_PASSCODE_LOCKOUT_THRESHOLDS: ReadonlyArray<{ failures: number; lockoutMs: number }> = [
  { failures: 5, lockoutMs: 60_000 },
  { failures: 10, lockoutMs: 300_000 },
  { failures: 15, lockoutMs: 900_000 },
  { failures: 20, lockoutMs: 3_600_000 },
];

export const sharePasscodeLockouts = new Map<string, SharePasscodeRecord>();

export function applySharePasscodeLockout(rec: SharePasscodeRecord): void {
  for (let i = SHARE_PASSCODE_LOCKOUT_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rec.failures >= SHARE_PASSCODE_LOCKOUT_THRESHOLDS[i].failures) {
      rec.lockedUntil = Date.now() + SHARE_PASSCODE_LOCKOUT_THRESHOLDS[i].lockoutMs;
      break;
    }
  }
}

export function pruneSharePasscodeLockouts(now: number): void {
  if (sharePasscodeLockouts.size <= 50000) return;
  const cutoff = now - SHARE_PASSCODE_WINDOW_MS;
  for (const [k, v] of sharePasscodeLockouts) {
    if (v.lastFailure < cutoff) sharePasscodeLockouts.delete(k);
  }
}
