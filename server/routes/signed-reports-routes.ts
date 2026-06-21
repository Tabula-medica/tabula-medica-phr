/**
 * H10 — Signed-report verify + public-key endpoints.
 *
 * These are PUBLIC (no auth). External auditors and patients verifying a
 * signed PDF/CSV they received out-of-band can hit these directly. Disclosing
 * the public key and a verify oracle is, by design, not sensitive.
 */

import { Router, type Request, type Response } from "express";
import { getReportSigner, type SignedEnvelope } from "../services/report-signer";

const router = Router();

// GET /api/reports/public-key — JWK and PEM for the current signing key.
router.get("/public-key", (_req: Request, res: Response) => {
  try {
    const signer = getReportSigner();
    res.json({
      keyId: signer.getKeyId(),
      jwk: signer.getPublicKeyJwk(),
      pem: signer.getPublicKeyPem(),
      algorithm: "ed25519",
      issuer: "tabula-medica",
    });
  } catch (err: unknown) {
    res.status(500).json({ error: "SIGNER_UNAVAILABLE", detail: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/reports/verify — body is a signed envelope; returns {valid, keyId, signedAt}.
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const env = req.body as SignedEnvelope<unknown>;
    if (!env || !env.signature || !env.payload) {
      return res.status(400).json({ error: "INVALID_ENVELOPE" });
    }
    const signer = getReportSigner();
    const valid = await signer.verify(env);
    res.json({
      valid,
      keyId: env.signature.keyId,
      currentKeyId: signer.getKeyId(),
      signedAt: env.signature.signedAt,
      keyIdMatches: env.signature.keyId === signer.getKeyId(),
    });
  } catch (err: unknown) {
    res.status(400).json({ error: "VERIFY_FAILED", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
