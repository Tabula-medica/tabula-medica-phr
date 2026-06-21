import OpenAI from "openai";
import { logPhiAccess } from "./security/hipaa-audit";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type RecordType = "lab_result" | "diagnosis" | "procedure" | "medication" | "imaging" | "vital_sign" | "allergy" | "general";

export interface ELI12Request {
  term: string;
  context?: string;
  recordType: RecordType;
  value?: string;
  unit?: string;
  referenceRange?: string;
}

export interface ELI12Response {
  summary: string;
  whatItMeans: string;
  whatItMeasures?: string;
  commonReasons: string;
  questionsToAsk: string[];
  relatedTerms?: string[];
}

const RECORD_TYPE_PROMPTS: Record<RecordType, string> = {
  lab_result: "This is a laboratory test result.",
  diagnosis: "This is a medical diagnosis or condition.",
  procedure: "This is a medical procedure or surgery.",
  medication: "This is a medication or prescription drug.",
  imaging: "This is an imaging study or radiology report.",
  vital_sign: "This is a vital sign measurement.",
  allergy: "This is an allergy or adverse reaction.",
  general: "This is a medical term or concept.",
};

export async function getELI12Explanation(
  request: ELI12Request,
  patientId: string
): Promise<ELI12Response> {
  logPhiAccess({
    action: "read",
    resourceType: `eli12_${request.recordType}`,
    userId: patientId,
    patientId,
    details: `ELI12 explanation requested for: ${request.term}`,
  });

  const contextInfo = request.context ? `\nAdditional context: ${request.context}` : "";
  const valueInfo = request.value ? `\nValue: ${request.value}${request.unit ? ` ${request.unit}` : ""}` : "";
  const rangeInfo = request.referenceRange ? `\nReference range: ${request.referenceRange}` : "";

  const systemPrompt = `You are a friendly medical educator explaining health information to someone with no medical background. Your goal is to make complex medical terms completely understandable using everyday language a 12-year-old could follow.

IMPORTANT RULES:
- Use simple, everyday words. Avoid ALL medical jargon.
- Use analogies and comparisons to things people experience daily.
- Be warm and reassuring, but never give medical advice or recommendations.
- Frame everything as educational information, not personal health guidance.
- Always encourage talking to a doctor for personal health questions.

Your response must be structured with these exact sections:
1. SUMMARY: A one-sentence explanation anyone can understand
2. WHAT_IT_MEANS: 2-3 sentences explaining the concept in plain English
3. WHAT_IT_MEASURES: (Only for lab results/vitals) What this test actually checks in the body
4. COMMON_REASONS: Why this might appear in someone's medical records
5. QUESTIONS_TO_ASK: 3-4 questions people commonly ask their doctor about this
6. RELATED_TERMS: 2-3 related medical terms they might also see

Format your response as JSON with these keys: summary, whatItMeans, whatItMeasures, commonReasons, questionsToAsk (array), relatedTerms (array).`;

  const userPrompt = `Please explain this medical term in plain language:

Term: ${request.term}
Type: ${RECORD_TYPE_PROMPTS[request.recordType]}${contextInfo}${valueInfo}${rangeInfo}

Remember: Explain like you're talking to a 12-year-old. No medical jargon. Use everyday comparisons.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return getFallbackExplanation(request);
    }

    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "This is a medical term in your health records.",
      whatItMeans: parsed.whatItMeans || "This term describes something in your health information.",
      whatItMeasures: parsed.whatItMeasures,
      commonReasons: parsed.commonReasons || "This commonly appears in medical records.",
      questionsToAsk: parsed.questionsToAsk || ["What does this mean for me?", "Is this something I should be concerned about?", "What are the next steps?"],
      relatedTerms: parsed.relatedTerms,
    };
  } catch (error) {
    console.error("[ELI12] Error generating explanation:", error);
    return getFallbackExplanation(request);
  }
}

function getFallbackExplanation(request: ELI12Request): ELI12Response {
  const fallbacks: Record<RecordType, Partial<ELI12Response>> = {
    lab_result: {
      summary: `"${request.term}" is a laboratory test that helps doctors understand your health.`,
      whatItMeans: "This is a test done on blood, urine, or other samples from your body. Lab tests help doctors see things that can't be seen just by looking at you.",
      whatItMeasures: "This test measures specific substances or markers in your body that tell doctors how certain organs or systems are working.",
      commonReasons: "Doctors order lab tests for routine check-ups, to diagnose health issues, or to monitor ongoing conditions.",
    },
    diagnosis: {
      summary: `"${request.term}" is a medical condition or health issue identified by your doctor.`,
      whatItMeans: "A diagnosis is when a doctor identifies what health condition you might have based on your symptoms, tests, and examination.",
      commonReasons: "This diagnosis was added to your records because your healthcare provider identified this condition during your care.",
    },
    procedure: {
      summary: `"${request.term}" is a medical procedure that was performed as part of your care.`,
      whatItMeans: "A procedure is something doctors do to diagnose, treat, or help manage a health condition. It could be a test, surgery, or treatment.",
      commonReasons: "Procedures appear in records when they're done to help diagnose or treat health conditions.",
    },
    medication: {
      summary: `"${request.term}" is a medication that's part of your treatment plan.`,
      whatItMeans: "This is a medicine prescribed by your doctor to help with a health condition. Medications work in different ways to help your body.",
      commonReasons: "Medications appear in records when prescribed by healthcare providers as part of your treatment.",
    },
    imaging: {
      summary: `"${request.term}" is an imaging study that lets doctors see inside your body.`,
      whatItMeans: "Imaging tests like X-rays, MRIs, or CT scans create pictures of the inside of your body without surgery. They help doctors see bones, organs, and tissues.",
      commonReasons: "Doctors order imaging tests to see what's happening inside your body and to help diagnose or monitor conditions.",
    },
    vital_sign: {
      summary: `"${request.term}" is a vital sign measurement that shows how your body is functioning.`,
      whatItMeans: "Vital signs are basic measurements that show how well your body is working. They include things like heart rate, blood pressure, and temperature.",
      whatItMeasures: "This measures one of your body's basic functions that tells doctors about your overall health status.",
      commonReasons: "Vital signs are checked at every doctor visit to make sure your body is working well.",
    },
    allergy: {
      summary: `"${request.term}" is listed as an allergy or sensitivity in your records.`,
      whatItMeans: "An allergy means your body reacts badly to something that doesn't bother most people. This is important for doctors to know so they can keep you safe.",
      commonReasons: "Allergies are recorded so all your healthcare providers know what to avoid giving you.",
    },
    general: {
      summary: `"${request.term}" is a medical term in your health records.`,
      whatItMeans: "This is a term used by healthcare providers to describe something about your health or care.",
      commonReasons: "Medical terms appear in records as part of documenting your health history and care.",
    },
  };

  const fallback = fallbacks[request.recordType];
  return {
    summary: fallback.summary || `"${request.term}" is a medical term.`,
    whatItMeans: fallback.whatItMeans || "This term is part of your medical records.",
    whatItMeasures: fallback.whatItMeasures,
    commonReasons: fallback.commonReasons || "This appears in medical records as part of healthcare documentation.",
    questionsToAsk: [
      "What does this mean for my health?",
      "Is this something I need to be concerned about?",
      "What should I do next?",
      "Can you explain this in more detail?",
    ],
    relatedTerms: [],
  };
}

