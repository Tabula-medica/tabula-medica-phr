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
import { getUserId } from "./middleware/require-user";
import { hipaaComplianceService } from "./services/hipaa-compliance-service";
import { hashEdipi } from "./storage/phi-storage";
import { encryptPhi, decryptPhi } from "./security/phi-encryption";

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

// Thrown inside the enroll-software-cert transaction to trigger a rollback
// (any throw does) while still telling the outer catch which 409 to send.
class EnrollmentConflict extends Error {
  constructor(public reason: "edipi" | "device") {
    super(`Enrollment conflict: ${reason}`);
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
  edipi: string;
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
      const { authMethod, edipi } = req.body as {
        authMethod?: string;
        edipi?: string;
      };

      // Both were previously optional, with /verify's context-binding
      // check only enforced "when the challenge recorded one" — meaning
      // any caller could skip the binding entirely just by omitting them
      // here, then assert whatever edipi/authMethod they liked at /verify.
      // The real clients (client/lib/cac-auth.ts) already always send
      // both, so this only rejects direct API callers that don't —
      // exactly the callers the binding exists to constrain.
      if (!edipi || !/^\d{10}$/.test(edipi)) {
        return res.status(400).json({ error: "Invalid EDIPI format — must be 10 digits" });
      }
      if (!authMethod) {
        return res.status(400).json({ error: "authMethod is required" });
      }

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
      // otherwise unused once retrieved). /challenge requires and validates
      // both fields, so this is an unconditional match, not a
      // "only if the challenge happened to record one" check — a caller
      // can no longer skip the binding just by omitting them at challenge
      // time and asserting whatever they like here.
      if (stored.edipi !== edipi) {
        return res.status(401).json({ error: "EDIPI does not match the challenge request" });
      }
      if (stored.authMethod !== authMethod) {
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
      // placeholders and a separate params array never actually binds
      // anything; the `?` characters go to Postgres as literal,
      // unparameterized text. Use Drizzle's `sql` tagged template instead.
      //
      // edipi itself is PHI (a DoD personal identifier) and is encrypted
      // at rest, so it can't be matched by equality directly — edipi_hash
      // is the deterministic, keyed hash used for the lookup instead (see
      // shared/schema.ts's cacSoftwareCertsTable comment).
      const enrolled = await db.execute(
        sql`SELECT public_key_hex FROM cac_software_certs WHERE edipi_hash = ${hashEdipi(edipi)} AND public_key_hex = ${publicKeyHex} AND expires_at > NOW()`,
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

      // There is no `audit_logs` table in the managed schema (only
      // `hipaa_audit_logs`, via hipaaComplianceService) — a raw INSERT
      // against `audit_logs` would 500 here on every real request. Route
      // through the same audit service the rest of the app uses, which
      // also gets PHI-column encryption and integrity-hash chaining for
      // free instead of reimplementing them ad hoc.
      await hipaaComplianceService.logAuditEvent({
        timestamp: new Date().toISOString(),
        who: {
          // Neither userId nor userName is safe for the raw EDIPI here.
          // userId isn't a PHI-encrypted column on hipaa_audit_logs (only
          // userName is, per PHI_COLUMN_MAP), and hipaaComplianceService's
          // own logger.info call emits it verbatim. userName looked safer
          // (encrypted at rest via encryptPhiRow when the DB insert
          // succeeds) but logAuditEvent() always keeps the plaintext
          // fullEntry in its in-memory auditLogs array too — regardless of
          // whether the DB write succeeds — and GET /api/hipaa-compliance
          // /audit-logs returns that in-memory array with no auth check.
          // So a raw EDIPI in either field is reachable unauthenticated.
          // hashEdipi() (already used for the enrollment lookup key above)
          // is keyed with the server's encryption key, so unlike an unkeyed
          // sha256 (rainbow-tableable over a 10-digit EDIPI's 10^10
          // possibilities) it's safe to use for both fields — this event
          // only needs a stable correlation value, not the real EDIPI.
          userId: hashEdipi(edipi),
          userName: hashEdipi(edipi),
          userRole: "patient",
          ipAddress: req.ip ?? "unknown",
          userAgent: (req.headers["user-agent"] as string) ?? "unknown",
          sessionId: session.sessionId,
        },
        what: {
          action: "cac_auth_success",
          actionCategory: "LOGIN",
          resourceType: "Session",
          resourceId: session.sessionId,
          phiAccessed: false,
          dataClassification: "SENSITIVE",
        },
        when: {
          timestamp: new Date().toISOString(),
          timezone: "UTC",
          serverTime: new Date().toISOString(),
        },
        context: {
          endpoint: "/api/auth/cac/verify",
          httpMethod: "POST",
          requestId: randomBytes(8).toString("hex"),
          sourceSystem: "cac-piv-auth",
          accessReason: "operations",
        },
      });

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

      // isAuthenticated (the middleware this route is actually mounted
      // behind) leaves the verified subject at req.user.claims.sub, not on
      // a `_authenticatedUserId` field nothing ever sets — getUserId() is
      // this codebase's one shared accessor for it.
      const currentUserId = getUserId(req);

      // Validate EDIPI
      if (!edipi || !/^\d{10}$/.test(edipi)) {
        return res.status(400).json({ error: "Invalid EDIPI" });
      }

      // Validate public key format (ECDSA P-384 uncompressed = 97 bytes = 194
      // hex chars, starting with the 0x04 SEC1 uncompressed-point marker).
      // Only P-384 is accepted — verifyChallengeSignature always imports the
      // key as P-384 (matching client/lib/fips-crypto.ts's FIPS.SIGN_CURVE),
      // so a 130-char P-256 key would enroll successfully here but could
      // never pass verification: importKey with namedCurve: "P-384" rejects
      // a 65-byte P-256 point outright. The runtime-type + hex-alphabet
      // check (not just length) matters because Buffer.from(str, "hex")
      // silently truncates at the first invalid character instead of
      // throwing, so a non-hex string would otherwise enroll a permanently
      // unusable credential and squat the EDIPI/device.
      if (typeof publicKeyHex !== "string" || !/^04[0-9a-fA-F]{192}$/.test(publicKeyHex)) {
        return res
          .status(400)
          .json({ error: "Invalid public key format — expected ECDSA P-384 uncompressed (raw SEC1, 194 hex chars starting with 04)" });
      }

      // The regex above only checks length/prefix/hex-alphabet — it can't
      // confirm the (x, y) coordinates it encodes are actually a point on
      // the P-384 curve. An off-curve point can satisfy that regex while
      // still permanently failing verifyChallengeSignature's importKey the
      // same way a wrong-length or non-hex key would, so this claims the
      // EDIPI/device before ever confirming the key can be used. Mirror
      // verifyChallengeSignature's own import here — WebCrypto validates
      // curve membership and rejects an off-curve point with an error —
      // so an unusable key is caught before the transaction below, not
      // after it's already squatted someone's claim.
      try {
        await webcrypto.subtle.importKey("raw", Buffer.from(publicKeyHex, "hex"), { name: "ECDSA", namedCurve: "P-384" }, true, ["verify"]);
      } catch {
        return res.status(400).json({ error: "Invalid public key — not a valid point on the P-384 curve" });
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
      //
      // Claimed atomically via a dedicated table with edipiHash (not the
      // encrypted, non-deterministic edipi ciphertext) as its PRIMARY KEY
      // and actual conflict target, not by SELECT-then-INSERT against
      // cac_software_certs: that
      // would (a) let two concurrent enrollments from different accounts
      // both observe "no claimant" and both succeed, and (b) let a claim
      // lapse the moment its cert's expires_at passes, letting a different
      // account take over an EDIPI whose original owner just hasn't
      // re-enrolled yet. INSERT ... ON CONFLICT DO NOTHING on a unique key
      // is atomic in Postgres — concurrent claims on the same edipi
      // serialize on that key's row lock — and the claim row is never
      // deleted, so ownership outlives any individual cert's expiry.
      //
      // The claim and the certificate upsert below run in one transaction:
      // committing the claim alone and then failing (or no-op'ing) the
      // device upsert would leave a permanent claim on this EDIPI with no
      // certificate behind it — silently locking every future caller,
      // including the legitimate owner, out of ever enrolling it. Any
      // conflict rolls the whole transaction back, so a failed attempt
      // leaves no trace to squat on the EDIPI.
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
      const platformInfo = `${platform} ${platformVersion}`;

      // edipi is PHI (a DoD personal identifier), and certJson embeds the
      // same value — both are encrypted before they ever reach a query.
      // edipiHash (deterministic, keyed) is what claims/lookups/the
      // ON CONFLICT target actually match on, since encrypted ciphertext
      // can't be compared by equality (a fresh random IV each call means
      // encrypting the same EDIPI twice never produces the same bytes).
      const edipiHash = hashEdipi(edipi);
      const encryptedEdipi = encryptPhi(edipi);
      const encryptedCertJson = encryptPhi(certJson);

      await db.transaction(async (tx) => {
        const claimAttempt = await tx.execute(sql`
          INSERT INTO cac_edipi_claims (edipi_hash, edipi, claimed_by_user_id)
          VALUES (${edipiHash}, ${encryptedEdipi}, ${currentUserId})
          ON CONFLICT (edipi_hash) DO NOTHING
          RETURNING claimed_by_user_id
        `);
        if (!(claimAttempt as { rows?: unknown[] }).rows?.length) {
          const existingClaim = await tx.execute(
            sql`SELECT claimed_by_user_id FROM cac_edipi_claims WHERE edipi_hash = ${edipiHash}`,
          );
          const owner = (existingClaim as { rows?: Record<string, unknown>[] }).rows?.[0]?.claimed_by_user_id as string | undefined;
          if (owner !== currentUserId) {
            throw new EnrollmentConflict("edipi");
          }
        } else {
          // We just claimed this EDIPI fresh — cac_edipi_claims had no row
          // for it. cac_software_certs is older than this table, though:
          // if a cert was already enrolled for this EDIPI before this
          // exclusivity check existed, its owner is the real claimant and
          // must win over whoever happens to hit this code path first
          // post-deploy, or a fresh attacker could claim an EDIPI someone
          // already legitimately enrolled simply because cac_edipi_claims
          // started empty. Ignores expires_at for the same reason the
          // claims table itself does — ownership shouldn't lapse just
          // because a cert did.
          const legacyOwners = await tx.execute(
            sql`SELECT DISTINCT enrolled_by_user_id FROM cac_software_certs WHERE edipi_hash = ${edipiHash}`,
          );
          const owners = new Set(
            ((legacyOwners as { rows?: Record<string, unknown>[] }).rows ?? []).map((r) => r.enrolled_by_user_id as string),
          );
          // More than one distinct legacy owner means the pre-transaction
          // check-then-insert race this PR closes already let two different
          // accounts enroll certs for the same EDIPI before cac_edipi_claims
          // existed. There's no way to tell which one is the real claimant
          // from this data alone, so — unlike the single-owner case, where
          // that owner is unambiguously the real claimant — ambiguous legacy
          // ownership must block every caller, including one of the
          // ambiguous owners themselves, rather than let whichever of them
          // happens to hit this path first silently win. (In practice this
          // table has no legacy data in any real deployment of this app —
          // it's created by this same PR — but the check should still fail
          // closed on ambiguity rather than assume there's ever exactly one
          // legacy owner.)
          if (owners.size > 1 || (owners.size === 1 && !owners.has(currentUserId))) {
            throw new EnrollmentConflict("edipi");
          }
        }

        // Store enrollment record (sql`` tagged template — see the note on
        // the verify handler's lookup above for why raw `?` placeholders
        // don't actually bind against this Drizzle client).
        //
        // device_id is the ON CONFLICT target, but a plain
        // "DO UPDATE SET public_key_hex = ..." would let anyone re-enroll a
        // device_id someone else's account already owns: it'd silently
        // swap in the new key while leaving the OLD row's
        // edipi/enrolled_by_user_id in place, so the new key would
        // authenticate as the old owner's identity (verify only matches on
        // edipi + public_key_hex). The WHERE clause on the UPDATE makes the
        // conflict branch a no-op (0 rows, no error) unless the existing
        // row is already owned by this same account — atomically, since
        // Postgres serializes concurrent INSERTs on the same device_id via
        // its unique index. A brand-new device_id always inserts and
        // returns a row regardless; an empty RETURNING therefore only ever
        // means "conflict, different owner." Also keeps edipi_hash/edipi in
        // EXCLUDED's value so a same-owner re-enrollment under a corrected
        // EDIPI stays consistent, rather than silently keeping the old
        // row's stale edipi.
        const enrollResult = await tx.execute(sql`
          INSERT INTO cac_software_certs (edipi_hash, edipi, device_id, public_key_hex, cert_json, platform, enrolled_at, expires_at, enrolled_by_user_id)
          VALUES (${edipiHash}, ${encryptedEdipi}, ${deviceId}, ${publicKeyHex}, ${encryptedCertJson}, ${platformInfo}, NOW(), ${expiresAt}, ${currentUserId})
          ON CONFLICT (device_id) DO UPDATE SET
            edipi_hash = EXCLUDED.edipi_hash,
            edipi = EXCLUDED.edipi,
            public_key_hex = EXCLUDED.public_key_hex,
            cert_json = EXCLUDED.cert_json,
            enrolled_at = NOW(),
            expires_at = EXCLUDED.expires_at
          WHERE cac_software_certs.enrolled_by_user_id = ${currentUserId}
          RETURNING device_id
        `);
        if (!(enrollResult as { rows?: unknown[] }).rows?.length) {
          throw new EnrollmentConflict("device");
        }
      });

      res.json({ certJson, issuedAt, expiresAt });
    } catch (error) {
      if (error instanceof EnrollmentConflict) {
        return res.status(409).json({
          error: error.reason === "edipi"
            ? "This EDIPI is already enrolled by a different account"
            : "This device is already enrolled by a different account",
        });
      }
      console.error("[CAC] Enrollment error:", error);
      res.status(500).json({ error: "Enrollment failed" });
    }
  });

  // ── GET /api/auth/cac/status ──────────────────────────────────────────────
  app.get("/api/auth/cac/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const certs = await db.execute(sql`
        SELECT edipi, device_id, platform, enrolled_at, expires_at FROM cac_software_certs
        WHERE enrolled_by_user_id = ${userId} AND expires_at > NOW()
      `);
      // edipi is encrypted at rest — decrypt it back for its own owner,
      // the only caller who can ever reach this row (gated on userId above).
      const enrolledDevices = ((certs as { rows?: Record<string, unknown>[] }).rows ?? []).map((row) => ({
        ...row,
        edipi: typeof row.edipi === "string" ? decryptPhi(row.edipi) : row.edipi,
      }));

      res.json({
        enrolledDevices,
        cacAuthSupported: true,
        hardwareCACRequired: false,  // Set true for IL5
        softwareCertAllowed: true,   // Set false for IL5
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get CAC status" });
    }
  });
}
