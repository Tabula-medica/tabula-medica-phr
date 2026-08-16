import { generatePhiSafeText } from "./ai-gateway";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

export interface ClinicalNoteSummary {
  id: string;
  noteId: string;
  chiefComplaint: string | null;
  diagnoses: {
    description: string;
    icdCode?: string;
    confidence: "high" | "medium" | "low";
  }[];
  treatmentPlan: {
    item: string;
    category: "medication" | "procedure" | "lifestyle" | "follow-up" | "other";
  }[];
  followUpInstructions: string[];
  keyFindings: string[];
  medications: {
    name: string;
    dosage?: string;
    instructions?: string;
  }[];
  generatedAt: string;
  modelUsed: string;
  sourceAttribution: {
    noteType: string;
    author?: string;
    facility?: string;
    dateOfService: string;
  };
  disclaimer: string;
  confidenceScore: number;
}

export interface SummaryError {
  id: string;
  noteId: string;
  summaryId: string;
  errorType: "accuracy" | "missing_info" | "incorrect_extraction" | "other";
  description: string;
  suggestedCorrection?: string;
  reportedAt: string;
  status: "pending" | "reviewed" | "resolved";
}

const NO_CDS_DISCLAIMER = "This AI-generated summary is for informational purposes only and is NOT clinical decision support. Always verify information against the original clinical note. This summary does not constitute medical advice or diagnosis. Healthcare providers should review the original documentation before making any clinical decisions.";

export async function summarizeClinicalNote(
  noteId: string,
  noteContent: string,
  noteType: string,
  author?: string,
  facility?: string,
  dateOfService?: string
): Promise<ClinicalNoteSummary> {
  const systemPrompt = `You are a medical documentation assistant that summarizes clinical notes. You must extract structured information from clinical notes while maintaining accuracy. 

IMPORTANT: This is NOT for clinical decision support. You are summarizing documentation for patient understanding.

Extract the following from the clinical note:
1. Chief Complaint - The primary reason for the visit
2. Diagnoses - Any conditions diagnosed or discussed, with ICD-10 codes if mentioned
3. Treatment Plan - Medications, procedures, lifestyle recommendations, and follow-up plans
4. Follow-up Instructions - Specific instructions given to the patient
5. Key Findings - Important clinical observations or test results
6. Medications - Any medications prescribed or discussed

Respond in JSON format with this exact structure:
{
  "chiefComplaint": "string or null",
  "diagnoses": [{"description": "string", "icdCode": "string or null", "confidence": "high|medium|low"}],
  "treatmentPlan": [{"item": "string", "category": "medication|procedure|lifestyle|follow-up|other"}],
  "followUpInstructions": ["string"],
  "keyFindings": ["string"],
  "medications": [{"name": "string", "dosage": "string or null", "instructions": "string or null"}],
  "confidenceScore": number between 0 and 100
}

If information is not present or unclear, indicate "Not specified" or leave arrays empty. Set confidence to "low" for inferred information.`;

  const userPrompt = `Please summarize the following clinical note:

Note Type: ${noteType}
${author ? `Author: ${author}` : ""}
${facility ? `Facility: ${facility}` : ""}
${dateOfService ? `Date of Service: ${dateOfService}` : ""}

---
Clinical Note Content:
${noteContent}
---

Extract all relevant clinical information in the structured JSON format.`;

  try {
    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      responseMimeType: "application/json",
      maxTokens: 2000,
    });

    if (!content) {
      throw new Error("No response from AI model");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[ClinicalNoteSummarization] JSON parse error:", parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

    const validConfidenceLevels = ["high", "medium", "low"];
    const validCategories = ["medication", "procedure", "lifestyle", "follow-up", "other"];

    const diagnoses = Array.isArray(parsed.diagnoses)
      ? parsed.diagnoses.map((d: any) => ({
          description: typeof d?.description === "string" ? d.description : "Unknown",
          icdCode: typeof d?.icdCode === "string" ? d.icdCode : undefined,
          confidence: validConfidenceLevels.includes(d?.confidence) ? d.confidence : "medium",
        }))
      : [];

    const treatmentPlan = Array.isArray(parsed.treatmentPlan)
      ? parsed.treatmentPlan.map((t: any) => ({
          item: typeof t?.item === "string" ? t.item : "Unknown",
          category: validCategories.includes(t?.category) ? t.category : "other",
        }))
      : [];

    const medications = Array.isArray(parsed.medications)
      ? parsed.medications.map((m: any) => ({
          name: typeof m?.name === "string" ? m.name : "Unknown",
          dosage: typeof m?.dosage === "string" ? m.dosage : undefined,
          instructions: typeof m?.instructions === "string" ? m.instructions : undefined,
        }))
      : [];

    const followUpInstructions = Array.isArray(parsed.followUpInstructions)
      ? parsed.followUpInstructions.filter((i: any) => typeof i === "string")
      : [];

    const keyFindings = Array.isArray(parsed.keyFindings)
      ? parsed.keyFindings.filter((f: any) => typeof f === "string")
      : [];

    const confidenceScore = typeof parsed.confidenceScore === "number"
      ? Math.min(100, Math.max(0, parsed.confidenceScore))
      : 75;

    const summary: ClinicalNoteSummary = {
      id: generateId(),
      noteId,
      chiefComplaint: typeof parsed.chiefComplaint === "string" ? parsed.chiefComplaint : null,
      diagnoses,
      treatmentPlan,
      followUpInstructions,
      keyFindings,
      medications,
      generatedAt: new Date().toISOString(),
      modelUsed: "gpt-5.1",
      sourceAttribution: {
        noteType,
        author,
        facility,
        dateOfService: dateOfService || new Date().toISOString(),
      },
      disclaimer: NO_CDS_DISCLAIMER,
      confidenceScore,
    };

    return summary;
  } catch (error) {
    console.error("[ClinicalNoteSummarization] Error:", error);
    throw error;
  }
}

const errorReports: Map<string, SummaryError[]> = new Map();

export function reportSummaryError(
  noteId: string,
  summaryId: string,
  errorType: SummaryError["errorType"],
  description: string,
  suggestedCorrection?: string
): SummaryError {
  const error: SummaryError = {
    id: generateId(),
    noteId,
    summaryId,
    errorType,
    description,
    suggestedCorrection,
    reportedAt: new Date().toISOString(),
    status: "pending",
  };

  const existing = errorReports.get(noteId) || [];
  existing.push(error);
  errorReports.set(noteId, existing);

  console.log(`[ClinicalNoteSummarization] Error reported for note ${noteId}:`, {
    errorType,
    description,
  });

  return error;
}

export function getErrorReports(noteId?: string): SummaryError[] {
  if (noteId) {
    return errorReports.get(noteId) || [];
  }
  
  const allErrors: SummaryError[] = [];
  errorReports.forEach((errors) => allErrors.push(...errors));
  return allErrors;
}

export function updateErrorStatus(
  errorId: string,
  status: SummaryError["status"]
): SummaryError | null {
  const entries = Array.from(errorReports.entries());
  for (let i = 0; i < entries.length; i++) {
    const [noteId, errors] = entries[i];
    const errorIndex = errors.findIndex((e: SummaryError) => e.id === errorId);
    if (errorIndex !== -1) {
      errors[errorIndex].status = status;
      errorReports.set(noteId, errors);
      return errors[errorIndex];
    }
  }
  return null;
}
