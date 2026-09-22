import { generatePhiSafeText } from "./services/ai-gateway";
import crypto from "crypto";
import type { 
  ExplanationResponse, 
  ExplainRequest, 
  ExplanationSourceQuote,
  GuardrailCheckResult,
  GuardrailRefusalResponse
} from "@shared/schema";
import { checkForMedicalAdviceRequest, isGuardrailTriggered } from "./ai-guardrail-service";

function generateId(): string {
  return crypto.randomUUID();
}

export { checkForMedicalAdviceRequest, isGuardrailTriggered };
export type { GuardrailCheckResult, GuardrailRefusalResponse };

const DISCLAIMER = "Informational only. Not medical advice. Always consult your healthcare provider for personal health questions.";

const RECORD_TYPE_CONTEXT: Record<string, string> = {
  lab_result: "This is from a laboratory test result.",
  diagnosis: "This is from a medical diagnosis or condition.",
  procedure: "This is from a medical procedure record.",
  medication: "This is from a medication or prescription.",
  imaging: "This is from an imaging study or radiology report.",
  vital_sign: "This is from a vital sign measurement.",
  allergy: "This is from an allergy or adverse reaction record.",
  encounter: "This is from a clinical visit or encounter.",
  immunization: "This is from a vaccination or immunization record.",
  general: "This is a general medical term.",
};

const medicalTermDictionary: Record<string, string> = {
  "CBC": "Complete Blood Count - a lab test that measures different cells in your blood including red cells, white cells, and platelets.",
  "A1C": "Hemoglobin A1C - a lab test that shows your average blood sugar level over the past 2-3 months.",
  "BMI": "Body Mass Index - a number calculated from your height and weight that describes your body size.",
  "BP": "Blood Pressure - the force of blood pushing against the walls of your arteries.",
  "BUN": "Blood Urea Nitrogen - a lab test that measures how well your kidneys are working.",
  "ECG": "Electrocardiogram - a test that records the electrical signals in your heart.",
  "EKG": "Electrocardiogram - a test that records the electrical signals in your heart.",
  "HDL": "High-Density Lipoprotein - often called 'good' cholesterol that helps remove other forms of cholesterol from your blood.",
  "LDL": "Low-Density Lipoprotein - often called 'bad' cholesterol that can build up in your arteries.",
  "MRI": "Magnetic Resonance Imaging - a scan that uses magnets and radio waves to create detailed pictures of your body.",
  "CT": "Computed Tomography - a scan that combines X-ray images to create cross-sectional pictures of your body.",
  "TSH": "Thyroid Stimulating Hormone - a lab test that measures how well your thyroid gland is working.",
  "WBC": "White Blood Cells - cells in your blood that help fight infection.",
  "RBC": "Red Blood Cells - cells that carry oxygen throughout your body.",
  "GFR": "Glomerular Filtration Rate - a measure of how well your kidneys filter waste from your blood.",
  "ALT": "Alanine Aminotransferase - a liver enzyme that can indicate how well your liver is working.",
  "AST": "Aspartate Aminotransferase - an enzyme found in your liver and heart.",
  "HGB": "Hemoglobin - a protein in red blood cells that carries oxygen.",
  "HCT": "Hematocrit - the percentage of your blood that is made up of red blood cells.",
  "PLT": "Platelets - tiny blood cells that help your blood clot.",
  "PSA": "Prostate-Specific Antigen - a protein that can be measured in blood tests.",
  "INR": "International Normalized Ratio - a measurement of how long it takes your blood to clot.",
  "PT": "Prothrombin Time - a test that measures blood clotting time.",
  "BMP": "Basic Metabolic Panel - a group of tests that measure your body's chemistry and metabolism.",
  "CMP": "Comprehensive Metabolic Panel - a group of tests that check kidney and liver function plus electrolytes.",
  "GLUCOSE": "Blood sugar - the main source of energy for your body's cells.",
  "CREATININE": "A waste product that your kidneys filter out of your blood.",
  "POTASSIUM": "A mineral that helps your nerves, muscles, and heart work properly.",
  "SODIUM": "A mineral that helps control the amount of fluid in your body.",
  "LIPID": "Fats in your blood, including cholesterol and triglycerides.",
  "TRIGLYCERIDES": "A type of fat in your blood that comes from the food you eat.",
  "HYPERTENSION": "High blood pressure - when the force of blood against artery walls is too high over time.",
  "DIABETES": "A condition where your body has trouble controlling blood sugar levels.",
  "HYPERLIPIDEMIA": "High levels of fats (lipids) in your blood, including cholesterol.",
  "HYPOTHYROID": "Underactive thyroid - when your thyroid gland doesn't produce enough hormones.",
  "HYPERTHYROID": "Overactive thyroid - when your thyroid gland produces too many hormones.",
  "ANEMIA": "A condition where you don't have enough healthy red blood cells to carry oxygen.",
  "PREDNISONE": "A medication that reduces inflammation and suppresses the immune system.",
  "METFORMIN": "A medication commonly used to help control blood sugar in type 2 diabetes.",
  "LISINOPRIL": "A medication used to treat high blood pressure and heart conditions.",
  "ATORVASTATIN": "A medication used to lower cholesterol levels in the blood.",
  "OMEPRAZOLE": "A medication that reduces stomach acid production.",
  "AMLODIPINE": "A medication used to treat high blood pressure and chest pain.",
  "LEVOTHYROXINE": "A medication used to treat underactive thyroid.",
  "METOPROLOL": "A medication that slows heart rate and lowers blood pressure.",
};

