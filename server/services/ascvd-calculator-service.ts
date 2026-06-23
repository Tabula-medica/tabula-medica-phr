// CDS-GATED — this service performs Clinical Decision Support (ASCVD 10-year risk
// scoring + statin/guideline recommendations). DISABLED by default via the ENABLE_CDS
// kill-switch pending FDA Non-Device CDS determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { assertCdsEnabled } from "./_cds-gate";

function getOpenAIClient(): OpenAI | null {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });
  }
  return null;
}

const DISCLAIMER = "This ASCVD risk score is for educational and tracking purposes only. It does not constitute medical advice. The Pooled Cohort Equations have known limitations and may over- or under-estimate risk in some populations. Always discuss your cardiovascular risk with your healthcare provider.";

export type Sex = "male" | "female";
export type Race = "white" | "african_american" | "other";
export type RiskCategory = "low" | "borderline" | "intermediate" | "high";

export interface ASCVDInputs {
  age: number;
  sex: Sex;
  race: Race;
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBP: number;
  onBPMeds: boolean;
  diabetic: boolean;
  smoker: boolean;
  ldlCholesterol?: number;
  a1c?: number;
  bmi?: number;
  familyHistory?: boolean;
}

export interface ASCVDResult {
  id: string;
  profileId: string;
  tenYearRisk: number;
  lifetimeRisk?: number;
  riskCategory: RiskCategory;
  optimalRisk: number;
  inputs: ASCVDInputs;
  riskEnhancers: string[];
  statinRecommendation: string;
  guidelineNotes: string[];
  calculatedAt: string;
  disclaimer: string;
  aiGenerated: boolean;
  aiDataSources?: string[];
}

export interface PreventiveGuideline {
  id: string;
  category: string;
  title: string;
  source: string;
  year: number;
  grade: string;
  population: string;
  recommendation: string;
  frequencyText: string;
  riskLevel?: string;
  keyPoints: string[];
  references: string[];
}

const coefficients = {
  white_male: {
    lnAge: 12.344,
    lnTC: 11.853,
    lnAgeLnTC: -2.664,
    lnHDL: -7.990,
    lnAgeLnHDL: 1.769,
    lnTreatedSBP: 1.797,
    lnUntreatedSBP: 1.764,
    lnAgeLnSBP_treated: 0,
    lnAgeLnSBP_untreated: 0,
    smoker: 7.837,
    lnAgeSmoker: -1.795,
    diabetes: 0.658,
    meanCoeff: 61.18,
    baseline: 0.9144,
  },
  white_female: {
    lnAge: -29.799,
    lnTC: 13.540,
    lnAgeLnTC: -3.114,
    lnHDL: -13.578,
    lnAgeLnHDL: 3.149,
    lnTreatedSBP: 2.019,
    lnUntreatedSBP: 1.957,
    lnAgeLnSBP_treated: 0,
    lnAgeLnSBP_untreated: 0,
    smoker: 7.574,
    lnAgeSmoker: -1.665,
    diabetes: 0.661,
    meanCoeff: -29.18,
    baseline: 0.9665,
  },
  aa_male: {
    lnAge: 2.469,
    lnTC: 0.302,
    lnAgeLnTC: 0,
    lnHDL: -0.307,
    lnAgeLnHDL: 0,
    lnTreatedSBP: 1.916,
    lnUntreatedSBP: 1.809,
    lnAgeLnSBP_treated: 0,
    lnAgeLnSBP_untreated: 0,
    smoker: 0.549,
    lnAgeSmoker: 0,
    diabetes: 0.645,
    meanCoeff: 19.54,
    baseline: 0.8954,
  },
  aa_female: {
    lnAge: 17.114,
    lnTC: 0.940,
    lnAgeLnTC: 0,
    lnHDL: -18.920,
    lnAgeLnHDL: 4.475,
    lnTreatedSBP: 29.291,
    lnUntreatedSBP: 27.820,
    lnAgeLnSBP_treated: -6.432,
    lnAgeLnSBP_untreated: -6.087,
    smoker: 0.691,
    lnAgeSmoker: 0,
    diabetes: 0.874,
    meanCoeff: 86.61,
    baseline: 0.9533,
  },
};

