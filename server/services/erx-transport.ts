/**
 * Outbound transport for NCPDP SCRIPT messages.
 *
 * Two implementations:
 *   - `SurescriptsHttpTransport` posts to a configured gateway endpoint. This is
 *     the real path and is only selected when credentials are present.
 *   - `QueuedErxTransport` is the default when no gateway is configured. It does
 *     NOT pretend the message was delivered: it returns `queued`, leaving the
 *     request in a state that makes it obvious nothing reached a pharmacy.
 *
 * That distinction matters clinically. A simulated transport that reported
 * "acknowledged" would tell a prescriber a prescription had been cancelled when
 * the pharmacy had never heard of it.
 */

import { logger } from "../lib/logger";
import { hashPayload, type ScriptCancelRxMessage } from "./erx-script-messages";

export type ErxTransportOutcome = "sent" | "queued" | "rejected" | "error";

export interface ErxTransportResult {
  outcome: ErxTransportOutcome;
  /** Network-assigned tracking id, when the gateway returns one. */
  networkMessageId?: string;
  /** Immediate response status, when the gateway answers synchronously. */
  responseStatus?: string;
  responseCode?: string;
  responseText?: string;
  /** Machine-readable error class, matched against RETRYABLE_TRANSPORT_ERRORS. */
  errorKind?: string;
  errorMessage?: string;
}

export interface ErxTransport {
  readonly name: string;
  /** True when the transport can actually reach a pharmacy network. */
  readonly isLive: boolean;
  send(message: ScriptCancelRxMessage): Promise<ErxTransportResult>;
}

export interface SurescriptsConfig {
  endpoint: string;
  accountId: string;
  apiKey: string;
  senderId: string;
  senderName?: string;
  scriptVersion?: string;
  timeoutMs: number;
}

/** Read gateway configuration from the environment; null when incomplete. */
export function readSurescriptsConfig(env: NodeJS.ProcessEnv = process.env): SurescriptsConfig | null {
  const endpoint = env.SURESCRIPTS_ERX_ENDPOINT;
  const accountId = env.SURESCRIPTS_ACCOUNT_ID;
  const apiKey = env.SURESCRIPTS_API_KEY;
  const senderId = env.SURESCRIPTS_SENDER_ID;

  if (!endpoint || !accountId || !apiKey || !senderId) return null;

  const timeoutMs = Number.parseInt(env.SURESCRIPTS_TIMEOUT_MS ?? "", 10);
  return {
    endpoint,
    accountId,
    apiKey,
    senderId,
    senderName: env.SURESCRIPTS_SENDER_NAME,
    scriptVersion: env.SURESCRIPTS_SCRIPT_VERSION,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20_000,
  };
}

/** Map an HTTP status onto a retry classification. */
export function classifyHttpFailure(status: number): { errorKind: string; retryable: boolean } {
  if (status === 408 || status === 429) {
    return { errorKind: status === 429 ? "rate_limited" : "timeout", retryable: true };
  }
  if (status >= 500) return { errorKind: "service_unavailable", retryable: true };
  if (status === 401 || status === 403) return { errorKind: "unauthorized", retryable: false };
  return { errorKind: "rejected", retryable: false };
}

export class SurescriptsHttpTransport implements ErxTransport {
  readonly name = "surescripts";
  readonly isLive = true;

  constructor(private readonly config: SurescriptsConfig) {}

  async send(message: ScriptCancelRxMessage): Promise<ErxTransportResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-Account-Id": this.config.accountId,
          "X-NCPDP-Message-Type": "CancelRx",
          "X-Idempotency-Key": message.header.messageId,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      if (!response.ok) {
        const { errorKind } = classifyHttpFailure(response.status);
        const detail = await response.text().catch(() => "");
        logger.warn(
          {
            component: "ErxTransport",
            status: response.status,
            errorKind,
            payloadHash: hashPayload(message),
          },
          "CancelRx transmission rejected by gateway",
        );
        return {
          outcome: errorKind === "rejected" || errorKind === "unauthorized" ? "rejected" : "error",
          errorKind,
          // Truncated: gateway error bodies can echo prescription content back.
          errorMessage: `Gateway responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        };
      }

      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        outcome: "sent",
        networkMessageId: typeof body.messageId === "string" ? body.messageId : undefined,
        responseStatus: typeof body.status === "string" ? body.status : undefined,
        responseCode: typeof body.code === "string" ? body.code : undefined,
        responseText: typeof body.description === "string" ? body.description : undefined,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      logger.error(
        { component: "ErxTransport", err: error, payloadHash: hashPayload(message) },
        "CancelRx transmission failed",
      );
      return {
        outcome: "error",
        errorKind: aborted ? "timeout" : "network_error",
        errorMessage: error instanceof Error ? error.message : "Unknown transport error",
      };
    }
  }
}

/**
 * Fallback transport. Records the message and reports `queued` so the request
 * stays visibly undelivered until a real gateway is configured.
 */
export class QueuedErxTransport implements ErxTransport {
  readonly name = "queued_no_gateway";
  readonly isLive = false;

  async send(message: ScriptCancelRxMessage): Promise<ErxTransportResult> {
    logger.warn(
      {
        component: "ErxTransport",
        messageId: message.header.messageId,
        payloadHash: hashPayload(message),
      },
      "No eRx gateway configured — CancelRx held in queue, not transmitted",
    );
    return {
      outcome: "queued",
      responseText:
        "No eRx gateway configured. The cancellation is queued and has NOT been sent to the pharmacy.",
    };
  }
}

let cachedTransport: ErxTransport | null = null;

/** Resolve the active transport, memoised per process. */
export function getErxTransport(): ErxTransport {
  if (cachedTransport) return cachedTransport;
  const config = readSurescriptsConfig();
  cachedTransport = config ? new SurescriptsHttpTransport(config) : new QueuedErxTransport();
  return cachedTransport;
}

/** Test seam — lets specs and the admin health check swap the transport. */
export function setErxTransport(transport: ErxTransport | null): void {
  cachedTransport = transport;
}
