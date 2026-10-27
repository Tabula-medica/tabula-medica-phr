import { isIP } from "net";
import { promises as dnsPromises } from "dns";

const PRIVATE_IPV4_RANGES: Array<{ base: number; mask: number }> = [
  { base: 0x0a000000, mask: 0xff000000 },
  { base: 0xac100000, mask: 0xfff00000 },
  { base: 0xc0a80000, mask: 0xffff0000 },
  { base: 0x7f000000, mask: 0xff000000 },
  { base: 0xa9fe0000, mask: 0xffff0000 },
  { base: 0x64400000, mask: 0xffc00000 },
  { base: 0x00000000, mask: 0xff000000 },
  { base: 0xf0000000, mask: 0xf0000000 },
  { base: 0xe0000000, mask: 0xf0000000 },
  { base: 0xc0000200, mask: 0xffffff00 },
];

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(address: string): boolean {
  const ip = ipv4ToInt(address);
  if (ip === null) return false;
  return PRIVATE_IPV4_RANGES.some((r) => (ip & r.mask) >>> 0 === r.base >>> 0);
}

function hexGroupsToIPv4(hi: number, lo: number): string {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateIPv6(address: string): boolean {
  const lower = address.toLowerCase().replace(/^\[|\]$/g, "");

  if (lower === "::" || lower === "::1") return true;

  const ipv4MappedMatch = lower.match(/^::(?:ffff|ffff:0):([0-9a-f:.]+)$/);
  if (ipv4MappedMatch) {
    const v4part = ipv4MappedMatch[1];
    if (v4part.includes(".")) {
      if (isPrivateIPv4(v4part)) return true;
    } else if (v4part.includes(":")) {
      const hexParts = v4part.split(":");
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!isNaN(hi) && !isNaN(lo) && isPrivateIPv4(hexGroupsToIPv4(hi, lo))) return true;
      }
    } else {
      const val = parseInt(v4part, 16);
      if (!isNaN(val)) {
        const ip = `${(val >>> 24) & 0xff}.${(val >>> 16) & 0xff}.${(val >>> 8) & 0xff}.${val & 0xff}`;
        if (isPrivateIPv4(ip)) return true;
      }
    }
  }

  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("ff")) return true;

  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
]);

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

function checkIpAddress(hostname: string): UrlValidationResult {
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, error: "URL must not target a private or reserved IP address" };
    }
  } else if (ipVersion === 6) {
    if (isPrivateIPv6(hostname)) {
      return { valid: false, error: "URL must not target a private or reserved IP address" };
    }
  }
  return { valid: true };
}

function checkHostnameSyntax(rawUrl: string): { result: UrlValidationResult; hostname: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { result: { valid: false, error: "Invalid URL format" }, hostname: "" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { result: { valid: false, error: "URL must use http or https scheme" }, hostname: "" };
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname = rawHostname.startsWith("[") && rawHostname.endsWith("]")
    ? rawHostname.slice(1, -1)
    : rawHostname;

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { result: { valid: false, error: "URL hostname is not allowed" }, hostname };
  }

  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) {
    return { result: { valid: false, error: "URL hostname is not allowed" }, hostname };
  }

  const ipCheck = checkIpAddress(hostname);
  if (!ipCheck.valid) {
    return { result: ipCheck, hostname };
  }

  return { result: { valid: true }, hostname };
}

export function validateExternalUrlSync(rawUrl: string): UrlValidationResult {
  const { result } = checkHostnameSyntax(rawUrl);
  return result;
}

export async function validateExternalUrl(rawUrl: string): Promise<UrlValidationResult> {
  const { result, hostname } = checkHostnameSyntax(rawUrl);
  if (!result.valid) return result;

  if (isIP(hostname) !== 0) {
    return { valid: true };
  }

  try {
    const [v4Addresses, v6Addresses] = await Promise.allSettled([
      dnsPromises.resolve4(hostname),
      dnsPromises.resolve6(hostname),
    ]);

    const allAddresses: string[] = [];
    if (v4Addresses.status === "fulfilled") allAddresses.push(...v4Addresses.value);
    if (v6Addresses.status === "fulfilled") allAddresses.push(...v6Addresses.value);

    if (allAddresses.length === 0) {
      return { valid: false, error: "Hostname does not resolve to any address" };
    }

    for (const addr of allAddresses) {
      const check = checkIpAddress(addr);
      if (!check.valid) {
        return { valid: false, error: "URL hostname resolves to a private or reserved IP address" };
      }
    }
  } catch {
    return { valid: false, error: "Hostname DNS resolution failed" };
  }

  return { valid: true };
}

export async function validateSmartEndpoints(
  fhirBaseUrl: string,
  authorizationEndpoint: string,
  tokenEndpoint: string
): Promise<UrlValidationResult> {
  let fhirHost: string;
  try {
    fhirHost = new URL(fhirBaseUrl).hostname.toLowerCase();
  } catch {
    return { valid: false, error: "Invalid FHIR base URL" };
  }

  for (const [label, endpoint] of [
    ["authorization_endpoint", authorizationEndpoint],
    ["token_endpoint", tokenEndpoint],
  ] as const) {
    const asyncCheck = await validateExternalUrl(endpoint);
    if (!asyncCheck.valid) {
      return { valid: false, error: `SMART ${label} is not a safe URL: ${asyncCheck.error}` };
    }

    let endpointHost: string;
    try {
      endpointHost = new URL(endpoint).hostname.toLowerCase();
    } catch {
      return { valid: false, error: `SMART ${label} has invalid URL format` };
    }

    if (endpointHost !== fhirHost && !endpointHost.endsWith("." + fhirHost)) {
      return {
        valid: false,
        error: `SMART ${label} host (${endpointHost}) does not match FHIR base URL host (${fhirHost})`,
      };
    }
  }

  return { valid: true };
}
