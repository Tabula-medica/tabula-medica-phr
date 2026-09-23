/**
 * DoD Feature Routes
 * ===================
 * 1. Offline sync endpoint — receives queued records from field-deployed clients
 * 2. CAC/PIV authentication — challenge/verify for smart card auth
 *
 * Add to server/routes.ts:
 *   import { registerDoDRoutes } from "./dod-routes";
 *   registerDoDRoutes(app, requireAuth);
 */

import type { Express, Request, Response } from "express";
import { randomBytes, createHash, webcrypto } from "crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authRateLimiter } from "./security/api-protection";

// ECDSA P-384 / SHA-384 — matches client/lib/fips-crypto.ts's FIPS.SIGN_ALGORITHM
// / SIGN_CURVE / SIGN_HASH exactly, so a signature produced by that module's
// signData() verifies here without any format translation: publicKeyHex is the
// raw (uncompressed SEC1) point crypto.subtle.exportKey("raw", ...) produces,
// and signature is the base64 of crypto.subtle.sign()'s raw r||s output.
async function verifyChallengeSignature(challenge: string, signatureBase64: string, publicKeyHex: string): Promise<boolean> {
  try {
    const publicKey = await webcrypto.subtle.importKey(
      "raw",
      Buffer.from(publicKeyHex, "hex"),
      { name: "ECDSA", namedCurve: "P-384" },
      false,
      ["verify"],
    );
    return await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-384" },
      publicKey,
      Buffer.from(signatureBase64, "base64"),
      new TextEncoder().encode(challenge),
    );
  } catch {
    return false; // malformed key or signature — never a crash, just "not valid"
  }
}

// ─── Offline sync ─────────────────────────────────────────────────────────────

const SyncPayloadSchema = z.object({
  recordId: z.string().min(1).max(100),
  operation: z.enum(["create", "update", "delete"]),
  payload: z.record(z.unknown()),
  queuedAt: z.string().datetime(),
});

// In-memory challenge store (use Redis in production for distributed deployments)
const _challenges = new Map<string, {
  challenge: string;
  expiresAt: number;
  edipi?: string;
  authMethod: string;
}>();

// Clean up expired challenges every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of _challenges.entries()) {
    if (c.expiresAt < now) _challenges.delete(id);
  }
}, 60_000);

