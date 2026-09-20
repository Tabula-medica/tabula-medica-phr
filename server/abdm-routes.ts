// ABDM (India) routes for the PHR — connection ops + ABHA enrollment. Uses the shared ABDM lib
// (server/abdm/*), mirrored from WorldEHR. Stub-by-default; real calls need ABDM_ENABLED + the PHR's
// own ABDM client creds + Mumbai-proxy egress. Sandbox only until a production BAA.
import { Router, type Request, type Response, type Express } from "express";
import { abdmConfig } from "./abdm/config";
import { getAbdmSession } from "./abdm/gateway";
import { requestAbhaOtp, enrolAbhaByOtp } from "./abdm/abha";

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
    // Never return the ABHA X-token to the client.
    res.json({ abhaNumber: p.abhaNumber, abhaAddress: p.abhaAddress, name: p.name, verified: p.verified, source: p.source });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

export function registerAbdmRoutes(app: Express): void {
  app.use("/api/abdm", router);
}