export function getQuickExplanations(): Record<string, string> {
  return {
    "CBC": "A blood test that counts the different cells in your blood, like red cells that carry oxygen and white cells that fight infection.",
    "BMP": "A blood test that checks how well your kidneys are working and your blood sugar levels.",
    "CMP": "Similar to BMP but also checks how well your liver is working.",
    "A1C": "Shows your average blood sugar over the past 2-3 months - like a report card for blood sugar control.",
    "LDL": "Often called 'bad cholesterol' - it can build up in your blood vessels.",
    "HDL": "Often called 'good cholesterol' - it helps remove the bad kind from your blood.",
    "TSH": "Checks if your thyroid gland (in your neck) is making the right amount of hormones.",
    "eGFR": "Shows how well your kidneys are filtering waste from your blood.",
    "BMI": "A number calculated from your height and weight that gives a general idea about body size.",
    "BP": "Blood pressure - how hard your heart is pushing blood through your body.",
    "HR": "Heart rate - how many times your heart beats per minute.",
    "SpO2": "Oxygen saturation - how much oxygen is in your blood (like fuel for your body).",
    "MRI": "A scan that uses magnets (no radiation) to take detailed pictures inside your body.",
    "CT": "A type of X-ray that takes many pictures to create a 3D view inside your body.",
    "ECG/EKG": "A test that records the electrical activity of your heart to see how it's beating.",
    "UTI": "Urinary tract infection - an infection in your bladder or urinary system.",
    "URI": "Upper respiratory infection - a common cold or infection in your nose, throat, or sinuses.",
    "GERD": "When stomach acid flows back up into your throat, causing heartburn.",
    "HTN": "High blood pressure - when your heart is working too hard to push blood.",
    "DM": "Diabetes mellitus - when your body has trouble controlling blood sugar.",
    "CHF": "When your heart isn't pumping blood as well as it should.",
    "COPD": "A lung condition that makes it harder to breathe, often from smoking.",
    "DVT": "A blood clot in a deep vein, usually in the leg.",
    "PE": "A blood clot that travels to the lungs, which is serious.",
    "MI": "A heart attack - when blood flow to part of the heart is blocked.",
    "CVA": "A stroke - when blood flow to part of the brain is blocked or a blood vessel bursts.",
  };
}
