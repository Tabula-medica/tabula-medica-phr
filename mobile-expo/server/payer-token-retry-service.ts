import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { payerTokenConnections } from "@shared/schema";
import { db } from "./db";
import { refreshPayerToken } from "./auth0-fhir-broker";
import { logger } from "./utils/logger";
import { sendOpsAlert } from "./utils/ops-alert";
import {
  PAYER_RETRY_ALERT_COOLDOWN_MS,
  PAYER_RETRY_ALERT_THRESHOLD,
  PAYER_RETRY_BASE_MS,
} from "./payer-refresh-policy";

const SWEEP_INTERVAL_MS = 60_000;
const BATCH_SIZE = 50;
// One row is claimed at a time. A crashed worker's lease expires after 5m.
const due = (now: Date) => and(
  eq(payerTokenConnections.syncStatus, "error"),
  or(
    lte(payerTokenConnections.nextRefreshRetryAt, now),
    and(
      isNull(payerTokenConnections.nextRefreshRetryAt),
      or(
        isNull(payerTokenConnections.lastRefreshAttemptAt),
        lte(payerTokenConnections.lastRefreshAttemptAt, new Date(now.getTime() - PAYER_RETRY_BASE_MS)),
      ),
    ),
  ),
);

interface RetryCandidate { id: string; userId: string; sourceType: string }
export interface PayerRetryDependencies {
  now(): Date;
  listDue(now: Date): Promise<RetryCandidate[]>;
  claim(id: string, now: Date): Promise<boolean>;
  refresh(userId: string, sourceType: string): Promise<unknown>;
  claimAlert(id: string, now: Date): Promise<{ failures: number } | null>;
  releaseAlert(id: string, claimedAt: Date): Promise<void>;
  /** True only when the ops notification was delivered, not merely logged. */
  critical(message: string, metadata: Record<string, unknown>): Promise<boolean>;
}

const dependencies: PayerRetryDependencies = {
  now: () => new Date(),
  listDue: (now) => db.select({
    id: payerTokenConnections.id,
    userId: payerTokenConnections.userId,
    sourceType: payerTokenConnections.sourceType,
  }).from(payerTokenConnections).where(due(now))
    .orderBy(asc(payerTokenConnections.nextRefreshRetryAt)).limit(BATCH_SIZE),
  async claim(id, now) {
    const rows = await db.update(payerTokenConnections).set({
      nextRefreshRetryAt: new Date(now.getTime() + PAYER_RETRY_BASE_MS),
    }).where(and(eq(payerTokenConnections.id, id), due(now)))
      .returning({ id: payerTokenConnections.id });
    return rows.length > 0;
  },
  refresh: refreshPayerToken,
  async claimAlert(id, now) {
    // Atomic cooldown survives restarts and suppresses duplicate alerts from
    // concurrent app instances. Active/needs_reauth rows never escalate.
    const rows = await db.update(payerTokenConnections).set({ lastRefreshAlertAt: now })
      .where(and(
        eq(payerTokenConnections.id, id),
        eq(payerTokenConnections.syncStatus, "error"),
        gte(payerTokenConnections.consecutiveRefreshFailures, PAYER_RETRY_ALERT_THRESHOLD),
        or(
          isNull(payerTokenConnections.lastRefreshAlertAt),
          lte(payerTokenConnections.lastRefreshAlertAt, new Date(now.getTime() - PAYER_RETRY_ALERT_COOLDOWN_MS)),
        ),
      )).returning({ failures: payerTokenConnections.consecutiveRefreshFailures });
    return rows[0] ?? null;
  },
  async releaseAlert(id, claimedAt) {
    await db.update(payerTokenConnections).set({ lastRefreshAlertAt: null })
      .where(and(
        eq(payerTokenConnections.id, id),
        eq(payerTokenConnections.lastRefreshAlertAt, claimedAt),
      ));
  },
  async critical(message, metadata) {
    logger.critical("system", message, undefined, metadata);
    const result = await sendOpsAlert({
      severity: "critical",
      title: message,
      detail: "Check payer token retry health, upstream availability, and SMART configuration using authorized internal tooling.",
      fields: {
        event: String(metadata.event),
        ...(typeof metadata.consecutiveFailures === "number"
          ? { consecutiveFailures: metadata.consecutiveFailures } : {}),
      },
    });
    return result === "sent";
  },
};

/** Single-flight locally, conditional DB leases across app replicas. */
export function createPayerTokenRetryWorker(deps: PayerRetryDependencies = dependencies) {
  let running = false;
  let nextSweepAlertAt = 0;
  return async function sweep(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const rows = await deps.listDue(deps.now());
      for (const row of rows) {
        try {
          if (!await deps.claim(row.id, deps.now())) continue;
          try {
            await deps.refresh(row.userId, row.sourceType);
          } catch {
            // The DB lease limits retry rate even if refresh persistence fails.
            logger.error("Payer token retry attempt threw");
          }
          const claimedAt = deps.now();
          const alert = await deps.claimAlert(row.id, claimedAt);
          if (alert) {
            // No patient ID, connection ID, arbitrary source name, endpoint,
            // tokens or upstream error bodies in the paging path.
            let delivered = false;
            try {
              delivered = await deps.critical("Payer/EHR connection repeatedly failing token refresh", {
                event: "payer_token_refresh_exhausted",
                consecutiveFailures: alert.failures,
                alertCooldownHours: 24,
              });
            } finally {
              // Missing webhook/failed delivery must not suppress notification
              // for a full day. Compare-and-clear cannot erase a newer claim.
              if (!delivered) await deps.releaseAlert(row.id, claimedAt);
            }
          }
        } catch {
          logger.error("Payer token retry row processing failed");
        }
      }
    } catch {
      const now = deps.now().getTime();
      if (now >= nextSweepAlertAt) {
        // No database is available for a shared cooldown on queue failures.
        // Rate-limit locally; retry sooner if notification was undeliverable.
        nextSweepAlertAt = now + PAYER_RETRY_BASE_MS;
        try {
          const delivered = await deps.critical("Payer token retry sweep failed", { event: "payer_token_retry_sweep_failed" });
          if (delivered) nextSweepAlertAt = now + PAYER_RETRY_ALERT_COOLDOWN_MS;
        } catch {
          logger.error("Payer token retry sweep notification failed");
        }
      }
    } finally {
      running = false;
    }
  };
}

let timer: ReturnType<typeof setInterval> | undefined;
export function startPayerTokenRetryScheduler(): void {
  if (timer) return;
  const sweep = createPayerTokenRetryWorker();
  timer = setInterval(() => { void sweep(); }, SWEEP_INTERVAL_MS);
  timer.unref();
  void sweep();
  logger.info("Payer token retry scheduler started", { intervalMs: SWEEP_INTERVAL_MS });
}

export function stopPayerTokenRetryScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
