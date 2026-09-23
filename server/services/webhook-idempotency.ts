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
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { webhookDeliveriesTable } from "@shared/schema";

export async function claimDelivery(provider: string, rawBody: Buffer): Promise<{ isNew: boolean; dedupeKey: string }> {
  const dedupeKey = crypto.createHash("sha256").update(rawBody).digest("hex");
  const inserted = await db
    .insert(webhookDeliveriesTable)
    .values({ provider, dedupeKey })
    .onConflictDoNothing({ target: [webhookDeliveriesTable.provider, webhookDeliveriesTable.dedupeKey] })
    .returning({ id: webhookDeliveriesTable.id });

  return { isNew: inserted.length > 0, dedupeKey };
}

export async function releaseDeliveryClaim(provider: string, dedupeKey: string): Promise<void> {
  await db
    .delete(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.provider, provider), eq(webhookDeliveriesTable.dedupeKey, dedupeKey)));
}
