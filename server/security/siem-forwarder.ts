/**
 * SIEM forwarder — ships PHI-free security events to an HTTP Event Collector
 * (HEC) compatible endpoint such as CrowdStrike Falcon Next-Gen SIEM
 * (Splunk-HEC wire format, `Authorization: Bearer <token>`).
 *
 * Why: CrowdStrike's 2026 Threat Hunting Report documents account takeover to
 * data exfiltration in under five minutes. Security signals that only land in
 * stdout / Cloud Logging cannot be correlated with endpoint or identity
 * telemetry fast enough to matter. This module fans every security event out
 * to the SIEM in near-real time so cross-domain detections can fire.
 *
 * Guarantees:
 *   - Disabled unless BOTH SIEM_HEC_URL and SIEM_HEC_TOKEN are set.
 *   - Strict field allowlist on the envelope; `details` is key-denylisted
 *     against the PHI column map and secret-like names, values truncated.
 *   - Never throws into request handling; failures are logged once and
 *     events are dropped (bounded queue) rather than retried in a storm.
 *   - No PHI is ever placed in the payload by construction — the forwarder
 *     is a security-telemetry channel, not an audit-log replica.
 */

import { PHI_FIELD_NAMES } from "./phi-column-map";

export type SiemRiskLevel = "low" | "medium" | "high" | "critical";

export interface SiemSecurityEvent {
  eventType: string;
  timestamp?: string;
  riskLevel?: SiemRiskLevel;
  /** Opaque actor identifier (internal user id or "anonymous"). Never an email. */
  actor?: string;
  ip?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  country?: string;
  details?: Record<string, unknown>;
}

export interface HecEnvelope {
  time: number;
  host: string;
  source: string;
  sourcetype: string;
  event: Record<string, unknown>;
}

export type SiemTransport = (url: string, token: string, body: string) => Promise<{ ok: boolean; status: number }>;

const ENVELOPE_FIELDS: ReadonlyArray<keyof SiemSecurityEvent> = [
  "eventType",
  "timestamp",
  "riskLevel",
  "actor",
  "ip",
  "requestId",
  "path",
  "method",
  "statusCode",
  "country",
];

const SECRET_LIKE_KEYS = new Set([
  "password", "passwd", "secret", "token", "accesstoken", "access_token", "refreshtoken", "refresh_token",
  "idtoken", "id_token", "authorization", "cookie", "apikey", "api_key", "key", "privatekey", "private_key",
  "sessionid", "session_id", "bearer", "creditcard", "credit_card", "cardnumber", "cvv",
]);

const PHI_KEYS_LOWER = new Set<string>(PHI_FIELD_NAMES.map((k) => k.toLowerCase()));

const MAX_STRING_LEN = 200;
const MAX_DETAIL_KEYS = 40;
const MAX_QUEUE = 1000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_FLUSH_MS = 2000;

/** True when the key names a PHI column or a secret-like field. */
export function isDeniedDetailKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (PHI_KEYS_LOWER.has(lower) || SECRET_LIKE_KEYS.has(lower)) return true;
  // Substring matches for compound names such as `patientEmail`, `authToken`.
  for (const s of ["email", "phone", "ssn", "password", "token", "secret", "dob", "birth", "mrn", "diagnos", "medication", "address"]) {
    if (lower.includes(s)) return true;
  }
  return false;
}

function scrubValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => (typeof v === "object" ? "[object]" : scrubValue(v)));
  }
  if (typeof value === "object") return "[object]";
  return String(value);
}

/**
 * Removes PHI / secret-bearing keys and truncates values. One level deep by
 * design: nested objects are collapsed to "[object]" so a nested patient
 * record can never ride along.
 */
export function scrubDetails(details: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!details || typeof details !== "object") return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(details)) {
    if (count >= MAX_DETAIL_KEYS) break;
    if (isDeniedDetailKey(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = scrubValue(value);
    }
    count++;
  }
  return out;
}

function toEpochSeconds(ts: string | undefined): number {
  const ms = ts ? Date.parse(ts) : NaN;
  return Number.isFinite(ms) ? ms / 1000 : Date.now() / 1000;
}

export function buildHecEnvelope(event: SiemSecurityEvent, opts?: { host?: string; source?: string; sourcetype?: string }): HecEnvelope {
  const picked: Record<string, unknown> = {};
  for (const f of ENVELOPE_FIELDS) {
    const v = event[f];
    if (v !== undefined && v !== null) picked[f] = typeof v === "string" ? scrubValue(v) : v;
  }
  if (!picked.timestamp) picked.timestamp = new Date().toISOString();
  if (!picked.riskLevel) picked.riskLevel = "medium";
  picked.details = scrubDetails(event.details);
  picked.app = "tabula-medica";
  picked.environment = process.env.NODE_ENV || "development";

  return {
    time: toEpochSeconds(picked.timestamp as string),
    host: opts?.host ?? process.env.SIEM_HOST_LABEL ?? process.env.K_SERVICE ?? "tabula-medica-web",
    source: opts?.source ?? "tabula-medica:security",
    sourcetype: opts?.sourcetype ?? "_json",
    event: picked,
  };
}

