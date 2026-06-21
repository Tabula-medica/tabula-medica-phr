import { Router } from "express";

const router = Router();

interface EligibilityResult {
  eligible: boolean;
  programs: EligibilityProgram[];
  estimatedSubsidy: number | null;
  fplPercent: number;
  marketplace: MarketplacePlan[];
}

interface EligibilityProgram {
  id: string;
  name: string;
  type: "medicaid" | "chip" | "marketplace" | "medicare";
  description: string;
  eligible: boolean;
  reason: string;
}

interface MarketplacePlan {
  id: string;
  name: string;
  metalLevel: "catastrophic" | "bronze" | "silver" | "gold" | "platinum";
  issuer: string;
  monthlyPremium: number;
  estimatedPremiumAfterSubsidy: number;
  deductible: number;
  maxOutOfPocket: number;
  copayCoverage: { primary: string; specialist: string; er: string; generic: string };
  rating: number;
  features: string[];
}

const fplThresholds2026: Record<number, number> = {
  1: 15650,
  2: 21150,
  3: 26650,
  4: 32150,
  5: 37650,
  6: 43150,
  7: 48650,
  8: 54150,
};

function calculateFPLPercent(income: number, householdSize: number): number {
  const threshold = fplThresholds2026[Math.min(householdSize, 8)] || fplThresholds2026[1];
  return Math.round((income / threshold) * 100);
}

function estimateSubsidy(income: number, householdSize: number, fplPercent: number): number | null {
  if (fplPercent <= 138) return null;
  if (fplPercent > 400) return 0;

  const benchmarkPremium = 450 + (householdSize - 1) * 180;
  let expectedContribution: number;

  if (fplPercent <= 150) {
    expectedContribution = income * 0.0;
  } else if (fplPercent <= 200) {
    expectedContribution = income * 0.02;
  } else if (fplPercent <= 250) {
    expectedContribution = income * 0.04;
  } else if (fplPercent <= 300) {
    expectedContribution = income * 0.06;
  } else if (fplPercent <= 400) {
    expectedContribution = income * 0.085;
  } else {
    return 0;
  }

  const monthlyContribution = expectedContribution / 12;
  const subsidy = Math.max(0, benchmarkPremium - monthlyContribution);
  return Math.round(subsidy);
}

