// @ts-nocheck
import { db } from "./db";
import { healthRecords, patientProfiles } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface ASCVDInputs {
  age: number;
  sex: "male" | "female";
  race: "white" | "african_american" | "other";
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBP: number;
  onBPMeds: boolean;
  diabetic: boolean;
  smoker: boolean;
}

export interface ASCVDResult {
  tenYearRisk: number;
  lifetimeRisk: number;
  riskCategory: "low" | "borderline" | "intermediate" | "high";
  optimalRisk: number;
  riskReduction: number;
  inputs: ASCVDInputs;
  guidelines: PreventiveGuideline[];
  calculatedAt: string;
}

export interface PreventiveGuideline {
  id: string;
  category: string;
  title: string;
  recommendation: string;
  source: string;
  grade: string;
  applicableRiskLevel: string[];
  interventionType: "lifestyle" | "medication" | "screening" | "monitoring";
}

const PREVENTIVE_GUIDELINES: PreventiveGuideline[] = [
  {
    id: "statin-high",
    category: "Lipid Management",
    title: "High-Intensity Statin Therapy",
    recommendation: "For adults aged 40-75 with 10-year ASCVD risk >=20%, initiate high-intensity statin therapy (atorvastatin 40-80mg or rosuvastatin 20-40mg). Target LDL-C reduction >=50%.",
    source: "2018 AHA/ACC Cholesterol Guidelines, 2022 ACC Expert Consensus",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["high"],
    interventionType: "medication",
  },
  {
    id: "statin-moderate",
    category: "Lipid Management",
    title: "Moderate-Intensity Statin Therapy",
    recommendation: "For adults aged 40-75 with 10-year ASCVD risk 7.5-19.9%, consider moderate-intensity statin therapy after clinician-patient risk discussion. Risk-enhancing factors (family history, metabolic syndrome, CKD, elevated hsCRP, Lp(a) >=50mg/dL) favor initiation.",
    source: "2018 AHA/ACC Cholesterol Guidelines",
    grade: "Class IIa (Moderate)",
    applicableRiskLevel: ["intermediate"],
    interventionType: "medication",
  },
  {
    id: "statin-borderline",
    category: "Lipid Management",
    title: "Statin Consideration with Risk Enhancers",
    recommendation: "For adults aged 40-75 with borderline risk (5-7.4%), statins may be considered if risk-enhancing factors are present: premature family history of ASCVD, LDL-C 160-189 mg/dL, metabolic syndrome, chronic kidney disease, South Asian ancestry, or elevated inflammatory markers.",
    source: "2018 AHA/ACC Cholesterol Guidelines",
    grade: "Class IIb (Weak)",
    applicableRiskLevel: ["borderline"],
    interventionType: "medication",
  },
  {
    id: "cac-scoring",
    category: "Risk Assessment",
    title: "Coronary Artery Calcium (CAC) Score",
    recommendation: "When risk-based decisions are uncertain, a CAC score of 0 favors deferring statin therapy (except in smokers, diabetics, or those with strong family history). CAC 1-99 favors statin therapy if age >=55. CAC >=100 or >=75th percentile strongly favors statin initiation.",
    source: "2018 AHA/ACC Cholesterol Guidelines, 2019 ACC/AHA Primary Prevention",
    grade: "Class IIa (Moderate)",
    applicableRiskLevel: ["borderline", "intermediate"],
    interventionType: "screening",
  },
  {
    id: "bp-target",
    category: "Blood Pressure Management",
    title: "Blood Pressure Target <130/80 mmHg",
    recommendation: "For adults with elevated ASCVD risk (>=10% 10-year risk), target BP <130/80 mmHg. First-line agents: ACE inhibitor/ARB, calcium channel blocker, or thiazide diuretic. Lifestyle modifications should accompany pharmacotherapy.",
    source: "2017 ACC/AHA Hypertension Guidelines, 2024 ESC Hypertension Guidelines",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["intermediate", "high"],
    interventionType: "medication",
  },
  {
    id: "aspirin-primary",
    category: "Antiplatelet Therapy",
    title: "Aspirin for Primary Prevention (Limited Role)",
    recommendation: "Low-dose aspirin (75-100mg) should NOT be routinely used for primary ASCVD prevention. May be considered in select adults aged 40-70 with high ASCVD risk and low bleeding risk after shared decision-making. Avoid in adults >70 or those with increased bleeding risk.",
    source: "2019 ACC/AHA Primary Prevention, 2022 USPSTF Update",
    grade: "Class III (No Benefit) for routine use",
    applicableRiskLevel: ["intermediate", "high"],
    interventionType: "medication",
  },
  {
    id: "exercise",
    category: "Physical Activity",
    title: "Aerobic Exercise Prescription",
    recommendation: "At least 150 minutes/week of moderate-intensity or 75 minutes/week of vigorous-intensity aerobic activity. Additional benefit from resistance training 2-3 days/week. For those with sedentary lifestyles, even modest increases in activity provide cardiovascular benefit.",
    source: "2019 ACC/AHA Primary Prevention, 2020 WHO Physical Activity Guidelines",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["low", "borderline", "intermediate", "high"],
    interventionType: "lifestyle",
  },
  {
    id: "diet",
    category: "Nutrition",
    title: "Heart-Healthy Dietary Pattern",
    recommendation: "Emphasize fruits, vegetables, legumes, nuts, whole grains, and fish. Limit sodium (<2300mg/day, ideally <1500mg for hypertensives), added sugars, processed meats, refined carbohydrates, and trans fats. Mediterranean and DASH diets have strongest evidence for CV risk reduction.",
    source: "2019 ACC/AHA Primary Prevention, 2021 AHA Dietary Guidance",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["low", "borderline", "intermediate", "high"],
    interventionType: "lifestyle",
  },
  {
    id: "smoking-cessation",
    category: "Tobacco Cessation",
    title: "Smoking Cessation Support",
    recommendation: "All tobacco users should be strongly advised to quit. Offer pharmacotherapy (varenicline, bupropion, NRT) combined with behavioral counseling. Smoking cessation reduces ASCVD risk by 50% within 1 year. E-cigarettes are not recommended as cessation aids.",
    source: "2019 ACC/AHA Primary Prevention, 2020 USPSTF Tobacco Cessation",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["low", "borderline", "intermediate", "high"],
    interventionType: "lifestyle",
  },
  {
    id: "diabetes-management",
    category: "Diabetes Management",
    title: "Glycemic Control & CV-Protective Agents",
    recommendation: "For diabetic patients with ASCVD risk, target A1c <7% (individualized). Prefer GLP-1 receptor agonists (semaglutide, liraglutide) or SGLT2 inhibitors (empagliflozin, dapagliflozin) which have proven CV benefit independent of glucose lowering.",
    source: "2024 ADA Standards of Care, 2023 ACC Expert Consensus on Cardiometabolic Risk",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["borderline", "intermediate", "high"],
    interventionType: "medication",
  },
  {
    id: "weight-management",
    category: "Weight Management",
    title: "BMI & Waist Circumference Targets",
    recommendation: "Maintain BMI 18.5-24.9 kg/m2 and waist circumference <40 inches (men) / <35 inches (women). Even 5-10% weight loss significantly improves cardiometabolic risk factors. GLP-1 agonists (semaglutide 2.4mg) now FDA-approved for CV risk reduction in obesity.",
    source: "2019 ACC/AHA Primary Prevention, 2024 AHA Obesity Statement",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["borderline", "intermediate", "high"],
    interventionType: "lifestyle",
  },
  {
    id: "lipid-monitoring",
    category: "Monitoring",
    title: "Lipid Panel Monitoring Schedule",
    recommendation: "Fasting lipid panel at baseline, 4-12 weeks after statin initiation, then every 3-12 months. Consider Lp(a) measurement once in lifetime for all adults. If Lp(a) >=50 mg/dL, factor into risk assessment. Annual comprehensive metabolic panel recommended.",
    source: "2018 AHA/ACC Cholesterol Guidelines",
    grade: "Class I (Strong)",
    applicableRiskLevel: ["low", "borderline", "intermediate", "high"],
    interventionType: "monitoring",
  },
  {
    id: "hsCRP",
    category: "Risk Assessment",
    title: "High-Sensitivity CRP Testing",
    recommendation: "hsCRP >=2.0 mg/L is a risk-enhancing factor that favors statin initiation in borderline/intermediate risk patients. Consider for risk reclassification when treatment decision is uncertain.",
    source: "2018 AHA/ACC Cholesterol Guidelines, 2019 ACC/AHA Primary Prevention",
    grade: "Class IIa (Moderate)",
    applicableRiskLevel: ["borderline", "intermediate"],
    interventionType: "screening",
  },
  {
    id: "sleep-health",
    category: "Sleep Health",
    title: "Sleep Duration & Quality",
    recommendation: "Target 7-9 hours of sleep per night. Screen for and treat obstructive sleep apnea, which independently increases ASCVD risk. Poor sleep is now recognized as a modifiable cardiovascular risk factor by the AHA (Life's Essential 8).",
    source: "2022 AHA Life's Essential 8, 2024 AHA Sleep & CV Health Statement",
    grade: "Class IIa (Moderate)",
    applicableRiskLevel: ["low", "borderline", "intermediate", "high"],
    interventionType: "lifestyle",
  },
];

