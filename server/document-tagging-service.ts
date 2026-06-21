import OpenAI from "openai";
import type { AutoTagCategory, DocumentAutoTag, DocumentAutoTagResult } from "@shared/schema";

// Use AI Integrations for OpenAI access (no API key required)
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Category labels for display
export const autoTagCategoryLabels: Record<AutoTagCategory, string> = {
  discharge_summary: "Discharge Summary",
  lab: "Lab Results",
  imaging: "Imaging Report",
  insurance: "Insurance Document",
  referral: "Referral",
  other: "Other Document",
};

// In-memory storage for document auto-tags
const documentAutoTags: Map<string, DocumentAutoTag> = new Map();

/**
 * Classify a document and provide explainable auto-tags
 * Uses AI to analyze document content and determine category with explanation
 */
export async function classifyDocumentWithExplanation(
  documentId: string,
  fileName: string,
  textContent: string,
  mimeType: string
): Promise<DocumentAutoTagResult> {
  const classificationPrompt = `You are a medical document classifier. Analyze the following document and classify it into ONE of these categories:

Categories:
- discharge_summary: Hospital discharge summaries, post-hospitalization instructions
- lab: Laboratory test results (blood tests, urinalysis, cultures, etc.)
- imaging: Radiology reports (X-ray, CT, MRI, ultrasound)
- insurance: Insurance documents (EOB, claims, authorization letters, coverage documents)
- referral: Referral letters from one provider to another
- other: Documents that don't fit the above categories

Provide:
1. The category (exactly one of: discharge_summary, lab, imaging, insurance, referral, other)
2. Confidence score (0-100)
3. A clear explanation of WHY you classified it this way (2-3 sentences explaining key indicators)
4. Suggested descriptive tags (3-5 relevant keywords)
5. Any extracted metadata (date, facility, provider, test name)

Document filename: ${fileName}
Document type: ${mimeType}

Document content (first 4000 characters):
${textContent.slice(0, 4000)}

Respond in JSON format:
{
  "category": "lab",
  "confidence": 92,
  "explanation": "This document contains laboratory test results including a Complete Blood Count (CBC) with specific values for WBC, RBC, and hemoglobin. The format and terminology are consistent with standard lab reports.",
  "suggestedTags": ["blood test", "CBC", "complete blood count", "routine labs"],
  "extractedMetadata": {
    "date": "2025-01-15",
    "facility": "Quest Diagnostics",
    "provider": "Dr. Smith",
    "testName": "Complete Blood Count"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: "You are a medical document classifier that provides explainable categorization. Always respond with valid JSON. Your explanations should be clear and reference specific indicators in the document that led to your classification decision.",
        },
        {
          role: "user",
          content: classificationPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);

    // Validate category
    const validCategories: AutoTagCategory[] = ["discharge_summary", "lab", "imaging", "insurance", "referral", "other"];
    const category = validCategories.includes(result.category) ? result.category : "other";

    return {
      category,
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      explanation: result.explanation || "Unable to determine classification reason.",
      suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : [],
      extractedMetadata: {
        date: result.extractedMetadata?.date || null,
        facility: result.extractedMetadata?.facility || null,
        provider: result.extractedMetadata?.provider || null,
        testName: result.extractedMetadata?.testName || null,
      },
    };
  } catch (error) {
    console.error("[DocumentAutoTag] Classification error:", error);
    
    // Fallback classification based on filename
    const fallbackCategory = inferCategoryFromFilename(fileName);
    
    return {
      category: fallbackCategory,
      confidence: 30,
      explanation: "Automatic classification was unable to analyze the document content. Classification based on filename only.",
      suggestedTags: [],
      extractedMetadata: {
        date: null,
        facility: null,
        provider: null,
        testName: null,
      },
    };
  }
}

/**
 * Infer category from filename as fallback
 */
function inferCategoryFromFilename(fileName: string): AutoTagCategory {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes("discharge") || lowerName.includes("summary")) {
    return "discharge_summary";
  }
  if (lowerName.includes("lab") || lowerName.includes("blood") || lowerName.includes("cbc") || lowerName.includes("test")) {
    return "lab";
  }
  if (lowerName.includes("xray") || lowerName.includes("x-ray") || lowerName.includes("ct") || lowerName.includes("mri") || lowerName.includes("imaging") || lowerName.includes("radiology")) {
    return "imaging";
  }
  if (lowerName.includes("insurance") || lowerName.includes("eob") || lowerName.includes("claim") || lowerName.includes("coverage")) {
    return "insurance";
  }
  if (lowerName.includes("referral") || lowerName.includes("refer")) {
    return "referral";
  }
  
  return "other";
}

/**
 * Save auto-tag result to storage
 */
export function saveDocumentAutoTag(
  documentId: string,
  result: DocumentAutoTagResult,
  patientId: string
): DocumentAutoTag {
  const autoTag: DocumentAutoTag = {
    id: `autotag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    documentId,
    category: result.category,
    confidence: result.confidence,
    explanation: result.explanation,
    suggestedTags: result.suggestedTags,
    isOverridden: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  documentAutoTags.set(documentId, autoTag);
  return autoTag;
}

/**
 * Get auto-tag for a document
 */
export function getDocumentAutoTag(documentId: string): DocumentAutoTag | null {
  return documentAutoTags.get(documentId) || null;
}

/**
 * Override auto-tag with user's choice
 */
export function overrideDocumentAutoTag(
  documentId: string,
  newCategory: AutoTagCategory,
  newTags: string[] | undefined,
  reason: string | undefined,
  userId: string
): DocumentAutoTag | null {
  const existing = documentAutoTags.get(documentId);
  if (!existing) {
    return null;
  }
  
  const updated: DocumentAutoTag = {
    ...existing,
    isOverridden: true,
    overriddenCategory: newCategory,
    overriddenAt: new Date().toISOString(),
    overriddenBy: userId,
    overrideReason: reason,
    suggestedTags: newTags || existing.suggestedTags,
    updatedAt: new Date().toISOString(),
  };
  
  documentAutoTags.set(documentId, updated);
  return updated;
}

/**
 * Get all auto-tags for a patient's documents
 */
export function getPatientDocumentAutoTags(documentIds: string[]): DocumentAutoTag[] {
  return documentIds
    .map(id => documentAutoTags.get(id))
    .filter((tag): tag is DocumentAutoTag => tag !== null);
}

/**
 * Get the effective category (considering overrides)
 */
export function getEffectiveCategory(autoTag: DocumentAutoTag): AutoTagCategory {
  return autoTag.isOverridden && autoTag.overriddenCategory 
    ? autoTag.overriddenCategory 
    : autoTag.category;
}

/**
 * Get the effective tags (considering overrides)
 */
export function getEffectiveTags(autoTag: DocumentAutoTag): string[] {
  return autoTag.suggestedTags;
}