function calculatePooledCohortRisk(inputs: ASCVDInputs): number {
  const raceKey = inputs.race === "african_american" ? "aa" : "white";
  const key = `${raceKey}_${inputs.sex}` as keyof typeof coefficients;
  const c = coefficients[key];

  const lnAge = Math.log(inputs.age);
  const lnTC = Math.log(inputs.totalCholesterol);
  const lnHDL = Math.log(inputs.hdlCholesterol);
  const lnSBP = Math.log(inputs.systolicBP);

  let individualSum = 0;
  individualSum += c.lnAge * lnAge;
  individualSum += c.lnTC * lnTC;
  individualSum += c.lnAgeLnTC * lnAge * lnTC;
  individualSum += c.lnHDL * lnHDL;
  individualSum += c.lnAgeLnHDL * lnAge * lnHDL;

  if (inputs.onBPMeds) {
    individualSum += c.lnTreatedSBP * lnSBP;
    individualSum += c.lnAgeLnSBP_treated * lnAge * lnSBP;
  } else {
    individualSum += c.lnUntreatedSBP * lnSBP;
    individualSum += c.lnAgeLnSBP_untreated * lnAge * lnSBP;
  }

  if (inputs.smoker) {
    individualSum += c.smoker;
    individualSum += c.lnAgeSmoker * lnAge;
  }

  if (inputs.diabetic) {
    individualSum += c.diabetes;
  }

  const risk = 1 - Math.pow(c.baseline, Math.exp(individualSum - c.meanCoeff));
  return Math.max(0, Math.min(1, risk));
}

function calculateOptimalRisk(inputs: ASCVDInputs): number {
  const optimal: ASCVDInputs = {
    ...inputs,
    totalCholesterol: 170,
    hdlCholesterol: 50,
    systolicBP: 110,
    onBPMeds: false,
    diabetic: false,
    smoker: false,
  };
  return calculatePooledCohortRisk(optimal);
}

function getRiskCategory(tenYearRisk: number): RiskCategory {
  if (tenYearRisk < 0.05) return "low";
  if (tenYearRisk < 0.075) return "borderline";
  if (tenYearRisk < 0.20) return "intermediate";
  return "high";
}

function getLifetimeRisk(inputs: ASCVDInputs): number | undefined {
  if (inputs.age > 59) return undefined;

  const riskFactorCount = [
    inputs.totalCholesterol >= 240,
    inputs.systolicBP >= 160 || inputs.onBPMeds,
    inputs.diabetic,
    inputs.smoker,
  ].filter(Boolean).length;

  if (riskFactorCount >= 2) return 0.50;
  if (riskFactorCount === 1) return 0.39;

  const hasElevated = inputs.totalCholesterol >= 200 || (inputs.systolicBP >= 140 && !inputs.onBPMeds);
  if (hasElevated) return 0.36;

  return 0.05;
}

function identifyRiskEnhancers(inputs: ASCVDInputs): string[] {
  const enhancers: string[] = [];

  if (inputs.familyHistory) {
    enhancers.push("Family history of premature ASCVD (males <55, females <65)");
  }
  if (inputs.ldlCholesterol && inputs.ldlCholesterol >= 160) {
    enhancers.push(`Elevated LDL-C: ${inputs.ldlCholesterol} mg/dL (≥160)`)
  }
  if (inputs.totalCholesterol / inputs.hdlCholesterol > 5) {
    enhancers.push(`High TC/HDL ratio: ${(inputs.totalCholesterol / inputs.hdlCholesterol).toFixed(1)}`);
  }
  if (inputs.a1c && inputs.a1c >= 5.7 && !inputs.diabetic) {
    enhancers.push(`Prediabetic range A1C: ${inputs.a1c}%`);
  }
  if (inputs.bmi && inputs.bmi >= 30) {
    enhancers.push(`Obesity (BMI ${inputs.bmi.toFixed(1)})`);
  }
  if (inputs.race === "other") {
    enhancers.push("South Asian ancestry (associated with higher CV risk — discuss with provider)");
  }
  if (inputs.smoker) {
    enhancers.push("Current smoker");
  }
  if (inputs.systolicBP >= 130 && !inputs.onBPMeds) {
    enhancers.push(`Elevated systolic BP: ${inputs.systolicBP} mmHg without treatment`);
  }

  return enhancers;
}

