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
import { and, eq, lt, notInArray } from "drizzle-orm";
import { db } from "../db";
import { webhookDeliveriesTable } from "@shared/schema";

// Dedupe rows only need to outlive the longest realistic vendor retry
// window; 30 days is generous. There's no cron/scheduler in this deployment,
// so cleanup is opportunistic: a small random fraction of claim calls also
// sweep expired rows, keeping the ledger bounded without adding a dependency
// or slowing down the common case (most calls skip the delete entirely).
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_SAMPLE_RATE = 0.01;

// VitalFriend's ASSUMED shared-secret auth has no per-delivery timestamp or
// vendor delivery id (see rpm-device-routes.ts), unlike Terra, which signs
// each delivery with an HMAC over a timestamp (verifyTerraWebhookSignature,
// 5-minute tolerance) — a captured Terra body resubmitted after its ledger
// row expires is rejected by the signature check regardless of the ledger,
// so Terra is safe on the normal RETENTION_MS. For VitalFriend the ledger
// is the ONLY replay defense, so its rows get a much longer retention
// instead — long enough to make replay impractical while still bounding
// storage growth. This is a mitigation, not a full fix: closing the gap
// for real requires VitalFriend's actual spec (a delivery id or signed
// timestamp), which isn't available yet.
const VITALFRIEND_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
const PROVIDER_RETENTION_MS: Record<string, number> = {
  vitalfriend: VITALFRIEND_RETENTION_MS,
};

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

    let claimId: string;
    if (inserted.length > 0) {
      claimId = inserted[0].id;
    } else {
      // A row already exists for (provider, dedupeKey). Under this
      // transactional design, a row conflicting with our insert can only
      // be a REAL concurrent claim while that other transaction is still
      // open — and Postgres blocks our insert on the unique index until it
      // resolves, so by the time we get here any such row is either fully
      // committed as "completed", or gone (the other transaction rolled
      // back, in which case our insert would have succeeded, not
      // conflicted). A row we can see here at status "processing" is
      // therefore not a live in-flight claim; it's a stale leftover from
      // the pre-transactional claim/complete/release design this
      // replaced. Reclaim it instead of permanently swallowing this
      // delivery. `for("update")` locks the row so two requests racing to
      // reclaim the same stale row can't both proceed.
      const [existing] = await tx
        .select()
        .from(webhookDeliveriesTable)
        .where(and(eq(webhookDeliveriesTable.provider, provider), eq(webhookDeliveriesTable.dedupeKey, dedupeKey)))
        .for("update");

      if (!existing || existing.status === "completed") {
        return { outcome: "duplicate" };
      }

      claimId = existing.id;
    }

    const value = await handler(tx);

    await tx
      .update(webhookDeliveriesTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(webhookDeliveriesTable.id, claimId));

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
  const overrideProviders = Object.keys(PROVIDER_RETENTION_MS);

  // Everything without a provider-specific override, on the default window.
  await db
    .delete(webhookDeliveriesTable)
    .where(
      and(
        lt(webhookDeliveriesTable.receivedAt, new Date(Date.now() - RETENTION_MS)),
        notInArray(webhookDeliveriesTable.provider, overrideProviders),
      ),
    );

  // Each override provider on its own, longer window.
  for (const [provider, retentionMs] of Object.entries(PROVIDER_RETENTION_MS)) {
    await db
      .delete(webhookDeliveriesTable)
      .where(
        and(
          eq(webhookDeliveriesTable.provider, provider),
          lt(webhookDeliveriesTable.receivedAt, new Date(Date.now() - retentionMs)),
        ),
      );
  }
}
