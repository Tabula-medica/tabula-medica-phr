/**
 * India-region REST endpoints.
 *
 * All routes require the caller's account.region === "in" (enforced by
 * requireInRegion middleware below). Attempts from non-IN accounts return 403.
 *
 * Mounted at /api/in/
 *
 * Routes:
 *   GET  /api/in/identifiers           – fetch IN identifiers for the caller's default profile
 *   PUT  /api/in/identifiers           – create/update IN identifiers (ABHA, PM-JAY, etc.)
 *   GET  /api/in/demographics          – fetch IN demographics
 *   PUT  /api/in/demographics          – create/update IN demographics
 *   GET  /api/in/coverage              – list IN health coverage entries
 *   PUT  /api/in/coverage/:id?         – create/update a coverage entry
 *   GET  /api/in/abdm/consent          – fetch ABDM consent record
 *   PUT  /api/in/abdm/consent          – create/update ABDM consent
 *   GET  /api/in/fhir/patient          – FHIR R4 IN Patient resource
 *   GET  /api/in/terminology/icd10     – ICD-10 search (?q=)
 *   GET  /api/in/terminology/icd11     – ICD-11 search (?q=)
 *   GET  /api/in/terminology/abdm      – ABDM-supported code systems info
 *   GET  /api/in/status                – India region API status check
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireRole } from "../rbac";
import { phiDb } from "../storage/phi-storage";
import { inStorage } from "../storage/in-storage";
import { storage } from "../storage";
import { accounts } from "../../shared/schema";
import type { Response, NextFunction } from "express";

const router = Router();

// ─── Region gate middleware ────────────────────────────────────────────────────

async function requireInRegion(
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

  if (account?.region !== "in") {
    res.status(403).json({
      error: "India region features are only available when your account region is set to 'in'.",
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

// GET /api/in/status
router.get(
  "/status",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  (_req, res) => {
    return res.json({
      region: "in",
      abdmEnabled: process.env.ABDM_ENABLED === "true",
      abdmEnvironment: process.env.ABDM_BASE_URL?.includes("sandbox") ? "sandbox" : "production",
      icd11ApiAvailable: true,
      supportedSchemes: ["pmjay", "cghs", "echs", "esis"],
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /api/in/identifiers
router.get(
  "/identifiers",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const identifiers = await inStorage.getIdentifiers(profile.id);
    return res.json(identifiers ?? {});
  },
);

// PUT /api/in/identifiers
router.put(
  "/identifiers",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const {
      abhaAddress,
      abhaVerificationStatus,
      aadhaarLast4,
      aadhaarLinked,
      pmjayBenefitCategory,
      pmjayCardVerified,
      pmjayFamilyId,
      cghsWellnessCenter,
      esiDispensary,
      uhidIssuerHospital,
    } = req.body;

    // Identifier values come from the client; encrypted by inStorage via phi-column-map.
    const safeInput: Parameters<typeof inStorage.upsertIdentifiers>[1] = {
      abhaNumberEnc: req.body.abhaNumber,
      abhaAddress,
      abhaVerificationStatus,
      abhaLinkedAt: req.body.abhaLinkedAt ? new Date(req.body.abhaLinkedAt) : undefined,
      aadhaarLast4,
      aadhaarLinked,
      pmjayBeneficiaryIdEnc: req.body.pmjayBeneficiaryId,
      pmjayFamilyId,
      pmjayBenefitCategory,
      pmjayCardVerified,
      cghsBeneficiaryIdEnc: req.body.cghsBeneficiaryId,
      cghsWellnessCenter,
      esiInsuranceNumberEnc: req.body.esiInsuranceNumber,
      esiDispensary,
      uhidEnc: req.body.uhid,
      uhidIssuerHospital,
    };

    const result = await inStorage.upsertIdentifiers(profile.id, safeInput);
    return res.json(result);
  },
);

// GET /api/in/demographics
router.get(
  "/demographics",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const demo = await inStorage.getDemographics(profile.id);
    return res.json(demo ?? {});
  },
);

// PUT /api/in/demographics
router.put(
  "/demographics",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const allowed = [
      "addressLine1", "addressLine2", "village", "taluka", "district",
      "state", "pincode", "country", "belowPovertyLine", "rationCardType",
      "mobilePhone", "alternatePhone", "preferredLanguage",
      "emergencyContactRelation",
    ];
    const safeInput: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) safeInput[key] = req.body[key];
    }
    // Fields needing encryption pass through the phi-column-map in storage
    if (req.body.emergencyContactName !== undefined)
      safeInput.emergencyContactNameEnc = req.body.emergencyContactName;
    if (req.body.emergencyContactPhone !== undefined)
      safeInput.emergencyContactPhoneEnc = req.body.emergencyContactPhone;

    const result = await inStorage.upsertDemographics(profile.id, safeInput as any);
    return res.json(result);
  },
);

// GET /api/in/coverage
router.get(
  "/coverage",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const coverage = await inStorage.getCoverage(profile.id);
    return res.json(coverage);
  },
);

// PUT /api/in/coverage/:id?
router.put(
  "/coverage/:id?",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const result = await inStorage.upsertCoverage(profile.id, req.params.id, req.body);
    return res.json(result);
  },
);

// GET /api/in/abdm/consent
router.get(
  "/abdm/consent",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const consent = await inStorage.getAbdmConsent(profile.id);
    return res.json(consent ?? { consentStatus: "pending" });
  },
);

// PUT /api/in/abdm/consent
router.put(
  "/abdm/consent",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });
    const result = await inStorage.upsertAbdmConsent(profile.id, req.body);
    return res.json(result);
  },
);

// GET /api/in/fhir/patient — FHIR R4 IN Patient resource
router.get(
  "/fhir/patient",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  async (req: any, res) => {
    const profile = await getCallerProfile(req.user.claims.sub);
    if (!profile) return res.status(404).json({ error: "No profile found." });

    const [identifiers, demographics] = await Promise.all([
      inStorage.getIdentifiers(profile.id),
      inStorage.getDemographics(profile.id),
    ]);

    const fhirIdentifiers: any[] = [];
    if (identifiers?.abhaAddress) {
      fhirIdentifiers.push({
        use: "official",
        system: "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code",
        value: identifiers.abhaAddress,
        type: { coding: [{ code: "ABHA", display: "Ayushman Bharat Health Account" }] },
      });
    }

    const resource = {
      resourceType: "Patient",
      id: profile.id,
      meta: {
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"],
      },
      identifier: fhirIdentifiers,
      address: demographics
        ? [
            {
              use: "home",
              line: [demographics.addressLine1, demographics.addressLine2].filter(Boolean),
              city: demographics.district,
              state: demographics.state,
              postalCode: demographics.pincode,
              country: "IN",
            },
          ]
        : [],
    };

    res.set("Content-Type", "application/fhir+json");
    return res.json(resource);
  },
);

// GET /api/in/terminology/icd10?q=
router.get(
  "/terminology/icd10",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
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

// GET /api/in/terminology/icd11?q=
router.get(
  "/terminology/icd11",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
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

// GET /api/in/terminology/abdm
router.get(
  "/terminology/abdm",
  requireRole("patient", "provider", "admin"),
  requireInRegion,
  (_req, res) => {
    return res.json({
      systems: ["SNOMED-CT", "ICD-10", "LOINC", "RxNorm"],
      note: "ABDM supports SNOMED CT, ICD-10, LOINC, and RxNorm per NDHM Health Data Standards",
    });
  },
);

export default router;
