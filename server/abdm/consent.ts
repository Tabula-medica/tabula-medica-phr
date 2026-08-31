// ABDM consent (India) for the PHR acting as a Health Information User (HIU).
//
// Two separate things live here, and the split is the point:
//
//   * The GATEWAY CLIENT (`initConsentRequest`, `getConsentRequestStatus`, `fetchConsentArtefact`)
//     — thin, stub-by-default, same shape as `abha.ts`.
//   * `evaluateConsentArtefact` — a PURE function that decides whether a given artefact
//     authorises a given fetch. This is the gate every data request must pass. It is pure so it
//     can be exhaustively tested without a network, and so the decision is reproducible from the
//     artefact alone.
//
// The governing rule throughout: an artefact authorises exactly what it says and nothing more.
// Every check refuses on absence. A field we cannot parse is a refusal, never a pass — an
// unreadable date range must not become "no restriction".
//
// VERIFY endpoint paths against the ABDM v3 HIECM sandbox docs (centralized in ENDPOINTS below).
//
// KNOWN LIMITATION — the artefact signature is NOT verified. ABDM signs consent artefacts, but
// this deployment has no pinned Consent Manager key and the exact detached-signature encoding is
// not settled here. Rather than ship a verifier that might pass everything, evaluation reports
// `issuerVerified: false` with a caveat: the artefact is trusted because it arrived over an
// authenticated TLS session with the gateway, NOT because its signature was checked. A caller
// that needs cryptographic issuer proof does not have it yet, and can see that it does not.
import { abdmConfig } from "./config";
import { abdmFetch } from "./fetch";
import { abdmHeaders, getAbdmToken } from "./gateway";

const ENDPOINTS = {
  requestInit: "/api/hiecm/consent/v3/request/init",
  requestStatus: "/api/hiecm/consent/v3/request/status",
  fetchArtefact: "/api/hiecm/consent/v3/fetch",
};

/** ABDM consent request / artefact lifecycle states. */
export type ConsentStatus = "REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED";

/** ABDM health-information types. A type absent from an artefact is not fetchable under it. */
export const HI_TYPES = [
  "OPConsultation",
  "Prescription",
  "DiagnosticReport",
  "DischargeSummary",
  "ImmunizationRecord",
  "HealthDocumentRecord",
  "WellnessRecord",
  "Invoice",
] as const;
export type HiType = (typeof HI_TYPES)[number];

/**
 * ABDM purpose codes. A PHR pulling the patient's own record is PATRQT ("self requested").
 * CAREMGT belongs to a treating provider and BTG is an emergency override — neither is a purpose
 * a personal health record can honestly assert on the patient's behalf, so the default
 * expectation below permits PATRQT only.
 */
export const PHR_PURPOSE_CODES = ["PATRQT"] as const;

export interface ConsentArtefact {
  consentId?: string;
  status?: string;
  createdAt?: string;
  purpose?: { text?: string; code?: string; refUri?: string };
  /** `patient.id` is the ABHA address (e.g. `someone@sbx`), not the 14-digit ABHA number. */
  patient?: { id?: string };
  hip?: { id?: string; name?: string };
  hiu?: { id?: string; name?: string };
  hiTypes?: string[];
  permission?: {
    accessMode?: string;
    dateRange?: { from?: string; to?: string };
    dataEraseAt?: string;
    frequency?: { unit?: string; value?: number; repeats?: number };
  };
  careContexts?: { patientReference?: string; careContextReference?: string }[];
}

/** What the caller intends to do. Evaluation answers: does the artefact permit exactly this? */
export interface ConsentExpectation {
  /** ABHA address of the authenticated user. Compared case-insensitively. */
  abhaAddress: string;
  /** Our own HIU id. An artefact granted to a different HIU is not ours to act on. */
  hiuId: string;
  /** Every HI type the caller intends to fetch. Each must be present in the artefact. */
  hiTypes: string[];
  /** Clinical window the caller intends to fetch. Must sit inside the consented range. */
  dateRange?: { from: string; to: string };
  /** Defaults to PHR_PURPOSE_CODES. */
  purposeCodes?: readonly string[];
}

