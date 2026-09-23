/**
 * Test-only session injection.
 *
 * The app's real login is GCIP (Google Identity Platform) via a popup flow
 * (see replitAuth.ts) — there is no password/OTP form to drive with
 * Playwright, and scripting a real Google identity popup in CI is neither
 * practical nor something we want depending on external IdP availability.
 *
 * Instead we write a session row directly into the same Postgres-backed
 * session store connect-pg-simple uses (see getSession() in
 * server/replit_integrations/auth/replitAuth.ts) and hand the browser a
 * correctly-signed `connect.sid` cookie for it. This produces exactly the
 * `req.user = { claims: { sub, ... } }` shape isAuthenticated() checks —
 * i.e. it exercises the real session-cookie code path, not a mock — the
 * only thing bypassed is the GCIP popup itself.
 *
 * Requires DATABASE_URL to point at the same database the app under test
 * is using, and SESSION_SECRET to match the value the server was started
 * with (both are already required to run the app itself).
 */
import { Client } from "pg";
import { sign } from "cookie-signature";
import { randomUUID } from "crypto";

export interface TestUserClaims {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  /** Unix seconds; omit for a session that never expires mid-test. */
  exp?: number;
}

export interface TestSession {
  sid: string;
  /** Value to set as the `connect.sid` cookie, including the `s:` prefix. */
  cookieValue: string;
  cleanup: () => Promise<void>;
}

const SESSION_COOKIE_NAME = "connect.sid";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set — session fixtures need the same DATABASE_URL/SESSION_SECRET the ` +
        `server under test was started with. See e2e/README.md.`,
    );
  }
  return v;
}

/**
 * Insert a session row for the given claims and return a signed cookie for
 * it. Call `cleanup()` when the test is done (the auth fixture in
 * auth-fixtures.ts does this automatically).
 */
export async function createTestSession(claims: TestUserClaims): Promise<TestSession> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sessionSecret = process.env.SESSION_SECRET || "tabula-medica-fallback-secret-dev-only";

  const sid = `e2e-${randomUUID()}`;
  const expire = new Date(Date.now() + 60 * 60 * 1000); // 1h — plenty for a test run
  const sess = {
    cookie: { originalMaxAge: 3600000, httpOnly: true, secure: false, sameSite: "lax", path: "/" },
    passport: { user: { claims } },
  };

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // GET /api/auth/user (and anything that reads the user profile, e.g.
    // my-health-record.tsx's summary tab) looks the subject up in `users`
    // via authStorage.getUser() and returns null if there's no row — a
    // session alone isn't "logged in" from the app's point of view without
    // a matching profile. Seed a minimal one so authenticated tests see a
    // real, non-null user, the same as a real GCIP sign-in would.
    await client.query(
      `INSERT INTO users (id, email, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [claims.sub, claims.email ?? null, claims.first_name ?? null, claims.last_name ?? null],
    );
    await client.query("INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)", [
      sid,
      JSON.stringify(sess),
      expire,
    ]);
  } finally {
    await client.end();
  }

  const cookieValue = `s:${sign(sid, sessionSecret)}`;

  return {
    sid,
    cookieValue,
    cleanup: async () => {
      const c = new Client({ connectionString: databaseUrl });
      await c.connect();
      try {
        await c.query("DELETE FROM sessions WHERE sid = $1", [sid]);
        // Best-effort: leaves the user row if something else created a
        // dependent record (e.g. a foreign-key-referencing entry) during
        // the test — never let cleanup fail the test run.
        await c.query("DELETE FROM users WHERE id = $1", [claims.sub]).catch(() => {});
      } finally {
        await c.end();
      }
    },
  };
}

export { SESSION_COOKIE_NAME };