function generateMarketplacePlans(zipCode: string, fplPercent: number, subsidy: number | null): MarketplacePlan[] {
  const region = zipCode.startsWith("1") ? "Northeast" : zipCode.startsWith("9") ? "West" : zipCode.startsWith("3") ? "Southeast" : "Central";
  const regionMultiplier = region === "Northeast" ? 1.15 : region === "West" ? 1.1 : region === "Southeast" ? 0.95 : 1.0;
  const monthlySubsidy = subsidy || 0;

  const basePlans: MarketplacePlan[] = [
    {
      id: "cat-2026-01",
      name: "Catastrophic Value Plan",
      metalLevel: "catastrophic",
      issuer: `${region} Health Alliance`,
      monthlyPremium: Math.round(195 * regionMultiplier),
      estimatedPremiumAfterSubsidy: 0,
      deductible: 9450,
      maxOutOfPocket: 9450,
      copayCoverage: { primary: "After deductible", specialist: "After deductible", er: "After deductible", generic: "After deductible" },
      rating: 3.2,
      features: ["3 free primary care visits/year", "Free preventive care", "Lowest monthly cost"],
    },
    {
      id: "bronze-2026-01",
      name: "Bronze Essential Plan",
      metalLevel: "bronze",
      issuer: `${region} Health Network`,
      monthlyPremium: Math.round(320 * regionMultiplier),
      estimatedPremiumAfterSubsidy: 0,
      deductible: 7500,
      maxOutOfPocket: 9200,
      copayCoverage: { primary: "$40", specialist: "$80", er: "$400", generic: "$20" },
      rating: 3.5,
      features: ["Free preventive care", "Telehealth included", "Nationwide pharmacy network"],
    },
    {
      id: "silver-2026-01",
      name: "Silver Standard Plan",
      metalLevel: "silver",
      issuer: `${region} Blue Health`,
      monthlyPremium: Math.round(450 * regionMultiplier),
      estimatedPremiumAfterSubsidy: 0,
      deductible: 4500,
      maxOutOfPocket: 8550,
      copayCoverage: { primary: "$30", specialist: "$60", er: "$300", generic: "$15" },
      rating: 4.0,
      features: ["CSR eligible (if ≤250% FPL)", "Free preventive care", "Lower deductible", "Broad provider network"],
    },
    {
      id: "silver-2026-02",
      name: "Silver Enhanced Plan",
      metalLevel: "silver",
      issuer: `${region} Care Plus`,
      monthlyPremium: Math.round(510 * regionMultiplier),
      estimatedPremiumAfterSubsidy: 0,
      deductible: 3000,
      maxOutOfPocket: 7800,
      copayCoverage: { primary: "$25", specialist: "$50", er: "$250", generic: "$10" },
      rating: 4.2,
      features: ["CSR eligible (if ≤250% FPL)", "Dental & Vision included", "Low-cost prescriptions", "Mental health coverage"],
    },
    {
      id: "gold-2026-01",
      name: "Gold Comprehensive Plan",
      metalLevel: "gold",
      issuer: `${region} Premium Health`,
      monthlyPremium: Math.round(620 * regionMultiplier),
      estimatedPremiumAfterSubsidy: 0,
      deductible: 1500,
      maxOutOfPocket: 7000,
      copayCoverage: { primary: "$20", specialist: "$40", er: "$200", generic: "$10" },
      rating: 4.5,
      features: ["Low deductible", "Free preventive care", "Comprehensive coverage", "Wide specialist network"],
    },
    {
      id: "platinum-2026-01",
      name: "Platinum Premium Plan",
      metalLevel: "platinum",
      issuer: `${region} Elite Health`,
      monthlyPremium: Math.round(780 * regionMultiplier),
      estimatedPremiumAfterSubsidy: 0,
      deductible: 250,
      maxOutOfPocket: 3500,
      copayCoverage: { primary: "$10", specialist: "$25", er: "$100", generic: "$5" },
      rating: 4.8,
      features: ["Minimal deductible", "Low copays", "Premium provider network", "Full dental & vision", "Comprehensive Rx coverage"],
    },
  ];

  return basePlans.map(plan => ({
    ...plan,
    estimatedPremiumAfterSubsidy: Math.max(0, plan.monthlyPremium - monthlySubsidy),
  }));
}

function getCSRDetails(fplPercent: number): { eligible: boolean; tier: string; reducedDeductible: number; reducedOOP: number } | null {
  if (fplPercent <= 150) return { eligible: true, tier: "Enhanced Silver 94", reducedDeductible: 75, reducedOOP: 2900 };
  if (fplPercent <= 200) return { eligible: true, tier: "Enhanced Silver 87", reducedDeductible: 650, reducedOOP: 4500 };
  if (fplPercent <= 250) return { eligible: true, tier: "Enhanced Silver 73", reducedDeductible: 2500, reducedOOP: 6800 };
  return null;
}