function getStatinGuidance(riskPercent: number, inputs: ASCVDInputs): string {
  if (inputs.age < 40 || inputs.age > 75) {
    return "Statin therapy decisions for patients outside ages 40-75 should be individualized — discuss with your healthcare provider.";
  }

  if (inputs.ldlCholesterol && inputs.ldlCholesterol >= 190) {
    return "2018 ACC/AHA Guideline: LDL-C ≥190 mg/dL — high-intensity statin therapy is generally recommended regardless of 10-year risk. Discuss with your provider.";
  }
  if (inputs.diabetic && inputs.age >= 40) {
    if (riskPercent >= 0.075) {
      return "2018 ACC/AHA Guideline: Diabetes with 10-year risk ≥7.5% — high-intensity statin therapy may be considered. Discuss with your provider.";
    }
    return "2018 ACC/AHA Guideline: Diabetes without elevated risk — moderate-intensity statin therapy may be considered. Discuss with your provider.";
  }
  if (riskPercent >= 0.20) {
    return "2018 ACC/AHA Guideline: 10-year risk ≥20% — high-intensity statin therapy may be considered to reduce ASCVD risk. Discuss with your provider.";
  }
  if (riskPercent >= 0.075) {
    return "2018 ACC/AHA Guideline: 10-year risk 7.5-19.9% — moderate-intensity statin therapy may be considered, especially with risk-enhancing factors. Discuss with your provider.";
  }
  if (riskPercent >= 0.05) {
    return "2018 ACC/AHA Guideline: 10-year risk 5-7.4% (borderline) — risk discussion is recommended. Statin therapy may be considered if risk-enhancing factors are present. Discuss with your provider.";
  }
  return "2018 ACC/AHA Guideline: 10-year risk <5% (low) — emphasis on lifestyle factors (diet, exercise, smoking cessation). Statin therapy is generally not recommended at this risk level.";
}

function getGuidelineNotes(riskPercent: number, inputs: ASCVDInputs): string[] {
  const notes: string[] = [];

  notes.push("Based on 2013 ACC/AHA Pooled Cohort Equations and 2018 ACC/AHA Cholesterol Clinical Practice Guidelines.");

  if (inputs.age < 40) {
    notes.push("Note: The Pooled Cohort Equations are validated for ages 40-79. Results for younger patients should be interpreted with caution.");
  }
  if (inputs.age > 79) {
    notes.push("Note: The Pooled Cohort Equations are validated for ages 40-79. Results for older patients should be interpreted with caution.");
  }
  if (inputs.race === "other") {
    notes.push("Note: The PCE were developed using White and African American cohorts. Risk estimates for other racial/ethnic groups may be less accurate.");
  }

  if (riskPercent >= 0.075 && riskPercent < 0.20) {
    notes.push("2018 Guideline: For intermediate-risk patients, a coronary artery calcium (CAC) score can help refine risk assessment and guide shared decision-making.");
  }

  notes.push("Lifestyle modifications (heart-healthy diet, regular exercise, smoking cessation, weight management) are the foundation of ASCVD prevention at all risk levels.");

  return notes;
}

const resultCache = new Map<string, ASCVDResult[]>();

