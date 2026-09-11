import { Router, Request, Response } from "express";
import { generatePhiSafeText } from "./services/ai-gateway";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

interface SummarizeDocumentRequest {
  documentId?: string;
  documentType: string;
  documentTitle: string;
  documentContent: string;
  patientId: string;
  language?: string;
  readingLevel?: "simple" | "standard" | "detailed";
}

interface DocumentSummary {
  id: string;
  documentId?: string;
  documentType: string;
  documentTitle: string;
  summary: string;
  keyFindings: string[];
  medicalTermsExplained: Array<{ term: string; explanation: string }>;
  actionItems: string[];
  questionsToAsk: string[];
  generatedAt: string;
  language: string;
  readingLevel: string;
}

const summaryCache = new Map<string, DocumentSummary>();

function getDocumentTypeContext(documentType: string): string {
  const contexts: Record<string, string> = {
    pathology: "This is a pathology report containing tissue analysis results. Focus on explaining the diagnosis, grade, margins, and any markers tested.",
    imaging: "This is a radiology/imaging report (CT, MRI, PET, X-ray, etc.). Focus on explaining what was seen, any abnormalities, and measurements.",
    radiology: "This is a radiology report. Focus on explaining findings, impressions, and any recommendations.",
    oncology_notes: "This is an oncology clinical note. Focus on treatment plans, responses, and next steps.",
    chemo_orders: "This is a chemotherapy order. Focus on the drugs used, dosages, and schedule.",
    infusion_summaries: "This is an infusion summary. Focus on what was administered and any reactions.",
    radiation_summaries: "This is a radiation therapy summary. Focus on the treatment area, dose, and number of sessions.",
    surgery_op_notes: "This is an operative/surgery note. Focus on what was done, findings, and outcomes.",
    discharge_summary: "This is a hospital discharge summary. Focus on diagnosis, treatment received, and follow-up instructions.",
    lab_results: "This is a laboratory result. Focus on explaining what each test measures and whether results are normal.",
    progress_note: "This is a clinical progress note. Focus on the patient's current status and any changes.",
    consultation: "This is a consultation note. Focus on the specialist's assessment and recommendations.",
    default: "This is a medical document. Focus on the key clinical information and findings."
  };
  return contexts[documentType] || contexts.default;
}

