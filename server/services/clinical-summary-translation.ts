import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

// ============================================================================
// CLINICAL TERM PRESERVATION - CRITICAL SAFETY FEATURE
// These terms must NEVER be translated to prevent dangerous medical confusion
// ============================================================================

// Common drug names (generic and brand) - must remain in original form
const PRESERVED_DRUG_NAMES = [
  // Diabetes medications
  "metformin", "Glucophage", "insulin", "glipizide", "glyburide", "sitagliptin", 
  "Januvia", "liraglutide", "Ozempic", "Trulicity", "Jardiance", "empagliflozin",
  // Cardiovascular
  "lisinopril", "atenolol", "metoprolol", "amlodipine", "losartan", "valsartan",
  "atorvastatin", "Lipitor", "simvastatin", "rosuvastatin", "Crestor", "pravastatin",
  "warfarin", "Coumadin", "aspirin", "clopidogrel", "Plavix", "apixaban", "Eliquis",
  "rivaroxaban", "Xarelto", "digoxin", "furosemide", "Lasix", "hydrochlorothiazide",
  // Pain/Anti-inflammatory
  "ibuprofen", "naproxen", "acetaminophen", "Tylenol", "morphine", "oxycodone",
  "hydrocodone", "tramadol", "gabapentin", "pregabalin", "Lyrica",
  // Mental health
  "sertraline", "Zoloft", "fluoxetine", "Prozac", "escitalopram", "Lexapro",
  "venlafaxine", "Effexor", "duloxetine", "Cymbalta", "bupropion", "Wellbutrin",
  "alprazolam", "Xanax", "lorazepam", "Ativan", "clonazepam",
  // Respiratory
  "albuterol", "fluticasone", "budesonide", "montelukast", "Singulair",
  // Antibiotics
  "amoxicillin", "azithromycin", "Zithromax", "ciprofloxacin", "levofloxacin",
  "doxycycline", "metronidazole", "trimethoprim", "sulfamethoxazole",
  // Thyroid
  "levothyroxine", "Synthroid", "liothyronine", "methimazole",
  // GI
  "omeprazole", "Prilosec", "pantoprazole", "esomeprazole", "Nexium", "famotidine",
  // Other common
  "prednisone", "methylprednisolone", "diphenhydramine", "Benadryl", "cetirizine",
  "loratadine", "Claritin", "montelukast"
];

// Lab test names - must remain recognizable
const PRESERVED_LAB_NAMES = [
  "HbA1c", "A1C", "hemoglobin A1c", "fasting glucose", "FBG", "FBS",
  "CBC", "complete blood count", "WBC", "RBC", "hemoglobin", "hematocrit",
  "platelet", "MCV", "MCH", "MCHC", "RDW",
  "BMP", "CMP", "basic metabolic panel", "comprehensive metabolic panel",
  "sodium", "Na", "potassium", "K", "chloride", "Cl", "bicarbonate", "CO2",
  "BUN", "blood urea nitrogen", "creatinine", "eGFR", "GFR",
  "glucose", "calcium", "Ca", "magnesium", "Mg", "phosphorus",
  "ALT", "AST", "ALP", "bilirubin", "albumin", "total protein",
  "LDL", "HDL", "triglycerides", "cholesterol", "lipid panel",
  "TSH", "T3", "T4", "free T4", "thyroid",
  "PT", "INR", "PTT", "aPTT", "D-dimer", "fibrinogen",
  "troponin", "BNP", "NT-proBNP", "CRP", "ESR", "sed rate",
  "PSA", "vitamin D", "25-OH vitamin D", "vitamin B12", "folate", "ferritin", "iron",
  "urinalysis", "UA", "urine culture", "blood culture",
  "SpO2", "O2 sat", "oxygen saturation", "ABG", "arterial blood gas",
  "BMI", "body mass index", "BP", "blood pressure", "HR", "heart rate"
];

// ICD-10 and diagnostic codes - must remain in original form
const PRESERVED_DIAGNOSIS_PATTERNS = [
  /\b[A-Z]\d{2}(\.\d{1,4})?\b/g,  // ICD-10 codes like E11.9, I10, J45.20
  /\bICD-?\d{0,2}\b/gi,           // ICD references
  /\bCPT\s*\d+\b/gi,              // CPT codes
  /\bHCPCS\b/gi,                  // HCPCS codes
  /\bSNOMED\b/gi,                 // SNOMED codes
  /\bLOINC\b/gi,                  // LOINC codes
  /\bRxNorm\b/gi                  // RxNorm codes
];