const PREVENTIVE_GUIDELINES_2024: PreventiveGuideline[] = [
  {
    id: "pg-ascvd-risk",
    category: "Cardiovascular",
    title: "ASCVD Risk Assessment",
    source: "2018 ACC/AHA Guideline on the Management of Blood Cholesterol",
    year: 2018,
    grade: "Class I",
    population: "Adults aged 40-75 without known ASCVD",
    recommendation: "Clinicians should routinely assess traditional cardiovascular risk factors and calculate 10-year ASCVD risk using the Pooled Cohort Equations for adults aged 40-75.",
    frequencyText: "Every 4-6 years, or when risk factors change",
    keyPoints: [
      "10-year risk <5%: Low risk — emphasize lifestyle",
      "10-year risk 5-7.4%: Borderline — risk discussion recommended",
      "10-year risk 7.5-19.9%: Intermediate — consider moderate-intensity statin",
      "10-year risk ≥20%: High — consider high-intensity statin",
      "CAC scoring can help refine intermediate-risk decisions",
    ],
    references: ["Grundy SM, et al. 2018 AHA/ACC Guideline. Circulation. 2019;139:e1082-e1143."],
  },
  {
    id: "pg-bp-2024",
    category: "Cardiovascular",
    title: "Hypertension Screening and Management",
    source: "2017 ACC/AHA High Blood Pressure Guideline (reaffirmed 2024)",
    year: 2024,
    grade: "Class I",
    population: "All adults",
    recommendation: "Screen all adults for hypertension. BP <120/80 is normal; 120-129/<80 is elevated; ≥130/80 is Stage 1 hypertension; ≥140/90 is Stage 2 hypertension.",
    frequencyText: "At every healthcare visit; annually at minimum",
    keyPoints: [
      "Normal BP: <120/80 mmHg",
      "Elevated: 120-129/<80 — lifestyle modifications",
      "Stage 1 (130-139/80-89): lifestyle + medication if 10-year ASCVD risk ≥10%",
      "Stage 2 (≥140/90): lifestyle + medication",
      "Home BP monitoring recommended for confirmation and management",
    ],
    references: ["Whelton PK, et al. 2017 ACC/AHA Guideline. Hypertension. 2018;71:e13-e115."],
  },
  {
    id: "pg-lipid-2024",
    category: "Cardiovascular",
    title: "Lipid Management for ASCVD Prevention",
    source: "2018 ACC/AHA Cholesterol Guideline (with 2022 Expert Consensus update)",
    year: 2024,
    grade: "Class I",
    population: "Adults aged 20+ (lipid panel); 40-75 (statin consideration)",
    recommendation: "Obtain a fasting lipid panel in all adults ≥20 years. Use 10-year ASCVD risk to guide statin therapy in primary prevention for ages 40-75.",
    frequencyText: "Lipid panel every 4-6 years (more frequently if elevated risk)",
    keyPoints: [
      "LDL-C ≥190: High-intensity statin regardless of risk score",
      "Diabetes (40-75): Moderate-intensity statin; high-intensity if risk ≥7.5%",
      "LDL-C 70-189 + risk ≥7.5%: Moderate-to-high intensity statin",
      "Risk enhancers (family hx, metabolic syndrome, CKD, etc.) favor statin initiation",
      "If decision uncertain at intermediate risk, CAC score = 0 can defer statin",
    ],
    references: ["Grundy SM, et al. 2018 Guideline. Circulation. 2019;139:e1082-e1143.", "Writing Committee. 2022 ACC Expert Consensus. JACC. 2022;79:2578-2625."],
  },
  {
    id: "pg-diabetes-screening",
    category: "Metabolic",
    title: "Type 2 Diabetes Screening",
    source: "USPSTF 2021 (reaffirmed 2024) / ADA Standards of Care 2024",
    year: 2024,
    grade: "B",
    population: "Adults 35-70 who are overweight or obese",
    recommendation: "Screen for prediabetes and type 2 diabetes. ADA additionally recommends screening all adults ≥45, or earlier with risk factors (BMI ≥25, family history, high-risk ethnicity).",
    frequencyText: "Every 3 years (or annually if prediabetic)",
    keyPoints: [
      "Fasting glucose ≥126 mg/dL or A1C ≥6.5% indicates diabetes",
      "Fasting glucose 100-125 or A1C 5.7-6.4% indicates prediabetes",
      "Lifestyle intervention (diet, exercise, weight loss) can prevent/delay onset",
      "Metformin may be considered for high-risk prediabetes",
    ],
    references: ["USPSTF. JAMA. 2021;326:736-743.", "ADA Standards of Care. Diabetes Care. 2024;47(Suppl 1)."],
  },
  {
    id: "pg-aspirin-2022",
    category: "Cardiovascular",
    title: "Aspirin for Primary Prevention of CVD",
    source: "USPSTF 2022",
    year: 2022,
    grade: "C (age 40-59 with ≥10% risk) / D (age ≥60)",
    population: "Adults 40-59 with ≥10% 10-year ASCVD risk; not recommended for ≥60",
    recommendation: "For adults 40-59 with 10-year CVD risk ≥10%: individualized decision (small net benefit). For adults ≥60: do not initiate aspirin for primary prevention.",
    frequencyText: "Ongoing discussion at preventive visits",
    keyPoints: [
      "2022 USPSTF changed aspirin from general recommendation to selective use",
      "Ages 40-59 with ≥10% risk: individual decision (Grade C)",
      "Ages ≥60: do NOT initiate for primary prevention (Grade D)",
      "Bleeding risk increases with age and must be weighed against benefit",
    ],
    references: ["USPSTF. JAMA. 2022;327:1577-1584."],
  },
  {
    id: "pg-ckd-screening",
    category: "Renal",
    title: "Chronic Kidney Disease Screening",
    source: "KDIGO 2024 / ADA 2024",
    year: 2024,
    grade: "Guideline recommendation",
    population: "Adults with diabetes, hypertension, cardiovascular disease, or family history of CKD",
    recommendation: "Screen high-risk adults with serum creatinine (eGFR) and urine albumin-to-creatinine ratio (UACR). Early detection enables SGLT2 inhibitor and ACEi/ARB therapy to slow progression.",
    frequencyText: "Annually for at-risk populations",
    keyPoints: [
      "eGFR <60 mL/min/1.73m² or UACR ≥30 mg/g indicates CKD",
      "SGLT2 inhibitors (dapagliflozin, empagliflozin) reduce CKD progression and CV events",
      "ACEi/ARB recommended for diabetic kidney disease",
      "CKD is an independent risk enhancer for ASCVD",
    ],
    references: ["KDIGO 2024 Clinical Practice Guideline for CKD. Kidney Int. 2024."],
  },
  {
    id: "pg-obesity-2023",
    category: "Metabolic",
    title: "Obesity Screening and Management",
    source: "USPSTF 2018 (reaffirmed) / AHA/ACC/TOS 2023 update",
    year: 2023,
    grade: "B",
    population: "All adults",
    recommendation: "Screen all adults for obesity (BMI ≥30). Offer or refer patients with BMI ≥30 to intensive behavioral interventions. GLP-1 receptor agonists now approved for weight management.",
    frequencyText: "At every healthcare visit",
    keyPoints: [
      "BMI ≥30: Obesity — comprehensive lifestyle intervention recommended",
      "BMI 25-29.9: Overweight — lifestyle counseling",
      "GLP-1 RAs (semaglutide, tirzepatide) show 15-20% weight loss in trials",
      "Weight loss of 5-10% significantly reduces cardiovascular risk factors",
    ],
    references: ["USPSTF. JAMA. 2018;320:1163-1171.", "AHA/ACC/TOS. Circulation. 2023."],
  },
  {
    id: "pg-smoking-cessation",
    category: "Behavioral",
    title: "Tobacco Cessation",
    source: "USPSTF 2021",
    year: 2021,
    grade: "A",
    population: "All adults who use tobacco",
    recommendation: "Ask all adults about tobacco use, advise to stop, and provide behavioral interventions and FDA-approved pharmacotherapy (varenicline, bupropion, NRT).",
    frequencyText: "At every healthcare visit",
    keyPoints: [
      "Smoking is the #1 modifiable risk factor for ASCVD",
      "Quitting at any age reduces cardiovascular risk",
      "Combination therapy (behavioral + pharmacotherapy) most effective",
      "Cardiovascular risk drops 50% within 1 year of cessation",
    ],
    references: ["USPSTF. JAMA. 2021;325:265-279."],
  },
  {
    id: "pg-statin-2018",
    category: "Cardiovascular",
    title: "Statin Use for Primary Prevention",
    source: "USPSTF 2022 / 2018 ACC/AHA Cholesterol Guideline",
    year: 2022,
    grade: "B (≥10% risk) / C (7.5-10% risk)",
    population: "Adults 40-75 with ≥1 CVD risk factor and ≥10% 10-year ASCVD risk",
    recommendation: "Prescribe a statin for primary prevention in adults aged 40-75 with ≥1 CVD risk factor and a calculated 10-year ASCVD risk ≥10%. For 7.5-10% risk, selectively offer statins.",
    frequencyText: "Reassess risk every 4-6 years",
    riskLevel: "intermediate_to_high",
    keyPoints: [
      "High-intensity statins reduce LDL by ≥50% (atorvastatin 40-80mg, rosuvastatin 20-40mg)",
      "Moderate-intensity statins reduce LDL by 30-49%",
      "Net benefit is greatest in those at higher ASCVD risk",
      "Discuss potential benefits, harms, and patient preferences",
    ],
    references: ["USPSTF. JAMA. 2022;328:746-753.", "Grundy SM, et al. Circulation. 2019;139:e1082-e1143."],
  },
  {
    id: "pg-exercise-aha",
    category: "Lifestyle",
    title: "Physical Activity for Cardiovascular Health",
    source: "2018 Physical Activity Guidelines / AHA 2024",
    year: 2024,
    grade: "Strong recommendation",
    population: "All adults",
    recommendation: "At least 150 minutes/week of moderate-intensity aerobic activity (or 75 min vigorous), plus muscle-strengthening activities ≥2 days/week.",
    frequencyText: "Ongoing lifestyle recommendation",
    keyPoints: [
      "150 min/week moderate exercise reduces ASCVD risk by ~30%",
      "Any physical activity is better than none",
      "Sedentary behavior is an independent cardiovascular risk factor",
      "Exercise improves BP, lipids, glucose, weight, and mental health",
    ],
    references: ["2018 Physical Activity Guidelines Advisory Committee Report. HHS. 2018.", "AHA 2024 Scientific Statement."],
  },
];

