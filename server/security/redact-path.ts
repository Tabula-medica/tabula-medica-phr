/**
 * Keep capability tokens out of anything that writes a request path.
 *
 * ## Why this is a shared helper and not a fix to one route
 *
 * Round 5 on this branch found that `server/index.ts` HTTP-logs `{ method,
 * path }` for every `/api` request, so a share token in the path landed in
 * stdout. The fix moved that route's token into the request body. Correct, and
 * too narrow: it fixed the logger that was reported.
 *
 * Round 11 found the same token in stdout again by a different door. The SOC2
 * change tracker in `compliance-middleware.ts` is mounted globally at
 * `server/index.ts:191`, runs before `serveStatic` and `registerRoutes`, is
 * enabled by default, and logs `path` for **every** non-GET request with no
 * `/api` restriction at all. `POST /s/<token>` walked straight into it.
 *
 * That is the fourth time on this pull request that a class of defect was
 * fixed at one instance and left standing at another. So this is deliberately
 * not a change to the share route: it is a function that every path-writing
 * logger calls, so the next route to carry a secret in a URL is covered before
 * anybody notices it needs to be.
 *
 * ## What is redacted, and what is deliberately not
 *
 * A **capability token** is a bearer secret: holding the string is sufficient
 * to get the data. `/s/<token>` is one — default share grants have no PIN, so
 * that token alone redeems medications, diagnoses and allergies.
 *
 * A **UUID identifier** is not. `/api/patients/<uuid>` names a resource that
 * still requires authentication and authorisation to reach. Redacting those
 * would destroy the audit correlation the compliance logs exist to provide,
 * and would trade a real capability for a fake one. So UUID-shaped segments
 * are left alone, and a test pins that.
 *
 * Two mechanisms, because either alone fails:
 *
 * - **A prefix registry** — authoritative, and covers a token even if it is
 *   short or low-entropy.
 * - **An entropy heuristic** — covers the route nobody remembered to register,
 *   which is the failure mode this file exists to break.
 */

/** Path prefixes whose next segment is a bearer capability, never an id. */
const CAPABILITY_PREFIXES: readonly string[] = [
  /** Health-summary share links. The token alone redeems a no-PIN grant. */
  "/s",
];

export const REDACTED = "[redacted-token]";

/** A canonical UUID. Named a resource, not a secret — and left intact. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Long enough, and dense enough, to be a secret rather than a slug.
 *
 * 24 characters of base64url is 144 bits — far past anything a human types as
 * a route name, and short of it a segment is almost certainly a word. The
 * charset excludes the dots and tildes that appear in version and file
 * segments so `v1.2.3` and friends survive.
 */
const HIGH_ENTROPY = /^[A-Za-z0-9_-]{24,}$/;

function looksLikeSecret(segment: string): boolean {
  if (UUID.test(segment)) return false;
  if (!HIGH_ENTROPY.test(segment)) return false;
  // A run of only letters is a word, however long. Require the mixed shape a
  // base64url encoder actually produces.
  const hasDigit = /[0-9]/.test(segment);
  const hasUpper = /[A-Z]/.test(segment);
  const hasLower = /[a-z]/.test(segment);
  return (hasDigit && (hasUpper || hasLower)) || (hasUpper && hasLower);
}

/**
 * A request path safe to write to a log.
 *
 * Structure is preserved — `/s/[redacted-token]` still tells an auditor which
 * route was hit and when, which is the whole point of the record. Only the
 * part that would let the reader replay the request is removed.
 */
export function redactPath(path: string): string {
  if (!path) return path;

  const [rawPath, ...rest] = path.split("?");
  const segments = rawPath.split("/");

  const out = segments.map((segment, i) => {
    if (!segment) return segment;

    const parentPrefix = "/" + segments.slice(1, i).join("/");
    if (CAPABILITY_PREFIXES.includes(parentPrefix)) return REDACTED;

    return looksLikeSecret(segment) ? REDACTED : segment;
  });

  // A query string on a logged path is a secret-bearing surface of its own,
  // and nothing in this application needs its contents in a compliance
  // record. Dropped rather than parsed.
  const query = rest.length > 0 ? "?[redacted-query]" : "";
  return out.join("/") + query;
}

/**
 * True when the path carried something this function removed.
 *
 * Exposed so a caller can tell "nothing to redact" from "redaction happened",
 * which is the difference between a quiet log line and evidence that a route
 * is putting secrets in URLs.
 */
export function pathWasRedacted(path: string): boolean {
  return redactPath(path) !== path;
}
