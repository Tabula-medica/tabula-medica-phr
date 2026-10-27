/**
 * GCIP (Google Cloud Identity Platform) token verification + dual-validation
 * resolution. Mirrors the existing Auth0 path but for Firebase/GCIP ID
 * tokens issued under the BAA-covered GCP project.
 *
 * Task #68 — GCIP migration, Phase 0-2 (dual-validation cutover).
 *
 * Architectural notes:
 *  - Uses `jose` for JWKS fetching + JWT verification (locked architecture
 *    decision; matches the reference port in `.local/gcip-reference/`).
 *  - `createRemoteJWKSet` caches keys in-memory between requests.
 *  - All identity lookups go through the new `external_identities` table so
 *    a single internal `users.id` can be reached via either Auth0 or GCIP.
 *  - Auto-link on first GCIP sign-in is gated by `email_verified === true`.
 *    Never auto-link on unverified email — that would be an account-takeover
 *    vector for any attacker who can register a Firebase account with a
 *    victim's email.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { db } from "../db";
import { externalIdentities, type User, type InsertUser } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { storage } from "../storage";

export const GCIP_PROJECT_ID =
  process.env.GCIP_PROJECT_ID ||
  process.env.EXPO_PUBLIC_GCIP_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  "";

const GCIP_ISSUER = `https://securetoken.google.com/${GCIP_PROJECT_ID}`;
const GCIP_AUDIENCE = GCIP_PROJECT_ID;
const GCIP_JWKS_URI =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (_jwks) return _jwks;
  _jwks = createRemoteJWKSet(new URL(GCIP_JWKS_URI));
  return _jwks;
}

/**
 * Test-only: override the JWKS resolver used by {@link verifyGcipToken}.
 * `createRemoteJWKSet` uses node:http/https directly (not `globalThis.fetch`),
 * so the regression suite cannot mock its key fetch via a fetch stub. Tests
 * inject a `createLocalJWKSet`-style resolver instead. Production code paths
 * never call this.
 */
export function __setJwksForTesting(
  jwks: ReturnType<typeof createRemoteJWKSet> | null,
): void {
  _jwks = jwks;
}

export interface GcipClaims extends JWTPayload {
  sub: string;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
}

export function isGcipConfigured(): boolean {
  return Boolean(GCIP_PROJECT_ID);
}

/**
 * Verify a Firebase / GCIP ID token. Returns the claims on success or null
 * on any verification failure (expired, bad signature, wrong audience, etc).
 * Failures are silent on the hot path — middleware converts null to 401.
 */
export async function verifyGcipToken(token: string): Promise<GcipClaims | null> {
  if (!isGcipConfigured()) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: GCIP_ISSUER,
      audience: GCIP_AUDIENCE,
      algorithms: ["RS256"],
    });
    if (!payload.sub) return null;
    return payload as GcipClaims;
  } catch {
    return null;
  }
}

async function touchLastSeen(externalIdentityId: string): Promise<void> {
  try {
    await db
      .update(externalIdentities)
      .set({ lastSeenAt: new Date() })
      .where(eq(externalIdentities.id, externalIdentityId));
  } catch {
    // last-seen tracking is best-effort
  }
}

/**
 * Resolve a verified GCIP token's `sub` claim to an internal user, via the
 * external_identities lookup table. If no link exists yet but the token's
 * email matches an existing user AND email is verified, auto-link on first
 * sign-in. Returns null if no internal user can be resolved.
 */
export async function resolveGcipUser(claims: GcipClaims): Promise<User | null> {
  const externalSub = claims.sub;
  if (!externalSub) return null;

  const [existingLink] = await db
    .select()
    .from(externalIdentities)
    .where(
      and(
        eq(externalIdentities.provider, "gcip"),
        eq(externalIdentities.externalSub, externalSub),
      ),
    )
    .limit(1);

  if (existingLink) {
    const user = await storage.getUser(existingLink.userId);
    if (user) {
      void touchLastSeen(existingLink.id);
      return user;
    }
  }

  // Auto-link on first GCIP sign-in only when email is verified — never
  // auto-link on unverified email (account-takeover gate).
  if (claims.email && claims.email_verified === true) {
    const userByEmail = await storage.getUserByEmail(claims.email);
    if (userByEmail) {
      await db
        .insert(externalIdentities)
        .values({
          userId: userByEmail.id,
          provider: "gcip",
          externalSub,
          email: claims.email,
          emailVerified: true,
        })
        .onConflictDoNothing();
      console.log(
        `[GCIP] auto-linked existing user ${userByEmail.id} to gcip sub (email verified)`,
      );
      return userByEmail;
    }
  }

  return null;
}

