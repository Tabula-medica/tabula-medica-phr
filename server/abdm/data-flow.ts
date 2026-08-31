// ABDM health-information data flow (India), HIU side.
//
// Once a consent artefact authorises a fetch (see `consent.ts`), the exchange runs:
//
//   HIU  → gateway : health-information request, carrying our half of the key material
//   gateway → HIU  : acknowledgement, then a transactionId on the callback
//   HIP  → HIU     : one or more pages of AES-GCM encrypted entries + the HIP's key material
//   HIU            : derives the shared key and decrypts (see `hi-crypto.ts`)
//
// The private key for a transfer exists only in this process, only between the request and the
// transfer, and is held against a correlation id. That gives the transfer endpoint its real
// security property: an inbound payload is only ever decrypted against a request WE made.
//
// STATE IS PROCESS-LOCAL AND IN-MEMORY. That is a deliberate, bounded choice, not an oversight:
//
//   * It fails CLOSED. A transfer arriving at an instance that does not hold the matching
//     exchange is REFUSED, never accepted-and-trusted. On a restart or a second instance the
//     failure is a rejected transfer, which is visible and safe — not silent acceptance of an
//     unverified payload, which would be neither.
//   * It must be replaced by shared durable storage before ABDM runs multi-instance in
//     production. Until then a single instance is a deployment requirement, not an assumption.
//
// Nothing here logs. Every field in flight is either a secret or PHI.
import { abdmConfig } from "./config";
import { abdmFetch } from "./fetch";
import { abdmHeaders, getAbdmToken } from "./gateway";
import type { ConsentEvaluation } from "./consent";
import {
  type AbdmKeyMaterial,
  decryptHealthInformation,
  deriveTransferSecret,
  generateKeyMaterial,
} from "./hi-crypto";

const ENDPOINTS = {
  hiRequest: "/api/hiecm/data-flow/v3/health-information/cm/request",
};

/** How long a pending exchange stays decryptable. A transfer arriving later is refused. */
const EXCHANGE_TTL_MS = 60 * 60 * 1000;

interface PendingExchange {
  requestId: string;
  transactionId: string | null;
  consentId: string;
  abhaAddress: string;
  hiTypes: string[];
  privateKeyPem: string;
  nonce: string;
  dateRange: { from: string; to: string };
  /** From the consent artefact: when data fetched under it must be deleted. */
  eraseAtMs: number | null;
  createdAtMs: number;
  expiresAtMs: number;
}

const byRequestId = new Map<string, PendingExchange>();
const byTransactionId = new Map<string, string>();

function sweep(nowMs: number): void {
  // Collect first, delete after: mutating during the walk is the classic way to skip entries,
  // and a skipped entry here is a private key that outlives its window.
  const expired: PendingExchange[] = [];
  byRequestId.forEach((ex) => {
    if (ex.expiresAtMs <= nowMs) expired.push(ex);
  });
  for (const ex of expired) {
    byRequestId.delete(ex.requestId);
    if (ex.transactionId) byTransactionId.delete(ex.transactionId);
  }
}

/** Test seam, mirroring `_resetAbdmTokenCache` / `_resetAbdmCertCache`. */
export function _resetHiExchanges(): void {
  byRequestId.clear();
  byTransactionId.clear();
}

export interface HiRequestInput {
  consentId: string;
  abhaAddress: string;
  hiTypes: string[];
  dateRange: { from: string; to: string };
}

export interface HiRequestAck {
  requestId: string;
  /** Present only when the gateway answered synchronously; otherwise it arrives on a callback. */
  transactionId: string | null;
  accepted: boolean;
  source: "stub" | "abdm";
  /**
   * The key material we published to the HIP. Public by construction — the DH public key and
   * nonce travel in the clear in every ABDM exchange. The matching private key is held inside
   * this module and is never returned.
   */
  keyMaterial: AbdmKeyMaterial;
}

/**
 * Request health information under an already-evaluated consent.
 *
 * Takes the `ConsentEvaluation` rather than re-deriving authorisation, so there is exactly one
 * place where "is this permitted" is decided. An unauthorised evaluation throws: this function
 * has no mode in which it fetches data the artefact did not permit.
 */
