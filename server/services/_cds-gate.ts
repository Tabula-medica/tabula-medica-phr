// CDS-GATED — shared kill-switch for Clinical Decision Support (CDS) features.
//
// These features are DISABLED in production by default, pending an FDA Non-Device
// CDS determination (21st Century Cures Act §3060) and healthcare-counsel review.
// This is NOT a "NO-CDS" assertion — these services genuinely perform CDS and are
// intentionally turned off until reviewed. See NO-CDS-TRIAGE.md and
// ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
//
// Re-enable ONLY per-feature, after counsel sign-off, by setting ENABLE_CDS=true
// (and ideally a finer-grained flag per feature in a follow-up).

export class CdsDisabledError extends Error {
  readonly statusCode = 503;
  readonly feature: string;
  constructor(feature: string) {
    super(
      `Clinical decision support feature "${feature}" is disabled pending regulatory review.`,
    );
    this.name = "CdsDisabledError";
    this.feature = feature;
  }
}

/** True only when CDS features have been explicitly enabled (default: off). */
export function isCdsEnabled(): boolean {
  return process.env.ENABLE_CDS === "true";
}

/** Throws CdsDisabledError unless CDS features are explicitly enabled. */
export function assertCdsEnabled(feature: string): void {
  if (!isCdsEnabled()) {
    throw new CdsDisabledError(feature);
  }
}
