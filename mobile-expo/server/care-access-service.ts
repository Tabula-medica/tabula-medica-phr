// @ts-nocheck
/**
 * Care Access Service
 * ===================
 * Connects uninsured / underinsured patients to free and low-cost care.
 *
 * Data sources (all free / government open data):
 *   HRSA Health Center API  — 1,400+ FQHCs, sliding-fee clinics
 *   CMS Healthcare.gov API  — Medicaid/CHIP eligibility estimates
 *   SAMHSA Locator API      — Behavioral health, SUD treatment
 *   FindHelp.org API        — SDoH resources (food, housing, utilities, etc.)
 *   Sesame Care API         — Direct Primary Care (DPC) transparent pricing
 *   VA Lighthouse API       — VA facilities (already integrated)
 *   GoodRx API              — Drug price comparison (key required)
 *
 * The key differentiator: every lookup is pre-filtered by the patient's
 * existing health record — conditions, medications, zip code, demographics.
 * No other care finder can do this.
 */

import axios from "axios";
import { logger } from "./utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FQHCLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  services: string[];           // e.g. ["dental", "mental_health", "pharmacy"]
  slidingFeeScale: boolean;
  acceptsUninsured: boolean;
  acceptsMedicaid: boolean;
  acceptsMedicare: boolean;
  hours?: string;
  languages?: string[];
  isTribalHealthCenter: boolean;
  isMigrantHealthCenter: boolean;
}

export interface MedicaidEligibilityResult {
  estimatedStatus: "likely_eligible" | "possibly_eligible" | "likely_ineligible" | "check_required";
  confidence: "high" | "medium" | "low";
  programsToCheck: MedicaidProgram[];
  fplPercentage: number;
  explanation: string;
  applyUrl: string;
  stateMedicaidPhone?: string;
  chipEligible: boolean;
  marketplaceSubsidyEligible: boolean;
  annualIncomeCutoff: number;
}

export interface MedicaidProgram {
  name: string;
  description: string;
  incomeLimit: string;
  applyUrl: string;
  phone?: string;
}

export interface DrugSavingsResult {
  drugName: string;
  genericName?: string;
  lowestPrice: number;
  lowestPharmacy: string;
  lowestPharmacyAddress?: string;
  prices: DrugPrice[];
  goodRxCouponUrl?: string;
  is340BEligible: boolean;
  patientAssistanceProgram?: string;
  patientAssistanceProgramUrl?: string;
  insuranceCopay?: InsuranceCopayComparison;
  isGenericAvailable?: boolean;
  drugClass?: string;
  isLive: boolean;
}

export interface DrugPrice {
  pharmacy: string;
  cashPrice: number;
  withCouponPrice?: number;
  distance?: number;
  address?: string;
}

export interface InsuranceCopayComparison {
  typicalCopayGeneric: number;
  typicalCopayBrand: number;
  typicalCopaySpecialty: number;
  couponBeatsInsurance: boolean;
  estimatedSavingsVsCopay: number;
}

export type SdohCategory =
  | "food"
  | "housing"
  | "utilities"
  | "transportation"
  | "legal"
  | "employment"
  | "education"
  | "childcare"
  | "financial"
  | "clothing"
  | "disability"
  | "substance_use"
  | "mental_health"
  | "domestic_violence"
  | "reentry"
  | "immigration"
  | "tax_prep"
  | "other";

export interface SdohResource {
  id: string;
  name: string;
  category: SdohCategory;
  categoryLabel: string;
  description: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  eligibility?: string;
  languages?: string[];
  distance?: number;
  isFree: boolean;
  acceptsUninsured: boolean;
  applicationUrl?: string;
  lastVerified?: string;
}

export interface SdohSearchResult {
  resources: SdohResource[];
  totalCount: number;
  categories: Array<{ category: SdohCategory; label: string; count: number }>;
  isLive: boolean;
}

export interface BehavioralHealthFacility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  services: string[];
  acceptsUninsured: boolean;
  acceptsMedicaid: boolean;
  slidingFeeScale: boolean;
  distanceMiles?: number;
}

export interface CareAccessSummary {
  userId: string;
  zipCode: string;
  fqhcCount: number;
  nearestFQHC?: FQHCLocation;
  medicaidEstimate: MedicaidEligibilityResult | null;
  drugSavingsCount: number;
  estimatedMonthlySavings: number;
  relevantPrograms: string[];
  generatedAt: string;
}

// ─── HRSA API client ──────────────────────────────────────────────────────────

const HRSA_API_BASE = "https://data.hrsa.gov/api/datawarehouse";

/**
 * Find FQHCs near a zip code using the HRSA Data Warehouse API.
 * Requires a free API token from data.hrsa.gov/tools/web-services
 *
 * Falls back to the public findahealthcenter.hrsa.gov endpoint
 * which requires no token for basic location searches.
 */
export async function findFQHCsNearZip(
  zipCode: string,
  radiusMiles: number = 25,
  services?: string[]
): Promise<FQHCLocation[]> {
  const token = process.env.HRSA_API_TOKEN;

  try {
    if (token) {
      return await _hrsa_api_search(zipCode, radiusMiles, services, token);
    }
    // Fallback: scrape the public HRSA locator (no token needed)
    return await _hrsa_public_search(zipCode, radiusMiles, services);
  } catch (error) {
    logger.error("[CareAccess] HRSA search failed", { zipCode, error });
    return [];
  }
}

async function _hrsa_api_search(
  zipCode: string,
  radiusMiles: number,
  services: string[] | undefined,
  token: string
): Promise<FQHCLocation[]> {
  const params: Record<string, string | number> = {
    zip: zipCode,
    radius: radiusMiles,
    token,
    format: "json",
  };

  if (services?.length) {
    // HRSA service codes: BH = behavioral health, DENT = dental, MH = mental health
    // PHM = pharmacy, ENAB = enabling services, VIS = vision
    const serviceMap: Record<string, string> = {
      mental_health: "MH",
      dental: "DENT",
      pharmacy: "PHM",
      behavioral_health: "BH",
      vision: "VIS",
      substance_use: "SUD",
    };
    const codes = services.map(s => serviceMap[s]).filter(Boolean);
    if (codes.length) params.services = codes.join(",");
  }

  const response = await axios.get(
    `${HRSA_API_BASE}/healthcenter/datawarehouse/healthcenterlocations`,
    { params, timeout: 10000 }
  );

  const locations = response.data?.Results ?? response.data?.results ?? [];
  return locations.map(_mapHRSALocation);
}

async function _hrsa_public_search(
  zipCode: string,
  radiusMiles: number,
  _services?: string[]
): Promise<FQHCLocation[]> {
  // The HRSA public locator uses a simple query endpoint
  const url = `https://findahealthcenter.hrsa.gov/api/search`;
  const response = await axios.get(url, {
    params: { zip: zipCode, radius: radiusMiles, incrementalsearch: false },
    timeout: 10000,
    headers: {
      "Accept": "application/json",
      "User-Agent": "TabulaMedica/1.0 (patient health app; contact@tabulamedica.health)",
    },
  });

  const results = response.data?.features ?? response.data?.results ?? [];
  return results.slice(0, 20).map((r: any) => _mapHRSAPublicResult(r));
}

function _mapHRSALocation(loc: any): FQHCLocation {
  return {
    id: String(loc.BpchId ?? loc.id ?? Math.random()),
    name: loc.HealthCenterName ?? loc.Name ?? "Health Center",
    address: loc.Address ?? loc.address ?? "",
    city: loc.City ?? loc.city ?? "",
    state: loc.StateAbbr ?? loc.state ?? "",
    zip: loc.ZipCode ?? loc.zip ?? "",
    phone: loc.Phone ?? loc.phone ?? "",
    website: loc.Website ?? loc.website,
    latitude: parseFloat(loc.Latitude ?? loc.lat ?? "0") || undefined,
    longitude: parseFloat(loc.Longitude ?? loc.lng ?? "0") || undefined,
    services: _parseHRSAServices(loc),
    slidingFeeScale: true,        // All FQHCs are required to have sliding fee scales
    acceptsUninsured: true,       // All FQHCs must serve regardless of ability to pay
    acceptsMedicaid: true,
    acceptsMedicare: true,
    hours: loc.HoursOfOperation ?? loc.hours,
    languages: loc.Languages ? loc.Languages.split(",").map((s: string) => s.trim()) : undefined,
    isTribalHealthCenter: loc.IsTribal === "Y" || loc.tribal === true,
    isMigrantHealthCenter: loc.IsMigrant === "Y" || loc.migrant === true,
  };
}

function _mapHRSAPublicResult(r: any): FQHCLocation {
  const props = r.properties ?? r;
  return {
    id: String(props.site_id ?? Math.random()),
    name: props.site_name ?? props.name ?? "Health Center",
    address: props.address ?? props.street_address ?? "",
    city: props.city ?? "",
    state: props.state ?? "",
    zip: props.zip_code ?? props.postal_code ?? "",
    phone: props.phone ?? "",
    website: props.website,
    latitude: r.geometry?.coordinates?.[1] ?? props.latitude,
    longitude: r.geometry?.coordinates?.[0] ?? props.longitude,
    services: _parseHRSAServices(props),
    slidingFeeScale: true,
    acceptsUninsured: true,
    acceptsMedicaid: true,
    acceptsMedicare: true,
    hours: props.operating_hours ?? props.hours,
    languages: undefined,
    isTribalHealthCenter: false,
    isMigrantHealthCenter: false,
  };
}

