import { wrapUntrustedContent, createSafeSystemPrompt } from "./security/prompt-sanitizer";

/**
 * Document Summary Service
 * 
 * Summarizes uploaded health documents (PDFs, discharge summaries, etc.)
 * using the safe 3-part structure:
 * 1. Definition/Explanation (what the document shows)
 * 2. Record Grounding (Quote + Provenance)
 * 3. Questions for Clinician
 * 
 * All summaries are quote-based and provide no medical advice.
 */

export interface DocumentQuote {
  text: string;
  section: string;
  pageNumber?: number;
}

export interface DocumentSummarySection {
  title: string;
  explanation: string;
  quotes: DocumentQuote[];
  questionsForClinician: string[];
}

export interface DocumentSummary {
  documentId: string;
  documentName: string;
  documentType: string;
  documentDate: string;
  source: string;
  overallSummary: string;
  sections: DocumentSummarySection[];
  keyTerms: Array<{
    term: string;
    definition: string;
    whereInDocument: string;
  }>;
  disclaimer: string;
}

// Safe verbs and phrasing for document summaries - ONLY these 4 verbs allowed
const SAFE_SUMMARY_PROMPTS = {
  systemPrompt: `You summarize health documents for patients in simple, friendly language.

ONLY USE THESE 4 VERBS: "shows", "states", "refers to", "means"

SAFE FRAMING EXAMPLES:
- "This document shows..."
- "The record states..."
- "This refers to..."
- "This means..."

REQUIRED 3-PART STRUCTURE for each finding (QUOTE-FIRST RULE):
1. Quote: Exact text from the document (clearly marked with source attribution)
2. Explain: What the terminology means in plain language (no interpretation of good/bad)
3. Questions: What the patient can ask their clinician

PROHIBITED - NEVER USE:
- "should", "need to", "must", "continue", "follow up", "follow-up"
- "well controlled", "poorly controlled", "stable", "improving", "worsening"
- "recommendation", "advised", "plan", "treatment plan"
- Any interpretation of whether results are good, bad, normal, or abnormal
- Any clinical judgments or advice

WHEN QUOTING A "PLAN" SECTION:
- Only quote factual statements, not directives
- Frame as "The document states..." not as advice

End with "Informational only. Not medical advice."`,
};

/**
 * Summarize a health document using AI
 */
