import axios from "axios";
import { logger } from "./utils/logger";

const CMS_API_BASE = "https://marketplace.api.healthcare.gov/api/v1";
const CMS_API_KEY = () => process.env.CMS_MARKETPLACE_API_KEY || "";
const PLAN_YEAR = 2026;

export interface MarketplacePlan {
  id: string;
  name: string;
  issuerName: string;
  metalLevel: "Catastrophic" | "Bronze" | "Silver" | "Gold" | "Platinum";
  type: "HMO" | "PPO" | "EPO" | "POS" | string;
  premiumBeforeSubsidy: number;
  premiumAfterSubsidy: number;
  deductible: number;
  maxOutOfPocket: number;
  hsaEligible: boolean;
  hasNationalNetwork: boolean;
  quality?: number;
  benefits: PlanBenefit[];
  urls: {
    summary: string;
    provider: string;
    formulary: string;
  };
}

export interface PlanBenefit {
  name: string;
  covered: boolean;
  copay?: string;
  coinsurance?: string;
  limitation?: string;
}

export interface SubsidyEstimate {
  aptcAmount: number;
  csrLevel: "none" | "73" | "87" | "94";
  estimatedMonthlyPremium: number;
  secondLowestSilverPlan: number;
  maxOutOfPocketReduction: boolean;
  isEligibleForMedicaid: boolean;
  isEligibleForCHIP: boolean;
  fplPercentage: number;
  explanation: string;
}

export interface HouseholdMember {
  age: number;
  gender?: "Male" | "Female";
  usesTobacco?: boolean;
  isPregnant?: boolean;
  hasMinimumEssentialCoverage?: boolean;
  relationship?: "Self" | "Spouse" | "Child" | "Dependent";
}

export interface MarketplaceSearchParams {
  zipCode: string;
  state: string;
  countyFips?: string;
  householdIncome: number;
  householdMembers: HouseholdMember[];
  market?: "Individual" | "SmallGroup";
  metalLevel?: string;
}

export interface CountyInfo {
  fips: string;
  name: string;
  state: string;
  zipCode: string;
}

const FPL_2026: Record<number, number> = {
  1: 15950, 2: 21550, 3: 27150, 4: 32750,
  5: 38350, 6: 43950, 7: 49550, 8: 55150,
};

function getFPLBase(householdSize: number): number {
  if (householdSize <= 8) return FPL_2026[householdSize];
  return FPL_2026[8] + (householdSize - 8) * 4800;
}

export async function resolveCountyFromZip(zipCode: string): Promise<CountyInfo[]> {
  const apiKey = CMS_API_KEY();

  try {
    const response = await axios.get(`${CMS_API_BASE}/counties/by/zip/${zipCode}`, {
      params: { apikey: apiKey },
      timeout: 8000,
    });

    const counties = response.data?.counties ?? [];
    return counties.map((c: any) => ({
      fips: c.fips,
      name: c.name,
      state: c.state,
      zipCode,
    }));
  } catch (error: any) {
    logger.warn("[CMS] County lookup failed, using fallback", { zipCode, error: error.message });
    return [];
  }
}

