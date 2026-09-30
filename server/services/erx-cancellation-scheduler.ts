/**
 * Background driver for the eRx cancellation transmission queue.
 *
 * `processPendingTransmissions` in `erx-cancellation-service.ts` retries CancelRx
 * messages whose backoff has elapsed and recovers ones stranded mid-transmission,
 * but something has to call it. This module is that caller; it is started and
 * stopped alongside the EHR sync scheduler (see `server/sync-scheduler.ts`).
 *
 * Deliberate choices:
 *   - The service module is imported lazily, so a fault in the eRx code (or in
 *     the database layer it pulls in) cannot stop the sync scheduler starting.
 *   - Sweeps never overlap. A sweep sends one HTTP request per due row, so a
 *     slow gateway can easily outlast the tick interval, and two concurrent
 *     sweeps would both pick up the same rows.
 *   - Nothing is swept when no gateway is configured. See `runErxCancellationSweep`.
 */

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Below this the sweep would hammer the database for no practical gain. */
const MIN_SWEEP_INTERVAL_MS = 30 * 1000;

/**
 * Resolve the tick interval from the environment, falling back to the default
 * for anything unset, unparseable, or implausibly small. Exported for tests.
 */
export function resolveSweepIntervalMs(
  raw: string | undefined = process.env.ERX_CANCELLATION_SWEEP_INTERVAL_MS,
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SWEEP_INTERVAL_MS;
  return Math.max(MIN_SWEEP_INTERVAL_MS, parsed);
}

export type ErxSweepOutcome =
  | { ran: false; reason: "no_gateway" | "overlapped" | "error" }
  | {
      ran: true;
      processed: number;
      transmitted: number;
      failed: number;
      stillQueued: number;
      reclaimed: number;
      reclaimExhausted: number;
    };

let sweepInFlight = false;
let sweepTimer: NodeJS.Timeout | null = null;
let kickoffTimer: NodeJS.Timeout | null = null;
/** Keeps the "no gateway" notice to once per configuration change, not once per tick. */
let announcedNoGateway = false;

/**
 * One pass over the queue.
 *
 * Returns without touching the queue when no eRx gateway is configured. The
 * fallback transport parks every message as `queued` by design and never reports
 * a terminal outcome, so sweeping in that state would retry the same rows
 * forever against nothing, inflating their attempt counts and their audit
 * trails. The rows stay parked and become eligible as soon as the gateway is
 * configured — which is the honest behaviour, since nothing has been sent.
 */
export async function runErxCancellationSweep(): Promise<ErxSweepOutcome> {
  if (sweepInFlight) {
    console.log("[ErxCancelSweep] Previous sweep still running; skipping this tick");
    return { ran: false, reason: "overlapped" };
  }
  sweepInFlight = true;

  try {
    const { getErxTransport } = await import("./erx-transport");
    if (!getErxTransport().isLive) {
      if (!announcedNoGateway) {
        console.log(
          "[ErxCancelSweep] Idle: no eRx gateway configured. Queued CancelRx messages are parked, not sent.",
        );
        announcedNoGateway = true;
      }
      return { ran: false, reason: "no_gateway" };
    }
    announcedNoGateway = false;

    const { processPendingTransmissions } = await import("./erx-cancellation-service");
    const result = await processPendingTransmissions();

    if (result.processed > 0 || result.reclaimed > 0 || result.reclaimExhausted > 0) {
      console.log(
        `[ErxCancelSweep] processed=${result.processed} transmitted=${result.transmitted} ` +
          `failed=${result.failed} stillQueued=${result.stillQueued} ` +
          `reclaimed=${result.reclaimed} reclaimExhausted=${result.reclaimExhausted}`,
      );
    }

    return { ran: true, ...result };
  } catch (error) {
    // A sweep failure must not stop future sweeps: the next tick tries again.
    console.error("[ErxCancelSweep] Sweep failed:", error);
    return { ran: false, reason: "error" };
  } finally {
    sweepInFlight = false;
  }
}

export function startErxCancellationScheduler(): void {
  if (sweepTimer) {
    console.log("[ErxCancelSweep] Scheduler already running");
    return;
  }

  const intervalMs = resolveSweepIntervalMs();

  sweepTimer = setInterval(() => {
    void runErxCancellationSweep();
  }, intervalMs);
  sweepTimer.unref?.();

  // Staggered off startup so the first sweep does not compete with route
  // registration and the initial EHR sync.
  kickoffTimer = setTimeout(() => {
    void runErxCancellationSweep();
  }, 20_000);
  kickoffTimer.unref?.();

  console.log(
    `[ErxCancelSweep] CancelRx transmission queue sweep scheduled every ${Math.round(intervalMs / 1000)}s`,
  );
}

export function stopErxCancellationScheduler(): void {
  if (kickoffTimer) {
    clearTimeout(kickoffTimer);
    kickoffTimer = null;
  }
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    console.log("[ErxCancelSweep] Stopped CancelRx transmission queue sweep");
  }
}

/** Test seam: clears the once-per-configuration "no gateway" notice latch. */
export function resetErxSweepState(): void {
  sweepInFlight = false;
  announcedNoGateway = false;
}