// Medical units - must remain exact
const PRESERVED_UNITS = [
  "mg", "mcg", "µg", "g", "kg", "lb", "lbs", "oz",
  "mL", "ml", "L", "dL", "cc",
  "mg/dL", "mmol/L", "mEq/L", "ng/mL", "pg/mL", "µg/dL",
  "U/L", "IU/L", "IU", "units",
  "mmHg", "bpm", "°F", "°C",
  "cm", "mm", "m", "in", "inches", "ft", "feet",
  "%", "x10^3/µL", "x10^6/µL", "cells/µL",
  "mcg/min", "mg/hr", "mL/hr", "mg/kg",
  "q.d.", "b.i.d.", "t.i.d.", "q.i.d.", "p.r.n.", "PRN",
  "PO", "IV", "IM", "SC", "SQ", "SL", "PR", "TOP"
];

// Common medical abbreviations
const PRESERVED_ABBREVIATIONS = [
  "STAT", "NPO", "BID", "TID", "QID", "QHS", "QD", "PRN",
  "HEENT", "CV", "GI", "GU", "MSK", "NEURO", "PSYCH", "DERM",
  "Dx", "Hx", "Tx", "Rx", "Sx", "Px", "PMH", "PSH", "FH", "SH",
  "ROS", "PE", "A/P", "CC", "HPI", "SOAP",
  "WNL", "NAD", "VSS", "AAOx3", "PERRLA", "RRR", "CTA", "S1S2",
  "NKDA", "NKA", "PCN", "sulfa",
  "EKG", "ECG", "CXR", "CT", "MRI", "US", "PET", "DEXA",
  "ICU", "ER", "ED", "OR", "PACU", "L&D"
];

