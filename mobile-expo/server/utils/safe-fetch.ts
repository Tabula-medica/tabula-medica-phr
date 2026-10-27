import { promises as dnsPromises } from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import type { RequestInit as UndiciRequestInit } from "undici";

/**
 * Fetch implementation used by {@link safeFetch}. Defaults to undici's `fetch`.
 * TEST-ONLY seam: tests inject a fake to exercise redirect handling without
 * real network I/O. Production callers MUST NOT pass a custom implementation —
 * doing so bypasses the per-request IP-pinned undici dispatcher.
 */
export type SafeFetchImpl = (url: string, init: UndiciRequestInit) => Promise<Response>;

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

function isPrivateIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [o1, o2] = m.slice(1).map(Number);
  return (
    o1 === 10 ||
    o1 === 127 ||
    o1 === 0 ||
    o1 === 255 ||
    (o1 === 172 && o2 >= 16 && o2 <= 31) ||
    (o1 === 192 && o2 === 168) ||
    (o1 === 169 && o2 === 254) ||
    (o1 === 100 && o2 >= 64 && o2 <= 127)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const n = ip.toLowerCase();
  return (
    n === "::1" ||
    n.startsWith("::ffff:") ||
    n.startsWith("fe80") ||
    n.startsWith("fc") ||
    n.startsWith("fd")
  );
}

function assertAddressesArePublic(
  addresses: Array<{ address: string; family: number }>,
  fieldName: string,
): void {
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new SsrfBlockedError(`${fieldName} resolves to a disallowed network address`);
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new SsrfBlockedError(`${fieldName} resolves to a disallowed network address`);
    }
  }
}

export async function tryValidateExternalUrl(
  rawUrl: string,
  fieldName = "URL",
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    await validateExternalUrl(rawUrl, fieldName);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Resolves a hostname, validates every returned address against the private-IP
 * blocklist, and returns the first valid address to use as a pinned IP for
 * the actual connection. Throws SsrfBlockedError if any address is private or
 * if DNS resolution fails.
 */
async function resolveAndValidateHost(
  hostname: string,
  fieldName: string,
): Promise<{ address: string; family: number }> {
  const cleanHost = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (cleanHost === "localhost") {
    throw new SsrfBlockedError(`${fieldName} points to a disallowed network address`);
  }
  if (isPrivateIpv4(cleanHost) || isPrivateIpv6(cleanHost)) {
    throw new SsrfBlockedError(`${fieldName} points to a disallowed network address`);
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true });
  } catch {
    throw new SsrfBlockedError(`${fieldName} hostname could not be resolved`);
  }

  if (addresses.length === 0) {
    throw new SsrfBlockedError(`${fieldName} hostname could not be resolved`);
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new SsrfBlockedError(`${fieldName} resolves to a disallowed network address`);
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new SsrfBlockedError(`${fieldName} resolves to a disallowed network address`);
    }
  }

  return addresses[0];
}

export async function validateExternalUrl(rawUrl: string, fieldName = "URL"): Promise<void> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") {
    throw new SsrfBlockedError(`${fieldName} must use the HTTPS scheme`);
  }
  await resolveAndValidateHost(parsed.hostname, fieldName);
}

/**
 * Validates an external URL (HTTPS scheme + hostname-literal checks), resolves
 * its hostname, validates EVERY resolved address against the private-IP
 * blocklist, and returns the full list of validated addresses so the caller can
 * pin the connection to an inspected IP (closing the DNS-rebinding TOCTOU gap).
 * Throws SsrfBlockedError on any disallowed scheme, host, or address.
 */
export async function validateExternalUrlAndResolve(
  rawUrl: string,
  fieldName = "URL",
): Promise<Array<{ address: string; family: number }>> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") {
    throw new SsrfBlockedError(`${fieldName} must use the HTTPS scheme`);
  }

  const cleanHost = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (cleanHost === "localhost") {
    throw new SsrfBlockedError(`${fieldName} points to a disallowed network address`);
  }
  if (isPrivateIpv4(cleanHost) || isPrivateIpv6(cleanHost)) {
    throw new SsrfBlockedError(`${fieldName} points to a disallowed network address`);
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsPromises.lookup(parsed.hostname, { all: true });
  } catch {
    throw new SsrfBlockedError(`${fieldName} hostname could not be resolved`);
  }
  if (addresses.length === 0) {
    throw new SsrfBlockedError(`${fieldName} hostname could not be resolved`);
  }

  assertAddressesArePublic(addresses, fieldName);
  return addresses;
}

function isSameOrSubdomain(endpointHost: string, baseHost: string): boolean {
  const ep = endpointHost.toLowerCase();
  const base = baseHost.toLowerCase();
  return ep === base || ep.endsWith(`.${base}`);
}