export async function summarizeDocument(
  documentId: string,
  documentContent: string,
  documentMetadata: {
    name: string;
    type: string;
    date: string;
    source: string;
  }
): Promise<DocumentSummary> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    return getMockDocumentSummary(documentId, documentMetadata);
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: SAFE_SUMMARY_PROMPTS.systemPrompt,
          },
          {
            role: "user",
            content: `Summarize this health document using the 3-part structure (Explanation, Quote, Questions for Clinician).

Document Name: ${documentMetadata.name}
Document Type: ${documentMetadata.type}
Document Date: ${documentMetadata.date}
Source: ${documentMetadata.source}

${wrapUntrustedContent(documentContent.slice(0, 8000), documentMetadata.type)}

Respond in JSON format:
{
  "overallSummary": "1-2 sentence overview of what this document shows (use safe verbs)",
  "sections": [
    {
      "title": "Section name",
      "explanation": "Plain language explanation of what this section shows",
      "quotes": [
        {"text": "Exact quote from document", "section": "Section name"}
      ],
      "questionsForClinician": ["Question patient can ask about this section"]
    }
  ],
  "keyTerms": [
    {
      "term": "Medical term found in document",
      "definition": "Plain language definition using 'refers to' or 'means'",
      "whereInDocument": "Quote showing where this term appears"
    }
  ]
}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error("[DocumentSummary] API error:", response.status);
      return getMockDocumentSummary(documentId, documentMetadata);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        documentId,
        documentName: documentMetadata.name,
        documentType: documentMetadata.type,
        documentDate: documentMetadata.date,
        source: documentMetadata.source,
        overallSummary: parsed.overallSummary || `This document shows a ${documentMetadata.type} from ${documentMetadata.source}.`,
        sections: parsed.sections || [],
        keyTerms: parsed.keyTerms || [],
        disclaimer: "Informational only. Not medical advice.",
      };
    }

    return getMockDocumentSummary(documentId, documentMetadata);
  } catch (error) {
    console.error("[DocumentSummary] Error:", error);
    return getMockDocumentSummary(documentId, documentMetadata);
  }
}

/**
 * Mock document summary for fallback
 */
function getMockDocumentSummary(
  documentId: string,
  metadata: { name: string; type: string; date: string; source: string }
): DocumentSummary {
  return {
    documentId,
    documentName: metadata.name,
    documentType: metadata.type,
    documentDate: metadata.date,
    source: metadata.source,
    overallSummary: `This document shows a ${metadata.type} from ${metadata.source}, dated ${metadata.date}.`,
    sections: [
      {
        title: "Patient Information",
        explanation: "This section shows the patient's identifying information as recorded in the document.",
        quotes: [
          {
            text: "Patient: Sample Patient, DOB: 03/15/1965",
            section: "Header",
          },
        ],
        questionsForClinician: [
          "Can you confirm this information is correct in my records?",
        ],
      },
      {
        title: "Visit Summary",
        explanation: "This section shows the reason for the visit and measurements recorded.",
        quotes: [
          {
            text: "Chief Complaint: Chronic condition review",
            section: "Visit Information",
          },
          {
            text: "Vitals: BP 128/84 mmHg, HR 72 bpm, Weight 185 lbs",
            section: "Vital Signs",
          },
        ],
        questionsForClinician: [
          "What does this visit summary mean in my situation?",
          "Is this value expected given my history?",
        ],
      },
      {
        title: "Documented Conditions",
        explanation: "This section shows the conditions recorded by the provider.",
        quotes: [
          {
            text: "Type 2 Diabetes Mellitus",
            section: "Conditions",
          },
          {
            text: "Essential Hypertension",
            section: "Conditions",
          },
        ],
        questionsForClinician: [
          "What do these conditions mean?",
          "How do these compare to my previous records?",
        ],
      },
      {
        title: "Medications Listed",
        explanation: "This section shows the medications recorded in the document.",
        quotes: [
          {
            text: "Metformin 500mg twice daily",
            section: "Medications",
          },
          {
            text: "Lisinopril 10mg daily",
            section: "Medications",
          },
        ],
        questionsForClinician: [
          "Can you confirm my current medication list?",
          "What does each medication refer to?",
        ],
      },
    ],
    keyTerms: [
      {
        term: "Type 2 Diabetes Mellitus",
        definition: "This refers to a condition affecting how the body processes blood sugar.",
        whereInDocument: "Conditions section: 'Type 2 Diabetes Mellitus'",
      },
      {
        term: "Essential Hypertension",
        definition: "This refers to elevated blood pressure as a documented condition.",
        whereInDocument: "Conditions section: 'Essential Hypertension'",
      },
      {
        term: "BP",
        definition: "BP refers to Blood Pressure, a measurement of the force of blood against artery walls.",
        whereInDocument: "Vital Signs: 'BP 128/84 mmHg'",
      },
    ],
    disclaimer: "Informational only. Not medical advice.",
  };
}

/**
 * Extract text from uploaded document (mock implementation)
 * In production, would use PDF parsing library
 */
export async function extractDocumentText(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  // Mock extraction - in production use pdf-parse or similar
  return `
PATIENT VISIT SUMMARY

Patient: Sample Patient
DOB: 03/15/1965
Visit Date: January 15, 2024
Provider: Dr. Sarah Martinez, MD
Facility: Primary Care Clinic

CHIEF COMPLAINT:
Chronic condition review

VITAL SIGNS:
Blood Pressure: 128/84 mmHg
Heart Rate: 72 bpm
Weight: 185 lbs
Temperature: 98.6°F

DOCUMENTED CONDITIONS:
1. Type 2 Diabetes Mellitus
2. Essential Hypertension
3. Hyperlipidemia

CURRENT MEDICATIONS:
- Metformin 500mg twice daily
- Lisinopril 10mg daily
- Atorvastatin 20mg daily

SCHEDULED LABS:
HbA1c, Lipid Panel, CMP
`;
}