interface SiemConfig {
  url: string;
  token: string;
  batchSize: number;
  flushMs: number;
}

function readConfig(): SiemConfig | null {
  const url = process.env.SIEM_HEC_URL?.trim();
  const token = process.env.SIEM_HEC_TOKEN?.trim();
  if (!url || !token) return null;
  if (!/^https:\/\//i.test(url)) {
    warnOnce("SIEM_HEC_URL must be https:// — forwarder disabled");
    return null;
  }
  const batchSize = Math.max(1, Math.min(200, parseInt(process.env.SIEM_BATCH_SIZE || "", 10) || DEFAULT_BATCH_SIZE));
  const flushMs = Math.max(250, Math.min(30000, parseInt(process.env.SIEM_FLUSH_MS || "", 10) || DEFAULT_FLUSH_MS));
  return { url, token, batchSize, flushMs };
}

export function isSiemEnabled(): boolean {
  return readConfig() !== null;
}

const defaultTransport: SiemTransport = async (url, token, body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
};

let transport: SiemTransport = defaultTransport;
let queue: HecEnvelope[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let warned = new Set<string>();
let stats = { queued: 0, sent: 0, dropped: 0, failedBatches: 0 };

function warnOnce(msg: string): void {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(`[SIEM] ${msg}`);
}

function scheduleFlush(flushMs: number): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSiemQueue();
  }, flushMs);
  // Never keep the process alive just for telemetry.
  (flushTimer as any).unref?.();
}

/**
 * Enqueue a security event for the SIEM. Fire-and-forget; safe to call from
 * hot request paths. No-op when the forwarder is not configured.
 */
export function forwardSecurityEvent(event: SiemSecurityEvent): boolean {
  const cfg = readConfig();
  if (!cfg) return false;
  try {
    if (queue.length >= MAX_QUEUE) {
      stats.dropped++;
      warnOnce(`queue full (${MAX_QUEUE}) — dropping oldest security events`);
      queue.shift();
    }
    queue.push(buildHecEnvelope(event));
    stats.queued++;
    if (queue.length >= cfg.batchSize) {
      void flushSiemQueue();
    } else {
      scheduleFlush(cfg.flushMs);
    }
    return true;
  } catch (err: any) {
    warnOnce(`enqueue failed: ${err?.message?.slice(0, 100)}`);
    return false;
  }
}

/** Sends everything currently queued. Resolves when the batch is acknowledged or dropped. */
export async function flushSiemQueue(): Promise<void> {
  if (inflight) {
    await inflight;
  }
  const cfg = readConfig();
  if (!cfg || queue.length === 0) return;

  const batch = queue.splice(0, cfg.batchSize);
  // HEC accepts newline-delimited JSON envelopes in a single POST.
  const body = batch.map((e) => JSON.stringify(e)).join("\n");

  inflight = (async () => {
    try {
      const res = await transport(cfg.url, cfg.token, body);
      if (res.ok) {
        stats.sent += batch.length;
      } else {
        stats.failedBatches++;
        stats.dropped += batch.length;
        warnOnce(`HEC endpoint returned HTTP ${res.status} — events dropped (check SIEM_HEC_TOKEN / connector)`);
      }
    } catch (err: any) {
      stats.failedBatches++;
      stats.dropped += batch.length;
      warnOnce(`HEC delivery failed: ${err?.name === "AbortError" ? "timeout" : err?.message?.slice(0, 100)}`);
    } finally {
      inflight = null;
    }
  })();
  await inflight;

  if (queue.length > 0) scheduleFlush(cfg.flushMs);
}

export function getSiemStatus(): {
  enabled: boolean;
  endpointHost: string | null;
  queueDepth: number;
  queued: number;
  sent: number;
  dropped: number;
  failedBatches: number;
} {
  const cfg = readConfig();
  let endpointHost: string | null = null;
  if (cfg) {
    try { endpointHost = new URL(cfg.url).host; } catch { endpointHost = "invalid-url"; }
  }
  return { enabled: !!cfg, endpointHost, queueDepth: queue.length, ...stats };
}

/** Test seam: swap the HTTP transport. */
export function setSiemTransportForTest(t: SiemTransport | null): void {
  transport = t ?? defaultTransport;
}

/** Test seam: clear queue, timers, counters and once-warnings. */
export function resetSiemForTest(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  queue = [];
  inflight = null;
  warned = new Set();
  stats = { queued: 0, sent: 0, dropped: 0, failedBatches: 0 };
}
