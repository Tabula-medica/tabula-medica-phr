/**
 * One-shot backfill: re-encrypt any plaintext PHI-shaped fields in
 * `health_records` (title / summary / provider / facility).
 *
 * Context: Task #147 — Task #95's prod read-replica audit found ~60 reviewer
 * demo-seed rows from Jan 29 – Feb 1 2026 that predate the encryption-layer
 * rollout. Their title/summary/provider/facility are plaintext, while every
 * row written by the current `createHealthRecord` path has them stored with
 * the `enc:` prefix via `encryptRecordFields` (server/storage.ts).
 *
 * This script is idempotent: it only touches rows where at least one of the
 * four PHI columns is non-null, non-empty, and does not already start with
 * `enc:`. Each affected row is updated inside a transaction with the encrypted
 * values produced by `encryptPHI` (the same primitive `encryptRecordFields`
 * uses), so newer rows that are already encrypted are not double-encrypted
 * and not rewritten.
 *
 * Usage (against whichever DATABASE_URL is in the env):
 *   DATABASE_URL=… PHI_ENCRYPTION_KEY=… PHI_ENCRYPTION_SALT=… \
 *     npx tsx scripts/backfill-encrypt-demo-records.ts            # dry-run
 *   DATABASE_URL=… PHI_ENCRYPTION_KEY=… PHI_ENCRYPTION_SALT=… \
 *     npx tsx scripts/backfill-encrypt-demo-records.ts --apply    # write
 *
 * Safety: defaults to dry-run; requires explicit `--apply` to mutate.
 */

import { Pool } from "pg";
import { encryptPHI } from "../server/compliance/encryption-service";

const PHI_FIELDS = ["title", "summary", "provider", "facility"] as const;
type PhiField = (typeof PHI_FIELDS)[number];

interface Row {
  id: string;
  title: string | null;
  summary: string | null;
  provider: string | null;
  facility: string | null;
  is_manual: boolean | null;
  created_at: Date | null;
}

function needsEncrypt(value: string | null): boolean {
  return typeof value === "string" && value.length > 0 && !value.startsWith("enc:");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }
  if (!process.env.PHI_ENCRYPTION_KEY || !process.env.PHI_ENCRYPTION_SALT) {
    console.error("PHI_ENCRYPTION_KEY and PHI_ENCRYPTION_SALT are required (must match prod values, or rows will be unreadable)");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 4 });

  console.log(`[backfill] mode=${apply ? "APPLY" : "DRY-RUN"}`);

  const { rows } = await pool.query<Row>(
    `SELECT id, title, summary, provider, facility, is_manual, created_at
       FROM health_records
      WHERE (title     IS NOT NULL AND title     <> '' AND title     NOT LIKE 'enc:%')
         OR (summary   IS NOT NULL AND summary   <> '' AND summary   NOT LIKE 'enc:%')
         OR (provider  IS NOT NULL AND provider  <> '' AND provider  NOT LIKE 'enc:%')
         OR (facility  IS NOT NULL AND facility  <> '' AND facility  NOT LIKE 'enc:%')
      ORDER BY created_at ASC`,
  );

  console.log(`[backfill] candidate rows: ${rows.length}`);
  if (rows.length === 0) {
    console.log("[backfill] nothing to do — every row's PHI fields are already enc:-prefixed");
    await pool.end();
    return;
  }

  const fieldCounts: Record<PhiField, number> = { title: 0, summary: 0, provider: 0, facility: 0 };
  for (const r of rows) {
    for (const f of PHI_FIELDS) if (needsEncrypt(r[f])) fieldCounts[f]++;
  }
  console.log(`[backfill] plaintext field totals:`, fieldCounts);
  const firstDate = rows[0].created_at?.toISOString?.() ?? "?";
  const lastDate = rows[rows.length - 1].created_at?.toISOString?.() ?? "?";
  console.log(`[backfill] created_at range: ${firstDate} → ${lastDate}`);

  if (!apply) {
    console.log("[backfill] DRY-RUN complete. Re-run with --apply to mutate.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const f of PHI_FIELDS) {
        if (needsEncrypt(r[f])) {
          params.push(encryptPHI(r[f] as string));
          sets.push(`${f} = $${params.length}`);
        }
      }
      if (sets.length === 0) continue;
      params.push(r.id);
      await client.query(
        `UPDATE health_records SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
      updated++;
    }
    await client.query("COMMIT");
    console.log(`[backfill] APPLIED. rows updated: ${updated}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[backfill] ROLLED BACK on error:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  const verify = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM health_records
      WHERE (title     IS NOT NULL AND title     <> '' AND title     NOT LIKE 'enc:%')
         OR (summary   IS NOT NULL AND summary   <> '' AND summary   NOT LIKE 'enc:%')
         OR (provider  IS NOT NULL AND provider  <> '' AND provider  NOT LIKE 'enc:%')
         OR (facility  IS NOT NULL AND facility  <> '' AND facility  NOT LIKE 'enc:%')`,
  );
  const residual = Number(verify.rows[0].c);
  console.log(`[backfill] post-apply plaintext row count: ${residual} (expect 0)`);

  await pool.end();

  // Hard-fail if any plaintext rows remain after --apply, so operators / CI
  // cannot treat a partial cleanup as success.
  if (residual !== 0) {
    console.error(
      `[backfill] FAILED: ${residual} health_records row(s) still have non-enc: title/summary/provider/facility after --apply. ` +
        `Investigate before claiming the backfill is complete.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[backfill] FATAL:", err);
  process.exit(1);
});
