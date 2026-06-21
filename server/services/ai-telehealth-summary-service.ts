import OpenAI from "openai";
import {
  NO_CDS_POLICY,
  NO_CDS_DISCLAIMER,
  sanitizeNoCDS,
  sanitizeNoCDSObject,
  logNoCDSCompliance,
} from "../security/no-cds-guardrails";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface TelehealthSessionContext {
  patientName: string;
  providerName: string;
  visitDate: string;
  durationMinutes: number;
  chiefComplaint: string;
  sessionNotes: Array<{
    content: string;
    noteType: string;
    authorName: string;
    isShared: boolean;
  }>;
  sharedDocuments: Array<{
    documentName: string;
    documentType: string;
    description?: string;
  }>;
}

export interface AIGeneratedSummary {
  chiefComplaint: string;
  diagnosisDiscussed: string[];
  treatmentPlan: string;
  medicationChanges: string[];
  followUpInstructions: string[];
  nextSteps: string[];
  patientQuestions: string[];
  additionalNotes: string;
  noCdsDisclaimer: string;
  aiGenerated: boolean;
}

export async function generateTelehealthSummary(
  context: TelehealthSessionContext
): Promise<AIGeneratedSummary> {
  const notesText = context.sessionNotes
    .map(
      (n) =>
        `[${n.noteType}${n.isShared ? " - shared with patient" : ""}] (${n.authorName}): ${n.content}`
    )
    .join("\n");

  const docsText =
    context.sharedDocuments.length > 0
      ? context.sharedDocuments
          .map(
            (d) =>
              `- ${d.documentName} (${d.documentType})${d.description ? `: ${d.description}` : ""}`
          )
          .join("\n")
      : "No documents shared during session.";

  const prompt = `${NO_CDS_POLICY}

You are generating a structured post-visit summary for a completed telehealth consultation. This summary organizes existing session data into a clear format for patient review. You MUST use only observational, non-prescriptive language throughout.

SESSION CONTEXT:
- Patient: ${context.patientName}
- Provider: ${context.providerName}
- Date: ${context.visitDate}
- Duration: ${context.durationMinutes} minutes
- Chief Complaint: ${context.chiefComplaint}

SESSION NOTES:
${notesText || "No notes recorded during session."}

DOCUMENTS SHARED:
${docsText}

Generate a JSON object with these fields:
{
  "chiefComplaint": "Restate the reason for visit using observational language",
  "diagnosisDiscussed": ["Array of conditions or topics discussed during the visit - use observational language only"],
  "treatmentPlan": "Summary of care approach discussed - observational language only, no prescriptive statements",
  "medicationChanges": ["Array of any medication topics noted during the session"],
  "followUpInstructions": ["Array of follow-up items discussed - use 'may consider' or 'as discussed with provider' phrasing"],
  "nextSteps": ["Array of next steps noted during the session"],
  "patientQuestions": ["Array of questions the patient raised during the visit"],
  "additionalNotes": "Any other relevant observations from the session"
}

CRITICAL RULES:
- Use ONLY observational language (data indicates, records show, as discussed, noted during visit)
- NEVER use prescriptive language (should, must, recommend, advise, prescribe)
- If session notes are sparse, generate minimal content based only on available data
- All arrays may be empty if no relevant data exists
- Return ONLY valid JSON, no markdown or extra text`;

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return {
      chiefComplaint: context.chiefComplaint,
      diagnosisDiscussed: [],
      treatmentPlan: "",
      medicationChanges: [],
      followUpInstructions: [
        "Follow up with provider as discussed during the visit",
        "Contact the office if any concerns arise",
      ],
      nextSteps: [
        "Review any materials shared during the session",
        "Complete any follow-up items discussed with provider",
      ],
      patientQuestions: context.sessionNotes
        .filter((n) => n.noteType === "question")
        .map((n) => n.content),
      additionalNotes: context.sessionNotes
        .filter((n) => n.isShared)
        .map((n) => n.content)
        .join("\n"),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      aiGenerated: false,
    };
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a medical documentation assistant that generates structured post-visit summaries using ONLY observational, non-prescriptive language. You NEVER provide clinical decision support.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0]?.message?.content || "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    parsed = {};
  }

  const rawSummary: AIGeneratedSummary = {
    chiefComplaint: String(parsed.chiefComplaint || context.chiefComplaint),
    diagnosisDiscussed: Array.isArray(parsed.diagnosisDiscussed)
      ? parsed.diagnosisDiscussed.map(String)
      : [],
    treatmentPlan: String(parsed.treatmentPlan || ""),
    medicationChanges: Array.isArray(parsed.medicationChanges)
      ? parsed.medicationChanges.map(String)
      : [],
    followUpInstructions: Array.isArray(parsed.followUpInstructions)
      ? parsed.followUpInstructions.map(String)
      : [
          "Follow up with provider as discussed during the visit",
          "Contact the office if any concerns arise",
        ],
    nextSteps: Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.map(String)
      : [],
    patientQuestions: Array.isArray(parsed.patientQuestions)
      ? parsed.patientQuestions.map(String)
      : [],
    additionalNotes: String(parsed.additionalNotes || ""),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
    aiGenerated: true,
  };

  const sanitized = sanitizeNoCDSObject(rawSummary);

  logNoCDSCompliance(
    "ai-telehealth-summary",
    "generate-post-visit-summary",
    JSON.stringify(rawSummary),
    JSON.stringify(sanitized)
  );

  sanitized.chiefComplaint = sanitizeNoCDS(sanitized.chiefComplaint);
  sanitized.treatmentPlan = sanitizeNoCDS(sanitized.treatmentPlan);
  sanitized.additionalNotes = sanitizeNoCDS(sanitized.additionalNotes);
  sanitized.diagnosisDiscussed = sanitized.diagnosisDiscussed.map(sanitizeNoCDS);
  sanitized.medicationChanges = sanitized.medicationChanges.map(sanitizeNoCDS);
  sanitized.followUpInstructions =
    sanitized.followUpInstructions.map(sanitizeNoCDS);
  sanitized.nextSteps = sanitized.nextSteps.map(sanitizeNoCDS);
  sanitized.patientQuestions = sanitized.patientQuestions.map(sanitizeNoCDS);

  return sanitized;
}
