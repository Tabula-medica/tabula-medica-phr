/**
 * Email Service — thin wrapper around Resend for transactional and
 * operational alerts. PHI must never be passed in plain text; callers
 * are responsible for redacting before invoking sendEmail.
 *
 * Design:
 *   - Lazy-load the resend SDK so the app boots without the dep
 *     installed in dev environments.
 *   - Fail closed on missing config: return false so callers can fall
 *     back to console-only alerting (matches prior NetworkHealth
 *     behavior).
 *   - Single shared client cached for the process lifetime.
 */

let cachedClient: any = null;
let cachedClientLoadFailed = false;

const FROM_DEFAULT =
  process.env.RESEND_FROM_EMAIL || "Tabula Medica Alerts <alerts@tabulamedica.health>";

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
      "[email-service] resend SDK not installed — email sending disabled. Run `npm install resend` to enable.",
    );
    return null;
  }
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: "no-api-key" };
  }

  const client = await getResendClient();
  if (!client) {
    return { ok: false, reason: "sdk-missing" };
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
      return { ok: false, reason: "send-failed", error: String(result.error.message || result.error) };
    }
    return { ok: true, id: result?.data?.id };
  } catch (err: any) {
    return { ok: false, reason: "send-failed", error: err?.message || String(err) };
  }
}

/**
 * Transactional welcome email, sent on first sign-in (new user provisioning).
 * Fail-safe + non-blocking: returns {ok:false} when Resend isn't configured, so
 * callers can fire-and-forget without gating the auth flow. Contains no PHI —
 * only the user's own name + email.
 */
export async function sendWelcomeEmail(to: string, name?: string): Promise<EmailResult> {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const subject = "Welcome to Tabula Medica";
  const text =
    `Hi ${first},\n\n` +
    `Welcome to Tabula Medica — your personal health record.\n\n` +
    `You can now add your health records, connect your providers, and manage ` +
    `your family's care in one secure place.\n\n` +
    `— The Tabula Medica team`;
  const html =
    `<p>Hi ${first},</p>` +
    `<p>Welcome to <strong>Tabula Medica</strong> — your personal health record.</p>` +
    `<p>You can now add your health records, connect your providers, and manage ` +
    `your family's care in one secure place.</p>` +
    `<p>— The Tabula Medica team</p>`;
  return sendEmail({ to, subject, text, html, tags: [{ name: "type", value: "welcome" }] });
}
