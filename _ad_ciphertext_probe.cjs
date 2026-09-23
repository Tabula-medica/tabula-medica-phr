/* One-off: prove advance_directives PHI is ciphertext-at-rest in the live DB.
   Prints ONLY safe fingerprints (never full plaintext). Delete after use. */
const { Client } = require("pg");
const { execSync } = require("child_process");

function getDbPassword() {
  if (process.env.PROBE_PGPASSWORD) return process.env.PROBE_PGPASSWORD;
  const secret = execSync(
    "gcloud secrets versions access latest --secret=patient-db-secret-us-central1 --project united-planet-485003-n7",
    { encoding: "utf8" }
  ).trim();
  if (secret.startsWith("postgres")) {
    const userpass = secret.split("://")[1].split("@")[0];
    return userpass.slice(userpass.indexOf(":") + 1);
  }
  return secret;
}

const CIPHER_RE = /^[0-9a-f]{12,}:[0-9a-f]{24,}:[0-9a-f]+$/; // iv:tag:ct (aes-256-gcm)
const PHI_TEXT_COLS = ["family_primary_goal_of_care", "goals_of_care"];

function classify(v) {
  if (v === null || v === undefined) return { verdict: "NULL", preview: "" };
  const s = String(v);
  if (CIPHER_RE.test(s)) {
    const [iv, tag] = s.split(":");
    return { verdict: "ENCRYPTED ✓", preview: `iv=${iv.slice(0, 12)}… tag=${tag.slice(0, 8)}… len=${s.length}` };
  }
  // Not ciphertext — do NOT echo content; just flag length so PHI can't leak.
  return { verdict: "⚠ NOT-ENCRYPTED", preview: `len=${s.length} (content withheld)` };
}

(async () => {
  const pass = getDbPassword();
  const client = new Client({
    host: "127.0.0.1", port: 6543, user: "postgres", database: "postgres",
    password: pass, ssl: false,
  });
  await client.connect();

  const cnt = await client.query("SELECT count(*)::int AS n FROM advance_directives");
  console.log(`\nadvance_directives row count: ${cnt.rows[0].n}`);

  const cols = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name='advance_directives' ORDER BY ordinal_position`);
  console.log("\nColumns:");
  for (const c of cols.rows) console.log(`  ${c.column_name.padEnd(30)} ${c.data_type}`);

  if (cnt.rows[0].n === 0) {
    console.log("\n(no rows yet — save a directive via the UI, then re-run to see ciphertext)");
    await client.end(); return;
  }

  const r = await client.query(
    `SELECT profile_id, code_status, treatment_preferences,
            family_primary_goal_of_care, goals_of_care, updated_at
     FROM advance_directives ORDER BY updated_at DESC LIMIT 1`);
  const row = r.rows[0];
  console.log(`\nMost-recent row  (profile_id=${row.profile_id}, updated_at=${row.updated_at?.toISOString?.() || row.updated_at})`);
  console.log("PHI columns at rest:");
  for (const col of PHI_TEXT_COLS) {
    const c = classify(row[col]);
    console.log(`  ${col.padEnd(30)} ${c.verdict.padEnd(16)} ${c.preview}`);
  }
  // jsonb / array PHI: values inside are encrypted strings too
  const tp = row.treatment_preferences;
  if (tp && typeof tp === "object") {
    const sample = Object.entries(tp)[0];
    if (sample) {
      const c = classify(sample[1]);
      console.log(`  treatment_preferences.${sample[0].padEnd(30 - 22)} ${c.verdict.padEnd(16)} ${c.preview}`);
    }
  }
  const cs = row.code_status;
  if (Array.isArray(cs) && cs.length) {
    const c = classify(cs[0]);
    console.log(`  code_status[0]${" ".padEnd(16)} ${c.verdict.padEnd(16)} ${c.preview}`);
  }
  await client.end();
})().catch((e) => { console.error("PROBE ERROR:", e.message); process.exit(1); });
