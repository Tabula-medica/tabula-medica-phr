import { generatePhiSafeText } from "./services/ai-gateway";

export type AutocompleteDomain = "conditions" | "medications" | "allergies" | "procedures" | "icd_codes";

export interface AutocompleteSuggestion {
  label: string;
  code?: string;
  system?: string;
  category?: string;
  confidence: number;
}

export interface ValidationIssue {
  field: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion?: string;
}

const COMMON_CONDITIONS = [
  "Hypertension", "Type 2 Diabetes Mellitus", "Type 1 Diabetes Mellitus", "Asthma", "COPD",
  "Major Depressive Disorder", "Generalized Anxiety Disorder", "Hypothyroidism", "Hyperthyroidism",
  "Coronary Artery Disease", "Heart Failure", "Atrial Fibrillation", "Chronic Kidney Disease",
  "Osteoarthritis", "Rheumatoid Arthritis", "GERD", "Irritable Bowel Syndrome", "Crohn's Disease",
  "Ulcerative Colitis", "Migraine", "Epilepsy", "Multiple Sclerosis", "Parkinson's Disease",
  "Alzheimer's Disease", "Breast Cancer", "Lung Cancer", "Colon Cancer", "Prostate Cancer",
  "Anemia", "Deep Vein Thrombosis", "Pulmonary Embolism", "Pneumonia", "Urinary Tract Infection",
  "Celiac Disease", "Psoriasis", "Eczema", "Lupus", "Fibromyalgia", "Obesity", "Sleep Apnea",
  "Stroke", "Peripheral Artery Disease", "Osteoporosis", "Gout", "Diverticulitis"
];

const COMMON_MEDICATIONS = [
  "Lisinopril", "Metformin", "Amlodipine", "Metoprolol", "Atorvastatin", "Omeprazole",
  "Losartan", "Levothyroxine", "Simvastatin", "Hydrochlorothiazide", "Albuterol",
  "Gabapentin", "Sertraline", "Escitalopram", "Fluoxetine", "Amoxicillin", "Azithromycin",
  "Prednisone", "Ibuprofen", "Acetaminophen", "Aspirin", "Warfarin", "Apixaban",
  "Clopidogrel", "Insulin Glargine", "Insulin Lispro", "Duloxetine", "Bupropion",
  "Venlafaxine", "Trazodone", "Cyclobenzaprine", "Meloxicam", "Pantoprazole",
  "Rosuvastatin", "Furosemide", "Spironolactone", "Carvedilol", "Tamsulosin",
  "Montelukast", "Fluticasone", "Cephalexin", "Ciprofloxacin", "Doxycycline"
];

const COMMON_ALLERGIES = [
  "Penicillin", "Amoxicillin", "Sulfonamides", "Aspirin", "Ibuprofen", "NSAIDs",
  "Codeine", "Morphine", "Latex", "Peanuts", "Tree Nuts", "Shellfish", "Fish",
  "Milk", "Eggs", "Wheat", "Soy", "Sesame", "Bee Venom", "Wasp Venom",
  "Dust Mites", "Mold", "Cat Dander", "Dog Dander", "Pollen", "Grass",
  "Ragweed", "Contrast Dye", "Lidocaine", "Tetracycline", "Fluoroquinolones",
  "ACE Inhibitors", "Sulfa Drugs", "Cephalosporins", "Erythromycin"
];

function getLocalSuggestions(query: string, domain: AutocompleteDomain): AutocompleteSuggestion[] {
  const q = query.toLowerCase();
  let items: string[] = [];
  if (domain === "conditions") items = COMMON_CONDITIONS;
  else if (domain === "medications") items = COMMON_MEDICATIONS;
  else if (domain === "allergies") items = COMMON_ALLERGIES;

  return items
    .filter(item => item.toLowerCase().includes(q))
    .slice(0, 8)
    .map((item, i) => ({
      label: item,
      confidence: item.toLowerCase().startsWith(q) ? 0.95 - i * 0.02 : 0.8 - i * 0.02,
    }));
}