function calculateASCVD(inputs: ASCVDInputs): { tenYearRisk: number; lifetimeRisk: number } {
  const { age, sex, race, totalCholesterol, hdlCholesterol, systolicBP, onBPMeds, diabetic, smoker } = inputs;

  const lnAge = Math.log(age);
  const lnTC = Math.log(totalCholesterol);
  const lnHDL = Math.log(hdlCholesterol);
  const lnSBP = Math.log(systolicBP);
  const currentSmoker = smoker ? 1 : 0;
  const dm = diabetic ? 1 : 0;

  let sumCoeff: number;
  let meanCoeff: number;
  let baselineSurvival: number;

  if (sex === "female" && race === "african_american") {
    const treated = onBPMeds ? 1 : 0;
    const untreated = onBPMeds ? 0 : 1;
    sumCoeff =
      17.114 * lnAge +
      0.94 * lnTC +
      -18.92 * lnHDL +
      4.475 * lnHDL * lnAge +
      29.291 * lnSBP * treated +
      -6.432 * lnSBP * lnAge * treated +
      27.82 * lnSBP * untreated +
      -6.087 * lnSBP * lnAge * untreated +
      0.691 * currentSmoker +
      0.874 * dm;
    meanCoeff = 86.61;
    baselineSurvival = 0.9533;
  } else if (sex === "female") {
    const treated = onBPMeds ? 1 : 0;
    const untreated = onBPMeds ? 0 : 1;
    sumCoeff =
      -29.799 * lnAge +
      4.884 * lnAge * lnAge +
      13.54 * lnTC +
      -3.114 * lnTC * lnAge +
      -13.578 * lnHDL +
      3.149 * lnHDL * lnAge +
      2.019 * lnSBP * treated +
      1.957 * lnSBP * untreated +
      7.574 * currentSmoker +
      -1.665 * currentSmoker * lnAge +
      0.661 * dm;
    meanCoeff = -29.18;
    baselineSurvival = 0.9665;
  } else if (sex === "male" && race === "african_american") {
    const treated = onBPMeds ? 1 : 0;
    const untreated = onBPMeds ? 0 : 1;
    sumCoeff =
      2.469 * lnAge +
      0.302 * lnTC +
      -0.307 * lnHDL +
      1.916 * lnSBP * treated +
      1.809 * lnSBP * untreated +
      0.549 * currentSmoker +
      0.645 * dm;
    meanCoeff = 19.54;
    baselineSurvival = 0.8954;
  } else {
    const treated = onBPMeds ? 1 : 0;
    const untreated = onBPMeds ? 0 : 1;
    sumCoeff =
      12.344 * lnAge +
      11.853 * lnTC +
      -2.664 * lnTC * lnAge +
      -7.99 * lnHDL +
      1.769 * lnHDL * lnAge +
      1.797 * lnSBP * treated +
      1.764 * lnSBP * untreated +
      7.837 * currentSmoker +
      -1.795 * currentSmoker * lnAge +
      0.658 * dm;
    meanCoeff = 61.18;
    baselineSurvival = 0.9144;
  }

  const tenYearRisk = Math.min(1, Math.max(0, 1 - Math.pow(baselineSurvival, Math.exp(sumCoeff - meanCoeff))));

  let lifetimeRisk: number;
  const hasHighRiskFactors = totalCholesterol >= 240 || systolicBP >= 160 || smoker || diabetic;
  const hasBorderlineFactors = (totalCholesterol >= 200 && totalCholesterol < 240) || (systolicBP >= 140 && systolicBP < 160) || onBPMeds;
  const isOptimal = totalCholesterol < 180 && systolicBP < 120 && !onBPMeds && !diabetic && !smoker;

  if (sex === "male") {
    if (hasHighRiskFactors) lifetimeRisk = 0.69;
    else if (hasBorderlineFactors) lifetimeRisk = 0.50;
    else if (isOptimal) lifetimeRisk = 0.05;
    else lifetimeRisk = 0.36;
  } else {
    if (hasHighRiskFactors) lifetimeRisk = 0.50;
    else if (hasBorderlineFactors) lifetimeRisk = 0.39;
    else if (isOptimal) lifetimeRisk = 0.08;
    else lifetimeRisk = 0.27;
  }

  return { tenYearRisk: Math.round(tenYearRisk * 1000) / 10, lifetimeRisk: Math.round(lifetimeRisk * 1000) / 10 };
}

