// ABDM (India) routes for the PHR — connection ops + ABHA enrollment. Uses the shared ABDM lib
// (server/abdm/*), mirrored from WorldEHR. Stub-by-default; real calls need ABDM_ENABLED + the PHR's
// own ABDM client creds + Mumbai-proxy egress. Sandbox only until a production BAA.
import express, { Router, type Request, type Response, type Express } from "express";
import { abdmConfig } from "./abdm/config";
import { getAbdmSession } from "./abdm/gateway";
import { requestAbhaOtp, enrolAbhaByOtp } from "./abdm/abha";
import {
  evaluateConsentArtefact,
  fetchConsentArtefact,
  getConsentRequestStatus,
  initConsentRequest,
  type ConsentExpectation,
} from "./abdm/consent";
import { acceptTransfer, requestHealthInformation, TransferRefused } from "./abdm/data-flow";
import { getLinkedAbhaAddress, linkAbhaAddress } from "./abdm/linkage";

const router = Router();

function getUser(req: Request): { id: string; role?: string } | undefined {
  const user = (req as any).user;
  if (user?.id) return { id: user.id, role: user.role || "patient" };
  const session = (req as any).session;
  if (session?.userId) return { id: session.userId, role: session.userRole || "patient" };
  return undefined;
}
function requireAuth(req: Request, res: Response, next: () => void) {
  if (!getUser(req)?.id) return res.status(401).json({ error: "Authentication required" });
  next();
}
function requireAdmin(req: Request, res: Response, next: () => void) {
  const u = getUser(req);
  if (!u?.id) return res.status(401).json({ error: "Authentication required" });
  if (u.role !== "admin") return res.status(403).json({ error: "Admin required" });
  next();
}

// GET /api/abdm/status — non-secret config visibility.
router.get("/status", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    enabled: abdmConfig.enabled,
    baseUrl: abdmConfig.baseUrl,
    cmId: abdmConfig.cmId,
    hasClientId: Boolean(abdmConfig.clientId),
    hasClientSecret: Boolean(abdmConfig.clientSecret),
  });
});

// GET /api/abdm/session-check — verify sandbox connectivity without exposing the token.
router.get("/session-check", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const s = await getAbdmSession(Date.now());
    res.json({ enabled: abdmConfig.enabled, connected: true, source: s.source, tokenType: s.tokenType, expiresIn: s.expiresIn });
  } catch (e) {
    res.status(502).json({ enabled: abdmConfig.enabled, connected: false, error: (e as Error).message });
  }
});

