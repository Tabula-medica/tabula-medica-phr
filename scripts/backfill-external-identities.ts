/**
 * Phase 0 backfill: seed `external_identities` rows for every existing user,
 * tagging them as provider='auth0' with externalSub = users.id (the Auth0 sub).
 *
 * Idempotent: re-runs are safe (uses ON CONFLICT DO NOTHING on the
 * (provider, external_sub) unique index).
 *
 * Run with: npx tsx scripts/backfill-external-identities.ts
 */

import { db } from "../server/db";
import { users, externalIdentities } from "@shared/models/auth";

async function main() {
  console.log("[backfill] reading users...");
  const allUsers = await db.select().from(users);
  console.log(`[backfill] found ${allUsers.length} users`);

  if (allUsers.length === 0) {
    console.log("[backfill] no users to backfill — exiting");
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const u of allUsers) {
    const result = await db
      .insert(externalIdentities)
      .values({
        userId: u.id,
        provider: "auth0",
        externalSub: u.id,
        email: u.email ?? null,
        emailVerified: u.isVerified ?? false,
        linkedAt: u.createdAt ?? new Date(),
      })
      .onConflictDoNothing({
        target: [externalIdentities.provider, externalIdentities.externalSub],
      })
      .returning({ id: externalIdentities.id });

    if (result.length > 0) inserted++;
    else skipped++;
  }

  console.log(`[backfill] done — inserted=${inserted} skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] FAILED", err);
    process.exit(1);
  });
