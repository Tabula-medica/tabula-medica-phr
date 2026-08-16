import type { Medication, Allergy, LabResult, MedicalRecord } from "@shared/schema";
import { generatePhiSafeText } from "./services/ai-gateway";
import {
  ExplainableInsight,
  explainMedicationSafetyAlert,
  explainLabTrendInsight,
  explainDocumentSummary,
  logAuditEntry,
  EXPLAINABILITY_VERSION,
  RULE_ENGINE_VERSION,
  AIModelInfo,
} from "./explainability";

type MedWithClasses = { medication: Medication; classes: string[] };

const AI_MODEL_INFO: AIModelInfo = {
  modelId: "gemini-2.5-flash",
  modelVersion: "gemini-2.5-flash",
  provider: "Vertex AI (Google BAA)",
  responseFormat: "json_object",
};

export type AlertSeverity = "critical" | "high" | "moderate" | "low" | "info";
export type AlertType = "drug_interaction" | "duplicate_medication" | "allergy_conflict" | "lab_threshold" | "lab_trend" | "dosage_warning";

export interface MedicationSafetyAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  medications: string[];
  recommendation: string;
  drugClasses?: string[];
  createdAt: string;
  explainability?: ExplainableInsight;
}

export interface LabTrendInsight {
  labName: string;
  currentValue: number;
  unit: string;
  trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  trendPercentage: number;
  status: "normal" | "borderline" | "abnormal" | "critical";
  normalRange: { low: number; high: number };
  historicalValues: { date: string; value: number }[];
  explanation: string;
  recommendation: string;
  explainability?: ExplainableInsight;
}

export interface DocumentSummary {
  documentId: string;
  documentType: string;
  title: string;
  date: string;
  provider: string;
  facility: string;
  summary: string;
  keyFindings: string[];
  diagnoses: string[];
  procedures: string[];
  followUpActions: string[];
  explainability?: ExplainableInsight;
}

export type { ExplainableInsight } from "./explainability";
export { getAuditLog, generateComplianceReport } from "./explainability";

const drugClassifications: Record<string, string[]> = {
  "ace_inhibitors": ["lisinopril", "enalapril", "ramipril", "benazepril", "captopril", "fosinopril", "quinapril", "perindopril"],
  "arbs": ["losartan", "valsartan", "irbesartan", "candesartan", "olmesartan", "telmisartan", "azilsartan"],
  "beta_blockers": ["metoprolol", "atenolol", "carvedilol", "bisoprolol", "propranolol", "nebivolol", "labetalol"],
  "calcium_channel_blockers": ["amlodipine", "diltiazem", "verapamil", "nifedipine", "felodipine", "nicardipine"],
  "statins": ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "lovastatin", "fluvastatin", "pitavastatin"],
  "diuretics_thiazide": ["hydrochlorothiazide", "chlorthalidone", "metolazone", "indapamide"],
  "diuretics_loop": ["furosemide", "bumetanide", "torsemide", "ethacrynic acid"],
  "diuretics_potassium_sparing": ["spironolactone", "eplerenone", "amiloride", "triamterene"],
  "anticoagulants": ["warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "enoxaparin", "heparin"],
  "antiplatelet": ["aspirin", "clopidogrel", "prasugrel", "ticagrelor", "dipyridamole"],
  "nsaids": ["ibuprofen", "naproxen", "meloxicam", "celecoxib", "diclofenac", "indomethacin", "ketorolac", "piroxicam"],
  "opioids": ["oxycodone", "hydrocodone", "morphine", "fentanyl", "tramadol", "codeine", "hydromorphone", "methadone"],
  "benzodiazepines": ["alprazolam", "lorazepam", "diazepam", "clonazepam", "temazepam", "midazolam"],
  "ssris": ["sertraline", "fluoxetine", "paroxetine", "citalopram", "escitalopram", "fluvoxamine"],
  "snris": ["venlafaxine", "duloxetine", "desvenlafaxine", "levomilnacipran"],
  "tricyclics": ["amitriptyline", "nortriptyline", "imipramine", "desipramine", "doxepin"],
  "maois": ["phenelzine", "tranylcypromine", "selegiline", "isocarboxazid"],
  "ppis": ["omeprazole", "pantoprazole", "esomeprazole", "lansoprazole", "rabeprazole", "dexlansoprazole"],
  "h2_blockers": ["ranitidine", "famotidine", "cimetidine", "nizatidine"],
  "sulfonylureas": ["glipizide", "glyburide", "glimepiride"],
  "biguanides": ["metformin"],
  "dpp4_inhibitors": ["sitagliptin", "saxagliptin", "linagliptin", "alogliptin"],
  "sglt2_inhibitors": ["empagliflozin", "dapagliflozin", "canagliflozin", "ertugliflozin"],
  "glp1_agonists": ["semaglutide", "liraglutide", "dulaglutide", "exenatide", "tirzepatide"],
  "insulin": ["insulin glargine", "insulin lispro", "insulin aspart", "insulin detemir", "insulin degludec"],
  "thyroid": ["levothyroxine", "liothyronine", "methimazole", "propylthiouracil"],
  "corticosteroids": ["prednisone", "prednisolone", "methylprednisolone", "dexamethasone", "hydrocortisone", "budesonide"],
  "fluoroquinolones": ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"],
  "macrolides": ["azithromycin", "clarithromycin", "erythromycin"],
  "penicillins": ["amoxicillin", "ampicillin", "penicillin", "piperacillin"],
  "cephalosporins": ["cephalexin", "cefuroxime", "ceftriaxone", "cefdinir", "cefepime"],
};

