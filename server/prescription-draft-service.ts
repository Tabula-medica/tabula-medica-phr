import OpenAI from "openai";
import {
  DEFAULT_CARE_SETTING,
  dosesPerDayFromFrequency,
  resolveDispenseDefaults,
  type CareSetting,
  type DispenseClass,
} from "./services/prescription-dispense-policy";

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
  /** Dose form actually dispensed, e.g. "tablet", "delayed-release capsule". */
  formulation: string;
  frequency: string;
  route: string;
  duration: string;
  /** Days of therapy this fill covers. */
  daysSupply: number;
  quantity: number;
  refills: number;
  careSetting: CareSetting;
  /** Which dispensing rule produced the supply/refill numbers. */
  dispensePolicy: string;
  /** Set when the supply was capped below the standard 100-day default. */
  dispensePolicyReason?: string;
  instructions: string;
  warnings: string[];
  interactions: string[];
  status: "draft" | "reviewed" | "signed";
  disclaimer: string;
}

/**
 * Catalogue entry as authored. `defaultDuration` and `defaultQuantity` are
 * NOT authored here — they are derived from the dispensing policy so that the
 * 100-day default cannot drift out of sync with the catalogue.
 */
interface CatalogMedication {
  name: string;
  genericName: string;
  category: string;
  defaultDosage: string;
  /** Dose form dispensed. */
  defaultFormulation: string;
  defaultFrequency: string;
  defaultRoute: string;
  /** Doses per day — drives the dispensed quantity at the policy's days supply. */
  dosesPerDay: number;
  /** Governs whether this drug may take the extended 100-day default. */
  dispenseClass: DispenseClass;
  commonWarnings: string[];
  contraindications: string[];
}

/** Catalogue entry as exposed, with policy-derived duration and quantity. */
interface CommonMedication extends CatalogMedication {
  defaultDuration: string;
  defaultQuantity: number;
  defaultRefills: number;
}

const MEDICATION_CATALOG: CatalogMedication[] = [
  {
    name: "Lisinopril",
    genericName: "lisinopril",
    category: "ACE Inhibitor",
    defaultDosage: "10mg",
    defaultFormulation: "tablet",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records show hyperkalemia as noted concern", "Records show renal function as noted concern"],
    contraindications: ["Angioedema history", "Pregnancy", "Bilateral renal artery stenosis"],
  },
  {
    name: "Metformin",
    genericName: "metformin HCl",
    category: "Antidiabetic",
    defaultDosage: "500mg",
    defaultFormulation: "film-coated tablet",
    defaultFrequency: "twice daily",
    defaultRoute: "oral",
    dosesPerDay: 2,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records state meals as noted administration context", "Records show lactic acidosis as noted concern"],
    contraindications: ["Renal impairment (eGFR <30)", "Metabolic acidosis"],
  },
  {
    name: "Atorvastatin",
    genericName: "atorvastatin calcium",
    category: "Statin",
    defaultDosage: "20mg",
    defaultFormulation: "tablet",
    defaultFrequency: "once daily at bedtime",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records show muscle pain as noted concern", "Records show liver function as noted concern"],
    contraindications: ["Active liver disease", "Pregnancy"],
  },
  {
    name: "Amlodipine",
    genericName: "amlodipine besylate",
    category: "Calcium Channel Blocker",
    defaultDosage: "5mg",
    defaultFormulation: "tablet",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records show peripheral edema as noted possible effect"],
    contraindications: ["Severe aortic stenosis", "Cardiogenic shock"],
  },
  {
    name: "Omeprazole",
    genericName: "omeprazole",
    category: "Proton Pump Inhibitor",
    defaultDosage: "20mg",
    defaultFormulation: "delayed-release capsule",
    defaultFrequency: "once daily before breakfast",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "guideline-limited-course",
    commonWarnings: ["Records show long-term use means B12 and magnesium as noted concerns"],
    contraindications: ["Hypersensitivity to PPIs"],
  },
  {
    name: "Vitamin D3",
    genericName: "cholecalciferol",
    category: "Supplement",
    defaultDosage: "2000 IU",
    defaultFormulation: "softgel capsule",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records state fatty meal means better absorption"],
    contraindications: ["Hypercalcemia", "Hypervitaminosis D"],
  },
  {
    name: "Fish Oil",
    genericName: "omega-3 fatty acids",
    category: "Supplement",
    defaultDosage: "1000mg",
    defaultFormulation: "softgel capsule",
    defaultFrequency: "once daily",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records show possible GI effects", "Records show blood thinner interaction as noted"],
    contraindications: ["Fish allergy"],
  },
  {
    name: "Levothyroxine",
    genericName: "levothyroxine sodium",
    category: "Thyroid Hormone",
    defaultDosage: "50mcg",
    defaultFormulation: "tablet",
    defaultFrequency: "once daily on empty stomach",
    defaultRoute: "oral",
    dosesPerDay: 1,
    dispenseClass: "chronic-maintenance",
    commonWarnings: ["Records state 30-60 min before food as noted timing", "Records show TSH as noted value"],
    contraindications: ["Uncorrected adrenal insufficiency", "Acute MI"],
  },
];