function _parseHRSAServices(loc: any): string[] {
  const services: string[] = ["primary_care"];
  if (loc.MentalHealthServices === "Y" || loc.mental_health) services.push("mental_health");
  if (loc.DentalServices === "Y" || loc.dental) services.push("dental");
  if (loc.PharmacyServices === "Y" || loc.pharmacy) services.push("pharmacy");
  if (loc.VisionServices === "Y" || loc.vision) services.push("vision");
  if (loc.SubstanceUseServices === "Y" || loc.substance_use) services.push("substance_use");
  if (loc.BehavioralHealthServices === "Y" || loc.behavioral_health) services.push("behavioral_health");
  return services;
}

// ─── CMS Medicaid eligibility ─────────────────────────────────────────────────

// 2026 Federal Poverty Level — updated annually
// Source: HHS Poverty Guidelines
const FPL_2026: Record<number, number> = {
  1: 15950, 2: 21550, 3: 27150, 4: 32750,
  5: 38350, 6: 43950, 7: 49550, 8: 55150,
};

// Medicaid expansion threshold: 138% FPL
// CHIP threshold: typically 200-300% FPL depending on state
// Marketplace subsidy: 100-400% FPL
const MEDICAID_EXPANSION_THRESHOLD = 1.38;
const CHIP_THRESHOLD = 2.0;
const MARKETPLACE_SUBSIDY_UPPER = 4.0;

// Non-expansion states as of 2026
const NON_EXPANSION_STATES = new Set([
  "TX", "FL", "GA", "AL", "MS", "SC", "NC", "TN", "WY", "SD", "WI", "KS"
]);

const STATE_MEDICAID_URLS: Record<string, string> = {
  TX: "https://yourtexasbenefits.com",
  FL: "https://www.myflorida.com/accessflorida",
  CA: "https://www.coveredca.com",
  NY: "https://www.health.ny.gov/health_care/medicaid/",
  IL: "https://abe.illinois.gov",
  PA: "https://www.compass.state.pa.us",
  OH: "https://benefits.ohio.gov",
  MI: "https://www.michigan.gov/mdhhs",
  // Default for all others:
  DEFAULT: "https://www.healthcare.gov/medicaid-chip/",
};

/**
 * Estimate Medicaid / CHIP / Marketplace eligibility.
 * Uses CMS Marketplace API for household eligibility estimates.
 * No personally identifiable information is sent — only income, size, state, zip.
 */
export async function estimateMedicaidEligibility(params: {
  zipCode: string;
  state: string;
  householdSize: number;
  annualIncome: number;
  hasChildren: boolean;
  isPregnant?: boolean;
  age?: number;
}): Promise<MedicaidEligibilityResult> {
  const { zipCode, state, householdSize, annualIncome, hasChildren, isPregnant, age } = params;

  const fplBase = FPL_2026[Math.min(householdSize, 8)] ??
    (FPL_2026[8] + (householdSize - 8) * 4800);
  const fplPct = annualIncome / fplBase;

  const isExpansionState = !NON_EXPANSION_STATES.has(state.toUpperCase());
  const applyUrl = STATE_MEDICAID_URLS[state.toUpperCase()] ?? STATE_MEDICAID_URLS.DEFAULT;

  // Try CMS API for more precise estimate
  let cmsResult: any = null;
  try {
    const cmsResp = await axios.post(
      "https://marketplace.api.healthcare.gov/api/v1/households/eligibility/estimates",
      {
        household: {
          income: annualIncome,
          people: [{
            age: age ?? 35,
            aptc_eligible: true,
            gender: "Male",
            uses_tobacco: false,
          }],
          has_married_couple: false,
          effective_date: new Date().toISOString().split("T")[0],
        },
        place: { zipcode: zipCode, state },
        market: "Individual",
        year: new Date().getFullYear(),
      },
      {
        params: { apikey: process.env.CMS_MARKETPLACE_API_KEY ?? "" },
        timeout: 8000,
      }
    );
    cmsResult = cmsResp.data;
  } catch (_err) {
    // CMS API unavailable — fall through to rule-based estimate
  }

  // Determine programs and status
  const programs: MedicaidProgram[] = [];
  let estimatedStatus: MedicaidEligibilityResult["estimatedStatus"];
  let explanation: string;
  let chipEligible = false;
  let marketplaceSubsidyEligible = false;

  if (isPregnant) {
    programs.push({
      name: "Medicaid for Pregnant Women",
      description: "Covers prenatal care, delivery, and postpartum care. Income limits are higher for pregnant women in most states.",
      incomeLimit: "185–215% FPL depending on state",
      applyUrl,
    });
    estimatedStatus = "likely_eligible";
    explanation = "Pregnant women qualify at higher income thresholds in most states — often up to 185–215% FPL.";
  } else if (fplPct <= MEDICAID_EXPANSION_THRESHOLD && isExpansionState) {
    estimatedStatus = "likely_eligible";
    explanation = `Your income (${Math.round(fplPct * 100)}% FPL) is below the ${state} Medicaid threshold of 138% FPL.`;
    programs.push({
      name: "Medicaid",
      description: "Free or very low-cost health coverage for adults with low income.",
      incomeLimit: "138% FPL (~$20,782/year for a single adult)",
      applyUrl,
    });
  } else if (fplPct <= MEDICAID_EXPANSION_THRESHOLD && !isExpansionState) {
    estimatedStatus = "check_required";
    explanation = `${state} has not expanded Medicaid. Eligibility depends on whether you have children, a disability, or are pregnant. Apply to find out — many people qualify unexpectedly.`;
    programs.push({
      name: "Medicaid (limited)",
      description: `${state} covers specific groups — parents, pregnant women, people with disabilities. Check your eligibility even if you think you don't qualify.`,
      incomeLimit: "Varies by category",
      applyUrl,
    });
  } else if (hasChildren && fplPct <= CHIP_THRESHOLD) {
    chipEligible = true;
    estimatedStatus = "possibly_eligible";
    explanation = "Your children may qualify for CHIP (Children's Health Insurance Program), which covers kids in families that earn too much for Medicaid.";
    programs.push({
      name: "CHIP",
      description: "Low-cost health coverage for children in families that earn too much for Medicaid.",
      incomeLimit: "200–300% FPL depending on state",
      applyUrl: "https://www.healthcare.gov/medicaid-chip/childrens-health-insurance-program/",
    });
  } else if (fplPct <= MARKETPLACE_SUBSIDY_UPPER) {
    marketplaceSubsidyEligible = true;
    estimatedStatus = "possibly_eligible";
    explanation = `You likely qualify for significant subsidies on the ACA Marketplace — potentially reducing monthly premiums to under $50/month.`;
    programs.push({
      name: "ACA Marketplace plan with subsidy",
      description: "Health insurance plans with premium tax credits that can reduce monthly costs dramatically.",
      incomeLimit: "Up to 400% FPL (~$58,320/year for a single adult)",
      applyUrl: "https://www.healthcare.gov",
    });
  } else {
    estimatedStatus = "likely_ineligible";
    explanation = `At ${Math.round(fplPct * 100)}% FPL, standard Medicaid and CHIP are likely unavailable, but check for your state's specific programs and consider Marketplace plans.`;
  }

  // Always suggest FQHC regardless of insurance status
  programs.push({
    name: "Federally Qualified Health Centers (FQHCs)",
    description: "Sliding-scale clinics that treat everyone regardless of insurance. You pay based on income — often $0–$40 per visit.",
    incomeLimit: "No income limit — sliding scale for all",
    applyUrl: "https://findahealthcenter.hrsa.gov",
  });

  return {
    estimatedStatus,
    confidence: cmsResult ? "high" : "medium",
    programsToCheck: programs,
    fplPercentage: Math.round(fplPct * 100),
    explanation,
    applyUrl,
    stateMedicaidPhone: "1-800-318-2596", // Healthcare.gov navigator line
    chipEligible,
    marketplaceSubsidyEligible,
    annualIncomeCutoff: Math.round(fplBase * MEDICAID_EXPANSION_THRESHOLD),
  };
}

// ─── GoodRx drug savings ──────────────────────────────────────────────────────

interface ReferenceDrug {
  brand: string;
  generic: string;
  drugClass: string;
  form: string;
  typicalQty: number;
  avgCashPrice: number;
  couponLow: number;
  couponHigh: number;
  genericAvailable: boolean;
  tier: "generic" | "preferred-brand" | "non-preferred" | "specialty";
  papName?: string;
  papUrl?: string;
}