/**
 * Provision a new internal user from GCIP claims when no existing user matches
 * either by external_identities or by verified email. Returns null on failure.
 */
export async function createUserFromGcipClaims(claims: GcipClaims): Promise<User | null> {
  const externalSub = claims.sub;
  if (!externalSub) return null;

  const email =
    claims.email && claims.email.length > 0
      ? claims.email
      : `gcip-${externalSub}@tabula-medica.app`;
  const name =
    (typeof claims.name === "string" && claims.name) ||
    email.split("@")[0] ||
    "Patient";
  const avatarUrl = typeof claims.picture === "string" ? claims.picture : null;
  const emailVerified = claims.email_verified === true;

  // Re-check by email inside provisioning to avoid races where two parallel
  // first sign-ins both miss the external_identities row.
  if (claims.email && emailVerified) {
    const existingByEmail = await storage.getUserByEmail(claims.email);
    if (existingByEmail) {
      await db
        .insert(externalIdentities)
        .values({
          userId: existingByEmail.id,
          provider: "gcip",
          externalSub,
          email: claims.email,
          emailVerified: true,
        })
        .onConflictDoNothing();
      return existingByEmail;
    }
  }

  const newUser: InsertUser = {
    email,
    name,
    avatarUrl,
    isDemo: false,
    isVerified: emailVerified,
    verificationProvider: emailVerified ? "gcip" : null,
    verifiedAt: emailVerified ? new Date() : null,
    biometricEnabled: false,
    autoSyncEnabled: true,
    notificationsEnabled: true,
  };

  let user: User | undefined;
  try {
    user = await storage.createUser(newUser);
  } catch (err) {
    // Unique-email collision. Linking to the existing account here would
    // be an account-takeover vector when email_verified === false, since
    // an attacker can register any email at the IdP and ride the collision
    // into an existing user. Only fall back to the existing user when the
    // IdP has independently verified the email AND we wouldn't have
    // already taken the verified-email fast-path above (covers a race
    // where another request linked the user between our re-check and the
    // insert).
    if (!claims.email || !emailVerified) {
      console.warn(
        "[GCIP] refusing to link unverified-email GCIP identity to existing account (takeover guard)",
      );
      return null;
    }
    const existing = await storage.getUserByEmail(email);
    if (!existing) {
      console.error("[GCIP] createUser failed and no existing user found", err);
      return null;
    }
    user = existing;
  }

  if (!user) return null;

  await db
    .insert(externalIdentities)
    .values({
      userId: user.id,
      provider: "gcip",
      externalSub,
      email,
      emailVerified,
    })
    .onConflictDoNothing();

  return user;
}

/**
 * Idempotently ensure an external_identities row exists linking an internal
 * user to a GCIP `sub`. Used by the Auth0→GCIP bulk-import script
 * (`scripts/migrate-auth0-to-gcip.ts`) so the same user is reachable via
 * either provider once Firebase has provisioned a UID for them.
 */
export async function linkGcipIdentityIfMissing(
  userId: string,
  gcipSub: string,
  email: string | null,
  emailVerified: boolean,
): Promise<void> {
  await db
    .insert(externalIdentities)
    .values({
      userId,
      provider: "gcip",
      externalSub: gcipSub,
      email,
      emailVerified,
    })
    .onConflictDoNothing();
}

// Task #71 — `linkAuth0IdentityIfMissing` was removed when Auth0 user login
// was retired.
// Task #104 — the `users.auth0_id` column and any `external_identities` rows
// with provider="auth0" were dropped (the SMART-on-FHIR broker now keys
// payer-token storage by internal `users.id`, not Auth0 sub).

/**
 * Full dual-validation entry point: verify a GCIP token, resolve to an
 * existing internal user, or provision a new one. Returns null if the token
 * is invalid or resolution + creation both fail.
 */
export async function verifyAndResolveGcip(token: string): Promise<User | null> {
  const claims = await verifyGcipToken(token);
  if (!claims) return null;
  const existing = await resolveGcipUser(claims);
  if (existing) return existing;
  return createUserFromGcipClaims(claims);
}