export async function getAutocompleteSuggestions(
  query: string,
  domain: AutocompleteDomain,
  patientContext?: { conditions?: string[]; medications?: string[]; allergies?: string[] }
): Promise<AutocompleteSuggestion[]> {
  if (query.length < 2) return [];

  const localResults = getLocalSuggestions(query, domain);
  if (localResults.length >= 5) return localResults;

  try {
    const contextStr = patientContext
      ? `\nPatient context: ${JSON.stringify(patientContext)}`
      : "";

    const content = await generatePhiSafeText({
      system: `You are a medical terminology assistant. Given a partial search query for ${domain}, return a JSON object with a "suggestions" array containing up to 8 matching medical terms. Each item in the array should have: label (display name), code (ICD-10 for conditions, NDC/RxNorm for medications, or relevant code), system (coding system name), category (general category). Only return clinically accurate, commonly used terms. Prioritize results relevant to the patient context if provided. Format: {"suggestions": [...]}${contextStr}`,
      user: `Search query: "${query}" for domain: ${domain}`,
      responseMimeType: "application/json",
      maxTokens: 500,
    });

    if (content) {
      const parsed = JSON.parse(content);
      const rawResults = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.results || []);
      const aiResults: AutocompleteSuggestion[] = rawResults
        .slice(0, 8)
        .map((s: any, i: number) => ({
          label: s.label || s.name || s.term || "",
          code: s.code || undefined,
          system: s.system || undefined,
          category: s.category || undefined,
          confidence: 0.9 - i * 0.05,
        }));

      const merged = [...localResults];
      const existingLabels = new Set(merged.map(r => r.label.toLowerCase()));
      for (const r of aiResults) {
        if (!existingLabels.has(r.label.toLowerCase())) {
          merged.push(r);
          existingLabels.add(r.label.toLowerCase());
        }
      }
      return merged.slice(0, 10);
    }
  } catch (err) {
    console.error("[MedicalAutocomplete] AI suggestion error, using local results:", err);
  }

  return localResults;
}

export async function validateFormEntry(
  domain: string,
  fields: Record<string, any>,
  patientContext?: { conditions?: string[]; medications?: string[]; allergies?: string[]; age?: number; gender?: string }
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (domain === "medication" || domain === "medications") {
    if (fields.name && fields.dosage) {
      const dosageNum = parseFloat(fields.dosage);
      if (isNaN(dosageNum) && fields.dosage && !/\d/.test(fields.dosage)) {
        issues.push({
          field: "dosage",
          severity: "warning",
          message: "Dosage should include a numeric value (e.g., '10mg', '500mg')",
          suggestion: "Include the amount and unit (e.g., '10 mg')"
        });
      }
    }
    if (fields.frequency && fields.frequency.length < 2) {
      issues.push({
        field: "frequency",
        severity: "warning",
        message: "Please specify a valid frequency (e.g., 'twice daily', 'every 8 hours')",
      });
    }
    if (fields.startDate && fields.endDate) {
      if (new Date(fields.endDate) < new Date(fields.startDate)) {
        issues.push({
          field: "endDate",
          severity: "error",
          message: "End date cannot be before start date",
        });
      }
    }
  }

  if (domain === "allergy" || domain === "allergies") {
    if (fields.name && patientContext?.medications) {
      const allergyLower = fields.name.toLowerCase();
      for (const med of patientContext.medications) {
        if (med.toLowerCase().includes(allergyLower) || allergyLower.includes(med.toLowerCase())) {
          issues.push({
            field: "name",
            severity: "error",
            message: `Potential conflict: Patient is currently taking "${med}" which may be related to this allergy`,
            suggestion: "Verify with prescribing provider before adding this allergy"
          });
        }
      }
    }
  }

  if (domain === "condition" || domain === "conditions") {
    if (fields.conditionName && patientContext?.conditions) {
      const condLower = fields.conditionName.toLowerCase();
      const existing = patientContext.conditions.find(c => c.toLowerCase() === condLower);
      if (existing) {
        issues.push({
          field: "conditionName",
          severity: "warning",
          message: `"${existing}" is already listed in the patient's active conditions`,
          suggestion: "Consider updating the existing record instead"
        });
      }
    }
  }

  try {
    const content = await generatePhiSafeText({
      system: `You are a medical data quality validator for a health record system. Analyze the submitted ${domain} data for potential errors, inconsistencies, or safety concerns. Return a JSON object with an "issues" array. Each issue should have: field (field name), severity (info|warning|error), message (clear explanation), suggestion (how to fix, optional). Focus on: clinical accuracy, dosage safety, drug interactions, duplicate entries, missing critical info, date inconsistencies. Do NOT provide clinical decision support or treatment recommendations - only validate data quality. If no issues found, return empty array. Patient context: ${JSON.stringify(patientContext || {})}`,
      user: `Validate this ${domain} entry: ${JSON.stringify(fields)}`,
      responseMimeType: "application/json",
      maxTokens: 500,
    });

    if (content) {
      const parsed = JSON.parse(content);
      const aiIssues: ValidationIssue[] = (parsed.issues || [])
        .filter((i: any) => i.field && i.message)
        .map((i: any) => ({
          field: i.field,
          severity: i.severity === "error" ? "error" : i.severity === "warning" ? "warning" : "info",
          message: i.message,
          suggestion: i.suggestion,
        }));

      const existingFields = new Set(issues.map(i => `${i.field}:${i.message}`));
      for (const ai of aiIssues) {
        if (!existingFields.has(`${ai.field}:${ai.message}`)) {
          issues.push(ai);
        }
      }
    }
  } catch (err) {
    console.error("[MedicalValidation] AI validation error:", err);
  }

  return issues;
}
