/**
 * World EHR — International Patient Summary API.
 *
 * Three endpoints, mounted at /api/world/ips:
 *
 *   GET  /api/world/ips             → the patient's IPS document Bundle
 *   GET  /api/world/ips/passport    → the same document, signed (offline-verifiable)
 *   POST /api/world/ips/verify      → verify a passport (no auth, no PHI stored)
 *
 * The verify endpoint is intentionally unauthenticated: its whole purpose is
 * that a clinician who has never heard of Tabula Medica can check a document a
 * patient handed them. It reads the posted body, answers, and stores nothing.
 *
 * These routes are region-neutral by design — unlike the TEFCA surface they
 * sit alongside, they carry no US assumptions and are the exchange path for
 * the `tabulamedica.world` deployment, where TEFCA_ENABLED=false leaves no
 * other route out of the app.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profiles } from "@shared/schema";
import { phiDb } from "./storage/phi-storage";
import { logPhiAccess } from "./security/hipaa-audit";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { buildIpsBundle, collectIpsInput } from "./services/world/ips-generator";
import { validateIpsBundle } from "./services/world/ips-validator";
import {
  deriveProvenance,
  issuePassport,
  loadSigningKeyFromEnv,
  verifyPassport,
  type HealthPassport,
} from "./services/world/health-passport";

function getSessionUserId(req: Request): string | null {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    null
  );
}

/** Resolve the caller's own profileId. Ownership is enforced by only ever
 *  operating on the profile belonging to the session account. */
async function resolveOwnProfileId(req: Request): Promise<string | null> {
  const accountId = getSessionUserId(req);
  if (!accountId) return null;
  const rows = await phiDb
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);
  return rows.length > 0 ? rows[0].id : null;
}

const countryQuerySchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "country must be an ISO 3166-1 alpha-2 code")
  .optional();

/**
 * Everything in this PHR is patient-entered today; the provider-sourced
 * ingestion paths (Fasten/TEFCA) are US-only and disabled on `.world`. Until a
 * per-element provenance column exists, the honest answer is that zero
 * elements are verified — so the passport says "patient-asserted" rather than
 * over-claiming. Counting elements here keeps the call site truthful and makes
 * the upgrade a one-line change once provenance is tracked per row.
 */
function countElements(input: {
  problems: unknown[];
  medications: unknown[];
  allergies: unknown[];
  immunizations: unknown[];
  procedures: unknown[];
}): { verified: number; patientAsserted: number } {
  const total =
    input.problems.length +
    input.medications.length +
    input.allergies.length +
    input.immunizations.length +
    input.procedures.length;
  return { verified: 0, patientAsserted: total };
}

export function registerWorldIpsRoutes(app: Express): void {
  app.use("/api/world/ips", noStorePhi);

  const requireProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const profileId = await resolveOwnProfileId(req);
      if (!profileId) {
        return res.status(403).json({ error: "No profile found for this account" });
      }
      (req as any).resolvedProfileId = profileId;
      next();
    } catch (error) {
      console.error("[WorldIPS] Profile resolution failed:", error);
      res.status(500).json({ error: "Failed to resolve profile" });
    }
  };

  /**
   * GET /api/world/ips — build the patient's IPS document.
   *
   * Always runs the conformance validator before responding and returns the
   * result alongside the document. A non-conformant IPS is still returned
   * (it is the patient's data and withholding it helps nobody) but the
   * caller is told, so a receiving system can decide.
   */
  app.get(
    "/api/world/ips",
    isAuthenticated,
    requireProfile,
    async (req: Request, res: Response) => {
      try {
        const profileId = (req as any).resolvedProfileId as string;

        const country = countryQuerySchema.safeParse(req.query.country);
        if (!country.success) {
          return res.status(400).json({ error: country.error.issues[0].message });
        }

        const input = await collectIpsInput(profileId, {
          timestamp: new Date().toISOString(),
          documentId: randomUUID(),
          countryCode: country.data?.toUpperCase(),
        });

        if (!input) {
          return res.status(404).json({ error: "Profile not found" });
        }

        const bundle = buildIpsBundle(input);
        const validation = validateIpsBundle(bundle);

        await logPhiAccess({
          userId: getSessionUserId(req) ?? "unknown",
          patientId: profileId,
          action: "export",
          resourceType: "ips-document",
          resourceId: bundle.id,
          details: `IPS document generated for profile ${profileId} (conformant=${validation.conformant})`,
        });

        res.json({ bundle, validation });
      } catch (error) {
        console.error("[WorldIPS] Generation failed:", error);
        res.status(500).json({ error: "Failed to generate International Patient Summary" });
      }
    },
  );

  /**
   * GET /api/world/ips/passport — the IPS wrapped in a signed envelope.
   *
   * Returns 503 rather than an unsigned body when no signing key is
   * configured: a caller that asked for a passport must not silently receive
   * something unverifiable that looks like one.
   */
  app.get(
    "/api/world/ips/passport",
    isAuthenticated,
    requireProfile,
    async (req: Request, res: Response) => {
      try {
        const privateKeyPem = loadSigningKeyFromEnv();
        if (!privateKeyPem) {
          return res.status(503).json({
            error: "PASSPORT_SIGNING_UNAVAILABLE",
            message:
              "No passport signing key is configured for this deployment. Use /api/world/ips for the unsigned document.",
          });
        }

        const profileId = (req as any).resolvedProfileId as string;

        const country = countryQuerySchema.safeParse(req.query.country);
        if (!country.success) {
          return res.status(400).json({ error: country.error.issues[0].message });
        }

        const input = await collectIpsInput(profileId, {
          timestamp: new Date().toISOString(),
          documentId: randomUUID(),
          countryCode: country.data?.toUpperCase(),
        });

        if (!input) {
          return res.status(404).json({ error: "Profile not found" });
        }

        const bundle = buildIpsBundle(input);
        const counts = countElements(input);
        const passport = issuePassport({
          document: bundle,
          privateKeyPem,
          provenance: deriveProvenance(counts.verified, counts.patientAsserted),
          signedAt: new Date().toISOString(),
        });

        await logPhiAccess({
          userId: getSessionUserId(req) ?? "unknown",
          patientId: profileId,
          action: "export",
          resourceType: "health-passport",
          resourceId: bundle.id,
          details: `Signed health passport issued for profile ${profileId} (keyId=${passport.signature.keyId})`,
        });

        res.json({ passport, validation: validateIpsBundle(bundle) });
      } catch (error) {
        console.error("[WorldIPS] Passport issuance failed:", error);
        res.status(500).json({ error: "Failed to issue health passport" });
      }
    },
  );

  /**
   * POST /api/world/ips/verify — verify a signed passport.
   *
   * Unauthenticated on purpose (see file header). The posted document is PHI
   * belonging to whoever handed it over, so it is verified in memory and never
   * written anywhere — including the audit log, which records only the
   * outcome.
   */
  app.post("/api/world/ips/verify", async (req: Request, res: Response) => {
    try {
      const passport = req.body?.passport as HealthPassport | undefined;
      if (!passport || typeof passport !== "object") {
        return res.status(400).json({
          error: "Request body must be { passport: <health passport envelope> }",
        });
      }

      const result = verifyPassport(passport);
      res.json({ result });
    } catch (error) {
      console.error("[WorldIPS] Verification failed:", error);
      res.status(500).json({ error: "Failed to verify health passport" });
    }
  });

  console.log("[Routes] World EHR IPS routes registered at /api/world/ips/*");
}
