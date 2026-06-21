import OpenAI from "openai";
import { Request, Response, Router } from "express";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface DocumentCategory {
  primaryCategory: string;
  subcategory: string | null;
  suggestedFolderPath: string;
  suggestedTags: Array<{ namespace: string; value: string; displayName: string }>;
  documentType: string;
  dateOfService: string | null;
  providerName: string | null;
  facilityName: string | null;
  summary: string;
  isSensitive: boolean;
  confidence: number;
  extractedData: Record<string, any>;
}

const DOCUMENT_CATEGORIES = {
  labs: {
    name: "Labs",
    folderPath: "cancer/labs",
    subcategories: ["blood_work", "urinalysis", "tumor_markers", "genetic_testing", "pathology"],
  },
  imaging: {
    name: "Imaging",
    folderPath: "cancer/imaging",
    subcategories: ["ct_scan", "mri", "pet_scan", "xray", "ultrasound", "mammogram"],
  },
  medications: {
    name: "Medications",
    folderPath: "medications",
    subcategories: ["prescription", "chemotherapy", "immunotherapy", "pain_management", "supportive_care"],
  },
  diagnosis_pathology: {
    name: "Diagnosis & Pathology",
    folderPath: "cancer/diagnosis-pathology",
    subcategories: ["biopsy", "pathology_report", "diagnosis", "staging"],
  },
  treatment: {
    name: "Treatment",
    folderPath: "cancer/treatment",
    subcategories: ["chemotherapy", "radiation", "surgery", "immunotherapy", "targeted_therapy"],
  },
  surgery: {
    name: "Surgery",
    folderPath: "cancer/treatment/surgery",
    subcategories: ["pre_op", "operative_report", "post_op", "discharge_summary"],
  },
  follow_ups: {
    name: "Follow-ups",
    folderPath: "cancer/followups",
    subcategories: ["oncology_visit", "progress_note", "surveillance"],
  },
  survivorship: {
    name: "Survivorship",
    folderPath: "cancer/survivorship",
    subcategories: ["survivorship_care_plan", "late_effects", "wellness"],
  },
  side_effects: {
    name: "Side Effects",
    folderPath: "cancer/side-effects",
    subcategories: ["symptom_report", "adverse_reaction", "management"],
  },
  insurance: {
    name: "Insurance & Authorizations",
    folderPath: "cancer/insurance-auth",
    subcategories: ["prior_auth", "claim", "eob", "denial", "appeal"],
  },
  general_medical: {
    name: "General Medical",
    folderPath: "general",
    subcategories: ["visit_note", "referral", "consent", "other"],
  },
};

const SYSTEM_PROMPT = `You are an AI medical document analyzer for a healthcare record management system. Your role is to analyze medical documents and categorize them accurately.

IMPORTANT COMPLIANCE NOTES:
- You are NOT providing medical advice or clinical decision support
- You are only categorizing and organizing documents for patient record management
- All analysis is for organizational purposes only

Given document content (text or description), you must:
1. Identify the PRIMARY category from: ${Object.keys(DOCUMENT_CATEGORIES).join(", ")}
2. Identify a subcategory if applicable
3. Suggest appropriate folder path for filing
4. Suggest relevant tags (namespace: doc, phase, tx, sx, fu)
5. Extract key metadata (date of service, provider, facility)
6. Provide a brief summary (1-2 sentences)
7. Flag if document contains sensitive information (HIV, mental health, substance abuse, genetic info)
8. Rate confidence (0.0 to 1.0)
9. Extract any structured data (lab values, medication names, dosages, etc.)

Tag namespaces:
- doc: Document type (pathology, imaging, oncology_note, lab, chemo_order, infusion_summary, radiation_summary, surgery_op_note, survivorship_plan)
- phase: Cancer journey phase (diagnosis, treatment, post_treatment, survivorship)
- tx: Treatment type (surgery, chemo, radiation, immunotherapy, targeted, hormonal, trial)
- sx: Symptoms/side effects (fatigue, nausea, neuropathy, diarrhea, rash, pain, insomnia, brain_fog)
- fu: Follow-up type (oncology_visit, imaging, lab, screening, cardiac, bone_health)

Respond ONLY with valid JSON matching this structure:
{
  "primaryCategory": "string (one of the category keys)",
  "subcategory": "string or null",
  "suggestedFolderPath": "string",
  "suggestedTags": [{"namespace": "string", "value": "string", "displayName": "string"}],
  "documentType": "string (specific document type name)",
  "dateOfService": "YYYY-MM-DD or null",
  "providerName": "string or null",
  "facilityName": "string or null",
  "summary": "string (1-2 sentences)",
  "isSensitive": boolean,
  "confidence": number (0.0-1.0),
  "extractedData": {object with any extracted structured data}
}`;

