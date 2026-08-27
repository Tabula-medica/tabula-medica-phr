// ABHA ↔ user linkage (India).
//
// WHY THIS EXISTS, and why the consent layer is unsafe without it.
//
// `evaluateConsentArtefact` refuses an artefact whose `patient.id` is not the requesting user's
// ABHA address. That check is only worth anything if the ABHA address comes from the SERVER. If
// a route read it from the request body, a user could name someone else's ABHA address and the
// comparison would compare an attacker-supplied value against itself — a check that always
// passes. So every consent and data-flow route resolves the address through this module, and
// none of them accept one from the client.
//
// Storage reuses `external_identities` (provider `abdm-abha`, externalSub = the ABHA address),
// following `server/auth/fasten.ts`: the table's unique (provider, external_sub) index means an
// ABHA address can be linked to exactly one user, and a second user claiming it is refused
// rather than silently re-pointed.
//
// Only a VERIFIED enrollment links. The stub path returns an unverified demo profile, and
// linking that would let any account claim the demo ABHA address and, with it, any consent
// artefact issued for it.
import { and, eq } from "drizzle-orm";
import { externalIdentities } from "@shared/models/auth";
import { db } from "../db";

export const ABHA_PROVIDER = "abdm-abha";

export type LinkOutcome = "linked" | "already-linked" | "conflict";

function normalise(abhaAddress: string): string {
  // ABHA addresses are case-insensitive; store and compare one canonical form so that
  // `Someone@sbx` and `someone@sbx` cannot become two rows owned by two different users.
  return abhaAddress.trim().toLowerCase();
}

/**
 * Link a verified ABHA address to a user. Refuses when another user already holds it — the same
 * conflict posture Fasten BYOI takes, and for the same reason: the first verified claim wins,
 * and a later claim is a signal, not an update.
 */
export async function linkAbhaAddress(
  userId: string,
  abhaAddress: string,
  metadata: { abhaNumber?: string | null } = {},
): Promise<LinkOutcome> {
  const externalSub = normalise(abhaAddress);
  if (!userId || !externalSub) throw new Error("userId and abhaAddress are required to link an ABHA identity");

  const [existing] = await db
    .select()
    .from(externalIdentities)
    .where(and(eq(externalIdentities.provider, ABHA_PROVIDER), eq(externalIdentities.externalSub, externalSub)))
    .limit(1);

  if (existing) {
    if (existing.userId !== userId) return "conflict";
    await db
      .update(externalIdentities)
      .set({ lastSeenAt: new Date() })
      .where(eq(externalIdentities.id, existing.id));
    return "already-linked";
  }

  await db.insert(externalIdentities).values({
    userId,
    provider: ABHA_PROVIDER,
    externalSub,
    // The ABHA NUMBER is a national health identifier. It is kept out of `email` and out of any
    // indexed column, and lives in metadata only so the link can be shown back to the patient.
    metadata: { abhaNumber: metadata.abhaNumber ?? null },
    linkedAt: new Date(),
    lastSeenAt: new Date(),
  });
  return "linked";
}

/** The authenticated user's linked ABHA address, or null. The only source consent routes trust. */
export async function getLinkedAbhaAddress(userId: string): Promise<string | null> {
  if (!userId) return null;
  const [row] = await db
    .select()
    .from(externalIdentities)
    .where(and(eq(externalIdentities.provider, ABHA_PROVIDER), eq(externalIdentities.userId, userId)))
    .limit(1);
  return row?.externalSub ?? null;
}