export async function validateSmartEndpoints(
  fhirBaseUrl: string,
  authorizationEndpoint: string,
  tokenEndpoint: string
): Promise<{ valid: boolean; error?: string }> {
  // Host-affinity check runs first (pure URL parsing — no network I/O) so that
  // cross-host endpoint injection is rejected before any DNS resolution occurs.
  let fhirHost: string;
  try {
    fhirHost = new URL(fhirBaseUrl).hostname.toLowerCase();
  } catch {
    return { valid: false, error: "FHIR base URL is not a valid URL" };
  }

  let authHost: string;
  let tokenHost: string;
  try {
    authHost = new URL(authorizationEndpoint).hostname.toLowerCase();
    tokenHost = new URL(tokenEndpoint).hostname.toLowerCase();
  } catch {
    return { valid: false, error: "Authorization or token endpoint is not a valid URL" };
  }

  if (!isSameOrSubdomain(authHost, fhirHost)) {
    return {
      valid: false,
      error: `Authorization endpoint host (${authHost}) does not match FHIR base URL host (${fhirHost})`,
    };
  }
  if (!isSameOrSubdomain(tokenHost, fhirHost)) {
    return {
      valid: false,
      error: `Token endpoint host (${tokenHost}) does not match FHIR base URL host (${fhirHost})`,
    };
  }

  // Host affinity passed; now apply full SSRF validation (scheme + DNS check)
  // on each endpoint so DNS-rebinding and private-IP literals are also blocked.
  try {
    await validateExternalUrl(authorizationEndpoint, "Authorization endpoint");
    await validateExternalUrl(tokenEndpoint, "Token endpoint");
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * SSRF-safe fetch. For every hop (including redirects):
 *  1. Validates the URL (scheme + hostname literal checks).
 *  2. Resolves DNS and validates every returned address against the private-IP
 *     blocklist (same check as validateExternalUrl).
 *  3. Creates a per-request undici Agent whose `lookup` callback is locked to
 *     the validated IP so the TCP connection is always made to the address we
 *     inspected — preventing DNS rebinding between validation and connection.
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  maxRedirects = 5,
  fetchImpl?: SafeFetchImpl,
): Promise<Response> {
  const doFetch: SafeFetchImpl = fetchImpl ?? (undiciFetch as unknown as SafeFetchImpl);
  let currentUrl = url;
  let redirectsLeft = maxRedirects;

  while (true) {
    // Resolve DNS and validate in a single step, returning the addresses used for
    // validation. These addresses are then pinned into the dispatcher's lookup
    // function so that a DNS rebinding attack cannot substitute a private address
    // between the TOCTOU gap that existed when validate + fetch were two
    // separate operations with independent DNS lookups.
    const addresses = await validateExternalUrlAndResolve(currentUrl, "Request target");

    // Pick the first validated address to pin. Re-check inline so that an
    // unexpected result from the OS cache is still caught.
    const pinned = addresses[0];
    if (pinned.family === 4 && isPrivateIpv4(pinned.address)) {
      throw new SsrfBlockedError("Request target resolved to a disallowed network address");
    }
    if (pinned.family === 6 && isPrivateIpv6(pinned.address)) {
      throw new SsrfBlockedError("Request target resolved to a disallowed network address");
    }

    const pinnedAddress = pinned.address;
    const pinnedFamily: 4 | 6 = pinned.family === 6 ? 6 : 4;
    const dispatcher = new Agent({
      connect: {
        lookup: (
          _hostname: string,
          _options: unknown,
          callback: (err: Error | null, address: string, family: 4 | 6) => void,
        ) => {
          callback(null, pinnedAddress, pinnedFamily);
        },
      },
    });

    // Build undici's typed RequestInit by forwarding only the well-typed fields
    // from the caller's global RequestInit. The dispatcher field is undici-only
    // and added here without any cast. This avoids spreading an unrelated type
    // and keeps the type system honest about what we're sending.
    const undiciInit: UndiciRequestInit = {
      method: options.method,
      headers: options.headers,
      body: (options.body ?? undefined) as UndiciRequestInit["body"],
      signal: options.signal,
      credentials: options.credentials,
      mode: options.mode,
      referrer: options.referrer,
      referrerPolicy: options.referrerPolicy,
      integrity: options.integrity,
      keepalive: options.keepalive,
      redirect: "manual",
      dispatcher,
    };

    let response: Response;
    try {
      // Use the injected fetch (tests) or undici's fetch (default). undici's
      // Response is structurally compatible with the global Response callers
      // expect; the single boundary cast lives on the doFetch default above.
      response = await doFetch(currentUrl, undiciInit);
    } catch (err) {
      await dispatcher.close().catch(() => {});
      throw err;
    }

    if (response.status >= 300 && response.status < 400) {
      // Close the dispatcher before following the redirect; each hop gets its own
      // dispatcher pinned to the freshly validated IP for that hop's hostname.
      await dispatcher.close().catch(() => {});
      if (redirectsLeft <= 0) {
        throw new SsrfBlockedError("safeFetch: too many redirects");
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new SsrfBlockedError("safeFetch: redirect with no Location header");
      }
      currentUrl = new URL(location, currentUrl).toString();
      redirectsLeft--;
    } else {
      // Buffer the body fully before closing the dispatcher so the socket is
      // returned to the pool and then released without waiting for the caller to
      // consume the stream. All safeFetch callers in this codebase read the body
      // immediately (JSON.parse / .text()), so buffering does not change semantics.
      const body = await response.arrayBuffer();
      await dispatcher.close().catch(() => {});
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  }
}
