/**
 * One-time deploy step for PR #113 (RPM security fixes): any `rpm_devices`
 * row created under the ORIGINAL, vulnerable code (merged as PR #108) can
 * be `status = "active"` with NO vendor-confirmed proof of possession —
 * that enrollment flow set a device straight to "active" on `POST
 * /api/rpm/devices`, whether or not a serial number was even supplied
 * (it was optional), and never checked it against anything. A non-empty
 * `serial_number` on one of these rows is not evidence it was ever
 * verified — it just means the enrolling client happened to type one in.
 *
 * The fixed enrollment flow (this PR) always starts a device at "pending"
 * and only flips it to "active" once a real webhook delivery confirms the
 * stored serial number matches. So at the moment this script is meant to
 * run — right after deploying this fix, before any new activity — every
 * row still sitting at "active" necessarily predates that gate and was
 * never actually verified.
 *
 * This script closes that gap by resetting every "active" row (regardless
 * of provider or stored serial) back to "pending", forcing it through the
 * same first-delivery serial-confirmation gate a brand-new enrollment goes
 * through before it can ingest readings again. The patient/caregiver isn't
 * required to do anything — VitalFriend's next delivery for that device
 * re-activates it, provided it carries a serial_number that matches what's
 * on file (a device with no stored serial at all stays pending until
 * re-enrolled via `POST /api/rpm/devices`, which now requires one).
 *
 * Idempotent in the sense that matters: run this once, immediately after
 * deploying the fixed code and before real traffic resumes, and it's a
 * no-op on any later run (nothing stays "active" without having gone
 * through the new verified activation path first).
 *
 * Run with: npx tsx scripts/backfill-rpm-legacy-device-reverification.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { rpmDevicesTable } from "@shared/schema";

async function main() {
  console.log("[backfill] resetting all legacy active RPM devices for re-verification...");

  const affected = await db
    .update(rpmDevicesTable)
    .set({ status: "pending" })
    .where(eq(rpmDevicesTable.status, "active"))
    .returning({ id: rpmDevicesTable.id, profileId: rpmDevicesTable.profileId });

  console.log(`[backfill] done — ${affected.length} device(s) reset to "pending", pending re-verification`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] FAILED", err);
    process.exit(1);
  });