export async function getSubsidyEstimate(params: {
  zipCode: string;
  state: string;
  countyFips?: string;
  householdIncome: number;
  householdMembers: HouseholdMember[];
}): Promise<SubsidyEstimate> {
  const { zipCode, state, householdIncome, householdMembers } = params;

  const householdSize = householdMembers.length;
  const fplBase = getFPLBase(householdSize);
  const fplPct = householdIncome / fplBase;

  const apiKey = CMS_API_KEY();

  let apiResult: any = null;

  if (apiKey) {
    try {
      const people = householdMembers.map((m, idx) => ({
        age: m.age,
        aptc_eligible: true,
        gender: m.gender || "Male",
        uses_tobacco: m.usesTobacco || false,
        is_pregnant: m.isPregnant || false,
        has_mec: m.hasMinimumEssentialCoverage || false,
        relationship: idx === 0 ? "Self" : (m.relationship || "Dependent"),
      }));

      const response = await axios.post(
        `${CMS_API_BASE}/households/eligibility/estimates`,
        {
          household: {
            income: householdIncome,
            people,
            has_married_couple: householdMembers.length >= 2 && householdMembers.some(m => m.relationship === "Spouse"),
            effective_date: `${PLAN_YEAR}-01-01`,
          },
          place: {
            zipcode: zipCode,
            state: state.toUpperCase(),
            countyfips: params.countyFips || undefined,
          },
          market: "Individual",
          year: PLAN_YEAR,
        },
        {
          params: { apikey: apiKey },
          timeout: 10000,
        }
      );

      apiResult = response.data;
      logger.info("[CMS] Eligibility estimate retrieved", { zipCode, state });
    } catch (error: any) {
      logger.warn("[CMS] Eligibility API call failed", { error: error.message });
    }
  }

  if (apiResult) {
    const estimates = apiResult.estimates ?? {};
    const aptc = estimates.aptc ?? 0;
    const csr = estimates.csr ?? "none";
    const slcsp = estimates.second_lowest_cost_silver_plan?.premium ?? 0;
    const isMedicaid = estimates.is_medicaid_eligible ?? estimates.is_medicaid_chip ?? false;
    const isCHIP = estimates.is_chip_eligible ?? false;

    let csrLevel: SubsidyEstimate["csrLevel"] = "none";
    if (typeof csr === "string") {
      if (csr.includes("94")) csrLevel = "94";
      else if (csr.includes("87")) csrLevel = "87";
      else if (csr.includes("73")) csrLevel = "73";
    }

    return {
      aptcAmount: Math.round(aptc * 100) / 100,
      csrLevel,
      estimatedMonthlyPremium: Math.max(0, Math.round((slcsp - aptc) * 100) / 100),
      secondLowestSilverPlan: slcsp,
      maxOutOfPocketReduction: csrLevel !== "none",
      isEligibleForMedicaid: isMedicaid,
      isEligibleForCHIP: isCHIP,
      fplPercentage: Math.round(fplPct * 100),
      explanation: buildExplanation(fplPct, aptc, csrLevel, isMedicaid, state),
    };
  }

  return buildRuleBasedEstimate(fplPct, householdIncome, householdSize, state, householdMembers);
}

function buildRuleBasedEstimate(
  fplPct: number,
  income: number,
  householdSize: number,
  state: string,
  members: HouseholdMember[]
): SubsidyEstimate {
  const NON_EXPANSION = new Set(["TX", "FL", "GA", "AL", "MS", "SC", "TN", "WY", "SD", "WI", "KS"]);
  const isExpansion = !NON_EXPANSION.has(state.toUpperCase());
  const isMedicaid = fplPct <= 1.38 && isExpansion;
  const hasChildren = members.some(m => m.age < 19);
  const isChip = hasChildren && fplPct <= 2.0 && !isMedicaid;

  let aptcAmount = 0;
  let csrLevel: SubsidyEstimate["csrLevel"] = "none";
  let estimatedPremium = 0;

  if (!isMedicaid && !isChip && fplPct <= 4.0 && fplPct >= 1.0) {
    const benchmarkPremium = estimateBenchmarkPremium(members);
    const expectedContribution = calculateExpectedContribution(fplPct, income);
    aptcAmount = Math.max(0, Math.round((benchmarkPremium - expectedContribution) * 100) / 100);
    estimatedPremium = Math.round(expectedContribution * 100) / 100;

    if (fplPct <= 1.5) csrLevel = "94";
    else if (fplPct <= 2.0) csrLevel = "87";
    else if (fplPct <= 2.5) csrLevel = "73";
  }

  return {
    aptcAmount,
    csrLevel,
    estimatedMonthlyPremium: estimatedPremium,
    secondLowestSilverPlan: aptcAmount + estimatedPremium,
    maxOutOfPocketReduction: csrLevel !== "none",
    isEligibleForMedicaid: isMedicaid,
    isEligibleForCHIP: isChip,
    fplPercentage: Math.round(fplPct * 100),
    explanation: buildExplanation(fplPct, aptcAmount, csrLevel, isMedicaid, state),
  };
}

function estimateBenchmarkPremium(members: HouseholdMember[]): number {
  return members.reduce((sum, m) => {
    if (m.age < 21) return sum + 280;
    if (m.age < 30) return sum + 350;
    if (m.age < 40) return sum + 400;
    if (m.age < 50) return sum + 480;
    if (m.age < 60) return sum + 620;
    return sum + 820;
  }, 0);
}

function calculateExpectedContribution(fplPct: number, income: number): number {
  let pctOfIncome: number;
  if (fplPct <= 1.5) pctOfIncome = 0.02;
  else if (fplPct <= 2.0) pctOfIncome = 0.04;
  else if (fplPct <= 2.5) pctOfIncome = 0.06;
  else if (fplPct <= 3.0) pctOfIncome = 0.075;
  else if (fplPct <= 4.0) pctOfIncome = 0.085;
  else pctOfIncome = 0.085;

  return (income * pctOfIncome) / 12;
}

