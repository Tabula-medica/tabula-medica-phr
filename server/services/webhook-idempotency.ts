/**
 * Idempotency helper for inbound webhooks (Terra, VitalFriend). A vendor
 * retry resends byte-identical content, so hashing the raw body is a
 * reliable dedupe key without needing a vendor-provided delivery id.
 *
 * `withDeliveryClaim()` wraps EVERYTHING — the claim, every write the
 * caller's handler makes, and marking the claim complete — in one Postgres
 * transaction. That buys atomicity for free from Postgres itself, with no
 * lease/heartbeat bookkeeping needed:
 *   - A concurrent duplicate delivery's claim insert blocks on the unique
 *     (provider, dedupeKey) index until this transaction commits or rolls
 *     back, so two deliveries for the same body can never be processed at
 *     the same time.
 *   - If `handler` throws, or the process dies mid-transaction, NOTHING
 *     persists — not the claim row, not any write `handler` made through
 *     the `tx` it was given. A retry for the same body sees a clean slate
 *     and reprocesses from scratch. There is no way to end up with partial
 *     vitals/wellness writes alongside a lost or dangling claim.
 *
 * IMPORTANT: `handler` must perform every write through the `tx` it
 * receives — never the module-level `db`. A write issued through `db`
 * would not roll back with the rest of the transaction on failure, which
 * breaks the atomicity guarantee above.
 *
 * Usage:
 *   const claim = await withDeliveryClaim("terra", rawBody, async (tx) => {
 *     ...do all DB writes through `tx`...
 *     return { clinicalCount, wellnessCount };
 *   });
 *   if (claim.outcome === "duplicate") return res.status(200).json({ success: true, note: "..." });
 *   res.status(200).json({ success: true, ...claim.value });
 */
import crypto from "crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "../db";
import { webhookDeliveriesTable } from "@shared/schema";

// Dedupe rows only need to outlive the longest realistic vendor retry
// window; 30 days is generous. There's no cron/scheduler in this deployment,
// so cleanup is opportunistic: a small random fraction of claim calls also
// sweep expired rows, keeping the ledger bounded without adding a dependency
// or slowing down the common case (most calls skip the delete entirely).
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_SAMPLE_RATE = 0.01;

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DeliveryClaimResult<T> = { outcome: "processed"; value: T } | { outcome: "duplicate" };

export async function withDeliveryClaim<T>(
  provider: string,
  rawBody: Buffer,
  handler: (tx: DbTransaction) => Promise<T>,
): Promise<DeliveryClaimResult<T>> {
  const dedupeKey = crypto.createHash("sha256").update(rawBody).digest("hex");

  const result = await db.transaction(async (tx): Promise<DeliveryClaimResult<T>> => {
    const inserted = await tx
      .insert(webhookDeliveriesTable)
      .values({ provider, dedupeKey, status: "processing" })
      .onConflictDoNothing({ target: [webhookDeliveriesTable.provider, webhookDeliveriesTable.dedupeKey] })
      .returning({ id: webhookDeliveriesTable.id });

    if (inserted.length === 0) {
      // A row already exists for (provider, dedupeKey). Since the claim
      // insert, every write `handler` makes, and the completion update
      // below all share this one transaction, the only way a row can be
      // visible here at all is if an earlier delivery already committed
      // the whole thing — a half-processed claim can never persist. Ack
      // without reprocessing.
      return { outcome: "duplicate" };
    }

    const value = await handler(tx);

    await tx
      .update(webhookDeliveriesTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(webhookDeliveriesTable.id, inserted[0].id));

    return { outcome: "processed", value };
  });

  if (Math.random() < CLEANUP_SAMPLE_RATE) {
    cleanupExpiredDeliveries().catch((err) => {
      console.error("[webhook-idempotency] Opportunistic cleanup failed:", err);
    });
  }

  return result;
}

async function cleanupExpiredDeliveries(): Promise<void> {
  await db.delete(webhookDeliveriesTable).where(lt(webhookDeliveriesTable.receivedAt, new Date(Date.now() - RETENTION_MS)));
}