export async function categorizeDocument(
  content: string,
  filename?: string,
  mimeType?: string
): Promise<DocumentCategory> {
  const userPrompt = `Analyze and categorize this medical document:

Filename: ${filename || "Unknown"}
File type: ${mimeType || "Unknown"}

Document content:
${content.slice(0, 15000)}

Provide categorization as JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    return {
      primaryCategory: result.primaryCategory || "general_medical",
      subcategory: result.subcategory || null,
      suggestedFolderPath: result.suggestedFolderPath || "general",
      suggestedTags: result.suggestedTags || [],
      documentType: result.documentType || "document",
      dateOfService: result.dateOfService || null,
      providerName: result.providerName || null,
      facilityName: result.facilityName || null,
      summary: result.summary || "Medical document",
      isSensitive: result.isSensitive || false,
      confidence: result.confidence || 0.5,
      extractedData: result.extractedData || {},
    };
  } catch (error) {
    console.error("[AIDocumentCategorization] Error:", error);
    return {
      primaryCategory: "general_medical",
      subcategory: null,
      suggestedFolderPath: "general",
      suggestedTags: [],
      documentType: "document",
      dateOfService: null,
      providerName: null,
      facilityName: null,
      summary: "Unable to categorize document",
      isSensitive: false,
      confidence: 0,
      extractedData: {},
    };
  }
}

export async function analyzeDocumentImage(
  base64Image: string,
  filename?: string,
  mimeType?: string
): Promise<DocumentCategory> {
  const imageMediaType = mimeType?.startsWith("image/") ? mimeType : "image/jpeg";
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this medical document image and categorize it.
Filename: ${filename || "Unknown"}
File type: ${mimeType || "image"}

Provide categorization as JSON.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMediaType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    return {
      primaryCategory: result.primaryCategory || "general_medical",
      subcategory: result.subcategory || null,
      suggestedFolderPath: result.suggestedFolderPath || "general",
      suggestedTags: result.suggestedTags || [],
      documentType: result.documentType || "document",
      dateOfService: result.dateOfService || null,
      providerName: result.providerName || null,
      facilityName: result.facilityName || null,
      summary: result.summary || "Medical document image",
      isSensitive: result.isSensitive || false,
      confidence: result.confidence || 0.5,
      extractedData: result.extractedData || {},
    };
  } catch (error) {
    console.error("[AIDocumentCategorization] Image analysis error:", error);
    return {
      primaryCategory: "general_medical",
      subcategory: null,
      suggestedFolderPath: "general",
      suggestedTags: [],
      documentType: "document",
      dateOfService: null,
      providerName: null,
      facilityName: null,
      summary: "Unable to analyze document image",
      isSensitive: false,
      confidence: 0,
      extractedData: {},
    };
  }
}

export async function batchCategorizeDocuments(
  documents: Array<{ id: string; content: string; filename?: string; mimeType?: string }>
): Promise<Map<string, DocumentCategory>> {
  const results = new Map<string, DocumentCategory>();
  
  for (const doc of documents) {
    const category = await categorizeDocument(doc.content, doc.filename, doc.mimeType);
    results.set(doc.id, category);
  }
  
  return results;
}

const router = Router();

router.get("/api/document-categorization/categories", (_req: Request, res: Response) => {
  res.json({
    categories: Object.entries(DOCUMENT_CATEGORIES).map(([key, value]) => ({
      key,
      name: value.name,
      folderPath: value.folderPath,
      subcategories: value.subcategories,
    })),
  });
});

router.post("/api/document-categorization/analyze-text", async (req: Request, res: Response) => {
  const { content, filename, mimeType } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: "Document content is required" });
  }
  
  try {
    const result = await categorizeDocument(content, filename, mimeType);
    res.json(result);
  } catch (error) {
    console.error("[AIDocumentCategorization] API error:", error);
    res.status(500).json({ error: "Failed to categorize document" });
  }
});

router.post("/api/document-categorization/analyze-image", async (req: Request, res: Response) => {
  const { base64Image, filename, mimeType } = req.body;
  
  if (!base64Image) {
    return res.status(400).json({ error: "Base64 image data is required" });
  }
  
  try {
    const result = await analyzeDocumentImage(base64Image, filename, mimeType);
    res.json(result);
  } catch (error) {
    console.error("[AIDocumentCategorization] Image API error:", error);
    res.status(500).json({ error: "Failed to analyze document image" });
  }
});

router.post("/api/document-categorization/batch", async (req: Request, res: Response) => {
  const { documents } = req.body;
  
  if (!documents || !Array.isArray(documents)) {
    return res.status(400).json({ error: "Documents array is required" });
  }
  
  try {
    const results = await batchCategorizeDocuments(documents);
    res.json({
      results: Object.fromEntries(results),
    });
  } catch (error) {
    console.error("[AIDocumentCategorization] Batch API error:", error);
    res.status(500).json({ error: "Failed to batch categorize documents" });
  }
});

console.log("[AIDocumentCategorization] Service initialized with OpenAI integration");

export { router as aiDocumentCategorizationRouter };
