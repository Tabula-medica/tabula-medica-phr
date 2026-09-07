/**
 * Body-size caps for the endpoints an anonymous client can reach.
 *
 * ## Why these routes are singled out
 *
 * The global body limit is sized for authenticated uploads. Every route listed
 * here is unauthenticated *by design* — a passport handed to a stranger, a
 * carrier webhook, a share link opened from an SMS — which means an anonymous
 * client chooses the body, and the process that parses it is the same process
 * that serves clinical routes.
 *
 * Parsing and then verifying is the wrong order when the verification is the
 * only thing standing between a stranger and this instance's CPU. The Twilio
 * signature check on `/api/engagement/inbound` runs over *parsed* params, so
 * without a cap an unsigned 10mb body is read, parsed and HMAC'd in full and
 * only then rejected. Passport verification is the same shape: canonicalising
 * the posted document is real work done before anything is trusted.
 *
 * A rate limit does not fix this. It bounds requests per window, not the work
 * each one costs, and the work here is proportional to body size.
 *
 * ## Why a table rather than a line per route
 *
 * Round 11 on this branch fixed a capability token in one path logger and left
 * it standing in seven others; the lesson recorded there was to fix the class,
 * not the instance. This is the same shape of defect. `/api/world/ips/verify`
 * was capped when it was written, and the two unauthenticated routes added
 * after it were not — nobody was careless, there was simply no list to be
 * absent from.
 *
 * So the caps live in one table, `server/index.ts` mounts from it, the 413
 * handler reads the limit back out of it, and the next unauthenticated
 * endpoint is a row rather than an omission.
 *
 * ## One unauthenticated route is deliberately NOT in this table
 *
 * `POST /api/billing/webhook/stripe` is also reachable without credentials and
 * also HMACs its body, so it belongs to this class — but it verifies against
 * `req.rawBody`, and `req.rawBody` is populated by the `verify` hook on the
 * *global* `express.json`. Mounting a narrow parser in front of it without
 * carrying that hook would leave `rawBody` undefined and break signature
 * verification on a payment webhook.
 *
 * Capping it is a one-line change — the same `verify: (req, _res, buf) => {
 * req.rawBody = buf; }` on a `WEBHOOK_BODY_LIMIT` parser mounted at that path
 * — but it is pre-existing code outside the change that this table came from,
 * and there is no Stripe coverage in the suite to prove the hook still fires.
 * It is named here rather than silently omitted so the next person sees a
 * decision instead of a gap.
 *
 * ## What this is not
 *
 * Not an authorisation control and not a substitute for one. Every route here
 * still verifies whatever it verifies — a Twilio signature, a passport
 * signature, a share token. This only bounds the work done *before* that
 * verification can run.
 */

export interface BodyLimit {
  /** Exact mount path. Matched exactly, or as a `/`-delimited prefix. */
  readonly path: string;
  /** A body-parser size string, e.g. "64kb". */
  readonly limit: string;
  /** Why this endpoint is reachable without credentials. */
  readonly reason: string;
}

/**
 * Passport verification canonicalises and verifies a signed IPS document. A
 * real passport is orders of magnitude below this; the headroom is for an
 * unusually large medication or problem list, not for an upload.
 */
export const PASSPORT_VERIFY_BODY_LIMIT =
  process.env.PASSPORT_VERIFY_BODY_LIMIT || "512kb";

/**
 * Webhooks and redemptions carry a handful of short fields — a Twilio SMS
 * body, a token, a six-digit PIN. 64kb is already far more than any
 * legitimate request needs.
 */
export const WEBHOOK_BODY_LIMIT = process.env.WEBHOOK_BODY_LIMIT || "64kb";

export const UNAUTHENTICATED_BODY_LIMITS: readonly BodyLimit[] = [
  {
    path: "/api/world/ips/verify",
    limit: PASSPORT_VERIFY_BODY_LIMIT,
    reason:
      "A clinician who has never heard of this product verifies a document a patient handed them.",
  },
  {
    path: "/api/engagement/inbound",
    limit: WEBHOOK_BODY_LIMIT,
    reason:
      "Twilio's inbound SMS webhook. A STOP that fails an auth check is a TCPA violation, so the carrier cannot be asked to authenticate.",
  },
  {
    path: "/s/redeem",
    limit: WEBHOOK_BODY_LIMIT,
    reason:
      "Share-link redemption. The recipient holds a capability token and no account.",
  },
];

/**
 * The limit that governs `path`, or null when only the global cap applies.
 *
 * Prefix matching is `/`-delimited so `/s/redeem` never claims `/s/redeemer`.
 */
export function bodyLimitFor(path: string): BodyLimit | null {
  return (
    UNAUTHENTICATED_BODY_LIMITS.find(
      (entry) => path === entry.path || path.startsWith(entry.path + "/"),
    ) ?? null
  );
}