router.post("/api/documents/summarize", async (req: Request, res: Response) => {
    try {
      const {
        documentId,
        documentType,
        documentTitle,
        documentContent,
        patientId,
        language = "en",
        readingLevel = "simple"
      } = req.body as SummarizeDocumentRequest;

      if (!documentContent || !documentType || !patientId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: documentContent, documentType, and patientId are required"
        });
      }

      // Cache key includes patientId for data isolation - prevents cross-patient cache leakage
      const cacheKey = `patient:${patientId}:doc:${documentId || "content"}:${language}:${readingLevel}`;
      const cached = summaryCache.get(cacheKey);
      if (cached && cached.documentId === documentId) {
        await logPhiAccess({
          action: "read",
          resourceType: "DocumentSummary",
          patientId,
          userId: patientId,
          details: `Retrieved cached summary for ${documentType}: ${documentTitle || documentId}`
        });
        return res.json({ 
          success: true, 
          data: cached, 
          fromCache: true,
          disclaimer: "This summary is for educational purposes only and is NOT medical advice. Always discuss your results with your healthcare provider."
        });
      }

      const readingLevelInstructions = {
        simple: "Use very simple, everyday language that anyone can understand. Avoid all medical jargon. Use short sentences. Explain everything as if speaking to someone with no medical background.",
        standard: "Use clear language with some medical terms, but explain each medical term when first used. Suitable for someone with a basic understanding of health topics.",
        detailed: "Provide a comprehensive summary with medical terminology. Include more technical details while still explaining complex concepts."
      };

      const languageInstruction = language !== "en" 
        ? `Respond in ${language === "es" ? "Spanish" : language === "zh" ? "Chinese" : language === "fr" ? "French" : language === "de" ? "German" : language === "pt" ? "Portuguese" : language === "ja" ? "Japanese" : language === "ko" ? "Korean" : language === "ar" ? "Arabic" : language === "hi" ? "Hindi" : language === "ru" ? "Russian" : language}.` 
        : "";

      const systemPrompt = `You are a helpful medical document summarizer for patients and caregivers. Your role is to make complex medical documents easy to understand.

CRITICAL COMPLIANCE REQUIREMENTS:
- You are NOT providing medical advice, diagnosis, or treatment recommendations
- You are ONLY explaining and summarizing what the document says
- Always include disclaimers that this is for educational purposes only
- Never suggest changing treatment or medications
- Always recommend discussing questions with healthcare providers

${readingLevelInstructions[readingLevel]}
${languageInstruction}

${getDocumentTypeContext(documentType)}

Your response must be in JSON format with the following structure:
{
  "summary": "A clear 2-4 paragraph summary of the document's main content",
  "keyFindings": ["Array of 3-7 key points from the document"],
  "medicalTermsExplained": [{"term": "Medical term", "explanation": "Plain language explanation"}],
  "actionItems": ["Array of any follow-up items or instructions mentioned in the document"],
  "questionsToAsk": ["Array of 2-4 suggested questions patient might want to ask their doctor about this document"]
}`;

      const userPrompt = `Please summarize this ${documentType.replace(/_/g, " ")} document titled "${documentTitle || "Medical Document"}":

---
${documentContent}
---

Remember: This summary is for educational purposes to help patients understand their medical documents. It is NOT medical advice.`;

      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 2000,
      });
      if (!content) {
        throw new Error("No response from AI model");
      }

      let parsedResponse: {
        summary: string;
        keyFindings: string[];
        medicalTermsExplained: Array<{ term: string; explanation: string }>;
        actionItems: string[];
        questionsToAsk: string[];
      };

      try {
        parsedResponse = JSON.parse(content);
      } catch {
        parsedResponse = {
          summary: content,
          keyFindings: [],
          medicalTermsExplained: [],
          actionItems: [],
          questionsToAsk: []
        };
      }

      const summary: DocumentSummary = {
        id: `sum_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        documentId,
        documentType,
        documentTitle: documentTitle || "Medical Document",
        summary: parsedResponse.summary,
        keyFindings: parsedResponse.keyFindings || [],
        medicalTermsExplained: parsedResponse.medicalTermsExplained || [],
        actionItems: parsedResponse.actionItems || [],
        questionsToAsk: parsedResponse.questionsToAsk || [],
        generatedAt: new Date().toISOString(),
        language,
        readingLevel
      };

      summaryCache.set(cacheKey, summary);

      await logPhiAccess({
        action: "read",
        resourceType: "DocumentSummary",
        patientId,
        userId: patientId,
        details: `Generated AI summary for ${documentType}: ${documentTitle || documentId}`
      });

      res.json({ 
        success: true, 
        data: summary, 
        fromCache: false,
        disclaimer: "This summary is for educational purposes only and is NOT medical advice. Always discuss your results with your healthcare provider."
      });
    } catch (error) {
      console.error("Error summarizing document:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate document summary"
      });
  }
});

router.post("/api/documents/explain-term", async (req: Request, res: Response) => {
    try {
      const { term, context, patientId, language = "en" } = req.body;

      if (!term || !patientId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: term and patientId are required"
        });
      }

      const languageInstruction = language !== "en" 
        ? `Respond in ${language === "es" ? "Spanish" : language === "zh" ? "Chinese" : language === "fr" ? "French" : language === "de" ? "German" : language === "pt" ? "Portuguese" : language === "ja" ? "Japanese" : language === "ko" ? "Korean" : language === "ar" ? "Arabic" : language === "hi" ? "Hindi" : language === "ru" ? "Russian" : language}.` 
        : "";

      const systemPrompt = `You are a helpful medical term explainer for patients. Your role is to explain medical terms in simple, everyday language.

CRITICAL: You are NOT providing medical advice. You are ONLY explaining what medical terms mean in general educational context.

${languageInstruction}

Provide a clear, concise explanation (2-3 sentences) that a person with no medical background would understand.`;

      const userPrompt = context 
        ? `Please explain the medical term "${term}" as it appears in this context: "${context}"`
        : `Please explain the medical term "${term}" in simple, everyday language.`;

      const explanation = (await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 300,
      })) || "Unable to explain this term.";

      await logPhiAccess({
        action: "read",
        resourceType: "MedicalTermExplanation",
        patientId,
        userId: patientId,
        details: `Explained medical term: ${term}`
      });

      res.json({
        success: true,
        data: {
          term,
          explanation,
          disclaimer: "This explanation is for educational purposes only and is not medical advice. Please consult your healthcare provider for personalized guidance."
        }
      });
    } catch (error) {
      console.error("Error explaining term:", error);
      res.status(500).json({
        success: false,
        error: "Failed to explain medical term"
      });
  }
});

router.get("/api/documents/:documentId/summaries", async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const patientId = req.query.patientId as string;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: "patientId query parameter is required"
      });
    }

    // Filter summaries by patientId AND documentId to prevent cross-patient access
    const summaries: DocumentSummary[] = [];
    const keyPrefix = `patient:${patientId}:doc:${documentId}`;
    summaryCache.forEach((summary, key) => {
      if (key.startsWith(keyPrefix) && summary.documentId === documentId) {
        summaries.push(summary);
      }
    });

    await logPhiAccess({
      action: "read",
      resourceType: "DocumentSummaryList",
      patientId,
      userId: patientId,
      details: `Retrieved summaries for document: ${documentId}`
    });

    res.json({ 
      success: true, 
      data: summaries,
      disclaimer: "This summary is for educational purposes only and is NOT medical advice. Always discuss your results with your healthcare provider."
    });
  } catch (error) {
    console.error("Error fetching summaries:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch document summaries"
    });
  }
});

export default router;