function getRiskCategory(tenYearRisk: number): "low" | "borderline" | "intermediate" | "high" {
  if (tenYearRisk < 5) return "low";
  if (tenYearRisk < 7.5) return "borderline";
  if (tenYearRisk < 20) return "intermediate";
  return "high";
}

function getOptimalRisk(age: number, sex: "male" | "female"): number {
  const optimalInputs: ASCVDInputs = {
    age,
    sex,
    race: "white",
    totalCholesterol: 170,
    hdlCholesterol: 50,
    systolicBP: 110,
    onBPMeds: false,
    diabetic: false,
    smoker: false,
  };
  return calculateASCVD(optimalInputs).tenYearRisk;
}

function getApplicableGuidelines(riskCategory: string, inputs: ASCVDInputs): PreventiveGuideline[] {
  let guidelines = PREVENTIVE_GUIDELINES.filter((g) =>
    g.applicableRiskLevel.includes(riskCategory)
  );

  if (!inputs.smoker) {
    guidelines = guidelines.filter((g) => g.id !== "smoking-cessation");
  }
  if (!inputs.diabetic) {
    guidelines = guidelines.filter((g) => g.id !== "diabetes-management");
  }

  return guidelines;
}

export function calculateASCVDScore(inputs: ASCVDInputs): ASCVDResult {
  if (inputs.age < 40 || inputs.age > 79) {
    const riskCategory = inputs.age < 40 ? "low" : "intermediate";
    return {
      tenYearRisk: -1,
      lifetimeRisk: -1,
      riskCategory,
      optimalRisk: 0,
      riskReduction: 0,
      inputs,
      guidelines: getApplicableGuidelines(riskCategory, inputs),
      calculatedAt: new Date().toISOString(),
    };
  }

  const { tenYearRisk, lifetimeRisk } = calculateASCVD(inputs);
  const riskCategory = getRiskCategory(tenYearRisk);
  const optimalRisk = getOptimalRisk(inputs.age, inputs.sex);
  const riskReduction = Math.max(0, Math.round((tenYearRisk - optimalRisk) * 10) / 10);

  return {
    tenYearRisk,
    lifetimeRisk,
    riskCategory,
    optimalRisk,
    riskReduction,
    inputs,
    guidelines: getApplicableGuidelines(riskCategory, inputs),
    calculatedAt: new Date().toISOString(),
  };
}