const drugInteractionRules: {
  class1: string;
  class2: string;
  severity: AlertSeverity;
  description: string;
  recommendation: string;
}[] = [
  {
    class1: "ace_inhibitors",
    class2: "arbs",
    severity: "high",
    description: "Combining ACE inhibitors with ARBs increases risk of kidney problems, high potassium, and low blood pressure.",
    recommendation: "Usually only one of these medication types is needed. Discuss with your doctor."
  },
  {
    class1: "ace_inhibitors",
    class2: "diuretics_potassium_sparing",
    severity: "high",
    description: "Both medications can raise potassium levels, risking dangerously high potassium (hyperkalemia).",
    recommendation: "Your potassium levels should be monitored regularly. Contact your doctor if you experience muscle weakness or irregular heartbeat."
  },
  {
    class1: "anticoagulants",
    class2: "nsaids",
    severity: "critical",
    description: "Taking blood thinners with anti-inflammatory pain relievers significantly increases bleeding risk.",
    recommendation: "Avoid NSAIDs while on blood thinners. Use acetaminophen (Tylenol) for pain instead. Seek immediate care if you notice unusual bleeding or bruising."
  },
  {
    class1: "anticoagulants",
    class2: "antiplatelet",
    severity: "high",
    description: "Combining blood thinners with antiplatelet medications increases bleeding risk.",
    recommendation: "This combination may be intentional after certain heart procedures. Monitor for signs of bleeding."
  },
  {
    class1: "opioids",
    class2: "benzodiazepines",
    severity: "critical",
    description: "Combining opioid pain medications with anxiety medications can cause severe breathing problems or death.",
    recommendation: "This combination should be avoided. Discuss alternatives with your doctor immediately."
  },
  {
    class1: "ssris",
    class2: "maois",
    severity: "critical",
    description: "Combining these antidepressants can cause serotonin syndrome - a potentially life-threatening condition.",
    recommendation: "Never take these medications together. A washout period is required when switching between them."
  },
  {
    class1: "ssris",
    class2: "nsaids",
    severity: "moderate",
    description: "This combination may increase risk of stomach bleeding.",
    recommendation: "Consider taking a stomach-protecting medication if you need both. Watch for signs of stomach upset or bleeding."
  },
  {
    class1: "statins",
    class2: "macrolides",
    severity: "high",
    description: "Some antibiotics can increase statin levels, raising risk of muscle damage (rhabdomyolysis).",
    recommendation: "Your doctor may temporarily stop your statin during antibiotic treatment. Report any muscle pain immediately."
  },
  {
    class1: "statins",
    class2: "calcium_channel_blockers",
    severity: "moderate",
    description: "Certain calcium channel blockers can increase statin levels.",
    recommendation: "Your statin dose may need adjustment. Report any muscle pain or weakness."
  },
  {
    class1: "biguanides",
    class2: "diuretics_loop",
    severity: "moderate",
    description: "Loop diuretics can affect blood sugar control and kidney function when combined with metformin.",
    recommendation: "Blood sugar and kidney function should be monitored more frequently."
  },
  {
    class1: "fluoroquinolones",
    class2: "corticosteroids",
    severity: "high",
    description: "This combination increases risk of tendon damage and rupture.",
    recommendation: "Avoid strenuous activity. Stop medication and seek care if you experience tendon pain or swelling."
  },
  {
    class1: "ppis",
    class2: "antiplatelet",
    severity: "moderate",
    description: "Proton pump inhibitors may reduce the effectiveness of certain antiplatelet medications.",
    recommendation: "Discuss with your doctor whether an alternative stomach medication would be better."
  },
  {
    class1: "thyroid",
    class2: "calcium_channel_blockers",
    severity: "low",
    description: "Calcium can reduce thyroid medication absorption.",
    recommendation: "Take thyroid medication at least 4 hours apart from calcium-containing products."
  },
  {
    class1: "diuretics_thiazide",
    class2: "nsaids",
    severity: "moderate",
    description: "NSAIDs can reduce the effectiveness of blood pressure medications and affect kidney function.",
    recommendation: "Monitor blood pressure more frequently. Limit NSAID use when possible."
  },
];

function getMedicationDrugClass(medicationName: string): string[] {
  const normalizedName = medicationName.toLowerCase().trim();
  const classes: string[] = [];
  
  for (const [drugClass, medications] of Object.entries(drugClassifications)) {
    if (medications.some(med => normalizedName.includes(med) || med.includes(normalizedName))) {
      classes.push(drugClass);
    }
  }
  
  return classes;
}

