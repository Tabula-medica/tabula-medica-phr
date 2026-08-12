import * as jose from "jose";
import memoize from "memoizee";
import { db } from "../db";
import { externalIdentities, users, type User } from "@shared/models/auth";
import { and, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

const GCIP_PROJECT_ID =
  process.env.GCIP_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  "united-planet-485003-n7-9f345";

const GCIP_ISSUER = `https://securetoken.google.com/${GCIP_PROJECT_ID}`;
const GCIP_AUDIENCE = GCIP_PROJECT_ID;
const getGcipJWKS = memoize(
  () =>
    jose.createRemoteJWKSet(
      new URL(`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`)
    ),
  { maxAge: 3600 * 1000 }
);

export interface GcipClaims extends jose.JWTPayload {
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
}

export async function verifyGcipToken(token: string): Promise<GcipClaims | null> {
  try {
    const jwks = getGcipJWKS();
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: GCIP_ISSUER,
      audience: GCIP_AUDIENCE,
    });
    if (!payload.sub) return null;
    return payload as GcipClaims;
  } catch (err) {
    // Token verification failures are expected (expired, malformed, wrong audience).
    // Stay silent on the hot path; route-level handlers convert null -> 401.
    return null;
  }
}

/**
 * Resolve a verified GCIP token's `sub` claim to an internal `users.id`,
 * via the external_identities lookup table. If no link exists yet but the
 * token's email matches an existing user, auto-link on first sign-in.
 *
 * Returns null if no internal user can be resolved.
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
        eq(externalIdentities.externalSub, externalSub)
      )
    )
    .limit(1);

  if (existingLink) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingLink.userId))
      .limit(1);
    if (user) {
      await db
        .update(externalIdentities)
        .set({ lastSeenAt: new Date() })
        .where(eq(externalIdentities.id, existingLink.id));
      return user;
    }
  }

  // Auto-link on first GCIP sign-in if the email matches an existing user
  // (preserves legacy data ownership for users migrated from prior IdPs).
  // SECURITY: Require email_verified === true before linking by email. Without
  // this check an attacker who can obtain a valid GCIP token with an unverified
  // email matching a victim can silently take over that account.
  if (claims.email && claims.email_verified === true) {
    const [userByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, claims.email))
      .limit(1);

    if (userByEmail) {
      const signInProvider =
        (claims.firebase?.sign_in_provider as string | undefined) ?? null;
      await db
        .insert(externalIdentities)
        .values({
          userId: userByEmail.id,
          provider: "gcip",
          externalSub,
          email: claims.email,
          emailVerified: true,
          metadata: signInProvider ? { sign_in_provider: signInProvider } : null,
          linkedAt: new Date(),
          lastSeenAt: new Date(),
        })
        .onConflictDoNothing({
          target: [externalIdentities.provider, externalIdentities.externalSub],
        });
      logger.info(`[GCIP] auto-linked existing user ${userByEmail.id} to gcip sub ${externalSub} (email verified, sign_in_provider=${signInProvider ?? "unknown"})`);
      return userByEmail;
    }
  }

  return null;
}

/**
 * Atomically provision a brand-new user from GCIP claims when no existing
 * user matches by external_identities lookup OR by verified email.
 * Wraps the users insert + external_identities insert in a single transaction
 * so a partial failure cannot leave an orphan row.
 */
export async function createUserFromGcipClaims(claims: GcipClaims): Promise<User | null> {
  const externalSub = claims.sub;
  if (!externalSub) return null;

  const rawName = (claims.name as string | undefined) || "";
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? null;
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "NMN";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : null;

  const signInProvider =
    (claims.firebase?.sign_in_provider as string | undefined) ?? null;
  // Phone sign-in: possession of the number is proof-of-verification, so we
  // treat a phone-provider token as verified even though there's no email.
  // The number is not stored on `users` (no column); it lives in the
  // external_identities metadata below, which is where we keep IdP details.
  const isPhoneSignIn = signInProvider === "phone" || Boolean(claims.phone_number);
  const verified = (claims.email_verified ?? false) || isPhoneSignIn;

  return db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        email: claims.email ?? null,
        firstName,
        middleName: middleName || "NMN",
        lastName,
        profileImageUrl: (claims.picture as string | undefined) ?? null,
        authProvider: "gcip",
        isVerified: verified,
        verificationProvider: verified ? (isPhoneSignIn ? "gcip-phone" : "gcip") : null,
        verifiedAt: verified ? new Date() : null,
      })
      .returning();

    if (!newUser) return null;

    // Persist the underlying Firebase sign-in provider (google.com /
    // apple.com / password / phone / ...) in metadata so admin tooling and any
    // future "linked accounts" UI can tell which IdP a user used. The
    // outer `provider` column stays "gcip" so legacy ownership records
    // still resolve and queries don't have to special-case Apple/phone.
    const metadata: Record<string, unknown> = {};
    if (signInProvider) metadata.sign_in_provider = signInProvider;
    if (claims.phone_number) metadata.phone_number = claims.phone_number;

    await tx
      .insert(externalIdentities)
      .values({
        userId: newUser.id,
        provider: "gcip",
        externalSub,
        email: claims.email ?? null,
        emailVerified: claims.email_verified ?? false,
        metadata: Object.keys(metadata).length ? metadata : null,
        linkedAt: new Date(),
        lastSeenAt: new Date(),
      })
      .onConflictDoNothing({
        target: [externalIdentities.provider, externalIdentities.externalSub],
      });

    return newUser;
  });
}

/**
 * Full dual-validation entry point: verify GCIP token, resolve to existing
 * internal user, or atomically provision a new one. Returns null if the token
 * is invalid or the resolve+create both fail.
 */
export async function verifyAndResolveGcip(token: string): Promise<User | null> {
  const claims = await verifyGcipToken(token);
  if (!claims) return null;
  const existing = await resolveGcipUser(claims);
  if (existing) return existing;
  return createUserFromGcipClaims(claims);
}

export { GCIP_PROJECT_ID, GCIP_ISSUER, GCIP_AUDIENCE };