export async function extractASCVDInputsFromRecords(userId: string): Promise<{
  inputs: Partial<ASCVDInputs>;
  sources: Record<string, { value: any; date: string; source: string }>;
  confidence: number;
  missingFields: string[];
}> {
  const sources: Record<string, { value: any; date: string; source: string }> = {};
  const inputs: Partial<ASCVDInputs> = {};
  const missingFields: string[] = [];

  const [profile] = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.userId, userId))
    .limit(1);

  if (profile) {
    if (profile.dateOfBirth) {
      const dob = new Date(profile.dateOfBirth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age >= 20 && age <= 100) {
        inputs.age = age;
        sources.age = { value: age, date: profile.dateOfBirth, source: "Patient Profile" };
      }
    }
    if (profile.sex) {
      const sex = profile.sex.toLowerCase();
      if (sex === "male" || sex === "female") {
        inputs.sex = sex as "male" | "female";
        sources.sex = { value: sex, date: "", source: "Patient Profile" };
      }
    }
    if (profile.race) {
      const race = profile.race.toLowerCase();
      if (race.includes("african") || race.includes("black")) {
        inputs.race = "african_american";
      } else if (race.includes("white") || race.includes("caucasian")) {
        inputs.race = "white";
      } else {
        inputs.race = "other";
      }
      sources.race = { value: inputs.race, date: "", source: "Patient Profile" };
    }
  }

  const records = await db
    .select()
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.userId, userId),
        sql`${healthRecords.type} IN ('lab', 'vital')`
      )
    )
    .orderBy(desc(healthRecords.date))
    .limit(200);

  for (const record of records) {
    const details = record.details as any;
    if (!details) continue;

    const title = (record.title || "").toLowerCase();
    const recordDate = record.date ? new Date(record.date).toISOString().split("T")[0] : "";

    if (!sources.totalCholesterol && (title.includes("total cholesterol") || title.includes("cholesterol, total"))) {
      const val = parseFloat(details.value || details.result || "");
      if (!isNaN(val) && val > 50 && val < 500) {
        inputs.totalCholesterol = val;
        sources.totalCholesterol = { value: val, date: recordDate, source: record.provider || "Lab" };
      }
    }

    if (!sources.hdlCholesterol && (title.includes("hdl") || title.includes("high density"))) {
      const val = parseFloat(details.value || details.result || "");
      if (!isNaN(val) && val > 10 && val < 200) {
        inputs.hdlCholesterol = val;
        sources.hdlCholesterol = { value: val, date: recordDate, source: record.provider || "Lab" };
      }
    }

    if (!sources.systolicBP && (title.includes("blood pressure") || title.includes("systolic") || title.includes("bp"))) {
      let val: number | undefined;
      if (details.systolic) {
        val = parseFloat(details.systolic);
      } else if (details.value && typeof details.value === "string" && details.value.includes("/")) {
        val = parseFloat(details.value.split("/")[0]);
      } else if (details.value) {
        val = parseFloat(details.value);
      }
      if (val && !isNaN(val) && val > 60 && val < 300) {
        inputs.systolicBP = val;
        sources.systolicBP = { value: val, date: recordDate, source: record.provider || "Vitals" };
      }
    }

    if (!sources.diabetic && (title.includes("glucose") || title.includes("a1c") || title.includes("hemoglobin a1c") || title.includes("diabetes"))) {
      if (title.includes("a1c") || title.includes("hemoglobin a1c")) {
        const val = parseFloat(details.value || details.result || "");
        if (!isNaN(val) && val >= 6.5) {
          inputs.diabetic = true;
          sources.diabetic = { value: true, date: recordDate, source: record.provider || "Lab" };
        }
      }
      if (title.includes("glucose") && !title.includes("a1c")) {
        const val = parseFloat(details.value || details.result || "");
        if (!isNaN(val) && val >= 126) {
          inputs.diabetic = true;
          sources.diabetic = { value: true, date: recordDate, source: record.provider || "Lab" };
        }
      }
    }
  }

  const medications = await db
    .select()
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.userId, userId),
        eq(healthRecords.type, "medication")
      )
    )
    .orderBy(desc(healthRecords.date))
    .limit(100);

  for (const med of medications) {
    const title = (med.title || "").toLowerCase();
    const details = med.details as any;
    const isActive = !details?.status || details?.status === "active";

    if (isActive && !sources.onBPMeds) {
      const bpMedNames = [
        "lisinopril", "amlodipine", "losartan", "metoprolol", "atenolol",
        "hydrochlorothiazide", "hctz", "valsartan", "ramipril", "enalapril",
        "diltiazem", "nifedipine", "carvedilol", "chlorthalidone", "spironolactone",
        "olmesartan", "irbesartan", "telmisartan", "benazepril", "fosinopril",
      ];
      if (bpMedNames.some((bp) => title.includes(bp))) {
        inputs.onBPMeds = true;
        sources.onBPMeds = { value: true, date: "", source: "Medication List" };
      }
    }
  }

  const conditions = await db
    .select()
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.userId, userId),
        eq(healthRecords.type, "condition")
      )
    )
    .limit(100);

  for (const cond of conditions) {
    const title = (cond.title || "").toLowerCase();
    if (!sources.diabetic && (title.includes("diabetes") || title.includes("type 2 dm") || title.includes("t2dm"))) {
      inputs.diabetic = true;
      sources.diabetic = { value: true, date: "", source: "Conditions" };
    }
  }

  if (inputs.diabetic === undefined) inputs.diabetic = false;
  if (inputs.onBPMeds === undefined) inputs.onBPMeds = false;
  if (inputs.smoker === undefined) inputs.smoker = false;

  const requiredFields = ["age", "sex", "totalCholesterol", "hdlCholesterol", "systolicBP"] as const;
  for (const field of requiredFields) {
    if (inputs[field] === undefined) {
      missingFields.push(field);
    }
  }
  if (!inputs.race) {
    inputs.race = "other";
  }

  const totalFields = 9;
  const filledFields = Object.keys(sources).length + (inputs.diabetic !== undefined ? 1 : 0) + (inputs.onBPMeds !== undefined ? 1 : 0) + (inputs.smoker !== undefined ? 1 : 0);
  const confidence = Math.round((filledFields / totalFields) * 100);

  return { inputs, sources, confidence, missingFields };
}

export function getAllPreventiveGuidelines(): PreventiveGuideline[] {
  return PREVENTIVE_GUIDELINES;
}