function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function checkMedicationSafety(
  medications: Medication[],
  allergies: Allergy[] = []
): MedicationSafetyAlert[] {
  const alerts: MedicationSafetyAlert[] = [];
  const activeMedications = medications.filter(m => m.status === "active");
  
  const medClassMap: Map<string, { medication: Medication; classes: string[] }> = new Map();
  for (const med of activeMedications) {
    const classes = getMedicationDrugClass(med.name);
    medClassMap.set(med.id, { medication: med, classes });
  }

  const checkedPairs = new Set<string>();
  const medClassEntries = Array.from(medClassMap.entries());
  
  for (const [id1, data1] of medClassEntries) {
    for (const [id2, data2] of medClassEntries) {
      if (id1 >= id2) continue;
      
      const pairKey = [id1, id2].sort().join("-");
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);
      
      for (const class1 of data1.classes) {
        for (const class2 of data2.classes) {
          const interaction = drugInteractionRules.find(
            rule =>
              (rule.class1 === class1 && rule.class2 === class2) ||
              (rule.class1 === class2 && rule.class2 === class1)
          );
          
          if (interaction) {
            alerts.push({
              id: generateAlertId(),
              type: "drug_interaction",
              severity: interaction.severity,
              title: `Drug Interaction: ${data1.medication.name} + ${data2.medication.name}`,
              description: interaction.description,
              medications: [data1.medication.name, data2.medication.name],
              recommendation: interaction.recommendation,
              drugClasses: [class1, class2],
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  const classCount: Map<string, Medication[]> = new Map();
  for (const [_, data] of medClassEntries) {
    for (const drugClass of data.classes) {
      const existing = classCount.get(drugClass) || [];
      existing.push(data.medication);
      classCount.set(drugClass, existing);
    }
  }
  
  for (const [drugClass, meds] of Array.from(classCount.entries())) {
    if (meds.length > 1) {
      const classNames: Record<string, string> = {
        ace_inhibitors: "ACE Inhibitors",
        arbs: "ARBs",
        beta_blockers: "Beta Blockers",
        statins: "Statins",
        ssris: "SSRIs",
        ppis: "Proton Pump Inhibitors",
        nsaids: "NSAIDs",
        opioids: "Opioids",
        benzodiazepines: "Benzodiazepines",
      };
      
      alerts.push({
        id: generateAlertId(),
        type: "duplicate_medication",
        severity: "moderate",
        title: `Multiple ${classNames[drugClass] || drugClass} medications`,
        description: `You are taking ${meds.length} medications from the same drug class (${classNames[drugClass] || drugClass}). This may indicate duplicate therapy.`,
        medications: meds.map(m => m.name),
        recommendation: "Discuss with your doctor whether all these medications are necessary.",
        drugClasses: [drugClass],
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const allergy of allergies) {
    const allergyName = allergy.name.toLowerCase();
    
    for (const med of activeMedications) {
      const medName = med.name.toLowerCase();
      const medClasses = getMedicationDrugClass(med.name);
      
      if (allergyName.includes("penicillin") && medClasses.includes("penicillins")) {
        alerts.push({
          id: generateAlertId(),
          type: "allergy_conflict",
          severity: "critical",
          title: `Allergy Alert: ${med.name} contains Penicillin`,
          description: `You have a recorded penicillin allergy, and ${med.name} is a penicillin-type antibiotic.`,
          medications: [med.name],
          recommendation: "Contact your prescriber immediately. Do not take this medication.",
          createdAt: new Date().toISOString(),
        });
      }
      
      if (allergyName.includes("sulfa") && medName.includes("sulfamethoxazole")) {
        alerts.push({
          id: generateAlertId(),
          type: "allergy_conflict",
          severity: "critical",
          title: `Allergy Alert: ${med.name} contains Sulfa`,
          description: `You have a recorded sulfa allergy, and ${med.name} contains sulfonamide.`,
          medications: [med.name],
          recommendation: "Contact your prescriber immediately. Do not take this medication.",
          createdAt: new Date().toISOString(),
        });
      }
      
      if (allergyName.includes("nsaid") && medClasses.includes("nsaids")) {
        alerts.push({
          id: generateAlertId(),
          type: "allergy_conflict",
          severity: "high",
          title: `Allergy Alert: ${med.name} is an NSAID`,
          description: `You have a recorded NSAID allergy/sensitivity, and ${med.name} is an NSAID.`,
          medications: [med.name],
          recommendation: "Discuss with your doctor before taking this medication.",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  
  alerts.sort((a, b) => {
    const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  return alerts;
}

const labNormalRanges: Record<string, { low: number; high: number; unit: string; criticalLow?: number; criticalHigh?: number }> = {
  "hemoglobin": { low: 12.0, high: 17.5, unit: "g/dL", criticalLow: 7.0, criticalHigh: 20.0 },
  "hematocrit": { low: 36, high: 50, unit: "%", criticalLow: 20, criticalHigh: 60 },
  "wbc": { low: 4.5, high: 11.0, unit: "K/uL", criticalLow: 2.0, criticalHigh: 30.0 },
  "platelets": { low: 150, high: 400, unit: "K/uL", criticalLow: 50, criticalHigh: 1000 },
  "glucose": { low: 70, high: 100, unit: "mg/dL", criticalLow: 50, criticalHigh: 400 },
  "glucose_fasting": { low: 70, high: 100, unit: "mg/dL", criticalLow: 50, criticalHigh: 400 },
  "hba1c": { low: 4.0, high: 5.6, unit: "%", criticalHigh: 14.0 },
  "creatinine": { low: 0.7, high: 1.3, unit: "mg/dL", criticalHigh: 10.0 },
  "bun": { low: 7, high: 20, unit: "mg/dL", criticalHigh: 100 },
  "egfr": { low: 90, high: 120, unit: "mL/min/1.73m2", criticalLow: 15 },
  "sodium": { low: 136, high: 145, unit: "mEq/L", criticalLow: 120, criticalHigh: 160 },
  "potassium": { low: 3.5, high: 5.0, unit: "mEq/L", criticalLow: 2.5, criticalHigh: 6.5 },
  "chloride": { low: 98, high: 106, unit: "mEq/L" },
  "co2": { low: 23, high: 29, unit: "mEq/L", criticalLow: 10, criticalHigh: 40 },
  "calcium": { low: 8.5, high: 10.5, unit: "mg/dL", criticalLow: 6.0, criticalHigh: 14.0 },
  "total_protein": { low: 6.0, high: 8.3, unit: "g/dL" },
  "albumin": { low: 3.5, high: 5.0, unit: "g/dL" },
  "bilirubin_total": { low: 0.1, high: 1.2, unit: "mg/dL", criticalHigh: 15.0 },
  "alt": { low: 7, high: 56, unit: "U/L", criticalHigh: 1000 },
  "ast": { low: 10, high: 40, unit: "U/L", criticalHigh: 1000 },
  "alp": { low: 44, high: 147, unit: "U/L" },
  "cholesterol_total": { low: 0, high: 200, unit: "mg/dL" },
  "ldl": { low: 0, high: 100, unit: "mg/dL" },
  "hdl": { low: 40, high: 60, unit: "mg/dL" },
  "triglycerides": { low: 0, high: 150, unit: "mg/dL", criticalHigh: 500 },
  "tsh": { low: 0.4, high: 4.0, unit: "mIU/L", criticalLow: 0.01, criticalHigh: 100 },
  "t4_free": { low: 0.8, high: 1.8, unit: "ng/dL" },
  "t3_free": { low: 2.3, high: 4.2, unit: "pg/mL" },
  "vitamin_d": { low: 30, high: 100, unit: "ng/mL", criticalLow: 10 },
  "vitamin_b12": { low: 200, high: 900, unit: "pg/mL", criticalLow: 100 },
  "ferritin": { low: 12, high: 300, unit: "ng/mL" },
  "iron": { low: 60, high: 170, unit: "mcg/dL" },
  "psa": { low: 0, high: 4.0, unit: "ng/mL" },
  "inr": { low: 0.8, high: 1.2, unit: "", criticalHigh: 5.0 },
  "pt": { low: 11, high: 13.5, unit: "seconds" },
  "ptt": { low: 25, high: 35, unit: "seconds" },
};

function normalizeLabName(name: string): string {
  const normalized = name.toLowerCase().trim()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  
  const aliases: Record<string, string> = {
    "hgb": "hemoglobin",
    "hct": "hematocrit",
    "white_blood_cell": "wbc",
    "white_blood_cells": "wbc",
    "platelet_count": "platelets",
    "plt": "platelets",
    "fasting_glucose": "glucose_fasting",
    "blood_glucose": "glucose",
    "hemoglobin_a1c": "hba1c",
    "glycated_hemoglobin": "hba1c",
    "a1c": "hba1c",
    "blood_urea_nitrogen": "bun",
    "estimated_gfr": "egfr",
    "glomerular_filtration_rate": "egfr",
    "na": "sodium",
    "k": "potassium",
    "cl": "chloride",
    "carbon_dioxide": "co2",
    "bicarbonate": "co2",
    "ca": "calcium",
    "total_bilirubin": "bilirubin_total",
    "alanine_aminotransferase": "alt",
    "sgpt": "alt",
    "aspartate_aminotransferase": "ast",
    "sgot": "ast",
    "alkaline_phosphatase": "alp",
    "total_cholesterol": "cholesterol_total",
    "ldl_cholesterol": "ldl",
    "hdl_cholesterol": "hdl",
    "thyroid_stimulating_hormone": "tsh",
    "free_t4": "t4_free",
    "free_t3": "t3_free",
    "25_hydroxy_vitamin_d": "vitamin_d",
    "prostate_specific_antigen": "psa",
    "prothrombin_time": "pt",
    "partial_thromboplastin_time": "ptt",
  };
  
  return aliases[normalized] || normalized;
}

export function analyzeLabTrends(
  labResults: LabResult[]
): LabTrendInsight[] {
  const insights: LabTrendInsight[] = [];
  
  const groupedLabs: Map<string, LabResult[]> = new Map();
  for (const lab of labResults) {
    const normalizedName = normalizeLabName(lab.testName);
    const existing = groupedLabs.get(normalizedName) || [];
    existing.push(lab);
    groupedLabs.set(normalizedName, existing);
  }
  
  for (const [labName, results] of Array.from(groupedLabs.entries())) {
    const ranges = labNormalRanges[labName];
    if (!ranges) continue;
    
    const sortedResults = results
      .filter((r: LabResult) => r.value !== null && !isNaN(Number(r.value)))
      .sort((a: LabResult, b: LabResult) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (sortedResults.length === 0) continue;
    
    const latestResult = sortedResults[sortedResults.length - 1];
    const currentValue = Number(latestResult.value);
    
    let status: "normal" | "borderline" | "abnormal" | "critical" = "normal";
    if (ranges.criticalLow && currentValue < ranges.criticalLow) {
      status = "critical";
    } else if (ranges.criticalHigh && currentValue > ranges.criticalHigh) {
      status = "critical";
    } else if (currentValue < ranges.low || currentValue > ranges.high) {
      status = "abnormal";
    } else if (
      currentValue < ranges.low + (ranges.high - ranges.low) * 0.1 ||
      currentValue > ranges.high - (ranges.high - ranges.low) * 0.1
    ) {
      status = "borderline";
    }
    
    let trend: "increasing" | "decreasing" | "stable" | "fluctuating" = "stable";
    let trendPercentage = 0;
    
    if (sortedResults.length >= 2) {
      const values = sortedResults.map((r: LabResult) => Number(r.value));
      const firstValue = values[0];
      const lastValue = values[values.length - 1];
      
      if (firstValue !== 0) {
        trendPercentage = ((lastValue - firstValue) / firstValue) * 100;
      }
      
      let increases = 0;
      let decreases = 0;
      for (let i = 1; i < values.length; i++) {
        if (values[i] > values[i - 1]) increases++;
        else if (values[i] < values[i - 1]) decreases++;
      }
      
      const changeThreshold = 5;
      if (Math.abs(trendPercentage) < changeThreshold) {
        trend = "stable";
      } else if (increases > decreases * 2) {
        trend = "increasing";
      } else if (decreases > increases * 2) {
        trend = "decreasing";
      } else if (increases > 0 && decreases > 0) {
        trend = "fluctuating";
      } else if (trendPercentage > 0) {
        trend = "increasing";
      } else {
        trend = "decreasing";
      }
    }
    
    const friendlyNames: Record<string, string> = {
      hemoglobin: "Hemoglobin",
      hematocrit: "Hematocrit",
      wbc: "White Blood Cells",
      platelets: "Platelets",
      glucose: "Blood Sugar",
      glucose_fasting: "Fasting Blood Sugar",
      hba1c: "HbA1c (Average Blood Sugar)",
      creatinine: "Creatinine (Kidney Function)",
      bun: "BUN (Kidney Function)",
      egfr: "eGFR (Kidney Function)",
      sodium: "Sodium",
      potassium: "Potassium",
      calcium: "Calcium",
      cholesterol_total: "Total Cholesterol",
      ldl: "LDL (Bad Cholesterol)",
      hdl: "HDL (Good Cholesterol)",
      triglycerides: "Triglycerides",
      tsh: "TSH (Thyroid)",
      alt: "ALT (Liver)",
      ast: "AST (Liver)",
      vitamin_d: "Vitamin D",
    };
    
    let explanation = "";
    let recommendation = "";
    
    if (status === "critical") {
      explanation = `Your ${friendlyNames[labName] || labName} level of ${currentValue} ${ranges.unit} is in a critical range and needs immediate attention.`;
      recommendation = "Contact your healthcare provider immediately or seek urgent care.";
    } else if (status === "abnormal") {
      if (currentValue < ranges.low) {
        explanation = `Your ${friendlyNames[labName] || labName} is lower than normal at ${currentValue} ${ranges.unit} (normal: ${ranges.low}-${ranges.high}).`;
      } else {
        explanation = `Your ${friendlyNames[labName] || labName} is higher than normal at ${currentValue} ${ranges.unit} (normal: ${ranges.low}-${ranges.high}).`;
      }
      recommendation = "Discuss this result with your doctor at your next visit.";
    } else if (status === "borderline") {
      explanation = `Your ${friendlyNames[labName] || labName} of ${currentValue} ${ranges.unit} is near the edge of normal range.`;
      recommendation = "Monitor this value at your next lab test.";
    } else {
      explanation = `Your ${friendlyNames[labName] || labName} of ${currentValue} ${ranges.unit} is within normal range.`;
      recommendation = "Keep up your current health habits.";
    }
    
    if (trend === "increasing" && Math.abs(trendPercentage) > 10) {
      explanation += ` It has increased by ${Math.abs(trendPercentage).toFixed(1)}% over your recent tests.`;
    } else if (trend === "decreasing" && Math.abs(trendPercentage) > 10) {
      explanation += ` It has decreased by ${Math.abs(trendPercentage).toFixed(1)}% over your recent tests.`;
    }
    
    insights.push({
      labName: friendlyNames[labName] || labName,
      currentValue,
      unit: ranges.unit,
      trend,
      trendPercentage: Math.round(trendPercentage * 10) / 10,
      status,
      normalRange: { low: ranges.low, high: ranges.high },
      historicalValues: sortedResults.map(r => ({
        date: r.date,
        value: Number(r.value),
      })),
      explanation,
      recommendation,
    });
  }
  
  insights.sort((a, b) => {
    const statusOrder = { critical: 0, abnormal: 1, borderline: 2, normal: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
  
  return insights;
}

export async function generateDocumentSummary(
  document: MedicalRecord
): Promise<DocumentSummary> {
  const prompt = `You are a helpful medical assistant that explains health documents in plain, easy-to-understand language for patients. 

Summarize this medical document for a patient:

Document Type: ${document.type}
Title: ${document.title}
Date: ${document.date}
Provider: ${document.provider || "Unknown"}
Facility: ${document.facility || "Unknown"}
Description: ${document.description || "No description available"}

Provide a response in JSON format with these fields:
- summary: A 2-3 sentence plain-English summary of what this document is about
- keyFindings: Array of 3-5 key findings or important points (in simple terms)
- diagnoses: Array of any diagnoses mentioned (empty array if none)
- procedures: Array of any procedures performed (empty array if none)
- followUpActions: Array of any recommended follow-up actions (empty array if none)

Important: Use simple, everyday language. Avoid medical jargon. Explain as if talking to someone with no medical background.`;

  try {
    const content = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    return {
      documentId: document.id,
      documentType: document.type,
      title: document.title,
      date: document.date,
      provider: document.provider || "Unknown",
      facility: document.facility || "Unknown",
      summary: parsed.summary || "Summary not available.",
      keyFindings: parsed.keyFindings || [],
      diagnoses: parsed.diagnoses || [],
      procedures: parsed.procedures || [],
      followUpActions: parsed.followUpActions || [],
    };
  } catch (error) {
    console.error("Error generating document summary:", error);
    return {
      documentId: document.id,
      documentType: document.type,
      title: document.title,
      date: document.date,
      provider: document.provider || "Unknown",
      facility: document.facility || "Unknown",
      summary: `This is a ${document.type} document from ${document.date}.`,
      keyFindings: [document.description || "No additional details available."],
      diagnoses: [],
      procedures: [],
      followUpActions: [],
    };
  }
}

export async function generateBatchDocumentSummaries(
  documents: MedicalRecord[]
): Promise<DocumentSummary[]> {
  const summaries: DocumentSummary[] = [];
  
  for (const doc of documents.slice(0, 10)) {
    const summary = await generateDocumentSummary(doc);
    summaries.push(summary);
  }
  
  return summaries;
}

export interface HealthInsightsSummary {
  medicationAlerts: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    total: number;
  };
  labInsights: {
    critical: number;
    abnormal: number;
    borderline: number;
    normal: number;
    total: number;
  };
  recentAlerts: MedicationSafetyAlert[];
  recentLabConcerns: LabTrendInsight[];
}

export function generateHealthInsightsSummary(
  medicationAlerts: MedicationSafetyAlert[],
  labInsights: LabTrendInsight[]
): HealthInsightsSummary {
  return {
    medicationAlerts: {
      critical: medicationAlerts.filter(a => a.severity === "critical").length,
      high: medicationAlerts.filter(a => a.severity === "high").length,
      moderate: medicationAlerts.filter(a => a.severity === "moderate").length,
      low: medicationAlerts.filter(a => a.severity === "low").length,
      total: medicationAlerts.length,
    },
    labInsights: {
      critical: labInsights.filter(l => l.status === "critical").length,
      abnormal: labInsights.filter(l => l.status === "abnormal").length,
      borderline: labInsights.filter(l => l.status === "borderline").length,
      normal: labInsights.filter(l => l.status === "normal").length,
      total: labInsights.length,
    },
    recentAlerts: medicationAlerts.slice(0, 5),
    recentLabConcerns: labInsights.filter(l => l.status !== "normal").slice(0, 5),
  };
}

export function checkMedicationSafetyWithExplainability(
  medications: Medication[],
  allergies: Allergy[] = [],
  options?: { patientId?: string; requesterId?: string; requesterRole?: string }
): MedicationSafetyAlert[] {
  const alerts = checkMedicationSafety(medications, allergies);
  const activeMedications = medications.filter(m => m.status === "active");
  
  return alerts.map(alert => {
    const relatedMeds = activeMedications.filter(m => 
      alert.medications.includes(m.name)
    );
    
    const ruleId = `rule-${alert.type}-${(alert.drugClasses || []).sort().join("-")}`;
    const ruleName = alert.type === "drug_interaction" 
      ? `${(alert.drugClasses || []).join(" + ")} Interaction Rule`
      : alert.type === "duplicate_medication"
      ? `Duplicate ${(alert.drugClasses || [])[0]} Detection`
      : `${alert.type} Detection Rule`;
    
    const explainability = explainMedicationSafetyAlert(
      {
        type: alert.type,
        severity: alert.severity,
        medications: alert.medications,
        drugClasses: alert.drugClasses,
        description: alert.description,
      },
      relatedMeds,
      ruleId,
      ruleName
    );
    
    logAuditEntry({
      action: "insight_generated",
      insightId: explainability.insightId,
      insightType: "medication_safety_alert",
      patientId: options?.patientId || "unknown",
      userId: options?.requesterId,
      userRole: options?.requesterRole,
      details: {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        medications: alert.medications,
        dataSources: relatedMeds.map(m => m.ehrConnectionId),
      },
    });
    
    return { ...alert, explainability };
  });
}

export function analyzeLabTrendsWithExplainability(
  labResults: LabResult[],
  options?: { patientId?: string; requesterId?: string; requesterRole?: string }
): LabTrendInsight[] {
  const insights = analyzeLabTrends(labResults);
  
  return insights.map(insight => {
    const relatedResults = labResults.filter(r => 
      normalizeLabName(r.testName) === normalizeLabName(insight.labName)
    );
    
    const explainability = explainLabTrendInsight(insight, relatedResults);
    
    logAuditEntry({
      action: "insight_generated",
      insightId: explainability.insightId,
      insightType: "lab_trend_insight",
      patientId: options?.patientId || "unknown",
      userId: options?.requesterId,
      userRole: options?.requesterRole,
      details: {
        labName: insight.labName,
        status: insight.status,
        trend: insight.trend,
        currentValue: insight.currentValue,
        dataSources: relatedResults.map(r => r.ehrConnectionId),
      },
    });
    
    return { ...insight, explainability };
  });
}

export async function generateDocumentSummaryWithExplainability(
  document: MedicalRecord,
  options?: { patientId?: string; requesterId?: string; requesterRole?: string }
): Promise<DocumentSummary> {
  const summary = await generateDocumentSummary(document);
  
  const explainability = explainDocumentSummary(
    {
      documentId: summary.documentId,
      documentType: summary.documentType,
      summary: summary.summary,
      keyFindings: summary.keyFindings,
    },
    document,
    AI_MODEL_INFO
  );
  
  logAuditEntry({
    action: "insight_generated",
    insightId: explainability.insightId,
    insightType: "document_summary",
    patientId: options?.patientId || document.patientId,
    userId: options?.requesterId,
    userRole: options?.requesterRole,
    details: {
      documentId: document.id,
      documentType: document.type,
      dataSources: [document.ehrConnectionId],
    },
  });
  
  return { ...summary, explainability };
}

// ============================================
// AI HEALTH INSIGHTS & COACHING (NEW)
// ============================================

import { storage } from "./storage";
import type {
  HealthRiskAssessment,
  HealthCoachingSession,
  PopulationHealthTrend,
  PersonalizedHealthInsight,
  RiskCategory,
  RiskLevel,
} from "@shared/schema";

// Generate comprehensive health risk assessment
export async function generateHealthRiskAssessment(patientId: string): Promise<HealthRiskAssessment[]> {
  const patient = await findPatientForUser(patientId);
  if (!patient) return [];

  const vitals = await storage.getVitalsByPatient(patient.id);
  const conditions = await storage.getProblemsByPatient(patient.id);
  const medications = await storage.getMedicationsByPatient(patient.id);
  const allergies = await storage.getAllergiesByPatient(patient.id);
  const adherenceStats = await storage.getMedicationAdherenceStats(patientId);

  const patientData = {
    vitals: vitals.slice(0, 10).map(v => ({
      type: v.type,
      value: v.value,
      unit: v.unit,
      recordedAt: v.recordedAt,
    })),
    conditions: conditions.map(c => ({
      name: c.name,
      status: c.status,
      severity: c.severity,
      onsetDate: c.onsetDate,
    })),
    medications: medications.filter(m => m.status === "active").map(m => ({
      name: m.name,
      dosage: m.dosage,
    })),
    allergies: allergies.map(a => ({ name: a.allergen, severity: a.severity })),
    adherenceRate: adherenceStats?.adherenceRate || 0,
  };

  try {
    const content = await generatePhiSafeText({
      system: `You are a health risk assessment AI. Analyze patient health data to identify potential risk areas.
Categories: cardiovascular, metabolic, respiratory, mental_health, chronic_disease, lifestyle, medication, preventive_care
Risk levels: low, moderate, elevated, high

IMPORTANT: Provide educational health insights only. Never diagnose or prescribe.
Respond with a JSON object containing a "risks" array.`,
      user: `Analyze this patient data for health risks:
${JSON.stringify(patientData, null, 2)}

Return JSON object:
{
  "risks": [{
    "category": "cardiovascular|metabolic|respiratory|...",
    "riskLevel": "low|moderate|elevated|high",
    "riskScore": 0-100,
    "title": "Brief risk title",
    "description": "Educational explanation",
    "riskFactors": ["factor1", "factor2"],
    "recommendations": ["recommendation1", "recommendation2"],
    "evidenceBasis": ["data point used"]
  }]
}`,
      maxTokens: 1500,
      temperature: 0.3,
      responseMimeType: "application/json",
    });

    if (!content) return [];

    const parsed = JSON.parse(content);
    const risks = parsed.risks;
    if (!risks || !Array.isArray(risks)) return [];

    const assessments: HealthRiskAssessment[] = [];
    for (const risk of risks) {
      const assessment = await storage.createHealthRiskAssessment({
        patientId,
        category: risk.category as RiskCategory,
        riskLevel: risk.riskLevel as RiskLevel,
        riskScore: risk.riskScore || 50,
        title: risk.title,
        description: risk.description,
        riskFactors: risk.riskFactors || [],
        recommendations: risk.recommendations || [],
        evidenceBasis: risk.evidenceBasis || [],
        aiConfidence: 75,
      });
      assessments.push(assessment);
    }

    return assessments;
  } catch (error) {
    console.error("Error generating risk assessment:", error);
    return [];
  }
}

// Create AI health coaching session
export async function createHealthCoachingSession(
  patientId: string,
  goalType: string,
  customGoal?: string
): Promise<HealthCoachingSession | null> {
  const patient = await findPatientForUser(patientId);
  if (!patient) return null;

  const patientData = await gatherPatientContext(patient.id);

  try {
    const content = await generatePhiSafeText({
      system: `You are a supportive AI health coach. Create personalized coaching plans based on patient data.
Focus on: education, encouragement, achievable goals, and healthy habits.
NEVER provide medical advice or treatment recommendations.
Respond with a JSON object containing the coaching plan.`,
      user: `Create a health coaching plan for this patient:
Goal Type: ${goalType}
${customGoal ? `Custom Goal: ${customGoal}` : ""}

Patient Context:
${JSON.stringify(patientData, null, 2)}

Return JSON object:
{
  "title": "Coaching plan title",
  "goal": "Specific, achievable goal statement",
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "tips": ["personalized tip 1", "personalized tip 2"],
  "milestones": [
    { "title": "Week 1 goal", "description": "What to achieve" },
    { "title": "Week 2 goal", "description": "What to achieve" }
  ]
}`,
      maxTokens: 1000,
      temperature: 0.6,
      responseMimeType: "application/json",
    });

    if (!content) return null;

    const plan = JSON.parse(content);

    const session = await storage.createHealthCoachingSession({
      patientId,
      goalType: goalType as any,
      title: plan.title || `${goalType.replace(/_/g, " ")} Coaching`,
      currentGoal: plan.goal || customGoal || "Improve overall health",
      aiRecommendations: plan.recommendations || [],
      personalizedTips: plan.tips || [],
    });

    return session;
  } catch (error) {
    console.error("Error creating coaching session:", error);
    return null;
  }
}

// Get AI coaching advice for a session
export async function getCoachingAdvice(sessionId: string, question: string): Promise<string> {
  const session = await storage.getHealthCoachingSession(sessionId);
  if (!session) return "Session not found.";

  try {
    const content = await generatePhiSafeText({
      system: `You are a supportive AI health coach helping a patient with their goal: "${session.currentGoal}".
Provide encouraging, educational responses. Never give medical advice.
Keep responses concise and actionable.`,
      user: question,
      maxTokens: 300,
      temperature: 0.7,
    });

    return content || "I'm here to help you with your health goals.";
  } catch (error) {
    console.error("Error getting coaching advice:", error);
    return "I'm having trouble responding right now. Please try again.";
  }
}

// Analyze population health trends (de-identified)
export async function analyzePopulationTrends(): Promise<PopulationHealthTrend[]> {
  const patients = await storage.getPatients();
  const allConditions: string[] = [];
  const allMedications: string[] = [];

  for (const patient of patients) {
    const conditions = await storage.getProblemsByPatient(patient.id);
    const medications = await storage.getMedicationsByPatient(patient.id);

    conditions.forEach(c => allConditions.push(c.name));
    medications.filter(m => m.status === "active").forEach(m => allMedications.push(m.name));
  }

  const conditionCounts = countOccurrencesHelper(allConditions);
  const medicationCounts = countOccurrencesHelper(allMedications);

  const trends: PopulationHealthTrend[] = [];

  const topConditions = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [condition, count] of topConditions) {
    if (count >= 2) {
      const trend = await storage.createPopulationHealthTrend({
        trendType: "condition_prevalence",
        title: `${condition} Prevalence`,
        description: `${condition} is observed across multiple patient records.`,
        dataPoints: patients.length,
        timeRange: "all_time",
        significance: count >= 3 ? "significant" : "noteworthy",
        relatedConditions: [condition],
      });
      trends.push(trend);
    }
  }

  const topMedications = Object.entries(medicationCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [medication, count] of topMedications) {
    if (count >= 2) {
      const trend = await storage.createPopulationHealthTrend({
        trendType: "medication_usage",
        title: `${medication} Usage Pattern`,
        description: `${medication} is commonly prescribed.`,
        dataPoints: patients.length,
        timeRange: "all_time",
        significance: "informational",
        relatedMedications: [medication],
      });
      trends.push(trend);
    }
  }

  return trends;
}

// Generate personalized health insights
export async function generatePersonalizedInsights(patientId: string): Promise<PersonalizedHealthInsight[]> {
  const patient = await findPatientForUser(patientId);
  if (!patient) return [];

  const adherenceStats = await storage.getMedicationAdherenceStats(patientId);
  const riskAssessments = await storage.getHealthRiskAssessments(patientId);

  const insights: PersonalizedHealthInsight[] = [];

  if (adherenceStats && adherenceStats.adherenceRate >= 90) {
    const insight = await storage.createPersonalizedHealthInsight({
      patientId,
      insightType: "achievement",
      category: "medication",
      title: "Excellent Medication Adherence!",
      message: `You've maintained ${adherenceStats.adherenceRate}% medication adherence. Keep up the great work!`,
      priority: "low",
      actionRequired: false,
      relatedData: [],
      aiConfidence: 95,
    });
    insights.push(insight);
  } else if (adherenceStats && adherenceStats.adherenceRate < 70) {
    const insight = await storage.createPersonalizedHealthInsight({
      patientId,
      insightType: "coaching_tip",
      category: "medication",
      title: "Medication Reminder Tips",
      message: "Setting daily reminders and keeping medications visible can help improve consistency.",
      priority: "medium",
      actionRequired: true,
      actionText: "Set Up Reminders",
      actionLink: "/medications",
      relatedData: [],
      aiConfidence: 85,
    });
    insights.push(insight);
  }

  const highRisks = riskAssessments.filter(r => r.riskLevel === "high" || r.riskLevel === "elevated");
  for (const risk of highRisks.slice(0, 2)) {
    const insight = await storage.createPersonalizedHealthInsight({
      patientId,
      insightType: "risk_update",
      category: risk.category,
      title: `${risk.category.replace(/_/g, " ")} Health Alert`,
      message: `Your ${risk.category.replace(/_/g, " ")} risk shows elevated indicators. ${risk.recommendations[0] || "Consider discussing with your provider."}`,
      priority: risk.riskLevel === "high" ? "high" : "medium",
      actionRequired: true,
      actionText: "View Details",
      actionLink: "/insights",
      relatedData: [{ type: "risk_assessment", id: risk.id, label: risk.title }],
      aiConfidence: risk.aiConfidence,
    });
    insights.push(insight);
  }

  return insights;
}

// Helper functions
async function findPatientForUser(patientUserId: string) {
  const patients = await storage.getPatients();
  return patients.find(p => p.email?.includes(patientUserId.split("@")[0])) || patients[0];
}

async function gatherPatientContext(patientId: string) {
  const vitals = await storage.getVitalsByPatient(patientId);
  const conditions = await storage.getProblemsByPatient(patientId);
  const medications = await storage.getMedicationsByPatient(patientId);
  const allergies = await storage.getAllergiesByPatient(patientId);

  return {
    vitals: vitals.slice(0, 5).map(v => ({ type: v.type, value: v.value, unit: v.unit })),
    conditions: conditions.map(c => ({ name: c.name, status: c.status })),
    activeMedications: medications.filter(m => m.status === "active").length,
    allergies: allergies.length,
  };
}

function countOccurrencesHelper(arr: string[]): Record<string, number> {
  return arr.reduce((acc, item) => {
    const normalized = item.toLowerCase().trim();
    acc[normalized] = (acc[normalized] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