/**
 * The catalogue as consumed by the API and UI, with `defaultDuration`,
 * `defaultQuantity` and `defaultRefills` derived from the dispensing policy
 * rather than authored per entry. Deriving them is the point: it makes the
 * 100-day default a single fact, so a catalogue entry cannot silently
 * disagree with the policy that governs it.
 */
export const COMMON_MEDICATIONS: CommonMedication[] = MEDICATION_CATALOG.map(
  (med) => {
    const defaults = resolveDispenseDefaults({
      dispenseClass: med.dispenseClass,
      dosesPerDay: med.dosesPerDay,
    });
    return {
      ...med,
      defaultDuration: defaults.duration,
      defaultQuantity: defaults.quantity,
      defaultRefills: defaults.refills,
    };
  },
);

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

/**
 * Warn when a prescriber-entered frequency could not be read.
 *
 * `dosesPerDayFromFrequency` returns null rather than guessing, but the
 * quantity still has to be computed from something — so it falls back to the
 * catalogue's dosing. That fallback is safe only if it is visible: otherwise a
 * sig reading "one tablet every other day" can be dispensed at a once-daily
 * quantity, and nothing on the draft says so. An explicit quantity from the
 * prescriber overrides the computation entirely, so there is nothing to warn
 * about in that case.
 */
function unparsedFrequencyWarning(
  frequency: string | undefined,
  parsedDosesPerDay: number | null,
  explicitQuantity: number | undefined,
  fallbackDosesPerDay: number,
): string[] {
  if (!frequency || parsedDosesPerDay !== null || explicitQuantity !== undefined) {
    return [];
  }
  return [
    `Quantity not derived from the written frequency: "${frequency}" could not be ` +
      `parsed into doses per day, so ${fallbackDosesPerDay} dose(s)/day was used. ` +
      "Verify the quantity against the sig, or enter an explicit quantity.",
  ];
}

