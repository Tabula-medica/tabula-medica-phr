/**
 * Email Service — thin wrapper around Resend for transactional and
 * operational alerts. PHI must never be passed in plain text; callers
 * are responsible for redacting before invoking sendEmail.
 *
 * Design:
 *   - Lazy-load the resend SDK so the app boots without the dep
 *     installed in dev environments.
 *   - When the SDK is absent, fall back to Resend's REST API over the
 *     runtime's global fetch. `resend` is not a declared dependency of
 *     this repo, so without this fallback every send silently no-ops
 *     even when RESEND_API_KEY is configured.
 *   - Fail closed on missing config: return false so callers can fall
 *     back to console-only alerting (matches prior NetworkHealth
 *     behavior).
 *   - Single shared client cached for the process lifetime.
 */

let cachedClient: any = null;
let cachedClientLoadFailed = false;

const FROM_DEFAULT =
  process.env.RESEND_FROM_EMAIL || "Tabula Medica Alerts <alerts@tabulamedica.health>";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Cap on the REST send so a stalled provider can't hang a request handler. */
const REST_TIMEOUT_MS = Number(process.env.RESEND_TIMEOUT_MS || 10_000);

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailResult {
  ok: boolean;
  reason?: "no-api-key" | "sdk-missing" | "send-failed";
  id?: string;
  error?: string;
  /** Which transport actually delivered (or attempted) the send. */
  transport?: "sdk" | "rest";
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

async function getResendClient(): Promise<any | null> {
  if (cachedClient) return cachedClient;
  if (cachedClientLoadFailed) return null;
  if (!process.env.RESEND_API_KEY) return null;
  try {
    const mod: any = await import("resend");
    const Resend = mod.Resend || mod.default?.Resend || mod.default;
    if (!Resend) {
      cachedClientLoadFailed = true;
      console.warn("[email-service] resend SDK loaded but Resend class not found");
      return null;
    }
    cachedClient = new Resend(process.env.RESEND_API_KEY);
    return cachedClient;
  } catch (err) {
    cachedClientLoadFailed = true;
    console.warn(
      "[email-service] resend SDK not installed — using the Resend REST API over fetch instead.",
    );
    return null;
  }
}

/**
 * Direct REST send. Used whenever the SDK is unavailable so a configured
 * RESEND_API_KEY always results in a real delivery attempt.
 */
async function sendViaRest(options: SendEmailOptions): Promise<EmailResult> {
  if (typeof fetch !== "function") {
    return { ok: false, reason: "sdk-missing", transport: "rest", error: "global fetch unavailable" };
  }
  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
      body: JSON.stringify({
        from: options.from || FROM_DEFAULT,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html,
        reply_to: options.replyTo,
        tags: options.tags,
      }),
    });

    const payload: any = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        reason: "send-failed",
        transport: "rest",
        error:
          payload?.message ||
          payload?.error?.message ||
          `Resend REST responded ${response.status}`,
      };
    }
    return { ok: true, id: payload?.id, transport: "rest" };
  } catch (err: any) {
    return {
      ok: false,
      reason: "send-failed",
      transport: "rest",
      error: err?.message || String(err),
    };
  }
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `[email-service] RESEND_API_KEY not set — dropping email "${options.subject}"`,
    );
    return { ok: false, reason: "no-api-key" };
  }

  const client = await getResendClient();
  if (!client) {
    return sendViaRest(options);
  }

  try {
    const result = await client.emails.send({
      from: options.from || FROM_DEFAULT,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      text: options.text,
      html: options.html,
      reply_to: options.replyTo,
      tags: options.tags,
    });
    if (result?.error) {
      return {
        ok: false,
        reason: "send-failed",
        transport: "sdk",
        error: String(result.error.message || result.error),
      };
    }
    return { ok: true, id: result?.data?.id, transport: "sdk" };
  } catch (err: any) {
    return {
      ok: false,
      reason: "send-failed",
      transport: "sdk",
      error: err?.message || String(err),
    };
  }
}
