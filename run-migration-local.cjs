// run-migration-local.cjs — Apply the external_identities migration through a LOCAL
// cloud-sql-proxy, using the app's own working credential from DATABASE_URL.
//
// It parses DATABASE_URL for user/password/dbname but connects to 127.0.0.1:PGPORT
// (your local proxy), so the socket path inside DATABASE_URL is ignored. No psql,
// no superuser needed — just Node + this repo's pg module.
//
// Prereqs (see printed steps if run without proxy):
//   1) Terminal A:  cloud-sql-proxy.exe --port 5432 united-planet-485003-n7:us-central1:tabula-medica-db
//   2) Terminal B:  set DATABASE_URL from Secret Manager, then run this script.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
// Use pg's OWN connection-string parser (same one the app uses) so passwords with
// special characters are extracted correctly — a hand-rolled regex mangles them.
const parseConn = require('pg-connection-string').parse;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Get it (PowerShell) with:');
  console.error('  $env:DATABASE_URL = gcloud secrets versions access latest --secret=patient-db-secret-us-central1 --project united-planet-485003-n7');
  process.exit(1);
}

(async () => {
  const c = parseConn(url); // { user, password, host, database, port, ... } exactly as the app sees it
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',        // force the LOCAL proxy, ignore the URL's socket host
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || c.user,
    password: process.env.PGPASSWORD || c.password,
    database: process.env.PGDATABASE || c.database,
    ssl: false,
  });
  console.log(`Connecting to 127.0.0.1:${process.env.PGPORT || 5432} as ${client.user} db=${client.database} ...`);
  await client.connect();

  const before = await client.query("SELECT to_regclass('public.external_identities') AS t");
  console.log('BEFORE: external_identities =', before.rows[0].t || '(missing)');

  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '0002b_external_identities_minimal.sql'), 'utf8');
  await client.query(sql);

  const after = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='external_identities' ORDER BY ordinal_position"
  );
  console.log('AFTER: external_identities columns =', after.rows.map((r) => r.column_name).join(', ') || '(STILL MISSING)');
  await client.end();
  console.log(after.rows.length ? '\n✅ MIGRATION OK — external_identities exists.' : '\n❌ table still missing');
})().catch((e) => { console.error('\nMIGRATION FAILED:', e.message); process.exit(1); });