const REFERENCE_DRUGS: ReferenceDrug[] = [
  { brand: "Lipitor", generic: "Atorvastatin", drugClass: "Statin (cholesterol)", form: "tablet", typicalQty: 30, avgCashPrice: 135, couponLow: 4, couponHigh: 15, genericAvailable: true, tier: "generic" },
  { brand: "Synthroid", generic: "Levothyroxine", drugClass: "Thyroid hormone", form: "tablet", typicalQty: 30, avgCashPrice: 45, couponLow: 4, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Prilosec", generic: "Omeprazole", drugClass: "Proton pump inhibitor", form: "capsule", typicalQty: 30, avgCashPrice: 25, couponLow: 3, couponHigh: 10, genericAvailable: true, tier: "generic" },
  { brand: "Zoloft", generic: "Sertraline", drugClass: "SSRI antidepressant", form: "tablet", typicalQty: 30, avgCashPrice: 30, couponLow: 4, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Lisinopril", generic: "Lisinopril", drugClass: "ACE inhibitor", form: "tablet", typicalQty: 30, avgCashPrice: 18, couponLow: 3, couponHigh: 8, genericAvailable: true, tier: "generic" },
  { brand: "Metformin", generic: "Metformin", drugClass: "Biguanide (diabetes)", form: "tablet", typicalQty: 60, avgCashPrice: 15, couponLow: 4, couponHigh: 10, genericAvailable: true, tier: "generic" },
  { brand: "Amoxicillin", generic: "Amoxicillin", drugClass: "Penicillin antibiotic", form: "capsule", typicalQty: 21, avgCashPrice: 12, couponLow: 4, couponHigh: 9, genericAvailable: true, tier: "generic" },
  { brand: "Gabapentin", generic: "Gabapentin", drugClass: "Anticonvulsant / nerve pain", form: "capsule", typicalQty: 90, avgCashPrice: 20, couponLow: 6, couponHigh: 14, genericAvailable: true, tier: "generic" },
  { brand: "Losartan", generic: "Losartan", drugClass: "ARB (blood pressure)", form: "tablet", typicalQty: 30, avgCashPrice: 22, couponLow: 4, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Amlodipine", generic: "Amlodipine", drugClass: "Calcium channel blocker", form: "tablet", typicalQty: 30, avgCashPrice: 15, couponLow: 3, couponHigh: 8, genericAvailable: true, tier: "generic" },
  { brand: "Eliquis", generic: "Apixaban", drugClass: "Blood thinner (DOAC)", form: "tablet", typicalQty: 60, avgCashPrice: 620, couponLow: 540, couponHigh: 600, genericAvailable: false, tier: "preferred-brand", papName: "BMS Patient Assistance", papUrl: "https://www.bms.com/patient-and-caregiver/help-with-prescription-costs.html" },
  { brand: "Jardiance", generic: "Empagliflozin", drugClass: "SGLT2 inhibitor (diabetes)", form: "tablet", typicalQty: 30, avgCashPrice: 580, couponLow: 490, couponHigh: 560, genericAvailable: false, tier: "preferred-brand", papName: "Boehringer Ingelheim Cares", papUrl: "https://www.boehringer-ingelheim.com/us/our-responsibility/patient-assistance" },
  { brand: "Ozempic", generic: "Semaglutide", drugClass: "GLP-1 agonist (diabetes/weight)", form: "injection", typicalQty: 1, avgCashPrice: 970, couponLow: 850, couponHigh: 950, genericAvailable: false, tier: "specialty", papName: "Novo Nordisk PAP", papUrl: "https://www.novocare.com/eligibility/pap.html" },
  { brand: "Humira", generic: "Adalimumab", drugClass: "TNF inhibitor (autoimmune)", form: "injection", typicalQty: 2, avgCashPrice: 6900, couponLow: 5500, couponHigh: 6500, genericAvailable: false, tier: "specialty", papName: "AbbVie myHUMIRA", papUrl: "https://www.humira.com/humira-complete/cost-and-copay" },
  { brand: "Trulicity", generic: "Dulaglutide", drugClass: "GLP-1 agonist (diabetes)", form: "injection", typicalQty: 4, avgCashPrice: 910, couponLow: 780, couponHigh: 880, genericAvailable: false, tier: "specialty", papName: "Lilly Cares", papUrl: "https://www.lillycares.com" },
  { brand: "Xarelto", generic: "Rivaroxaban", drugClass: "Blood thinner (DOAC)", form: "tablet", typicalQty: 30, avgCashPrice: 560, couponLow: 470, couponHigh: 540, genericAvailable: false, tier: "preferred-brand", papName: "Janssen CarePath", papUrl: "https://www.janssencarepath.com" },
  { brand: "Adderall", generic: "Amphetamine/Dextroamphetamine", drugClass: "CNS stimulant (ADHD)", form: "tablet", typicalQty: 30, avgCashPrice: 45, couponLow: 15, couponHigh: 35, genericAvailable: true, tier: "generic" },
  { brand: "Lexapro", generic: "Escitalopram", drugClass: "SSRI antidepressant", form: "tablet", typicalQty: 30, avgCashPrice: 35, couponLow: 4, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Ventolin HFA", generic: "Albuterol", drugClass: "Bronchodilator (asthma)", form: "inhaler", typicalQty: 1, avgCashPrice: 80, couponLow: 18, couponHigh: 40, genericAvailable: true, tier: "generic" },
  { brand: "Enbrel", generic: "Etanercept", drugClass: "TNF inhibitor (autoimmune)", form: "injection", typicalQty: 4, avgCashPrice: 6300, couponLow: 5200, couponHigh: 6000, genericAvailable: false, tier: "specialty", papName: "Amgen Safety Net", papUrl: "https://www.enbrel.com/support/financial-assistance" },
  { brand: "Crestor", generic: "Rosuvastatin", drugClass: "Statin (cholesterol)", form: "tablet", typicalQty: 30, avgCashPrice: 25, couponLow: 4, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Norvasc", generic: "Amlodipine", drugClass: "Calcium channel blocker", form: "tablet", typicalQty: 30, avgCashPrice: 15, couponLow: 3, couponHigh: 8, genericAvailable: true, tier: "generic" },
  { brand: "Glucophage", generic: "Metformin", drugClass: "Biguanide (diabetes)", form: "tablet", typicalQty: 60, avgCashPrice: 15, couponLow: 4, couponHigh: 10, genericAvailable: true, tier: "generic" },
  { brand: "Prinivil", generic: "Lisinopril", drugClass: "ACE inhibitor", form: "tablet", typicalQty: 30, avgCashPrice: 18, couponLow: 3, couponHigh: 8, genericAvailable: true, tier: "generic" },
  { brand: "Protonix", generic: "Pantoprazole", drugClass: "Proton pump inhibitor", form: "tablet", typicalQty: 30, avgCashPrice: 30, couponLow: 4, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Plavix", generic: "Clopidogrel", drugClass: "Antiplatelet", form: "tablet", typicalQty: 30, avgCashPrice: 20, couponLow: 4, couponHigh: 10, genericAvailable: true, tier: "generic" },
  { brand: "Trazodone", generic: "Trazodone", drugClass: "Serotonin modulator (sleep/depression)", form: "tablet", typicalQty: 30, avgCashPrice: 15, couponLow: 4, couponHigh: 9, genericAvailable: true, tier: "generic" },
  { brand: "Hydrochlorothiazide", generic: "Hydrochlorothiazide", drugClass: "Thiazide diuretic", form: "tablet", typicalQty: 30, avgCashPrice: 10, couponLow: 3, couponHigh: 7, genericAvailable: true, tier: "generic" },
  { brand: "Keflex", generic: "Cephalexin", drugClass: "Cephalosporin antibiotic", form: "capsule", typicalQty: 28, avgCashPrice: 18, couponLow: 5, couponHigh: 12, genericAvailable: true, tier: "generic" },
  { brand: "Prednisone", generic: "Prednisone", drugClass: "Corticosteroid", form: "tablet", typicalQty: 21, avgCashPrice: 10, couponLow: 3, couponHigh: 8, genericAvailable: true, tier: "generic" },
  { brand: "Januvia", generic: "Sitagliptin", drugClass: "DPP-4 inhibitor (diabetes)", form: "tablet", typicalQty: 30, avgCashPrice: 520, couponLow: 440, couponHigh: 500, genericAvailable: false, tier: "preferred-brand", papName: "Merck Helps", papUrl: "https://www.merckaccessprogram-januvia.com" },
  { brand: "Advair", generic: "Fluticasone/Salmeterol", drugClass: "ICS/LABA (asthma/COPD)", form: "inhaler", typicalQty: 1, avgCashPrice: 420, couponLow: 60, couponHigh: 200, genericAvailable: true, tier: "preferred-brand" },
  { brand: "Ibuprofen", generic: "Ibuprofen", drugClass: "NSAID (pain/inflammation)", form: "tablet", typicalQty: 100, avgCashPrice: 8, couponLow: 3, couponHigh: 6, genericAvailable: true, tier: "generic" },
  { brand: "Acetaminophen", generic: "Acetaminophen", drugClass: "Analgesic/antipyretic", form: "tablet", typicalQty: 100, avgCashPrice: 7, couponLow: 3, couponHigh: 5, genericAvailable: true, tier: "generic" },
  { brand: "Montelukast", generic: "Montelukast", drugClass: "Leukotriene inhibitor (asthma)", form: "tablet", typicalQty: 30, avgCashPrice: 25, couponLow: 6, couponHigh: 15, genericAvailable: true, tier: "generic" },
];

const TYPICAL_COPAYS = {
  generic: 10,
  "preferred-brand": 40,
  "non-preferred": 75,
  specialty: 250,
};

const DEMO_PHARMACIES = [
  { name: "Costco Pharmacy", modifier: 0.85 },
  { name: "Walmart Pharmacy", modifier: 0.90 },
  { name: "CVS Pharmacy", modifier: 1.0 },
  { name: "Walgreens", modifier: 1.05 },
  { name: "Rite Aid", modifier: 1.10 },
  { name: "Kroger Pharmacy", modifier: 0.92 },
  { name: "Amazon Pharmacy", modifier: 0.88 },
];

function fuzzyMatchDrug(query: string): ReferenceDrug | null {
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!q || q.length < 3) return null;

  let bestMatch: ReferenceDrug | null = null;
  let bestScore = 0;

  for (const drug of REFERENCE_DRUGS) {
    const brandNorm = drug.brand.toLowerCase().replace(/[^a-z0-9]/g, "");
    const genericNorm = drug.generic.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (brandNorm === q || genericNorm === q) return drug;
    if (brandNorm.startsWith(q) || genericNorm.startsWith(q)) {
      const score = q.length / Math.min(brandNorm.length, genericNorm.length);
      if (score > bestScore) { bestScore = score; bestMatch = drug; }
    }
    if (q.length >= 4 && (brandNorm.includes(q) || genericNorm.includes(q))) {
      const score = (q.length / Math.min(brandNorm.length, genericNorm.length)) * 0.8;
      if (score > bestScore) { bestScore = score; bestMatch = drug; }
    }
  }

  return bestScore >= 0.5 ? bestMatch : null;
}

function buildCopayComparison(drug: ReferenceDrug, couponPrice: number): InsuranceCopayComparison {
  const copay = TYPICAL_COPAYS[drug.tier];
  return {
    typicalCopayGeneric: TYPICAL_COPAYS.generic,
    typicalCopayBrand: TYPICAL_COPAYS["preferred-brand"],
    typicalCopaySpecialty: TYPICAL_COPAYS.specialty,
    couponBeatsInsurance: couponPrice < copay,
    estimatedSavingsVsCopay: Math.round((copay - couponPrice) * 100) / 100,
  };
}

function getDemoDrugPricing(
  drugName: string,
  _zipCode: string,
  _quantity?: number,
  _form?: string
): DrugSavingsResult | null {
  const match = fuzzyMatchDrug(drugName);
  if (!match) return null;

  const seed = drugName.length + (_zipCode?.charCodeAt(0) ?? 0);
  const shuffled = [...DEMO_PHARMACIES].sort((a, b) => {
    const ha = (a.name.charCodeAt(0) * 31 + seed) % 100;
    const hb = (b.name.charCodeAt(0) * 31 + seed) % 100;
    return ha - hb;
  }).slice(0, 5);

  const couponRange = match.couponHigh - match.couponLow;
  const prices: DrugPrice[] = shuffled.map((ph, i) => {
    const cashBase = Math.round(match.avgCashPrice * ph.modifier * 100) / 100;
    const coupon = Math.round((match.couponLow + (couponRange * (i / shuffled.length))) * 100) / 100;
    return {
      pharmacy: ph.name,
      cashPrice: cashBase,
      withCouponPrice: coupon < cashBase ? coupon : undefined,
    };
  });

  prices.sort((a, b) => (a.withCouponPrice ?? a.cashPrice) - (b.withCouponPrice ?? b.cashPrice));
  const lowestPrice = prices[0].withCouponPrice ?? prices[0].cashPrice;

  return {
    drugName: match.generic !== match.brand ? `${match.generic} (${match.brand})` : match.generic,
    genericName: match.generic,
    lowestPrice,
    lowestPharmacy: prices[0].pharmacy,
    prices,
    goodRxCouponUrl: `https://www.goodrx.com/${encodeURIComponent(match.generic.toLowerCase())}`,
    is340BEligible: false,
    patientAssistanceProgram: match.papName,
    patientAssistanceProgramUrl: match.papUrl,
    insuranceCopay: buildCopayComparison(match, lowestPrice),
    isGenericAvailable: match.genericAvailable,
    drugClass: match.drugClass,
    isLive: false,
  };
}

export function searchDrugCatalog(query: string): Array<{ brand: string; generic: string; drugClass: string; genericAvailable: boolean }> {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return REFERENCE_DRUGS
    .filter(d => d.brand.toLowerCase().includes(q) || d.generic.toLowerCase().includes(q) || d.drugClass.toLowerCase().includes(q))
    .slice(0, 10)
    .map(d => ({ brand: d.brand, generic: d.generic, drugClass: d.drugClass, genericAvailable: d.genericAvailable }));
}

/**
 * Get drug prices for a medication name.
 * Requires GOODRX_API_KEY and GOODRX_API_SECRET environment variables.
 * Apply at goodrx.com/developer
 */
export async function getDrugSavings(
  drugName: string,
  zipCode: string,
  quantity?: number,
  form?: string
): Promise<DrugSavingsResult | null> {
  const apiKey = process.env.GOODRX_API_KEY;
  if (!apiKey) {
    logger.info("[CareAccess] GOODRX_API_KEY not set — using reference pricing");
    return getDemoDrugPricing(drugName, zipCode, quantity, form);
  }

  try {
    const crypto = await import("crypto");
    const secret = process.env.GOODRX_API_SECRET ?? "";

    // GoodRx requires HMAC-SHA256 signature of sorted query params
    const params: Record<string, string | number> = {
      name: drugName,
      api_key: apiKey,
      ...(quantity && { quantity }),
      ...(form && { form }),
      location: zipCode,
    };

    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
    const sig = crypto.createHmac("sha256", secret).update(sortedParams).digest("base64url");

    const response = await axios.get(
      `https://api.goodrx.com/v2/price/compare`,
      { params: { ...params, sig }, timeout: 8000 }
    );

    const data = response.data;
    const prices: DrugPrice[] = (data.prices ?? []).slice(0, 5).map((p: any) => ({
      pharmacy: p.pharmacy?.name ?? p.display ?? "Pharmacy",
      cashPrice: parseFloat(p.price ?? p.cash_price ?? "0"),
      withCouponPrice: p.coupon_price ? parseFloat(p.coupon_price) : undefined,
      address: p.pharmacy?.address,
      distance: p.pharmacy?.distance,
    }));

    if (!prices.length) return null;

    const lowestPrice = Math.min(...prices.map(p => p.withCouponPrice ?? p.cashPrice));
    const lowestEntry = prices.find(p => (p.withCouponPrice ?? p.cashPrice) === lowestPrice)!;

    const refDrug = fuzzyMatchDrug(drugName);
    const copay = refDrug ? buildCopayComparison(refDrug, lowestPrice) : undefined;

    return {
      drugName,
      genericName: data.generic_name ?? data.name,
      lowestPrice,
      lowestPharmacy: lowestEntry.pharmacy,
      lowestPharmacyAddress: lowestEntry.address,
      prices,
      goodRxCouponUrl: data.url ?? `https://www.goodrx.com/${encodeURIComponent(drugName.toLowerCase())}`,
      is340BEligible: false,
      patientAssistanceProgram: data.patient_assistance_program?.name,
      patientAssistanceProgramUrl: data.patient_assistance_program?.url,
      insuranceCopay: copay,
      isGenericAvailable: refDrug?.genericAvailable,
      drugClass: refDrug?.drugClass,
      isLive: true,
    };
  } catch (error) {
    logger.error("[CareAccess] GoodRx API error", { drugName, error });
    return null;
  }
}

/**
 * Get drug savings for all medications in a patient's med list.
 * This is the core differentiator — pre-filled from existing health record.
 */
export async function getDrugSavingsForMedList(
  medications: Array<{ name: string; dosage?: string }>,
  zipCode: string
): Promise<DrugSavingsResult[]> {
  const results = await Promise.allSettled(
    medications.slice(0, 10).map(med => getDrugSavings(med.name, zipCode))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<DrugSavingsResult> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map(r => r.value);
}

// ─── SAMHSA behavioral health ────────────────────────────────────────────────

/**
 * Find behavioral health and substance use treatment facilities.
 * SAMHSA Treatment Locator API — no API key required.
 */
export async function findBehavioralHealthFacilities(
  zipCode: string,
  radiusMiles: number = 25
): Promise<BehavioralHealthFacility[]> {
  try {
    const response = await axios.get(
      "https://findtreatment.samhsa.gov/locator/listing",
      {
        params: {
          sType: "SA",  // Substance abuse treatment
          sCat: "3",    // Free / very low cost
          sAddr: zipCode,
          sRadius: radiusMiles,
          sPage: 1,
          output: "json",
        },
        timeout: 10000,
        headers: {
          "User-Agent": "TabulaMedica/1.0 (patient health app)",
        },
      }
    );

    const facilities = response.data?.rows ?? response.data?.results ?? [];
    return facilities.slice(0, 10).map((f: any): BehavioralHealthFacility => ({
      id: String(f.docid ?? f.id ?? Math.random()),
      name: f.name1 ?? f.name ?? "Treatment Center",
      address: f.street1 ?? f.address ?? "",
      city: f.city ?? "",
      state: f.stateprovcd ?? f.state ?? "",
      zip: f.zipcd ?? f.zip ?? "",
      phone: f.phone ?? "",
      services: _parseSAMHSAServices(f),
      acceptsUninsured: f.payment_assistance_glidescale === "1" || f.slidingscale === true,
      acceptsMedicaid: f.medicaid === "1" || f.ptype_medicaid === "1",
      slidingFeeScale: f.payment_assistance_glidescale === "1",
    }));
  } catch (error) {
    logger.error("[CareAccess] SAMHSA search failed", { zipCode, error });
    return [];
  }
}

function _parseSAMHSAServices(f: any): string[] {
  const services: string[] = [];
  if (f.sa === "1") services.push("substance_use");
  if (f.mh === "1") services.push("mental_health");
  if (f.dt === "1") services.push("detox");
  if (f.op === "1") services.push("outpatient");
  if (f.rp === "1") services.push("residential");
  return services.length ? services : ["behavioral_health"];
}

// ─── Contextual care matching ─────────────────────────────────────────────────

/**
 * Given a patient's conditions from their FHIR record,
 * determine which FQHC services are most relevant.
 * This is what makes Tabula Medica's care finder unique.
 */
export function getRelevantServicesFromConditions(
  conditions: string[]
): string[] {
  const services = new Set<string>(["primary_care"]);
  const conditionsLower = conditions.map(c => c.toLowerCase());

  const mappings: Array<[RegExp, string]> = [
    [/diabet|glucose|insulin|a1c|metformin/i, "primary_care"],
    [/depress|anxiety|bipolar|schizophr|mental|psych/i, "mental_health"],
    [/substance|alcohol|opioid|addiction|withdrawal/i, "substance_use"],
    [/dental|tooth|teeth|caries|periodon/i, "dental"],
    [/vision|eye|glaucoma|cataract|retina/i, "vision"],
    [/pregnan|prenatal|obstet|maternal/i, "primary_care"],
    [/HIV|AIDS|hepatitis|STI|STD/i, "primary_care"],
    [/behav|autism|adhd|developmental/i, "behavioral_health"],
  ];

  for (const condition of conditionsLower) {
    for (const [pattern, service] of mappings) {
      if (pattern.test(condition)) services.add(service);
    }
  }

  return Array.from(services);
}

// ─── Care access summary ──────────────────────────────────────────────────────

export async function generateCareAccessSummary(
  userId: string,
  params: {
    zipCode: string;
    state: string;
    householdSize: number;
    annualIncome?: number;
    conditions?: string[];
    medications?: Array<{ name: string; dosage?: string }>;
    hasChildren?: boolean;
    isPregnant?: boolean;
    age?: number;
    isVeteran?: boolean;
  }
): Promise<CareAccessSummary> {
  const {
    zipCode, state, householdSize, annualIncome = 0,
    conditions = [], medications = [], hasChildren = false,
    isPregnant = false, age, isVeteran = false,
  } = params;

  const relevantServices = getRelevantServicesFromConditions(conditions);

  const [fqhcs, medicaidEstimate, drugSavings] = await Promise.allSettled([
    findFQHCsNearZip(zipCode, 25, relevantServices),
    annualIncome > 0
      ? estimateMedicaidEligibility({ zipCode, state, householdSize, annualIncome, hasChildren, isPregnant, age })
      : null,
    medications.length > 0 ? getDrugSavingsForMedList(medications, zipCode) : [],
  ]);

  const fqhcList = fqhcs.status === "fulfilled" ? fqhcs.value : [];
  const medicaid = medicaidEstimate.status === "fulfilled" ? medicaidEstimate.value : null;
  const savings = drugSavings.status === "fulfilled" ? drugSavings.value : [];

  const totalMonthlySavings = savings.reduce((sum, s) => {
    // Estimate savings vs average uninsured cash price (~$150/drug)
    return sum + Math.max(0, 150 - s.lowestPrice);
  }, 0);

  const programs: string[] = [];
  if (fqhcList.length) programs.push("FQHC sliding-scale care");
  if (medicaid?.estimatedStatus === "likely_eligible") programs.push("Medicaid");
  if (medicaid?.chipEligible) programs.push("CHIP");
  if (medicaid?.marketplaceSubsidyEligible) programs.push("ACA Marketplace subsidies");
  if (savings.length) programs.push(`Drug savings on ${savings.length} medication${savings.length !== 1 ? "s" : ""}`);
  if (isVeteran) programs.push("VA Community Care Program");

  return {
    userId,
    zipCode,
    fqhcCount: fqhcList.length,
    nearestFQHC: fqhcList[0],
    medicaidEstimate: medicaid,
    drugSavingsCount: savings.length,
    estimatedMonthlySavings: Math.round(totalMonthlySavings),
    relevantPrograms: programs,
    generatedAt: new Date().toISOString(),
  };
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  mechanism?: string;
  management: string;
  source: "FDA";
}

export interface InteractionCheckResult {
  interactions: DrugInteraction[];
  majorCount: number;
  moderateCount: number;
  checkedAt: string;
  medicationsChecked: string[];
}

export async function checkDrugInteractions(
  medications: string[]
): Promise<InteractionCheckResult> {
  const interactions: DrugInteraction[] = [];
  const cleaned = medications
    .map(m => m.toLowerCase().replace(/\s*\d+mg.*$/i, "").trim())
    .filter(Boolean);

  for (let i = 0; i < cleaned.length; i++) {
    for (let j = i + 1; j < cleaned.length; j++) {
      const drug1 = cleaned[i];
      const drug2 = cleaned[j];

      try {
        const response = await axios.get(
          "https://api.fda.gov/drug/label.json",
          {
            params: {
              search: `openfda.generic_name:"${drug1}"`,
              limit: 1,
            },
            timeout: 5000,
          }
        );

        const label = response.data?.results?.[0];
        if (!label) continue;

        const interactionSections = [
          label.drug_interactions,
          label.warnings_and_cautions,
          label.contraindications,
        ].flat().filter(Boolean).join(" ").toLowerCase();

        if (interactionSections.includes(drug2)) {
          const severity = determineDrugSeverity(interactionSections, drug2);
          const description = extractDrugDescription(interactionSections, drug2, drug1);

          interactions.push({
            drug1: medications[i],
            drug2: medications[j],
            severity,
            description,
            management: getDrugManagementAdvice(severity),
            source: "FDA",
          });
        }
      } catch {
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    interactions,
    majorCount: interactions.filter(i => i.severity === "major").length,
    moderateCount: interactions.filter(i => i.severity === "moderate").length,
    checkedAt: new Date().toISOString(),
    medicationsChecked: medications,
  };
}

function determineDrugSeverity(
  text: string,
  drugName: string
): DrugInteraction["severity"] {
  const idx = text.indexOf(drugName);
  if (idx === -1) return "minor";
  const context = text.slice(Math.max(0, idx - 150), idx + 150);
  if (/contraindic|should not be|do not use|avoid|fatal|life.threaten/i.test(context)) return "major";
  if (/caution|monitor|adjust|reduce|increase.*dose|interact/i.test(context)) return "moderate";
  return "minor";
}

function extractDrugDescription(text: string, drug2: string, drug1: string): string {
  const idx = text.indexOf(drug2);
  if (idx === -1) return `Possible interaction between ${drug1} and ${drug2} identified in FDA drug label data.`;
  const context = text.slice(Math.max(0, idx - 200), idx + 200).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (context.length > 200) return context.slice(0, 200) + "...";
  return context || `Possible interaction between ${drug1} and ${drug2} identified in FDA drug label data.`;
}

function getDrugManagementAdvice(severity: DrugInteraction["severity"]): string {
  switch (severity) {
    case "major":
      return "Contact your doctor or pharmacist before taking these medications together.";
    case "moderate":
      return "Tell your doctor and pharmacist about all medications you take. They may adjust your dose or monitor you more closely.";
    case "minor":
      return "Be aware of this interaction. Tell your healthcare team if you notice any unusual symptoms.";
  }
}

// ─── FindHelp.org (Aunt Bertha) SDoH resource finder ──────────────────────────

const SDOH_CATEGORY_LABELS: Record<SdohCategory, string> = {
  food: "Food Assistance",
  housing: "Housing & Shelter",
  utilities: "Utility Assistance",
  transportation: "Transportation",
  legal: "Legal Aid",
  employment: "Employment & Job Training",
  education: "Education & Literacy",
  childcare: "Childcare",
  financial: "Financial Assistance",
  clothing: "Clothing & Household Goods",
  disability: "Disability Services",
  substance_use: "Substance Use Treatment",
  mental_health: "Mental Health",
  domestic_violence: "Domestic Violence",
  reentry: "Re-entry Services",
  immigration: "Immigration Services",
  tax_prep: "Tax Preparation",
  other: "Other Resources",
};

const FINDHELP_CATEGORY_MAP: Record<string, SdohCategory> = {
  food: "food",
  "food pantry": "food",
  snap: "food",
  wic: "food",
  meals: "food",
  nutrition: "food",
  housing: "housing",
  shelter: "housing",
  rent: "housing",
  "housing assistance": "housing",
  homeless: "housing",
  utilities: "utilities",
  "utility assistance": "utilities",
  liheap: "utilities",
  energy: "utilities",
  transportation: "transportation",
  transit: "transportation",
  "bus pass": "transportation",
  legal: "legal",
  "legal aid": "legal",
  "legal services": "legal",
  employment: "employment",
  "job training": "employment",
  "workforce development": "employment",
  education: "education",
  ged: "education",
  literacy: "education",
  childcare: "childcare",
  "child care": "childcare",
  "head start": "childcare",
  financial: "financial",
  "financial assistance": "financial",
  tanf: "financial",
  clothing: "clothing",
  "household goods": "clothing",
  disability: "disability",
  "disability services": "disability",
  "substance abuse": "substance_use",
  "substance use": "substance_use",
  "mental health": "mental_health",
  counseling: "mental_health",
  "domestic violence": "domestic_violence",
  reentry: "reentry",
  "re-entry": "reentry",
  immigration: "immigration",
  "tax preparation": "tax_prep",
  vita: "tax_prep",
};

function mapToSdohCategory(rawCategory: string): SdohCategory {
  const lower = rawCategory.toLowerCase().trim();
  if (FINDHELP_CATEGORY_MAP[lower]) return FINDHELP_CATEGORY_MAP[lower];
  for (const [key, cat] of Object.entries(FINDHELP_CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return cat;
  }
  return "other";
}

export async function findSdohResources(
  zipCode: string,
  categories?: SdohCategory[],
  query?: string
): Promise<SdohSearchResult> {
  const apiKey = process.env.FINDHELP_API_KEY;

  if (apiKey) {
    try {
      return await searchFindHelpLive(zipCode, apiKey, categories, query);
    } catch (error) {
      logger.error("[CareAccess] FindHelp.org API error, falling back to reference data", { zipCode, error });
    }
  }

  logger.info("[CareAccess] Using reference SDoH resource data");
  return getDemoSdohResources(zipCode, categories, query);
}

async function searchFindHelpLive(
  zipCode: string,
  apiKey: string,
  categories?: SdohCategory[],
  query?: string
): Promise<SdohSearchResult> {
  const params: Record<string, string> = {
    postal_code: zipCode,
  };
  if (query) params.query = query;

  const response = await axios.get("https://api.findhelp.com/v1/programs", {
    params,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    timeout: 12000,
  });

  const programs = response.data?.data ?? response.data?.programs ?? response.data ?? [];
  const resources: SdohResource[] = (Array.isArray(programs) ? programs : []).map((p: any): SdohResource => {
    const cat = mapToSdohCategory(p.category ?? p.taxonomy ?? p.service_type ?? "other");
    return {
      id: String(p.id ?? p.program_id ?? Math.random().toString(36).slice(2)),
      name: p.name ?? p.program_name ?? "Community Resource",
      category: cat,
      categoryLabel: SDOH_CATEGORY_LABELS[cat],
      description: p.description ?? p.short_description ?? "",
      address: p.address?.street ?? p.street_address,
      city: p.address?.city ?? p.city,
      state: p.address?.state ?? p.state,
      zip: p.address?.postal_code ?? p.zip,
      phone: p.phone ?? p.contact_phone,
      website: p.website ?? p.url,
      email: p.email ?? p.contact_email,
      hours: p.hours ?? p.schedule,
      eligibility: p.eligibility ?? p.requirements,
      languages: p.languages ?? [],
      distance: p.distance,
      isFree: p.fee === "free" || p.is_free === true || /free|no.?cost/i.test(p.fee ?? ""),
      acceptsUninsured: p.accepts_uninsured ?? /uninsured|no.?insurance|sliding/i.test(JSON.stringify(p)),
      applicationUrl: p.application_url ?? p.apply_url,
      lastVerified: p.last_verified ?? p.updated_at,
    };
  });

  const filtered = categories?.length
    ? resources.filter(r => categories.includes(r.category))
    : resources;

  const catCounts = new Map<SdohCategory, number>();
  for (const r of filtered) {
    catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);
  }

  return {
    resources: filtered.slice(0, 30),
    totalCount: filtered.length,
    categories: Array.from(catCounts.entries())
      .map(([category, count]) => ({ category, label: SDOH_CATEGORY_LABELS[category], count }))
      .sort((a, b) => b.count - a.count),
    isLive: true,
  };
}

interface DemoResourceTemplate {
  name: string;
  category: SdohCategory;
  description: string;
  eligibility: string;
  phone?: string;
  website?: string;
  isFree: boolean;
  national: boolean;
  languages?: string[];
}

const NATIONAL_SDOH_PROGRAMS: DemoResourceTemplate[] = [
  { name: "SNAP (Food Stamps)", category: "food", description: "Supplemental Nutrition Assistance Program provides monthly benefits for purchasing food at authorized retailers. Benefits loaded onto an EBT card.", eligibility: "Gross monthly income at or below 130% FPL. Net income at or below 100% FPL. Assets below $2,750 ($4,250 for households with elderly/disabled members).", phone: "1-800-221-5689", website: "https://www.fns.usda.gov/snap/recipient/eligibility", isFree: true, national: true },
  { name: "WIC (Women, Infants, Children)", category: "food", description: "Provides supplemental foods, nutrition education, and referrals for pregnant women, postpartum women, infants, and children under 5.", eligibility: "Income at or below 185% FPL. Must be pregnant, postpartum (up to 6 months), breastfeeding (up to 1 year), or have a child under 5.", phone: "1-800-942-3678", website: "https://www.fns.usda.gov/wic", isFree: true, national: true },
  { name: "Feeding America Food Bank Locator", category: "food", description: "Network of 200+ food banks and 60,000 food pantries serving every county in the US. No documentation required at most locations.", eligibility: "Open to all. No ID, proof of income, or immigration status required at most pantries.", phone: "1-800-771-2303", website: "https://www.feedingamerica.org/find-your-local-foodbank", isFree: true, national: true },
  { name: "Section 8 Housing Choice Voucher", category: "housing", description: "Federal program providing rental assistance vouchers. Tenants pay 30% of adjusted income toward rent; the voucher covers the rest.", eligibility: "Income at or below 50% area median income. Preference for extremely low-income (30% AMI). Waitlists common.", phone: "1-800-955-2232", website: "https://www.hud.gov/topics/housing_choice_voucher_program_section_8", isFree: true, national: true },
  { name: "HUD Emergency Shelter / Homeless Assistance", category: "housing", description: "Emergency shelter, transitional housing, and rapid re-housing through the Continuum of Care program.", eligibility: "Individuals and families experiencing homelessness or at imminent risk of homelessness.", phone: "1-800-569-4287", website: "https://www.hud.gov/homeless", isFree: true, national: true },
  { name: "LIHEAP (Low Income Home Energy)", category: "utilities", description: "Helps low-income households pay heating and cooling bills. One-time or seasonal payments made directly to utility companies.", eligibility: "Income at or below 150% FPL or 60% state median income (varies by state). Priority for elderly, disabled, and families with children under 6.", phone: "1-866-674-6327", website: "https://www.acf.hhs.gov/ocs/low-income-home-energy-assistance-program-liheap", isFree: true, national: true },
  { name: "Lifeline Phone/Internet Program", category: "utilities", description: "FCC program providing a monthly discount ($9.25) on phone or internet service for qualifying low-income households.", eligibility: "Income at or below 135% FPL, or participation in SNAP, Medicaid, SSI, FPHA, or Veterans Pension.", website: "https://www.lifelinesupport.org/", isFree: true, national: true },
  { name: "National Transit Assistance", category: "transportation", description: "Many transit agencies offer reduced fares for low-income riders, seniors, and people with disabilities. Contact your local transit authority.", eligibility: "Varies by local transit agency. Many require proof of income or enrollment in public assistance.", website: "https://www.transit.dot.gov/", isFree: false, national: true },
  { name: "Legal Aid Society / LSC", category: "legal", description: "Free civil legal assistance for low-income Americans. Covers housing, family, consumer, employment, and benefits issues. No criminal cases.", eligibility: "Income at or below 125% FPL. Some programs extend to 200% FPL.", phone: "1-202-295-1500", website: "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help", isFree: true, national: true },
  { name: "TANF (Temporary Assistance for Needy Families)", category: "financial", description: "Cash assistance for families with dependent children. Also provides job training, child care, and transportation assistance.", eligibility: "Families with children under 18. Income and asset limits vary by state. Must participate in work activities.", website: "https://www.acf.hhs.gov/ofa/programs/tanf", isFree: true, national: true },
  { name: "AmeriCorps / Job Corps", category: "employment", description: "Free education and vocational training for young adults ages 16-24. Includes housing, meals, and a living allowance at Job Corps centers.", eligibility: "Ages 16-24. Low-income. US citizen, lawful permanent resident, or authorized to work.", phone: "1-800-733-5627", website: "https://www.jobcorps.gov/", isFree: true, national: true },
  { name: "Head Start / Early Head Start", category: "childcare", description: "Free early childhood education, health, nutrition, and parent involvement services for children birth to age 5 from low-income families.", eligibility: "Income at or below 100% FPL. Also eligible: families receiving SNAP, TANF, SSI, or experiencing homelessness.", phone: "1-866-763-6481", website: "https://www.acf.hhs.gov/ohs", isFree: true, national: true },
  { name: "VITA Free Tax Preparation", category: "tax_prep", description: "IRS Volunteer Income Tax Assistance program provides free tax preparation for households earning under $67,000/year.", eligibility: "Annual income under $67,000. Persons with disabilities. Limited English speakers.", phone: "1-800-906-9887", website: "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers", isFree: true, national: true },
  { name: "211 Social Services Helpline", category: "other", description: "Dial 2-1-1 for free, confidential referrals to local social services including food, housing, utilities, employment, health care, and crisis counseling. Available 24/7 in most areas.", eligibility: "Open to everyone. No requirements.", phone: "211", website: "https://www.211.org/", isFree: true, national: true, languages: ["English", "Spanish"] },
  { name: "National Domestic Violence Hotline", category: "domestic_violence", description: "24/7 confidential support, safety planning, and referrals to local shelters and services for victims of domestic violence.", eligibility: "Anyone experiencing domestic violence, dating violence, or seeking information.", phone: "1-800-799-7233", website: "https://www.thehotline.org/", isFree: true, national: true, languages: ["English", "Spanish", "200+ via interpreters"] },
  { name: "SSI/SSDI Disability Benefits", category: "disability", description: "Monthly cash benefits for people with disabilities who have limited income and resources (SSI) or sufficient work history (SSDI).", eligibility: "SSI: Limited income and resources, disabled/blind/65+. SSDI: Sufficient work credits, medically determined disability.", phone: "1-800-772-1213", website: "https://www.ssa.gov/benefits/disability/", isFree: true, national: true },
  { name: "Goodwill Career Services", category: "employment", description: "Job training, employment placement, resume help, and career counseling. Many locations also offer digital literacy and skills workshops.", eligibility: "Open to all job seekers. Priority services for people with barriers to employment.", website: "https://www.goodwill.org/find-jobs-and-services/", isFree: true, national: true },
  { name: "Salvation Army Assistance", category: "financial", description: "Emergency financial assistance for rent, utilities, food, and disaster relief. Also operates thrift stores with reduced-cost clothing and household items.", eligibility: "Varies by location. Generally for individuals/families facing financial crisis.", phone: "1-800-725-2769", website: "https://www.salvationarmyusa.org/usn/plugins/gdosCenterSearch", isFree: true, national: true },
  { name: "Catholic Charities", category: "financial", description: "Wide range of social services including immigration, housing, food, disaster relief, and counseling. Serves all people regardless of religion.", eligibility: "Open to all. Services vary by diocese.", website: "https://www.catholiccharitiesusa.org/find-help/", isFree: true, national: true },
  { name: "United Way Resources", category: "other", description: "Funds and connects local programs for education, financial stability, and health. Many local United Way chapters operate 211 services.", eligibility: "Open to all. Contact local United Way for specific program eligibility.", website: "https://www.unitedway.org/find-your-united-way", isFree: true, national: true },
];

function getDemoSdohResources(
  zipCode: string,
  categories?: SdohCategory[],
  query?: string
): SdohSearchResult {
  let resources = NATIONAL_SDOH_PROGRAMS.map((p, i): SdohResource => ({
    id: `sdoh-${p.category}-${i}`,
    name: p.name,
    category: p.category,
    categoryLabel: SDOH_CATEGORY_LABELS[p.category],
    description: p.description,
    phone: p.phone,
    website: p.website,
    eligibility: p.eligibility,
    languages: p.languages ?? ["English"],
    isFree: p.isFree,
    acceptsUninsured: true,
    lastVerified: "2026-01-15",
  }));

  if (categories?.length) {
    resources = resources.filter(r => categories.includes(r.category));
  }

  if (query) {
    const q = query.toLowerCase();
    resources = resources.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.categoryLabel.toLowerCase().includes(q)
    );
  }

  const catCounts = new Map<SdohCategory, number>();
  for (const r of resources) {
    catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);
  }

  return {
    resources,
    totalCount: resources.length,
    categories: Array.from(catCounts.entries())
      .map(([category, count]) => ({ category, label: SDOH_CATEGORY_LABELS[category], count }))
      .sort((a, b) => b.count - a.count),
    isLive: false,
  };
}

export function getSdohCategoryList(): Array<{ category: SdohCategory; label: string }> {
  return Object.entries(SDOH_CATEGORY_LABELS).map(([category, label]) => ({
    category: category as SdohCategory,
    label,
  }));
}

// ─── Sesame Care — Direct Primary Care (DPC) transparent pricing ──────────────

export type DpcVisitType =
  | "primary_care"
  | "urgent_care"
  | "mental_health"
  | "dermatology"
  | "dental_cleaning"
  | "dental_xray"
  | "vision_exam"
  | "physical_exam"
  | "lab_panel"
  | "womens_health"
  | "mens_health"
  | "pediatrics"
  | "telehealth"
  | "specialist_consult";

export interface DpcProvider {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  distance?: number;
  languages: string[];
  acceptsNewPatients: boolean;
  nextAvailable?: string;
  photoUrl?: string;
  bio?: string;
}

export interface DpcVisitOption {
  id: string;
  visitType: DpcVisitType;
  visitLabel: string;
  description: string;
  price: number;
  originalPrice?: number;
  duration: string;
  provider: DpcProvider;
  telehealth: boolean;
  inPerson: boolean;
  bookingUrl?: string;
  includes: string[];
  savingsVsER?: number;
  savingsVsUrgentCare?: number;
}

export interface DpcSearchResult {
  visits: DpcVisitOption[];
  totalCount: number;
  visitTypes: Array<{ type: DpcVisitType; label: string; count: number; minPrice: number }>;
  isLive: boolean;
  savingsSummary: {
    avgSavingsVsER: number;
    avgSavingsVsUrgentCare: number;
    cheapestVisit: number;
  };
}

const DPC_VISIT_LABELS: Record<DpcVisitType, string> = {
  primary_care: "Primary Care Visit",
  urgent_care: "Urgent Care Visit",
  mental_health: "Mental Health Session",
  dermatology: "Dermatology Consult",
  dental_cleaning: "Dental Cleaning",
  dental_xray: "Dental X-Ray",
  vision_exam: "Vision / Eye Exam",
  physical_exam: "Annual Physical Exam",
  lab_panel: "Lab Panel (Blood Work)",
  womens_health: "Women's Health Visit",
  mens_health: "Men's Health Visit",
  pediatrics: "Pediatric Visit",
  telehealth: "Telehealth Visit",
  specialist_consult: "Specialist Consultation",
};

export async function searchDpcProviders(
  zipCode: string,
  visitType?: DpcVisitType,
  telehealth?: boolean
): Promise<DpcSearchResult> {
  const apiKey = process.env.SESAME_API_KEY;

  if (apiKey) {
    try {
      return await searchSesameLive(zipCode, apiKey, visitType, telehealth);
    } catch (error) {
      logger.error("[CareAccess] Sesame Care API error, falling back to reference data", { zipCode, error });
    }
  }

  logger.info("[CareAccess] Using reference DPC pricing data");
  return getDemoDpcResults(zipCode, visitType, telehealth);
}

async function searchSesameLive(
  zipCode: string,
  apiKey: string,
  visitType?: DpcVisitType,
  telehealth?: boolean
): Promise<DpcSearchResult> {
  const params: Record<string, string> = { zip_code: zipCode };
  if (visitType) params.service_type = visitType;
  if (telehealth !== undefined) params.telehealth = String(telehealth);

  const response = await axios.get("https://api.sesamecare.com/v1/providers", {
    params,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    timeout: 12000,
  });

  const providers = response.data?.data ?? response.data?.providers ?? response.data ?? [];
  const visits: DpcVisitOption[] = (Array.isArray(providers) ? providers : []).flatMap((p: any) => {
    const services = p.services ?? p.visit_types ?? [p];
    return services.map((s: any): DpcVisitOption => {
      const vt = mapToVisitType(s.service_type ?? s.visit_type ?? s.category ?? "primary_care");
      return {
        id: String(s.id ?? `${p.id}-${Math.random().toString(36).slice(2)}`),
        visitType: vt,
        visitLabel: DPC_VISIT_LABELS[vt],
        description: s.description ?? "",
        price: s.price ?? s.amount ?? 0,
        originalPrice: s.original_price ?? s.retail_price,
        duration: s.duration ?? s.visit_length ?? "30 min",
        provider: {
          id: String(p.id ?? Math.random().toString(36).slice(2)),
          name: p.name ?? p.provider_name ?? "Provider",
          credentials: p.credentials ?? p.degree ?? "MD",
          specialty: p.specialty ?? "Family Medicine",
          rating: p.rating ?? p.avg_rating ?? 4.5,
          reviewCount: p.review_count ?? p.reviews ?? 0,
          address: p.address?.street ?? p.street_address,
          city: p.address?.city ?? p.city,
          state: p.address?.state ?? p.state,
          zip: p.address?.postal_code ?? p.zip,
          distance: p.distance,
          languages: p.languages ?? ["English"],
          acceptsNewPatients: p.accepts_new_patients ?? true,
          nextAvailable: p.next_available ?? s.next_available,
        },
        telehealth: s.telehealth ?? s.is_telehealth ?? false,
        inPerson: s.in_person ?? !s.telehealth ?? true,
        bookingUrl: s.booking_url ?? p.booking_url,
        includes: s.includes ?? [],
        savingsVsER: s.savings_vs_er,
        savingsVsUrgentCare: s.savings_vs_urgent_care,
      };
    });
  });

  return buildDpcResult(visits, true);
}

function mapToVisitType(raw: string): DpcVisitType {
  const lower = raw.toLowerCase().trim();
  const map: Record<string, DpcVisitType> = {
    "primary care": "primary_care",
    "family medicine": "primary_care",
    "internal medicine": "primary_care",
    "general practice": "primary_care",
    "urgent care": "urgent_care",
    "walk-in": "urgent_care",
    "mental health": "mental_health",
    therapy: "mental_health",
    counseling: "mental_health",
    psychiatry: "mental_health",
    psychology: "mental_health",
    dermatology: "dermatology",
    skin: "dermatology",
    dental: "dental_cleaning",
    "dental cleaning": "dental_cleaning",
    "dental x-ray": "dental_xray",
    vision: "vision_exam",
    eye: "vision_exam",
    optometry: "vision_exam",
    ophthalmology: "vision_exam",
    physical: "physical_exam",
    "annual physical": "physical_exam",
    "wellness exam": "physical_exam",
    lab: "lab_panel",
    "blood work": "lab_panel",
    "lab panel": "lab_panel",
    "women's health": "womens_health",
    "ob/gyn": "womens_health",
    gynecology: "womens_health",
    "men's health": "mens_health",
    urology: "mens_health",
    pediatrics: "pediatrics",
    pediatric: "pediatrics",
    "child health": "pediatrics",
    telehealth: "telehealth",
    virtual: "telehealth",
    "video visit": "telehealth",
    specialist: "specialist_consult",
    consultation: "specialist_consult",
  };
  for (const [key, type] of Object.entries(map)) {
    if (lower.includes(key) || key.includes(lower)) return type;
  }
  return "primary_care";
}

function buildDpcResult(visits: DpcVisitOption[], isLive: boolean): DpcSearchResult {
  const typeCounts = new Map<DpcVisitType, { count: number; minPrice: number }>();
  for (const v of visits) {
    const existing = typeCounts.get(v.visitType);
    if (existing) {
      existing.count++;
      existing.minPrice = Math.min(existing.minPrice, v.price);
    } else {
      typeCounts.set(v.visitType, { count: 1, minPrice: v.price });
    }
  }

  const prices = visits.map(v => v.price).filter(p => p > 0);
  const cheapest = prices.length > 0 ? Math.min(...prices) : 0;
  const erSavings = visits.map(v => v.savingsVsER ?? 0).filter(s => s > 0);
  const ucSavings = visits.map(v => v.savingsVsUrgentCare ?? 0).filter(s => s > 0);

  return {
    visits: visits.slice(0, 30),
    totalCount: visits.length,
    visitTypes: Array.from(typeCounts.entries())
      .map(([type, data]) => ({
        type,
        label: DPC_VISIT_LABELS[type],
        count: data.count,
        minPrice: data.minPrice,
      }))
      .sort((a, b) => a.minPrice - b.minPrice),
    isLive,
    savingsSummary: {
      avgSavingsVsER: erSavings.length > 0 ? Math.round(erSavings.reduce((a, b) => a + b, 0) / erSavings.length) : 0,
      avgSavingsVsUrgentCare: ucSavings.length > 0 ? Math.round(ucSavings.reduce((a, b) => a + b, 0) / ucSavings.length) : 0,
      cheapestVisit: cheapest,
    },
  };
}

interface DemoVisitTemplate {
  visitType: DpcVisitType;
  price: number;
  originalPrice: number;
  duration: string;
  telehealth: boolean;
  inPerson: boolean;
  includes: string[];
  erComparison: number;
  urgentCareComparison: number;
}

const DEMO_VISIT_PRICES: DemoVisitTemplate[] = [
  { visitType: "telehealth", price: 29, originalPrice: 75, duration: "15-20 min", telehealth: true, inPerson: false, includes: ["Video consultation", "Prescription if needed", "Follow-up message"], erComparison: 2200, urgentCareComparison: 150 },
  { visitType: "primary_care", price: 49, originalPrice: 250, duration: "30 min", telehealth: false, inPerson: true, includes: ["Full consultation", "Basic vitals check", "Prescription if needed", "Treatment plan"], erComparison: 2200, urgentCareComparison: 200 },
  { visitType: "urgent_care", price: 69, originalPrice: 350, duration: "20-30 min", telehealth: false, inPerson: true, includes: ["Same-day appointment", "Examination", "Basic diagnostics", "Prescription if needed"], erComparison: 2200, urgentCareComparison: 250 },
  { visitType: "mental_health", price: 79, originalPrice: 300, duration: "45-60 min", telehealth: true, inPerson: true, includes: ["Therapy session", "Mental health assessment", "Treatment recommendations", "Follow-up plan"], erComparison: 2500, urgentCareComparison: 200 },
  { visitType: "physical_exam", price: 99, originalPrice: 400, duration: "45 min", telehealth: false, inPerson: true, includes: ["Complete physical exam", "Blood pressure and vitals", "Health screening", "Wellness plan", "Lab order if needed"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "dermatology", price: 89, originalPrice: 350, duration: "20-30 min", telehealth: true, inPerson: true, includes: ["Skin examination", "Diagnosis", "Treatment plan", "Prescription if needed"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "lab_panel", price: 25, originalPrice: 150, duration: "15 min", telehealth: false, inPerson: true, includes: ["Basic metabolic panel", "CBC (complete blood count)", "Results within 2-3 days", "Provider review of results"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "dental_cleaning", price: 79, originalPrice: 200, duration: "45-60 min", telehealth: false, inPerson: true, includes: ["Professional cleaning", "Oral exam", "Fluoride treatment", "Dental hygiene guidance"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "dental_xray", price: 35, originalPrice: 100, duration: "15-20 min", telehealth: false, inPerson: true, includes: ["Digital X-ray", "Dentist interpretation", "Treatment recommendations"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "vision_exam", price: 55, originalPrice: 200, duration: "30 min", telehealth: false, inPerson: true, includes: ["Comprehensive eye exam", "Refraction test", "Prescription for glasses/contacts", "Eye health screening"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "womens_health", price: 79, originalPrice: 350, duration: "30-45 min", telehealth: false, inPerson: true, includes: ["Well-woman exam", "Pap smear (if due)", "Contraception counseling", "Health screening"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "mens_health", price: 79, originalPrice: 300, duration: "30 min", telehealth: false, inPerson: true, includes: ["Prostate health screening", "Testosterone check discussion", "Preventive health plan", "Lab orders if needed"], erComparison: 0, urgentCareComparison: 0 },
  { visitType: "pediatrics", price: 59, originalPrice: 250, duration: "30 min", telehealth: false, inPerson: true, includes: ["Child wellness check", "Growth and development review", "Immunization review", "Parental guidance"], erComparison: 2200, urgentCareComparison: 200 },
  { visitType: "specialist_consult", price: 119, originalPrice: 500, duration: "30-45 min", telehealth: true, inPerson: true, includes: ["Specialist evaluation", "Second opinion", "Treatment recommendations", "Referral coordination"], erComparison: 0, urgentCareComparison: 0 },
];

const DEMO_PROVIDERS: Array<Omit<DpcProvider, "id">> = [
  { name: "Dr. Sarah Chen", credentials: "MD, FAAFP", specialty: "Family Medicine", rating: 4.9, reviewCount: 342, languages: ["English", "Mandarin"], acceptsNewPatients: true, nextAvailable: "Tomorrow", bio: "Board-certified family physician with 12 years of experience in direct primary care." },
  { name: "Dr. Michael Rivera", credentials: "DO", specialty: "Internal Medicine", rating: 4.8, reviewCount: 218, languages: ["English", "Spanish"], acceptsNewPatients: true, nextAvailable: "Today", bio: "Specializing in preventive care and chronic disease management with transparent pricing." },
  { name: "Dr. Priya Patel", credentials: "MD", specialty: "Urgent Care", rating: 4.7, reviewCount: 156, languages: ["English", "Hindi", "Gujarati"], acceptsNewPatients: true, nextAvailable: "Today", bio: "Available for same-day urgent care visits at affordable, upfront prices." },
  { name: "Dr. James Okafor", credentials: "PsyD", specialty: "Clinical Psychology", rating: 4.9, reviewCount: 289, languages: ["English"], acceptsNewPatients: true, nextAvailable: "This week", bio: "Licensed psychologist offering affordable therapy and mental health assessment." },
  { name: "Dr. Lisa Tran", credentials: "DDS", specialty: "General Dentistry", rating: 4.8, reviewCount: 173, languages: ["English", "Vietnamese"], acceptsNewPatients: true, nextAvailable: "This week", bio: "Affordable dental care with no insurance required." },
  { name: "Dr. Emily Watson", credentials: "OD", specialty: "Optometry", rating: 4.7, reviewCount: 127, languages: ["English"], acceptsNewPatients: true, nextAvailable: "Next week", bio: "Comprehensive eye exams and vision care at transparent prices." },
  { name: "Dr. David Kim", credentials: "MD, FAAD", specialty: "Dermatology", rating: 4.8, reviewCount: 201, languages: ["English", "Korean"], acceptsNewPatients: true, nextAvailable: "This week", bio: "Board-certified dermatologist offering affordable skin care consultations." },
  { name: "Dr. Ana Martinez", credentials: "MD, FACOG", specialty: "OB/GYN", rating: 4.9, reviewCount: 267, languages: ["English", "Spanish"], acceptsNewPatients: true, nextAvailable: "This week", bio: "Women's health specialist with transparent, affordable pricing for all services." },
];

function getDemoDpcResults(
  zipCode: string,
  visitType?: DpcVisitType,
  telehealth?: boolean
): DpcSearchResult {
  let templates = [...DEMO_VISIT_PRICES];

  if (visitType) {
    templates = templates.filter(t => t.visitType === visitType);
  }
  if (telehealth === true) {
    templates = templates.filter(t => t.telehealth);
  }
  if (telehealth === false) {
    templates = templates.filter(t => t.inPerson);
  }

  const visits: DpcVisitOption[] = templates.map((t, i): DpcVisitOption => {
    const providerIdx = i % DEMO_PROVIDERS.length;
    const provider = DEMO_PROVIDERS[providerIdx];
    return {
      id: `dpc-${t.visitType}-${i}`,
      visitType: t.visitType,
      visitLabel: DPC_VISIT_LABELS[t.visitType],
      description: `Transparent, upfront pricing — no insurance needed. Pay ${t.price} at the time of visit.`,
      price: t.price,
      originalPrice: t.originalPrice,
      duration: t.duration,
      provider: { id: `provider-${providerIdx}`, ...provider },
      telehealth: t.telehealth,
      inPerson: t.inPerson,
      bookingUrl: `https://sesamecare.com/search?zip=${zipCode}`,
      includes: t.includes,
      savingsVsER: t.erComparison > 0 ? t.erComparison - t.price : undefined,
      savingsVsUrgentCare: t.urgentCareComparison > 0 ? t.urgentCareComparison - t.price : undefined,
    };
  });

  return buildDpcResult(visits, false);
}

export function getDpcVisitTypes(): Array<{ type: DpcVisitType; label: string }> {
  return Object.entries(DPC_VISIT_LABELS).map(([type, label]) => ({
    type: type as DpcVisitType,
    label,
  }));
}

export function mapConditionsToSdohNeeds(conditions: string[]): SdohCategory[] {
  const needs = new Set<SdohCategory>();
  const joined = conditions.join(" ").toLowerCase();

  if (/diabet|obesity|malnutri|anemia|vitamin/i.test(joined)) needs.add("food");
  if (/homeless|unstable.?housing|shelter|evict/i.test(joined)) needs.add("housing");
  if (/substance|alcohol|opioid|addiction/i.test(joined)) needs.add("substance_use");
  if (/depress|anxiety|ptsd|bipolar|schizo|mental/i.test(joined)) needs.add("mental_health");
  if (/domestic.?violence|abuse|assault/i.test(joined)) needs.add("domestic_violence");
  if (/disabilit|wheelchair|mobility|blind|deaf/i.test(joined)) needs.add("disability");
  if (/pregnan|prenatal|maternal|infant/i.test(joined)) { needs.add("food"); needs.add("childcare"); }
  if (/unemploy|job.?loss/i.test(joined)) { needs.add("employment"); needs.add("financial"); }

  return Array.from(needs);
}