router.post("/check-eligibility", (req, res) => {
  try {
    const { annualIncome, householdSize, zipCode, age, state } = req.body;

    if (!annualIncome || !householdSize || !zipCode) {
      return res.status(400).json({ error: "annualIncome, householdSize, and zipCode are required" });
    }

    const income = parseFloat(annualIncome);
    const household = parseInt(householdSize);
    const userAge = parseInt(age) || 35;
    const fplPercent = calculateFPLPercent(income, household);

    const programs: EligibilityProgram[] = [];

    if (fplPercent <= 138) {
      programs.push({
        id: "medicaid",
        name: "Medicaid",
        type: "medicaid",
        description: "Free or low-cost health coverage for low-income individuals and families.",
        eligible: true,
        reason: `Your household income is at ${fplPercent}% FPL, which is below the 138% Medicaid threshold.`,
      });
    } else {
      programs.push({
        id: "medicaid",
        name: "Medicaid",
        type: "medicaid",
        description: "Free or low-cost health coverage for low-income individuals and families.",
        eligible: false,
        reason: `Your household income is at ${fplPercent}% FPL, which exceeds the 138% Medicaid threshold.`,
      });
    }

    if (household > 1 && userAge < 19) {
      programs.push({
        id: "chip",
        name: "CHIP (Children's Health Insurance Program)",
        type: "chip",
        description: "Low-cost health coverage for children in families that earn too much for Medicaid.",
        eligible: fplPercent <= 300,
        reason: fplPercent <= 300
          ? `Children in your household may qualify for CHIP at ${fplPercent}% FPL.`
          : `Your income exceeds the typical CHIP threshold.`,
      });
    }

    if (fplPercent > 138 && fplPercent <= 400) {
      programs.push({
        id: "marketplace-subsidy",
        name: "ACA Marketplace with Premium Tax Credits",
        type: "marketplace",
        description: "Health insurance through Healthcare.gov with monthly subsidies to lower your premium.",
        eligible: true,
        reason: `At ${fplPercent}% FPL, you qualify for premium tax credits to reduce your monthly insurance cost.`,
      });
    } else if (fplPercent > 400) {
      programs.push({
        id: "marketplace",
        name: "ACA Marketplace (Full Price)",
        type: "marketplace",
        description: "Health insurance through Healthcare.gov at full premium price.",
        eligible: true,
        reason: `At ${fplPercent}% FPL, you can purchase marketplace plans but may not qualify for subsidies.`,
      });
    }

    if (userAge >= 65) {
      programs.push({
        id: "medicare",
        name: "Medicare",
        type: "medicare",
        description: "Federal health insurance for people 65+ or with certain disabilities.",
        eligible: true,
        reason: "You may be eligible for Medicare based on your age.",
      });
    }

    const subsidy = estimateSubsidy(income, household, fplPercent);
    const plans = generateMarketplacePlans(zipCode, fplPercent, subsidy);
    const csr = getCSRDetails(fplPercent);

    res.json({
      eligible: programs.some(p => p.eligible),
      programs,
      estimatedSubsidy: subsidy,
      fplPercent,
      marketplace: plans,
      csr,
      openEnrollment: {
        start: "November 1, 2025",
        end: "January 15, 2026",
        specialEnrollmentEvents: [
          "Loss of existing coverage",
          "Marriage or divorce",
          "Birth or adoption of a child",
          "Moving to a new state",
          "Turning 26 and losing parent's coverage",
          "Change in income affecting eligibility",
        ],
      },
      enrollmentUrl: "https://www.healthcare.gov/",
      disclaimer: "These are estimates based on 2026 Federal Poverty Level guidelines. Actual eligibility and costs may vary by state. Visit Healthcare.gov for official enrollment.",
    });
  } catch (error: any) {
    console.error("[CMSMarketplace] Eligibility check error:", error.message);
    res.status(500).json({ error: "Failed to check eligibility" });
  }
});

router.get("/fpl-thresholds", (_req, res) => {
  res.json({
    year: 2026,
    thresholds: fplThresholds2026,
    medicaidThreshold: 138,
    subsidyThreshold: 400,
    source: "HHS Poverty Guidelines 2026 (estimated)",
  });
});

router.get("/enrollment-periods", (_req, res) => {
  res.json({
    openEnrollment: {
      start: "2025-11-01",
      end: "2026-01-15",
      description: "Annual Open Enrollment Period for 2026 coverage",
    },
    specialEnrollmentQualifiers: [
      { event: "Job loss / loss of coverage", window: "60 days from event" },
      { event: "Marriage", window: "60 days from event" },
      { event: "Birth or adoption", window: "60 days from event" },
      { event: "Moving to new coverage area", window: "60 days from event" },
      { event: "Turning 26", window: "60 days before/after birthday" },
      { event: "Income change", window: "60 days from change" },
      { event: "Losing Medicaid/CHIP", window: "60 days from loss" },
    ],
  });
});

router.get("/metal-levels", (_req, res) => {
  res.json({
    levels: [
      { level: "catastrophic", color: "#6b7280", avgCoverage: 57, description: "Lowest premium, highest out-of-pocket. For under-30 or hardship exemption." },
      { level: "bronze", color: "#cd7f32", avgCoverage: 60, description: "Low premium, higher deductible. Good if you rarely need care." },
      { level: "silver", color: "#c0c0c0", avgCoverage: 70, description: "Moderate premium & deductible. CSR subsidies available below 250% FPL." },
      { level: "gold", color: "#ffd700", avgCoverage: 80, description: "Higher premium, lower deductible. Good for regular medical care." },
      { level: "platinum", color: "#e5e4e2", avgCoverage: 90, description: "Highest premium, lowest out-of-pocket. Best for frequent care needs." },
    ],
  });
});

export default router;
