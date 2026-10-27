/**
 * Mobile crash + error reporting (Audit H-7).
 *
 * Mirrors the PHI-scrubbing posture used by the api-server Sentry init:
 * we never send request bodies, never send raw URLs that may carry tokens
 * or patient identifiers as query params, and we strip common PHI/PII
 * field names from breadcrumbs and contexts before transport.
 *
 * DSN comes from EXPO_PUBLIC_SENTRY_DSN. When unset, init is a no-op so
 * dev builds and contributor checkouts work without configuration.
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const PHI_KEY_PATTERN =
  /(email|phone|ssn|dob|birth|mrn|patient|firstName|lastName|fullName|address|zip|postal|insurance|policy|authorization|token|password|secret)/i;

function scrubObject(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (typeof value === "string") {
    if (value.length > 500) return "[redacted:too-long]";
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => scrubObject(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PHI_KEY_PATTERN.test(k) ? "[redacted]" : scrubObject(v, depth + 1);
    }
    return out;
  }
  return value;
}

function stripUrl(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const dsn =
    (process.env.EXPO_PUBLIC_SENTRY_DSN as string | undefined) ||
    (typeof extra.sentryDsn === "string" ? extra.sentryDsn : undefined);
  if (!dsn) return;

  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    attachStacktrace: true,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, unknown>).authorization;
          delete (event.request.headers as Record<string, unknown>).cookie;
        }
        event.request.url = stripUrl(event.request.url) as string | undefined;
      }
      if (event.user) {
        // Keep only an opaque user id if present; drop email/username/IP.
        event.user = event.user.id ? { id: event.user.id } : undefined;
      }
      if (event.contexts) {
        event.contexts = scrubObject(event.contexts) as typeof event.contexts;
      }
      if (event.extra) {
        event.extra = scrubObject(event.extra) as typeof event.extra;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubObject(breadcrumb.data) as Record<string, unknown>;
      }
      if (breadcrumb.category === "http" && breadcrumb.data?.url) {
        breadcrumb.data.url = stripUrl(breadcrumb.data.url);
      }
      // Drop console breadcrumbs entirely — they often echo PHI strings.
      if (breadcrumb.category === "console") return null;
      return breadcrumb;
    },
  });

  initialized = true;
}
