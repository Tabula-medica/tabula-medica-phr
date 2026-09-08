/**
 * ZIP code proximity for provider search.
 *
 * "Find me a cardiologist in an adjacent ZIP code" needs a definition of
 * adjacent. This module supplies one, and is explicit about its limits.
 *
 * ── What this does ──
 * US ZIP codes are assigned through a postal hierarchy: the first digit is a
 * national area, the first three digits are a Sectional Center Facility (SCF)
 * that routes for a contiguous cluster of towns, and the last two identify a
 * delivery area inside it. Numerically neighbouring ZIPs within one SCF are
 * therefore usually geographically neighbouring, and that is the relationship
 * this module exploits: expand outward from a seed ZIP through its SCF, then
 * to numerically adjacent SCFs.
 *
 * ── What this does NOT do ──
 * This is postal proximity, not geodesic distance and not drive time. It is
 * wrong in known ways:
 *
 *   - ZIPs at an SCF boundary have close neighbours in a different SCF that
 *     this ranking places far away.
 *   - Rural SCFs span hundreds of miles, so "adjacent" can be a long drive.
 *   - A river, a mountain, or a state line can sit between two ZIPs that are
 *     numerically consecutive.
 *
 * Doing this properly requires a ZIP centroid dataset (latitude/longitude per
 * ZIP, ~41k rows) and a haversine search, which is the intended upgrade — the
 * interface here is deliberately shaped so that swapping the ranking function
 * for a real distance calculation does not change any caller. Until then the
 * UI must say "nearby ZIP codes", never "within N miles", because this module
 * cannot honestly produce a mileage figure.
 */

/** A ZIP-5 in canonical form: exactly five digits. */
export type Zip5 = string;

export interface ZipNeighborhood {
  /** The ZIP the search started from. */
  seed: Zip5;
  /** The seed's Sectional Center Facility prefix (first three digits). */
  scf: string;
  /**
   * ZIP prefixes to query, nearest ring first. Each is a 3-digit SCF prefix
   * suitable for a wildcard postal_code query against NPPES.
   */
  scfRings: string[];
}

const ZIP5_RE = /^\d{5}$/;

/**
 * Normalise user input to a ZIP-5.
 *
 * Accepts "94110", "94110-1234", and " 94110 ". Returns null for anything
 * else — including 4-digit input, which is a common typo that would otherwise
 * silently search the wrong part of the country.
 */
export function normalizeZip(raw: string): Zip5 | null {
  if (!raw) return null;
  const digits = raw.trim().split("-")[0].trim();
  return ZIP5_RE.test(digits) ? digits : null;
}

/** The Sectional Center Facility prefix — the first three digits. */
export function scfPrefix(zip: Zip5): string {
  return zip.slice(0, 3);
}

/**
 * Build the rings of ZIP prefixes to search, nearest first.
 *
 * Ring 0 is the seed's own SCF. Ring N adds the SCFs numerically N above and
 * below it. Wrapping is intentionally NOT performed: SCF 000 and 999 are not
 * neighbours, and wrapping would send a Puerto Rico search to Alaska.
 *
 * `rings` counts how far out to go, not how many prefixes to return.
 */
export function buildZipNeighborhood(
  seed: Zip5,
  rings = 1,
): ZipNeighborhood | null {
  const zip = normalizeZip(seed);
  if (!zip) return null;

  const scf = scfPrefix(zip);
  const base = Number(scf);
  const prefixes: string[] = [scf];

  for (let step = 1; step <= Math.max(0, rings); step++) {
    // Below, then above, so the list alternates outward symmetrically.
    const lower = base - step;
    const upper = base + step;
    if (lower >= 0) prefixes.push(String(lower).padStart(3, "0"));
    if (upper <= 999) prefixes.push(String(upper).padStart(3, "0"));
  }

  return { seed: zip, scf, scfRings: prefixes };
}

/**
 * Rank a result ZIP by postal closeness to the seed. Lower is nearer.
 *
 * Same ZIP scores 0. Same SCF scores by the numeric gap in the last two
 * digits (0–99). A different SCF is penalised by a full SCF-width so that
 * every same-SCF result sorts ahead of every different-SCF result — within an
 * SCF the numeric gap is meaningful, across SCFs it is not.
 *
 * Returns Infinity for an unparseable ZIP so bad data sorts last instead of
 * first, which is what a 0-or-null default would do.
 */
export function zipProximityScore(seed: Zip5, candidate: string): number {
  const a = normalizeZip(seed);
  const b = normalizeZip(candidate);
  if (!a || !b) return Infinity;
  if (a === b) return 0;

  const scfA = Number(scfPrefix(a));
  const scfB = Number(scfPrefix(b));

  if (scfA === scfB) {
    return Math.abs(Number(a.slice(3)) - Number(b.slice(3)));
  }

  const SCF_WIDTH = 100;
  return SCF_WIDTH * (1 + Math.abs(scfA - scfB));
}

/**
 * How to describe the proximity to a user, in words rather than a distance.
 *
 * The module cannot compute miles, so it must not imply it can. These labels
 * are what the UI and the voice prompt read out.
 */
export function proximityLabel(seed: Zip5, candidate: string): string {
  const score = zipProximityScore(seed, candidate);
  if (score === 0) return "same ZIP code";
  if (score < 100) return "nearby ZIP code";
  if (score < 300) return "adjacent postal area";
  if (Number.isFinite(score)) return "wider search area";
  return "location unknown";
}
