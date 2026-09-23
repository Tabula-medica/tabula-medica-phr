/**
 * Idempotency helper for inbound webhooks (Terra, VitalFriend). A vendor
 * retry resends byte-identical content, so hashing the raw body is a
 * reliable dedupe key without needing a vendor-provided delivery id.
 *
 * Usage: claim before processing; if `isNew` is false, ack without
 * reprocessing. If processing then fails, call `release` so a legitimate
 * vendor retry isn't permanently dropped.
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

export async function claimDelivery(provider: string, rawBody: Buffer): Promise<{ isNew: boolean; dedupeKey: string }> {
  const dedupeKey = crypto.createHash("sha256").update(rawBody).digest("hex");
  const inserted = await db
    .insert(webhookDeliveriesTable)
    .values({ provider, dedupeKey })
    .onConflictDoNothing({ target: [webhookDeliveriesTable.provider, webhookDeliveriesTable.dedupeKey] })
    .returning({ id: webhookDeliveriesTable.id });

  if (Math.random() < CLEANUP_SAMPLE_RATE) {
    cleanupExpiredDeliveries().catch((err) => {
      console.error("[webhook-idempotency] Opportunistic cleanup failed:", err);
    });
  }

  return { isNew: inserted.length > 0, dedupeKey };
}

async function cleanupExpiredDeliveries(): Promise<void> {
  await db.delete(webhookDeliveriesTable).where(lt(webhookDeliveriesTable.receivedAt, new Date(Date.now() - RETENTION_MS)));
}

export async function releaseDeliveryClaim(provider: string, dedupeKey: string): Promise<void> {
  await db
    .delete(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.provider, provider), eq(webhookDeliveriesTable.dedupeKey, dedupeKey)));
}
