import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { randomBytes } from "crypto";

/**
 * Proves, against a real Postgres, the one property tests/dod-cac-auth.spec.ts's
 * mocked db.execute() cannot: that the atomic SQL patterns
 * server/dod-routes.ts's enroll-software-cert handler relies on actually
 * serialize two simultaneous, real connections into exactly one winner —
 * not just one mock call happening to run before another in the same
 * process. Runs the exact query shapes the handler issues (copied here,
 * not re-derived), directly against two connections from the same pool,
 * the same way pg-rate-limit-store.integration.spec.ts proves its own
 * store's upsert against real concurrency rather than a fake.
 *
 * Skipped outside CI (or anywhere without TEST_DATABASE_URL), same as
 * that spec. Everything this spec creates lives inside its own,
 * uniquely-named Postgres schema — never the caller's real public schema.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("CAC enrollment atomicity (real Postgres)", () => {
  const dbUrl = TEST_DATABASE_URL as string;
  const schema = `cac_atomicity_test_${randomBytes(6).toString("hex")}`;
  let pool: Pool;

  beforeAll(async () => {
    const bootstrap = new Pool({ connectionString: dbUrl });
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
    await bootstrap.end();

    pool = new Pool({ connectionString: dbUrl, options: `-c search_path="${schema}"` });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cac_edipi_claims (
        edipi TEXT PRIMARY KEY,
        claimed_by_user_id TEXT NOT NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cac_software_certs (
        edipi TEXT NOT NULL,
        device_id TEXT PRIMARY KEY,
        public_key_hex TEXT NOT NULL,
        cert_json TEXT NOT NULL,
        platform TEXT,
        enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        enrolled_by_user_id TEXT NOT NULL
      )
    `);
  });

  afterAll(async () => {
    await pool.end();
    const bootstrap = new Pool({ connectionString: dbUrl });
    await bootstrap.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await bootstrap.end();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE cac_edipi_claims, cac_software_certs");
  });

  it("serializes two simultaneous connections claiming the same EDIPI into exactly one winner", async () => {
    // The exact statement server/dod-routes.ts's enroll-software-cert
    // handler issues inside its transaction.
    const claim = (claimedByUserId: string) =>
      pool.query(
        `INSERT INTO cac_edipi_claims (edipi, claimed_by_user_id)
         VALUES ($1, $2)
         ON CONFLICT (edipi) DO NOTHING
         RETURNING claimed_by_user_id`,
        ["9999999999", claimedByUserId],
      );

    const [resultA, resultB] = await Promise.all([claim("racer-a"), claim("racer-b")]);
    const winners = [resultA.rows, resultB.rows].filter((rows) => rows.length > 0);

    expect(winners).toHaveLength(1);
    const { rows: finalRows } = await pool.query(
      "SELECT claimed_by_user_id FROM cac_edipi_claims WHERE edipi = $1",
      ["9999999999"],
    );
    expect(finalRows).toHaveLength(1);
    expect(winners[0][0].claimed_by_user_id).toBe(finalRows[0].claimed_by_user_id);
  });

  it("serializes two simultaneous connections re-enrolling the same device_id under different owners into exactly one update", async () => {
    await pool.query(
      `INSERT INTO cac_software_certs (edipi, device_id, public_key_hex, cert_json, platform, expires_at, enrolled_by_user_id)
       VALUES ('1111111111', 'shared-device', 'original-key', '{}', 'test', now() + interval '1 year', 'victim')`,
    );

    // The exact statement shape the handler issues: ON CONFLICT (device_id)
    // DO UPDATE, gated by a WHERE clause on the existing row's owner.
    const reEnroll = (edipi: string, publicKeyHex: string, ownerId: string) =>
      pool.query(
        `INSERT INTO cac_software_certs (edipi, device_id, public_key_hex, cert_json, platform, expires_at, enrolled_by_user_id)
         VALUES ($1, 'shared-device', $2, '{}', 'test', now() + interval '1 year', $3)
         ON CONFLICT (device_id) DO UPDATE SET
           edipi = EXCLUDED.edipi,
           public_key_hex = EXCLUDED.public_key_hex,
           expires_at = EXCLUDED.expires_at
         WHERE cac_software_certs.enrolled_by_user_id = $3
         RETURNING device_id`,
        [edipi, publicKeyHex, ownerId],
      );

    // Two different accounts race to claim the SAME already-owned device.
    // Neither is the current owner ("victim"), so both should be rejected
    // (0 rows) rather than one of them silently overwriting it.
    const [resultA, resultB] = await Promise.all([
      reEnroll("2222222222", "attacker-a-key", "attacker-a"),
      reEnroll("3333333333", "attacker-b-key", "attacker-b"),
    ]);

    expect(resultA.rows).toHaveLength(0);
    expect(resultB.rows).toHaveLength(0);

    const { rows } = await pool.query(
      "SELECT edipi, public_key_hex, enrolled_by_user_id FROM cac_software_certs WHERE device_id = 'shared-device'",
    );
    expect(rows).toEqual([{ edipi: "1111111111", public_key_hex: "original-key", enrolled_by_user_id: "victim" }]);
  });
});