export const ascvdCalculatorService = {
  calculateASCVD(profileId: string, inputs: ASCVDInputs, aiGenerated = false, aiDataSources?: string[]): ASCVDResult {
    assertCdsEnabled("ascvd-calculator-service.calculateASCVD");
    if (inputs.age < 20 || inputs.age > 99) throw new Error("Age must be between 20 and 99");
    if (inputs.totalCholesterol < 100 || inputs.totalCholesterol > 400) throw new Error("Total cholesterol must be between 100 and 400 mg/dL");
    if (inputs.hdlCholesterol < 20 || inputs.hdlCholesterol > 150) throw new Error("HDL cholesterol must be between 20 and 150 mg/dL");
    if (inputs.systolicBP < 80 || inputs.systolicBP > 250) throw new Error("Systolic BP must be between 80 and 250 mmHg");

    const tenYearRisk = calculatePooledCohortRisk(inputs);
    const optimalRisk = calculateOptimalRisk(inputs);
    const lifetimeRisk = getLifetimeRisk(inputs);
    const riskCategory = getRiskCategory(tenYearRisk);
    const riskEnhancers = identifyRiskEnhancers(inputs);
    const statinRecommendation = getStatinGuidance(tenYearRisk, inputs);
    const guidelineNotes = getGuidelineNotes(tenYearRisk, inputs);

    const result: ASCVDResult = {
      id: randomUUID(),
      profileId,
      tenYearRisk,
      lifetimeRisk,
      riskCategory,
      optimalRisk,
      inputs,
      riskEnhancers,
      statinRecommendation,
      guidelineNotes,
      calculatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
      aiGenerated,
      aiDataSources,
    };

    const existing = resultCache.get(profileId) || [];
    existing.push(result);
    resultCache.set(profileId, existing);

    return result;
  },

  getHistory(profileId: string): ASCVDResult[] {
    return (resultCache.get(profileId) || []).sort((a, b) => new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime());
  },

  getPreventiveGuidelines(): PreventiveGuideline[] {
    return PREVENTIVE_GUIDELINES_2024;
  },

  getGuidelinesByCategory(category: string): PreventiveGuideline[] {
    return PREVENTIVE_GUIDELINES_2024.filter(g => g.category.toLowerCase() === category.toLowerCase());
  },

  async autoCalculateFromPatientData(profileId: string): Promise<ASCVDResult | { error: string; fallbackInputs?: Partial<ASCVDInputs> }> {
    assertCdsEnabled("ascvd-calculator-service.autoCalculateFromPatientData");
    const openai = getOpenAIClient();
    if (!openai) {
      return { error: "AI service unavailable. Please enter your values manually." };
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a health data extraction assistant. Your job is to extract ASCVD risk calculator inputs from patient health records.

Given patient health data, extract these values for the Pooled Cohort Equations ASCVD risk calculator:
- age (number, years)
- sex ("male" or "female")
- race ("white", "african_american", or "other")
- totalCholesterol (number, mg/dL)
- hdlCholesterol (number, mg/dL)
- systolicBP (number, mmHg)
- onBPMeds (boolean)
- diabetic (boolean)
- smoker (boolean)
- ldlCholesterol (number, mg/dL, optional)
- a1c (number, %, optional)
- bmi (number, optional)
- familyHistory (boolean, optional - premature ASCVD in first-degree relative)

For each value, also list what data source it came from.

Return JSON with:
{
  "inputs": { ... extracted values ... },
  "dataSources": ["source description for each value"],
  "confidence": "high" | "medium" | "low",
  "missingFields": ["list of fields that couldn't be determined"],
  "assumptions": ["any assumptions made"]
}

If critical fields (age, sex, totalCholesterol, hdlCholesterol, systolicBP) cannot be determined, set "canCalculate": false.
Important: This is for educational tracking only — NOT clinical decision support. All outputs must include a disclaimer.`,
          },
          {
            role: "user",
            content: `Extract ASCVD calculator inputs from this patient profile (ID: ${profileId}).

Use any available health data including:
- Demographics (age, sex, race/ethnicity)
- Latest vital signs (blood pressure readings)
- Latest lab results (lipid panel: total cholesterol, HDL, LDL, triglycerides; A1C/glucose)
- Active conditions (diabetes, hypertension)
- Active medications (antihypertensives, statins, insulin, metformin)
- Social history (smoking status)
- Family history (premature heart disease)
- BMI/weight data

For this demonstration, generate realistic sample patient data for a 55-year-old patient to show the ASCVD calculator in action. Include data sources for each value.`,
          },
        ],
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return { error: "AI returned empty response. Please enter values manually." };
      }

      const parsed = JSON.parse(content);

      if (parsed.canCalculate === false) {
        return {
          error: `Cannot auto-calculate: missing critical fields (${parsed.missingFields?.join(", ") || "unknown"}).`,
          fallbackInputs: parsed.inputs,
        };
      }

      const inputs: ASCVDInputs = {
        age: parsed.inputs.age,
        sex: parsed.inputs.sex,
        race: parsed.inputs.race || "white",
        totalCholesterol: parsed.inputs.totalCholesterol,
        hdlCholesterol: parsed.inputs.hdlCholesterol,
        systolicBP: parsed.inputs.systolicBP,
        onBPMeds: parsed.inputs.onBPMeds || false,
        diabetic: parsed.inputs.diabetic || false,
        smoker: parsed.inputs.smoker || false,
        ldlCholesterol: parsed.inputs.ldlCholesterol,
        a1c: parsed.inputs.a1c,
        bmi: parsed.inputs.bmi,
        familyHistory: parsed.inputs.familyHistory,
      };

      const aiDataSources = [
        ...(parsed.dataSources || []),
        ...(parsed.assumptions || []).map((a: string) => `Assumption: ${a}`),
        `AI confidence: ${parsed.confidence || "unknown"}`,
      ];

      return this.calculateASCVD(profileId, inputs, true, aiDataSources);
    } catch (error) {
      console.error("[ASCVD] AI auto-calculation error:", error);
      return { error: `AI calculation failed: ${error instanceof Error ? error.message : "Unknown error"}. Please enter values manually.` };
    }
  },
};
