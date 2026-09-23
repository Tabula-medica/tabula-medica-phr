/**
 * One-time deploy step for PR #113 (RPM security fixes): any `rpm_devices`
 * row that was enrolled and activated under the ORIGINAL, vulnerable code
 * (merged as PR #108) can be `status = "active"` with `serial_number` still
 * null — that enrollment never required or checked a serial number at all.
 * The fixed webhook handler (server/routes/rpm-device-routes.ts) now
 * re-verifies serial_number on every delivery once a device is active, but
 * a legacy row with no stored serial can never satisfy that check via a
 * provided serial, and a delivery that omits serial_number entirely still
 * passes through untouched — so these rows are not fully re-verified by
 * the webhook fix alone.
 *
 * This script closes that gap by resetting every such row back to
 * "pending", which forces it through the same first-delivery
 * serial-confirmation gate a brand-new enrollment goes through before it
 * can ingest readings again. The patient/caregiver isn't required to do
 * anything — VitalFriend's next delivery for that device re-activates it,
 * provided it carries a serial_number that matches what's on file (and if
 * `serial_number` is still null too — a device enrolled before this field
 * existed at all — it stays pending until re-enrolled with a serial via
 * `POST /api/rpm/devices`, which now requires one).
 *
 * Idempotent: matches only "active" + null/empty serial_number, so
 * re-running after devices have re-activated with a real serial is a
 * no-op.
 *
 * Run with: npx tsx scripts/backfill-rpm-legacy-device-reverification.ts
 */

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../server/db";
import { rpmDevicesTable } from "@shared/schema";

async function main() {
  console.log("[backfill] finding legacy active RPM devices with no verified serial number...");

  const affected = await db
    .update(rpmDevicesTable)
    .set({ status: "pending" })
    .where(
      and(
        eq(rpmDevicesTable.status, "active"),
        or(isNull(rpmDevicesTable.serialNumber), eq(sql`trim(${rpmDevicesTable.serialNumber})`, "")),
      ),
    )
    .returning({ id: rpmDevicesTable.id, profileId: rpmDevicesTable.profileId });

  console.log(`[backfill] done — ${affected.length} device(s) reset to "pending", pending re-verification`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] FAILED", err);
    process.exit(1);
  });
