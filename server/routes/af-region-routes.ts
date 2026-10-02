/**
 * Africa-region REST endpoints.
 *
 * All routes require the caller's account.region === "af" (enforced by
 * requireAfRegion middleware below). Attempts from non-AF accounts return 403.
 *
 * Mounted at /api/af/
 *
 * Routes:
 *   GET  /api/af/identifiers           – fetch AF identifiers for the caller's default profile
 *   PUT  /api/af/identifiers           – create/update AF identifiers (NHN, NHIF, NIN, NHIA, etc.)
 *   GET  /api/af/demographics          – fetch AF demographics
 *   PUT  /api/af/demographics          – create/update AF demographics
 *   GET  /api/af/coverage              – list AF health coverage entries
 *   PUT  /api/af/coverage/:id?         – create/update a coverage entry
 *   GET  /api/af/fhir/patient          – FHIR R4 Patient resource
 *   GET  /api/af/terminology/icd10     – ICD-10 search (?q=)
 *   GET  /api/af/terminology/icd11     – ICD-11 search (?q=)
 *   GET  /api/af/terminology/dhis2     – DHIS2 disease code lookup
 *   GET  /api/af/status                – Africa region API status check
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireRole } from "../rbac";
import { phiDb } from "../storage/phi-storage";
import { afStorage } from "../storage/af-storage";
import { storage } from "../storage";
import { accounts } from "../../shared/schema";
import type { Response, NextFunction } from "express";

const router = Router();

// ─── Region gate middleware ────────────────────────────────────────────────────

async function requireAfRegion(
  req: any,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

  if (account?.region !== "af") {
    res.status(403).json({
      error: "Africa region features are only available when your account region is set to 'af'.",
    });
    return;
  }

  next();
}

// ─── Profile helper ────────────────────────────────────────────────────────────

async function getCallerProfile(userId: string) {
  const profiles = await storage.getProfiles(userId);
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/af/status
router.get(
  "/status",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  (_req, res) => {
    return res.json({
      region: "af",
      supportedCountries: ["ZA", "KE", "NG", "ET", "GH", "TZ", "UG", "RW"],
      supportedSchemes: {
        ZA: ["sa_medical_aid", "sa_public"],
        KE: ["ke_nhif"],
        NG: ["ng_nhia"],
        GH: ["gh_nhis"],
        RW: ["rw_mutuelle"],
      },
      dhis2Integration: false,
      smartHealthLinksSupported: true,
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /api/af/identifiers
router.get(
  "/identifiers",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const identifiers = await afStorage.getIdentifiers(profile.id);
    return res.json(identifiers ?? {});
  },
);

// PUT /api/af/identifiers
router.put(
  "/identifiers",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const {
      countryCode,
      saMedicalAidNumber,
      saMedicalAidScheme,
      keHudumaNumber,
      dhis2TrackedEntityId,
      whoPatientId,
      smartHealthLinkToken,
      additionalIdentifiers,
      ngHfrid,
      etFidaNumber,
    } = req.body;

    const safeInput: Parameters<typeof afStorage.upsertIdentifiers>[1] = {
      countryCode,
      saNhnEnc: req.body.saNhn,
      saIdNumberEnc: req.body.saIdNumber,
      saMedicalAidNumber,
      saMedicalAidScheme,
      keNhifMemberNumberEnc: req.body.keNhifMemberNumber,
      keNationalIdEnc: req.body.keNationalId,
      keHudumaNumber,
      ngNinEnc: req.body.ngNin,
      ngNhiaIdEnc: req.body.ngNhiaId,
      ngBvnEnc: req.body.ngBvn,
      ngHfrid,
      etHmisIdEnc: req.body.etHmisId,
      etFidaNumber,
      ghNhisIdEnc: req.body.ghNhisId,
      ghGhanaCardEnc: req.body.ghGhanaCard,
      dhis2TrackedEntityId,
      whoPatientId,
      smartHealthLinkToken,
      additionalIdentifiers,
    };

    const result = await afStorage.upsertIdentifiers(profile.id, safeInput);
    return res.json(result);
  },
);

// GET /api/af/demographics
router.get(
  "/demographics",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const demo = await afStorage.getDemographics(profile.id);
    return res.json(demo ?? {});
  },
);

// PUT /api/af/demographics
router.put(
  "/demographics",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const allowed = [
      "countryCode", "addressLine1", "addressLine2", "suburb", "city",
      "province", "postalCode", "country", "preferredLanguage",
      "emergencyContactRelation", "nearestPublicFacility",
      "distanceToFacilityKm", "communityHealthWorkerLinked",
    ];
    const safeInput: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) safeInput[key] = req.body[key];
    }
    if (req.body.emergencyContactName !== undefined)
      safeInput.emergencyContactNameEnc = req.body.emergencyContactName;
    if (req.body.emergencyContactPhone !== undefined)
      safeInput.emergencyContactPhoneEnc = req.body.emergencyContactPhone;

    const result = await afStorage.upsertDemographics(profile.id, safeInput as any);
    return res.json(result);
  },
);

// GET /api/af/coverage
router.get(
  "/coverage",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const coverage = await afStorage.getCoverage(profile.id);
    return res.json(coverage);
  },
);

// PUT /api/af/coverage/:id?
router.put(
  "/coverage/:id?",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const result = await afStorage.upsertCoverage(profile.id, req.params.id, req.body);
    return res.json(result);
  },
);

// GET /api/af/fhir/patient — FHIR R4 Patient resource (WHO AFRO profile)
router.get(
  "/fhir/patient",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const [identifiers, demographics] = await Promise.all([
      afStorage.getIdentifiers(profile.id),
      afStorage.getDemographics(profile.id),
    ]);

    const fhirIdentifiers: any[] = [];
    if (identifiers?.dhis2TrackedEntityId) {
      fhirIdentifiers.push({
        system: "https://dhis2.org/tracked-entity",
        value: identifiers.dhis2TrackedEntityId,
      });
    }
    if (identifiers?.whoPatientId) {
      fhirIdentifiers.push({
        system: "https://who.int/patient",
        value: identifiers.whoPatientId,
      });
    }

    const resource = {
      resourceType: "Patient",
      id: profile.id,
      meta: {
        profile: ["http://hl7.org/fhir/uv/ipa/StructureDefinition/ipa-patient"],
      },
      identifier: fhirIdentifiers,
      address: demographics
        ? [
            {
              use: "home",
              line: [demographics.addressLine1, demographics.addressLine2].filter(Boolean),
              city: demographics.city,
              state: demographics.province,
              postalCode: demographics.postalCode,
              country: demographics.country,
            },
          ]
        : [],
      communication: demographics?.preferredLanguage
        ? [{ language: { coding: [{ code: demographics.preferredLanguage }] }, preferred: true }]
        : [],
    };

    res.set("Content-Type", "application/fhir+json");
    return res.json(resource);
  },
);

// GET /api/af/terminology/icd10?q=
router.get(
  "/terminology/icd10",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      return res.status(400).json({ error: "q must be at least 2 characters" });
    }
    return res.json({
      system: "http://hl7.org/fhir/sid/icd-10",
      query: q,
      results: [],
      note: "ICD-10 terminology — connect to WHO ICD API or local FHIR TS",
    });
  },
);

// GET /api/af/terminology/icd11?q=
router.get(
  "/terminology/icd11",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      return res.status(400).json({ error: "q must be at least 2 characters" });
    }
    return res.json({
      system: "http://id.who.int/icd/release/11/mms",
      query: q,
      results: [],
      note: "ICD-11 search — WHO ICD-11 API requires client credentials",
    });
  },
);

// GET /api/af/terminology/dhis2?code=
router.get(
  "/terminology/dhis2",
  requireRole("patient", "provider", "admin"),
  requireAfRegion,
  (req, res) => {
    return res.json({
      code: req.query.code ?? null,
      system: "https://dhis2.org/disease-code",
      note: "DHIS2 terminology — connect to facility DHIS2 instance with API credentials",
    });
  },
);

export default router;