// Function to extract and mark clinical terms for preservation
export function extractClinicalTerms(text: string): { 
  terms: string[]; 
  markedText: string; 
} {
  const terms: Set<string> = new Set();
  let markedText = text;
  
  // Extract drug names
  for (const drug of PRESERVED_DRUG_NAMES) {
    const regex = new RegExp(`\\b${drug}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(m => terms.add(m));
    }
  }
  
  // Extract lab names
  for (const lab of PRESERVED_LAB_NAMES) {
    const regex = new RegExp(`\\b${lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(m => terms.add(m));
    }
  }
  
  // Extract medical units with values
  const unitPattern = new RegExp(
    `\\b\\d+[.,]?\\d*\\s*(${PRESERVED_UNITS.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );
  const unitMatches = text.match(unitPattern);
  if (unitMatches) {
    unitMatches.forEach(m => terms.add(m));
  }
  
  // Extract diagnosis codes
  for (const pattern of PRESERVED_DIAGNOSIS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => terms.add(m));
    }
  }
  
  // Extract abbreviations
  for (const abbr of PRESERVED_ABBREVIATIONS) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(m => terms.add(m));
    }
  }
  
  return { terms: Array.from(terms), markedText };
}

// Generate preservation instruction for AI prompt
function generatePreservationInstruction(text: string): string {
  const { terms } = extractClinicalTerms(text);
  
  if (terms.length === 0) {
    return "";
  }
  
  return `
CRITICAL SAFETY REQUIREMENT - CLINICAL TERM PRESERVATION:
The following terms MUST remain EXACTLY as written (do NOT translate them):
${terms.slice(0, 50).join(', ')}${terms.length > 50 ? '... and similar medical terms' : ''}

This includes:
- ALL drug names (generic and brand names like "metformin", "Lipitor")
- ALL lab test names (like "HbA1c", "CBC", "TSH")
- ALL diagnostic codes (like "E11.9", "I10")
- ALL medical units (like "mg/dL", "mmHg", "mg")
- ALL medical abbreviations (like "BID", "PRN", "NPO")

These terms must appear in the translated text EXACTLY as they appear in the original.
Translating these terms could cause dangerous medical confusion.`;
}

export interface ClinicalSummary {
  id: string;
  patientId: string;
  title: string;
  content: string;
  category: string;
  dateCreated: string;
  originalLanguage: string;
}

export interface TranslatedSummary {
  originalSummary: ClinicalSummary;
  targetLanguage: string;
  translatedTitle: string;
  translatedContent: string;
  plainLanguageVersion: string;
  translatedAt: string;
  noCdsCompliance: string;
}

export const supportedLanguages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "中文" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "tl", name: "Tagalog", nativeName: "Tagalog" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "fa", name: "Persian (Farsi)", nativeName: "فارسی" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά" },
  { code: "he", name: "Hebrew", nativeName: "עברית" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "cs", name: "Czech", nativeName: "Čeština" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar" }
];

// Sample clinical summaries for samplenstration
const sampleSummaries: ClinicalSummary[] = [
  {
    id: "sum-001",
    patientId: "patient-001",
    title: "Annual Physical Examination Summary",
    content: `Patient presented for annual wellness examination. Vital signs within normal limits: BP 118/76 mmHg, HR 72 bpm, Temp 98.6°F, SpO2 98% on room air.

General appearance: Alert and oriented, no acute distress.
HEENT: Normocephalic, pupils equal and reactive, oropharynx clear.
Cardiovascular: Regular rate and rhythm, no murmurs.
Respiratory: Clear to auscultation bilaterally.
Abdomen: Soft, non-tender, no masses.
Extremities: No edema, pulses 2+ bilaterally.

Laboratory results from routine screening within normal parameters. Lipid panel and metabolic panel reviewed with patient.

Preventive care discussed including age-appropriate cancer screenings and vaccinations.`,
    category: "Wellness Visit",
    dateCreated: new Date().toISOString(),
    originalLanguage: "en"
  },
  {
    id: "sum-002",
    patientId: "patient-001",
    title: "Medication Review Summary",
    content: `Comprehensive medication reconciliation completed. Current medications reviewed for appropriateness, dosing, and potential interactions.

Active Medications:
1. Lisinopril 10mg daily - for blood pressure management
2. Metformin 500mg twice daily - for blood sugar management
3. Atorvastatin 20mg at bedtime - for cholesterol management
4. Vitamin D3 1000 IU daily - supplementation

All medications tolerated well. No adverse effects reported. Patient demonstrates understanding of medication purposes and proper administration. Refills provided as needed. Next medication review scheduled in 6 months.`,
    category: "Medication Review",
    dateCreated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    originalLanguage: "en"
  },
  {
    id: "sum-003",
    patientId: "patient-001",
    title: "Chronic Condition Management Update",
    content: `Follow-up visit for chronic condition management.

Type 2 Diabetes: HbA1c improved from 7.2% to 6.8%. Blood glucose logs reviewed - fasting glucose averaging 110-130 mg/dL. Current regimen effective.

Hypertension: Blood pressure well-controlled on current therapy. Home BP readings averaging 125/78 mmHg.

Lifestyle modifications discussed:
- Continue current diet plan with focus on whole grains and vegetables
- Maintain physical activity goal of 150 minutes moderate exercise weekly
- Continue weight management efforts

Patient reports feeling well with good energy levels. No new symptoms or concerns. Continue current management plan with follow-up in 3 months.`,
    category: "Chronic Care",
    dateCreated: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    originalLanguage: "en"
  }
];

class ClinicalSummaryTranslationService {
  getSummaries(patientId: string): ClinicalSummary[] {
    return sampleSummaries.filter(s => s.patientId === patientId || patientId === "patient-001");
  }

  getSupportedLanguages() {
    return supportedLanguages;
  }

  async translateSummary(
    summaryId: string, 
    targetLanguageCode: string,
    options?: { 
      includePlainLanguage?: boolean;
      readingLevel?: "basic" | "intermediate" | "advanced";
    }
  ): Promise<TranslatedSummary> {
    const summary = sampleSummaries.find(s => s.id === summaryId);
    if (!summary) {
      throw new Error("Summary not found");
    }

    const targetLanguage = supportedLanguages.find(l => l.code === targetLanguageCode);
    if (!targetLanguage) {
      throw new Error("Unsupported language");
    }

    const readingLevel = options?.readingLevel || "intermediate";
    const includePlainLanguage = options?.includePlainLanguage !== false;

    if (!aiEnabled) {
      // Return a placeholder when AI is not configured
      return {
        originalSummary: summary,
        targetLanguage: targetLanguage.name,
        translatedTitle: `[${targetLanguage.name}] ${summary.title}`,
        translatedContent: `[Translation to ${targetLanguage.name} requires AI configuration]\n\nOriginal content:\n${summary.content}`,
        plainLanguageVersion: includePlainLanguage ? 
          `[Plain language version in ${targetLanguage.name} requires AI configuration]\n\nThis is a summary of your health visit.` : "",
        translatedAt: new Date().toISOString(),
        noCdsCompliance: "TRANSLATED HEALTH INFORMATION. This translation is for educational understanding only. NOT medical advice. Always verify important medical information with your healthcare provider."
      };
    }

    try {
      // Extract clinical terms for preservation
      const preservationInstruction = generatePreservationInstruction(summary.title + " " + summary.content);
      const { terms: extractedTerms } = extractClinicalTerms(summary.title + " " + summary.content);
      
      console.log(`[Clinical Term Preservation] Found ${extractedTerms.length} terms to preserve:`, extractedTerms.slice(0, 20));
      
      const content = await generatePhiSafeText({
        system: `You are a medical document TRANSLATOR. Your ONLY job is to convert text from one language to another.

ABSOLUTE RULES - VIOLATIONS CAUSE HARM:
1. ONLY translate - never add explanations or interpretations
2. NEVER add medical advice or recommendations
3. NEVER explain what findings mean or what actions to take
4. NEVER add content that wasn't in the original document
5. Preserve the exact medical meaning without elaboration
6. For plain language: simplify vocabulary only, do not add interpretation
${preservationInstruction}

You MUST end every translation with this disclaimer in the target language:
"[This is a translation of your health record. It is NOT medical advice. Please discuss any questions with your healthcare provider.]"

Output format:
TRANSLATED_TITLE: [translated title]
TRANSLATED_CONTENT: [exact translation, no additions]
PLAIN_LANGUAGE: [simplified vocabulary, same content, no interpretations]
PRESERVED_TERMS: [comma-separated list of clinical terms kept in original form]`,
        user: `Translate the following clinical summary to ${targetLanguage.name} (${targetLanguage.nativeName}).
Reading level: ${readingLevel}
Include plain language version: ${includePlainLanguage}

TITLE: ${summary.title}

CONTENT:
${summary.content}

IMPORTANT: Keep ALL drug names, lab test names, diagnostic codes, and medical units in their ORIGINAL English form. Do NOT translate terms like "${extractedTerms.slice(0, 10).join('", "')}" - these must remain exactly as written for patient safety.

Please provide the translation maintaining medical accuracy while making it accessible to patients.`,
        maxTokens: 2000,
      });

      // Parse the response
      const sections = (content || "").split(/TRANSLATED_TITLE:|TRANSLATED_CONTENT:|PLAIN_LANGUAGE:/);
      const titleMatch = sections[1]?.trim();
      const contentMatch = sections[2]?.trim();
      const plainMatch = sections[3]?.trim();

      return {
        originalSummary: summary,
        targetLanguage: targetLanguage.name,
        translatedTitle: titleMatch || `[${targetLanguage.name}] ${summary.title}`,
        translatedContent: contentMatch || content,
        plainLanguageVersion: plainMatch || "",
        translatedAt: new Date().toISOString(),
        noCdsCompliance: `TRANSLATED HEALTH INFORMATION in ${targetLanguage.name}. This translation is for your understanding of health records. It is NOT medical advice. Always discuss health concerns with your healthcare provider who can explain information in your preferred language.`
      };
    } catch (error) {
      console.error("Translation error:", error);
      throw new Error("Failed to translate summary");
    }
  }

  async translateCustomText(
    text: string,
    sourceLanguage: string,
    targetLanguageCode: string,
    context?: string
  ): Promise<{
    translatedText: string;
    plainLanguageVersion: string;
    noCdsCompliance: string;
  }> {
    const targetLanguage = supportedLanguages.find(l => l.code === targetLanguageCode);
    if (!targetLanguage) {
      throw new Error("Unsupported language");
    }

    if (!aiEnabled) {
      return {
        translatedText: `[Translation to ${targetLanguage.name} requires AI configuration]\n\nOriginal: ${text}`,
        plainLanguageVersion: "[Plain language version requires AI configuration]",
        noCdsCompliance: "TRANSLATED HEALTH INFORMATION. NOT medical advice."
      };
    }

    try {
      // Extract clinical terms for preservation
      const preservationInstruction = generatePreservationInstruction(text);
      const { terms: extractedTerms } = extractClinicalTerms(text);
      
      console.log(`[Clinical Term Preservation - Custom] Found ${extractedTerms.length} terms to preserve`);
      
      const content = await generatePhiSafeText({
        system: `You are a medical text TRANSLATOR. Your ONLY job is to convert text between languages.

ABSOLUTE RULES:
1. ONLY translate - do not add any content
2. NEVER add medical advice or interpretations
3. NEVER explain what terms mean clinically
4. Preserve exact meaning without elaboration
${preservationInstruction}

End with: "[Translation only. Not medical advice.]"

Context: ${context || "Clinical health record content"}`,
        user: `Translate from ${sourceLanguage} to ${targetLanguage.name}:

"${text}"

IMPORTANT: Keep ALL drug names, lab test names, diagnostic codes, and medical units in their ORIGINAL form. ${extractedTerms.length > 0 ? `Terms like "${extractedTerms.slice(0, 5).join('", "')}" must remain exactly as written.` : ''}

Provide:
1. TRANSLATION: [accurate translation]
2. PLAIN_LANGUAGE: [simplified explanation]
3. PRESERVED_TERMS: [clinical terms kept in original form]`,
        maxTokens: 1000,
      });

      const sections = (content || "").split(/TRANSLATION:|PLAIN_LANGUAGE:/);
      const transMatch = sections[1]?.trim();
      const plainMatch2 = sections[2]?.trim();

      return {
        translatedText: transMatch || content,
        plainLanguageVersion: plainMatch2 || "",
        noCdsCompliance: `Translated to ${targetLanguage.name}. For understanding only, NOT medical advice.`
      };
    } catch (error) {
      console.error("Translation error:", error);
      throw new Error("Failed to translate text");
    }
  }
}

export const clinicalSummaryTranslationService = new ClinicalSummaryTranslationService();
