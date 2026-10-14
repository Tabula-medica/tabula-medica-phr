/**
 * Proxy Access Service — canProxyAccess + age-gate logic.
 *
 * Access levels:
 *   full     — all data, no restrictions
 *   standard — strips mental_health, reproductive_health, substance_use tagged records
 *   admin    — appointments and messages only
 *
 * Age rules (US federal minor / HIPAA §164.502(g)):
 *   DOB < 12 years      → parent gets full access automatically
 *   DOB 13–17 years     → proxy access requires patient confirmation (enforced in
 *                          grant-creation flow; here we trust the grant was confirmed)
 *   DOB ≥ 18 years      → all proxy access must have been revoked by the daily job;
 *                          an un-revoked grant that slipped past the job is denied here
 */

export type ProxyAccessLevel = "full" | "standard" | "admin";

export type SensitiveCategory =
  | "mental_health"
  | "reproductive_health"
  | "substance_use";

/** Broad resource-type buckets used by individual PHR data routes. */
export type ResourceType =
  | "appointments"
  | "messages"
  | "medications"
  | "conditions"
  | "lab_results"
  | "documents"
  | "vitals"
  | "immunizations"
  | "allergies"
  | "procedures"
  | "notes"
  | SensitiveCategory;

/**
 * Minimal shape the service needs from a grant record.
 * Full DB type lives in shared/schema (proxy_grants table).
 */
export interface ProxyGrant {
  id: string;
  grantorPatientId: string;
  /** ISO-8601 date-of-birth of the grantor (patient). Nullable for adult patients. */
  grantorDob: string | null;
  granteeUserId: string;
  accessLevel: ProxyAccessLevel;
  revokedAt: string | null;
  expiresAt: string | null;
  ageAutoRevoked: boolean;
  acceptedAt: string | null;
}

/**
 * Returns true when `accessor` may view a resource of `resourceType` for
 * `grant.grantorPatientId`, given the grant state and access level.
 *
 * Rules are intentionally DENY-by-default:
 *  – Grant must be accepted, non-expired, non-revoked.
 *  – Age-18 auto-revocation: if grantor is ≥18 the grant should have been
 *    revoked by the nightly job; if somehow it was not, deny here.
 *  – accessLevel="admin" only passes appointments and messages.
 *  – accessLevel="standard" blocks sensitive categories.
 *  – accessLevel="full" passes everything.
 */
export function canProxyAccess(
  grant: ProxyGrant,
  resourceType: ResourceType,
): boolean {
  // Must be accepted
  if (!grant.acceptedAt) return false;

  // Must not be revoked or age-auto-revoked
  if (grant.revokedAt || grant.ageAutoRevoked) return false;

  // Must not be expired
  if (grant.expiresAt && new Date(grant.expiresAt) <= new Date()) return false;

  // Age-18 safety net: if grantor has a known DOB and is now >=18, deny.
  if (grant.grantorDob) {
    const age = calcAgeYears(grant.grantorDob);
    if (age >= 18) return false;
  }

  const SENSITIVE_CATEGORIES: Set<string> = new Set([
    "mental_health",
    "reproductive_health",
    "substance_use",
  ]);

  const ADMIN_ALLOWED: Set<string> = new Set(["appointments", "messages"]);

  switch (grant.accessLevel) {
    case "full":
      return true;

    case "standard":
      return !SENSITIVE_CATEGORIES.has(resourceType);

    case "admin":
      return ADMIN_ALLOWED.has(resourceType);

    default:
      return false;
  }
}

/**
 * Determines the access level to automatically assign when the grantor is a minor.
 *
 *   < 12 years  -> parent gets full access (no confirmation needed)
 *   13-17       -> proxy access requires teen confirmation step in the UI
 *
 * Returns null when no automatic rule applies (adult patient).
 */
export function autoAccessLevelForMinor(
  grantorDob: string,
): ProxyAccessLevel | null {
  const age = calcAgeYears(grantorDob);
  if (age < 12) return "full";
  if (age < 18) return "standard";
  return null;
}

/**
 * Returns true when a proxy grant for a minor (13-17) needs a teen confirmation
 * step before being activated.
 */
export function requiresTeenConfirmation(grantorDob: string): boolean {
  const age = calcAgeYears(grantorDob);
  return age >= 13 && age < 18;
}

/** Calculate age in whole years from an ISO-8601 date string. */
export function calcAgeYears(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
