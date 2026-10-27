// @ts-nocheck
/**
 * Care Access Routes
 * Register with: import { registerCareAccessRoutes } from "./care-access-routes";
 * Then call: registerCareAccessRoutes(app, requireAuth);
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  findFQHCsNearZip,
  estimateMedicaidEligibility,
  getDrugSavingsForMedList,
  getDrugSavings,
  searchDrugCatalog,
  findBehavioralHealthFacilities,
  generateCareAccessSummary,
  getRelevantServicesFromConditions,
  findSdohResources,
  getSdohCategoryList,
  mapConditionsToSdohNeeds,
  searchDpcProviders,
  getDpcVisitTypes,
} from "./care-access-service";
import type { SdohCategory, DpcVisitType } from "./care-access-service";
import {
  searchMarketplacePlans,
  getSubsidyEstimate,
  resolveCountyFromZip,
  type HouseholdMember,
} from "./cms-marketplace-service";
import {
  fetchClaimsHistory,
  fetchProviderDirectory,
  getPayerRegistry,
  type ClaimType,
  type ClaimStatus,
} from "./payer-fhir-service";

const EligibilitySchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/),
  state: z.string().length(2),
  householdSize: z.number().int().min(1).max(20),
  annualIncome: z.number().min(0).max(10_000_000),
  hasChildren: z.boolean().optional().default(false),
  isPregnant: z.boolean().optional().default(false),
  age: z.number().int().min(0).max(120).optional(),
});

const FQHCSearchSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/),
  radiusMiles: z.number().min(1).max(100).optional().default(25),
  services: z.array(z.string()).optional(),
});

export function registerCareAccessRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
): void {

  // ── GET /api/care-access/summary ─────────────────────────────────────────
  // Full care access summary — pre-populated from patient's health record
  app.get("/api/care-access/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any)._authenticatedUserId as string;
      const {
        zipCode = "", state = "", householdSize = "1",
        annualIncome = "0", conditions = "", isVeteran = "false"
      } = req.query as Record<string, string>;

      if (!zipCode && !state) {
        return res.json({
          userId,
          zipCode: "",
          fqhcCount: 0,
          nearestFQHC: null,
          medicaidEstimate: null,
          drugSavingsCount: 0,
          estimatedMonthlySavings: 0,
          relevantPrograms: ["FQHC sliding-scale care"],
          generatedAt: new Date().toISOString(),
          requiresInput: true,
          message: "Enter your ZIP code and state to see personalized care options.",
        });
      }

      const summary = await generateCareAccessSummary(userId, {
        zipCode: zipCode || "00000",
        state: state || "CA",
        householdSize: parseInt(householdSize),
        annualIncome: parseFloat(annualIncome),
        conditions: conditions ? conditions.split(",") : [],
        isVeteran: isVeteran === "true",
      });

      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate care access summary" });
    }
  });

  // ── POST /api/care-access/fqhc ───────────────────────────────────────────
  // Find FQHCs near a zip code, optionally filtered by condition-derived services
  app.post("/api/care-access/fqhc", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = FQHCSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const { zipCode, radiusMiles, services } = parsed.data;
      const locations = await findFQHCsNearZip(zipCode, radiusMiles, services);

      res.json({ locations, count: locations.length, zipCode, radiusMiles });
    } catch (error) {
      res.status(500).json({ error: "Failed to find health centers" });
    }
  });

  // ── POST /api/care-access/eligibility ────────────────────────────────────
  // Medicaid / CHIP / Marketplace eligibility estimate
  // No PHI sent to CMS — only income, household size, zip, state
  app.post("/api/care-access/eligibility", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = EligibilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const result = await estimateMedicaidEligibility(parsed.data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to estimate eligibility" });
    }
  });

  // ── POST /api/care-access/drug-savings ───────────────────────────────────
  // Drug price comparison for a list of medications
  app.post("/api/care-access/drug-savings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { medications, zipCode } = req.body as {
        medications: Array<{ name: string; dosage?: string }>;
        zipCode: string;
      };

      if (!Array.isArray(medications) || !zipCode) {
        return res.status(400).json({ error: "medications array and zipCode required" });
      }

      if (medications.length > 15) {
        return res.status(400).json({ error: "Maximum 15 medications per request" });
      }

      const savings = await getDrugSavingsForMedList(medications, zipCode);
      const totalMonthlySavings = savings.reduce((sum, s) => sum + Math.max(0, 150 - s.lowestPrice), 0);

      res.json({
        savings,
        count: savings.length,
        estimatedMonthlySavings: Math.round(totalMonthlySavings),
        disclaimer: "Prices shown are estimates. GoodRx provides additional savings. Actual prices may vary by pharmacy.",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get drug savings" });
    }
  });

  // ── GET /api/care-access/drug-search ────────────────────────────────────
  app.get("/api/care-access/drug-search", requireAuth, async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q ?? "").trim();
      if (q.length < 2) return res.json({ results: [] });
      const results = searchDrugCatalog(q);
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: "Drug search failed" });
    }
  });

  // ── GET /api/care-access/drug-price ───────────────────────────────────
  app.get("/api/care-access/drug-price", requireAuth, async (req: Request, res: Response) => {
    try {
      const name = String(req.query.name ?? "").trim();
      const zipCode = String(req.query.zipCode ?? "00000").trim();
      const quantity = req.query.quantity ? parseInt(String(req.query.quantity)) : undefined;
      const form = req.query.form ? String(req.query.form) : undefined;

      if (!name || name.length < 2) {
        return res.status(400).json({ error: "Drug name required (min 2 characters)" });
      }
      if (!/^\d{5}$/.test(zipCode)) {
        return res.status(400).json({ error: "Valid 5-digit ZIP code required" });
      }

      const result = await getDrugSavings(name, zipCode, quantity, form);
      if (!result) {
        return res.status(404).json({ error: "Drug not found", suggestion: "Try the generic name or check spelling" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Drug pricing lookup failed" });
    }
  });

  // ── POST /api/care-access/behavioral-health ──────────────────────────────
  app.post("/api/care-access/behavioral-health", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zipCode, radiusMiles = 25 } = req.body as { zipCode: string; radiusMiles?: number };
      if (!zipCode) return res.status(400).json({ error: "zipCode required" });
      const facilities = await findBehavioralHealthFacilities(zipCode, radiusMiles);
      res.json({ facilities, count: facilities.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to find facilities" });
    }
  });

  // ── GET /api/care-access/services-for-conditions ─────────────────────────
  app.get("/api/care-access/services-for-conditions", requireAuth, (req: Request, res: Response) => {
    const conditions = ((req.query.conditions as string) ?? "").split(",").filter(Boolean);
    const services = getRelevantServicesFromConditions(conditions);
    res.json({ services, conditions });
  });

  const US_STATE_REGEX = /^[A-Z]{2}$/;
  const MarketplaceSearchSchema = z.object({
    zipCode: z.string().regex(/^\d{5}$/),
    state: z.string().regex(US_STATE_REGEX),
    householdIncome: z.number().min(0).max(10_000_000),
    householdMembers: z.array(z.object({
      age: z.number().int().min(0).max(120),
      gender: z.enum(["Male", "Female"]).optional(),
      usesTobacco: z.boolean().optional(),
      isPregnant: z.boolean().optional(),
      relationship: z.enum(["Self", "Spouse", "Child", "Dependent"]).optional(),
    })).min(1).max(20),
    countyFips: z.string().optional(),
    metalLevel: z.string().optional(),
  });

  app.post("/api/care-access/marketplace/plans", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = MarketplaceSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const result = await searchMarketplacePlans(parsed.data);
      res.json({
        plans: result.plans,
        totalPlans: result.totalPlans,
        subsidy: result.subsidyEstimate,
        county: result.countyInfo,
        year: 2026,
        disclaimer: "Plan costs are estimates based on the information provided. Actual premiums may vary. Visit Healthcare.gov for official enrollment and final pricing.",
        enrollUrl: "https://www.healthcare.gov/see-plans/",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search marketplace plans" });
    }
  });

  app.post("/api/care-access/marketplace/subsidy", requireAuth, async (req: Request, res: Response) => {
    try {
      const SubsidySchema = z.object({
        zipCode: z.string().regex(/^\d{5}$/),
        state: z.string().regex(US_STATE_REGEX),
        householdIncome: z.number().min(0),
        householdMembers: z.array(z.object({
          age: z.number().int().min(0).max(120),
          gender: z.enum(["Male", "Female"]).optional(),
          usesTobacco: z.boolean().optional(),
          isPregnant: z.boolean().optional(),
          relationship: z.enum(["Self", "Spouse", "Child", "Dependent"]).optional(),
        })).min(1).max(20),
        countyFips: z.string().optional(),
      });

      const parsed = SubsidySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const estimate = await getSubsidyEstimate(parsed.data);
      res.json({
        ...estimate,
        year: 2026,
        disclaimer: "This is an estimate. Visit Healthcare.gov for your official eligibility determination.",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to estimate subsidies" });
    }
  });

  app.get("/api/care-access/marketplace/counties/:zipCode", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zipCode } = req.params;
      if (!/^\d{5}$/.test(zipCode)) {
        return res.status(400).json({ error: "Invalid ZIP code" });
      }

      const counties = await resolveCountyFromZip(zipCode);
      res.json({ counties, zipCode });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to look up county" });
    }
  });

  // ── SDoH (FindHelp.org) resource finder ──────────────────────────────────────

  app.get("/api/care-access/sdoh/categories", requireAuth, (_req: Request, res: Response) => {
    res.json({ categories: getSdohCategoryList() });
  });

  app.post("/api/care-access/sdoh/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const SdohSearchSchema = z.object({
        zipCode: z.string().regex(/^\d{5}$/),
        categories: z.array(z.string()).optional(),
        query: z.string().max(200).optional(),
      });
      const parsed = SdohSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      const { zipCode, categories, query } = parsed.data;
      const result = await findSdohResources(
        zipCode,
        categories as SdohCategory[] | undefined,
        query
      );
      res.json({
        ...result,
        zipCode,
        disclaimer: result.isLive
          ? "Resource availability may change. Contact programs directly to confirm eligibility and hours."
          : "Showing national programs. Set FINDHELP_API_KEY for localized results from FindHelp.org.",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search SDoH resources" });
    }
  });

  app.get("/api/care-access/sdoh/needs-from-conditions", requireAuth, (req: Request, res: Response) => {
    const conditions = ((req.query.conditions as string) ?? "").split(",").filter(Boolean);
    const needs = mapConditionsToSdohNeeds(conditions);
    const categories = getSdohCategoryList().filter(c => needs.includes(c.category));
    res.json({ suggestedCategories: categories, conditions });
  });

  // ── Direct Primary Care (Sesame Care) ────────────────────────────────────────

  app.get("/api/care-access/dpc/visit-types", requireAuth, (_req: Request, res: Response) => {
    res.json({ visitTypes: getDpcVisitTypes() });
  });

  app.post("/api/care-access/dpc/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const DpcSearchSchema = z.object({
        zipCode: z.string().regex(/^\d{5}$/),
        visitType: z.string().optional(),
        telehealth: z.boolean().optional(),
      });
      const parsed = DpcSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      const { zipCode, visitType, telehealth } = parsed.data;
      const result = await searchDpcProviders(
        zipCode,
        visitType as DpcVisitType | undefined,
        telehealth
      );
      res.json({
        ...result,
        zipCode,
        disclaimer: result.isLive
          ? "Prices shown are cash-pay rates. No insurance required. Contact providers to confirm availability and pricing."
          : "Showing reference pricing. Set SESAME_API_KEY for live provider availability and booking from Sesame Care.",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search DPC providers" });
    }
  });

  // ── Payer FHIR Patient Access (CMS-9115-F Claims History) ──────────────────

  app.get("/api/care-access/payer/registry", requireAuth, (_req: Request, res: Response) => {
    res.json({ payers: getPayerRegistry() });
  });

  app.post("/api/care-access/payer/claims", requireAuth, async (req: Request, res: Response) => {
    try {
      const ClaimsSchema = z.object({
        claimType: z.enum(["medical", "pharmacy", "dental", "vision", "behavioral", "lab", "imaging"]).optional(),
        status: z.enum(["paid", "denied", "pending", "appealed", "adjusted"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      });
      const parsed = ClaimsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      const result = await fetchClaimsHistory(undefined, {
        claimType: parsed.data.claimType as ClaimType | undefined,
        status: parsed.data.status as ClaimStatus | undefined,
        dateFrom: parsed.data.dateFrom,
        dateTo: parsed.data.dateTo,
      });
      res.json({
        ...result,
        disclaimer: result.isLive
          ? "Claims data retrieved from your insurer's FHIR Patient Access API (CMS-9115-F)."
          : "Showing demo claims history. Connect your insurer to retrieve your actual claims, EOBs, and coverage data.",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch claims history" });
    }
  });

  app.post("/api/care-access/payer/providers", requireAuth, async (req: Request, res: Response) => {
    try {
      const ProviderSchema = z.object({
        specialty: z.string().optional(),
        acceptingNew: z.boolean().optional(),
        telehealth: z.boolean().optional(),
      });
      const parsed = ProviderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      const result = await fetchProviderDirectory(undefined, parsed.data);
      res.json({
        ...result,
        disclaimer: result.isLive
          ? "Provider data from your insurer's FHIR directory."
          : "Showing demo provider directory. Connect your insurer to see your in-network providers.",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch provider directory" });
    }
  });
}
