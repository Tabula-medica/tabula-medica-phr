import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

interface PatientContext {
  patientId: string;
  name: string;
  age: number;
  weight?: number;
  allergies: string[];
  currentMedications: string[];
  conditions: string[];
  renalFunction?: string;
  hepaticFunction?: string;
}

interface PrescriptionDraft {
  id: string;
  patientId: string;
  generatedAt: string;
  medication: string;
  genericName: string;
  brandName?: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
  warnings: string[];
  interactions: string[];
  status: "draft" | "reviewed" | "signed";
  disclaimer: string;
}

interface CommonMedication {
  name: string;
  genericName: string;
  category: string;
  defaultDosage: string;
  defaultFrequency: string;
  defaultRoute: string;
  defaultDuration: string;
  defaultQuantity: number;
  commonWarnings: string[];
  contraindications: string[];
}

export const COMMON_MEDICATIONS: CommonMedication[] = [
  {
    name: "Lisinopril",
    genericName: "lisinopril",
    category: "ACE Inhibitor",
    defaultDosage: "10mg",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    defaultDuration: "30 days",
    defaultQuantity: 30,
    commonWarnings: ["Records show hyperkalemia as noted concern", "Records show renal function as noted concern"],
    contraindications: ["Angioedema history", "Pregnancy", "Bilateral renal artery stenosis"],
  },
  {
    name: "Metformin",
    genericName: "metformin HCl",
    category: "Antidiabetic",
    defaultDosage: "500mg",
    defaultFrequency: "twice daily",
    defaultRoute: "oral",
    defaultDuration: "30 days",
    defaultQuantity: 60,
    commonWarnings: ["Records state meals as noted administration context", "Records show lactic acidosis as noted concern"],
    contraindications: ["Renal impairment (eGFR <30)", "Metabolic acidosis"],
  },
  {
    name: "Atorvastatin",
    genericName: "atorvastatin calcium",
    category: "Statin",
    defaultDosage: "20mg",
    defaultFrequency: "once daily at bedtime",
    defaultRoute: "oral",
    defaultDuration: "30 days",
    defaultQuantity: 30,
    commonWarnings: ["Records show muscle pain as noted concern", "Records show liver function as noted concern"],
    contraindications: ["Active liver disease", "Pregnancy"],
  },
  {
    name: "Amlodipine",
    genericName: "amlodipine besylate",
    category: "Calcium Channel Blocker",
    defaultDosage: "5mg",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    defaultDuration: "30 days",
    defaultQuantity: 30,
    commonWarnings: ["Records show peripheral edema as noted possible effect"],
    contraindications: ["Severe aortic stenosis", "Cardiogenic shock"],
  },
  {
    name: "Omeprazole",
    genericName: "omeprazole",
    category: "Proton Pump Inhibitor",
    defaultDosage: "20mg",
    defaultFrequency: "once daily before breakfast",
    defaultRoute: "oral",
    defaultDuration: "14 days",
    defaultQuantity: 14,
    commonWarnings: ["Records show long-term use means B12 and magnesium as noted concerns"],
    contraindications: ["Hypersensitivity to PPIs"],
  },
  {
    name: "Vitamin D3",
    genericName: "cholecalciferol",
    category: "Supplement",
    defaultDosage: "2000 IU",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    defaultDuration: "90 days",
    defaultQuantity: 90,
    commonWarnings: ["Records state fatty meal means better absorption"],
    contraindications: ["Hypercalcemia", "Hypervitaminosis D"],
  },
  {
    name: "Fish Oil",
    genericName: "omega-3 fatty acids",
    category: "Supplement",
    defaultDosage: "1000mg",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    defaultDuration: "90 days",
    defaultQuantity: 90,
    commonWarnings: ["Records show possible GI effects", "Records show blood thinner interaction as noted"],
    contraindications: ["Fish allergy"],
  },
  {
    name: "Levothyroxine",
    genericName: "levothyroxine sodium",
    category: "Thyroid Hormone",
    defaultDosage: "50mcg",
    defaultFrequency: "once daily on empty stomach",
    defaultRoute: "oral",
    defaultDuration: "30 days",
    defaultQuantity: 30,
    commonWarnings: ["Records state 30-60 min before food as noted timing", "Records show TSH as noted value"],
    contraindications: ["Uncorrected adrenal insufficiency", "Acute MI"],
  },
];