export async function generateExplanation(
  request: ExplainRequest,
  patientId: string
): Promise<ExplanationResponse> {
  const id = generateId();
  const term = request.term.trim();
  
  const quickDef = medicalTermDictionary[term.toUpperCase()];
  if (quickDef && !request.context) {
    return {
      id,
      term,
      plainEnglish: quickDef,
      sourceQuote: request.sourceQuote ? {
        text: request.sourceQuote.text,
        source: request.sourceQuote.source,
        date: request.sourceQuote.date,
        recordType: request.recordType,
        recordId: request.sourceQuote.recordId,
      } : undefined,
      questionsForDoctor: [
        "What does this mean for my specific situation?",
        "Is this result within a normal range for someone like me?",
        "Can you tell me more about this?",
      ],
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const recordTypeContext = request.recordType ? RECORD_TYPE_CONTEXT[request.recordType] : "";
    const sourceContext = request.sourceQuote 
      ? `\nSource quote from record: "${request.sourceQuote.text}"\nSource: ${request.sourceQuote.source}${request.sourceQuote.date ? ` (${request.sourceQuote.date})` : ""}`
      : "";

    const content = await generatePhiSafeText({
      system: `You explain medical terms to patients in simple, everyday language.

SAFE VERBS TO USE: "shows", "means", "refers to", "is commonly used to describe", "is often measured to assess", "indicates"

CRITICAL RULES:
- NEVER give medical advice, diagnoses, or recommendations
- NEVER say what the patient "should" do
- NEVER interpret whether results are good, bad, concerning, or normal
- NEVER use words like "recommend", "suggest", "advise", "should", "need to", "must"
- Only provide educational definitions using safe verbs
- Generate safe questions for the patient to ASK their doctor
- Keep explanations clear and friendly, like explaining to a family member

Format response as JSON with these exact keys:
{
  "plainEnglish": "2-3 sentence explanation using only safe verbs",
  "questionsForDoctor": ["3 safe questions to ask the doctor"],
  "relatedTerms": ["2-3 related medical terms they might also see"]
}`,
      user: `Explain this medical term in plain English: "${term}"
${recordTypeContext}
${request.context ? `Additional context: ${request.context}` : ""}${sourceContext}

Remember: Use ONLY safe verbs (refers to, means, shows, indicates). Do NOT give any advice or recommendations.`,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxTokens: 400,
    });

    if (!content) {
      return getFallbackExplanation(term, request.sourceQuote, request.recordType, id);
    }

    const parsed = JSON.parse(content);
    return {
      id,
      term,
      plainEnglish: parsed.plainEnglish || `"${term}" refers to a medical term that appears in health records.`,
      sourceQuote: request.sourceQuote ? {
        text: request.sourceQuote.text,
        source: request.sourceQuote.source,
        date: request.sourceQuote.date,
        recordType: request.recordType,
        recordId: request.sourceQuote.recordId,
      } : undefined,
      questionsForDoctor: parsed.questionsForDoctor || [
        "What does this mean for my specific situation?",
        "Is this result what you expected?",
        "Can you help me understand this better?",
      ],
      relatedTerms: parsed.relatedTerms,
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[ExplainAnything] Error generating explanation:", error);
    return getFallbackExplanation(term, request.sourceQuote, request.recordType, id);
  }
}

function getFallbackExplanation(
  term: string,
  sourceQuote?: { text: string; source: string; date?: string; recordId?: string },
  recordType?: string,
  id?: string
): ExplanationResponse {
  return {
    id: id || generateId(),
    term,
    plainEnglish: `"${term}" is a medical term that appears in your health records. It refers to information documented by your healthcare providers.`,
    sourceQuote: sourceQuote ? {
      text: sourceQuote.text,
      source: sourceQuote.source,
      date: sourceQuote.date,
      recordType,
      recordId: sourceQuote.recordId,
    } : undefined,
    questionsForDoctor: [
      "Can you explain what this means for me?",
      "Is there anything more you can tell me about this?",
      "What context would help me understand this?",
    ],
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}

export function getTermDictionary(): Record<string, string> {
  return { ...medicalTermDictionary };
}

export function lookupTerm(term: string): string | null {
  return medicalTermDictionary[term.toUpperCase()] || null;
}