/** Machine-readable refusal codes. Any refusal makes the evaluation unauthorised. */
export type ConsentRefusal =
  | "malformed-artefact"
  | "consent-not-granted"
  | "consent-erase-deadline-passed"
  | "patient-mismatch"
  | "hiu-mismatch"
  | "hi-type-not-consented"
  | "purpose-not-permitted"
  | "date-range-not-covered";

export interface ConsentEvaluation {
  authorised: boolean;
  refusals: { code: ConsentRefusal; detail: string }[];
  /** Always false today — see the KNOWN LIMITATION note at the top of this file. */
  issuerVerified: boolean;
  caveats: string[];
  /** The window the artefact actually permits, epoch ms. Null when it could not be parsed. */
  consentedWindow: { fromMs: number; toMs: number } | null;
  /** `permission.dataEraseAt` as epoch ms — the deadline for deleting data fetched under it. */
  eraseAtMs: number | null;
  /** HI types the artefact grants, normalised. */
  consentedHiTypes: string[];
}

function parseInstant(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Decide whether `artefact` authorises the fetch described by `expectation`.
 *
 * Pure: no clock, no network, no config. `nowMs` is passed in so expiry is testable and so two
 * calls in the same request cannot disagree about the time.
 */
export function evaluateConsentArtefact(
  artefact: ConsentArtefact | null | undefined,
  expectation: ConsentExpectation,
  nowMs: number,
): ConsentEvaluation {
  const refusals: ConsentEvaluation["refusals"] = [];
  const caveats = [
    "Consent artefact signature was not verified: this deployment pins no Consent Manager key. " +
      "The artefact is trusted only because it arrived over an authenticated session with the gateway.",
  ];

  if (!artefact || typeof artefact !== "object") {
    return {
      authorised: false,
      refusals: [{ code: "malformed-artefact", detail: "no artefact supplied" }],
      issuerVerified: false,
      caveats,
      consentedWindow: null,
      eraseAtMs: null,
      consentedHiTypes: [],
    };
  }

  // --- status -------------------------------------------------------------------------------
  const status = typeof artefact.status === "string" ? artefact.status.trim().toUpperCase() : "";
  if (status !== "GRANTED") {
    refusals.push({
      code: "consent-not-granted",
      detail: status ? `status is ${status}` : "artefact carries no status",
    });
  }

  // --- patient ------------------------------------------------------------------------------
  // The check that stops one user's request being served under another user's consent.
  const artefactPatient = artefact.patient?.id?.trim().toLowerCase() ?? "";
  const expectedPatient = expectation.abhaAddress.trim().toLowerCase();
  if (!artefactPatient || !expectedPatient) {
    refusals.push({ code: "patient-mismatch", detail: "artefact or request is missing an ABHA address" });
  } else if (artefactPatient !== expectedPatient) {
    refusals.push({ code: "patient-mismatch", detail: "artefact was granted for a different ABHA address" });
  }

  // --- HIU ----------------------------------------------------------------------------------
  const artefactHiu = artefact.hiu?.id?.trim() ?? "";
  const expectedHiu = expectation.hiuId.trim();
  if (!artefactHiu || !expectedHiu) {
    refusals.push({ code: "hiu-mismatch", detail: "artefact or configuration is missing an HIU id" });
  } else if (artefactHiu !== expectedHiu) {
    refusals.push({ code: "hiu-mismatch", detail: "artefact was granted to a different HIU" });
  }

  // --- purpose ------------------------------------------------------------------------------
  const permittedPurposes = expectation.purposeCodes ?? PHR_PURPOSE_CODES;
  const purpose = artefact.purpose?.code?.trim().toUpperCase() ?? "";
  if (!purpose || !permittedPurposes.some((p) => p.toUpperCase() === purpose)) {
    refusals.push({
      code: "purpose-not-permitted",
      detail: purpose
        ? `artefact purpose ${purpose} is not one of ${permittedPurposes.join(", ")}`
        : "artefact carries no purpose code",
    });
  }

  // --- HI types -----------------------------------------------------------------------------
  const consentedHiTypes = Array.isArray(artefact.hiTypes)
    ? artefact.hiTypes.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
    : [];
  const consentedLower = new Set(consentedHiTypes.map((t) => t.toLowerCase()));
  const requestedHiTypes = expectation.hiTypes.map((t) => t.trim()).filter(Boolean);
  if (requestedHiTypes.length === 0) {
    refusals.push({ code: "hi-type-not-consented", detail: "no HI types were requested" });
  }
  const missing = requestedHiTypes.filter((t) => !consentedLower.has(t.toLowerCase()));
  if (missing.length > 0) {
    // Refuse the whole request rather than quietly fetching the subset that is covered. A
    // partial result the caller did not ask for is indistinguishable from "the patient has no
    // records of that type".
    refusals.push({ code: "hi-type-not-consented", detail: `not consented: ${missing.join(", ")}` });
  }

  // --- erase deadline -----------------------------------------------------------------------
  // `dataEraseAt` is the HIU's obligation to delete, and past it the consent is spent.
  const eraseAtMs = parseInstant(artefact.permission?.dataEraseAt);
  if (eraseAtMs === null) {
    refusals.push({ code: "malformed-artefact", detail: "permission.dataEraseAt is missing or unparseable" });
  } else if (eraseAtMs <= nowMs) {
    refusals.push({ code: "consent-erase-deadline-passed", detail: "permission.dataEraseAt is in the past" });
  }

  // --- date range ---------------------------------------------------------------------------
  const fromMs = parseInstant(artefact.permission?.dateRange?.from);
  const toMs = parseInstant(artefact.permission?.dateRange?.to);
  let consentedWindow: ConsentEvaluation["consentedWindow"] = null;
  if (fromMs === null || toMs === null) {
    refusals.push({ code: "malformed-artefact", detail: "permission.dateRange is missing or unparseable" });
  } else if (fromMs > toMs) {
    refusals.push({ code: "malformed-artefact", detail: "permission.dateRange ends before it begins" });
  } else {
    consentedWindow = { fromMs, toMs };
    if (expectation.dateRange) {
      const wantFrom = parseInstant(expectation.dateRange.from);
      const wantTo = parseInstant(expectation.dateRange.to);
      if (wantFrom === null || wantTo === null) {
        refusals.push({ code: "date-range-not-covered", detail: "requested date range is unparseable" });
      } else if (wantFrom > wantTo) {
        refusals.push({ code: "date-range-not-covered", detail: "requested date range ends before it begins" });
      } else if (wantFrom < fromMs || wantTo > toMs) {
        // Deliberately a refusal, not a silent clamp. Narrowing the window without saying so
        // returns fewer records than the caller asked for, which reads to a patient as "you
        // have nothing from before that date". `clampToConsentWindow` makes narrowing explicit.
        refusals.push({
          code: "date-range-not-covered",
          detail:
            `requested ${new Date(wantFrom).toISOString()}..${new Date(wantTo).toISOString()} ` +
            `exceeds consented ${new Date(fromMs).toISOString()}..${new Date(toMs).toISOString()}`,
        });
      }
    }
  }

  return {
    authorised: refusals.length === 0,
    refusals,
    issuerVerified: false,
    caveats,
    consentedWindow,
    eraseAtMs,
    consentedHiTypes,
  };
}

/**
 * Intersect a desired window with what the consent permits. Separate from evaluation on purpose:
 * a caller that wants less data than it asked for has to say so, rather than getting it by
 * default. Returns null when the windows do not overlap at all.
 */
export function clampToConsentWindow(
  desired: { from: string; to: string },
  evaluation: ConsentEvaluation,
): { from: string; to: string } | null {
  if (!evaluation.consentedWindow) return null;
  const wantFrom = parseInstant(desired.from);
  const wantTo = parseInstant(desired.to);
  if (wantFrom === null || wantTo === null || wantFrom > wantTo) return null;
  const from = Math.max(wantFrom, evaluation.consentedWindow.fromMs);
  const to = Math.min(wantTo, evaluation.consentedWindow.toMs);
  if (from > to) return null;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

// ---------------------------------------------------------------------------------------------
// Gateway client. Stub-by-default, exactly like `abha.ts`: nothing here reaches the network
// until ABDM_ENABLED is set and credentials are provisioned.
// ---------------------------------------------------------------------------------------------

export interface ConsentRequestInput {
  abhaAddress: string;
  hiTypes: string[];
  dateRange: { from: string; to: string };
  dataEraseAt: string;
  purposeCode?: string;
}

export interface ConsentRequestAck {
  /** Correlation id we generated. ABDM v3 answers asynchronously on the HIU callback. */
  requestId: string;
  accepted: boolean;
  source: "stub" | "abdm";
}

export interface ConsentRequestState {
  status: ConsentStatus | string;
  consentArtefactIds: string[];
  source: "stub" | "abdm";
}

async function authedHeaders(nowMs: number) {
  return abdmHeaders(nowMs, await getAbdmToken(nowMs));
}

/**
 * Raise a consent request. ABDM v3 acknowledges with 202 and delivers the outcome on a callback,
 * so this returns the correlation id, never an artefact — a caller cannot mistake acceptance of
 * the request for the patient having granted anything.
 */
export async function initConsentRequest(input: ConsentRequestInput, nowMs: number): Promise<ConsentRequestAck> {
  if (!abdmConfig.enabled) {
    return { requestId: "stub-consent-request", accepted: true, source: "stub" };
  }
  const headers = await authedHeaders(nowMs);
  const body = {
    consent: {
      purpose: { text: "Self requested", code: input.purposeCode ?? PHR_PURPOSE_CODES[0] },
      patient: { id: input.abhaAddress },
      hiu: { id: abdmConfig.hiuId },
      requester: { name: abdmConfig.hiuName },
      hiTypes: input.hiTypes,
      permission: {
        accessMode: "VIEW",
        dateRange: { from: input.dateRange.from, to: input.dateRange.to },
        dataEraseAt: input.dataEraseAt,
        frequency: { unit: "HOUR", value: 1, repeats: 0 },
      },
    },
  };
  const res = await abdmFetch(`${abdmConfig.baseUrl}${ENDPOINTS.requestInit}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ABDM consent request failed: ${res.status}`);
  return { requestId: headers["REQUEST-ID"], accepted: true, source: "abdm" };
}

export async function getConsentRequestStatus(consentRequestId: string, nowMs: number): Promise<ConsentRequestState> {
  if (!abdmConfig.enabled) {
    return { status: "REQUESTED", consentArtefactIds: [], source: "stub" };
  }
  const res = await abdmFetch(`${abdmConfig.baseUrl}${ENDPOINTS.requestStatus}`, {
    method: "POST",
    headers: await authedHeaders(nowMs),
    body: JSON.stringify({ consentRequestId }),
  });
  if (!res.ok) throw new Error(`ABDM consent status failed: ${res.status}`);
  const j = (await res.json()) as {
    consentRequest?: { status?: string; consentArtefacts?: { id?: string }[] };
  };
  return {
    status: j.consentRequest?.status ?? "REQUESTED",
    consentArtefactIds: (j.consentRequest?.consentArtefacts ?? [])
      .map((a) => a?.id)
      .filter((id): id is string => typeof id === "string"),
    source: "abdm",
  };
}

export async function fetchConsentArtefact(
  consentId: string,
  nowMs: number,
): Promise<{ artefact: ConsentArtefact | null; source: "stub" | "abdm" }> {
  if (!abdmConfig.enabled) {
    return { artefact: null, source: "stub" };
  }
  const res = await abdmFetch(`${abdmConfig.baseUrl}${ENDPOINTS.fetchArtefact}`, {
    method: "POST",
    headers: await authedHeaders(nowMs),
    body: JSON.stringify({ consentId }),
  });
  if (!res.ok) throw new Error(`ABDM consent fetch failed: ${res.status}`);
  const j = (await res.json()) as { consent?: { consentDetail?: ConsentArtefact; status?: string } };
  const detail = j.consent?.consentDetail ?? null;
  // The lifecycle status travels beside the artefact rather than inside it; fold it in so
  // evaluation sees one object, and never let a fetched artefact arrive status-less.
  return {
    artefact: detail ? { ...detail, status: detail.status ?? j.consent?.status } : null,
    source: "abdm",
  };
}