export async function requestHealthInformation(
  input: HiRequestInput,
  evaluation: ConsentEvaluation,
  nowMs: number,
): Promise<HiRequestAck> {
  if (!evaluation.authorised) {
    throw new Error(
      `consent does not authorise this request: ${evaluation.refusals.map((r) => r.code).join(", ")}`,
    );
  }
  sweep(nowMs);

  const ours = generateKeyMaterial(nowMs);
  const headers = abdmConfig.enabled ? abdmHeaders(nowMs, await getAbdmToken(nowMs)) : abdmHeaders(nowMs);
  const requestId = headers["REQUEST-ID"];

  const exchange: PendingExchange = {
    requestId,
    transactionId: null,
    consentId: input.consentId,
    abhaAddress: input.abhaAddress,
    hiTypes: input.hiTypes,
    privateKeyPem: ours.privateKeyPem,
    nonce: ours.nonce,
    dateRange: input.dateRange,
    eraseAtMs: evaluation.eraseAtMs,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + EXCHANGE_TTL_MS,
  };
  byRequestId.set(requestId, exchange);

  if (!abdmConfig.enabled) {
    return { requestId, transactionId: null, accepted: true, source: "stub", keyMaterial: ours.keyMaterial };
  }

  const body = {
    hiRequest: {
      consent: { id: input.consentId },
      dateRange: input.dateRange,
      dataPushUrl: abdmConfig.dataPushUrl,
      keyMaterial: ours.keyMaterial,
    },
  };
  const res = await abdmFetch(`${abdmConfig.baseUrl}${ENDPOINTS.hiRequest}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Do not keep a private key for an exchange the gateway rejected.
    byRequestId.delete(requestId);
    throw new Error(`ABDM health-information request failed: ${res.status}`);
  }
  const j = (await res.json().catch(() => ({}))) as { hiRequest?: { transactionId?: string } };
  const transactionId = j.hiRequest?.transactionId ?? null;
  if (transactionId) bindTransactionId(requestId, transactionId);
  return { requestId, transactionId, accepted: true, source: "abdm", keyMaterial: ours.keyMaterial };
}

/**
 * Attach the gateway-issued transactionId to a pending exchange. ABDM v3 answers the request
 * asynchronously, so this is normally called from the `on-request` callback.
 *
 * Refuses to rebind: a second transactionId for one request, or one transactionId claimed by a
 * second request, is a correlation collision and the safe reading is that something is wrong.
 */
export function bindTransactionId(requestId: string, transactionId: string): boolean {
  const exchange = byRequestId.get(requestId);
  if (!exchange) return false;
  if (exchange.transactionId && exchange.transactionId !== transactionId) return false;
  const existing = byTransactionId.get(transactionId);
  if (existing && existing !== requestId) return false;
  exchange.transactionId = transactionId;
  byTransactionId.set(transactionId, requestId);
  return true;
}

export interface TransferEntry {
  content?: string;
  media?: string;
  checksum?: string;
  careContextReference?: string;
}

export interface TransferBody {
  transactionId?: string;
  pageNumber?: number;
  pageCount?: number;
  entries?: TransferEntry[];
  keyMaterial?: AbdmKeyMaterial;
}

export interface TransferResult {
  transactionId: string;
  consentId: string;
  abhaAddress: string;
  pageNumber: number | null;
  pageCount: number | null;
  /** Decrypted FHIR bundles. Never logged, never persisted by this module. */
  entries: { careContextReference: string | null; content: string }[];
  /** Per-entry failures, so one bad entry does not discard a whole page. */
  failures: { index: number; reason: string }[];
  /** Deadline for deleting this data, from the consent artefact. */
  eraseAtMs: number | null;
}

export class TransferRefused extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "TransferRefused";
  }
}

/**
 * Accept and decrypt one page of an inbound transfer.
 *
 * Refuses — rather than decrypting — anything it cannot tie to a request this process made.
 * That correlation is what makes an endpoint the protocol requires to be publicly reachable
 * safe to expose: without a matching pending exchange there is no private key, so there is
 * nothing to decrypt with and no way for an unsolicited payload to enter the record.
 *
 * The per-entry `checksum` ABDM includes is not verified: AES-GCM already authenticates every
 * entry under a key only the two parties hold, which is a strictly stronger guarantee than an
 * unkeyed digest travelling beside the data it describes.
 */
export function acceptTransfer(body: TransferBody | null | undefined, nowMs: number): TransferResult {
  // Look up and check expiry BEFORE sweeping. Sweeping first would delete an expired exchange
  // and then report it as `unknown-transaction`, which sends whoever is debugging a real
  // integration looking for a correlation bug instead of a late transfer.
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId.trim() : "";
  if (!transactionId) throw new TransferRefused("missing-transaction-id", "transfer carries no transactionId");

  const requestId = byTransactionId.get(transactionId);
  const exchange = requestId ? byRequestId.get(requestId) : undefined;
  if (!exchange) {
    throw new TransferRefused(
      "unknown-transaction",
      "no pending health-information request matches this transactionId",
    );
  }
  if (exchange.expiresAtMs <= nowMs) {
    sweep(nowMs);
    throw new TransferRefused("exchange-expired", "the health-information request has expired");
  }
  sweep(nowMs);

  const peerKey = body?.keyMaterial?.dhPublicKey?.keyValue;
  const peerNonce = body?.keyMaterial?.nonce;
  if (!peerKey || !peerNonce) {
    throw new TransferRefused("missing-key-material", "transfer carries no usable keyMaterial");
  }

  let secret: { key: Buffer; iv: Buffer };
  try {
    secret = deriveTransferSecret({
      privateKeyPem: exchange.privateKeyPem,
      peerKeyValue: peerKey,
      ourNonce: exchange.nonce,
      peerNonce,
    });
  } catch (e) {
    throw new TransferRefused("key-derivation-failed", (e as Error).message);
  }

  const rawEntries = Array.isArray(body?.entries) ? body.entries : [];
  const entries: TransferResult["entries"] = [];
  const failures: TransferResult["failures"] = [];
  rawEntries.forEach((entry, index) => {
    if (typeof entry?.content !== "string" || !entry.content) {
      failures.push({ index, reason: "entry has no content" });
      return;
    }
    try {
      entries.push({
        careContextReference: entry.careContextReference ?? null,
        content: decryptHealthInformation(entry.content, secret),
      });
    } catch (e) {
      // The message is from our own crypto layer (auth-tag / length failures) and carries no
      // payload bytes, so it is safe to hand back.
      failures.push({ index, reason: (e as Error).message });
    }
  });

  return {
    transactionId,
    consentId: exchange.consentId,
    abhaAddress: exchange.abhaAddress,
    pageNumber: typeof body?.pageNumber === "number" ? body.pageNumber : null,
    pageCount: typeof body?.pageCount === "number" ? body.pageCount : null,
    entries,
    failures,
    eraseAtMs: exchange.eraseAtMs,
  };
}

/**
 * Drop a completed exchange, discarding its private key. Call once the final page has been
 * received; otherwise the TTL sweep collects it.
 */
export function completeHiExchange(transactionId: string): boolean {
  const requestId = byTransactionId.get(transactionId);
  if (!requestId) return false;
  byTransactionId.delete(transactionId);
  return byRequestId.delete(requestId);
}