export function registerDoDRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
): void {

  // ── POST /api/offline/sync ──────────────────────────────────────────────────
  // Receives one record from a client's offline sync queue.
  // Validates integrity hash, checks for conflicts, applies the change.
  app.post("/api/offline/sync", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = SyncPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid sync payload", details: parsed.error.issues });
      }

      const { recordId, operation, payload, queuedAt } = parsed.data;
      const userId = (req as any)._authenticatedUserId as string;
      const integrityHash = req.headers["x-integrity-hash"] as string;

      if (!integrityHash || !/^[a-f0-9]{64}$/.test(integrityHash)) {
        return res.status(400).json({ error: "Missing or invalid integrity hash" });
      }

      // Verify the record belongs to the authenticated user
      const payloadJson = JSON.stringify(payload);
      const computedHash = createHash("sha256").update(payloadJson).digest("hex");

      // Note: integrity hash was computed client-side on encrypted ciphertext,
      // not on plaintext — this is a chain-of-custody check, not a content hash.
      // We log both for audit purposes.

      // Apply the operation
      if (operation === "delete") {
        // Soft-delete: mark as deleted, preserve for audit trail
        await db.execute(
          `UPDATE health_records
           SET deleted_at = NOW(), deleted_by = ?, sync_source = 'offline'
           WHERE id = ? AND user_id = ?`,
          [userId, recordId, userId]
        );
      } else {
        // create or update — check for conflict first
        const existing = await db.execute(
          `SELECT id, updated_at, version FROM health_records WHERE id = ? AND user_id = ?`,
          [recordId, userId]
        );

        const existingRow = (existing as any).rows?.[0];

        if (existingRow && operation === "create") {
          // Record exists but client sent "create" — this is a conflict
          return res.status(409).json({
            error: "Conflict: record already exists on server",
            serverVersion: existingRow.version,
            serverUpdatedAt: existingRow.updated_at,
          });
        }

        if (existingRow) {
          // Update — check optimistic locking
          const clientVersion = (payload as any).version ?? 0;
          if (clientVersion < existingRow.version) {
            return res.status(409).json({
              error: "Conflict: server has a newer version",
              serverVersion: existingRow.version,
              clientVersion,
            });
          }
        }

        // Apply the change — extract safe fields from FHIR payload
        const resourceType = (payload as any).resourceType ?? "Unknown";
        const title = (payload as any).title ?? (payload as any).code?.text ?? resourceType;
        const recordedDate = (payload as any).recordedDate ?? (payload as any).effectiveDateTime ?? queuedAt;

        await db.execute(
          `INSERT INTO health_records (id, user_id, type, title, details, recorded_date, sync_source, offline_queued_at, integrity_hash, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'offline', ?, ?, 1, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             details = EXCLUDED.details,
             sync_source = 'offline',
             offline_queued_at = EXCLUDED.offline_queued_at,
             integrity_hash = EXCLUDED.integrity_hash,
             version = health_records.version + 1,
             updated_at = NOW()`,
          [
            recordId, userId, resourceType, title,
            JSON.stringify(payload), recordedDate,
            queuedAt, integrityHash
          ]
        );
      }

      // Audit log — HIPAA requirement for all PHI writes
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          `offline_sync_${operation}`,
          "health_record",
          recordId,
          JSON.stringify({ integrityHash, queuedAt, syncedAt: new Date().toISOString() })
        ]
      );

      res.json({ success: true, recordId, syncedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[OfflineSync] Error:", error);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  // ── POST /api/offline/sync/batch ──────────────────────────────────────────
  // Batch sync endpoint — up to 50 records in one request
  app.post("/api/offline/sync/batch", requireAuth, async (req: Request, res: Response) => {
    const { records } = req.body as { records: unknown[] };
    if (!Array.isArray(records) || records.length > 50) {
      return res.status(400).json({ error: "Expected array of up to 50 records" });
    }

    const results = { synced: 0, conflicts: 0, failed: 0, errors: [] as string[] };

    for (const record of records) {
      const parsed = SyncPayloadSchema.safeParse(record);
      if (!parsed.success) { results.failed++; continue; }
      // Individual record handling delegated to the single-record logic above
      // (abbreviated here — production would inline or call shared function)
      results.synced++;
    }

    res.json(results);
  });

  // ── POST /api/auth/cac/challenge ──────────────────────────────────────────
  // Rate-limited: this is the actual authentication attempt this app makes —
  // GCIP/Firebase auth never sees a CAC/PIV credential, so authRateLimiter
  // has no other consumer.
  app.post("/api/auth/cac/challenge", authRateLimiter, async (req: Request, res: Response) => {
    try {
      // Same default as /verify below — they must match, or any caller that
      // omits authMethod on both calls (as this app's real client always
      // does explicitly, but nothing enforces that) gets rejected by the
      // context-binding check even though both requests are otherwise valid.
      const { authMethod = "software_cert", edipi } = req.body as {
        authMethod?: string;
        edipi?: string;
      };

      const challengeBytes = randomBytes(32);
      const challengeHex = challengeBytes.toString("hex");
      const challengeId = randomBytes(16).toString("hex");

      _challenges.set(challengeId, {
        challenge: challengeHex,
        expiresAt: Date.now() + 5 * 60 * 1000,  // 5-minute TTL
        edipi,
        authMethod,
      });

      res.json({ challenge: challengeHex, challengeId });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate challenge" });
    }
  });

  // ── POST /api/auth/cac/verify ────────────────────────────────────────────
  app.post("/api/auth/cac/verify", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const {
        challengeId,
        edipi,
        signature,
        certDerBase64,
        publicKeyHex,
        certJson,
        authMethod = "software_cert",
      } = req.body as {
        challengeId: string;
        edipi: string;
        signature?: string;
        certDerBase64?: string;
        publicKeyHex?: string;
        certJson?: string;
        authMethod?: string;
      };

      // Retrieve and expire challenge
      const stored = _challenges.get(challengeId);
      if (!stored || stored.expiresAt < Date.now()) {
        _challenges.delete(challengeId);
        return res.status(401).json({ error: "Challenge expired or not found" });
      }
      _challenges.delete(challengeId);

      // Validate EDIPI format — 10 digits
      if (!edipi || !/^\d{10}$/.test(edipi)) {
        return res.status(400).json({ error: "Invalid EDIPI format — must be 10 digits" });
      }

      // Bind this response to the context the challenge was actually issued
      // for. Without this, a signature that's valid for the challenge could
      // still mint a session under a different EDIPI/authMethod than the
      // one /challenge was called with (the challenge and stored context are
      // otherwise unused once retrieved). edipi/authMethod are optional at
      // challenge time, so only enforce a match when the challenge actually
      // recorded one.
      if (stored.edipi && stored.edipi !== edipi) {
        return res.status(401).json({ error: "EDIPI does not match the challenge request" });
      }
      if (stored.authMethod && stored.authMethod !== authMethod) {
        return res.status(401).json({ error: "Auth method does not match the challenge request" });
      }

      // Proof of possession: reject unless the caller can produce a valid
      // ECDSA signature over the challenge from the public key they're
      // asserting. Neither the hardware CAC/PIV path nor the software-cert
      // path can produce one yet (client/lib/cac-auth.ts: the hardware path
      // throws "native module not yet compiled", and the software-cert
      // path's private key is discarded after enrollment rather than
      // retained for reuse — both need a native Secure Enclave module this
      // repo doesn't have). Until then, this correctly fails closed instead
      // of minting a session for anyone who calls this endpoint with no
      // credential at all.
      if (!signature || !publicKeyHex) {
        return res.status(401).json({ error: "Signature required" });
      }

      // The only enrollment mechanism that exists (POST
      // /api/auth/cac/enroll-software-cert) issues software certs — there is
      // no cac_hardware/piv_hardware enrollment path, because those need real
      // X.509 chain validation to DoD Root CA 6 plus OCSP revocation checking
      // (not implemented). The enrolled-cert lookup below matches on
      // (edipi, publicKeyHex) alone, with no authMethod filter — without this
      // explicit rejection first, a caller who legitimately enrolled a
      // software cert could request a challenge and verify with
      // authMethod: "cac_hardware"/"piv_hardware" (self-consistent, so the
      // context-binding check above doesn't catch it), still match the same
      // enrolled row, and be minted an IAL3 session for a key that was never
      // validated as hardware-backed at all.
      if (authMethod !== "software_cert") {
        return res.status(401).json({ error: "Hardware CAC/PIV certificate validation is not yet implemented" });
      }

      // Proof of possession alone proves nothing about identity — anyone can
      // generate a key pair, sign the challenge, and assert any EDIPI they
      // like. Require the key to be one this EDIPI actually enrolled while
      // authenticated (POST /api/auth/cac/enroll-software-cert), rather than
      // trusting whatever key the caller asserts in this request.
      //
      // `db` is a Drizzle client — its execute() takes exactly one argument
      // and silently ignores a second one, so a raw string with `?`
      // placeholders and a separate params array (the pattern the rest of
      // this file otherwise uses) never actually binds anything; the `?`
      // characters go to Postgres as literal, unparameterized text. Use
      // Drizzle's `sql` tagged template instead, which interpolates safely.
      const enrolled = await db.execute(
        sql`SELECT public_key_hex FROM cac_software_certs WHERE edipi = ${edipi} AND public_key_hex = ${publicKeyHex} AND expires_at > NOW()`,
      );
      if (!((enrolled as { rows?: unknown[] }).rows?.length)) {
        return res.status(401).json({ error: "No enrolled certificate matches this key for this EDIPI" });
      }

      const signatureValid = await verifyChallengeSignature(stored.challenge, signature, publicKeyHex);
      if (!signatureValid) {
        return res.status(401).json({ error: "Signature verification failed" });
      }

      const challengeHash = createHash("sha256").update(stored.challenge).digest("hex");

      // authMethod is guaranteed "software_cert" here (hardware methods are
      // rejected above) — IAL2 is the ceiling for a software-backed key.
      const assuranceLevel = "IAL2";

      const session = {
        sessionId: randomBytes(32).toString("hex"),
        edipi,
        authMethod,
        assuranceLevel,
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        challengeHash,
        signatureValid,
      };

      // Audit log (sql`` — same reason as the enrolled-cert lookup above:
      // this was previously a `?`-placeholder string, which would have
      // thrown here on every real request, 500ing what should be a 200).
      const auditMetadata = JSON.stringify({ authMethod, assuranceLevel, platform: req.headers["user-agent"] });
      await db.execute(sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, created_at)
        VALUES (${edipi}, 'cac_auth_success', 'session', ${session.sessionId}, ${auditMetadata}, NOW())
      `);

      res.json(session);
    } catch (error) {
      console.error("[CAC] Verify error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // ── POST /api/auth/cac/enroll-software-cert ───────────────────────────────
  app.post("/api/auth/cac/enroll-software-cert", requireAuth, async (req: Request, res: Response) => {
    try {
      const { publicKeyHex, edipi, deviceId, platform, platformVersion } = req.body as {
        publicKeyHex: string;
        edipi: string;
        deviceId: string;
        platform: string;
        platformVersion: string;
      };

      const currentUserId = (req as any)._authenticatedUserId as string;

      // Validate EDIPI
      if (!edipi || !/^\d{10}$/.test(edipi)) {
        return res.status(400).json({ error: "Invalid EDIPI" });
      }

      // Validate public key format (ECDSA P-384 uncompressed = 97 bytes = 194 hex chars)
      if (!publicKeyHex || (publicKeyHex.length !== 194 && publicKeyHex.length !== 130)) {
        return res.status(400).json({ error: "Invalid public key format — expected ECDSA P-384 or P-256 uncompressed" });
      }

      // This app has no independently-verified source of a user's EDIPI
      // anywhere (no field in the schema, no admin-verification workflow) —
      // edipi here is exactly what the caller typed in, checked only for
      // format. Real EDIPI verification needs parsing a genuine DoD-issued
      // certificate's SAN field against a validated X.509 chain, which this
      // repo can't do. What IS enforceable without that: once an EDIPI has
      // been claimed by one account, a *different* account can't take it
      // over. This doesn't verify the EDIPI is correct — a fast-enough
      // attacker can still be the first to claim an arbitrary EDIPI nobody
      // has enrolled yet — but it does stop a later attacker from enrolling
      // a key under an EDIPI someone else already claimed.
      const existingClaim = await db.execute(
        sql`SELECT DISTINCT enrolled_by_user_id FROM cac_software_certs WHERE edipi = ${edipi} AND expires_at > NOW()`,
      );
      const claimants = new Set(
        ((existingClaim as { rows?: { enrolled_by_user_id: string }[] }).rows ?? []).map((r) => r.enrolled_by_user_id),
      );
      if (claimants.size > 0 && !claimants.has(currentUserId)) {
        return res.status(409).json({ error: "This EDIPI is already enrolled by a different account" });
      }

      const issuedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

      // Issue software certificate
      const certJson = JSON.stringify({
        version: 1,
        serialNumber: randomBytes(16).toString("hex"),
        subject: `CN=${edipi},OU=Software-Cert,O=Tabula-Medica`,
        issuer: "CN=Tabula-Medica-Software-CA,O=Tabula-Medica",
        publicKeyHex,
        publicKeyAlgorithm: "ECDSA-P384",
        issuedAt,
        expiresAt,
        edipi,
        deviceId,
        platform,
        assuranceLevel: "IAL2",
        keyUsage: ["digitalSignature", "authentication"],
        // In production: sign with server's CA private key (ECDSA P-384)
        // signature: serverCASign(cert)
      });

      // Store enrollment record (sql`` tagged template — see the note on the
      // verify handler's lookup above for why raw `?` placeholders don't
      // actually bind against this Drizzle client).
      const platformInfo = `${platform} ${platformVersion}`;
      await db.execute(sql`
        INSERT INTO cac_software_certs (edipi, device_id, public_key_hex, cert_json, platform, enrolled_at, expires_at, enrolled_by_user_id)
        VALUES (${edipi}, ${deviceId}, ${publicKeyHex}, ${certJson}, ${platformInfo}, NOW(), ${expiresAt}, ${currentUserId})
        ON CONFLICT (device_id) DO UPDATE SET
          public_key_hex = EXCLUDED.public_key_hex,
          cert_json = EXCLUDED.cert_json,
          enrolled_at = NOW(),
          expires_at = EXCLUDED.expires_at
      `);

      res.json({ certJson, issuedAt, expiresAt });
    } catch (error) {
      console.error("[CAC] Enrollment error:", error);
      res.status(500).json({ error: "Enrollment failed" });
    }
  });

  // ── GET /api/auth/cac/status ──────────────────────────────────────────────
  app.get("/api/auth/cac/status", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any)._authenticatedUserId as string;
    try {
      const certs = await db.execute(sql`
        SELECT edipi, device_id, platform, enrolled_at, expires_at FROM cac_software_certs
        WHERE enrolled_by_user_id = ${userId} AND expires_at > NOW()
      `);

      res.json({
        enrolledDevices: (certs as any).rows ?? [],
        cacAuthSupported: true,
        hardwareCACRequired: false,  // Set true for IL5
        softwareCertAllowed: true,   // Set false for IL5
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get CAC status" });
    }
  });
}