// POST /api/abdm/abha/request-otp — { value (Aadhaar/mobile), mode }. Any authenticated user.
router.post("/abha/request-otp", requireAuth, async (req: Request, res: Response) => {
  const value = String((req.body?.value ?? "")).trim();
  const mode = req.body?.mode === "mobile" ? "mobile" : "aadhaar";
  if (!value) return res.status(400).json({ error: "value (Aadhaar/mobile) is required" });
  try {
    res.json(await requestAbhaOtp({ value, mode }, Date.now()));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// POST /api/abdm/abha/verify — { txnId, otp, mobile? }. Creates the ABHA (sandbox OTP 123456).
router.post("/abha/verify", requireAuth, async (req: Request, res: Response) => {
  const txnId = String((req.body?.txnId ?? "")).trim();
  const otp = String((req.body?.otp ?? "")).trim();
  if (!txnId || !otp) return res.status(400).json({ error: "txnId and otp are required" });
  try {
    const p = await enrolAbhaByOtp({ txnId, otp, mobile: req.body?.mobile }, Date.now());
    // Link the ABHA address to this user, but ONLY on a verified enrollment. The stub path
    // returns an unverified demo profile; linking it would let any account claim that address
    // and, through it, any consent artefact issued for it. Consent routes read the address from
    // this link and never from a request body — see server/abdm/linkage.ts.
    let link: string | undefined;
    let linkError: string | undefined;
    if (p.verified && p.abhaAddress) {
      link = await linkAbhaAddress(getUser(req)!.id, p.abhaAddress, { abhaNumber: p.abhaNumber ?? null });
      if (link === "conflict") {
        // Enrollment succeeded, so this is not a 4xx — but the consent routes will refuse until
        // the linkage exists, and a bare enum in the payload is easy for a client to skip past.
        linkError = "This ABHA address is already linked to another account; consent features stay unavailable.";
      }
    }
    // Never return the ABHA X-token to the client.
    res.json({ abhaNumber: p.abhaNumber, abhaAddress: p.abhaAddress, name: p.name, verified: p.verified, source: p.source, link, linkError });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// ---------------------------------------------------------------------------------------------
// Consent + health-information data flow (PHR acting as an HIU).
//
// Every route below resolves the patient's ABHA address from the server-side link, never from
// the request. That is what makes the artefact's patient check meaningful: an address taken from
// the body would be compared against itself.
// ---------------------------------------------------------------------------------------------

/** Resolve the caller's linked ABHA address, or answer 409 with what they need to do first. */
async function requireLinkedAbha(req: Request, res: Response): Promise<string | null> {
  const abhaAddress = await getLinkedAbhaAddress(getUser(req)!.id);
  if (!abhaAddress) {
    res.status(409).json({ error: "No verified ABHA address is linked to this account. Complete ABHA enrollment first." });
    return null;
  }
  return abhaAddress;
}

/**
 * Normalise a value that may arrive as an array or, from a query string with a single
 * occurrence, as a bare string. Treating the bare string as "nothing supplied" would silently
 * ignore `?hiTypes=OPConsultation`.
 */
function asStringArray(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return items.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

// POST /api/abdm/consent/request — raise a consent request for the caller's own ABHA address.
router.post("/consent/request", requireAuth, async (req: Request, res: Response) => {
  const abhaAddress = await requireLinkedAbha(req, res);
  if (!abhaAddress) return;

  const hiTypes = asStringArray(req.body?.hiTypes);
  const from = String(req.body?.from ?? "").trim();
  const to = String(req.body?.to ?? "").trim();
  const dataEraseAt = String(req.body?.dataEraseAt ?? "").trim();
  if (hiTypes.length === 0) return res.status(400).json({ error: "hiTypes must be a non-empty array" });
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });
  if (!dataEraseAt) {
    // No default. `dataEraseAt` is the deletion deadline the patient is agreeing to; picking one
    // on their behalf is choosing how long their records are retained without asking.
    return res.status(400).json({ error: "dataEraseAt is required (the date fetched data must be deleted)" });
  }
  try {
    res.json(await initConsentRequest({ abhaAddress, hiTypes, dateRange: { from, to }, dataEraseAt }, Date.now()));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// GET /api/abdm/consent/request/:consentRequestId — lifecycle status + granted artefact ids.
router.get("/consent/request/:consentRequestId", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireLinkedAbha(req, res))) return;
  try {
    res.json(await getConsentRequestStatus(String(req.params.consentRequestId), Date.now()));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// GET /api/abdm/consent/:consentId — fetch an artefact and report what it authorises.
// Returns the EVALUATION, not the raw artefact: the useful answer is "may this be used, and if
// not, why not", and the refusal codes are what a client should branch on.
router.get("/consent/:consentId", requireAuth, async (req: Request, res: Response) => {
  const abhaAddress = await requireLinkedAbha(req, res);
  if (!abhaAddress) return;
  try {
    const { artefact, source } = await fetchConsentArtefact(String(req.params.consentId), Date.now());
    const requested = asStringArray(req.query.hiTypes);
    const hiTypes = requested.length > 0 ? requested : (artefact?.hiTypes ?? []);
    const evaluation = evaluateConsentArtefact(
      artefact,
      { abhaAddress, hiuId: abdmConfig.hiuId, hiTypes } satisfies ConsentExpectation,
      Date.now(),
    );
    res.json({ consentId: String(req.params.consentId), source, evaluation });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// POST /api/abdm/hi/request — request health information under a consent.
router.post("/hi/request", requireAuth, async (req: Request, res: Response) => {
  const abhaAddress = await requireLinkedAbha(req, res);
  if (!abhaAddress) return;

  const consentId = String(req.body?.consentId ?? "").trim();
  const hiTypes = asStringArray(req.body?.hiTypes);
  const from = String(req.body?.from ?? "").trim();
  const to = String(req.body?.to ?? "").trim();
  if (!consentId) return res.status(400).json({ error: "consentId is required" });
  if (hiTypes.length === 0) return res.status(400).json({ error: "hiTypes must be a non-empty array" });
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });

  try {
    const now = Date.now();
    const { artefact } = await fetchConsentArtefact(consentId, now);
    const evaluation = evaluateConsentArtefact(
      artefact,
      { abhaAddress, hiuId: abdmConfig.hiuId, hiTypes, dateRange: { from, to } },
      now,
    );
    if (!evaluation.authorised) {
      // 403 with the refusal codes: the request was understood and is not permitted.
      return res.status(403).json({ error: "consent does not authorise this request", evaluation });
    }
    const ack = await requestHealthInformation(
      { consentId, abhaAddress, hiTypes, dateRange: { from, to } },
      evaluation,
      now,
    );
    res.json({ ...ack, eraseAtMs: evaluation.eraseAtMs, caveats: evaluation.caveats });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/abdm/hi/transfer — the HIP data-push endpoint.
 *
 * Unauthenticated by protocol: HIPs push here with no credential of ours. Three things keep that
 * safe, and they are the reason this route exists at all:
 *
 *   1. It is MOUNTED ONLY WHEN ABDM IS ENABLED. In the default configuration — which is every
 *      current deployment — the path does not exist and adds no attack surface.
 *   2. A payload is only decrypted against a pending exchange THIS process created. With no
 *      match there is no private key, so an unsolicited payload cannot enter the record.
 *   3. Its own body limit, mounted ahead of the global JSON parser, so a transfer cannot be used
 *      to buy 10mb of parsing with no credential.
 */
const transferRouter = Router();
transferRouter.post(
  "/api/abdm/hi/transfer",
  express.json({ limit: process.env.ABDM_TRANSFER_BODY_LIMIT ?? "2mb" }),
  (req: Request, res: Response) => {
    try {
      const result = acceptTransfer(req.body, Date.now());
      // Acknowledge with counts only. Decrypted entries are PHI and are never echoed back to
      // the pusher, which has no claim to see what we successfully read.
      res.status(202).json({
        transactionId: result.transactionId,
        pageNumber: result.pageNumber,
        accepted: result.entries.length,
        failed: result.failures.length,
      });
    } catch (e) {
      if (e instanceof TransferRefused) return res.status(400).json({ error: e.code });
      res.status(400).json({ error: "transfer could not be processed" });
    }
  },
);

export function registerAbdmRoutes(app: Express): void {
  app.use("/api/abdm", router);
}

/**
 * Mount the HIP data-push route. Called from `server/index.ts` BEFORE the global JSON parser and
 * CSRF middleware, which is load-bearing in both directions:
 *
 *   * body-parser skips a request whose body is already parsed, so the stricter per-route limit
 *     only applies if this runs first;
 *   * a HIP pushing machine-to-machine has no CSRF token and never could, so this route must sit
 *     ahead of that middleware rather than be exempted from it after the fact.
 *
 * It stays behind the global rate limiter, and does not exist at all unless ABDM is enabled.
 */
export function registerAbdmTransferRoute(app: Express): void {
  if (!abdmConfig.enabled) return;
  app.use(transferRouter);
}
