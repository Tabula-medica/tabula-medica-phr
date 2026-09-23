/**
 * AU-region REST endpoints.
 *
 * All routes require the caller's account.region === "au" (enforced by
 * requireAuRegion middleware below). Attempts from non-AU accounts return 403.
 *
 * Mounted at /api/au/
 *
 * Routes:
 *   GET  /api/au/identifiers          – fetch AU identifiers for the caller's default profile
 *   PUT  /api/au/identifiers          – create/update AU identifiers
 *   GET  /api/au/demographics         – fetch AU demographics
 *   PUT  /api/au/demographics         – create/update AU demographics
 *   GET  /api/au/coverage             – list AU health coverage entries
 *   PUT  /api/au/coverage/:id         – create/update a coverage entry
 *   GET  /api/au/myhr/consent         – fetch MyHR consent record
 *   PUT  /api/au/myhr/consent         – create/update MyHR consent
 *   GET  /api/au/fhir/patient         – FHIR AU Base Patient resource for the profile
 *   GET  /api/au/terminology/amt      – AMT search (?q=)
 *   GET  /api/au/terminology/pbs      – PBS search (?q=) or item (?code=)
 *   GET  /api/au/terminology/icd10am  – ICD-10-AM search (?q=)
 *   GET  /api/au/terminology/status   – NCTS connectivity check
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireRole } from "../rbac";
import { phiDb } from "../storage/phi-storage";
import { auStorage } from "../storage/au-storage";
import { accounts } from "../../shared/schema";
import { storage } from "../storage";
import {
  toFhirAuPatient,
  buildAuPatientIdentifiers,
  buildAuPatientExtensions,
} from "../fhir/au-profile-mapper";
import {
  searchAmt,
  getAmtConcept,
  searchPbs,
  getPbsItem,
  searchIcd10am,
  checkNctsConnectivity,
} from "../services/ncts-terminology";

const router = Router();

// ─── Region gate ──────────────────────────────────────────────────────────────

async function requireAuRegion(req: any, res: any, next: any): Promise<void> {
  const userId: string | undefined = req.user?.claims?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthenticated." });
    return;
  }

  const [account] = await phiDb
    .select({ region: accounts.region })
    .from(accounts)
    .where(eq(accounts.id, userId))
    .limit(1);

  if (account?.region !== "au") {
    res.status(403).json({
      error: "AU region features are only available when your account region is set to 'au'.",
    });
    return;
  }

  next();
}

// ─── Profile helper ───────────────────────────────────────────────────────────

async function getCallerProfile(userId: string) {
  const profiles = await storage.getProfiles(userId);
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
}

// ─── Identifiers ──────────────────────────────────────────────────────────────

router.get(
  "/identifiers",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const ids = await auStorage.getIdentifiers(profile.id);
    return res.json(ids ?? {});
  },
);

router.put(
  "/identifiers",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    // Only accept known safe fields — strip anything else
    const {
      medicareIrn,
      medicareExpiryMmYyyy,
      dvaCardColor,
      concessionCardType,
      concessionCardExpiryDate,
      ihiStatus,
      ihiRecordStatus,
    } = req.body;

    // Identifier values come from the client pre-validated; they will be
    // encrypted in auStorage.upsertIdentifiers via the phi-column-map wrapper.
    const safeInput: Parameters<typeof auStorage.upsertIdentifiers>[1] = {
      ihiNumberEnc: req.body.ihiNumber,
      ihiStatus,
      ihiRecordStatus,
      medicareNumberEnc: req.body.medicareNumber,
      medicareIrn,
      medicareExpiryMmYyyy,
      dvaNumberEnc: req.body.dvaNumber,
      dvaCardColor,
      hpiiNumberEnc: req.body.hpiiNumber,
      concessionCardNumberEnc: req.body.concessionCardNumber,
      concessionCardType,
      concessionCardExpiryDate,
    };

    const result = await auStorage.upsertIdentifiers(profile.id, safeInput);
    return res.json(result);
  },
);

// ─── Demographics ─────────────────────────────────────────────────────────────

router.get(
  "/demographics",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const demo = await auStorage.getDemographics(profile.id);
    return res.json(demo ?? {});
  },
);

router.put(
  "/demographics",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const allowed = [
      "genderIdentity",
      "sexAssignedAtBirth",
      "indigenousStatus",
      "dobAccuracy",
      "addressLine1",
      "addressLine2",
      "suburb",
      "state",
      "postcode",
      "country",
      "mobilePhone",
      "homePhone",
      "atsiHealthServiceRegistered",
    ] as const;

    const safeInput = Object.fromEntries(
      allowed.filter((k) => k in req.body).map((k) => [k, req.body[k]]),
    );

    const result = await auStorage.upsertDemographics(profile.id, safeInput);
    return res.json(result);
  },
);

// ─── Health Coverage ──────────────────────────────────────────────────────────

router.get(
  "/coverage",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const coverage = await auStorage.getCoverage(profile.id);
    return res.json(coverage);
  },
);

router.put(
  "/coverage/:id",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const coverageId: string = req.params.id;
    const result = await auStorage.upsertCoverage(
      profile.id,
      coverageId,
      req.body,
    );
    return res.json(result);
  },
);

// ─── MyHR Consent ─────────────────────────────────────────────────────────────

router.get(
  "/myhr/consent",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const consent = await auStorage.getMyhrConsent(profile.id);
    // Never expose restricted access code — omit from response
    if (consent) {
      const { restrictedAccessCode: _omit, ...safe } = consent;
      return res.json(safe);
    }
    return res.json(null);
  },
);

router.put(
  "/myhr/consent",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const {
      consentStatus,
      restrictedDocTypes,
      providerAccessRestrictions,
    } = req.body;

    if (!["active", "withdrawn", "restricted", "opt_out"].includes(consentStatus)) {
      return res.status(400).json({ error: "Invalid consentStatus." });
    }

    const result = await auStorage.upsertMyhrConsent(profile.id, {
      consentStatus,
      restrictedDocTypes: restrictedDocTypes ?? [],
      providerAccessRestrictions: providerAccessRestrictions ?? [],
      ...(consentStatus === "active" && { consentGrantedAt: new Date() }),
      ...(consentStatus === "withdrawn" && { consentWithdrawnAt: new Date() }),
    });

    const { restrictedAccessCode: _omit, ...safe } = result;
    return res.json(safe);
  },
);

// ─── FHIR AU Patient ──────────────────────────────────────────────────────────

router.get(
  "/fhir/patient",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const userId: string = req.user.claims.sub;
    const profile = await getCallerProfile(userId);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const [identifiers, demographics] = await Promise.all([
      auStorage.getIdentifiers(profile.id),
      auStorage.getDemographics(profile.id),
    ]);

    const resource = toFhirAuPatient({
      profileId: profile.id,
      fullName: profile.fullName,
      dob: profile.dob,
      preferredLanguage: profile.preferredLanguage,
      identifiers,
      demographics,
    });

    res.setHeader("Content-Type", "application/fhir+json");
    return res.json(resource);
  },
);

// ─── Terminology (NCTS passthrough) ──────────────────────────────────────────

router.get(
  "/terminology/amt",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const q = String(req.query.q ?? "").trim();
    const code = String(req.query.code ?? "").trim();

    if (code) {
      const concept = await getAmtConcept(code);
      return concept
        ? res.json(concept)
        : res.status(404).json({ error: "AMT concept not found." });
    }

    if (!q || q.length < 2) {
      return res.status(400).json({ error: "Provide ?q= (≥2 chars) or ?code=." });
    }

    const results = await searchAmt(q);
    return res.json(results);
  },
);

router.get(
  "/terminology/pbs",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const q = String(req.query.q ?? "").trim();
    const code = String(req.query.code ?? "").trim();

    if (code) {
      const item = await getPbsItem(code);
      return item
        ? res.json(item)
        : res.status(404).json({ error: "PBS item not found." });
    }

    if (!q || q.length < 2) {
      return res.status(400).json({ error: "Provide ?q= (≥2 chars) or ?code=." });
    }

    const results = await searchPbs(q);
    return res.json(results);
  },
);

router.get(
  "/terminology/icd10am",
  requireRole("patient", "provider", "admin"),
  requireAuRegion,
  async (req: any, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ error: "Provide ?q= (≥2 chars)." });
    }
    const results = await searchIcd10am(q);
    return res.json(results);
  },
);

router.get("/terminology/status", requireRole("patient", "provider", "admin"), async (_req, res) => {
  const status = await checkNctsConnectivity();
  return res.json(status);
});

export default router;
