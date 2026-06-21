import { Router } from "express";
import OpenAI from "openai";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ExtractedInfo {
  dates: Array<{ type: string; value: string; context: string }>;
  names: Array<{ type: string; value: string; role?: string }>;
  dosages: Array<{ medication: string; dosage: string; frequency?: string; route?: string }>;
  diagnosisCodes: Array<{ code: string; system: string; description: string }>;
  procedures: Array<{ code?: string; description: string; date?: string }>;
  facilities: Array<{ name: string; type?: string; address?: string }>;
  labValues: Array<{ test: string; value: string; unit: string; referenceRange?: string; status?: string }>;
  allergies: string[];
  vitalSigns: Array<{ type: string; value: string; unit: string }>;
}

export interface TagSuggestion {
  tags: Array<{ name: string; confidence: number; reason: string }>;
  suggestedFolder: { name: string; path: string; reason: string };
  category: string;
  urgency: "routine" | "urgent" | "critical";
  relatedDocuments: string[];
}

export interface DocumentSummary {
  title: string;
  oneSentence: string;
  keyPoints: string[];
  clinicalRelevance: string;
  actionItems: string[];
  disclaimer: string;
}

router.post("/extract", async (req, res) => {
  try {
    const { documentText, documentType, documentId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!documentText) {
      return res.status(400).json({ error: "Document text is required" });
    }

    logPhiAccess({
      userId,
      patientId: "self",
      resourceType: "DocumentAI",
      action: "read",
      details: `AI extraction requested for document ${documentId || "unknown"}`,
    });

    const systemPrompt = `You are a medical document extraction AI. Extract structured information from medical documents.
Your role is STRICTLY educational - you help patients understand their documents. You do NOT provide medical advice.

Extract the following from the document:
1. Dates (appointment dates, lab dates, procedure dates, etc.)
2. Names (patient, providers, facilities)
3. Medication dosages (medication name, dosage, frequency, route)
4. Diagnosis codes (ICD-10, SNOMED, etc. with descriptions)
5. Procedures (CPT codes if available, descriptions)
6. Facilities (hospitals, clinics, labs)
7. Lab values (test name, value, unit, reference range, status)
8. Allergies
9. Vital signs

Return a JSON object with this structure:
{
  "dates": [{"type": "string", "value": "YYYY-MM-DD", "context": "string"}],
  "names": [{"type": "patient|provider|facility", "value": "string", "role": "string"}],
  "dosages": [{"medication": "string", "dosage": "string", "frequency": "string", "route": "string"}],
  "diagnosisCodes": [{"code": "string", "system": "ICD-10|SNOMED", "description": "string"}],
  "procedures": [{"code": "string", "description": "string", "date": "string"}],
  "facilities": [{"name": "string", "type": "string", "address": "string"}],
  "labValues": [{"test": "string", "value": "string", "unit": "string", "referenceRange": "string", "status": "normal|abnormal|critical"}],
  "allergies": ["string"],
  "vitalSigns": [{"type": "string", "value": "string", "unit": "string"}]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Document type: ${documentType || "Unknown"}\n\nDocument content:\n${documentText.substring(0, 8000)}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const extracted: ExtractedInfo = JSON.parse(content);

    res.json({
      success: true,
      extracted,
      disclaimer: "This extraction is for educational purposes only. Always verify with your healthcare provider.",
      processingTime: Date.now(),
    });
  } catch (error) {
    console.error("[AI Document Intelligence] Extraction error:", error);
    res.status(500).json({ error: "Failed to extract document information" });
  }
});

router.post("/suggest-tags", async (req, res) => {
  try {
    const { documentText, documentType, existingTags, documentId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!documentText) {
      return res.status(400).json({ error: "Document text is required" });
    }

    logPhiAccess({
      userId,
      patientId: "self",
      resourceType: "DocumentAI",
      action: "read",
      details: `AI tag suggestion requested for document ${documentId || "unknown"}`,
    });

    const systemPrompt = `You are a medical document organization AI. Suggest appropriate tags and folder organization for medical documents.
Your role is to help patients organize their health records effectively.

Analyze the document and suggest:
1. Tags that would help find this document later
2. The most appropriate folder based on document type
3. Document category
4. Urgency level (routine/urgent/critical)
5. Related document types that might be connected

Standard folder categories:
- Lab Results
- Imaging
- Visit Summaries
- Medications
- Immunizations
- Procedures
- Insurance
- Billing
- Cancer Care
- Chronic Conditions
- Mental Health
- Specialists
- Emergency Care
- Primary Care

Return a JSON object with this structure:
{
  "tags": [{"name": "string", "confidence": 0.0-1.0, "reason": "string"}],
  "suggestedFolder": {"name": "string", "path": "/folder/subfolder", "reason": "string"},
  "category": "string",
  "urgency": "routine|urgent|critical",
  "relatedDocuments": ["string"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Document type: ${documentType || "Unknown"}\nExisting tags: ${existingTags?.join(", ") || "none"}\n\nDocument content:\n${documentText.substring(0, 6000)}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const suggestions: TagSuggestion = JSON.parse(content);

    res.json({
      success: true,
      suggestions,
      processingTime: Date.now(),
    });
  } catch (error) {
    console.error("[AI Document Intelligence] Tag suggestion error:", error);
    res.status(500).json({ error: "Failed to suggest tags" });
  }
});

router.post("/summarize", async (req, res) => {
  try {
    const { documentText, documentType, summaryLength, documentId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!documentText) {
      return res.status(400).json({ error: "Document text is required" });
    }

    logPhiAccess({
      userId,
      patientId: "self",
      resourceType: "DocumentAI",
      action: "read",
      details: `AI summarization requested for document ${documentId || "unknown"}`,
    });

    const lengthGuide = summaryLength === "brief" ? "2-3 sentences" : summaryLength === "detailed" ? "1-2 paragraphs" : "4-5 sentences";

    const systemPrompt = `You are a medical document summarization AI. Create clear, patient-friendly summaries of medical documents.

CRITICAL: You are an EDUCATIONAL tool only. You do NOT provide medical advice, diagnoses, or treatment recommendations.
Always include a disclaimer that patients should discuss the document with their healthcare provider.

Create a summary that includes:
1. A clear, descriptive title
2. A one-sentence overview
3. Key points (bullet points of the most important information)
4. Clinical relevance (why this document matters for the patient's health record)
5. Action items (if any follow-up is mentioned in the document)

Use plain language that any patient can understand. Avoid medical jargon where possible, or explain it when necessary.
Summary length should be approximately ${lengthGuide}.

Return a JSON object with this structure:
{
  "title": "string",
  "oneSentence": "string",
  "keyPoints": ["string"],
  "clinicalRelevance": "string",
  "actionItems": ["string"],
  "disclaimer": "This summary is for educational purposes only. Please discuss with your healthcare provider."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Document type: ${documentType || "Unknown"}\n\nDocument content:\n${documentText.substring(0, 10000)}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const summary: DocumentSummary = JSON.parse(content);
    summary.disclaimer = "This summary is for educational purposes only. NOT medical advice. Please discuss with your healthcare provider.";

    res.json({
      success: true,
      summary,
      processingTime: Date.now(),
    });
  } catch (error) {
    console.error("[AI Document Intelligence] Summarization error:", error);
    res.status(500).json({ error: "Failed to summarize document" });
  }
});

router.post("/analyze-complete", async (req, res) => {
  try {
    const { documentText, documentType, documentId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!documentText) {
      return res.status(400).json({ error: "Document text is required" });
    }

    logPhiAccess({
      userId,
      patientId: "self",
      resourceType: "DocumentAI",
      action: "read",
      details: `Complete AI analysis requested for document ${documentId || "unknown"}`,
    });

    const systemPrompt = `You are a comprehensive medical document analysis AI. Perform a complete analysis including extraction, organization suggestions, and summarization.

CRITICAL: You are STRICTLY an educational tool. You do NOT provide medical advice, diagnoses, or treatment recommendations.

Analyze the document and provide:

1. EXTRACTED INFORMATION:
   - Key dates
   - Names (patient, providers)
   - Medications with dosages
   - Diagnosis codes
   - Lab values
   - Allergies
   - Vital signs

2. ORGANIZATION SUGGESTIONS:
   - Recommended tags (with confidence scores)
   - Suggested folder
   - Document category
   - Urgency level

3. SUMMARY:
   - Title
   - One-sentence overview
   - Key points
   - Action items

Return a JSON object with this structure:
{
  "extracted": {
    "dates": [{"type": "string", "value": "string", "context": "string"}],
    "names": [{"type": "string", "value": "string"}],
    "dosages": [{"medication": "string", "dosage": "string", "frequency": "string"}],
    "diagnosisCodes": [{"code": "string", "system": "string", "description": "string"}],
    "labValues": [{"test": "string", "value": "string", "unit": "string", "status": "string"}],
    "allergies": ["string"],
    "vitalSigns": [{"type": "string", "value": "string", "unit": "string"}]
  },
  "organization": {
    "tags": [{"name": "string", "confidence": 0.95}],
    "suggestedFolder": "string",
    "category": "string",
    "urgency": "routine|urgent|critical"
  },
  "summary": {
    "title": "string",
    "oneSentence": "string",
    "keyPoints": ["string"],
    "actionItems": ["string"]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Document type: ${documentType || "Unknown"}\n\nDocument content:\n${documentText.substring(0, 10000)}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 6000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const analysis = JSON.parse(content);

    res.json({
      success: true,
      analysis,
      disclaimer: "This analysis is for educational purposes only. NOT medical advice. Please discuss with your healthcare provider.",
      processingTime: Date.now(),
    });
  } catch (error) {
    console.error("[AI Document Intelligence] Complete analysis error:", error);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

export default router;
