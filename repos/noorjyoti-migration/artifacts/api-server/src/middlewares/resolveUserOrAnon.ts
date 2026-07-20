import type { Request, Response, NextFunction } from "express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import "./requireAuth"; // loads the Express.Request augmentation (gcipUid/anon keys)

const ANON_COOKIE = "nj_anon";
const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Return the HMAC-SHA256 signing secret for anonymous cookies.
 *
 * In production the secret MUST be provided via ANON_COOKIE_SECRET.
 * In development a deterministic fallback is used so tests and local
 * runs work without extra configuration, but a warning is emitted.
 */
function getSigningSecret(): Buffer {
  const raw = process.env.ANON_COOKIE_SECRET;
  if (raw) return Buffer.from(raw, "utf8");
  if (process.env.NODE_ENV === "production") {
    // Hard-fail fast rather than silently accept unsigned cookies in prod.
    throw new Error(
      "ANON_COOKIE_SECRET must be set in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  // Non-production fallback — not secret, but keeps local dev working.
  return Buffer.from("dev-anon-cookie-secret-not-for-production", "utf8");
}

/** Sign a UUID payload and return `<uuid>.<hex-hmac>`. */
function signAnonId(uuid: string): string {
  const secret = getSigningSecret();
  const mac = createHmac("sha256", secret).update(uuid).digest("hex");
  return `${uuid}.${mac}`;
}

/**
 * Verify a signed cookie value.  Returns the UUID payload on success,
 * or null if the value is absent, malformed, or has an invalid signature.
 */
function verifyAnonCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const uuid = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!uuid || !mac) return null;
  try {
    const secret = getSigningSecret();
    const expected = createHmac("sha256", secret).update(uuid).digest("hex");
    const macBuf = Buffer.from(mac, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (macBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(macBuf, expectedBuf)) return null;
    return uuid;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Normalise a raw IP string: strip IPv6-mapped IPv4 prefix (::ffff:) and
 * fall back to a sentinel when the IP is unavailable.
 */
function normaliseIp(raw: string | undefined): string {
  if (!raw) return "unknown";
  const stripped = raw.startsWith("::ffff:") ? raw.slice(7) : raw;
  return stripped || "unknown";
}

/**
 * Resolves req.userId to either the signed-in Clerk user, or an anonymous
 * id suitable for quota enforcement.
 *
 * Anonymous quota — dual-key enforcement (`anon:cookie:<uuid>` + `anon:ip:<ip>`):
 *
 *   Primary key (`anon:cookie:<uuid>`):
 *     The quota is keyed on the UUID embedded in the HMAC-SHA256-signed
 *     nj_anon cookie.  This gives every browser session its own independent
 *     budget, so one attacker exhausting their own quota does not affect any
 *     other anonymous visitor.  The HMAC signature (verified with
 *     timingSafeEqual) prevents an attacker from forging a cookie that maps
 *     to another visitor's UUID.
 *
 *   Secondary key (`anon:ip:<req.ip>`, set as `req.anonIpKey`):
 *     A churn-proof guardrail keyed on the proxy-resolved client IP.  With
 *     `trust proxy 1` configured, Express reads this from the
 *     X-Forwarded-For header set by Replit ingress, reflecting the real
 *     client address.  This catches cookie-churn attacks: a script that
 *     discards or collects fresh server-issued cookies on every request
 *     still hits the IP-level cap.  The per-visit synthesis route enforces
 *     both keys and releases the primary reservation if the secondary check
 *     fails.
 *
 *   The previous implementation keyed on `req.socket.remoteAddress` (the
 *   OS-level TCP peer).  In a reverse-proxy deployment that peer is the
 *   ingress node IP, collapsing every anonymous visitor into one shared
 *   bucket and allowing a single caller to deny service to all others.
 */
export function resolveUserOrAnon(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = req.gcipUid; // set upstream by resolveGcipUser (GCIP token verify)
  if (userId) {
    req.userId = userId;
    next();
    return;
  }

  // --- Anonymous path ---

  // Validate the signed cookie and extract the UUID quota identity.
  // Issue a fresh signed cookie (and derive the quota key from its UUID) when:
  //   • no cookie is present, or
  //   • the cookie carries an unsigned / tampered value.
  // In both cases a new UUID is generated; the quota key uses that UUID so
  // the visitor starts with a fresh (empty) budget rather than inheriting
  // any existing bucket.
  const cookies = parseCookies(req.headers.cookie);
  const rawCookie = cookies[ANON_COOKIE];
  const verifiedId = verifyAnonCookie(rawCookie);

  let anonId: string;
  if (verifiedId) {
    // Existing, cryptographically-verified visitor identity.
    anonId = verifiedId;
    // req.anonIpKey is intentionally NOT set for returning visitors: the
    // per-cookie quota is sufficient, and charging the shared IP bucket on
    // every cache hit would exhaust that bucket for other users on the same
    // NATed network (carrier, office, café, school) without any abuse taking
    // place.  The IP guardrail is only needed to stop cookie-churn attacks,
    // i.e. requests where the caller has deliberately dropped their cookie so
    // as to mint a fresh identity with a full budget.  That only happens when
    // we actually mint a new cookie (the else branch below).
  } else {
    // New visitor (or tampered cookie) — mint a fresh UUID and set the cookie.
    anonId = randomUUID();
    const signed = signAnonId(anonId);
    const isProd = process.env.NODE_ENV === "production";
    const parts = [
      `${ANON_COOKIE}=${encodeURIComponent(signed)}`,
      "Path=/",
      `Max-Age=${ANON_COOKIE_MAX_AGE_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isProd) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));

    // Signal to downstream handlers that this is a brand-new anonymous
    // identity so they can apply the IP-level churn guard only for truly
    // new sessions, not for returning visitors with a valid cookie.
    req.anonCookieIsNew = true;
  }

  // Always set the secondary quota key (IP-based) for anonymous requests.
  // It is used as a churn-detection guardrail to prevent script-based
  // cookie-clearing attacks from bypassing per-session limits.
  const rawIp = req.ip ?? req.socket.remoteAddress;
  const normalizedIp = normaliseIp(rawIp);
  req.anonIpKey = `anon:ip:${normalizedIp}`;

  // Primary quota key: per-visitor cookie UUID.
  // Each browser session gets its own independent budget.
  req.userId = `anon:cookie:${anonId}`;

  next();
}
