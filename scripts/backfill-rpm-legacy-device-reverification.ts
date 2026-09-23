/**
 * One-time deploy step for PR #113 (RPM security fixes): any VitalFriend
 * `rpm_devices` row created under the ORIGINAL, vulnerable code (merged as
 * PR #108) can be `status = "active"` with NO vendor-confirmed proof of
 * possession — that enrollment flow set a device straight to "active" on
 * `POST /api/rpm/devices`, whether or not a serial number was even supplied
 * (it was optional), and never checked it against anything. A non-empty
 * `serial_number` on one of these rows is not evidence it was ever
 * verified — it just means the enrolling client happened to type one in.
 *
 * The fixed enrollment flow (this PR) always starts a device at "pending"
 * and only flips it to "active" once a real webhook delivery confirms the
 * stored serial number matches. So at the moment this script is meant to
 * run — right after deploying this fix, before any new activity — every
 * VitalFriend row still sitting at "active" necessarily predates that gate
 * and was never actually verified.
 *
 * This script closes that gap by resetting every VitalFriend "active" row
 * back to "pending", forcing it through the same first-delivery
 * serial-confirmation gate a brand-new enrollment goes through before it
 * can ingest readings again. Recovery:
 *   - If the row's stored serial_number is correct, VitalFriend's next
 *     delivery for that device re-activates it automatically — nothing for
 *     the patient/caregiver to do.
 *   - Otherwise (no stored serial, or a caller wants to correct it), the
 *     owning profile can call `POST /api/rpm/devices` again with the same
 *     provider + externalDeviceId and a serial number — the route now
 *     supports re-enrollment for a caller who already owns the row (see
 *     server/routes/rpm-device-routes.ts), not just a 409.
 *
 * Scoped to `provider = "vitalfriend"` only: it's the only provider with an
 * actual webhook re-verification path. A device enrolled under
 * `provider = "other"` has no webhook that could ever transition it back
 * to "active", so resetting it here would strand it permanently instead of
 * re-verifying it.
 *
 * Guarded by a durable marker (deploy_script_markers), NOT just "nothing
 * stays active without going through verification first": a device
 * enrolled/re-verified AFTER this script's first run is legitimately
 * "active" with a real vendor-confirmed serial, and a naive re-run would
 * incorrectly reset it too, kicking it offline until another qualifying
 * delivery arrives. Run this once; later runs are a genuine no-op.
 *
 * Run with: npx tsx scripts/backfill-rpm-legacy-device-reverification.ts
 */

import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { rpmDevicesTable, deployScriptMarkersTable } from "@shared/schema";

const MARKER_KEY = "rpm-legacy-device-reverification-v1";

async function main() {
  const [marker] = await db
    .select()
    .from(deployScriptMarkersTable)
    .where(eq(deployScriptMarkersTable.key, MARKER_KEY));

  if (marker) {
    console.log(`[backfill] already applied at ${marker.appliedAt.toISOString()} — nothing to do`);
    return;
  }

  console.log('[backfill] resetting legacy active VitalFriend RPM devices for re-verification...');

  const affected = await db.transaction(async (tx) => {
    const rows = await tx
      .update(rpmDevicesTable)
      .set({ status: "pending" })
      .where(and(eq(rpmDevicesTable.provider, "vitalfriend"), eq(rpmDevicesTable.status, "active")))
      .returning({ id: rpmDevicesTable.id, profileId: rpmDevicesTable.profileId });

    await tx.insert(deployScriptMarkersTable).values({ key: MARKER_KEY }).onConflictDoNothing();

    return rows;
  });

  console.log(`[backfill] done — ${affected.length} device(s) reset to "pending", pending re-verification`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] FAILED", err);
    process.exit(1);
  });