function buildExplanation(
  fplPct: number,
  aptc: number,
  csr: string,
  isMedicaid: boolean,
  state: string
): string {
  const pct = Math.round(fplPct * 100);

  if (isMedicaid) {
    return `At ${pct}% of the Federal Poverty Level, you likely qualify for Medicaid in ${state}. Medicaid provides free or very low-cost coverage with no monthly premiums.`;
  }

  if (aptc > 0) {
    let msg = `At ${pct}% FPL, you qualify for an estimated $${Math.round(aptc)}/month tax credit (APTC), significantly reducing your monthly premium.`;
    if (csr !== "none") {
      msg += ` You also qualify for Cost-Sharing Reductions (${csr}% actuarial value) on Silver plans, which lowers your deductibles, copays, and out-of-pocket maximum.`;
    }
    return msg;
  }

  if (pct > 400) {
    return `At ${pct}% FPL, you may not qualify for standard subsidies. However, extended ACA subsidies through 2025 legislation may still provide some assistance. Check Healthcare.gov for your exact eligibility.`;
  }

  return `Based on your income at ${pct}% of the Federal Poverty Level, explore options on Healthcare.gov for the most accurate eligibility determination.`;
}

export async function searchMarketplacePlans(params: MarketplaceSearchParams): Promise<{
  plans: MarketplacePlan[];
  totalPlans: number;
  subsidyEstimate: SubsidyEstimate;
  countyInfo?: CountyInfo;
}> {
  const { zipCode, state, householdIncome, householdMembers, metalLevel } = params;

  let countyFips = params.countyFips;
  let countyInfo: CountyInfo | undefined;

  if (!countyFips) {
    const counties = await resolveCountyFromZip(zipCode);
    if (counties.length > 0) {
      countyFips = counties[0].fips;
      countyInfo = counties[0];
    }
  }

  const subsidyEstimate = await getSubsidyEstimate({
    zipCode,
    state,
    countyFips,
    householdIncome,
    householdMembers,
  });

  const apiKey = CMS_API_KEY();
  let plans: MarketplacePlan[] = [];
  let totalPlans = 0;

  if (apiKey && !subsidyEstimate.isEligibleForMedicaid) {
    try {
      const people = householdMembers.map((m, idx) => ({
        age: m.age,
        aptc_eligible: true,
        gender: m.gender || "Male",
        uses_tobacco: m.usesTobacco || false,
        is_pregnant: m.isPregnant || false,
        has_mec: m.hasMinimumEssentialCoverage || false,
        relationship: idx === 0 ? "Self" : (m.relationship || "Dependent"),
      }));

      const searchBody: any = {
        household: {
          income: householdIncome,
          people,
          has_married_couple: householdMembers.some(m => m.relationship === "Spouse"),
          effective_date: `${PLAN_YEAR}-01-01`,
        },
        place: {
          zipcode: zipCode,
          state: state.toUpperCase(),
          ...(countyFips && { countyfips: countyFips }),
        },
        market: params.market || "Individual",
        year: PLAN_YEAR,
        limit: 10,
        offset: 0,
        order: "premium",
      };

      if (metalLevel) {
        searchBody.filter = { metal_level: metalLevel };
      }

      const response = await axios.post(
        `${CMS_API_BASE}/plans/search`,
        searchBody,
        {
          params: { apikey: apiKey },
          timeout: 15000,
        }
      );

      const data = response.data;
      totalPlans = data.total ?? 0;

      plans = (data.plans ?? []).map((p: any) => mapCMSPlan(p, subsidyEstimate.aptcAmount));

      logger.info("[CMS] Plan search completed", { zipCode, plansFound: totalPlans });
    } catch (error: any) {
      logger.warn("[CMS] Plan search API failed, using estimates", { error: error.message });
      plans = generateEstimatedPlans(subsidyEstimate, householdMembers);
    }
  } else {
    plans = generateEstimatedPlans(subsidyEstimate, householdMembers);
  }

  return {
    plans,
    totalPlans: totalPlans || plans.length,
    subsidyEstimate,
    countyInfo,
  };
}

