import { logger } from "./logger";

/**
 * Lightweight ops/on-call alerting helper.
 *
 * Routes operational alerts to the team's existing alerting channel — the
 * Slack incoming webhook in `SLACK_WEBHOOK_URL` (already used by
 * `server/soc2-remediation-service.ts` and the CI deploy notifier; no new
 * secret is introduced). When the webhook is not configured the helper is a
 * safe no-op that only logs, so local/dev and BAA-restricted environments do
 * not fail.
 *
 * Designed to be fire-and-forget: it never throws and never rejects, so
 * callers on hot paths (e.g. the dedup comparison loop) can `void` it without
 * risking the request. Delivery failures degrade to a logged warning.
 */

export type OpsAlertSeverity = "info" | "warning" | "critical" | "resolved";

export interface OpsAlert {
  /** Short, human-readable alert title (no PHI/PII). */
  title: string;
  /** One-line description of the condition (no PHI/PII). */
  detail: string;
  severity: OpsAlertSeverity;
  /** Optional structured fields rendered as a Slack section (no PHI/PII). */
  fields?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * TEST-ONLY seam: the Slack webhook POST routes through this binding so tests
 * can inject a fake `fetch` (capture payload, simulate non-200/throw) without
 * a live webhook. Mirrors the `fetchImpl` seam in `server/utils/safe-fetch.ts`
 * and the `chatComplete` seam in `server/vertex-deduplication-service.ts`.
 * Production always uses the real global `fetch`.
 */
type FetchLike = (url: string, init: any) => Promise<{ ok: boolean; status: number }>;
let fetchImpl: FetchLike | null = null;

export function __setOpsAlertFetchImplForTesting(impl: FetchLike | null): void {
  fetchImpl = impl;
}

const SEVERITY_EMOJI: Record<OpsAlertSeverity, string> = {
  info: ":information_source:",
  warning: ":warning:",
  critical: ":rotating_light:",
  resolved: ":white_check_mark:",
};

/**
 * Send an operational alert to the configured Slack channel.
 *
 * Returns the delivery outcome so callers/tests can assert behaviour:
 *   - `"sent"`    — webhook accepted the message (HTTP 2xx)
 *   - `"failed"`  — webhook configured but delivery failed (logged)
 *   - `"skipped"` — no webhook configured (logged at info; no-op delivery)
 *
 * Never throws.
 */
export async function sendOpsAlert(
  alert: OpsAlert,
): Promise<"sent" | "failed" | "skipped"> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const channel = process.env.OPS_ALERT_SLACK_CHANNEL || "#engineering";

  if (!webhookUrl) {
    logger.warn(`[OpsAlert] ${alert.severity.toUpperCase()}: ${alert.title} (no SLACK_WEBHOOK_URL — alert not delivered)`, {
      detail: alert.detail,
      ...alert.fields,
    });
    return "skipped";
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: alert.title.slice(0, 150) },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: alert.detail },
    },
  ];

  if (alert.fields && Object.keys(alert.fields).length > 0) {
    blocks.push({
      type: "section",
      fields: Object.entries(alert.fields)
        .slice(0, 10)
        .map(([k, v]) => ({ type: "mrkdwn", text: `*${k}:*\n${v ?? "—"}` })),
    });
  }

  const payload = {
    channel,
    username: "Tabula Medica Ops Bot",
    icon_emoji: SEVERITY_EMOJI[alert.severity] || ":bell:",
    blocks,
  };

  const doFetch: FetchLike = fetchImpl || ((url, init) => fetch(url, init) as any);

  try {
    const response = await doFetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      logger.info(`[OpsAlert] Delivered to ${channel}: ${alert.title}`);
      return "sent";
    }
    logger.warn(`[OpsAlert] Slack webhook returned HTTP ${response.status} for: ${alert.title}`);
    return "failed";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[OpsAlert] Slack webhook delivery failed for: ${alert.title} (${msg})`);
    return "failed";
  }
}