export async function generatePrescriptionDraft(
  context: PatientContext,
  medicationName: string,
  customizations?: {
    dosage?: string;
    formulation?: string;
    frequency?: string;
    /** Days of therapy requested. Honoured only up to the class cap. */
    daysSupply?: number;
    duration?: string;
    quantity?: number;
    /** Refills requested. Honoured only up to the class cap. */
    refills?: number;
    careSetting?: CareSetting;
    /** First fill of this medication for this patient — shortens the supply. */
    isNewStart?: boolean;
    additionalInstructions?: string;
  }
): Promise<PrescriptionDraft> {
  const draftId = `rx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseMed = COMMON_MEDICATIONS.find(
    m => m.name.toLowerCase() === medicationName.toLowerCase() ||
         m.genericName.toLowerCase() === medicationName.toLowerCase()
  );
  
  if (!baseMed) {
    // Unclassified: the policy withholds the extended supply on purpose. The
    // system cannot tell whether this is amoxicillin or amlodipine, and
    // guessing 100 days on an antibiotic is the failure worth preventing.
    const unknownParsedDoses = customizations?.frequency
      ? dosesPerDayFromFrequency(customizations.frequency)
      : null;
    const unknownDefaults = resolveDispenseDefaults({
      dispenseClass: "unclassified",
      dosesPerDay: unknownParsedDoses ?? 1,
      careSetting: customizations?.careSetting,
      isNewStart: customizations?.isNewStart,
      requestedDaysSupply: customizations?.daysSupply,
      requestedRefills: customizations?.refills,
    });

    return {
      id: draftId,
      patientId: context.patientId,
      generatedAt: new Date().toISOString(),
      medication: medicationName,
      genericName: medicationName,
      dosage: customizations?.dosage || "As directed",
      formulation: customizations?.formulation || "As directed",
      frequency: customizations?.frequency || "As directed",
      route: "oral",
      duration: customizations?.duration || unknownDefaults.duration,
      daysSupply: unknownDefaults.daysSupply,
      quantity: customizations?.quantity ?? unknownDefaults.quantity,
      refills: customizations?.refills ?? unknownDefaults.refills,
      careSetting: unknownDefaults.careSetting,
      dispensePolicy: unknownDefaults.appliedPolicy,
      dispensePolicyReason: unknownDefaults.capReason,
      instructions: customizations?.additionalInstructions || "Take as directed by physician",
      warnings: [
        "Medication not in common database - full review needed",
        "Extended 100-day supply withheld: the medication is unclassified, so an antibiotic, controlled substance, or monitoring-bound drug cannot be ruled out.",
        ...unparsedFrequencyWarning(
          customizations?.frequency,
          unknownParsedDoses,
          customizations?.quantity,
          1,
        ),
      ],
      interactions: checkInteractions(medicationName, context.currentMedications),
      status: "draft",
      disclaimer: "Draft prescription. Requires clinician review, verification, and signature.",
    };
  }
  
  const interactions = checkInteractions(baseMed.name, context.currentMedications);
  const contraWarnings = checkContraindications(baseMed, context);
  const allWarnings = [...baseMed.commonWarnings, ...contraWarnings];
  
  // Doses/day follows the prescribed frequency when it is overridden, so the
  // dispensed quantity tracks the actual regimen rather than the catalogue's.
  const parsedDosesPerDay = customizations?.frequency
    ? dosesPerDayFromFrequency(customizations.frequency)
    : null;
  const dosesPerDay = parsedDosesPerDay ?? baseMed.dosesPerDay;
  const frequencyWarning = unparsedFrequencyWarning(
    customizations?.frequency,
    parsedDosesPerDay,
    customizations?.quantity,
    baseMed.dosesPerDay,
  );

  const dispense = resolveDispenseDefaults({
    dispenseClass: baseMed.dispenseClass,
    dosesPerDay,
    careSetting: customizations?.careSetting,
    isNewStart: customizations?.isNewStart,
    requestedDaysSupply: customizations?.daysSupply,
    requestedRefills: customizations?.refills,
  });

  const formulation = customizations?.formulation || baseMed.defaultFormulation;

  let instructions = `Take ${customizations?.dosage || baseMed.defaultDosage} ${formulation} ${customizations?.frequency || baseMed.defaultFrequency}`;
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
    formulation,
    frequency: customizations?.frequency || baseMed.defaultFrequency,
    route: baseMed.defaultRoute,
    duration: customizations?.duration || dispense.duration,
    daysSupply: dispense.daysSupply,
    quantity: customizations?.quantity ?? dispense.quantity,
    refills: dispense.refills,
    careSetting: dispense.careSetting,
    dispensePolicy: dispense.appliedPolicy,
    dispensePolicyReason: dispense.capReason,
    instructions,
    warnings: dispense.capReason
      ? [...allWarnings, ...frequencyWarning, `Dispensing: ${dispense.capReason}`]
      : [...allWarnings, ...frequencyWarning],
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
