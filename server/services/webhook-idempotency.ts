/**
 * Idempotency helper for inbound webhooks (Terra, VitalFriend). A vendor
 * retry resends byte-identical content, so hashing the raw body is a
 * reliable dedupe key without needing a vendor-provided delivery id.
 *
 * Usage:
 *   const claim = await claimDelivery(provider, rawBody);
 *   if (claim.outcome !== "claimed") return res.status(200)...; // duplicate
 *   try {
 *     ...process...
 *     await completeDelivery(provider, claim.dedupeKey);
 *   } catch (e) {
 *     await releaseDeliveryClaim(provider, claim.dedupeKey); // so a retry can reprocess
 *   }
 *
 * A claim that's still `processing` past PROCESSING_LEASE_MS is treated as
 * abandoned (the original request crashed or hung without completing or
 * releasing) and is reclaimed by whichever request next hashes to the same
 * dedupeKey, instead of being stuck forever.
 */
import crypto from "crypto";
import { eq, and, lt } from "drizzle-orm";
import { db } from "../db";
import { webhookDeliveriesTable } from "@shared/schema";

// Dedupe rows only need to outlive the longest realistic vendor retry
// window; 30 days is generous. There's no cron/scheduler in this deployment,
// so cleanup is opportunistic: a small random fraction of claim calls also
// sweep expired rows, keeping the ledger bounded without adding a dependency
// or slowing down the common case (most calls skip the delete entirely).
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_SAMPLE_RATE = 0.01;

// A healthy webhook handler finishes in well under a minute. Past this, a
// claim stuck at "processing" almost certainly means the original request
// died without completing or releasing.
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type ClaimResult =
  | { outcome: "claimed"; dedupeKey: string }
  // Fully processed already — ack without reprocessing.
  | { outcome: "duplicate_completed"; dedupeKey: string }
  // Another request currently holds this claim and its lease hasn't
  // expired yet — ack without reprocessing (avoid a double-write); if that
  // request is actually still healthy, it'll complete or release on its
  // own, and if it died, the NEXT delivery for this body will reclaim it.
  | { outcome: "duplicate_processing"; dedupeKey: string };

export async function claimDelivery(provider: string, rawBody: Buffer): Promise<ClaimResult> {
  const dedupeKey = crypto.createHash("sha256").update(rawBody).digest("hex");

  const inserted = await db
    .insert(webhookDeliveriesTable)
    .values({ provider, dedupeKey, status: "processing" })
    .onConflictDoNothing({ target: [webhookDeliveriesTable.provider, webhookDeliveriesTable.dedupeKey] })
    .returning({ id: webhookDeliveriesTable.id });

  if (inserted.length > 0) {
    if (Math.random() < CLEANUP_SAMPLE_RATE) {
      cleanupExpiredDeliveries().catch((err) => {
        console.error("[webhook-idempotency] Opportunistic cleanup failed:", err);
      });
    }
    return { outcome: "claimed", dedupeKey };
  }

  const [existing] = await db
    .select()
    .from(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.provider, provider), eq(webhookDeliveriesTable.dedupeKey, dedupeKey)));

  if (!existing) {
    // The conflicting row was deleted (released) between our failed insert
    // and this select — safe to claim now.
    return claimDelivery(provider, rawBody);
  }

  if (existing.status === "completed") {
    return { outcome: "duplicate_completed", dedupeKey };
  }

  const claimAgeMs = Date.now() - existing.receivedAt.getTime();
  if (claimAgeMs > PROCESSING_LEASE_MS) {
    // Stale claim — reclaim it for this request. The conditional update
    // guards against two requests racing to reclaim the same stale row.
    const reclaimed = await db
      .update(webhookDeliveriesTable)
      .set({ receivedAt: new Date() })
      .where(and(eq(webhookDeliveriesTable.id, existing.id), eq(webhookDeliveriesTable.status, "processing")))
      .returning({ id: webhookDeliveriesTable.id });
    if (reclaimed.length > 0) {
      return { outcome: "claimed", dedupeKey };
    }
  }

  return { outcome: "duplicate_processing", dedupeKey };
}

/** Mark a claimed delivery as fully processed. Call this after all writes succeed. */
export async function completeDelivery(provider: string, dedupeKey: string): Promise<void> {
  await db
    .update(webhookDeliveriesTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(webhookDeliveriesTable.provider, provider), eq(webhookDeliveriesTable.dedupeKey, dedupeKey)));
}

async function cleanupExpiredDeliveries(): Promise<void> {
  await db.delete(webhookDeliveriesTable).where(lt(webhookDeliveriesTable.receivedAt, new Date(Date.now() - RETENTION_MS)));
}

/** Drop a claim after a processing failure so a legitimate retry can reprocess it immediately. */
export async function releaseDeliveryClaim(provider: string, dedupeKey: string): Promise<void> {
  await db
    .delete(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.provider, provider), eq(webhookDeliveriesTable.dedupeKey, dedupeKey)));
}
