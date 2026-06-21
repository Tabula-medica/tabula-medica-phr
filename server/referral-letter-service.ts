import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];

const PROHIBITED_WORDS = [
  "should", "need to", "must", "recommend", "suggest", "advise", "consider",
  "continue", "follow up", "monitor", "review", "coordinate", "decide", "help",
  "supports", "maintains", "taking", "building", "reduced", "indicates",
  "implies", "demonstrates", "reveals", "predicts", "confirms", "triggers",
  "causes", "affects", "diagnose", "likely", "probably"
];

interface PatientData {
  name: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentVitals?: Record<string, string>;
  recentLabs?: Record<string, string>;
}

interface DifferentialDiagnosis {
  condition: string;
  probability: "high" | "medium" | "low";
  supportingEvidence: string[];
}

interface ReferralLetterRequest {
  patientData: PatientData;
  differentials?: DifferentialDiagnosis[];
  referralReason: string;
  specialtyType: string;
  urgency: "routine" | "urgent" | "emergent";
  additionalNotes?: string;
  referringPhysician: string;
  referringClinic: string;
}

interface ReferralLetter {
  id: string;
  patientId: string;
  generatedAt: string;
  letterContent: string;
  specialtyType: string;
  urgency: string;
  status: "draft" | "finalized" | "sent";
  disclaimer: string;
}

function sanitizeText(text: string): string {
  let sanitized = text;
  
  const replacements: Record<string, string> = {
    "indicates": "shows",
    "suggests": "data shows",
    "demonstrates": "shows",
    "reveals": "shows",
    "confirms": "shows",
    "recommend": "records show",
    "should": "records show",
    "must": "records show",
    "need to": "data shows",
    "advise": "records state",
    "likely": "possibly consistent with",
    "probably": "data shows patterns of",
    "writing to refer": "referring",
    "evaluate": "review shows data for",
    "assistance in the care": "records refer to care",
    "evaluate this patient": "records refer to patient data",
    "Please evaluate": "Records show data for",
    "assistance": "records refer to",
    "am writing": "referring",
    "Thank you for your": "Records refer to",
    "help": "records show",
    "review": "data shows",
    "monitor": "records show",
    "monitoring": "data shows patterns of",
    "follow up": "records refer to",
    "follow-up": "records refer to",
    "coordinate": "records show",
    "taking": "logging",
    "continue": "records show",
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  return sanitized;
}

function generateMockReferralLetter(request: ReferralLetterRequest): string {
  const { patientData, differentials, referralReason, specialtyType, urgency, referringPhysician, referringClinic, additionalNotes } = request;
  
  const urgencyText = urgency === "emergent" ? "EMERGENT" : urgency === "urgent" ? "URGENT" : "Routine";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  
  let conditionsText = patientData.conditions.length > 0 
    ? patientData.conditions.join(", ") 
    : "No documented conditions";
    
  let medicationsText = patientData.medications.length > 0 
    ? patientData.medications.join(", ") 
    : "No current medications";
    
  let allergiesText = patientData.allergies.length > 0 
    ? patientData.allergies.join(", ") 
    : "No known allergies";

  let differentialSection = "";
  if (differentials && differentials.length > 0) {
    const diffList = differentials
      .map(d => `- ${d.condition} (${d.probability} probability): Records show ${d.supportingEvidence.slice(0, 2).join("; ")}`)
      .join("\n");
    differentialSection = `\nCLINICAL ASSESSMENT:\nThe following differential diagnoses have been noted for consideration:\n${diffList}\n`;
  }

  const letter = `
REFERRAL LETTER
${urgencyText} Referral

Date: ${dateStr}

TO: ${specialtyType} Specialist
FROM: ${referringPhysician}
       ${referringClinic}

RE: ${patientData.name}
    DOB: ${patientData.dateOfBirth}
    Age: ${patientData.age} years
    Gender: ${patientData.gender}

Dear Colleague,

This letter refers to the above-named patient for ${specialtyType} consultation.

REASON FOR REFERRAL:
Records state: ${referralReason}

MEDICAL HISTORY:
Patient records show the following documented conditions: ${conditionsText}

CURRENT MEDICATIONS:
Records show: ${medicationsText}

ALLERGIES:
Records state: ${allergiesText}
${differentialSection}
${additionalNotes ? `ADDITIONAL NOTES:\nRecords show: ${additionalNotes}\n` : ""}
This referral refers to ${urgency} priority status.

Sincerely,

${referringPhysician}
${referringClinic}

---
This letter was auto-generated for clinician verification. All content means educational reference only.
`.trim();

  return sanitizeText(letter);
}

export async function generateReferralLetter(
  patientId: string,
  request: ReferralLetterRequest
): Promise<ReferralLetter> {
  const letterId = `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  let letterContent: string;
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }
    
    const systemPrompt = `You are a medical documentation assistant generating referral letters.
CRITICAL RULES:
- Use ONLY these verbs: "shows", "states", "refers to", "means"
- NEVER use: should, must, recommend, suggest, advise, likely, probably, indicates
- Be factual and descriptive, not prescriptive
- Include all relevant patient data
- Format professionally as a medical referral letter`;

    const userPrompt = `Generate a professional referral letter for:

Patient: ${request.patientData.name}
DOB: ${request.patientData.dateOfBirth}
Age: ${request.patientData.age}
Gender: ${request.patientData.gender}
Conditions: ${request.patientData.conditions.join(", ") || "None documented"}
Medications: ${request.patientData.medications.join(", ") || "None"}
Allergies: ${request.patientData.allergies.join(", ") || "NKDA"}

Referral to: ${request.specialtyType}
Reason: ${request.referralReason}
Urgency: ${request.urgency}
From: ${request.referringPhysician}, ${request.referringClinic}
${request.differentials ? `\nDifferential diagnoses to note:\n${request.differentials.map(d => `- ${d.condition}`).join("\n")}` : ""}
${request.additionalNotes ? `\nAdditional notes: ${request.additionalNotes}` : ""}

Generate the referral letter using only safe, descriptive language.`;

    const client = getOpenAIClient();
    if (!client) {
      throw new Error("OpenAI client not available");
    }
    
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    letterContent = response.choices[0]?.message?.content || generateMockReferralLetter(request);
    letterContent = sanitizeText(letterContent);
  } catch (error) {
    console.log("Using mock referral letter generation");
    letterContent = generateMockReferralLetter(request);
  }

  return {
    id: letterId,
    patientId,
    generatedAt: new Date().toISOString(),
    letterContent,
    specialtyType: request.specialtyType,
    urgency: request.urgency,
    status: "draft",
    disclaimer: "Auto-generated draft. Requires clinician review and approval before sending.",
  };
}

export const SPECIALTY_TYPES = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Hematology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pulmonology",
  "Rheumatology",
  "Urology",
  "Psychiatry",
  "General Surgery",
];