function checkInteractions(medication: string, currentMeds: string[]): string[] {
  const interactions: string[] = [];
  const medLower = medication.toLowerCase();
  
  const interactionMap: Record<string, string[]> = {
    "lisinopril": ["potassium supplements", "spironolactone", "nsaids"],
    "metformin": ["contrast dye", "alcohol"],
    "atorvastatin": ["grapefruit", "gemfibrozil", "niacin"],
    "warfarin": ["aspirin", "nsaids", "vitamin k"],
    "levothyroxine": ["calcium", "iron", "antacids"],
  };
  
  const knownInteractions = interactionMap[medLower] || [];
  
  for (const currentMed of currentMeds) {
    const currentLower = currentMed.toLowerCase();
    if (knownInteractions.some(int => currentLower.includes(int))) {
      interactions.push(`Records show possible interaction between ${medication} and ${currentMed}`);
    }
  }
  
  return interactions;
}

function checkContraindications(medication: CommonMedication, context: PatientContext): string[] {
  const warnings: string[] = [];
  
  for (const allergy of context.allergies) {
    if (medication.name.toLowerCase().includes(allergy.toLowerCase()) ||
        medication.genericName.toLowerCase().includes(allergy.toLowerCase())) {
      warnings.push(`Patient records show allergy to ${allergy} - refers to prescribing verification`);
    }
  }
  
  for (const condition of context.conditions) {
    const condLower = condition.toLowerCase();
    for (const contra of medication.contraindications) {
      if (condLower.includes(contra.toLowerCase()) || contra.toLowerCase().includes(condLower)) {
        warnings.push(`Records show ${condition} - records state ${contra} as noted contraindication`);
      }
    }
  }
  
  if (context.renalFunction === "impaired" && 
      ["metformin", "lisinopril"].includes(medication.genericName.toLowerCase())) {
    warnings.push("Records show renal impairment - refers to dose adjustment verification");
  }
  
  return warnings;
}

export async function generatePrescriptionDraft(
  context: PatientContext,
  medicationName: string,
  customizations?: {
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity?: number;
    refills?: number;
    additionalInstructions?: string;
  }
): Promise<PrescriptionDraft> {
  const draftId = `rx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseMed = COMMON_MEDICATIONS.find(
    m => m.name.toLowerCase() === medicationName.toLowerCase() ||
         m.genericName.toLowerCase() === medicationName.toLowerCase()
  );
  
  if (!baseMed) {
    return {
      id: draftId,
      patientId: context.patientId,
      generatedAt: new Date().toISOString(),
      medication: medicationName,
      genericName: medicationName,
      dosage: customizations?.dosage || "As directed",
      frequency: customizations?.frequency || "As directed",
      route: "oral",
      duration: customizations?.duration || "As directed",
      quantity: customizations?.quantity || 30,
      refills: customizations?.refills || 0,
      instructions: customizations?.additionalInstructions || "Take as directed by physician",
      warnings: ["Medication not in common database - full review needed"],
      interactions: checkInteractions(medicationName, context.currentMedications),
      status: "draft",
      disclaimer: "Draft prescription. Requires clinician review, verification, and signature.",
    };
  }
  
  const interactions = checkInteractions(baseMed.name, context.currentMedications);
  const contraWarnings = checkContraindications(baseMed, context);
  const allWarnings = [...baseMed.commonWarnings, ...contraWarnings];
  
  let instructions = `Take ${customizations?.dosage || baseMed.defaultDosage} ${customizations?.frequency || baseMed.defaultFrequency}`;
  if (customizations?.additionalInstructions) {
    instructions += `. ${customizations.additionalInstructions}`;
  }
  
  return {
    id: draftId,
    patientId: context.patientId,
    generatedAt: new Date().toISOString(),
    medication: baseMed.name,
    genericName: baseMed.genericName,
    brandName: baseMed.name,
    dosage: customizations?.dosage || baseMed.defaultDosage,
    frequency: customizations?.frequency || baseMed.defaultFrequency,
    route: baseMed.defaultRoute,
    duration: customizations?.duration || baseMed.defaultDuration,
    quantity: customizations?.quantity || baseMed.defaultQuantity,
    refills: customizations?.refills ?? 0,
    instructions,
    warnings: allWarnings,
    interactions,
    status: "draft",
    disclaimer: "Draft prescription. Requires clinician review, verification, and signature before dispensing.",
  };
}

export function getMedicationCategories(): string[] {
  const categories = new Set(COMMON_MEDICATIONS.map(m => m.category));
  return Array.from(categories).sort();
}

export function getMedicationsByCategory(category: string): CommonMedication[] {
  return COMMON_MEDICATIONS.filter(m => m.category === category);
}