function mapCMSPlan(p: any, aptcAmount: number): MarketplacePlan {
  const premium = p.premium ?? p.rate ?? 0;
  const afterSubsidy = Math.max(0, premium - aptcAmount);

  const benefits: PlanBenefit[] = [];
  const benefitsList = p.benefits ?? [];
  const keyBenefits = [
    "Primary Care Visit to Treat an Injury or Illness",
    "Specialist Visit",
    "Emergency Room Services",
    "Generic Drugs",
    "Preferred Brand Drugs",
    "Mental/Behavioral Health Outpatient Services",
    "Imaging (CT/PET Scans, MRIs)",
    "Laboratory Outpatient and Professional Services",
    "Preventive Care/Screening/Immunization",
  ];

  for (const b of benefitsList) {
    if (keyBenefits.some(kb => b.name?.includes(kb) || kb.includes(b.name))) {
      benefits.push({
        name: b.name,
        covered: b.covered ?? true,
        copay: b.cost_sharings?.[0]?.copay_amount
          ? `$${b.cost_sharings[0].copay_amount}`
          : undefined,
        coinsurance: b.cost_sharings?.[0]?.coinsurance_rate
          ? `${Math.round(b.cost_sharings[0].coinsurance_rate * 100)}%`
          : undefined,
      });
    }
  }

  return {
    id: p.id ?? "",
    name: p.name ?? "Unknown Plan",
    issuerName: p.issuer?.name ?? "Unknown Issuer",
    metalLevel: p.metal_level ?? "Silver",
    type: p.type ?? "HMO",
    premiumBeforeSubsidy: Math.round(premium * 100) / 100,
    premiumAfterSubsidy: Math.round(afterSubsidy * 100) / 100,
    deductible: p.deductibles?.[0]?.amount ?? p.deductible ?? 0,
    maxOutOfPocket: p.moops?.[0]?.amount ?? p.max_out_of_pocket ?? 0,
    hsaEligible: p.hsa_eligible ?? false,
    hasNationalNetwork: p.has_national_network ?? false,
    quality: p.quality_rating?.global_rating,
    benefits,
    urls: {
      summary: p.benefits_url ?? `https://www.healthcare.gov`,
      provider: p.provider_directory_url ?? "",
      formulary: p.formulary_url ?? "",
    },
  };
}

function generateEstimatedPlans(
  subsidy: SubsidyEstimate,
  members: HouseholdMember[]
): MarketplacePlan[] {
  const basePremium = estimateBenchmarkPremium(members);
  const aptc = subsidy.aptcAmount;

  const metalTiers: Array<{
    level: MarketplacePlan["metalLevel"];
    factor: number;
    deductible: number;
    oop: number;
  }> = [
    { level: "Bronze", factor: 0.7, deductible: 7500, oop: 9200 },
    { level: "Silver", factor: 1.0, deductible: 4500, oop: 9200 },
    { level: "Gold", factor: 1.3, deductible: 1500, oop: 8700 },
    { level: "Platinum", factor: 1.55, deductible: 250, oop: 3000 },
  ];

  if (subsidy.csrLevel !== "none") {
    const silver = metalTiers.find(t => t.level === "Silver")!;
    switch (subsidy.csrLevel) {
      case "94": silver.deductible = 150; silver.oop = 1200; break;
      case "87": silver.deductible = 700; silver.oop = 2800; break;
      case "73": silver.deductible = 2500; silver.oop = 6400; break;
    }
  }

  return metalTiers.map((tier, idx) => {
    const premium = Math.round(basePremium * tier.factor);
    const afterSubsidy = Math.max(0, Math.round(premium - aptc));

    return {
      id: `estimated-${tier.level.toLowerCase()}-${idx}`,
      name: `${tier.level} Plan (Estimated)`,
      issuerName: "Estimated based on your area",
      metalLevel: tier.level,
      type: "HMO",
      premiumBeforeSubsidy: premium,
      premiumAfterSubsidy: afterSubsidy,
      deductible: tier.deductible,
      maxOutOfPocket: tier.oop,
      hsaEligible: tier.level === "Bronze",
      hasNationalNetwork: false,
      quality: undefined,
      benefits: [
        { name: "Preventive Care", covered: true, copay: "$0" },
        { name: "Primary Care Visit", covered: true, copay: tier.level === "Bronze" ? "After deductible" : `$${20 + idx * 10}` },
        { name: "Emergency Room", covered: true, copay: tier.level === "Bronze" ? "After deductible" : `$${250 - idx * 50}` },
        { name: "Generic Drugs", covered: true, copay: `$${5 + idx * 5}` },
        { name: "Specialist Visit", covered: true, copay: tier.level === "Bronze" ? "After deductible" : `$${40 + idx * 10}` },
      ],
      urls: {
        summary: "https://www.healthcare.gov/see-plans/",
        provider: "",
        formulary: "",
      },
    };
  });
}
