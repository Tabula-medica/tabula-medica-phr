import { Router, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

function getUserId(req: Request): string {
  return (req as any).user?.claims?.sub || (req as any).user?.id || "unknown";
}

interface DuplicateTestMetric {
  month: string;
  testsOrdered: number;
  duplicatesDetected: number;
  duplicatesAvoided: number;
  savingsUSD: number;
}

interface CategorySavings {
  category: string;
  testsAvoided: number;
  totalSavings: number;
  avgCostPerTest: number;
  topTests: { name: string; count: number; savings: number }[];
}

interface ACOSavingsMetric {
  quarter: string;
  sharedSavings: number;
  qualityScore: number;
  totalBeneficiaries: number;
  perCapitaCost: number;
  benchmark: number;
  savingsRate: number;
}

interface DemographicBreakdown {
  ageGroup: string;
  memberCount: number;
  duplicateTestsAvoided: number;
  savingsUSD: number;
  topConditions: string[];
}

interface InsuranceSavingsBreakdown {
  payerName: string;
  claimsProcessed: number;
  duplicatesAvoided: number;
  savingsToPatient: number;
  savingsToPayer: number;
  avgClaimReduction: number;
}

function generateMonthlyMetrics(): DuplicateTestMetric[] {
  const months = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03"];
  let cumulativeAvoided = 0;
  return months.map((month, i) => {
    const baseOrdered = 2400 + Math.floor(i * 180 + Math.random() * 200);
    const detected = Math.floor(baseOrdered * (0.12 + i * 0.008));
    const avoided = Math.floor(detected * (0.78 + i * 0.015));
    cumulativeAvoided += avoided;
    const savings = avoided * (320 + Math.floor(Math.random() * 180));
    return { month, testsOrdered: baseOrdered, duplicatesDetected: detected, duplicatesAvoided: avoided, savingsUSD: savings };
  });
}

function generateCategorySavings(): CategorySavings[] {
  return [
    {
      category: "Laboratory",
      testsAvoided: 1847,
      totalSavings: 387870,
      avgCostPerTest: 210,
      topTests: [
        { name: "Complete Blood Count (CBC)", count: 412, savings: 61800 },
        { name: "Comprehensive Metabolic Panel", count: 356, savings: 71200 },
        { name: "Lipid Panel", count: 289, savings: 43350 },
        { name: "Hemoglobin A1c", count: 234, savings: 35100 },
        { name: "Thyroid Panel (TSH, T3, T4)", count: 198, savings: 49500 },
      ],
    },
    {
      category: "Imaging",
      testsAvoided: 623,
      totalSavings: 498400,
      avgCostPerTest: 800,
      topTests: [
        { name: "CT Scan - Abdomen/Pelvis", count: 145, savings: 159500 },
        { name: "MRI - Brain", count: 112, savings: 134400 },
        { name: "X-Ray - Chest", count: 198, savings: 29700 },
        { name: "CT Scan - Head", count: 89, savings: 97900 },
        { name: "Ultrasound - Abdominal", count: 79, savings: 27650 },
      ],
    },
    {
      category: "Cardiology",
      testsAvoided: 312,
      totalSavings: 312000,
      avgCostPerTest: 1000,
      topTests: [
        { name: "Echocardiogram", count: 98, savings: 117600 },
        { name: "Stress Test", count: 87, savings: 104400 },
        { name: "EKG/ECG", count: 127, savings: 19050 },
      ],
    },
    {
      category: "Procedures",
      testsAvoided: 156,
      totalSavings: 234000,
      avgCostPerTest: 1500,
      topTests: [
        { name: "Colonoscopy", count: 45, savings: 90000 },
        { name: "Upper Endoscopy", count: 38, savings: 57000 },
        { name: "Pulmonary Function Test", count: 73, savings: 36500 },
      ],
    },
  ];
}

function generateACOSavings(): ACOSavingsMetric[] {
  return [
    { quarter: "Q3 2025", sharedSavings: 1245000, qualityScore: 87.3, totalBeneficiaries: 12450, perCapitaCost: 8920, benchmark: 9450, savingsRate: 5.6 },
    { quarter: "Q4 2025", sharedSavings: 1567000, qualityScore: 89.1, totalBeneficiaries: 13200, perCapitaCost: 8740, benchmark: 9520, savingsRate: 8.2 },
    { quarter: "Q1 2026", sharedSavings: 1823000, qualityScore: 91.4, totalBeneficiaries: 14100, perCapitaCost: 8510, benchmark: 9600, savingsRate: 11.4 },
  ];
}

function generateDemographicBreakdown(): DemographicBreakdown[] {
  return [
    { ageGroup: "18-34", memberCount: 2340, duplicateTestsAvoided: 312, savingsUSD: 78000, topConditions: ["Anxiety", "Allergies", "Back Pain"] },
    { ageGroup: "35-49", memberCount: 3120, duplicateTestsAvoided: 567, savingsUSD: 170100, topConditions: ["Hypertension", "Diabetes Type 2", "Hyperlipidemia"] },
    { ageGroup: "50-64", memberCount: 4560, duplicateTestsAvoided: 1023, savingsUSD: 409200, topConditions: ["Cardiovascular Disease", "Diabetes", "Osteoarthritis"] },
    { ageGroup: "65+", memberCount: 3890, duplicateTestsAvoided: 936, savingsUSD: 468000, topConditions: ["CHF", "COPD", "CKD", "Atrial Fibrillation"] },
  ];
}

function generateInsuranceSavings(): InsuranceSavingsBreakdown[] {
  return [
    { payerName: "Medicare", claimsProcessed: 18450, duplicatesAvoided: 1245, savingsToPatient: 186750, savingsToPayer: 498000, avgClaimReduction: 12.3 },
    { payerName: "Blue Cross Blue Shield", claimsProcessed: 12300, duplicatesAvoided: 834, savingsToPatient: 125100, savingsToPayer: 333600, avgClaimReduction: 10.8 },
    { payerName: "Aetna", claimsProcessed: 8760, duplicatesAvoided: 567, savingsToPatient: 85050, savingsToPayer: 226800, avgClaimReduction: 9.5 },
    { payerName: "UnitedHealthcare", claimsProcessed: 7890, duplicatesAvoided: 498, savingsToPatient: 74700, savingsToPayer: 199200, avgClaimReduction: 11.2 },
    { payerName: "Cigna", claimsProcessed: 5430, duplicatesAvoided: 345, savingsToPatient: 51750, savingsToPayer: 138000, avgClaimReduction: 8.7 },
    { payerName: "Medicaid", claimsProcessed: 4230, duplicatesAvoided: 289, savingsToPatient: 43350, savingsToPayer: 115600, avgClaimReduction: 7.9 },
  ];
}

router.get("/api/enterprise-savings/dashboard", isAuthenticated, async (req: Request, res: Response) => {
  const userId = getUserId(req);

  logPhiAccess({
    userId,
    resourceType: "EnterpriseSavings",
    action: "read",
    details: "Accessed enterprise platform savings dashboard",
  });

  const monthlyMetrics = generateMonthlyMetrics();
  const categorySavings = generateCategorySavings();
  const acoSavings = generateACOSavings();
  const demographics = generateDemographicBreakdown();
  const insuranceSavings = generateInsuranceSavings();

  const totalTestsAvoided = monthlyMetrics.reduce((sum, m) => sum + m.duplicatesAvoided, 0);
  const totalSavings = monthlyMetrics.reduce((sum, m) => sum + m.savingsUSD, 0);
  const avgDetectionRate = monthlyMetrics.reduce((sum, m) => sum + (m.duplicatesDetected / m.testsOrdered), 0) / monthlyMetrics.length;
  const latestACO = acoSavings[acoSavings.length - 1];

  res.json({
    summary: {
      totalTestsAvoided,
      totalSavingsUSD: totalSavings,
      avgDetectionRate: Math.round(avgDetectionRate * 1000) / 10,
      currentQuarterACOSavings: latestACO.sharedSavings,
      qualityScore: latestACO.qualityScore,
      totalBeneficiaries: latestACO.totalBeneficiaries,
      platformROI: Math.round((totalSavings / 450000) * 100) / 100,
      annualProjectedSavings: Math.round(totalSavings * (12 / monthlyMetrics.length)),
    },
    monthlyMetrics,
    categorySavings,
    acoSavings,
    demographics,
    insuranceSavings,
    reportGeneratedAt: new Date().toISOString(),
    disclaimer: "INFORMATIONAL ONLY: This report is for administrative and financial planning purposes. It does not constitute medical advice or clinical decision support.",
  });
});

router.get("/api/enterprise-savings/export", isAuthenticated, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { format } = req.query;

  logPhiAccess({
    userId,
    resourceType: "EnterpriseSavings",
    action: "read",
    details: `Exported enterprise savings report (format: ${format || "json"})`,
  });

  const monthlyMetrics = generateMonthlyMetrics();
  const categorySavings = generateCategorySavings();

  if (format === "csv") {
    const header = "Month,Tests Ordered,Duplicates Detected,Duplicates Avoided,Savings (USD)\n";
    const rows = monthlyMetrics.map(m => `${m.month},${m.testsOrdered},${m.duplicatesDetected},${m.duplicatesAvoided},${m.savingsUSD}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=enterprise-savings-report.csv");
    return res.send(header + rows);
  }

  res.json({ monthlyMetrics, categorySavings, exportedAt: new Date().toISOString() });
});

export default router;
